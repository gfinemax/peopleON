-- =====================================================
-- peopleON Settlement Go-Live Verification
-- 실행 위치: Supabase SQL Editor
-- 목적: A/B/C/D 검증을 한 번에 PASS/FAIL로 확인
-- =====================================================

WITH required_tables AS (
    SELECT unnest(ARRAY[
        'settlement_cases',
        'settlement_lines',
        'refund_payments',
        'audit_logs'
    ]) AS table_name
),
table_presence AS (
    SELECT
        rt.table_name,
        to_regclass('public.' || rt.table_name) IS NOT NULL AS exists_ok
    FROM required_tables rt
),
policy_check AS (
    SELECT
        COUNT(*) FILTER (
            WHERE policy_code = 'REFUND_2026_BASELINE'
        ) AS policy_rows,
        COUNT(*) FILTER (
            WHERE policy_code = 'REFUND_2026_BASELINE'
              AND is_default = true
        ) AS default_rows
    FROM settlement_policy_versions
),
function_check AS (
    SELECT COUNT(*) AS fn_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_settlement_case'
),
rls_required AS (
    SELECT unnest(ARRAY[
        'settlement_cases',
        'settlement_lines',
        'refund_payments',
        'audit_logs',
        'settlement_policy_versions'
    ]) AS table_name
),
rls_status AS (
    SELECT
        rr.table_name,
        COALESCE(pt.rowsecurity, false) AS rls_enabled
    FROM rls_required rr
    LEFT JOIN pg_tables pt
      ON pt.schemaname = 'public'
     AND pt.tablename = rr.table_name
),
checks AS (
    SELECT
        'A. core_tables_exist'::text AS check_name,
        CASE
            WHEN BOOL_AND(tp.exists_ok) THEN 'PASS'
            ELSE 'FAIL'
        END AS status,
        STRING_AGG(tp.table_name || '=' || CASE WHEN tp.exists_ok THEN 'ok' ELSE 'missing' END, ', ' ORDER BY tp.table_name) AS detail
    FROM table_presence tp

    UNION ALL

    SELECT
        'B. baseline_policy_exists_default_true',
        CASE
            WHEN pc.policy_rows >= 1 AND pc.default_rows = 1 THEN 'PASS'
            ELSE 'FAIL'
        END,
        'policy_rows=' || pc.policy_rows || ', default_rows=' || pc.default_rows
    FROM policy_check pc

    UNION ALL

    SELECT
        'C. function_create_settlement_case_exists',
        CASE
            WHEN fc.fn_count >= 1 THEN 'PASS'
            ELSE 'FAIL'
        END,
        'fn_count=' || fc.fn_count
    FROM function_check fc

    UNION ALL

    SELECT
        'D. rls_enabled_on_required_tables',
        CASE
            WHEN BOOL_AND(rs.rls_enabled) THEN 'PASS'
            ELSE 'FAIL'
        END,
        STRING_AGG(rs.table_name || '=' || CASE WHEN rs.rls_enabled THEN 'true' ELSE 'false' END, ', ' ORDER BY rs.table_name)
    FROM rls_status rs
)
SELECT
    check_name,
    status,
    detail
FROM checks
ORDER BY check_name;

-- 전체 판정 요약 (모든 항목 PASS여야 PASS)
WITH required_tables AS (
    SELECT unnest(ARRAY[
        'settlement_cases',
        'settlement_lines',
        'refund_payments',
        'audit_logs'
    ]) AS table_name
),
table_presence AS (
    SELECT
        rt.table_name,
        to_regclass('public.' || rt.table_name) IS NOT NULL AS exists_ok
    FROM required_tables rt
),
policy_check AS (
    SELECT
        COUNT(*) FILTER (
            WHERE policy_code = 'REFUND_2026_BASELINE'
        ) AS policy_rows,
        COUNT(*) FILTER (
            WHERE policy_code = 'REFUND_2026_BASELINE'
              AND is_default = true
        ) AS default_rows
    FROM settlement_policy_versions
),
function_check AS (
    SELECT COUNT(*) AS fn_count
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_settlement_case'
),
rls_required AS (
    SELECT unnest(ARRAY[
        'settlement_cases',
        'settlement_lines',
        'refund_payments',
        'audit_logs',
        'settlement_policy_versions'
    ]) AS table_name
),
rls_status AS (
    SELECT
        rr.table_name,
        COALESCE(pt.rowsecurity, false) AS rls_enabled
    FROM rls_required rr
    LEFT JOIN pg_tables pt
      ON pt.schemaname = 'public'
     AND pt.tablename = rr.table_name
)
SELECT
    CASE
        WHEN
            (SELECT BOOL_AND(exists_ok) FROM table_presence) = true
            AND (SELECT policy_rows >= 1 AND default_rows = 1 FROM policy_check) = true
            AND (SELECT fn_count >= 1 FROM function_check) = true
            AND (SELECT BOOL_AND(rls_enabled) FROM rls_status) = true
        THEN 'PASS'
        ELSE 'FAIL'
    END AS go_live_status,
    now() AS checked_at;
