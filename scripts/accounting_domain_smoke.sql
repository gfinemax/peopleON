-- =====================================================
-- peopleON Accounting Domain Migration - Smoke Test
-- 목적: Phase 1~5 적용 후 GO/NO-GO 판정
-- =====================================================

WITH table_presence AS (
    SELECT
        t.table_name,
        (to_regclass('public.' || t.table_name) IS NOT NULL) AS exists_ok
    FROM (
        VALUES
            ('account_entities'),
            ('membership_roles'),
            ('asset_rights')
    ) AS t(table_name)
),
party_profile_coverage AS (
    SELECT
        CASE
            WHEN to_regclass('public.party_profiles') IS NULL THEN 0
            WHEN to_regclass('public.account_entities') IS NULL THEN 999999
            ELSE (
                SELECT count(*)
                FROM public.party_profiles p
                LEFT JOIN public.account_entities ae
                    ON ae.source_party_id = p.id
                WHERE ae.id IS NULL
            )
        END AS missing_count
),
certificate_coverage AS (
    SELECT
        CASE
            WHEN to_regclass('public.right_certificates') IS NULL THEN 0
            WHEN to_regclass('public.asset_rights') IS NULL THEN 999999
            ELSE (
                SELECT count(*)
                FROM public.right_certificates rc
                LEFT JOIN public.asset_rights ar
                    ON ar.source_certificate_id = rc.id
                   AND ar.right_type::text = 'certificate'
                WHERE ar.id IS NULL
            )
        END AS missing_count
),
duplicate_right_number AS (
    SELECT
        CASE
            WHEN to_regclass('public.asset_rights') IS NULL THEN 999999
            ELSE (
                SELECT count(*) FROM (
                    SELECT right_type, right_number
                    FROM public.asset_rights
                    GROUP BY right_type, right_number
                    HAVING count(*) > 1
                ) d
            )
        END AS duplicate_count
),
invalid_role_code AS (
    SELECT
        CASE
            WHEN to_regclass('public.membership_roles') IS NULL THEN 999999
            ELSE (
                SELECT count(*)
                FROM public.membership_roles mr
                WHERE mr.role_code::text NOT IN (
                    '등기조합원',
                    '2차',
                    '일반분양',
                    '지주',
                    '지주조합원',
                    '대리인',
                    '예비조합원',
                    '권리증환불',
                    '관계인'
                )
            )
        END AS invalid_count
),
checks AS (
    SELECT
        'table_presence'::text AS check_name,
        CASE WHEN bool_and(exists_ok) THEN 'PASS' ELSE 'FAIL' END AS status,
        string_agg(table_name || '=' || CASE WHEN exists_ok THEN 'ok' ELSE 'missing' END, ', ') AS detail
    FROM table_presence

    UNION ALL

    SELECT
        'party_profile_coverage',
        CASE WHEN missing_count = 0 THEN 'PASS' ELSE 'FAIL' END,
        'unmapped party_profiles=' || missing_count::text
    FROM party_profile_coverage

    UNION ALL

    SELECT
        'certificate_coverage',
        CASE WHEN missing_count = 0 THEN 'PASS' ELSE 'FAIL' END,
        'unmapped right_certificates=' || missing_count::text
    FROM certificate_coverage

    UNION ALL

    SELECT
        'duplicate_asset_right_number',
        CASE WHEN duplicate_count = 0 THEN 'PASS' ELSE 'FAIL' END,
        'duplicate right_number=' || duplicate_count::text
    FROM duplicate_right_number

    UNION ALL

    SELECT
        'invalid_membership_role_code',
        CASE WHEN invalid_count = 0 THEN 'PASS' ELSE 'FAIL' END,
        'invalid role_code=' || invalid_count::text
    FROM invalid_role_code
)
SELECT
    check_name,
    status,
    detail
FROM checks
ORDER BY check_name;

-- 최종 GO/NO-GO
WITH checks AS (
    WITH table_presence AS (
        SELECT (to_regclass('public.account_entities') IS NOT NULL)
            AND (to_regclass('public.membership_roles') IS NOT NULL)
            AND (to_regclass('public.asset_rights') IS NOT NULL) AS ok
    ),
    issue_counts AS (
        SELECT
            COALESCE((
                SELECT count(*)
                FROM public.party_profiles p
                LEFT JOIN public.account_entities ae
                    ON ae.source_party_id = p.id
                WHERE ae.id IS NULL
            ), 0) AS party_missing,
            COALESCE((
                SELECT count(*)
                FROM public.right_certificates rc
                LEFT JOIN public.asset_rights ar
                    ON ar.source_certificate_id = rc.id
                WHERE ar.id IS NULL
            ), 0) AS cert_missing,
            COALESCE((
                SELECT count(*)
                FROM (
                    SELECT right_type, right_number
                    FROM public.asset_rights
                    GROUP BY right_type, right_number
                    HAVING count(*) > 1
                ) d
            ), 0) AS dup_right
    )
    SELECT
        CASE
            WHEN tp.ok
                 AND ic.party_missing = 0
                 AND ic.cert_missing = 0
                 AND ic.dup_right = 0
            THEN 'PASS'
            ELSE 'FAIL'
        END AS go_live_status,
        now() AS checked_at,
        jsonb_build_object(
            'party_missing', ic.party_missing,
            'cert_missing', ic.cert_missing,
            'dup_right', ic.dup_right
        ) AS metrics
    FROM table_presence tp
    CROSS JOIN issue_counts ic
)
SELECT * FROM checks;
