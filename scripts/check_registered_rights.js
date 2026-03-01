const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/workspace/antigravity/peopleon/.env.local' });

async function checkRegisteredRights() {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('--- Checking Registered Members & Rights ---');

    // 1. Get all registered entity IDs
    const { data: roles, error: rolesError } = await supabase
        .from('membership_roles')
        .select('entity_id')
        .eq('is_registered', true);

    if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        return;
    }

    const registeredIds = Array.from(new Set(roles.map(r => r.entity_id)));
    console.log(`Total Unique Registered Entities: ${registeredIds.length}`);

    // 2. Get rights for these entities
    const { data: rights, error: rightsError } = await supabase
        .from('asset_rights')
        .select('entity_id, right_number')
        .in('entity_id', registeredIds);

    if (rightsError) {
        console.error('Error fetching rights:', rightsError);
        return;
    }

    const entitiesWithRights = new Set(rights.map(r => r.entity_id));
    console.log(`Registered Entities with at least one record in asset_rights: ${entitiesWithRights.size}`);

    // 3. Find missing entities
    const missingIds = registeredIds.filter(id => !entitiesWithRights.has(id));
    console.log(`Registered Entities missing from asset_rights: ${missingIds.length}`);

    if (missingIds.length > 0) {
        const { data: names } = await supabase
            .from('account_entities')
            .select('display_name, member_number')
            .in('id', missingIds.slice(0, 10));

        console.log('\nSample Registered Members MISSING from asset_rights:');
        names.forEach(n => {
            console.log(`- ${n.display_name} (Member No: ${n.member_number})`);
        });
    }
}

checkRegisteredRights();
