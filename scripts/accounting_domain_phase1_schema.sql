-- =====================================================
-- peopleON Accounting Domain Migration - Phase 1
-- 목적: 신규 회계/인물 도메인 기본 스키마 생성
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------
-- 0) 공통 타입
-- -----------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_type') THEN
        CREATE TYPE entity_type AS ENUM ('person', 'organization');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_role_code') THEN
        CREATE TYPE membership_role_code AS ENUM (
            '등기조합원',
            '2차',
            '일반분양',
            '지주',
            '지주조합원',
            '대리인',
            '예비조합원',
            '권리증환불',
            '관계인'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_role_status') THEN
        CREATE TYPE membership_role_status AS ENUM ('active', 'inactive', 'closed');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_right_type') THEN
        CREATE TYPE asset_right_type AS ENUM ('certificate', 'land_right');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_right_status') THEN
        CREATE TYPE asset_right_status AS ENUM ('active', 'merged', 'redeemed', 'cancelled');
    END IF;
END $$;

-- -----------------------------------------------------
-- 1) account_entities (계정 주체)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_entities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_party_id uuid UNIQUE,
    entity_type entity_type NOT NULL DEFAULT 'person',
    display_name text NOT NULL,
    phone text,
    id_hash text,
    deposit_account_masked text,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_entities_display_name ON public.account_entities(display_name);
CREATE INDEX IF NOT EXISTS idx_account_entities_phone ON public.account_entities(phone);

-- -----------------------------------------------------
-- 2) membership_roles (사업적 지위)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.membership_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid NOT NULL REFERENCES public.account_entities(id) ON DELETE CASCADE,
    source_member_id uuid,
    role_code membership_role_code NOT NULL,
    role_status membership_role_status NOT NULL DEFAULT 'active',
    is_registered boolean NOT NULL DEFAULT false,
    valid_from date,
    valid_to date,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
    UNIQUE (entity_id, role_code, role_status)
);

CREATE INDEX IF NOT EXISTS idx_membership_roles_entity ON public.membership_roles(entity_id);
CREATE INDEX IF NOT EXISTS idx_membership_roles_member ON public.membership_roles(source_member_id);
CREATE INDEX IF NOT EXISTS idx_membership_roles_code_status ON public.membership_roles(role_code, role_status);

-- -----------------------------------------------------
-- 3) asset_rights (권리 자산)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_rights (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid NOT NULL REFERENCES public.account_entities(id) ON DELETE RESTRICT,
    source_certificate_id uuid,
    right_type asset_right_type NOT NULL DEFAULT 'certificate',
    right_number text NOT NULL,
    principal_amount numeric(18,2),
    recognized_value numeric(18,2),
    land_lot_info text,
    status asset_right_status NOT NULL DEFAULT 'active',
    issued_at date,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (right_type, right_number)
);

CREATE INDEX IF NOT EXISTS idx_asset_rights_entity ON public.asset_rights(entity_id);
CREATE INDEX IF NOT EXISTS idx_asset_rights_status ON public.asset_rights(status);
CREATE INDEX IF NOT EXISTS idx_asset_rights_source_cert ON public.asset_rights(source_certificate_id);
