
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function listAllRoles() {
    console.log('--- Fetching all unique role_codes from membership_roles ---');
    const { data: roles, error: rolesError } = await supabase
        .from('membership_roles')
        .select('role_code');
    
    if (rolesError) {
       console.error('Error fetching roles:', rolesError.message);
    } else {
       const uniqueRoles = [...new Set(roles.map(r => r.role_code))];
       console.log('Available role_codes:', uniqueRoles);
    }

    console.log('\n--- Checking for existing member with the reported name ---');
    const { data: existing, error: existingError } = await supabase
        .from('account_entities')
        .select('*')
        .eq('display_name', '조화영');
    
    if (!existingError && existing && existing.length > 0) {
       console.log('Found existing members with name 조화영:', existing.map(e => ({ id: e.id, status: e.status })));
    } else {
       console.log('No existing member with name 조화영 found.');
    }
}

listAllRoles().catch(console.error);
