
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase env variables missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking certificate_registry...');
    const { data: all, count: allCount } = await supabase.from('certificate_registry').select('*', { count: 'exact' });
    console.log(`Total rows in certificate_registry: ${allCount}`);
    
    if (all && all.length > 0) {
        console.log('Sample row:', JSON.stringify(all[0], null, 2));
        
        const activeCount = all.filter(r => r.is_active).length;
        const confirmedCount = all.filter(r => r.is_confirmed_for_count).length;
        console.log(`Active rows: ${activeCount}`);
        console.log(`Confirmed for count rows: ${confirmedCount}`);
        
        const nullActive = all.filter(r => r.is_active === null).length;
        console.log(`is_active is NULL rows: ${nullActive}`);
    } else {
        console.log('No data found in certificate_registry.');
    }
}

checkData();
