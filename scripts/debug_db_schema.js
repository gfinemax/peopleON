
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchemaAndData() {
    console.log('--- Checking available roles in membership_roles ---');
    const { data: roles, error: rolesError } = await supabase
        .from('membership_roles')
        .select('role_code')
        .limit(10);
    
    if (rolesError) {
       console.error('Error fetching roles:', rolesError.message);
    } else {
       const uniqueRoles = [...new Set(roles.map(r => r.role_code))];
       console.log('Samples from existing roles:', uniqueRoles);
    }

    console.log('\n--- Checking constraints on entity_private_info ---');
    // We can't easily check constraints via Supabase JS without query_raw (which we don't have)
    // but we can try to insert a dummy record and see the error.
}

checkSchemaAndData().catch(console.error);
