/**
 * 조합원 데이터 엑셀 → SQL INSERT 스크립트 생성
 * 
 * 사용법: node scripts/import_members.mjs
 * 
 * Supabase SQL Editor에서 실행할 SQL 파일을 생성합니다.
 * (RLS를 우회하기 위해 SQL 직접 실행 방식 사용)
 */

import XLSX from 'xlsx';
import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── 유틸 함수 ─────────────────────────────

/** SQL 문자열 이스케이프 */
function esc(val) {
    if (val === null || val === undefined) return 'NULL';
    const s = String(val).replace(/'/g, "''").replace(/\r\n/g, '\n');
    return `'${s}'`;
}

/** 한글 금액 → 숫자 변환: "3억9천만원" → 390000000 */
function parseKoreanAmount(str) {
    if (!str) return null;
    const cleanStr = String(str).replace(/,/g, '');
    let amount = 0;

    const eokMatch = cleanStr.match(/(\d+)\s*억/);
    const chunMatch = cleanStr.match(/(\d+)\s*천/);
    const baekMatch = cleanStr.match(/(\d+)\s*백/);
    const manMatch = cleanStr.match(/(\d+)\s*만/);

    if (eokMatch) amount += parseInt(eokMatch[1]) * 100000000;
    if (chunMatch) amount += parseInt(chunMatch[1]) * 10000000;
    if (baekMatch) amount += parseInt(baekMatch[1]) * 1000000;
    if (manMatch) amount += parseInt(manMatch[1]) * 10000;

    if (amount > 0) return amount;

    // "납부", "미납" 등 단어만 있는 경우 0/null 처리
    const digitsOnly = cleanStr.replace(/[^0-9]/g, '');
    if (!digitsOnly) return null;

    const parsed = parseFloat(digitsOnly);
    // 1000억 이상은 비정상 값 (전화번호, 여러 날짜 등 병합)
    if (parsed > 99999999999) return null;
    return parsed > 0 ? parsed : null;
}

/** Excel 날짜 숫자 → 텍스트 변환 */
function normalizeJohabNumber(val) {
    if (!val) return null;
    const s = String(val);
    if (s.includes('-') && s.length > 6) return s;
    const num = parseInt(s);
    if (!isNaN(num) && num > 30000 && num < 50000) {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + num * 86400000);
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }
    return s;
}

function normalizePhone(val) {
    if (!val) return null;
    return String(val).replace(/\s/g, '').trim();
}

function extractPrimaryAddress(val) {
    if (!val) return null;
    return String(val).split('\r\n')[0].split('\n')[0].trim();
}

// ─── 메인 로직 ─────────────────────────────

const excelPath = resolve(__dirname, '..', 'data', '조합원 명단 및 세부내역(프로그램용).xlsx');
console.log('📂 엑셀 파일 읽는 중:', excelPath);

const wb = XLSX.readFile(excelPath);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const dataRows = rows.slice(2).filter(r => r[3]); // D열(조합원) 있는 행만
console.log(`📊 데이터 행: ${dataRows.length}건\n`);

const sqlLines = [];
sqlLines.push('-- =================================================');
sqlLines.push('-- 조합원 데이터 가져오기 (자동 생성)');
sqlLines.push(`-- 생성일: ${new Date().toISOString().split('T')[0]}`);
sqlLines.push(`-- 대상: ${dataRows.length}건`);
sqlLines.push('-- =================================================');
sqlLines.push('');
sqlLines.push('-- 기존 데이터 정리');
sqlLines.push('TRUNCATE TABLE asset_rights CASCADE;');
sqlLines.push('TRUNCATE TABLE entity_relationships CASCADE;');
sqlLines.push('TRUNCATE TABLE payments CASCADE;');
sqlLines.push('TRUNCATE TABLE membership_roles CASCADE;');
sqlLines.push('TRUNCATE TABLE account_entities CASCADE;');

sqlLines.push('');

let paymentCount = 0;

const seenRights = new Set();
// ...

