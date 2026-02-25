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
    const s = String(str).replace(/\s/g, '').replace(/원/g, '').replace(/,/g, '');
    let total = 0, current = 0;
    const mainAmount = s.split('(')[0].split('（')[0];
    for (let i = 0; i < mainAmount.length; i++) {
        const ch = mainAmount[i];
        if (ch >= '0' && ch <= '9') { current = current * 10 + parseInt(ch); }
        else if (ch === '억') { total += (current || 1) * 100000000; current = 0; }
        else if (ch === '천') { total += (current || 1) * 10000000; current = 0; }
        else if (ch === '백') { total += (current || 1) * 1000000; current = 0; }
        else if (ch === '만') { total += (current || 1) * 10000; current = 0; }
    }
    total += current;
    return total > 0 ? total : null;
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

const dataRows = rows.slice(2).filter(r => r[4]); // E열(이름) 있는 행만
console.log(`📊 데이터 행: ${dataRows.length}건\n`);

const sqlLines = [];
sqlLines.push('-- =================================================');
sqlLines.push('-- 조합원 데이터 가져오기 (자동 생성)');
sqlLines.push(`-- 생성일: ${new Date().toISOString().split('T')[0]}`);
sqlLines.push(`-- 대상: ${dataRows.length}건`);
sqlLines.push('-- =================================================');
sqlLines.push('');
sqlLines.push('-- 기존 데이터 정리');
sqlLines.push('TRUNCATE TABLE payments CASCADE;');
sqlLines.push('TRUNCATE TABLE membership_roles CASCADE;');
sqlLines.push('TRUNCATE TABLE account_entities CASCADE;');
sqlLines.push('');

let paymentCount = 0;

for (let i = 0; i < dataRows.length; i++) {
    const r = dataRows[i];
    const rowNum = i + 3; // Excel 행 번호

    const displayName = String(r[4]).trim();
    const phone = normalizePhone(r[5]);
    const memberNumber = normalizeJohabNumber(r[3]);
    const category = r[2] ? String(r[2]).trim() : '등기조합원';
    const unitGroup = r[13] ? String(r[13]).trim() : null;
    const primaryAddr = extractPrimaryAddress(r[16]);
    const isWithdrawn = r[15] ? true : false;
    const withdrawDetail = r[15] ? String(r[15]).trim() : null;

    // 대리인 정보 → meta jsonb
    const meta = {};
    const agents = [];
    if (r[6]) {
        agents.push({
            name: String(r[6]).trim(),
            relation: r[7] ? String(r[7]).trim() : null,
            phone: normalizePhone(r[8])
        });
    }
    if (r[10]) {
        agents.push({
            name: String(r[10]).trim(),
            relation: r[9] ? String(r[9]).trim() : null,
            phone: normalizePhone(r[11])
        });
    }
    if (agents.length > 0) meta.agents = agents;
    if (r[14]) meta.survey_25 = String(r[14]).trim();
    if (r[18]) meta.assembly_25 = String(r[18]).trim();
    if (r[19]) meta.lawsuit = String(r[19]).trim();
    if (withdrawDetail) meta.withdraw = withdrawDetail;
    if (r[12]) meta.extra_relation = String(r[12]).trim();
    if (r[24]) meta.notes = String(r[24]).trim();

    // 추가 주소
    if (r[16]) {
        const lines = String(r[16]).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length > 1) meta.address_extra = lines.slice(1).join('; ');
    }
    if (r[17]) meta.address_extra_2 = String(r[17]).trim();

    // 메모 구성
    const memoItems = [];
    if (r[19]) memoItems.push(`소송: ${String(r[19]).trim()}`);
    if (r[24]) memoItems.push(String(r[24]).trim());
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

    // payments
    const paymentEntries = [];

    if (r[20]) { // U: 업무추진비
        const val = String(r[20]).trim();
        const isPaid = val.includes('납부') && !val.includes('미납');
        paymentEntries.push({ step: 1, name: '업무추진비', paid: isPaid ? (parseKoreanAmount(val) || 0) : 0, isPaid, note: val });
    }
    if (r[21]) { // V: 1차토지분담금
        const val = String(r[21]).trim();
        const isPaid = val.includes('납부') && !val.includes('미납');
        paymentEntries.push({ step: 2, name: '1차토지분담금', paid: isPaid ? (parseKoreanAmount(val) || 0) : 0, isPaid, note: val });
    }
    if (r[22]) { // W: 2차토지분담금
        const val = String(r[22]).trim();
        const isPaid = val.includes('납부') && !val.includes('미납');
        paymentEntries.push({ step: 3, name: '2차토지분담금', paid: 0, isPaid, note: val });
    }
    if (r[23]) { // X: 2024 납부금내역
        const val = String(r[23]).trim();
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
sqlLines.push("SELECT 'payments', COUNT(*) FROM payments;");

const outPath = resolve(__dirname, '..', 'data', 'import_members.sql');
writeFileSync(outPath, sqlLines.join('\n'), 'utf8');

console.log('✅ SQL 파일 생성 완료!');
console.log(`  📄 파일: ${outPath}`);
console.log(`  👤 account_entities: ${dataRows.length}건`);
console.log(`  💼 membership_roles: ${dataRows.length}건`);
console.log(`  💰 payments: ${paymentCount}건`);
console.log('\n📌 Supabase SQL Editor에서 이 파일 내용을 붙여넣고 실행하세요.');
