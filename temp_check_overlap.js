const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
if (!urlMatch || !keyMatch) {
    console.error("Missing env vars in .env.local");
    process.exit(1);
}
const url = urlMatch[1].trim();
const key = keyMatch[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

(async () => {
    const { data: roles, error } = await supabase.from('membership_roles').select('*');
    if (error) { console.error(error); return; }

    const counts = {};
    roles.forEach(r => {
        if (!counts[r.entity_id]) counts[r.entity_id] = { roles: [], isActive: false };
        counts[r.entity_id].roles.push(r.role_code);
        if (r.role_status === 'active') counts[r.entity_id].isActive = true;
    });

    const overlap = Object.entries(counts).filter(([id, data]) => {
        const r = data.roles;
        const hasReg = r.includes('1차') || r.includes('등기조합원');
        const hasPre = r.includes('예비조합원') || r.includes('예비');
        return hasReg && hasPre;
    });

    console.log('OVERLAPS (Both registered and preliminary):');
    for (const [id, data] of overlap) {
        const { data: entity } = await supabase.from('account_entities').select('*').eq('id', id).single();
        console.log(`- ${entity.display_name} (${entity.phone}) : Roles: ${data.roles.join(', ')}`);
    }
})();
