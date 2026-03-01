/**
 * peopleON 데이터 통합 마이그레이션 스크립트
 * 
 * 대상: 
 * 1. 조합원 명단 및 세부내역(프로그램용).xlsx
 * 2. 권리증(프로그램용).xlsx
 */

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// 마이그레이션을 위해 SERVICE_ROLE_KEY가 필요합니다. 
// 없으면 환경변수에서 가져오거나 수동입력이 필요할 수 있습니다.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('환경 변수(URL, KEY)가 설정되지 않았습니다.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- 유틸리티 함수 ---

/**
 * 한글 금액 문자열을 숫자로 변환 (예: "1억5천6백만원" -> 156000000)
 */
function parseKoreanMoney(str) {
    if (!str || typeof str !== 'string') return 0;
    const clean = str.replace(/[,원\s]/g, '');
    let total = 0;

    const matches = clean.match(/(?:(\d+)억)?(?:(\d+)천)?(?:(\d+)백)?(?:(\d+)십)?(?:(\d+))?/);
    if (!matches) return parseFloat(clean) || 0;

    if (matches[1]) total += parseInt(matches[1]) * 100000000;
    if (matches[2]) total += parseInt(matches[2]) * 10000000;
    if (matches[3]) total += parseInt(matches[3]) * 1000000;
    if (matches[4]) total += parseInt(matches[4]) * 100000;
    if (matches[5]) total += parseInt(matches[5]) * (clean.includes('만') ? 10000 : 1);

    // "1억" 형식 처리
    if (clean.includes('억') && !clean.includes('만') && total < 100000000) {
        // 단순 파싱 실패 시 대비
    }

    // 단순 숫자인 경우 처리
    const numericOnly = parseFloat(clean.replace(/[^0-9.]/g, ''));
    if (str.includes('억') && numericOnly < 10000) return numericOnly * 100000000;
    if (str.includes('만') && numericOnly < 1000000) return numericOnly * 10000;

    return total || numericOnly || 0;
}

/**
 * 전화번호 정규화
 */
function normalizePhone(phone) {
    if (!phone) return '';
    return String(phone).replace(/[^0-9]/g, '');
}

// --- 메인 프로세스 ---

