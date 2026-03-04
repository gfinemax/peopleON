import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

async function run() {
    const query = '이필순';
    console.log('Testing parallel queries instead of OR:');
    const [tRes, sRes] = await Promise.all([
        supabase.from('interaction_logs').select('entity_id').ilike('title', `%${query}%`),
        supabase.from('interaction_logs').select('entity_id').ilike('summary', `%${query}%`)
    ]);

    console.log('title hits:', tRes.data?.length, tRes.error);
    console.log('summary hits:', sRes.data?.length, sRes.error);

    const ids = new Set<string>();
    tRes.data?.forEach(d => ids.add(d.entity_id));
    sRes.data?.forEach(d => ids.add(d.entity_id));
    console.log('Total unique mapped entity IDs:', ids.size);
    console.log('IDs:', Array.from(ids));
}

run();
