/**
 * Step 4: 관계(entity_relationships) 및 역할(membership_roles) 동기화
 * 엑셀 마스터 파싱 결과인 416행을 순회하며 대리인 정보를 DB에 구축합니다.
 */
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EXCEL_PATH = 'data/최종 권리증 프로그램용_260311.xlsx';

function normalizeName(name) {
    if (!name) return '';
    return String(name).trim();
}

async function migrateRelations() {
    console.log('--- 관계 및 역할 동기화 시작 ---');

    const wb = xlsx.readFile(EXCEL_PATH);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(ws, { range: 1 });

    // 1. 현재 모든 Entity 로드하여 Name Map 구축
    const { data: allEntities } = await supabase.from('account_entities').select('id, display_name');
    const nameMap = new Map(); // name -> id
    allEntities.forEach(e => {
        const key = normalizeName(e.display_name);
        // 동명이인이 있을 수 있지만 중복 최소화를 위해 마지막 것 사용 (마이그레이션 스크립트 특성상)
        nameMap.set(key, e.id);
    });

    // 2. 기존 관계 데이터 초기화 (신규 마스터 기준)
    console.log('기존 관계 정보 초기화...');
    await supabase.from('entity_relationships').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    let relCount = 0;
    let roleCount = 0;

    for (const row of rows) {
        const ownerName = normalizeName(row['성명']);
        if (!ownerName) continue;
        const ownerId = nameMap.get(ownerName);
        if (!ownerId) continue;

        // 역할(Role) 처리
        const category = row['분류'] || '기타';
        const roleMapping = {
            '등기조합원': '등기조합원',
            '예비조합원': '예비조합원',
            '권리증보유': '권리증보유자',
            '대리인': '대리인',
            '권리증확인': '권리증보유자',
            '권리증가능': '권리증보유자',
            '권리증없음': '권리증보유자'
        };

        const roleCode = roleMapping[category] || '기타';
        await supabase.from('membership_roles').upsert({
            entity_id: ownerId,
            role_code: roleCode,
            is_registered: (category === '등기조합원'),
            role_status: (row['탈퇴'] === '탈퇴') ? 'inactive' : 'active'
        }, { onConflict: 'entity_id,role_code' });
        roleCount++;

        // 관계(Relationship) 처리 - 대리인 1
        const agent1Name = normalizeName(row['대리인 1']);
        if (agent1Name) {
            let agent1Id = nameMap.get(agent1Name);
            if (!agent1Id) {
                // 대리인이 인물 목록에 없으면 신규 생성
                const { data: newAgent } = await supabase.from('account_entities').insert({
                    display_name: agent1Name,
                    phone: row['대리인연락처1'] || null,
                    meta: { note: '관계 마이그레이션 중 자동 생성 (대리인 1)' }
                }).select().single();
                if (newAgent) {
                    agent1Id = newAgent.id;
                    nameMap.set(agent1Name, agent1Id);
                }
            }

            if (agent1Id) {
                await supabase.from('entity_relationships').insert({
                    from_entity_id: agent1Id, // 대리인으로부터
                    to_entity_id: ownerId,    // 본인에게
                    relation_type: 'agent',
                    relation_note: row['대리인관계 1'] || '대리인'
                });
                relCount++;
            }
        }

        // 대리인 2
        const agent2Name = normalizeName(row['대리인 2']);
        if (agent2Name) {
            let agent2Id = nameMap.get(agent2Name);
            if (!agent2Id) {
                const { data: newAgent } = await supabase.from('account_entities').insert({
                    display_name: agent2Name,
                    phone: row['대리인연락처2'] || null,
                    meta: { note: '관계 마이그레이션 중 자동 생성 (대리인 2)' }
                }).select().single();
                if (newAgent) {
                    agent2Id = newAgent.id;
                    nameMap.set(agent2Name, agent2Id);
                }
            }

            if (agent2Id) {
                await supabase.from('entity_relationships').insert({
                    from_entity_id: agent2Id,
                    to_entity_id: ownerId,
                    relation_type: 'agent',
                    relation_note: row['대리인관계2'] || '대리인'
                });
                relCount++;
            }
        }
    }

    console.log(`\n완료: 역할 ${roleCount}건, 관계 ${relCount}건 적재됨.`);
    console.log('--- 마이그레이션 종료 ---');
}

migrateRelations().catch(console.error);
