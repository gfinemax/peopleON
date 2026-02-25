-- =====================================================
-- peopleON Accounting Domain Migration - Phase 3
-- 목적: FK/트리거/제약 강화
-- =====================================================

-- -----------------------------------------------------
-- 0) updated_at 공통 트리거
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.account_entities') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'trg_account_entities_updated_at'
        ) THEN
            CREATE TRIGGER trg_account_entities_updated_at
            BEFORE UPDATE ON public.account_entities
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
        END IF;
    END IF;

    IF to_regclass('public.asset_rights') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_trigger
            WHERE tgname = 'trg_asset_rights_updated_at'
        ) THEN
            CREATE TRIGGER trg_asset_rights_updated_at
            BEFORE UPDATE ON public.asset_rights
            FOR EACH ROW
            EXECUTE FUNCTION public.set_updated_at();
        END IF;
    END IF;
END $$;

-- -----------------------------------------------------
-- 1) 선택적 FK 추가(기존 테이블 존재 시)
-- -----------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.party_profiles') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'fk_account_entities_source_party'
       )
    THEN
        ALTER TABLE public.account_entities
            ADD CONSTRAINT fk_account_entities_source_party
            FOREIGN KEY (source_party_id)
            REFERENCES public.party_profiles(id)
            ON DELETE SET NULL;
    END IF;

    IF to_regclass('public.members') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'fk_membership_roles_source_member'
       )
    THEN
        ALTER TABLE public.membership_roles
            ADD CONSTRAINT fk_membership_roles_source_member
            FOREIGN KEY (source_member_id)
            REFERENCES public.members(id)
            ON DELETE SET NULL;
    END IF;

    IF to_regclass('public.right_certificates') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM pg_constraint
           WHERE conname = 'fk_asset_rights_source_certificate'
       )
    THEN
        ALTER TABLE public.asset_rights
            ADD CONSTRAINT fk_asset_rights_source_certificate
            FOREIGN KEY (source_certificate_id)
            REFERENCES public.right_certificates(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- -----------------------------------------------------
-- 2) 데이터 정합성 보강 체크
-- -----------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_membership_roles_registered'
    ) THEN
        ALTER TABLE public.membership_roles
            ADD CONSTRAINT chk_membership_roles_registered
            CHECK (
                NOT (
                    role_code::text = '등기조합원'
                    AND is_registered = false
                )
            );
    END IF;
END $$;

-- -----------------------------------------------------
-- 3) 조회 성능 보강 인덱스
-- -----------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_account_entities_created_at ON public.account_entities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_roles_created_at ON public.membership_roles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_rights_created_at ON public.asset_rights(created_at DESC);
