-- =====================================================
-- peopleON Settlement Core Migration - Phase 2
-- 대상: 매몰비용/정산/환불/재분류/보고뷰
-- 전제: scripts/settlement_core_phase1.sql 선실행
-- =====================================================

-- -----------------------------------------------------
-- 1. 매몰비용(손실) / Liability Pool
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
    allocation_basis text NOT NULL,
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
-- 2. 정산 정책/정산 케이스/지급
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

-- -----------------------------------------------------
-- 3. 회계사 검토용 일괄 재분류
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

-- -----------------------------------------------------
-- 4. 보고 뷰
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

