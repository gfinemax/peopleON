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
    const { data: rights } = await supabase.from('certificate_registry').select('*').eq('entity_id', entityId);

    console.log(`Starting final sync for Oh Hak-dong (${rights.length} items)...`);

    for (const r of (rights || [])) {
        // 1. 하이픈 없는 '20061222' 번호 자체가 ACTIVE면 무조건 수정
        if (r.certificate_number_raw === '20061222' && r.is_active) {
            console.log(`- Fixing Number: ${r.id} (${r.certificate_number_raw} -> 2006-1-222)`);
            await supabase.from('certificate_registry').update({
                certificate_number_raw: '2006-1-222',
                certificate_number_normalized: '2006-1-222'
            }).eq('id', r.id);
            r.certificate_number_raw = '2006-1-222'; // 로컬 값 업데이트
        }

        // 2. 통합 결과물(Derivative) 체크 및 메타데이터 강제 주입
        // 오학동의 '2006-1-222'는 현재 '2건'의 관리 대상으로 잡혀있으므로, 하나만 DERIVATIVE가 되고 나머지는 RAW(부속)가 되어야 함.
        let meta = {};
        try { if(r.note) meta = typeof r.note === 'object' ? r.note : JSON.parse(r.note); } catch(e){}

        if (r.certificate_number_raw === '2006-1-222' && r.is_active) {
            console.log(`- Injecting Metadata for Derivative: ${r.id}`);
            await supabase.from('certificate_registry').update({
                note: JSON.stringify({
                    ...meta,
                    node_type: 'derivative',
                    integration_type: 'consolidated'
                })
            }).eq('id', r.id);
        }
    }
    
    console.log('Final Sync Complete.');
}

main().catch(console.error);
