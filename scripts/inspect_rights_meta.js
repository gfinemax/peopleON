const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/workspace/antigravity/peopleon/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectRights() {
    console.log('--- Inspecting Asset Rights for Column Alignment ---');

    const { data: rights, error } = await supabase
        .from('asset_rights')
        .select(`
            id,
            right_number,
            meta,
            account_entities (
                display_name
            )
        `)
        .limit(20);

    if (error) {
        console.error('Error:', error);
        return;
    }

    rights.forEach((r, i) => {
        console.log(`[Record ${i}]`);
        console.log(`  Number: ${r.right_number}`);
        console.log(`  EntityName: ${r.account_entities?.display_name}`);
        console.log(`  Meta:`, JSON.stringify(r.meta));
    });
}

inspectRights();
