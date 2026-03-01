-- =====================================================
-- [MEGA FIX] 테이블 생성 확인 + RLS 해제 + 권한 부여
-- =====================================================

-- 1. 관계 테이블 먼저 생성 (혹시 안 만들어졌을 경우 대비)
CREATE TABLE IF NOT EXISTS public.entity_relationships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_entity_id uuid NOT NULL REFERENCES public.account_entities(id) ON DELETE CASCADE,
    to_entity_id uuid NOT NULL REFERENCES public.account_entities(id) ON DELETE CASCADE,
    relation_type text NOT NULL,
    relation_note text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CHECK (from_entity_id <> to_entity_id),
    UNIQUE (from_entity_id, to_entity_id, relation_type)
);

-- 2. 모든 테이블 RLS 비활성화 및 권한 부여 (안전하게 실행)
DO $$ 
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'account_entities', 'membership_roles', 'asset_rights', 
            'entity_relationships', 'interaction_logs', 'payments', 
            'settlement_cases', 'settlement_lines', 'refund_payments'
        )
    LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
        EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role', t);
    END LOOP;
END $$;

-- 3. (선택) 마이그레이션 완료 후 다시 RLS를 켜고 싶다면 아래 정책을 만드세요.
-- 현재는 개발 편의를 위해 전체 개방 상태로 둡니다.
