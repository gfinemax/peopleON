
import { createAdminClient } from '../src/lib/supabase/admin';
import { fetchRecentActivitySummariesForPeople } from '../src/lib/server/activityFeed';

async function verifyFilter() {
    const supabase = createAdminClient();
    
    // 강대운 님의 ID를 찾습니다 (이미지를 통해 활동이력이 있음을 확인한 인물)
    const { data: member } = await supabase
        .from('account_entities')
        .select('id, display_name, entity_ids')
        .eq('display_name', '강대운')
        .single();

    if (!member) {
        console.log('강대운 님을 찾을 수 없습니다.');
        return;
    }

    console.log(`Checking results for: ${member.display_name} (${member.id})`);

    const people = [member];
    const results = await fetchRecentActivitySummariesForPeople(supabase, people);

    const summary = results.get(member.id);
    if (summary) {
        console.log('❌ Failure: Summary found for legacy record!');
        console.log(`Summary: ${summary.summary}`);
        console.log(`Time: ${summary.absoluteTime}`);
    } else {
        console.log('✅ Success: No summary found for legacy-only member (as expected).');
    }

    // 인위적으로 최근 기록을 하나 추가해봅니다.
    console.log('\nTesting with a TRULY recent record...');
    const { data: newLog, error: insertError } = await supabase
        .from('interaction_logs')
        .insert({
            entity_id: member.id,
            type: 'NOTE',
            summary: '테스트용 최근 활동입니다.',
            staff_name: '테스트관리자'
        })
        .select()
        .single();

    if (insertError) {
        console.error('Test log insert failed:', insertError);
        return;
    }

    try {
        const resultsAfter = await fetchRecentActivitySummariesForPeople(supabase, people);
        const summaryAfter = resultsAfter.get(member.id);
        if (summaryAfter && summaryAfter.summary.includes('테스트용 최근 활동')) {
            console.log('✅ Success: Truly recent record is correctly shown.');
            console.log(`Summary: ${summaryAfter.summary}`);
        } else {
            console.log('❌ Failure: Truly recent record was not shown or was incorrectly filtered.');
        }
    } finally {
        // 테스트 데이터 삭제
        await supabase.from('interaction_logs').delete().eq('id', newLog.id);
        console.log('\nTest data cleaned up.');
    }
}

verifyFilter().catch(console.error);
