-- =====================================================
-- peopleON Settlement RLS Template
-- 전제: settlement_core_phase1.sql + phase2.sql 선실행
-- 목적:
-- 1) authenticated 기본 조회 허용
-- 2) staff/admin 쓰기 허용
-- 3) admin 전용 삭제/정책관리
-- =====================================================

-- -----------------------------------------------------
-- 0. JWT 기반 역할 헬퍼
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.db_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT LOWER(BTRIM(COALESCE(
        (
            SELECT u.raw_app_meta_data ->> 'role'
            FROM auth.users u
            WHERE u.id = auth.uid()
        ),
        (
            SELECT u.raw_user_meta_data ->> 'role'
            FROM auth.users u
            WHERE u.id = auth.uid()
        ),
        ''
    )));
$$;

CREATE OR REPLACE FUNCTION app.jwt_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT LOWER(BTRIM(COALESCE(
        auth.jwt() -> 'app_metadata' ->> 'role',
        auth.jwt() -> 'user_metadata' ->> 'role',
        app.db_role(),
        auth.jwt() ->> 'role',
        ''
    )));
$$;

CREATE OR REPLACE FUNCTION app.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT app.jwt_role() IN ('admin', 'super_admin', 'service_role');
$$;

CREATE OR REPLACE FUNCTION app.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT app.jwt_role() IN ('admin', 'super_admin', 'finance_manager', 'ops_manager', 'staff', 'service_role');
$$;

-- 정책식에서 app.* 함수를 호출할 수 있도록 권한 부여
GRANT USAGE ON SCHEMA app TO authenticated;
GRANT EXECUTE ON FUNCTION app.db_role() TO authenticated;
GRANT EXECUTE ON FUNCTION app.jwt_role() TO authenticated;
GRANT EXECUTE ON FUNCTION app.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION app.is_staff_or_admin() TO authenticated;

-- -----------------------------------------------------
-- 1. 대상 테이블 RLS 활성화 + 공통 정책 생성
-- -----------------------------------------------------
DO $$
DECLARE
    t text;
    pol record;
    tables text[] := ARRAY[
        'party_profiles',
        'party_roles',
        'party_relationships',
        'right_certificates',
        'certificate_merge_history',
        'financial_accounts',
        'ledger_transactions',
        'transaction_party_links',
        'transaction_documents',
        'fund_classification_policies',
        'fund_nature_required_documents',
        'transaction_classification_events',
        'loss_events',
        'loss_allocations',
        'liability_pool_entries',
        'settlement_policy_versions',
        'settlement_cases',
        'settlement_lines',
        'settlement_approvals',
        'refund_payments',
        'batch_reclassification_jobs',
        'batch_reclassification_lines',
        'audit_logs'
    ];
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

        -- 기존 정책 잔재/충돌 방지를 위해 대상 테이블 정책을 전부 정리
        FOR pol IN
            SELECT policyname
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = t
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
        END LOOP;

        EXECUTE format('CREATE POLICY sel_auth ON %I FOR SELECT TO authenticated USING (true)', t);
        EXECUTE format('CREATE POLICY ins_staff ON %I FOR INSERT TO authenticated WITH CHECK (app.is_staff_or_admin())', t);
        EXECUTE format('CREATE POLICY upd_staff ON %I FOR UPDATE TO authenticated USING (app.is_staff_or_admin()) WITH CHECK (app.is_staff_or_admin())', t);
        EXECUTE format('CREATE POLICY del_admin ON %I FOR DELETE TO authenticated USING (app.is_admin())', t);
    END LOOP;
END $$;

-- -----------------------------------------------------
-- 2. 민감 정책테이블 쓰기 제한 강화 (admin only)
-- -----------------------------------------------------
ALTER TABLE fund_classification_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_nature_required_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ins_staff ON fund_classification_policies;
DROP POLICY IF EXISTS upd_staff ON fund_classification_policies;
DROP POLICY IF EXISTS ins_admin ON fund_classification_policies;
DROP POLICY IF EXISTS upd_admin ON fund_classification_policies;
DROP POLICY IF EXISTS ins_staff ON settlement_policy_versions;
DROP POLICY IF EXISTS upd_staff ON settlement_policy_versions;
DROP POLICY IF EXISTS ins_admin ON settlement_policy_versions;
DROP POLICY IF EXISTS upd_admin ON settlement_policy_versions;
DROP POLICY IF EXISTS ins_staff ON fund_nature_required_documents;
DROP POLICY IF EXISTS upd_staff ON fund_nature_required_documents;
DROP POLICY IF EXISTS ins_admin ON fund_nature_required_documents;
DROP POLICY IF EXISTS upd_admin ON fund_nature_required_documents;

CREATE POLICY ins_admin ON fund_classification_policies
FOR INSERT TO authenticated WITH CHECK (app.is_admin());
CREATE POLICY upd_admin ON fund_classification_policies
FOR UPDATE TO authenticated USING (app.is_admin()) WITH CHECK (app.is_admin());

CREATE POLICY ins_admin ON settlement_policy_versions
FOR INSERT TO authenticated WITH CHECK (app.is_admin());
CREATE POLICY upd_admin ON settlement_policy_versions
FOR UPDATE TO authenticated USING (app.is_admin()) WITH CHECK (app.is_admin());

CREATE POLICY ins_admin ON fund_nature_required_documents
FOR INSERT TO authenticated WITH CHECK (app.is_admin());
CREATE POLICY upd_admin ON fund_nature_required_documents
FOR UPDATE TO authenticated USING (app.is_admin()) WITH CHECK (app.is_admin());
