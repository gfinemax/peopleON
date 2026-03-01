const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/workspace/antigravity/peopleon/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    // 1. Get entities with asset rights
    const { data: rights, error: rightsError } = await supabase
        .from('asset_rights')
        .select('entity_id, right_type, right_number');

    if (rightsError) {
        console.error('Error fetching rights:', rightsError);
        return;
    }

    const entitiesWithRights = [...new Set(rights.map(r => r.entity_id))];
    console.log(`Unique entities with rights: ${entitiesWithRights.length}`);

    // 2. Check their roles
    const { data: roles, error: rolesError } = await supabase
        .from('membership_roles')
        .select('entity_id, role_code, role_status')
        .in('entity_id', entitiesWithRights);

    if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        return;
    }

    console.log(`Roles for these ${entitiesWithRights.length} entities: ${roles.length}`);

    // Find entities with rights but without '권리증보유자' role
    const entitiesWithInvestorRole = new Set(
        roles.filter(r => r.role_code === '권리증보유자').map(r => r.entity_id)
    );

    const missingRoleCount = entitiesWithRights.filter(id => !entitiesWithInvestorRole.has(id)).length;
    console.log(`Entities with rights but MISSING '권리증보유자' role: ${missingRoleCount}`);

    if (missingRoleCount > 0) {
        const firstMissing = entitiesWithRights.find(id => !entitiesWithInvestorRole.has(id));
        const { data: ent } = await supabase.from('account_entities').select('display_name').eq('id', firstMissing).single();
        const entRoles = roles.filter(r => r.entity_id === firstMissing);
        console.log(`Example: ${ent.display_name} (ID: ${firstMissing})`);
        console.log(`Existing roles:`, entRoles.map(r => `${r.role_code} (${r.role_status})`));
    }
}

check();
