-- ==========================================
-- entity_relationships 테이블 생성 스크립트
-- ==========================================
CREATE TABLE IF NOT EXISTS entity_relationships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_entity_id uuid NOT NULL REFERENCES account_entities(id) ON DELETE CASCADE, -- (예: 대리인)
    to_entity_id uuid NOT NULL REFERENCES account_entities(id) ON DELETE CASCADE,   -- (예: 조합원)
    relation_type text NOT NULL DEFAULT 'agent', -- 'agent', 'family' 등
    relation_note text, -- '자녀', '배우자' 등 상세 관계
    created_at timestamptz DEFAULT now()
);

-- 인덱스 추가 (조회 성능 최적화)
CREATE INDEX IF NOT EXISTS idx_entity_rel_to ON entity_relationships(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_rel_from ON entity_relationships(from_entity_id);
