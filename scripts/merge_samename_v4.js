/**
 * 동일 전화번호 + 동일/유사 이름 병합 스크립트 (v4)
 * 접미사(A, B, ?, (B) 등)가 붙은 이름을 마스터로 유지
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizePhone(phone) {
    if (!phone) return null;
    return String(phone).replace(/[^0-9]/g, '') || null;
}

// 이름에서 접미사 제거하여 베이스 이름 추출
function getBaseName(name) {
    if (!name) return '';
    return name.trim()
        .replace(/\([A-Za-z]\)$/, '')   // (B) 제거
        .replace(/[A-Z]$/, '')           // A, B 제거
        .replace(/\?$/, '')              // ? 제거
        .trim();
}

// 접미사가 있으면 true (마스터 후보 우선)
function hasSuffix(name) {
    if (!name) return false;
    return /[A-Z]$|\([A-Za-z]\)$|\?$/.test(name.trim());
}

async function run() {
    console.log('--- 동일전화+동일이름 병합 (v4) ---');

    const { data: entities, error } = await supabase.from('account_entities').select('*');
    if (error) throw error;

    // 전화번호별 그룹화
    const byPhone = {};
    entities.forEach(e => {
        const np = normalizePhone(e.phone);
        if (!np) return;
        if (!byPhone[np]) byPhone[np] = [];
        byPhone[np].push(e);
    });

    let count = 0;
    for (const [phone, list] of Object.entries(byPhone)) {
        if (list.length < 2) continue;

        // 같은 베이스네임끼리 서브그룹
        const subGroups = {};
        list.forEach(e => {
            const base = getBaseName(e.display_name);
            if (!base) {
                // 빈 이름은 같은 전화번호의 첫번째 유의미한 이름에 합침
                const firstNamed = list.find(x => getBaseName(x.display_name));
                if (firstNamed) {
                    const b = getBaseName(firstNamed.display_name);
                    if (!subGroups[b]) subGroups[b] = [];
                    subGroups[b].push(e);
                }
                return;
            }
            if (!subGroups[base]) subGroups[base] = [];
            subGroups[base].push(e);
        });

        for (const [baseName, group] of Object.entries(subGroups)) {
            if (group.length < 2) continue;

            // 마스터 선정: 접미사 있는 쪽 우선, 그다음 정보가 많은 쪽
            const sorted = [...group].sort((a, b) => {
                const aS = hasSuffix(a.display_name);
                const bS = hasSuffix(b.display_name);
                if (aS && !bS) return -1;
                if (!aS && bS) return 1;
                const aLen = (a.memo?.length || 0);
                const bLen = (b.memo?.length || 0);
                return bLen - aLen;
            });

            const master = sorted[0];
            console.log(`\n[병합] "${baseName}" 그룹 (전화: ${phone})`);
            console.log(`  Master: ${master.display_name} [${master.id.slice(0,8)}]`);

            for (let i = 1; i < sorted.length; i++) {
                const slave = sorted[i];
                console.log(`  Slave:  ${slave.display_name || '(빈이름)'} [${slave.id.slice(0,8)}]`);
                await robustMerge(master.id, slave.id);
                count++;
            }
        }
    }

    console.log(`\n--- 병합 완료. 총 ${count}건 통합됨 ---`);
}

async function robustMerge(masterId, slaveId) {
    // membership_roles
    const { data: mRoles } = await supabase.from('membership_roles').select('*').eq('entity_id', masterId);
    const { data: sRoles } = await supabase.from('membership_roles').select('*').eq('entity_id', slaveId);
    const masterRoleKeys = new Set((mRoles || []).map(r => `${r.role_code}_${r.role_status}`));
    for (const sRole of (sRoles || [])) {
        if (masterRoleKeys.has(`${sRole.role_code}_${sRole.role_status}`)) {
            await supabase.from('membership_roles').delete().eq('id', sRole.id);
        } else {
            await supabase.from('membership_roles').update({ entity_id: masterId }).eq('id', sRole.id);
        }
    }

    // 기타 테이블
    const tables = [
        { name: 'certificate_registry', col: 'entity_id' },
        { name: 'settlement_cases', col: 'entity_id' },
        { name: 'interaction_logs', col: 'entity_id' },
        { name: 'system_audit_logs', col: 'target_entity_id' },
        { name: 'entity_relationships', col: 'from_entity_id' },
        { name: 'entity_relationships', col: 'to_entity_id' }
    ];
    for (const t of tables) {
        await supabase.from(t.name).update({ [t.col]: masterId }).eq(t.col, slaveId);
    }

    // 메모 합침
    const { data: sd } = await supabase.from('account_entities').select('memo').eq('id', slaveId).single();
    if (sd?.memo) {
        const { data: md } = await supabase.from('account_entities').select('memo').eq('id', masterId).single();
        const newMemo = md?.memo ? `${md.memo}\n\n[이전 데이터 메모]\n${sd.memo}` : sd.memo;
        await supabase.from('account_entities').update({ memo: newMemo }).eq('id', masterId);
    }

    // 슬레이브 삭제
    await supabase.from('account_entities').delete().eq('id', slaveId);
}

run().catch(console.error);
