import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanupKimSunJin() {
    console.log('=== 김선진 데이터 정리 및 통합 시작 (ESM) ===\n');

    // 1. 대상 Entity IDs
    const mainId = 'f1ed1563-79bd-4c87-a9e5-7b24f991dfff';
    const duplicateIds = [
        '8599358e-cf8f-4fd8-9917-c67cf2ddac03',
        '3519a677-cf43-443d-8a80-0d58dc9615f5',
        '086fbe44-b3b7-4c87-96fb-32fc31c15bfb'
    ];

    // 2. Main Entity 정보 정상화 (회원번호: '보유', 생년월일: '1979.01.10')
    console.log('1. Main Entity (f1ed1563) 정보 수정 중...');
    const { error: updateEntError } = await supabase
        .from('account_entities')
        .update({
            member_number: '보유',
            birth_date: '1979.01.10'
        })
        .eq('id', mainId);

    if (updateEntError) {
        console.error('❌ Entity 수정 실패:', updateEntError.message);
    } else {
        console.log('✅ Entity 수정 완료');
    }

    // 3. Asset Rights 수정 (1979.01.10 -> 보유)
    console.log('2. 권리증 정보 수정 중...');
    const { error: updateRightError } = await supabase
        .from('asset_rights')
        .update({
            right_number: '보유'
        })
        .eq('entity_id', mainId)
        .eq('right_number', '1979.01.10');

    if (updateRightError) {
        console.error('❌ 권리증 수정 실패:', updateRightError.message);
    } else {
        console.log('✅ 권리증 수정 완료');
    }

    // 4. 중복 데이터 삭제
    console.log('3. 중복 데이터(3건) 삭제 시도 중...');

    // role 삭제
    const { error: delRolesError } = await supabase
        .from('membership_roles')
        .delete()
        .in('entity_id', duplicateIds);

    if (delRolesError) {
        console.error('❌ 중복 Roles 삭제 실패:', delRolesError.message);
    } else {
        console.log('✅ 중복 Roles 삭제 완료');
    }

    // entity 삭제
    const { error: delEntsError } = await supabase
        .from('account_entities')
        .delete()
        .in('id', duplicateIds);

    if (delEntsError) {
        console.error('❌ 중복 Entity 삭제 실패:', delEntsError.message);
    } else {
        console.log('✅ 중복 Entity 삭제 완료 (3건)');
    }

    console.log('\n=== 정리 완료 ===');
}

cleanupKimSunJin().catch(console.error);
