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
    // 1. 오학동의 잘못된 20061222 번호를 2006-1-222로 수정
    console.log('Updating certificate 20061222 to 2006-1-222...');
    const { data: updateData, error: updateError } = await supabase
        .from('certificate_registry')
        .update({
            certificate_number_raw: '2006-1-222',
            certificate_number_normalized: '2006-1-222'
        })
        .eq('certificate_number_raw', '20061222');

    if (updateError) {
        console.error('Update failed:', updateError);
    } else {
        console.log('Update success!');
    }

    // 2. 통합 정보를 명확히 하기 위해 note 필드에 node_type: 'derivative'가 누락된 경우 보정 (선택 사항)
    // 오학동 ID로 조회하여 처리
    const entityId = 'cfd47003-06f2-462e-a17c-f94ad9f47460';
    const { data: rights } = await supabase.from('certificate_registry').select('*').eq('entity_id', entityId);
    
    for (const r of (rights || [])) {
        if (r.certificate_number_raw === '2006-1-222' && r.is_active) {
            let meta = {};
            try { if(r.note) meta = JSON.parse(r.note); } catch(e){}
            if (meta.node_type !== 'derivative') {
                meta.node_type = 'derivative';
                meta.integration_type = 'consolidated';
                await supabase.from('certificate_registry').update({ note: JSON.stringify(meta) }).eq('id', r.id);
                console.log(`Fixed metadata for ${r.certificate_number_raw}`);
            }
        }
    }
}

main().catch(console.error);
