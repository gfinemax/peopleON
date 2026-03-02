const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function normalizePhone(phone) {
    if (!phone) return null;
    return String(phone).replace(/[^0-9]/g, '');
}

async function retryImportHistory() {
    console.log('🚀 [Step 2 Retry] 누락된 엑셀 활동이력 추가 삽입 시작...');

    const filePath = path.resolve(__dirname, '../data/권리증(프로그램용).xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 2 });

    let insertCount = 0;
    let skipCount = 0;
    let existCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[0]) continue;

        const name = String(row[0]).trim();
        const phone = normalizePhone(row[2]);
        const historyText = row[21]; // V열

        if (!historyText || String(historyText).trim() === '') continue;

        const cleanHistoryText = String(historyText).trim();

        // Find Entity - Less strict matching
        let entityId = null;

        // 1. Try phone match first (most exact)
        if (phone) {
            const { data: phoneMatch } = await supabase
                .from('account_entities')
                .select('id')
                .eq('display_name', name)
                .eq('phone', phone)
                .maybeSingle();
            if (phoneMatch) entityId = phoneMatch.id;
        }

        // 2. Exact Name Match (Even if multiple, if they all belong to same person concept)
        // Actually, just find the *first* matching name if phone doesn't match or is null
        if (!entityId) {
            const { data: nameMatches } = await supabase
                .from('account_entities')
                .select('id')
                .eq('display_name', name)
                .limit(1);
            if (nameMatches && nameMatches.length > 0) {
                entityId = nameMatches[0].id; // Fallback to first matched name
            }
        }

        // 3. Fuzzy Name Match
        if (!entityId) {
            const { data: fuzzy } = await supabase
                .from('account_entities')
                .select('id')
                .ilike('display_name', `%${name}%`)
                .limit(1);
            if (fuzzy && fuzzy.length > 0) {
                entityId = fuzzy[0].id;
            }
        }

        if (!entityId) {
            console.log(`Row ${i + 3}: 매칭 실패 (${name})`);
            errorCount++;
            continue;
        }

        // Check if exact same history exists already to prevent duplicates
        const { data: existingLog } = await supabase
            .from('interaction_logs')
            .select('id')
            .eq('entity_id', entityId)
            .eq('type', 'NOTE')
            .eq('summary', cleanHistoryText)
            .limit(1);

        if (existingLog && existingLog.length > 0) {
            existCount++;
            continue;
        }

        // Insert
        const { error: insertError } = await supabase
            .from('interaction_logs')
            .insert({
                entity_id: entityId,
                type: 'NOTE',
                summary: cleanHistoryText,
                staff_name: '이전시스템기록',
            });

        if (insertError) {
            console.error(`Row ${i + 3}: 삽입 에러 (${name}) - ${insertError.message}`);
            errorCount++;
        } else {
            insertCount++;
        }

        if (insertCount > 0 && insertCount % 50 === 0) console.log(`Progress: ${insertCount}건 삽입됨...`);
    }

    console.log(`✅ 재시도 완료! \n- 신규 추가: ${insertCount}건 \n- 이미 존재함(건너뜀): ${existCount}건 \n- 매칭 실패: ${errorCount}건`);
}

retryImportHistory().catch(err => {
    console.error(err);
    process.exit(1);
});
