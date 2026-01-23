-- Upsert를 위한 Unique Index 추가
-- original_name 컬럼에 대해 유니크 인덱스 생성
CREATE UNIQUE INDEX IF NOT EXISTS idx_legacy_records_original_name_unique ON legacy_records(original_name);
