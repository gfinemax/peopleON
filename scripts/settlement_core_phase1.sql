-- =====================================================
-- peopleON Settlement Core Migration - Phase 1
-- 대상: 기초 도메인/원장/분류/감사로그
-- =====================================================
-- 실행 순서:
-- 1) 이 파일 실행
-- 2) scripts/settlement_core_phase2.sql 실행
-- 3) scripts/settlement_rls.sql 실행
-- 4) scripts/seed_settlement_policy.sql 실행

-- -----------------------------------------------------
-- 0. 공통 타입
-- -----------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fund_nature') THEN
        CREATE TYPE fund_nature AS ENUM ('provisional', 'capital', 'debt', 'suspense', 'prepayment');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'party_role_type') THEN
        CREATE TYPE party_role_type AS ENUM ('member', 'certificate_holder', 'related_party', 'refund_applicant');
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
        CREATE TYPE account_category AS ENUM ('union', 'trustee', 'construction', 'real_estate', 'other');
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
    relation_type text NOT NULL,
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
    status text NOT NULL DEFAULT 'active',
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
    link_role text NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS uq_tx_single_current_class
ON transaction_classification_events(transaction_id)
WHERE is_current = true;

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
-- 4. 감사로그 + append-only 보호
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id bigserial PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    actor text NOT NULL,
    reason text,
    before_data jsonb,
    after_data jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

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

