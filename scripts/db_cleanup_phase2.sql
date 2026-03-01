-- =====================================================
-- peopleON DB Phase 2 정리 — 완전 전환
-- 목적: members 중심 → account_entities 중심
-- 기존 데이터 전부 삭제, 레거시 테이블 DROP
-- =====================================================
-- ⚠️  이 스크립트를 실행하면 모든 데이터가 삭제됩니다!
-- ⚠️  실행 전 반드시 DB 백업을 확인하세요!
-- =====================================================

-- ===================
-- Phase 1: 모든 데이터 삭제 (FK 순서 고려)
-- 테이블이 존재하는 경우에만 실행
-- ===================
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'refund_payments', 'settlement_lines', 'settlement_cases', 
            'payments', 'interaction_logs', 'transaction_classification_events', 
            'transaction_documents', 'audit_logs', 'membership_roles', 
            'asset_rights', 'account_entities'
        )
    LOOP
        EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
    END LOOP;
END $$;

-- ===================
-- Phase 2: 레거시 테이블 삭제
-- ===================

DROP TABLE IF EXISTS interaction_logs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS party_roles CASCADE;
DROP TABLE IF EXISTS party_relationships CASCADE;
DROP TABLE IF EXISTS right_certificates CASCADE;

-- 2-3. settlement FK 제약 제거 (party_profiles, settlement_policy_versions 참조)
DO $$ BEGIN
    ALTER TABLE settlement_cases DROP CONSTRAINT IF EXISTS settlement_cases_party_id_fkey;
EXCEPTION WHEN undefined_object OR undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE settlement_cases DROP CONSTRAINT IF EXISTS settlement_cases_policy_version_id_fkey;
EXCEPTION WHEN undefined_object OR undefined_table THEN NULL;
END $$;

-- 2-4. 핵심 레거시 테이블 삭제
DROP TABLE IF EXISTS party_profiles CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS legacy_records CASCADE;
DROP TABLE IF EXISTS transaction_classification_events CASCADE;
DROP TABLE IF EXISTS transaction_documents CASCADE;

-- ===================
-- Phase 3: settlement_cases FK를 account_entities로 재연결
-- ===================

DO $$ BEGIN
    -- party_id가 존재하면 entity_id로 변경
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settlement_cases' AND column_name = 'party_id'
    ) THEN
        ALTER TABLE settlement_cases RENAME COLUMN party_id TO entity_id;
    END IF;

    -- entity_id 컬럼에 FK 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'settlement_cases_entity_id_fkey'
    ) THEN
        ALTER TABLE settlement_cases
            ADD CONSTRAINT settlement_cases_entity_id_fkey
            FOREIGN KEY (entity_id) REFERENCES account_entities(id) ON DELETE RESTRICT;
    END IF;

    -- policy_version_id 컬럼 삭제 (존재하는 경우만)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'settlement_cases' AND column_name = 'policy_version_id'
    ) THEN
        ALTER TABLE settlement_cases DROP COLUMN policy_version_id;
    END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ===================
-- Phase 4: payments 테이블 재생성 (account_entities 참조)
-- ===================
CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid NOT NULL REFERENCES account_entities(id) ON DELETE RESTRICT,
    step integer,
    step_name text,
    amount_due numeric(18,2) DEFAULT 0,
    amount_paid numeric(18,2) DEFAULT 0,
    paid_date date,
    is_paid boolean DEFAULT false,
    note text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_entity ON payments(entity_id);

-- ===================
-- Phase 5: interaction_logs 재생성 (account_entities 참조)
-- ===================
CREATE TABLE IF NOT EXISTS interaction_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id uuid NOT NULL REFERENCES account_entities(id) ON DELETE CASCADE,
    type text,          -- CALL, MEET, SMS, DOC
    summary text,
    direction text,     -- Inbound, Outbound
    staff_name text,
    attachment text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interaction_logs_entity ON interaction_logs(entity_id);

-- ===================
-- Phase 6: account_entities 스키마 보강
-- (기존 members의 주요 컬럼을 흡수)
-- ===================
ALTER TABLE account_entities ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE account_entities ADD COLUMN IF NOT EXISTS address_legal text;
ALTER TABLE account_entities ADD COLUMN IF NOT EXISTS memo text;
ALTER TABLE account_entities ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE account_entities ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false;
ALTER TABLE account_entities ADD COLUMN IF NOT EXISTS member_number text;
ALTER TABLE account_entities ADD COLUMN IF NOT EXISTS unit_group text;

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_account_entities_member_number ON account_entities(member_number);
CREATE INDEX IF NOT EXISTS idx_account_entities_favorite ON account_entities(is_favorite) WHERE is_favorite = true;

-- ===================
-- Phase 7: 미사용 타입 정리
-- ===================
DROP TYPE IF EXISTS party_role_type CASCADE;

-- =====================================================
-- 정리 완료! 최종 테이블 확인
-- =====================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
