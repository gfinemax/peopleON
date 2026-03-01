const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'c:/workspace/antigravity/peopleon/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findMisaligned() {
    console.log('--- Finding Misaligned Asset Rights ---');

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
        .or('right_number.ilike.%10대%,right_number.ilike.%1943%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${rights.length} potentially misaligned records.`);
    rights.forEach((r, i) => {
        console.log(`[Result ${i}]`);
        console.log(`  Number: ${r.right_number}`);
        console.log(`  Name: ${r.account_entities?.display_name}`);
        console.log(`  Meta:`, JSON.stringify(r.meta));
    });
}

findMisaligned();
