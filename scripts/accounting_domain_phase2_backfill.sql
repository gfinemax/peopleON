-- =====================================================
-- peopleON Accounting Domain Migration - Phase 2
-- 목적: 기존 데이터 -> 신규 도메인 테이블 이관(backfill)
-- =====================================================

-- -----------------------------------------------------
-- 0) 표준 분류 함수
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS public.normalize_role_code(text, boolean);

CREATE OR REPLACE FUNCTION public.normalize_role_code(
    raw_tier text,
    is_registered boolean DEFAULT false
)
RETURNS membership_role_code
LANGUAGE sql
IMMUTABLE
AS $$
SELECT
    CASE
        WHEN replace(lower(coalesce(raw_tier, '')), ' ', '') IN ('1차', '등기조합원') THEN '등기조합원'::membership_role_code
        WHEN replace(lower(coalesce(raw_tier, '')), ' ', '') IN ('2차') THEN '2차'::membership_role_code
        WHEN replace(lower(coalesce(raw_tier, '')), ' ', '') IN ('일반', '3차', '일반분양') THEN '일반분양'::membership_role_code
        WHEN replace(lower(coalesce(raw_tier, '')), ' ', '') IN ('지주') THEN '지주'::membership_role_code
        WHEN replace(lower(coalesce(raw_tier, '')), ' ', '') IN ('지주조합원') THEN '지주조합원'::membership_role_code
        WHEN replace(lower(coalesce(raw_tier, '')), ' ', '') IN ('대리', '대리인') THEN '대리인'::membership_role_code
        WHEN replace(lower(coalesce(raw_tier, '')), ' ', '') IN ('예비', '예비조합원') THEN '예비조합원'::membership_role_code
        WHEN replace(lower(coalesce(raw_tier, '')), ' ', '') IN ('비조합원권리증', '권리증환불') THEN '권리증환불'::membership_role_code
        WHEN replace(lower(coalesce(raw_tier, '')), ' ', '') IN ('관계인') THEN '관계인'::membership_role_code
        WHEN is_registered THEN '등기조합원'::membership_role_code
        ELSE '관계인'::membership_role_code
    END;
$$;

-- -----------------------------------------------------
-- 0-1) upsert 대상 유니크 인덱스 보장
-- -----------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.membership_roles') IS NULL THEN
        RAISE NOTICE 'skip: membership_roles table not found';
    ELSE
        -- 기존 중복 제거(가장 작은 id 1건 유지)
        WITH ranked AS (
            SELECT
                id,
                row_number() OVER (
                    PARTITION BY entity_id, role_code, role_status
                    ORDER BY id
                ) AS rn
            FROM public.membership_roles
        )
        DELETE FROM public.membership_roles mr
        USING ranked r
        WHERE mr.id = r.id
          AND r.rn > 1;

        CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_roles_entity_code_status
            ON public.membership_roles(entity_id, role_code, role_status);
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('public.asset_rights') IS NULL THEN
        RAISE NOTICE 'skip: asset_rights table not found';
    ELSE
        -- 기존 중복 제거(가장 최신 updated_at > created_at > id 순 1건 유지)
        WITH ranked AS (
            SELECT
                id,
                row_number() OVER (
                    PARTITION BY right_type, right_number
                    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
                ) AS rn
            FROM public.asset_rights
        )
        DELETE FROM public.asset_rights ar
        USING ranked r
        WHERE ar.id = r.id
          AND r.rn > 1;

        CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_rights_type_number
            ON public.asset_rights(right_type, right_number);
    END IF;
END $$;

-- -----------------------------------------------------
-- 1) party_profiles -> account_entities
-- -----------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.party_profiles') IS NULL THEN
        RAISE NOTICE 'skip: party_profiles table not found';
    ELSE
        INSERT INTO public.account_entities (
            source_party_id,
            entity_type,
            display_name,
            phone,
            meta
        )
        SELECT
            p.id,
            'person'::entity_type,
            coalesce(nullif(trim(p.display_name), ''), '이름미상'),
            p.phone,
            jsonb_build_object('source', 'party_profiles', 'notes', p.notes)
        FROM public.party_profiles p
        ON CONFLICT (source_party_id)
        DO UPDATE SET
            display_name = EXCLUDED.display_name,
            phone = EXCLUDED.phone,
            meta = public.account_entities.meta || EXCLUDED.meta,
            updated_at = now();
    END IF;
END $$;

