-- =====================================================
-- Test Script: create_settlement_case
-- 전제:
-- - scripts/settlement_case_function.sql 실행 완료
-- - 샘플 데이터 존재 (seed_sample_finance_flow.sql 실행)
-- =====================================================

-- 1) 샘플 party_id 확인
SELECT id, display_name, phone
FROM party_profiles
WHERE display_name IN ('샘플 조합원A', '샘플 권리자B')
ORDER BY display_name;

-- 2) 케이스 생성 (샘플 권리자B)
-- 아래 UUID를 실제 조회된 값으로 교체하거나, 서브쿼리 그대로 사용
SELECT *
FROM create_settlement_case(
    (SELECT id FROM party_profiles WHERE display_name = '샘플 권리자B' LIMIT 1),
    'REFUND_2026_BASELINE',
    1,
    'sql_test_user',
    false
);

-- 3) 생성된 최신 케이스 확인
SELECT sc.id, sc.party_id, sc.policy_version_id, sc.case_status, sc.created_at
FROM settlement_cases sc
JOIN party_profiles p ON p.id = sc.party_id
WHERE p.display_name = '샘플 권리자B'
ORDER BY sc.created_at DESC
LIMIT 5;

-- 4) 최신 케이스의 정산 라인 확인
SELECT sl.line_type, sl.amount, sl.note, sl.created_at
FROM settlement_lines sl
WHERE sl.case_id = (
    SELECT sc.id
    FROM settlement_cases sc
    JOIN party_profiles p ON p.id = sc.party_id
    WHERE p.display_name = '샘플 권리자B'
    ORDER BY sc.created_at DESC
    LIMIT 1
)
ORDER BY sl.created_at ASC;

