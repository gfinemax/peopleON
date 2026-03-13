const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf-8');
const getEnv = (key) => {
    const match = envContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match ? match[1].trim() : null;
};
const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function main() {
    const entityId = 'cfd47003-06f2-462e-a17c-f94ad9f47460'; // 오학동
    const { data: rights, error } = await supabase
        .from('certificate_registry')
        .select('*')
        .eq('entity_id', entityId);

    if (error) {
        console.error(error);
        return;
    }

    console.log(`Found ${rights.length} rights for entity ${entityId}`);

    for (const r of rights) {
        // 1. 잘못된 원천 권리증 (통합 후에도 살아있는 경우 등) 정리
        // 하이픈 없는 '20061222'가 만약 ACTIVE라면 INACTIVE로 돌리거나, 
        // 하이픈 있는 '2006-1-222'가 RAW가 아닌 DERIVATIVE여야 함.
        
        let meta = {};
        try { if(r.note) {
            if (typeof r.note === 'object') meta = r.note;
            else meta = JSON.parse(r.note);
        } } catch(e){}

        console.log(`Processing ID: ${r.id} | NUM: ${r.certificate_number_raw} | ACTIVE: ${r.is_active}`);

        // A. 사용자가 보고 계신 '20061222'가 ACTIVE인 경우 -> RAW로 되어있는 것을 보정 또는 비활성화
        if (r.certificate_number_raw === '20061222' && r.is_active) {
            console.log(`  -> Fixing 20061222 to 2006-1-222 and marking as derivative`);
            await supabase.from('certificate_registry').update({
                certificate_number_raw: '2006-1-222',
                certificate_number_normalized: '2006-1-222',
                note: JSON.stringify({
                    ...meta,
                    node_type: 'derivative',
                    integration_type: 'consolidated'
                })
            }).eq('id', r.id);
        }

        // B. '2006-1-222'가 이미 있는데 RAW로 되어있는 경우 -> DERIVATIVE로 보정
        if (r.certificate_number_raw === '2006-1-222' && meta.node_type !== 'derivative') {
            console.log(`  -> Marking 2006-1-222 as derivative`);
            await supabase.from('certificate_registry').update({
                note: JSON.stringify({
                    ...meta,
                    node_type: 'derivative',
                    integration_type: 'consolidated'
                })
            }).eq('id', r.id);
        }
    }
    
    console.log('Cleanup finished.');
}

main().catch(console.error);
