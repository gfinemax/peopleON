-- =============================================================
-- 납부 및 분담금 관리 시스템 DB 테이블
-- =============================================================

-- 1. 입주평형 기준 테이블
CREATE TABLE IF NOT EXISTS unit_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,                          -- 예: "59㎡ A타입"
    area_sqm NUMERIC NOT NULL,                   -- 면적(㎡): 59, 74, 84
    total_contribution NUMERIC NOT NULL DEFAULT 0,  -- 총 분담금
    first_sale_price NUMERIC NOT NULL DEFAULT 0,    -- 1차 분양가
    second_sale_price NUMERIC NOT NULL DEFAULT 0,   -- 2차 분양가
    general_sale_price NUMERIC NOT NULL DEFAULT 0,  -- 일반분양가
    certificate_amount NUMERIC NOT NULL DEFAULT 30000000,  -- 필증 기준액
    contract_amount NUMERIC NOT NULL DEFAULT 20000000,     -- 계약금
    installment_1_amount NUMERIC NOT NULL DEFAULT 50000000, -- 1차 분담금
    installment_2_amount NUMERIC NOT NULL DEFAULT 60000000, -- 2차 분담금
    balance_amount NUMERIC NOT NULL DEFAULT 0,              -- 잔금
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 입금 계좌 관리 테이블
CREATE TABLE IF NOT EXISTS deposit_accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_name TEXT NOT NULL,                   -- 예: "조합 주거래계좌"
    bank_name TEXT,                               -- 은행명
    account_number TEXT,                          -- 계좌번호
    account_type TEXT NOT NULL DEFAULT 'union'    -- union | trust | external | recognized
        CHECK (account_type IN ('union', 'trust', 'external', 'recognized')),
    is_official BOOLEAN NOT NULL DEFAULT false,   -- 공식 분담금 계좌 여부
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 개인별 납부 내역 테이블
CREATE TABLE IF NOT EXISTS member_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_id UUID NOT NULL REFERENCES account_entities(id) ON DELETE CASCADE,
    unit_type_id UUID REFERENCES unit_types(id),
    payment_type TEXT NOT NULL DEFAULT 'other'
        CHECK (payment_type IN (
            'certificate',           -- 출자금/필증
            'premium',               -- 프리미엄 (분담금 제외)
            'premium_recognized',    -- 인정분 프리미엄 → 출자금 반영
            'contract',              -- 계약금
            'installment_1',         -- 1차 분담금
            'installment_2',         -- 2차 분담금
            'balance',               -- 잔금
            'other'                  -- 기타
        )),
    amount_due NUMERIC NOT NULL DEFAULT 0,         -- 청구액
    amount_paid NUMERIC NOT NULL DEFAULT 0,        -- 수납액
    deposit_account_id UUID REFERENCES deposit_accounts(id),
    paid_date DATE,                                -- 납부일
    receipt_note TEXT,                              -- 적요/메모
    is_contribution BOOLEAN NOT NULL DEFAULT true,  -- 분담금 산입 여부
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
    sort_order INT NOT NULL DEFAULT 0,              -- 표시 순서
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_member_payments_entity ON member_payments(entity_id);
CREATE INDEX IF NOT EXISTS idx_member_payments_type ON member_payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_member_payments_unit ON member_payments(unit_type_id);
CREATE INDEX IF NOT EXISTS idx_member_payments_account ON member_payments(deposit_account_id);

-- 4. asset_rights에 premium_amount 컬럼 추가
ALTER TABLE asset_rights ADD COLUMN IF NOT EXISTS premium_amount NUMERIC DEFAULT 0;

-- 5. RLS 정책
ALTER TABLE unit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read unit_types"
    ON unit_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all unit_types"
    ON unit_types FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read deposit_accounts"
    ON deposit_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all deposit_accounts"
    ON deposit_accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read member_payments"
    ON member_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated all member_payments"
    ON member_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE unit_types ADD COLUMN IF NOT EXISTS first_sale_price NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE unit_types ADD COLUMN IF NOT EXISTS second_sale_price NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE unit_types ADD COLUMN IF NOT EXISTS general_sale_price NUMERIC NOT NULL DEFAULT 0;

UPDATE unit_types
SET
    first_sale_price = CASE WHEN coalesce(first_sale_price, 0) = 0 THEN total_contribution ELSE first_sale_price END,
    second_sale_price = CASE WHEN coalesce(second_sale_price, 0) = 0 THEN total_contribution ELSE second_sale_price END,
    general_sale_price = CASE WHEN coalesce(general_sale_price, 0) = 0 THEN total_contribution ELSE general_sale_price END;

-- 6. 기본 평형 데이터 시드
INSERT INTO unit_types (name, area_sqm, total_contribution, first_sale_price, second_sale_price, general_sale_price, certificate_amount, contract_amount, installment_1_amount, installment_2_amount, balance_amount)
VALUES
    ('59 Type', 59, 750000000, 750000000, 1000000000, 1100000000, 30000000, 20000000, 50000000, 60000000, 0),
    ('73 Type', 73, 925000000, 925000000, 1325000000, 1475000000, 30000000, 20000000, 50000000, 60000000, 20000000),
    ('84 Type', 84, 999000000, 999000000, 1399000000, 1549000000, 30000000, 20000000, 50000000, 60000000, 40000000)
ON CONFLICT DO NOTHING;

-- 7. 기본 계좌 데이터 시드
INSERT INTO deposit_accounts (account_name, bank_name, account_type, is_official)
VALUES
    ('조합 주거래계좌', '국민은행', 'union', true),
    ('신탁계좌 1', '한국토지신탁', 'trust', true),
    ('신탁계좌 2', '코리아신탁', 'trust', true),
    ('전 조합장 계좌', '우리은행', 'external', false),
    ('기타 인정 계좌 1', '신한은행', 'recognized', false),
    ('기타 인정 계좌 2', '하나은행', 'recognized', false)
ON CONFLICT DO NOTHING;
