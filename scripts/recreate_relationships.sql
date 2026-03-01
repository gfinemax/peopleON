-- 대리인 관계 테이블 생성
CREATE TABLE IF NOT EXISTS public.entity_relationships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    to_entity_id uuid NOT NULL REFERENCES public.account_entities(id) ON DELETE CASCADE,
    from_entity_id uuid NOT NULL REFERENCES public.account_entities(id) ON DELETE CASCADE,
    relation_type text NOT NULL DEFAULT 'agent',
    relation_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (to_entity_id, from_entity_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_entity_relationships_to ON public.entity_relationships(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_from ON public.entity_relationships(from_entity_id);

COMMENT ON TABLE public.entity_relationships IS '인물 간의 관계 (예: 조합원-대리인)';
