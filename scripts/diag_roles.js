const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/workspace/antigravity/peopleon/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- Membership Roles ---');
    const { data: roles, error: rolesError } = await supabase
        .from('membership_roles')
        .select('role_code, role_status');

    if (rolesError) {
        console.error('Error fetching roles:', rolesError);
    } else {
        const counts = {};
        roles.forEach(r => {
            const key = `${r.role_code} (${r.role_status})`;
            counts[key] = (counts[key] || 0) + 1;
        });
        console.log(counts);
    }

    console.log('\n--- Asset Rights ---');
    const { count, error: rightsError } = await supabase
        .from('asset_rights')
        .select('*', { count: 'exact', head: true });

    if (rightsError) {
        console.error('Error fetching rights:', rightsError);
    } else {
        console.log('Total asset_rights:', count);
    }

    console.log('\n--- People with investor role ---');
    const { data: investors, error: invError } = await supabase
        .from('membership_roles')
        .select('entity_id')
        .eq('role_code', '권리증보유자')
        .eq('role_status', 'active');

    if (invError) {
        console.error('Error fetching investors:', invError);
    } else {
        console.log('Active 권리증보유자 count:', investors.length);
    }
}

check();