async function migrate() {
    console.log('🚀 마이그레이션 시작...');

    // 0. 기존 데이터 삭제 (Clean Start)
    console.log('🧹 기존 데이터 삭제 중...');
    const tablesToClear = ['entity_relationships', 'interaction_logs', 'payments', 'asset_rights', 'membership_roles', 'account_entities'];
    for (const table of tablesToClear) {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        if (error) console.warn(`[Cleanup] Warning deleting from ${table}:`, error.message);
    }

    const entities = new Map(); // key: name+phone
    const interactions = [];
    const payments = [];
    const rights = [];
    const relations = [];

    // 1. 조합원 명단 읽기
    console.log('📖 조합원 명단 분석 중...');
    const memberWb = XLSX.readFile(path.resolve(__dirname, '../data/조합원 명단 및 세부내역(프로그램용).xlsx'));
    const memberWs = memberWb.Sheets['최근 주소록'];
    const memberData = XLSX.utils.sheet_to_json(memberWs, { header: 1, range: 2 }); // 3행부터 데이터

    for (const row of memberData) {
        const [_, no, role, memberNo, name, phone, agent1, rel1, agent1Phone, agent2, rel2, agent2Phone, size, survey, exit, addr1, addr2, status, assembly, lawsuit, fee, land1, land2, pay2024, etc] = row;

        if (!name) continue;

        const phoneNorm = normalizePhone(phone);
        const entityKey = `${name}_${phoneNorm}`;

        const entity = {
            display_name: name,
            phone: phoneNorm,
            member_number: memberNo ? String(memberNo) : null,
            address_legal: [addr1, addr2].filter(Boolean).join(' '),
            unit_group: size ? String(size) : null,
            meta: {
                legacy_no: no,
                survey_25: survey,
                assembly_25: assembly,
                lawsuit: lawsuit,
                etc_memo: etc
            },
            roles: [role].filter(Boolean)
        };
        entities.set(entityKey, entity);

        // 이력 생성
        if (survey) interactions.push({ key: entityKey, type: 'SURVEY', summary: `25년 설문조사: ${survey}` });
        if (exit) interactions.push({ key: entityKey, type: 'EXIT', summary: `탈퇴 정보: ${exit}` });
        if (assembly) interactions.push({ key: entityKey, type: 'MEETING', summary: `25년 정기총회: ${assembly}` });
        if (lawsuit) interactions.push({ key: entityKey, type: 'LAWSUIT', summary: `소송 정보: ${lawsuit}` });
        if (etc) interactions.push({ key: entityKey, type: 'NOTE', summary: `기타 메모: ${etc}` });

        // 납입 내역
        if (fee) payments.push({ key: entityKey, step_name: '업무추진비', note: String(fee) });
        if (land1) payments.push({ key: entityKey, step_name: '1차토지분담금', note: String(land1) });
        if (land2) payments.push({ key: entityKey, step_name: '2차토지분담금', note: String(land2) });
        if (pay2024) {
            const amount = parseKoreanMoney(String(pay2024));
            payments.push({ key: entityKey, step_name: '2024 납부금', amount_paid: amount, note: String(pay2024) });
        }

        // 대리인 처리
        if (agent1) {
            const agentKey = `${agent1}_${normalizePhone(agent1Phone)}`;
            if (!entities.has(agentKey)) {
                entities.set(agentKey, { display_name: agent1, phone: normalizePhone(agent1Phone), roles: ['대리인'], meta: {} });
            }
            relations.push({ from: agentKey, to: entityKey, type: 'agent', note: rel1 });
        }
        if (agent2) {
            const agentKey = `${agent2}_${normalizePhone(agent2Phone)}`;
            if (!entities.has(agentKey)) {
                entities.set(agentKey, { display_name: agent2, phone: normalizePhone(agent2Phone), roles: ['대리인'], meta: {} });
            }
            relations.push({ from: agentKey, to: entityKey, type: 'agent', note: rel2 });
        }
    }

    // 2. 권리증 명단 읽기
    console.log('📖 권리증 명단 분석 중...');
    const certWb = XLSX.readFile(path.resolve(__dirname, '../data/권리증(프로그램용).xlsx'));
    const certWs = certWb.Sheets[certWb.SheetNames[0]];
    const certData = XLSX.utils.sheet_to_json(certWs, { header: 1, range: 2 });

    for (const row of certData) {
        const [name, id, phone, tel, email, curAddr, agent, agentPhone, addr, birth, certNo, certName, certDate, price, source, land1, apply, meeting, assembly, memo, etc, history] = row;

        if (!name) continue;

        const phoneNorm = normalizePhone(phone);
        const entityKey = `${name}_${phoneNorm}`;

        // 기존 entity 정보 보강
        if (entities.has(entityKey)) {
            const e = entities.get(entityKey);
            if (email) e.email = email;
            if (addr && !e.address_legal) e.address_legal = addr;
            if (birth) e.meta.birth_date = birth;
            if (!e.roles.includes('권리증보유자')) e.roles.push('권리증보유자');
        } else {
            entities.set(entityKey, {
                display_name: name,
                phone: phoneNorm,
                email: email,
                address_legal: addr,
                roles: ['권리증보유자'],
                meta: { birth_date: birth, legacy_id: id, current_address: curAddr }
            });
        }

        // 권리증 정보
        if (certNo && certNo !== '없음') {
            rights.push({
                key: entityKey,
                right_number: String(certNo),
                principal_amount: parseKoreanMoney(String(price)),
                issued_at: certDate,
                meta: { cert_name: certName, source: source }
            });
        }

        // 대리인 관계 (권리증 엑셀 기준)
        if (agent) {
            const agentKey = `${agent}_${normalizePhone(agentPhone)}`;
            if (!entities.has(agentKey)) {
                entities.set(agentKey, { display_name: agent, phone: normalizePhone(agentPhone), roles: ['대리인'], meta: {} });
            }
            relations.push({ from: agentKey, to: entityKey, type: 'agent', note: '권리증 대리인' });
        }

        // 이력 (21번 컬럼 활동이력 중심)
        if (history) {
            interactions.push({ key: entityKey, type: 'HISTORY', summary: String(history) });
        }
    }

    // 3. DB Insert
    console.log(`📤 DB 저장 중... (인물: ${entities.size}명)`);

    const insertedEntities = new Map(); // key -> id

    for (const [key, data] of entities.entries()) {
        const { roles, ...entityData } = data;
        const { data: ent, error } = await supabase.from('account_entities').insert(entityData).select('id').single();

        if (error) {
            console.error(`Error inserting ${data.display_name}:`, error.message);
            continue;
        }

        insertedEntities.set(key, ent.id);

        // 역할 추가
        if (roles && roles.length > 0) {
            const roleInserts = roles.map(r => ({
                entity_id: ent.id,
                role_code: r,
                role_status: 'active',
                is_registered: r === '1차' || r.includes('등기')
            }));
            await supabase.from('membership_roles').insert(roleInserts);
        }
    }

    console.log('🔗 관계 및 데이터 연결 중...');

    // 관계 저장
    for (const rel of relations) {
        const fromId = insertedEntities.get(rel.from);
        const toId = insertedEntities.get(rel.to);
        if (fromId && toId) {
            await supabase.from('entity_relationships').insert({
                from_entity_id: fromId,
                to_entity_id: toId,
                relation_type: rel.type,
                relation_note: rel.note
            });
        }
    }

    // 권리증 저장
    for (const r of rights) {
        const eid = insertedEntities.get(r.key);
        if (eid) {
            const { key, ...rightData } = r;
            await supabase.from('asset_rights').insert({ ...rightData, entity_id: eid, right_type: 'certificate' });
        }
    }

    // 이력 저장
    for (const i of interactions) {
        const eid = insertedEntities.get(i.key);
        if (eid) {
            await supabase.from('interaction_logs').insert({ entity_id: eid, type: i.type, summary: i.summary });
        }
    }

    // 납부 저장
    for (const p of payments) {
        const eid = insertedEntities.get(p.key);
        if (eid) {
            const { key, ...payData } = p;
            await supabase.from('payments').insert({ ...payData, entity_id: eid });
        }
    }

    console.log('✅ 마이그레이션 완료!');
}

migrate().catch(console.error);
