-- =====================================================
-- peopleON Settlement Role Bootstrap (Supabase SQL Editor)
-- 목적:
-- 1) Auth 사용자(role) 메타데이터 일괄 설정
-- 2) 설정 결과 검증
-- 3) 필요 시 롤백
--
-- 사용 전:
-- - settlement_rls.sql 적용 완료
-- - 아래 target_users VALUES를 실제 이메일로 교체
-- =====================================================

-- -----------------------------------------------------
-- 0) 현재 role 상태 조회
-- -----------------------------------------------------
SELECT
    id,
    email,
    raw_app_meta_data ->> 'role' AS app_role,
    raw_user_meta_data ->> 'role' AS user_role,
    created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 200;

-- -----------------------------------------------------
-- 1) 대상 사용자 role 설정 (app_metadata.role)
-- -----------------------------------------------------
WITH target_users(email, role_value) AS (
    VALUES
        -- TODO: 실제 운영 계정으로 교체
        ('admin@example.com', 'admin'),
        ('finance@example.com', 'finance_manager')
)
UPDATE auth.users u
SET
    raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) ||
        jsonb_build_object('role', t.role_value),
    updated_at = NOW()
FROM target_users t
WHERE LOWER(u.email) = LOWER(t.email);

-- -----------------------------------------------------
-- 2) 반영 결과 검증
-- -----------------------------------------------------
WITH target_users(email) AS (
    VALUES
        ('admin@example.com'),
        ('finance@example.com')
)
SELECT
    u.id,
    u.email,
    u.raw_app_meta_data ->> 'role' AS app_role,
    u.updated_at
FROM auth.users u
JOIN target_users t
    ON LOWER(u.email) = LOWER(t.email)
ORDER BY u.email;

-- -----------------------------------------------------
-- 3) (선택) 롤백 - role 키 제거
-- -----------------------------------------------------
-- WITH target_users(email) AS (
--     VALUES
--         ('admin@example.com'),
--         ('finance@example.com')
-- )
-- UPDATE auth.users u
-- SET
--     raw_app_meta_data = COALESCE(u.raw_app_meta_data, '{}'::jsonb) - 'role',
--     updated_at = NOW()
-- FROM target_users t
-- WHERE LOWER(u.email) = LOWER(t.email);

