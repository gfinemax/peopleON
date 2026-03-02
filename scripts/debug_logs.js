const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkLogs() {
    const { data, error } = await supabase
        .from('interaction_logs')
        .select('*')
        .ilike('summary', '%중복%')
        .limit(10);

    if (error) console.error(error);
    else console.log(data);
}
checkLogs();
