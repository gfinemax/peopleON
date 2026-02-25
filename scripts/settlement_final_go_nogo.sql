-- =====================================================
-- peopleON Settlement Final GO/NO-GO
-- 실행 위치: Supabase SQL Editor
-- 목적: 스모크 테스트(지급등록) 이후 최종 운영 판정
-- =====================================================

-- 0) 아래 참조번호를 방금 지급등록한 값으로 변경하세요.
-- 예: SMOKE-20260223-001
WITH params AS (
    SELECT 'SMOKE-REPLACE-REF'::text AS payment_ref
),
target_payment AS (
    SELECT
        rp.id,
        rp.case_id,
        rp.paid_amount,
        rp.paid_date,
        rp.payment_reference,
        rp.created_at
    FROM refund_payments rp
    JOIN params p ON rp.payment_reference = p.payment_ref
    WHERE rp.payment_status = 'paid'
    ORDER BY rp.created_at DESC
    LIMIT 1
),
payment_exists AS (
    SELECT COUNT(*)::int AS cnt
    FROM target_payment
),
duplicate_ref AS (
    SELECT COUNT(*)::int AS cnt
    FROM refund_payments rp
    JOIN params p ON rp.payment_reference = p.payment_ref
    WHERE rp.payment_status = 'paid'
),
case_expected AS (
    SELECT
        sl.case_id,
        COALESCE(SUM(sl.amount), 0)::numeric(18,2) AS expected_amount
    FROM settlement_lines sl
    JOIN target_payment tp ON tp.case_id = sl.case_id
    WHERE sl.line_type = 'final_refund'
    GROUP BY sl.case_id
),
case_paid AS (
    SELECT
        rp.case_id,
        COALESCE(SUM(rp.paid_amount), 0)::numeric(18,2) AS paid_amount
    FROM refund_payments rp
    JOIN target_payment tp ON tp.case_id = rp.case_id
    WHERE rp.payment_status = 'paid'
    GROUP BY rp.case_id
),
case_integrity AS (
    SELECT
        sc.id AS case_id,
        sc.case_status,
        COALESCE(ce.expected_amount, 0)::numeric(18,2) AS expected_amount,
        COALESCE(cp.paid_amount, 0)::numeric(18,2) AS paid_amount,
        GREATEST(COALESCE(ce.expected_amount, 0) - COALESCE(cp.paid_amount, 0), 0)::numeric(18,2) AS remaining_amount,
        CASE
            WHEN COALESCE(ce.expected_amount, 0) <= 0 THEN 'FAIL'
            WHEN COALESCE(cp.paid_amount, 0) > COALESCE(ce.expected_amount, 0) THEN 'FAIL'
            WHEN sc.case_status = 'paid'
                 AND (COALESCE(ce.expected_amount, 0) - COALESCE(cp.paid_amount, 0)) > 0 THEN 'FAIL'
            ELSE 'PASS'
        END AS integrity_status
    FROM target_payment tp
    JOIN settlement_cases sc ON sc.id = tp.case_id
    LEFT JOIN case_expected ce ON ce.case_id = sc.id
    LEFT JOIN case_paid cp ON cp.case_id = sc.id
),
latest_qa AS (
    SELECT
        id,
        created_at,
        COALESCE(metadata ->> 'overall', 'warn') AS overall
    FROM audit_logs
    WHERE entity_type = 'qa_report'
      AND action = 'run'
    ORDER BY created_at DESC
    LIMIT 1
),
checks AS (
    SELECT
        '1. payment_created'::text AS check_name,
        CASE WHEN (SELECT cnt FROM payment_exists) >= 1 THEN 'PASS' ELSE 'FAIL' END AS status,
        'count=' || (SELECT cnt FROM payment_exists) AS detail
    UNION ALL
    SELECT
        '2. payment_reference_duplicate',
        CASE WHEN (SELECT cnt FROM duplicate_ref) = 1 THEN 'PASS' ELSE 'FAIL' END,
        'paid_ref_count=' || (SELECT cnt FROM duplicate_ref)
    UNION ALL
    SELECT
        '3. case_integrity',
        COALESCE((SELECT integrity_status FROM case_integrity LIMIT 1), 'FAIL'),
        COALESCE((
            SELECT
                'case=' || case_id ||
                ', status=' || case_status ||
                ', expected=' || expected_amount ||
                ', paid=' || paid_amount ||
                ', remaining=' || remaining_amount
            FROM case_integrity
            LIMIT 1
        ), 'case_not_found')
    UNION ALL
    SELECT
        '4. latest_qa_not_fail',
        CASE
            WHEN EXISTS (SELECT 1 FROM latest_qa)
                 AND (SELECT overall FROM latest_qa) <> 'fail'
            THEN 'PASS'
            ELSE 'FAIL'
        END,
        COALESCE((
            SELECT
                'qa_id=' || id || ', overall=' || overall || ', at=' || created_at
            FROM latest_qa
            LIMIT 1
        ), 'qa_not_found')
)
SELECT
    check_name,
    status,
    detail
FROM checks
ORDER BY check_name;

-- 최종 판정
WITH params AS (
    SELECT 'SMOKE-REPLACE-REF'::text AS payment_ref
),
target_payment AS (
    SELECT rp.id, rp.case_id
    FROM refund_payments rp
    JOIN params p ON rp.payment_reference = p.payment_ref
    WHERE rp.payment_status = 'paid'
    ORDER BY rp.created_at DESC
    LIMIT 1
),
payment_exists AS (
    SELECT COUNT(*)::int AS cnt FROM target_payment
),
duplicate_ref AS (
    SELECT COUNT(*)::int AS cnt
    FROM refund_payments rp
    JOIN params p ON rp.payment_reference = p.payment_ref
    WHERE rp.payment_status = 'paid'
),
case_expected AS (
    SELECT sl.case_id, COALESCE(SUM(sl.amount), 0) AS expected_amount
    FROM settlement_lines sl
    JOIN target_payment tp ON tp.case_id = sl.case_id
    WHERE sl.line_type = 'final_refund'
    GROUP BY sl.case_id
),
case_paid AS (
    SELECT rp.case_id, COALESCE(SUM(rp.paid_amount), 0) AS paid_amount
    FROM refund_payments rp
    JOIN target_payment tp ON tp.case_id = rp.case_id
    WHERE rp.payment_status = 'paid'
    GROUP BY rp.case_id
),
case_integrity AS (
    SELECT
        CASE
            WHEN COALESCE(ce.expected_amount, 0) <= 0 THEN false
            WHEN COALESCE(cp.paid_amount, 0) > COALESCE(ce.expected_amount, 0) THEN false
            ELSE true
        END AS ok
    FROM target_payment tp
    JOIN settlement_cases sc ON sc.id = tp.case_id
    LEFT JOIN case_expected ce ON ce.case_id = sc.id
    LEFT JOIN case_paid cp ON cp.case_id = sc.id
    LIMIT 1
),
latest_qa AS (
    SELECT COALESCE(metadata ->> 'overall', 'warn') AS overall
    FROM audit_logs
    WHERE entity_type = 'qa_report'
      AND action = 'run'
    ORDER BY created_at DESC
    LIMIT 1
)
SELECT
    CASE
        WHEN (SELECT cnt FROM payment_exists) >= 1
         AND (SELECT cnt FROM duplicate_ref) = 1
         AND COALESCE((SELECT ok FROM case_integrity), false) = true
         AND EXISTS (SELECT 1 FROM latest_qa)
         AND (SELECT overall FROM latest_qa) <> 'fail'
        THEN 'GO'
        ELSE 'NO-GO'
    END AS final_decision,
    now() AS checked_at;
