
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- account_entities ---');
    const { data: ae, error: aee } = await supabase.from('account_entities').select('*').limit(1);
    if (aee) console.error(aee);
    else console.log(Object.keys(ae[0] || {}));

    console.log('\n--- asset_rights ---');
    const { data: ar, error: are } = await supabase.from('asset_rights').select('*').limit(1);
    if (are) console.error(are);
    else console.log(Object.keys(ar[0] || {}));
}

check();
