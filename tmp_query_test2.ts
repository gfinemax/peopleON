import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

async function run() {
    console.log('Testing simple ilike:');
    const { data: d1, error: e1 } = await supabase.from('interaction_logs').select('entity_id, title').ilike('title', '%이필순%');
    console.log('d1:', d1?.length, 'e1:', e1);

    console.log('Testing simple ilike on summary:');
    const { data: d2, error: e2 } = await supabase.from('interaction_logs').select('entity_id, summary').ilike('summary', '%이필순%');
    console.log('d2:', d2?.length, 'e2:', e2);

    console.log('Testing OR query:');
    const { data: d3, error: e3 } = await supabase.from('interaction_logs').select('entity_id').or('title.ilike.%이필순%,summary.ilike.%이필순%');
    console.log('d3:', d3?.length, 'e3:', e3?.message);
}

run();
