const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function moveWarningsToMemo() {
    console.log('🚀 [Step 1] 시스템 알림 이력을 관리자 메모로 이동 시작...');

    // 1. Fetch interaction_logs with summary containing '[시스템 알림]'
    const { data: logs, error: fetchError } = await supabase
        .from('interaction_logs')
        .select('id, entity_id, summary, created_at')
        .ilike('summary', '%[시스템 알림]%');

    if (fetchError) {
        console.error('❌ 로그 조회 실패:', fetchError.message);
        return;
    }

    if (!logs || logs.length === 0) {
        console.log('ℹ️ 옮길 시스템 알림 이력이 없습니다.');
        return;
    }

    console.log(`총 ${logs.length}건의 시스템 알림 이력이 발견되었습니다. 이동을 진행합니다...`);

    let successCount = 0;
    let errorCount = 0;

    for (const log of logs) {
        // Fetch current entity memo
        const { data: entity, error: entityError } = await supabase
            .from('account_entities')
            .select('id, memo, display_name')
            .eq('id', log.entity_id)
            .single();

        if (entityError || !entity) {
            console.error(`행 ID ${log.id}에 해당하는 회원을 찾을 수 없습니다. (entity_id: ${log.entity_id})`);
            errorCount++;
            continue;
        }

        // Prepare new memo
        const currentMemo = entity.memo || '';
        const warningDate = new Date(log.created_at).toLocaleDateString('ko-KR');
        const appendText = `\n\n--- [시스템 알림: ${warningDate}] ---\n${log.summary}`;

        const newMemo = currentMemo ? currentMemo + appendText : appendText.trim();

        // Update entity memo
        const { error: updateError } = await supabase
            .from('account_entities')
            .update({ memo: newMemo })
            .eq('id', entity.id);

        if (updateError) {
            console.error(`회원(${entity.display_name}) 메모 업데이트 실패:`, updateError.message);
            errorCount++;
            continue;
        }

        // Delete the moved interaction log
        const { error: deleteError } = await supabase
            .from('interaction_logs')
            .delete()
            .eq('id', log.id);

        if (deleteError) {
            console.error(`로그 ID ${log.id} 삭제 실패:`, deleteError.message);
            errorCount++;
        } else {
            successCount++;
        }
    }

    console.log(`✅ [Step 1] 완료! 성공: ${successCount}건, 오류: ${errorCount}건`);
}

moveWarningsToMemo().catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
});
