-- =====================================================
-- peopleON Core Settlement / Ledger Schema (Draft v1)
-- 목적:
-- 1) 입금원장을 append-only로 관리
-- 2) 자금 성격(fund_nature) 분류와 증빙검증 자동화
-- 3) 권리증/환불/프리미엄/매몰비용 정산을 버전정책으로 추적
-- 4) 일괄 재분류 및 감사로그 지원
-- =====================================================

-- 권장: Supabase SQL Editor 또는 psql에서 순차 실행
-- 주의: 운영 DB 적용 전 스테이징에서 검증 필요

-- -----------------------------------------------------
-- 0. 공통 타입
-- -----------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fund_nature') THEN
        CREATE TYPE fund_nature AS ENUM (
            'provisional',  -- 임시(분류 대기)
            'capital',      -- 출자금(자본성)
            'debt',         -- 차입금
            'suspense',     -- 예수금/미확정
            'prepayment'    -- 선수금/권리증 관련
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'party_role_type') THEN
        CREATE TYPE party_role_type AS ENUM (
            'member',
            'certificate_holder',
            'related_party',
            'refund_applicant'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type') THEN
        CREATE TYPE document_type AS ENUM (
            'member_subscription_contract',
            'rights_certificate',
            'deposit_confirmation_notarized',
            'loan_contract',
            'bank_transfer_receipt',
            'id_document',
            'other'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_category') THEN
        CREATE TYPE account_category AS ENUM (
            'union',
            'trustee',
            'construction',
            'real_estate',
            'other'
        );
    END IF;
END $$;

-- -----------------------------------------------------
-- 1. 인물/관계/권리증
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS party_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id uuid UNIQUE REFERENCES members(id) ON DELETE SET NULL,
    display_name text NOT NULL,
    phone text,
    resident_id_hash text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_party_profiles_name ON party_profiles(display_name);
CREATE INDEX IF NOT EXISTS idx_party_profiles_phone ON party_profiles(phone);

CREATE TABLE IF NOT EXISTS party_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid NOT NULL REFERENCES party_profiles(id) ON DELETE CASCADE,
    role_type party_role_type NOT NULL,
    role_status text NOT NULL DEFAULT 'active',
    source text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (party_id, role_type, role_status)
);

CREATE INDEX IF NOT EXISTS idx_party_roles_party ON party_roles(party_id);

CREATE TABLE IF NOT EXISTS party_relationships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_party_id uuid NOT NULL REFERENCES party_profiles(id) ON DELETE CASCADE,
    to_party_id uuid NOT NULL REFERENCES party_profiles(id) ON DELETE CASCADE,
    relation_type text NOT NULL, -- spouse, proxy, heir, joint_investor 등
    relation_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (from_party_id <> to_party_id)
);

CREATE INDEX IF NOT EXISTS idx_party_relationships_from ON party_relationships(from_party_id);
CREATE INDEX IF NOT EXISTS idx_party_relationships_to ON party_relationships(to_party_id);

CREATE TABLE IF NOT EXISTS right_certificates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    certificate_number text NOT NULL UNIQUE,
    issuer text NOT NULL DEFAULT '동일건설',
    holder_party_id uuid NOT NULL REFERENCES party_profiles(id) ON DELETE RESTRICT,
    base_refund_amount numeric(18,2) NOT NULL DEFAULT 30000000,
    market_reference_price numeric(18,2),
    recognized_premium numeric(18,2),
    issue_date date,
    status text NOT NULL DEFAULT 'active', -- active, merged, redeemed, cancelled
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_right_certificates_holder ON right_certificates(holder_party_id);
CREATE INDEX IF NOT EXISTS idx_right_certificates_status ON right_certificates(status);

