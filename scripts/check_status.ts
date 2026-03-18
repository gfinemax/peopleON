import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // using service role to bypass RLS for checking
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('account_entities')
        .select('id, name, status, created_at')
        .eq('status', '차명');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Found ${data.length} entities with status '차명'`);
        console.log(data);
    }
}

check();
