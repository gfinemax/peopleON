-- =====================================================
-- 인물 간 관계 관리를 위한 테이블 생성
-- =====================================================

CREATE TABLE IF NOT EXISTS public.entity_relationships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_entity_id uuid NOT NULL REFERENCES public.account_entities(id) ON DELETE CASCADE,
    to_entity_id uuid NOT NULL REFERENCES public.account_entities(id) ON DELETE CASCADE,
    relation_type text NOT NULL,        -- 'agent'(대리인), 'spouse'(배우자), 'family'(가족) 등
    relation_note text,                 -- 상세 메모 (예: "남편", "친구")
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CHECK (from_entity_id <> to_entity_id)
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_entity_relationships_from ON public.entity_relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_to ON public.entity_relationships(to_entity_id);

-- 유니크 제약 (동일한 관계 중복 방지)
ALTER TABLE public.entity_relationships 
    ADD CONSTRAINT unique_entity_relation 
    UNIQUE (from_entity_id, to_entity_id, relation_type);