CREATE TABLE IF NOT EXISTS certificate_merge_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    target_certificate_id uuid NOT NULL REFERENCES right_certificates(id) ON DELETE RESTRICT,
    source_certificate_id uuid NOT NULL REFERENCES right_certificates(id) ON DELETE RESTRICT,
    merged_reason text,
    merged_by text,
    merged_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (target_certificate_id, source_certificate_id),
    CHECK (target_certificate_id <> source_certificate_id)
);

-- -----------------------------------------------------
-- 2. 계좌/원장/증빙
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS financial_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name text NOT NULL,
    account_category account_category NOT NULL,
    owner_name text,
    bank_name text,
    account_number_masked text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_accounts_category ON financial_accounts(account_category);

CREATE TABLE IF NOT EXISTS ledger_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tx_date date NOT NULL,
    amount numeric(18,2) NOT NULL CHECK (amount > 0),
    direction text NOT NULL CHECK (direction IN ('inflow', 'outflow')),
    source_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
    destination_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
    counterparty_name text,
    counterparty_phone text,
    raw_reference text,
    narrative text,
    evidence_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    capture_status text NOT NULL DEFAULT 'captured' CHECK (capture_status IN ('captured', 'matched', 'cancelled')),
    captured_by text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ledger_transactions_date ON ledger_transactions(tx_date);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_capture_status ON ledger_transactions(capture_status);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_reference ON ledger_transactions(raw_reference);

CREATE TABLE IF NOT EXISTS transaction_party_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
    party_id uuid NOT NULL REFERENCES party_profiles(id) ON DELETE RESTRICT,
    link_role text NOT NULL, -- payer, beneficiary, related_party
    linked_amount numeric(18,2),
    confidence numeric(5,2) CHECK (confidence BETWEEN 0 AND 100),
    linked_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (transaction_id, party_id, link_role)
);

CREATE INDEX IF NOT EXISTS idx_tx_party_links_transaction ON transaction_party_links(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_party_links_party ON transaction_party_links(party_id);

CREATE TABLE IF NOT EXISTS transaction_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
    document_type document_type NOT NULL,
    file_url text NOT NULL,
    issued_at date,
    uploaded_by text,
    verify_status text NOT NULL DEFAULT 'pending' CHECK (verify_status IN ('pending', 'verified', 'rejected')),
    verified_by text,
    verified_at timestamptz,
    verify_note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_documents_transaction ON transaction_documents(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_documents_status ON transaction_documents(verify_status);

-- -----------------------------------------------------
-- 3. 분류 정책/분류 이력/증빙 요구사항
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS fund_classification_policies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_code text NOT NULL,
    version integer NOT NULL CHECK (version > 0),
    name text NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    is_default boolean NOT NULL DEFAULT false,
    rule_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (policy_code, version)
);

CREATE INDEX IF NOT EXISTS idx_fund_policies_effective ON fund_classification_policies(effective_from, effective_to);

CREATE TABLE IF NOT EXISTS fund_nature_required_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id uuid NOT NULL REFERENCES fund_classification_policies(id) ON DELETE CASCADE,
    fund_nature fund_nature NOT NULL,
    document_type document_type NOT NULL,
    is_required boolean NOT NULL DEFAULT true,
    notes text,
    UNIQUE (policy_id, fund_nature, document_type)
);

