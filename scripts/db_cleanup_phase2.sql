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
-- ===================
TRUNCATE TABLE refund_payments CASCADE;
TRUNCATE TABLE settlement_lines CASCADE;
TRUNCATE TABLE settlement_cases CASCADE;
TRUNCATE TABLE payments CASCADE;
TRUNCATE TABLE interaction_logs CASCADE;
TRUNCATE TABLE transaction_classification_events CASCADE;
TRUNCATE TABLE transaction_documents CASCADE;
TRUNCATE TABLE audit_logs CASCADE;
TRUNCATE TABLE membership_roles CASCADE;
TRUNCATE TABLE asset_rights CASCADE;
TRUNCATE TABLE account_entities CASCADE;

-- ===================
-- Phase 2: 레거시 테이블 삭제
-- ===================

-- 2-1. members 의존 테이블
DROP TABLE IF EXISTS interaction_logs CASCADE;
DROP TABLE IF EXISTS payments CASCADE;

-- 2-2. party_profiles 의존 테이블
DROP TABLE IF EXISTS party_roles CASCADE;
DROP TABLE IF EXISTS party_relationships CASCADE;
DROP TABLE IF EXISTS right_certificates CASCADE;

-- 2-3. settlement FK 제약 제거 (party_profiles, settlement_policy_versions 참조)
ALTER TABLE settlement_cases DROP CONSTRAINT IF EXISTS settlement_cases_party_id_fkey;
ALTER TABLE settlement_cases DROP CONSTRAINT IF EXISTS settlement_cases_policy_version_id_fkey;

-- 2-4. 핵심 레거시 테이블 삭제
DROP TABLE IF EXISTS party_profiles CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS legacy_records CASCADE;

-- 2-5. 참조 없는 독립 테이블
DROP TABLE IF EXISTS transaction_classification_events CASCADE;
DROP TABLE IF EXISTS transaction_documents CASCADE;

-- ===================
-- Phase 3: settlement_cases FK를 account_entities로 재연결
-- ===================

-- party_id → entity_id (account_entities 참조)로 변경
ALTER TABLE settlement_cases RENAME COLUMN party_id TO entity_id;
ALTER TABLE settlement_cases
    ADD CONSTRAINT settlement_cases_entity_id_fkey
    FOREIGN KEY (entity_id) REFERENCES account_entities(id) ON DELETE RESTRICT;

-- policy_version_id 컬럼 삭제 (settlement_policy_versions 테이블 삭제됨)
ALTER TABLE settlement_cases DROP COLUMN IF EXISTS policy_version_id;

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
