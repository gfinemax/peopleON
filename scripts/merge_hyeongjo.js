/**
 * '김형조' 전용 정밀 병합 스크립트 + 전역 관계 테이블 업데이트
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function mergeTarget() {
    console.log('--- 김형조 병합 시작 ---');

    // 1. 김형조 데이터 로드
    const { data: targets, error } = await supabase
        .from('account_entities')
        .select('*')
        .ilike('display_name', '김형조%');
        
    if (error) throw error;
    if (targets.length < 2) {
        console.log('병합할 대상이 부족합니다.');
        return;
    }

    // Master 선정: 메모 등 부가정보가 더 많은 레코드
    const sorted = [...targets].sort((a, b) => {
        return (b.memo?.length || 0) - (a.memo?.length || 0);
    });

    const master = sorted[0];
    const slaves = sorted.slice(1);

    console.log(`[Master 👑] ${master.display_name} (${master.phone}) - ID: ${master.id}`);

    // 2. 외래키가 걸려 있는 모든 테이블 목록
    const tablesToUpdate = [
        { name: 'certificate_registry', col: 'entity_id' },
        { name: 'settlement_cases', col: 'entity_id' },
        { name: 'interaction_logs', col: 'entity_id' },
        { name: 'interaction_logs', col: 'member_id' }, // 레거시 컬럼
        { name: 'system_audit_logs', col: 'target_entity_id' },
        { name: 'entity_relationships', col: 'from_entity_id' },
        { name: 'entity_relationships', col: 'to_entity_id' },
        { name: 'payments', col: 'entity_id' },         // ⭐ 핵심: 납부 내역 이전
        { name: 'member_payments', col: 'entity_id' },  // 신규 납부 테이블
    ];

    let successCount = 0;
    for (const slave of slaves) {
        console.log(`[Slave 🔗] ${slave.display_name} (${slave.phone}) 병합 중...`);

        // 2-1. Role 이전 (중복 체크)
        const { data: mRoles } = await supabase.from('membership_roles').select('*').eq('entity_id', master.id);
        const { data: sRoles } = await supabase.from('membership_roles').select('*').eq('entity_id', slave.id);
        const masterRoleKeys = new Set((mRoles || []).map(r => `${r.role_code}_${r.role_status}`));

        for (const sRole of (sRoles || [])) {
            if (masterRoleKeys.has(`${sRole.role_code}_${sRole.role_status}`)) {
                await supabase.from('membership_roles').delete().eq('id', sRole.id); // 중복 롤 삭제
            } else {
                await supabase.from('membership_roles').update({ entity_id: master.id }).eq('id', sRole.id); // 이전
            }
        }

        // 2-2. 모든 연관 테이블 강제 마이그레이션
        for (const req of tablesToUpdate) {
            const { error: tErr } = await supabase.from(req.name).update({ [req.col]: master.id }).eq(req.col, slave.id);
            if (tErr && tErr.code !== 'PGRST205' && !tErr.message.includes('Columns not found') && !tErr.message.includes('not exist')) {
                if (!tErr.message.includes('column') && !tErr.message.includes('find the table')) {
                     console.error(`  - Table ${req.name} update warning:`, tErr.message);
                }
            }
        }

        // 2-3. 메모 병합
        if (slave.memo) {
            const { data: mData } = await supabase.from('account_entities').select('memo').eq('id', master.id).single();
            const newMemo = mData?.memo ? `${mData.memo}\n\n[병합: ${slave.phone}]\n${slave.memo}` : slave.memo;
            await supabase.from('account_entities').update({ memo: newMemo }).eq('id', master.id);
        }

        // 2-4. 완전히 비워진 Slave 삭제
        const { error: delErr } = await supabase.from('account_entities').delete().eq('id', slave.id);
        if (delErr) {
            console.error(`❌ Slave 삭제 실패 (${slave.id}):`, delErr.message);
        } else {
            successCount++;
            console.log(`✅ Slave 삭제 완료`);
        }
    }

    console.log(`\n--- 병합 완료 (총 ${successCount}건 병합됨) ---`);
}

mergeTarget().catch(console.error);
