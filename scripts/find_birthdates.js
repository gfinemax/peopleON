
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findBirthdates() {
    console.log('Searching for date-like strings in member_number and right_number...');

    // account_entities
    const { data: ae } = await supabase.from('account_entities').select('id, display_name, member_number');
    const aeMatches = (ae || []).filter(e => {
        const v = (e.member_number || '').trim();
        return v.startsWith('19') || v.startsWith('20') || /^\d{4}\.\d{2}\.\d{2}$/.test(v);
    });

    console.log(`\n--- account_entities.member_number matches (${aeMatches.length}) ---`);
    aeMatches.forEach(e => console.log(`${e.display_name}: ${e.member_number}`));

    // asset_rights
    const { data: ar } = await supabase.from('asset_rights').select('id, right_number, entity_id');
    const arMatches = (ar || []).filter(r => {
        const v = (r.right_number || '').trim();
        return v.startsWith('19') || v.startsWith('20') || /^\d{4}\.\d{2}\.\d{2}$/.test(v);
    });

    console.log(`\n--- asset_rights.right_number matches (${arMatches.length}) ---`);
    for (const r of arMatches) {
        const { data: ent } = await supabase.from('account_entities').select('display_name').eq('id', r.entity_id).single();
        console.log(`${ent?.display_name || 'Unknown'}: ${r.right_number} (ID: ${r.id})`);
    }
}

findBirthdates();
