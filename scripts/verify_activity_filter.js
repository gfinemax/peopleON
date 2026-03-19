
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Based on the logic in src/lib/server/activityFeed.ts
const LEGACY_IMPORT_STAFF = '이전시스템기록';
const LEGACY_THRESHOLD_DATE = new Date('2026-03-10');

async function verifyFilter() {
    console.log('🚀 Checking Recent Activity Filter...');

    // 강대운 님의 ID를 찾습니다
    const { data: member } = await supabase
        .from('account_entities')
        .select('id, display_name')
        .eq('display_name', '강대운')
        .single();

    if (!member) {
        console.log('강대운 님을 찾을 수 없습니다.');
        return;
    }

    console.log(`Target Member: ${member.display_name} (${member.id})`);

    // 해당 멤버의 모든 로그를 가져옵니다 (필터링 테스트용)
    const { data: allLogs, error: logError } = await supabase
        .from('interaction_logs')
        .select('id, staff_name, created_at, summary')
        .eq('entity_id', member.id)
        .order('created_at', { ascending: false });

    if (logError) {
        console.error('Log fetch error:', logError);
        return;
    }

    console.log(`Found ${allLogs.length} total logs for this member.`);

    // 필터링 로직 시뮬레이션
    let activeSummary = null;
    for (const log of allLogs) {
        const isLegacy = log.staff_name === LEGACY_IMPORT_STAFF || new Date(log.created_at) < LEGACY_THRESHOLD_DATE;
        if (isLegacy) {
            console.log(`Skipping legacy log: [${log.created_at}] Staff: ${log.staff_name} | ${log.summary.substring(0, 30)}...`);
            continue;
        }
        activeSummary = log;
        break;
    }

    if (activeSummary) {
        console.log('❌ Failure: Summary found for legacy record!');
        console.log(`Summary: ${activeSummary.summary}`);
    } else {
        console.log('✅ Success: No summary found for legacy-only member.');
    }

    // 인위적으로 최근 기록 추가 테스트
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

    // Re-simulate after insertion
    const { data: logsAfter } = await supabase
        .from('interaction_logs')
        .select('*')
        .eq('entity_id', member.id)
        .order('created_at', { ascending: false });

    let activeSummaryAfter = null;
    for (const log of logsAfter) {
        const isLegacy = log.staff_name === LEGACY_IMPORT_STAFF || new Date(log.created_at) < LEGACY_THRESHOLD_DATE;
        if (isLegacy) continue;
        activeSummaryAfter = log;
        break;
    }

    if (activeSummaryAfter && activeSummaryAfter.summary.includes('테스트용 최근 활동')) {
        console.log('✅ Success: Truly recent record is correctly identified.');
    } else {
        console.log('❌ Failure: Truly recent record was not identified.');
    }

    // 청소
    await supabase.from('interaction_logs').delete().eq('id', newLog.id);
    console.log('Test data cleaned up.');
}

verifyFilter().catch(console.error);
