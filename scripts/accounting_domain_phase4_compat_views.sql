-- =====================================================
-- peopleON Accounting Domain Migration - Phase 4
-- 목적: 신규 구조 기반 호환 View 제공(읽기 전환용)
-- =====================================================

-- -----------------------------------------------------
-- 1) account_entities 기반 party_profile 유사 View
-- -----------------------------------------------------
CREATE OR REPLACE VIEW public.v_party_profiles_compat AS
SELECT
    ae.id AS entity_id,
    ae.source_party_id,
    ae.display_name,
    ae.phone,
    ae.entity_type::text AS entity_type,
    ae.meta,
    ae.created_at,
    ae.updated_at
FROM public.account_entities ae;

-- -----------------------------------------------------
-- 2) membership_roles 기반 member role View
-- -----------------------------------------------------
CREATE OR REPLACE VIEW public.v_member_roles_compat AS
SELECT
    mr.id,
    mr.entity_id,
    mr.source_member_id AS member_id,
    mr.role_code::text AS role_code,
    mr.role_status::text AS role_status,
    mr.is_registered,
    mr.valid_from,
    mr.valid_to,
    mr.note,
    mr.created_at
FROM public.membership_roles mr;

-- -----------------------------------------------------
-- 3) asset_rights 기반 right_certificate 유사 View
-- -----------------------------------------------------
CREATE OR REPLACE VIEW public.v_right_certificates_compat AS
SELECT
    ar.id,
    ar.entity_id,
    ar.source_certificate_id,
    ar.right_type::text AS right_type,
    ar.right_number AS certificate_number,
    ar.principal_amount AS base_refund_amount,
    ar.recognized_value,
    ar.status::text AS status,
    ar.issued_at AS issue_date,
    ar.meta,
    ar.created_at,
    ar.updated_at
FROM public.asset_rights ar
WHERE ar.right_type::text = 'certificate';

-- -----------------------------------------------------
-- 4) /members 화면용 통합 View (선택 사용)
-- -----------------------------------------------------
CREATE OR REPLACE VIEW public.v_member_entity_summary AS
SELECT
    ae.id AS entity_id,
    ae.source_party_id,
    ae.display_name,
    ae.phone,
    COALESCE(
        array_agg(DISTINCT mr.role_code::text) FILTER (WHERE mr.id IS NOT NULL),
        ARRAY[]::text[]
    ) AS role_codes,
    bool_or(mr.is_registered) FILTER (WHERE mr.id IS NOT NULL) AS is_registered_any,
    count(DISTINCT ar.id) FILTER (WHERE ar.right_type::text = 'certificate') AS certificate_count,
    ae.created_at,
    ae.updated_at
FROM public.account_entities ae
LEFT JOIN public.membership_roles mr
    ON mr.entity_id = ae.id
LEFT JOIN public.asset_rights ar
    ON ar.entity_id = ae.id
GROUP BY
    ae.id,
    ae.source_party_id,
    ae.display_name,
    ae.phone,
    ae.created_at,
    ae.updated_at;
