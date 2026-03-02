
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking for birthdates in certificate fields...');

    // 1. Check account_entities.member_number
    const { data: entities, error: entitiesError } = await supabase
        .from('account_entities')
        .select('id, display_name, member_number, birth_date')
        .not('member_number', 'is', null);

    if (entitiesError) {
        console.error('Error fetching entities:', entitiesError);
        return;
    }

    const entityMatches = entities.filter(e => {
        const v = e.member_number.trim();
        return v.startsWith('19') || v.startsWith('20') || /^\d{4}\.\d{2}\.\d{2}$/.test(v);
    });

    console.log(`Found ${entityMatches.length} entities with possible birthdates in member_number.`);
    entityMatches.forEach(e => {
        console.log(`  - ${e.display_name} (${e.id}): ${e.member_number} -> current birth_date: ${e.birth_date}`);
    });

    // 2. Check asset_rights.right_number
    const { data: rights, error: rightsError } = await supabase
        .from('asset_rights')
        .select('id, entity_id, right_number, account_entities(display_name, birth_date)')
        .not('right_number', 'is', null);

    if (rightsError) {
        console.error('Error fetching rights:', rightsError);
        return;
    }

    const rightsMatches = rights.filter(r => {
        const v = r.right_number.trim();
        return v.startsWith('19') || v.startsWith('20') || /^\d{4}\.\d{2}\.\d{2}$/.test(v);
    });

    console.log(`\nFound ${rightsMatches.length} asset_rights with possible birthdates in right_number.`);
    rightsMatches.forEach(r => {
        console.log(`  - ${r.account_entities.display_name} (Entity: ${r.entity_id}, Right: ${r.id}): ${r.right_number} -> current birth_date: ${r.account_entities.birth_date}`);
    });
}

checkData();
