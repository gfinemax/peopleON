-- =====================================================
-- peopleON DB 정리 스크립트
-- 목적: 미사용 테이블/뷰 삭제, 핵심 테이블만 유지
-- 생성일: 2026-02-25
-- =====================================================
-- ⚠️  실행 전 반드시 Supabase 대시보드에서 DB 백업을 받으세요!
-- ⚠️  Supabase SQL Editor에서 실행하세요.
-- =====================================================

-- ===================
-- Phase 1: 뷰 삭제 (테이블보다 먼저)
-- ===================
DROP VIEW IF EXISTS v_current_fund_classification CASCADE;
DROP VIEW IF EXISTS v_fund_nature_requirements CASCADE;
DROP VIEW IF EXISTS v_liability_pool_summary CASCADE;
DROP VIEW IF EXISTS v_member_entity_mapping CASCADE;
DROP VIEW IF EXISTS v_member_roles_summary CASCADE;
DROP VIEW IF EXISTS v_party_profiles_with_roles CASCADE;
DROP VIEW IF EXISTS v_right_certificates_active CASCADE;
DROP VIEW IF EXISTS vw_certificate_settlement CASCADE;
DROP VIEW IF EXISTS vw_certificate_summary CASCADE;
DROP VIEW IF EXISTS vw_certificate_summary_by_status CASCADE;
DROP VIEW IF EXISTS vw_refunded_certificates CASCADE;

-- ===================
-- Phase 2: 트리거 삭제 (테이블 삭제 전)
-- 테이블이 없을 수 있으므로 예외 처리
-- ===================
DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_ledger_transactions_no_update ON ledger_transactions;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
    DROP TRIGGER IF EXISTS trg_enforce_single_current_classification ON transaction_classification_events;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ===================
-- Phase 3: 자식 테이블부터 삭제 (FK 종속 순서)
-- ===================

-- 3-1. batch_reclassification (자식 → 부모)
DROP TABLE IF EXISTS batch_reclassification_lines CASCADE;
DROP TABLE IF EXISTS batch_reclassification_jobs CASCADE;

-- 3-2. fund 관련 (자식 → 부모)
DROP TABLE IF EXISTS fund_nature_required_documents CASCADE;
DROP TABLE IF EXISTS fund_classification_policies CASCADE;

-- 3-3. loss 관련 (자식 → 부모)
DROP TABLE IF EXISTS loss_allocations CASCADE;
DROP TABLE IF EXISTS loss_events CASCADE;

-- 3-4. liability
DROP TABLE IF EXISTS liability_pool_entries CASCADE;

-- 3-5. settlement 부속 (settlement_cases는 유지)
DROP TABLE IF EXISTS settlement_approvals CASCADE;
DROP TABLE IF EXISTS settlement_policy_versions CASCADE;

-- 3-6. transaction 부속 (transaction_classification_events, transaction_documents는 유지)
-- ⚠️  CASCADE 사용: 유지 테이블의 FK만 제거됨 (데이터는 유지)
DROP TABLE IF EXISTS transaction_party_links CASCADE;

-- 3-7. ledger/financial (유지 테이블이 참조하므로 CASCADE 필수)
-- transaction_classification_events.transaction_id FK → 자동 제거됨
-- transaction_documents.transaction_id FK → 자동 제거됨
-- refund_payments.payment_account_id FK → 자동 제거됨
DROP TABLE IF EXISTS ledger_transactions CASCADE;
DROP TABLE IF EXISTS financial_accounts CASCADE;

-- 3-8. certificate 부속 (right_certificates는 유지)
DROP TABLE IF EXISTS certificate_merge_history CASCADE;

-- ===================
-- Phase 4: 독립 테이블 삭제
-- ===================
DROP TABLE IF EXISTS contact_logs CASCADE;
DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS price_tables CASCADE;
DROP TABLE IF EXISTS relationships CASCADE;

-- ===================
-- Phase 5: 미사용 함수 정리
-- ===================
DROP FUNCTION IF EXISTS prevent_update_delete_on_append_only() CASCADE;
DROP FUNCTION IF EXISTS enforce_single_current_classification() CASCADE;

-- ===================
-- Phase 6: 미사용 타입 정리 (선택)
-- ===================
-- 아래는 삭제된 테이블에서만 사용되던 타입들입니다.
-- 필요 없다면 삭제하세요.
DROP TYPE IF EXISTS fund_nature CASCADE;
DROP TYPE IF EXISTS document_type CASCADE;
DROP TYPE IF EXISTS account_category CASCADE;

-- =====================================================
-- 정리 완료! 남은 테이블 확인 쿼리
-- =====================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