CREATE TABLE IF NOT EXISTS transaction_classification_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id uuid NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
    policy_id uuid REFERENCES fund_classification_policies(id) ON DELETE SET NULL,
    fund_nature fund_nature NOT NULL,
    classification_status text NOT NULL DEFAULT 'proposed' CHECK (classification_status IN ('proposed', 'approved', 'rejected')),
    confidence numeric(5,2) CHECK (confidence BETWEEN 0 AND 100),
    reason text NOT NULL,
    reviewer text,
    reviewed_at timestamptz,
    is_current boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tx_class_events_tx ON transaction_classification_events(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tx_class_events_current ON transaction_classification_events(transaction_id, is_current);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_single_current_class
ON transaction_classification_events(transaction_id)
WHERE is_current = true;

-- current 이벤트를 넣으면 이전 current를 자동 해제
CREATE OR REPLACE FUNCTION enforce_single_current_classification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_current THEN
        UPDATE transaction_classification_events
           SET is_current = false
         WHERE transaction_id = NEW.transaction_id
           AND is_current = true;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_single_current_classification ON transaction_classification_events;
CREATE TRIGGER trg_enforce_single_current_classification
BEFORE INSERT ON transaction_classification_events
FOR EACH ROW EXECUTE FUNCTION enforce_single_current_classification();

-- -----------------------------------------------------
-- 4. 매몰비용(손실) / Liability Pool
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS loss_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loss_name text NOT NULL,
    event_date date NOT NULL,
    total_loss_amount numeric(18,2) NOT NULL CHECK (total_loss_amount >= 0),
    description text,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'applied', 'closed')),
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loss_allocations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loss_event_id uuid NOT NULL REFERENCES loss_events(id) ON DELETE CASCADE,
    party_id uuid REFERENCES party_profiles(id) ON DELETE SET NULL,
    certificate_id uuid REFERENCES right_certificates(id) ON DELETE SET NULL,
    allocation_basis text NOT NULL, -- ratio, fixed, manual 등
    allocated_amount numeric(18,2) NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loss_allocations_event ON loss_allocations(loss_event_id);
CREATE INDEX IF NOT EXISTS idx_loss_allocations_party ON loss_allocations(party_id);

CREATE TABLE IF NOT EXISTS liability_pool_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid NOT NULL REFERENCES party_profiles(id) ON DELETE RESTRICT,
    certificate_id uuid REFERENCES right_certificates(id) ON DELETE SET NULL,
    origin_transaction_id uuid REFERENCES ledger_transactions(id) ON DELETE SET NULL,
    liability_amount numeric(18,2) NOT NULL CHECK (liability_amount >= 0),
    pool_status text NOT NULL DEFAULT 'pending' CHECK (pool_status IN ('pending', 'refundable', 'paid', 'excluded')),
    recognized_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz,
    note text
);

CREATE INDEX IF NOT EXISTS idx_liability_pool_status ON liability_pool_entries(pool_status);
CREATE INDEX IF NOT EXISTS idx_liability_pool_party ON liability_pool_entries(party_id);

-- -----------------------------------------------------
-- 5. 정산 정책/정산 케이스/지급
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS settlement_policy_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_code text NOT NULL,
    version integer NOT NULL CHECK (version > 0),
    effective_from date NOT NULL,
    effective_to date,
    rules_json jsonb NOT NULL,
    approved_by text,
    approved_at timestamptz,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (policy_code, version)
);

CREATE TABLE IF NOT EXISTS settlement_cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    party_id uuid NOT NULL REFERENCES party_profiles(id) ON DELETE RESTRICT,
    policy_version_id uuid NOT NULL REFERENCES settlement_policy_versions(id) ON DELETE RESTRICT,
    case_status text NOT NULL DEFAULT 'draft' CHECK (case_status IN ('draft', 'review', 'approved', 'paid', 'rejected')),
    created_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlement_cases_party ON settlement_cases(party_id);
CREATE INDEX IF NOT EXISTS idx_settlement_cases_status ON settlement_cases(case_status);

CREATE TABLE IF NOT EXISTS settlement_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES settlement_cases(id) ON DELETE CASCADE,
    line_type text NOT NULL CHECK (
        line_type IN (
            'capital',
            'debt',
            'loss',
            'certificate_base_refund',
            'premium_recognition',
            'already_paid',
            'adjustment',
            'final_refund'
        )
    ),
    source_type text NOT NULL CHECK (source_type IN ('transaction', 'certificate', 'loss_event', 'manual', 'system')),
    source_id uuid,
    amount numeric(18,2) NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlement_lines_case ON settlement_lines(case_id);
CREATE INDEX IF NOT EXISTS idx_settlement_lines_type ON settlement_lines(line_type);

