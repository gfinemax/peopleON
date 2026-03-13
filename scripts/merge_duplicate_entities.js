/**
 * 중복 인물 데이터 안전 병합 스크립트 (방법 A) - 개선 버전
 * 유니크 제약 조건 충돌을 방지하며 통합을 수행합니다.
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizePhone(phone) {
    if (!phone) return null;
    const cleaned = String(phone).replace(/[^0-9]/g, '');
    if (!cleaned) return null;
    return cleaned;
}

async function mergeEntities() {
    console.log('--- 중복 인물 데이터 안전 병합 시작 (v2) ---');

    const { data: entities, error: entError } = await supabase.from('account_entities').select('*');
    if (entError) throw entError;

    const groups = {};
    entities.forEach(e => {
        const name = (e.display_name || '').trim();
        if (!groups[name]) groups[name] = [];
        groups[name].push(e);
    });

    let totalMerged = 0;

    for (const name in groups) {
        const list = groups[name];
        if (list.length < 2) continue;

        const sorted = [...list].sort((a, b) => {
            const aPhone = normalizePhone(a.phone);
            const bPhone = normalizePhone(b.phone);
            if (aPhone && !bPhone) return -1;
            if (!aPhone && bPhone) return 1;
            const aLen = (a.memo?.length || 0) + (a.tags?.length || 0);
            const bLen = (b.memo?.length || 0) + (b.tags?.length || 0);
            return bLen - aLen;
        });

        const master = sorted[0];
        const masterPhone = normalizePhone(master.phone);

        for (let i = 1; i < sorted.length; i++) {
            const slave = sorted[i];
            const slavePhone = normalizePhone(slave.phone);
            const isMergeable = (masterPhone === slavePhone) || !masterPhone || !slavePhone;

            if (isMergeable) {
                console.log(`[통합 실행] ${name}: ${slave.id} -> ${master.id}`);
                await robustMerge(master.id, slave.id);
                totalMerged++;
            }
        }
    }

    console.log(`--- 병합 완료. 총 ${totalMerged}건 처리됨. ---`);
}

async function robustMerge(masterId, slaveId) {
    // 1. membership_roles (Unique: entity_id, role_code, role_status)
    const { data: mRoles } = await supabase.from('membership_roles').select('*').eq('entity_id', masterId);
    const { data: sRoles } = await supabase.from('membership_roles').select('*').eq('entity_id', slaveId);
    const masterRoleKeys = new Set((mRoles || []).map(r => `${r.role_code}_${r.role_status}`));

    for (const sRole of (sRoles || [])) {
        const key = `${sRole.role_code}_${sRole.role_status}`;
        if (masterRoleKeys.has(key)) {
            // 중복 역할이면 슬레이브 쪽 삭제
            await supabase.from('membership_roles').delete().eq('id', sRole.id);
        } else {
            // 새 역할이면 마스터로 이전
            await supabase.from('membership_roles').update({ entity_id: masterId }).eq('id', sRole.id);
        }
    }

    // 2. certificate_registry (Unique: certificate_number_normalized)
    // 이 테이블은 권리증 번호 자체가 유니크하므로, 슬레이브의 권리증을 마스터로 그냥 옮기면 됨 
    // (만약 마스터와 번호가 겹치면 업데이트 시 에러가 나겠지만, 보통 인물만 중복인 경우 번호는 유니크함)
    const { error: certErr } = await supabase.from('certificate_registry').update({ entity_id: masterId }).eq('entity_id', slaveId);
    if (certErr) console.warn(`Cert merge error: ${certErr.message}`);

    // 3. 기타 테이블은 단순 업데이트
    const simpleTables = [
        { name: 'settlement_cases', col: 'entity_id' },
        { name: 'interaction_logs', col: 'entity_id' },
        { name: 'system_audit_logs', col: 'target_entity_id' },
        { name: 'entity_relationships', col: 'from_entity_id' },
        { name: 'entity_relationships', col: 'to_entity_id' }
    ];

    for (const table of simpleTables) {
        await supabase.from(table.name).update({ [table.col]: masterId }).eq(table.col, slaveId);
    }

    // 4. 메모 합치기 및 슬레이브 삭제
    const { data: slaveData } = await supabase.from('account_entities').select('memo').eq('id', slaveId).single();
    if (slaveData && slaveData.memo) {
        const { data: masterData } = await supabase.from('account_entities').select('memo').eq('id', masterId).single();
        const newMemo = masterData.memo ? `${masterData.memo}\n\n[이전 데이터 메모]\n${slaveData.memo}` : slaveData.memo;
        await supabase.from('account_entities').update({ memo: newMemo }).eq('id', masterId);
    }

    await supabase.from('account_entities').delete().eq('id', slaveId);
}

mergeEntities().catch(console.error);
