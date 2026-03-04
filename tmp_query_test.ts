import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

async function run() {
    const query = '이필순';
    const { data, error } = await supabase
        .from('interaction_logs')
        .select('entity_id, title, summary')
        .or(`title.ilike.*${query}*,summary.ilike.*${query}*`);

    console.log("Error:", error);
    console.log("Data:", data);
}

run();