-- -----------------------------------------------------
-- 2) members 중 party 미연결 인물 보강
-- -----------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.members') IS NULL THEN
        RAISE NOTICE 'skip: members table not found';
    ELSE
        INSERT INTO public.account_entities (
            source_party_id,
            entity_type,
            display_name,
            phone,
            meta
        )
        SELECT
            NULL,
            'person'::entity_type,
            coalesce(nullif(trim(m.name), ''), '이름미상'),
            m.phone,
            jsonb_build_object('source', 'members_without_party', 'source_member_id', m.id::text)
        FROM public.members m
        LEFT JOIN public.party_profiles p
            ON p.member_id = m.id
        WHERE p.id IS NULL
          AND NOT EXISTS (
              SELECT 1
              FROM public.account_entities ae
              WHERE ae.meta ->> 'source_member_id' = m.id::text
          );
    END IF;
END $$;

-- -----------------------------------------------------
-- 3) members -> membership_roles
-- -----------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.members') IS NULL THEN
        RAISE NOTICE 'skip: members table not found';
    ELSE
        WITH member_entity AS (
            SELECT
                m.id AS member_id,
                m.tier,
                m.is_registered,
                m.status,
                COALESCE(ae_party.id, ae_meta.id) AS entity_id
            FROM public.members m
            LEFT JOIN public.party_profiles p
                ON p.member_id = m.id
            LEFT JOIN public.account_entities ae_party
                ON ae_party.source_party_id = p.id
            LEFT JOIN LATERAL (
                SELECT ae.id
                FROM public.account_entities ae
                WHERE ae.meta ->> 'source_member_id' = m.id::text
                ORDER BY ae.created_at ASC
                LIMIT 1
            ) ae_meta ON true
        )
        INSERT INTO public.membership_roles (
            entity_id,
            source_member_id,
            role_code,
            role_status,
            is_registered,
            note
        )
        SELECT
            me.entity_id,
            me.member_id,
            public.normalize_role_code(me.tier::text, coalesce(me.is_registered, false)),
            CASE
                WHEN coalesce(me.status::text, '') IN ('탈퇴', '탈퇴예정') THEN 'inactive'::membership_role_status
                ELSE 'active'::membership_role_status
            END,
            coalesce(me.is_registered, false),
            'backfill:members'
        FROM member_entity me
        WHERE me.entity_id IS NOT NULL
        ON CONFLICT (entity_id, role_code, role_status)
        DO UPDATE SET
            source_member_id = EXCLUDED.source_member_id,
            is_registered = EXCLUDED.is_registered,
            note = EXCLUDED.note;
    END IF;
END $$;

-- -----------------------------------------------------
-- 4) party_roles -> membership_roles
-- -----------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.party_roles') IS NULL OR to_regclass('public.party_profiles') IS NULL THEN
        RAISE NOTICE 'skip: party_roles/party_profiles table not found';
    ELSE
        INSERT INTO public.membership_roles (
            entity_id,
            source_member_id,
            role_code,
            role_status,
            is_registered,
            note
        )
        SELECT
            ae.id AS entity_id,
            p.member_id AS source_member_id,
            CASE
                WHEN pr.role_type = 'member' THEN public.normalize_role_code(m.tier::text, coalesce(m.is_registered, false))
                WHEN pr.role_type = 'certificate_holder' THEN '권리증환불'::membership_role_code
                WHEN pr.role_type = 'related_party' THEN '관계인'::membership_role_code
                WHEN pr.role_type = 'refund_applicant' THEN '권리증환불'::membership_role_code
                ELSE '관계인'::membership_role_code
            END AS role_code,
            CASE
                WHEN coalesce(pr.role_status::text, 'active') = 'active' THEN 'active'::membership_role_status
                ELSE 'inactive'::membership_role_status
            END AS role_status,
            coalesce(m.is_registered, false) AS is_registered,
            'backfill:party_roles'
        FROM public.party_roles pr
        JOIN public.party_profiles p
            ON p.id = pr.party_id
        JOIN public.account_entities ae
            ON ae.source_party_id = pr.party_id
        LEFT JOIN public.members m
            ON m.id = p.member_id
        ON CONFLICT (entity_id, role_code, role_status)
        DO UPDATE SET
            source_member_id = EXCLUDED.source_member_id,
            is_registered = EXCLUDED.is_registered,
            note = EXCLUDED.note;
    END IF;
END $$;

