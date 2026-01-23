-- =====================================================
-- legacy_records 테이블 확장 스키마
-- Supabase SQL Editor에서 실행
-- =====================================================

-- 1. 기존 테이블에 새 컬럼 추가
ALTER TABLE legacy_records 
ADD COLUMN IF NOT EXISTS is_refunded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS rights_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS birth_date text,
ADD COLUMN IF NOT EXISTS investor_type text,
ADD COLUMN IF NOT EXISTS contacts jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS addresses jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS certificates jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS status_flags jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS raw_data jsonb DEFAULT '{}';

-- 2. 인덱스 추가 (검색 최적화)
CREATE INDEX IF NOT EXISTS idx_legacy_records_name ON legacy_records(legacy_name);
CREATE INDEX IF NOT EXISTS idx_legacy_records_refunded ON legacy_records(is_refunded);
CREATE INDEX IF NOT EXISTS idx_legacy_records_review ON legacy_records(needs_review);

-- 3. 확인 쿼리
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'legacy_records';
