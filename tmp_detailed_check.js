const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf-8');
const getEnv = (key) => {
    const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match ? match[1].trim() : null;
};
const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function main() {
    const entityId = 'cfd47003-06f2-462e-a17c-f94ad9f47460'; // 오학동
    const { data, error } = await supabase
        .from('certificate_registry')
        .select('*')
        .eq('entity_id', entityId);

    if (error) {
        console.error(error);
        return;
    }

    console.log('=== OH HAK DONG CERTIFICATES (DETAILED) ===');
    data.forEach(r => {
        console.log(`[${r.is_active ? 'ACTIVE' : 'INACTIVE'}] ID: ${r.id}`);
        console.log(`  RAW: ${r.certificate_number_raw}`);
        console.log(`  NORM: ${r.certificate_number_normalized}`);
        console.log(`  NOTE: ${r.note}`);
        console.log('---');
    });
}

main().catch(console.error);
