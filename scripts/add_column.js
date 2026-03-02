
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function addColumn() {
    console.log('Attempting to add birth_date column via SQL RPC...');

    // Some Supabase setups have an 'exec_sql' RPC. Let's try it.
    const { error } = await supabase.rpc('exec_sql', {
        sql: 'ALTER TABLE account_entities ADD COLUMN IF NOT EXISTS birth_date TEXT;'
    });

    if (error) {
        console.error('Error adding column via RPC:', error);
        console.log('Falling back: Please ask the user to add the column manually if this is a managed DB without RPC access.');
    } else {
        console.log('Column birth_date added successfully!');
    }
}

addColumn();
