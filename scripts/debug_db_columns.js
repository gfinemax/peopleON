
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTableInfo() {
    console.log('--- Fetching column info and sample record for membership_roles ---');
    const { data: samples, error } = await supabase
        .from('membership_roles')
        .select('*')
        .limit(1);
    
    if (error) {
        console.error('Error fetching sample:', error.message);
    } else if (samples && samples.length > 0) {
        console.log('Column names in membership_roles:', Object.keys(samples[0]));
        console.log('Sample record:', samples[0]);
    } else {
        console.log('No records found in membership_roles');
    }

    console.log('\n--- Fetching column info for account_entities ---');
    const { data: entSamples, error: entError } = await supabase
        .from('account_entities')
        .select('*')
        .limit(1);
    
    if (entError) {
        console.error('Error fetching entity sample:', entError.message);
    } else if (entSamples && entSamples.length > 0) {
        console.log('Column names in account_entities:', Object.keys(entSamples[0]));
    }
}

checkTableInfo().catch(console.error);
