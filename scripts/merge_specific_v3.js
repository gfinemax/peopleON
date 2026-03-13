/**
 * 김민준, 김석영 및 접미사(A, B) 처리 개선 병합 스크립트
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizePhone(phone) {
    if (!phone) return null;
    let cleaned = String(phone).replace(/[^0-9]/g, '');
    if (!cleaned) return null;
    
    // 김석영 케이스: 01198882129 -> 01088882129 변환 시도 (사용자 요청 기반)
    if (cleaned.startsWith('011') && cleaned.endsWith('2129')) {
        return '01088882129';
    }
    return cleaned;
}

// 이름에서 A, B 등 접미사 제거
function getBaseName(name) {
    if (!name) return '';
    return name.trim().replace(/[A-Z]$/, '').trim();
}

async function runPrecisionMerge() {
    console.log('--- 정밀 병합 (v3) 시작 ---');

    const { data: entities, error } = await supabase.from('account_entities').select('*');
    if (error) throw error;

    // 1. 그룹화 (베이스 이름 + 정규화된 전화번호)
    const groups = {};
    
    entities.forEach(e => {
        const baseName = getBaseName(e.display_name);
        const normPhone = normalizePhone(e.phone);
        
        // 특별 처리: 김석영은 연락처가 달라도 같은 사람으로 처리 (사용자 요청)
        let key;
        if (baseName === '김석영' && (normPhone === '01088882129' || normPhone === '01198882129')) {
            key = '김석영_FIXED_2129';
        } else if (normPhone) {
            key = `${baseName}_${normPhone}`;
        } else {
            key = null; // 전화번호 없으면 자동 병합 보류 (안전)
        }

        if (key) {
            if (!groups[key]) groups[key] = [];
            groups[key].push(e);
        }
    });

    let count = 0;
    for (const key in groups) {
        const list = groups[key];
        if (list.length < 2) continue;

        // Master 선정: 이름이 깨끗한 쪽(접미사 없는 쪽) 우선
        const sorted = [...list].sort((a, b) => {
            const aHasSuffix = /[A-Z]$/.test(a.display_name);
            const bHasSuffix = /[A-Z]$/.test(b.display_name);
            if (!aHasSuffix && bHasSuffix) return -1;
            if (aHasSuffix && !bHasSuffix) return 1;
            return 0;
        });

        const master = sorted[0];
        console.log(`[병합] 그룹 '${key}' -> Master: ${master.display_name} (${master.id})`);
        
        // 김석영 케이스일 경우 전화번호를 010-8888-2129로 강제 업데이트
        if (key === '김석영_FIXED_2129') {
            await supabase.from('account_entities').update({ phone: '010-8888-2129' }).eq('id', master.id);
        }

        for (let i = 1; i < sorted.length; i++) {
            const slave = sorted[i];
            console.log(`      Slave: ${slave.display_name} (${slave.id})`);
            await robustMerge(master.id, slave.id);
            count++;
        }
    }

    console.log(`--- 정밀 병합 완료. 총 ${count}건 통합됨. ---`);
}

async function robustMerge(masterId, slaveId) {
    // membership_roles 처리
    const { data: mRoles } = await supabase.from('membership_roles').select('*').eq('entity_id', masterId);
    const { data: sRoles } = await supabase.from('membership_roles').select('*').eq('entity_id', slaveId);
    const masterRoleKeys = new Set((mRoles || []).map(r => `${r.role_code}_${r.role_status}`));

    for (const sRole of (sRoles || [])) {
        const key = `${sRole.role_code}_${sRole.role_status}`;
        if (masterRoleKeys.has(key)) {
            await supabase.from('membership_roles').delete().eq('id', sRole.id);
        } else {
            await supabase.from('membership_roles').update({ entity_id: masterId }).eq('id', sRole.id);
        }
    }

    // 연관 테이블 이동
    const tables = [
        { name: 'certificate_registry', col: 'entity_id' },
        { name: 'settlement_cases', col: 'entity_id' },
        { name: 'interaction_logs', col: 'entity_id' },
        { name: 'system_audit_logs', col: 'target_entity_id' },
        { name: 'entity_relationships', col: 'from_entity_id' },
        { name: 'entity_relationships', col: 'to_entity_id' }
    ];

    for (const table of tables) {
        await supabase.from(table.name).update({ [table.col]: masterId }).eq(table.col, slaveId);
    }

    // 메모 합치기
    const { data: slaveData } = await supabase.from('account_entities').select('memo').eq('id', slaveId).single();
    if (slaveData && slaveData.memo) {
        const { data: masterData } = await supabase.from('account_entities').select('memo').eq('id', masterId).single();
        const newMemo = masterData.memo ? `${masterData.memo}\n\n[이전 데이터 메모]\n${slaveData.memo}` : slaveData.memo;
        await supabase.from('account_entities').update({ memo: newMemo }).eq('id', masterId);
    }

    // 슬레이브 삭제
    await supabase.from('account_entities').delete().eq('id', slaveId);
}

runPrecisionMerge().catch(console.error);