-- -----------------------------------------------------
-- 5) party_relationships(대리) -> membership_roles(대리인)
-- -----------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.party_relationships') IS NULL OR to_regclass('public.party_profiles') IS NULL THEN
        RAISE NOTICE 'skip: party_relationships/party_profiles table not found';
    ELSE
        WITH registered_party AS (
            SELECT p.id AS party_id
            FROM public.party_profiles p
            JOIN public.members m
                ON m.id = p.member_id
            WHERE m.is_registered = true
        ),
        proxy_pairs AS (
            SELECT
                pr.from_party_id,
                pr.to_party_id
            FROM public.party_relationships pr
            WHERE replace(lower(coalesce(pr.relation_type, '')), ' ', '') IN ('proxy', 'agent', 'attorney', '대리', '대리인')
        ),
        proxy_target AS (
            SELECT DISTINCT
                CASE
                    WHEN rp.party_id = pp.from_party_id THEN pp.to_party_id
                    WHEN rp.party_id = pp.to_party_id THEN pp.from_party_id
                    ELSE NULL
                END AS proxy_party_id
            FROM proxy_pairs pp
            JOIN registered_party rp
                ON rp.party_id IN (pp.from_party_id, pp.to_party_id)
        )
        INSERT INTO public.membership_roles (
            entity_id,
            source_member_id,
            role_code,
            role_status,
            is_registered,
            note
        )
        SELECT
            ae.id,
            p.member_id,
            '대리인'::membership_role_code,
            'active'::membership_role_status,
            coalesce(m.is_registered, false),
            'backfill:party_relationships(proxy)'
        FROM proxy_target pt
        JOIN public.account_entities ae
            ON ae.source_party_id = pt.proxy_party_id
        LEFT JOIN public.party_profiles p
            ON p.id = pt.proxy_party_id
        LEFT JOIN public.members m
            ON m.id = p.member_id
        WHERE pt.proxy_party_id IS NOT NULL
        ON CONFLICT (entity_id, role_code, role_status)
        DO NOTHING;
    END IF;
END $$;

-- -----------------------------------------------------
-- 6) right_certificates -> asset_rights
-- -----------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.right_certificates') IS NULL THEN
        RAISE NOTICE 'skip: right_certificates table not found';
    ELSE
        -- (a) 권리증 보유자에 대한 account_entity 보강
        IF to_regclass('public.party_profiles') IS NOT NULL THEN
            INSERT INTO public.account_entities (
                source_party_id,
                entity_type,
                display_name,
                phone,
                meta
            )
            SELECT
                p.id,
                'person'::entity_type,
                coalesce(nullif(trim(p.display_name), ''), '이름미상'),
                p.phone,
                jsonb_build_object('source', 'right_certificates_holder_backfill')
            FROM public.right_certificates rc
            JOIN public.party_profiles p
                ON p.id = rc.holder_party_id
            LEFT JOIN public.account_entities ae
                ON ae.source_party_id = p.id
            WHERE ae.id IS NULL
            ON CONFLICT (source_party_id) DO NOTHING;
        END IF;

        -- (b) party_profiles가 없는 holder_party_id도 placeholder로 생성
        INSERT INTO public.account_entities (
            source_party_id,
            entity_type,
            display_name,
            phone,
            meta
        )
        SELECT DISTINCT
            rc.holder_party_id,
            'person'::entity_type,
            '인물-' || left(rc.holder_party_id::text, 8),
            NULL,
            jsonb_build_object('source', 'right_certificates_placeholder')
        FROM public.right_certificates rc
        LEFT JOIN public.account_entities ae
            ON ae.source_party_id = rc.holder_party_id
        WHERE ae.id IS NULL
        ON CONFLICT (source_party_id) DO NOTHING;

        -- (c) 권리 자산 이관
        INSERT INTO public.asset_rights (
            entity_id,
            source_certificate_id,
            right_type,
            right_number,
            principal_amount,
            recognized_value,
            status,
            issued_at,
            meta
        )
        SELECT
            ae.id AS entity_id,
            rc.id AS source_certificate_id,
            'certificate'::asset_right_type AS right_type,
            rc.certificate_number AS right_number,
            rc.base_refund_amount AS principal_amount,
            COALESCE(
                rc.market_reference_price,
                rc.base_refund_amount + COALESCE(rc.recognized_premium, 0),
                rc.base_refund_amount
            ) AS recognized_value,
            CASE
                WHEN lower(coalesce(rc.status::text, 'active')) = 'merged' THEN 'merged'::asset_right_status
                WHEN lower(coalesce(rc.status::text, 'active')) = 'redeemed' THEN 'redeemed'::asset_right_status
                WHEN lower(coalesce(rc.status::text, 'active')) = 'cancelled' THEN 'cancelled'::asset_right_status
                ELSE 'active'::asset_right_status
            END AS status,
            rc.issue_date AS issued_at,
            jsonb_build_object(
                'source', 'right_certificates',
                'issuer', rc.issuer,
                'legacy_status', rc.status
            ) AS meta
        FROM public.right_certificates rc
        JOIN public.account_entities ae
            ON ae.source_party_id = rc.holder_party_id
        ON CONFLICT (right_type, right_number)
        DO UPDATE SET
            entity_id = EXCLUDED.entity_id,
            source_certificate_id = EXCLUDED.source_certificate_id,
            principal_amount = EXCLUDED.principal_amount,
            recognized_value = EXCLUDED.recognized_value,
            status = EXCLUDED.status,
            issued_at = EXCLUDED.issued_at,
            meta = EXCLUDED.meta,
            updated_at = now();
    END IF;
END $$;