CREATE TABLE IF NOT EXISTS settlement_approvals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES settlement_cases(id) ON DELETE CASCADE,
    step_order integer NOT NULL,
    required_role text NOT NULL,
    decision text NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'approved', 'rejected')),
    decided_by text,
    decided_at timestamptz,
    comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (case_id, step_order)
);

CREATE TABLE IF NOT EXISTS refund_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES settlement_cases(id) ON DELETE RESTRICT,
    payment_account_id uuid REFERENCES financial_accounts(id) ON DELETE SET NULL,
    paid_amount numeric(18,2) NOT NULL CHECK (paid_amount >= 0),
    paid_date date,
    payment_reference text,
    receiver_name text,
    payment_status text NOT NULL DEFAULT 'requested' CHECK (payment_status IN ('requested', 'paid', 'failed', 'cancelled')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_payments_case ON refund_payments(case_id);
CREATE INDEX IF NOT EXISTS idx_refund_payments_status ON refund_payments(payment_status);

-- -----------------------------------------------------
-- 6. 회계사 검토용 일괄 재분류
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS batch_reclassification_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by text NOT NULL,
    requested_at timestamptz NOT NULL DEFAULT now(),
    reason text NOT NULL,
    target_fund_nature fund_nature NOT NULL,
    attachment_url text,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'applied', 'rejected')),
    approved_by text,
    approved_at timestamptz
);

CREATE TABLE IF NOT EXISTS batch_reclassification_lines (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id uuid NOT NULL REFERENCES batch_reclassification_jobs(id) ON DELETE CASCADE,
    transaction_id uuid NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
    from_fund_nature fund_nature NOT NULL,
    to_fund_nature fund_nature NOT NULL,
    line_status text NOT NULL DEFAULT 'pending' CHECK (line_status IN ('pending', 'applied', 'skipped', 'failed')),
    line_reason text,
    applied_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_batch_reclass_lines_job ON batch_reclassification_lines(job_id);
CREATE INDEX IF NOT EXISTS idx_batch_reclass_lines_tx ON batch_reclassification_lines(transaction_id);

-- -----------------------------------------------------
-- 7. 감사로그
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id bigserial PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id uuid,
    action text NOT NULL, -- create, classify, approve, reclassify, pay, merge 등
    actor text NOT NULL,
    reason text,
    before_data jsonb,
    after_data jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- -----------------------------------------------------
-- 8. Append-only 보호 (원장 테이블)
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_update_delete_on_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Append-only table: % operation is not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_transactions_no_update ON ledger_transactions;
CREATE TRIGGER trg_ledger_transactions_no_update
BEFORE UPDATE OR DELETE ON ledger_transactions
FOR EACH ROW EXECUTE FUNCTION prevent_update_delete_on_append_only();

-- -----------------------------------------------------
-- 9. 보고용 뷰
-- -----------------------------------------------------
CREATE OR REPLACE VIEW v_current_fund_classification AS
SELECT
    tce.transaction_id,
    tce.fund_nature,
    tce.classification_status,
    tce.confidence,
    tce.reviewer,
    tce.reviewed_at
FROM transaction_classification_events tce
WHERE tce.is_current = true;

CREATE OR REPLACE VIEW v_fund_nature_balance AS
SELECT
    v.fund_nature,
    SUM(
        CASE
            WHEN lt.direction = 'inflow' THEN lt.amount
            WHEN lt.direction = 'outflow' THEN -lt.amount
            ELSE 0
        END
    ) AS net_amount
FROM ledger_transactions lt
JOIN v_current_fund_classification v ON v.transaction_id = lt.id
GROUP BY v.fund_nature;

CREATE OR REPLACE VIEW v_liability_pool_summary AS
SELECT
    lpe.pool_status,
    COUNT(*) AS item_count,
    COALESCE(SUM(lpe.liability_amount), 0) AS total_amount
FROM liability_pool_entries lpe
GROUP BY lpe.pool_status;

