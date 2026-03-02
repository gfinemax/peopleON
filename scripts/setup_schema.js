const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function setupSchema() {
    console.log('Attempting to update schema via RPC...');

    // 1. Add birth_date column to account_entities
    const { error: err1 } = await supabase.rpc('exec_sql', {
        sql_query: 'ALTER TABLE account_entities ADD COLUMN IF NOT EXISTS birth_date TEXT;'
    });

    if (err1) {
        console.error('Error adding birth_date column:', err1.message);
        console.log('Note: If "exec_sql" RPC is missing, you need to run this SQL in Supabase Dashboard.');
    } else {
        console.log('Successfully added birth_date column or it already exists.');
    }

    // 2. Create entity_private_info table
    const createTableSql = `
        CREATE TABLE IF NOT EXISTS entity_private_info (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            entity_id UUID NOT NULL REFERENCES account_entities(id) ON DELETE CASCADE,
            resident_registration_number TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_private_info_entity_id ON entity_private_info(entity_id);
    `;

    const { error: err2 } = await supabase.rpc('exec_sql', {
        sql_query: createTableSql
    });

    if (err2) {
        console.error('Error creating entity_private_info table:', err2.message);
    } else {
        console.log('Successfully created entity_private_info table or it already exists.');
    }
}

setupSchema();
