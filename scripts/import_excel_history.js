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

async function importHistory() {
    console.log('🚀 [Step 2] 엑셀 활동이력 타임라인 복원 시작...');

    const filePath = path.resolve(__dirname, '../data/권리증(프로그램용).xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 2 }); // 시작 행 3

    console.log(`Excel Records: ${data.length}`);

    let insertCount = 0;
    let errorCount = 0;
    let skipCount = 0;

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[0]) continue;

        const name = String(row[0]).trim();
        const phone = normalizePhone(row[2]);
        const historyText = row[21]; // V열 (활동이력)

        if (!historyText || String(historyText).trim() === '') {
            skipCount++;
            continue;
        }

        const cleanHistoryText = String(historyText).trim();

        // Find Entity
        let entityId = null;

        if (phone) {
            const { data: phoneMatch } = await supabase
                .from('account_entities')
                .select('id')
                .eq('display_name', name)
                .eq('phone', phone)
                .maybeSingle();
            if (phoneMatch) entityId = phoneMatch.id;
        }

        if (!entityId) {
            const { data: nameMatches } = await supabase
                .from('account_entities')
                .select('id')
                .eq('display_name', name);
            if (nameMatches && nameMatches.length === 1) {
                entityId = nameMatches[0].id;
            }
        }

        if (!entityId) {
            console.log(`Row ${i + 3}: 매칭되는 회원을 찾을 수 없음 (${name}) - 건너뜀`);
            errorCount++;
            continue;
        }

        // Insert into interaction_logs
        // type: "NOTE" to show neatly in the timeline
        const { error: insertError } = await supabase
            .from('interaction_logs')
            .insert({
                entity_id: entityId,
                type: 'NOTE',
                summary: cleanHistoryText,
                staff_name: '이전시스템기록',
            });

        if (insertError) {
            console.error(`Row ${i + 3}: 이력 삽입 실패 (${name}):`, insertError.message);
            errorCount++;
        } else {
            insertCount++;
        }

        if (i % 50 === 0 && i !== 0) console.log(`Progress: Row ${i + 3} processed...`);
    }

    console.log(`✅ [Step 2] 완료! 새로 추가된 이력: ${insertCount}건, 회원을 못 찾음/오류: ${errorCount}건, 이력 없음(건너뜀): ${skipCount}건`);
}

importHistory().catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
});
