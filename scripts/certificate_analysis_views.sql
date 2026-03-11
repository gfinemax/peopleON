-- =====================================================
-- 권리증 정밀 분석 뷰
-- =====================================================
-- 목적:
-- 1) 등기조합원 116명의 개인별 권리증 상세
-- 2) 같은 번호를 2명 이상이 공유하는 중복 현황
-- 3) 등기조합원 외 보유자 상세
-- 4) 전체 통계 (고유 번호 수, 그룹별 합산)
--
-- 전제: certificate_registry 테이블이 이미 생성/동기화 되어 있어야 함
-- =====================================================

-- 1) 등기조합원 개인별 권리증 상세
CREATE OR REPLACE VIEW public.vw_certificate_registered_detail AS
SELECT
    ae.id AS entity_id,
    ae.display_name,
    COUNT(DISTINCT cr.certificate_number_normalized) AS certificate_count,
    COALESCE(
        ARRAY_AGG(DISTINCT cr.certificate_number_normalized
                  ORDER BY cr.certificate_number_normalized)
            FILTER (WHERE cr.certificate_number_normalized IS NOT NULL),
        ARRAY[]::text[]
    ) AS certificate_numbers
FROM public.certificate_registry cr
JOIN public.account_entities ae ON ae.id = cr.entity_id
JOIN public.membership_roles mr ON mr.entity_id = ae.id
     AND mr.is_registered = true
WHERE cr.is_active = true
  AND cr.certificate_status = 'confirmed'
  AND cr.is_confirmed_for_count = true
  AND COALESCE(cr.certificate_number_normalized, '') <> ''
GROUP BY ae.id, ae.display_name;

COMMENT ON VIEW public.vw_certificate_registered_detail IS
'등기조합원 개인별 보유 권리증 수 및 번호 목록';

-- 2) 같은 권리증 번호를 여러 명이 공유하는 중복 현황
CREATE OR REPLACE VIEW public.vw_certificate_shared_holders AS
WITH all_confirmed AS (
    SELECT
        cr.certificate_number_normalized,
        ae.id AS entity_id,
        ae.display_name,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM public.membership_roles mr
                WHERE mr.entity_id = ae.id
                  AND mr.is_registered = true
            ) THEN 'registered'
            ELSE 'others'
        END AS owner_group
    FROM public.certificate_registry cr
    JOIN public.account_entities ae ON ae.id = cr.entity_id
    WHERE cr.is_active = true
      AND cr.certificate_status = 'confirmed'
      AND cr.is_confirmed_for_count = true
      AND COALESCE(cr.certificate_number_normalized, '') <> ''
)
SELECT
    certificate_number_normalized,
    COUNT(DISTINCT entity_id) AS holder_count,
    ARRAY_AGG(DISTINCT display_name ORDER BY display_name) AS holder_names,
    ARRAY_AGG(DISTINCT owner_group) AS holder_groups
FROM all_confirmed
GROUP BY certificate_number_normalized
HAVING COUNT(DISTINCT entity_id) > 1;

COMMENT ON VIEW public.vw_certificate_shared_holders IS
'같은 권리증 번호를 2명 이상이 보유하는 중복/공유 현황';

-- 3) 등기조합원 외 보유자 상세
CREATE OR REPLACE VIEW public.vw_certificate_others_detail AS
SELECT
    ae.id AS entity_id,
    ae.display_name,
    COUNT(DISTINCT cr.certificate_number_normalized) AS certificate_count,
    COALESCE(
        ARRAY_AGG(DISTINCT cr.certificate_number_normalized
                  ORDER BY cr.certificate_number_normalized)
            FILTER (WHERE cr.certificate_number_normalized IS NOT NULL),
        ARRAY[]::text[]
    ) AS certificate_numbers
FROM public.certificate_registry cr
JOIN public.account_entities ae ON ae.id = cr.entity_id
WHERE cr.is_active = true
  AND cr.certificate_status = 'confirmed'
  AND cr.is_confirmed_for_count = true
  AND COALESCE(cr.certificate_number_normalized, '') <> ''
  AND NOT EXISTS (
      SELECT 1 FROM public.membership_roles mr
      WHERE mr.entity_id = ae.id
        AND mr.is_registered = true
  )
GROUP BY ae.id, ae.display_name;

COMMENT ON VIEW public.vw_certificate_others_detail IS
'등기조합원 외 권리증 보유자 개인별 상세';

-- 4) 전체 통계 뷰 (한 행)
CREATE OR REPLACE VIEW public.vw_certificate_grand_stats AS
WITH all_confirmed AS (
    SELECT
        cr.certificate_number_normalized,
        cr.entity_id,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM public.membership_roles mr
                WHERE mr.entity_id = cr.entity_id
                  AND mr.is_registered = true
            ) THEN 'registered'
            ELSE 'others'
        END AS owner_group
    FROM public.certificate_registry cr
    WHERE cr.is_active = true
      AND cr.certificate_status = 'confirmed'
      AND cr.is_confirmed_for_count = true
      AND COALESCE(cr.certificate_number_normalized, '') <> ''
), reg AS (
    SELECT * FROM all_confirmed WHERE owner_group = 'registered'
), oth AS (
    SELECT * FROM all_confirmed WHERE owner_group = 'others'
), shared AS (
    SELECT certificate_number_normalized
    FROM all_confirmed
    GROUP BY certificate_number_normalized
    HAVING COUNT(DISTINCT entity_id) > 1
)
SELECT
    -- 등기조합원
    (SELECT COUNT(DISTINCT entity_id) FROM reg)::int AS registered_owner_count,
    (SELECT COUNT(DISTINCT certificate_number_normalized) FROM reg)::int AS registered_unique_cert_count,
    (SELECT COALESCE(SUM(cnt), 0) FROM (SELECT COUNT(DISTINCT certificate_number_normalized) AS cnt FROM reg GROUP BY entity_id) sub)::int AS registered_total_cert_sum,
    -- 비등기
    (SELECT COUNT(DISTINCT entity_id) FROM oth)::int AS others_owner_count,
    (SELECT COUNT(DISTINCT certificate_number_normalized) FROM oth)::int AS others_unique_cert_count,
    (SELECT COALESCE(SUM(cnt), 0) FROM (SELECT COUNT(DISTINCT certificate_number_normalized) AS cnt FROM oth GROUP BY entity_id) sub)::int AS others_total_cert_sum,
    -- 전체
    (SELECT COUNT(DISTINCT certificate_number_normalized) FROM all_confirmed)::int AS total_unique_cert_count,
    -- 공유
    (SELECT COUNT(*) FROM shared)::int AS shared_cert_count;

COMMENT ON VIEW public.vw_certificate_grand_stats IS
'등기/비등기 그룹별 인원, 고유번호, 합산장수, 공유 통계';
