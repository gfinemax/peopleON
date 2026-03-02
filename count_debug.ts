import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCounts() {
    const { count: allEntities } = await supabase.from('account_entities').select('*', { count: 'exact', head: true });
    console.log('Total account_entities (raw count):', allEntities);

    const { data: roles } = await supabase.from('membership_roles').select('entity_id, role_code, role_status');
    console.log('Total membership_roles:', roles?.length);

    const activeMembers = new Set();
    if (roles) {
        roles.filter(r => r.role_status === 'active').forEach(r => {
            const t = r.role_code || '';
            if (['등기조합원', '1차', '2차', '예비조합원', '예비', '지주조합원', '일반조합원', '임시원장', '지주'].includes(t)) {
                activeMembers.add(r.entity_id);
            }
        });
    }
    console.log('Unique entities with active member/landowner roles:', activeMembers.size);

    const justMembers = new Set();
    if (roles) {
        roles.filter(r => r.role_status === 'active').forEach(r => {
            const t = r.role_code || '';
            if (['등기조합원', '1차', '2차', '예비조합원', '예비', '지주조합원', '일반조합원', '임시원장'].includes(t)) {
                justMembers.add(r.entity_id);
            }
        });
    }
    console.log('Unique entities with active generic member roles (excl landowners, investors, agents):', justMembers.size);
}

checkCounts().catch(console.error);
