-- =====================================================
-- peopleON Accounting Domain Migration - Phase 5
-- 목적: 신규 도메인 테이블 RLS 적용
-- =====================================================

-- -----------------------------------------------------
-- 0) JWT role helper
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
SELECT lower(
    coalesce(
        auth.jwt() -> 'app_metadata' ->> 'role',
        auth.jwt() -> 'user_metadata' ->> 'role',
        ''
    )
);
$$;

-- -----------------------------------------------------
-- 1) RLS 활성화
-- -----------------------------------------------------
ALTER TABLE public.account_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_rights ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- 2) account_entities 정책
-- -----------------------------------------------------
DROP POLICY IF EXISTS sel_authenticated ON public.account_entities;
DROP POLICY IF EXISTS ins_admin_finance ON public.account_entities;
DROP POLICY IF EXISTS upd_admin_finance ON public.account_entities;
DROP POLICY IF EXISTS del_admin_finance ON public.account_entities;

CREATE POLICY sel_authenticated
ON public.account_entities
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY ins_admin_finance
ON public.account_entities
FOR INSERT
TO authenticated
WITH CHECK (public.current_app_role() IN ('admin', 'finance_manager'));

CREATE POLICY upd_admin_finance
ON public.account_entities
FOR UPDATE
TO authenticated
USING (public.current_app_role() IN ('admin', 'finance_manager'))
WITH CHECK (public.current_app_role() IN ('admin', 'finance_manager'));

CREATE POLICY del_admin_finance
ON public.account_entities
FOR DELETE
TO authenticated
USING (public.current_app_role() IN ('admin', 'finance_manager'));

-- -----------------------------------------------------
-- 3) membership_roles 정책
-- -----------------------------------------------------
DROP POLICY IF EXISTS sel_authenticated ON public.membership_roles;
DROP POLICY IF EXISTS ins_admin_finance ON public.membership_roles;
DROP POLICY IF EXISTS upd_admin_finance ON public.membership_roles;
DROP POLICY IF EXISTS del_admin_finance ON public.membership_roles;

CREATE POLICY sel_authenticated
ON public.membership_roles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY ins_admin_finance
ON public.membership_roles
FOR INSERT
TO authenticated
WITH CHECK (public.current_app_role() IN ('admin', 'finance_manager'));

CREATE POLICY upd_admin_finance
ON public.membership_roles
FOR UPDATE
TO authenticated
USING (public.current_app_role() IN ('admin', 'finance_manager'))
WITH CHECK (public.current_app_role() IN ('admin', 'finance_manager'));

CREATE POLICY del_admin_finance
ON public.membership_roles
FOR DELETE
TO authenticated
USING (public.current_app_role() IN ('admin', 'finance_manager'));

-- -----------------------------------------------------
-- 4) asset_rights 정책
-- -----------------------------------------------------
DROP POLICY IF EXISTS sel_authenticated ON public.asset_rights;
DROP POLICY IF EXISTS ins_admin_finance ON public.asset_rights;
DROP POLICY IF EXISTS upd_admin_finance ON public.asset_rights;
DROP POLICY IF EXISTS del_admin_finance ON public.asset_rights;

CREATE POLICY sel_authenticated
ON public.asset_rights
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY ins_admin_finance
ON public.asset_rights
FOR INSERT
TO authenticated
WITH CHECK (public.current_app_role() IN ('admin', 'finance_manager'));

CREATE POLICY upd_admin_finance
ON public.asset_rights
FOR UPDATE
TO authenticated
USING (public.current_app_role() IN ('admin', 'finance_manager'))
WITH CHECK (public.current_app_role() IN ('admin', 'finance_manager'));

CREATE POLICY del_admin_finance
ON public.asset_rights
FOR DELETE
TO authenticated
USING (public.current_app_role() IN ('admin', 'finance_manager'));
