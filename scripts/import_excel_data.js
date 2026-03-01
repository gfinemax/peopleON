require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const EXCEL_PATH = path.join(process.cwd(), 'data', '조합원 명단 및 세부내역(프로그램용).xlsx');

const classificationMap = {
    '등기조합원': '등기조합원',
    '2차': '2차',
    '일반분양': '일반분양',
    '지주': '지주',
    '지주조합원': '지주조합원',
    '대리인': '대리인',
    '예비': '예비조합원',
    '환불': '권리증환불'
};

function parseKoreanCurrency(str) {
    if (!str) return 0;
    if (typeof str === 'number') return str;

    let amount = 0;
    const cleanStr = String(str).replace(/,/g, '');

    const eokMatch = cleanStr.match(/(\d+)억/);
    const chunMatch = cleanStr.match(/(\d+)천/);
    const baekMatch = cleanStr.match(/(\d+)백/);
    const manMatch = cleanStr.match(/(\d+)만/);

    if (eokMatch) amount += parseInt(eokMatch[1]) * 100000000;
    if (chunMatch) amount += parseInt(chunMatch[1]) * 10000000;
    if (baekMatch) amount += parseInt(baekMatch[1]) * 1000000;
    if (manMatch) amount += parseInt(manMatch[1]) * 10000;

    if (amount > 0) return amount;

    const numericPart = cleanStr.replace(/[^0-9]/g, '');
    return parseFloat(numericPart) || 0;
}

// Robust member number parser (handles Excel date serials)
function formatMemberNumber(val) {
    if (!val) return '';

    // 1. If Date object (xlsx with cellDates: true)
    if (val instanceof Date) {
        // Use YYYY-M-D format (No zero padding)
        const y = val.getFullYear();
        const m = val.getMonth() + 1;
        const d = val.getDate();
        return `${y}-${m}-${d}`;
    }

    // 2. If Number (possible Excel date serial)
    if (typeof val === 'number') {
        // Excel date serials for 2000-2030 are roughly 36526-47482
        if (val > 30000 && val < 60000) {
            const date = new Date((val - 25569) * 86400 * 1000);
            const y = date.getFullYear();
            const m = date.getMonth() + 1;
            const d = date.getDate();
            return `${y}-${m}-${d}`;
        }
        return String(val);
    }

    // 3. If String that looks like a number (serial)
    if (typeof val === 'string' && /^\d{5}$/.test(val.trim())) {
        const num = parseInt(val.trim());
        if (num > 30000 && num < 60000) {
            const date = new Date((num - 25569) * 86400 * 1000);
            const y = date.getFullYear();
            const m = date.getMonth() + 1;
            const d = date.getDate();
            return `${y}-${m}-${d}`;
        }
    }

    return String(val).trim();
}

async function runImport() {
    console.log('Starting Excel Import (Fixed Format)...');

    // Read with cellDates: true but also we'll use raw: false in json conversion to get formatted text
    const workbook = xlsx.read(fs.readFileSync(EXCEL_PATH), { cellDates: true });
    const sheetName = '최근 주소록';
    const worksheet = workbook.Sheets[sheetName];

    // raw: false ensures we get the "formatted" string from Excel if possible
    const rows = xlsx.utils.sheet_to_json(worksheet, { range: 1, raw: false });

    // However, sheet_to_json with raw: false might not work with cellDates correctly.
    // Let's get both and merge
    const rowsRaw = xlsx.utils.sheet_to_json(worksheet, { range: 1, raw: true });

    console.log(`Processing ${rows.length} rows...`);

    // Cleanup
    console.log('Cleaning up existing data...');
    await supabase.from('asset_rights').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('membership_roles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('interaction_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('account_entities').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    let count = 0;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowRaw = rowsRaw[i];

        const name = String(row['조합원'] || '').trim();
        if (!name || name === '조합원' || name === '성명') continue;

        const classification = String(row['분류'] || '').trim();

        // Prioritize raw numeric/date value if the formatted string looks like a serial number
        let memberNumberRaw = rowRaw['조합번호'];
        let memberNumber = formatMemberNumber(memberNumberRaw);

        const phone = String(row['핸드폰번호'] || row['대리인1 연락처'] || '').trim();
        const address = String(row['주소'] || '').trim();

        // 1. Create Entity
        const { data: entity, error: entityError } = await supabase
            .from('account_entities')
            .insert({
                display_name: name,
                phone: phone,
                member_number: memberNumber,
                address_legal: address,
                meta: {
                    unit_group: row['입주평형'],
                    agent1: row['대리인1'],
                    relation1: row['명의자 관계1'],
                    agent2: row['대리인2'],
                    relation2: row['대리인2 연락처'],
                    survey_25: row['25_설문조사'],
                    general_assembly_25: row['25_정기총회'],
                    lawsuit: row['소송'],
                    withdrawal: row['탈퇴'],
                    others: row['기타']
                }
            })
            .select()
            .single();

        if (entityError) {
            console.error(`Error creating entity for ${name}:`, entityError);
            continue;
        }

        const entityId = entity.id;

        // 2. Create Role
        const roleCode = classificationMap[classification] || '일반분양';
        await supabase.from('membership_roles').insert({
            entity_id: entityId,
            role_code: roleCode,
            role_status: 'active',
            is_registered: classification === '등기조합원'
        });

        // 3. Create Right (Registered members)
        if (classification === '등기조합원' && memberNumber) {
            await supabase.from('asset_rights').insert({
                entity_id: entityId,
                right_type: 'certificate',
                right_number: memberNumber,
                status: 'active',
                meta: { source: 'excel_import' }
            });
        }

        // 4. Logs
        const logs = [];
        if (row['25_설문조사']) logs.push({ type: 'DOC', summary: `25_설문조사: ${row['25_설문조사']}` });
        if (row['25_정기총회']) logs.push({ type: 'MEET', summary: `25_정기총회: ${row['25_정기총회']}` });
        if (row['소송']) logs.push({ type: 'NOTE', summary: `소송 정보: ${row['소송']}` });
        if (row['탈퇴']) logs.push({ type: 'NOTE', summary: `탈퇴 정보: ${row['탈퇴']}` });

        for (const log of logs) {
            await supabase.from('interaction_logs').insert({
                member_id: entityId,
                type: log.type,
                summary: log.summary,
                staff_name: 'system'
            });
        }

        // 5. Payments
        const paymentFields = [
            { field: '업무추진비', step: 1 },
            { field: '1차토지분담금', step: 2 },
            { field: '2차토지분담금', step: 3 },
            { field: '2024 납부금내역', step: 4 },
            { field: '기타', step: 5 }
        ];

        for (const pf of paymentFields) {
            const val = row[pf.field];
            if (val) {
                const amount = parseKoreanCurrency(val);
                if (amount > 0) {
                    await supabase.from('payments').insert({
                        member_id: entityId,
                        step: pf.step,
                        amount_due: amount,
                        amount_paid: amount,
                        is_paid: true,
                        paid_date: new Date().toISOString().split('T')[0]
                    });
                }
            }
        }

        count++;
        if (count % 50 === 0) console.log(`Processed ${count} rows...`);
    }

    console.log(`Import finished. Total ${count} members imported.`);
}

runImport().catch(err => {
    console.error('Fatal error:', err);
});
