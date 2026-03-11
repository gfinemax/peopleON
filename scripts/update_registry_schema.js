/**
 * Step 4.5: certificate_registry 스키마 보강
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SQL = `
ALTER TABLE certificate_registry 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS holding_status TEXT,
ADD COLUMN IF NOT EXISTS cert_holder_name TEXT,
ADD COLUMN IF NOT EXISTS cert_date TEXT,
ADD COLUMN IF NOT EXISTS cert_price TEXT,
ADD COLUMN IF NOT EXISTS cert_agency TEXT;
`;

async function main() {
    const { error } = await supabase.rpc('exec_sql', { query: SQL }).maybeSingle();
    if (error) {
        console.error('RPC failed:', error.message);
        console.log('SQL to run manually:\n', SQL);
    } else {
        console.log('Schema updated successfully.');
    }
}

main().catch(console.error);