for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const rowNum = i + 3; // Excel 행 번호

    const category = r[1] ? String(r[1]).trim() : '등기조합원';
    const memberNumber = normalizeJohabNumber(r[2]);
    const displayName = String(r[3]).replace(/\r?\n/g, ' ').trim();
    const phone = normalizePhone(r[4]);
    const extra_relation = r[11] ? String(r[11]).trim() : null; // 관계
    const unitGroup = r[12] ? String(r[12]).trim() : null; // 입주평형
    const isWithdrawn = r[13] ? true : false;
    const withdrawDetail = r[13] ? String(r[13]).trim() : null;
    const primaryAddr = extractPrimaryAddress(r[14]);

    // 대리인 정보 → meta jsonb
    const meta = {};
    const agents = [];
    if (r[5]) { // 대리인1
        agents.push({
            name: String(r[5]).replace(/\r?\n/g, ' ').trim(),
            relation: r[6] ? String(r[6]).trim() : null,
            phone: normalizePhone(r[7])
        });
    }
    if (r[9]) { // 대리인2
        agents.push({
            name: String(r[9]).replace(/\r?\n/g, ' ').trim(),
            relation: r[8] ? String(r[8]).trim() : null, // 명의자 관계2
            phone: normalizePhone(r[10])
        });
    }
    if (agents.length > 0) meta.agents = agents;
    if (r[16]) meta.survey_25 = String(r[16]).trim();
    if (r[17]) meta.assembly_25 = String(r[17]).trim();
    if (r[18]) meta.lawsuit = String(r[18]).trim();
    if (withdrawDetail) meta.withdraw = withdrawDetail;
    if (extra_relation) meta.extra_relation = extra_relation;
    if (r[23]) meta.notes = String(r[23]).trim(); // 기타

    // 추가 주소
    if (r[14]) {
        const lines = String(r[14]).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) meta.address_extra = lines.slice(1).join('; ');
    }
    if (r[15]) meta.address_extra_2 = String(r[15]).trim();

    // 메모 구성
    const memoItems = [];
    if (r[18]) memoItems.push(`소송: ${String(r[18]).trim()}`); // 소송
    if (r[23]) memoItems.push(String(r[23]).trim()); // 기타
    const memo = memoItems.length > 0 ? memoItems.join('\n') : null;

    const metaJson = JSON.stringify(meta).replace(/'/g, "''");

    // 고유 변수명 (SQL에서 entity_id 참조용)
    const varName = `eid_${i}`;

    sqlLines.push(`-- [${i + 1}] ${displayName} (Row ${rowNum})`);
    sqlLines.push(`DO $$ DECLARE ${varName} uuid; BEGIN`);
    sqlLines.push(`  INSERT INTO account_entities (entity_type, display_name, phone, member_number, address_legal, unit_group, memo, is_favorite, meta)`);
    sqlLines.push(`  VALUES ('person', ${esc(displayName)}, ${esc(phone)}, ${esc(memberNumber)}, ${esc(primaryAddr)}, ${esc(unitGroup)}, ${esc(memo)}, false, '${metaJson}'::jsonb)`);
    sqlLines.push(`  RETURNING id INTO ${varName};`);
    sqlLines.push('');

    // membership_roles
    sqlLines.push(`  INSERT INTO membership_roles (entity_id, role_code, role_status, is_registered)`);
    sqlLines.push(`  VALUES (${varName}, ${esc(category)}, ${isWithdrawn ? "'inactive'" : "'active'"}, ${category === '등기조합원'});`);

    // asset_rights (등기조합원인 경우 회원번호를 권리증 번호로 등록)
    if (category === '등기조합원' && memberNumber) {
        let finalRightNumber = memberNumber;
        let suffixCounter = 1;
        while (seenRights.has(finalRightNumber)) {
            finalRightNumber = `${memberNumber}_${suffixCounter}`;
            suffixCounter++;
        }
        seenRights.add(finalRightNumber);

        sqlLines.push(`  INSERT INTO asset_rights (entity_id, right_type, right_number)`);
        sqlLines.push(`  VALUES (${varName}, 'certificate', ${esc(finalRightNumber)});`);
    }

    // 대리인 관계 처리 (entity_relationships)

    if (agents.length > 0) {
        for (let j = 0; j < agents.length; j++) {
            const agent = agents[j];
            const agentVar = `aid_${i}_${j}`;
            sqlLines.push(`  -- 대리인: ${agent.name}`);
            sqlLines.push(`  DECLARE ${agentVar} uuid; BEGIN`);
            sqlLines.push(`    -- 대리인 인물 프로필 생성 (또는 기존 이름/연락처 일치 확인 로직 대신 새로 생성)`);
            sqlLines.push(`    INSERT INTO account_entities (entity_type, display_name, phone)`);
            sqlLines.push(`    VALUES ('person', ${esc(agent.name)}, ${esc(agent.phone)})`);
            sqlLines.push(`    RETURNING id INTO ${agentVar};`);
            sqlLines.push('');
            sqlLines.push(`    -- 관계 연결`);
            sqlLines.push(`    INSERT INTO entity_relationships (to_entity_id, from_entity_id, relation_type, relation_note)`);
            sqlLines.push(`    VALUES (${varName}, ${agentVar}, 'agent', ${esc(agent.relation)});`);
            sqlLines.push(`  END;`);
        }
    }

    // payments
    const paymentEntries = [];


    if (r[19]) { // U: 업무추진비
        const val = String(r[19]).trim();
        const isPaid = val.includes('납부') && !val.includes('미납');
        paymentEntries.push({ step: 1, name: '업무추진비', paid: isPaid ? (parseKoreanAmount(val) || 0) : 0, isPaid, note: val });
    }
    if (r[20]) { // V: 1차토지분담금
        const val = String(r[20]).trim();
        const isPaid = val.includes('납부') && !val.includes('미납');
        paymentEntries.push({ step: 2, name: '1차토지분담금', paid: isPaid ? (parseKoreanAmount(val) || 0) : 0, isPaid, note: val });
    }
    if (r[21]) { // W: 2차토지분담금
        const val = String(r[21]).trim();
        const isPaid = val.includes('납부') && !val.includes('미납');
        paymentEntries.push({ step: 3, name: '2차토지분담금', paid: 0, isPaid, note: val });
    }
    if (r[22]) { // X: 2024 납부금내역
        const val = String(r[22]).trim();
        const amount = parseKoreanAmount(val);
        paymentEntries.push({ step: 4, name: '2024 납부금', paid: amount || 0, isPaid: !!amount, note: val });
    }

    for (const p of paymentEntries) {
        sqlLines.push(`  INSERT INTO payments (entity_id, step, step_name, amount_due, amount_paid, is_paid, note)`);
        sqlLines.push(`  VALUES (${varName}, ${p.step}, ${esc(p.name)}, 0, ${p.paid}, ${p.isPaid}, ${esc(p.note)});`);
        paymentCount++;
    }

    sqlLines.push('END $$;');
    sqlLines.push('');
}

// 검증 쿼리
sqlLines.push('-- =================================================');
sqlLines.push('-- 검증 쿼리');
sqlLines.push('-- =================================================');
sqlLines.push("SELECT 'account_entities' AS tbl, COUNT(*) AS cnt FROM account_entities");
sqlLines.push('UNION ALL');
sqlLines.push("SELECT 'membership_roles', COUNT(*) FROM membership_roles");
sqlLines.push('UNION ALL');
sqlLines.push("SELECT 'asset_rights', COUNT(*) FROM asset_rights");
sqlLines.push('UNION ALL');
sqlLines.push("SELECT 'payments', COUNT(*) FROM payments;");


const outPath = resolve(__dirname, '..', 'data', 'import_members.sql');
writeFileSync(outPath, sqlLines.join('\n'), 'utf8');

console.log('✅ SQL 파일 생성 완료!');
console.log(`  📄 파일: ${outPath}`);
console.log(`  👤 account_entities: ${dataRows.length}건`);
console.log(`  💼 membership_roles: ${dataRows.length}건`);
console.log(`  💰 payments: ${paymentCount}건`);
console.log('\n📌 Supabase SQL Editor에서 이 파일 내용을 붙여넣고 실행하세요.');
