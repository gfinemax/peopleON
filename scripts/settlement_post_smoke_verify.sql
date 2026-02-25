-- =====================================================
-- peopleON Settlement Post-Smoke Verification
-- 실행 위치: Supabase SQL Editor
-- 용도: 케이스 생성 + 지급등록 후 데이터 정합성 확인
-- =====================================================

-- 0) 아래 값을 방금 테스트에 사용한 참조번호로 바꿔주세요.
-- 예: 'SMOKE-20260223-001'
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
expected AS (
    SELECT
        sl.case_id,
        COALESCE(SUM(sl.amount), 0)::numeric(18,2) AS expected_final_refund
    FROM settlement_lines sl
    JOIN target_payment tp ON tp.case_id = sl.case_id
    WHERE sl.line_type = 'final_refund'
    GROUP BY sl.case_id
),
paid_total AS (
    SELECT
        rp.case_id,
        COALESCE(SUM(rp.paid_amount), 0)::numeric(18,2) AS paid_total
    FROM refund_payments rp
    JOIN target_payment tp ON tp.case_id = rp.case_id
    WHERE rp.payment_status = 'paid'
    GROUP BY rp.case_id
)
SELECT
    sc.id AS case_id,
    sc.case_status,
    tp.payment_reference,
    tp.paid_amount AS latest_paid_amount,
    tp.paid_date AS latest_paid_date,
    ex.expected_final_refund,
    pt.paid_total,
    GREATEST(ex.expected_final_refund - pt.paid_total, 0)::numeric(18,2) AS remaining_amount,
    CASE
        WHEN ex.expected_final_refund <= 0 THEN 'FAIL: final_refund_missing'
        WHEN pt.paid_total > ex.expected_final_refund THEN 'FAIL: overpaid'
        WHEN sc.case_status = 'paid' AND (ex.expected_final_refund - pt.paid_total) > 0 THEN 'FAIL: paid_status_mismatch'
        ELSE 'PASS'
    END AS integrity_status
FROM target_payment tp
JOIN settlement_cases sc ON sc.id = tp.case_id
LEFT JOIN expected ex ON ex.case_id = sc.id
LEFT JOIN paid_total pt ON pt.case_id = sc.id;

-- 1) 참조번호 중복 점검 (0건이어야 정상)
WITH params AS (
    SELECT 'SMOKE-REPLACE-REF'::text AS payment_ref
)
SELECT
    payment_reference,
    COUNT(*) AS duplicate_count
FROM refund_payments rp
JOIN params p ON rp.payment_reference = p.payment_ref
GROUP BY payment_reference;

-- 2) 최근 감사로그 확인 (지급등록/상태동기화/권한점검 추적)
SELECT
    entity_type,
    action,
    actor,
    reason,
    created_at
FROM audit_logs
WHERE entity_type IN ('refund_payment', 'settlement_case_batch', 'permission_probe')
ORDER BY created_at DESC
LIMIT 20;
