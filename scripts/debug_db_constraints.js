
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
    console.log('--- Testing insert into account_entities to find constraints ---');
    // We try to insert a record that might fail if there are unique constraints
    const { error: entityError } = await supabase
        .from('account_entities')
        .insert({
            display_name: '테스트용',
            status: '정상',
            entity_type: 'person'
        })
        .select();
    
    if (entityError) {
        console.error('Entity Insert Error (if any):', entityError.message);
    } else {
        console.log('Inserting basic entity works fine.');
    }

    console.log('\n--- Checking resident_registration_number uniqueness ---');
    const rrns = ['610825-2551112']; 
    const { data: privates, error: privError } = await supabase
        .from('entity_private_info')
        .select('*')
        .in('resident_registration_number', rrns);
    
    if (!privError && privates && privates.length > 0) {
        console.log('Found existing RRN entries:', privates.length);
        const { data: owner } = await supabase
            .from('account_entities')
            .select('display_name')
            .eq('id', privates[0].entity_id)
            .single();
        console.log('RRN already belongs to:', owner?.display_name);
    } else {
        console.log('No existing RRN entry found for the reported number.');
    }
}

checkConstraints().catch(console.error);
