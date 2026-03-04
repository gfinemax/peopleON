-- asset_rights 테이블에 권리증 취득 정보 컬럼 추가
-- 엑셀(권리증(프로그램용).xlsx)의 필증성명, 필증날짜, 가격, 구입부동산 매핑

ALTER TABLE asset_rights ADD COLUMN IF NOT EXISTS holder_name TEXT;
ALTER TABLE asset_rights ADD COLUMN IF NOT EXISTS issued_date DATE;
ALTER TABLE asset_rights ADD COLUMN IF NOT EXISTS price_text TEXT;
ALTER TABLE asset_rights ADD COLUMN IF NOT EXISTS certificate_price NUMERIC DEFAULT 0;
ALTER TABLE asset_rights ADD COLUMN IF NOT EXISTS premium_price NUMERIC DEFAULT 0;
ALTER TABLE asset_rights ADD COLUMN IF NOT EXISTS broker_fee NUMERIC DEFAULT 0;
ALTER TABLE asset_rights ADD COLUMN IF NOT EXISTS acquisition_source TEXT;
