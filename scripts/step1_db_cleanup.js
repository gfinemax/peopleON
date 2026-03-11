/**
 * Step 1: DB 정리 — 불필요한 뷰/테이블/컬럼 삭제
 * 
 * 삭제 대상:
 * - 뷰 7개 (vw_certificate_*, vw_person_certificate_*)
 * - 테이블 2개 (asset_rights, person_certificate_summaries)
 * - 컬럼 1개 (account_entities.member_number)
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SQL_STATEMENTS = [
    // 뷰 7개 삭제
    `DROP VIEW IF EXISTS vw_certificate_grand_stats CASCADE`,
    `DROP VIEW IF EXISTS vw_certificate_others_detail CASCADE`,
    `DROP VIEW IF EXISTS vw_certificate_registered_detail CASCADE`,
    `DROP VIEW IF EXISTS vw_certificate_shared_holders CASCADE`,
    `DROP VIEW IF EXISTS vw_person_certificate_registry_provisional CASCADE`,
    `DROP VIEW IF EXISTS vw_person_certificate_rollup CASCADE`,
    `DROP VIEW IF EXISTS vw_person_certificate_summary_current CASCADE`,
    // 테이블 2개 삭제
    `DROP TABLE IF EXISTS person_certificate_summaries CASCADE`,
    `DROP TABLE IF EXISTS asset_rights CASCADE`,
    // 컬럼 1개 삭제
    `ALTER TABLE account_entities DROP COLUMN IF EXISTS member_number`,
];

async function main() {
    console.log('=== Step 1: DB 정리 시작 ===\n');

    for (const sql of SQL_STATEMENTS) {
        const label = sql.substring(0, 70);
        try {
            // Use fetch to call Supabase SQL endpoint directly
            const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                },
                body: JSON.stringify({ query: sql }),
            });

            if (!res.ok) {
                // Try the Supabase SQL API directly  
                const sqlUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/pg/query`;
                const sqlRes = await fetch(sqlUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                    },
                    body: JSON.stringify({ query: sql }),
                });
                if (!sqlRes.ok) {
                    console.log(`⚠️  ${label}...`);
                    console.log(`   → HTTP ${sqlRes.status} - 수동 실행 필요`);
                    continue;
                }
            }
            console.log(`✅ ${label}...`);
        } catch (err) {
            console.log(`⚠️  ${label}...`);
            console.log(`   → ${err.message} - 수동 실행 필요`);
        }
    }

    // 검증: asset_rights 테이블이 아직 존재하는지 확인
    const { data, error } = await supabase.from('asset_rights').select('id').limit(1);
    if (error && error.message.includes('does not exist')) {
        console.log('\n✅ asset_rights 테이블 삭제 확인됨');
    } else if (error) {
        console.log('\n⚠️  asset_rights 상태 확인 필요:', error.message);
    } else {
        console.log('\n❌ asset_rights 테이블이 아직 존재합니다 — Supabase SQL Editor에서 수동 삭제 필요');
    }

    // 검증: member_number 컬럼이 아직 존재하는지 확인
    const { data: testEntity, error: entErr } = await supabase
        .from('account_entities')
        .select('member_number')
        .limit(1);
    if (entErr && entErr.message.includes('member_number')) {
        console.log('✅ member_number 컬럼 삭제 확인됨');
    } else if (!entErr) {
        console.log('❌ member_number 컬럼이 아직 존재합니다 — Supabase SQL Editor에서 수동 삭제 필요');
    }

    console.log('\n=== Step 1 완료 ===');
    console.log('\n만약 ⚠️ 나 ❌ 항목이 있다면, Supabase SQL Editor에서 아래 SQL을 직접 실행해주세요:');
    console.log('─'.repeat(60));
    for (const sql of SQL_STATEMENTS) {
        console.log(sql + ';');
    }
}

main().catch(console.error);
