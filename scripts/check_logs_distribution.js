
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    const { data, error } = await supabase
        .from('interaction_logs')
        .select('created_at, staff_name, summary')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error(error);
        return;
    }

    console.log('Recent 20 logs:');
    data.forEach(log => {
        console.log(`[${log.created_at}] Staff: ${log.staff_name} | Summary: ${log.summary.substring(0, 30)}...`);
    });

    const { count: importedCount } = await supabase
        .from('interaction_logs')
        .select('*', { count: 'exact', head: true })
        .eq('staff_name', '이전시스템기록');

    console.log(`\nImported ('이전시스템기록') count: ${importedCount}`);

    const { count: totalCount } = await supabase
        .from('interaction_logs')
        .select('*', { count: 'exact', head: true });

    console.log(`Total logs: ${totalCount}`);
}

checkLogs();
