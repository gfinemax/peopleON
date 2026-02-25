-- =====================================================
-- peopleON Sample Finance Flow Seed
-- 목적:
-- 1) 계좌/인물/권리증/원장 샘플 생성
-- 2) 분류 이벤트(proposed) 생성
-- 3) Liability Pool 샘플 생성
-- 전제:
-- - settlement_core_phase1.sql + phase2.sql 실행 완료
-- - seed_settlement_policy.sql 실행 완료
-- =====================================================

-- -----------------------------------------------------
-- 0. 샘플 계좌 (idempotent)
-- -----------------------------------------------------
INSERT INTO financial_accounts (account_name, account_category, owner_name, bank_name, account_number_masked)
SELECT v.account_name, v.account_category::account_category, v.owner_name, v.bank_name, v.account_number_masked
FROM (
    VALUES
        ('SAMPLE_조합계좌', 'union', 'OO지역주택조합', '국민은행', '111-****-0001'),
        ('SAMPLE_신탁계좌', 'trustee', 'OO신탁', '신한은행', '222-****-0002'),
        ('SAMPLE_동일건설계좌', 'construction', '동일건설', '우리은행', '333-****-0003'),
        ('SAMPLE_부동산계좌', 'real_estate', 'OO부동산', '하나은행', '444-****-0004'),
        ('SAMPLE_기타계좌', 'other', '기타수납', '농협', '555-****-0005')
) AS v(account_name, account_category, owner_name, bank_name, account_number_masked)
WHERE NOT EXISTS (
    SELECT 1
    FROM financial_accounts fa
    WHERE fa.account_name = v.account_name
      AND fa.account_category = v.account_category::account_category
);

-- -----------------------------------------------------
-- 1. 샘플 인물 (idempotent)
-- -----------------------------------------------------
INSERT INTO party_profiles (display_name, phone, notes)
SELECT v.display_name, v.phone, v.notes
FROM (
    VALUES
        ('샘플 조합원A', '010-9000-0001', '샘플 데이터'),
        ('샘플 권리자B', '010-9000-0002', '샘플 데이터'),
        ('샘플 관계인C', '010-9000-0003', '샘플 데이터')
) AS v(display_name, phone, notes)
WHERE NOT EXISTS (
    SELECT 1
    FROM party_profiles p
    WHERE p.display_name = v.display_name
      AND COALESCE(p.phone, '') = COALESCE(v.phone, '')
);

-- 역할
INSERT INTO party_roles (party_id, role_type, role_status, source)
SELECT p.id, v.role_type::party_role_type, 'active', 'sample_seed'
FROM (
    VALUES
        ('샘플 조합원A', '010-9000-0001', 'member'),
        ('샘플 조합원A', '010-9000-0001', 'refund_applicant'),
        ('샘플 권리자B', '010-9000-0002', 'certificate_holder'),
        ('샘플 관계인C', '010-9000-0003', 'related_party')
) AS v(display_name, phone, role_type)
JOIN party_profiles p
  ON p.display_name = v.display_name
 AND COALESCE(p.phone, '') = COALESCE(v.phone, '')
ON CONFLICT (party_id, role_type, role_status) DO NOTHING;

-- -----------------------------------------------------
-- 2. 샘플 권리증 (idempotent)
-- -----------------------------------------------------
INSERT INTO right_certificates (
    certificate_number,
    issuer,
    holder_party_id,
    base_refund_amount,
    market_reference_price,
    recognized_premium,
    issue_date,
    status
)
SELECT
    'SAMPLE-RC-0001',
    '동일건설',
    p.id,
    30000000,
    56000000,
    25000000,
    DATE '2025-12-15',
    'active'
FROM party_profiles p
WHERE p.display_name = '샘플 권리자B'
  AND COALESCE(p.phone, '') = '010-9000-0002'
  AND NOT EXISTS (
      SELECT 1 FROM right_certificates rc WHERE rc.certificate_number = 'SAMPLE-RC-0001'
  );

-- -----------------------------------------------------
-- 3. 샘플 원장 입금 (idempotent: raw_reference 기준)
-- -----------------------------------------------------
WITH acc AS (
    SELECT
        (SELECT id FROM financial_accounts WHERE account_name = 'SAMPLE_조합계좌' ORDER BY created_at DESC LIMIT 1) AS union_id,
        (SELECT id FROM financial_accounts WHERE account_name = 'SAMPLE_신탁계좌' ORDER BY created_at DESC LIMIT 1) AS trustee_id,
        (SELECT id FROM financial_accounts WHERE account_name = 'SAMPLE_동일건설계좌' ORDER BY created_at DESC LIMIT 1) AS construction_id,
        (SELECT id FROM financial_accounts WHERE account_name = 'SAMPLE_부동산계좌' ORDER BY created_at DESC LIMIT 1) AS real_estate_id,
        (SELECT id FROM financial_accounts WHERE account_name = 'SAMPLE_기타계좌' ORDER BY created_at DESC LIMIT 1) AS other_id
)
INSERT INTO ledger_transactions (
    tx_date,
    amount,
    direction,
    source_account_id,
    destination_account_id,
    counterparty_name,
    counterparty_phone,
    raw_reference,
    narrative,
    evidence_payload,
    capture_status,
    captured_by
)
SELECT *
FROM (
    SELECT
        DATE '2026-01-05' AS tx_date,
        30000000::numeric(18,2) AS amount,
        'inflow'::text AS direction,
        NULL::uuid AS source_account_id,
        acc.union_id AS destination_account_id,
        '샘플 조합원A'::text AS counterparty_name,
        '010-9000-0001'::text AS counterparty_phone,
        'SAMPLE-TX-UNION-3000'::text AS raw_reference,
        '조합계좌 출자금 입금 샘플'::text AS narrative,
        '{"channel":"bank_transfer"}'::jsonb AS evidence_payload,
        'captured'::text AS capture_status,
        'sample_seed'::text AS captured_by
    FROM acc
    UNION ALL
    SELECT
        DATE '2026-01-06',
        12000000::numeric(18,2),
        'inflow',
        NULL::uuid,
        acc.trustee_id,
        '샘플 조합원A',
        '010-9000-0001',
        'SAMPLE-TX-TRUST-1200',
        '신탁계좌 출자금 입금 샘플',
        '{"channel":"bank_transfer"}'::jsonb,
        'captured',
        'sample_seed'
    FROM acc
    UNION ALL
    SELECT
        DATE '2026-01-08',
        25000000::numeric(18,2),
        'inflow',
        NULL::uuid,
        acc.construction_id,
        '샘플 권리자B',
        '010-9000-0002',
        'SAMPLE-TX-CONST-2500',
        '동일건설 계좌 입금 샘플(권리증/선수금 성격)',
        '{"channel":"bank_transfer"}'::jsonb,
        'captured',
        'sample_seed'
    FROM acc
    UNION ALL
    SELECT
        DATE '2026-01-09',
        8000000::numeric(18,2),
        'inflow',
        NULL::uuid,
        acc.other_id,
        '샘플 관계인C',
        '010-9000-0003',
        'SAMPLE-TX-OTHER-0800',
        '비정상/검증대기 입금 샘플',
        '{"channel":"cash","abnormal":true}'::jsonb,
        'captured',
        'sample_seed'
    FROM acc
    UNION ALL
    SELECT
        DATE '2026-01-10',
        30000000::numeric(18,2),
        'inflow',
        NULL::uuid,
        acc.real_estate_id,
        '샘플 권리자B',
        '010-9000-0002',
        'SAMPLE-TX-REALESTATE-3000',
        '부동산 계좌 권리증 관련 입금 샘플',
        '{"channel":"bank_transfer"}'::jsonb,
        'captured',
        'sample_seed'
    FROM acc
) t
WHERE NOT EXISTS (
    SELECT 1
    FROM ledger_transactions lt
    WHERE lt.raw_reference = t.raw_reference
);

-- -----------------------------------------------------
-- 4. 거래-인물 링크 (idempotent)
-- -----------------------------------------------------
INSERT INTO transaction_party_links (
    transaction_id,
    party_id,
    link_role,
    linked_amount,
    confidence,
    linked_by
)
SELECT
    lt.id,
    p.id,
    'payer',
    lt.amount,
    95,
    'sample_seed'
FROM ledger_transactions lt
JOIN party_profiles p
  ON p.display_name = lt.counterparty_name
 AND COALESCE(p.phone, '') = COALESCE(lt.counterparty_phone, '')
WHERE lt.raw_reference LIKE 'SAMPLE-TX-%'
  AND NOT EXISTS (
      SELECT 1
      FROM transaction_party_links l
      WHERE l.transaction_id = lt.id
        AND l.party_id = p.id
        AND l.link_role = 'payer'
  );

-- -----------------------------------------------------
-- 5. 거래 증빙 (idempotent)
-- -----------------------------------------------------
INSERT INTO transaction_documents (
    transaction_id,
    document_type,
    file_url,
    issued_at,
    uploaded_by,
    verify_status
)
SELECT
    lt.id,
    'bank_transfer_receipt'::document_type,
    'https://example.com/sample/' || lt.raw_reference || '.pdf',
    lt.tx_date,
    'sample_seed',
    'verified'
FROM ledger_transactions lt
WHERE lt.raw_reference LIKE 'SAMPLE-TX-%'
  AND NOT EXISTS (
      SELECT 1
      FROM transaction_documents td
      WHERE td.transaction_id = lt.id
        AND td.document_type = 'bank_transfer_receipt'::document_type
  );

-- -----------------------------------------------------
-- 6. 분류 이벤트(proposed/approved) (idempotent)
-- -----------------------------------------------------
WITH default_policy AS (
    SELECT id
    FROM fund_classification_policies
    WHERE is_default = true
    ORDER BY created_at DESC
    LIMIT 1
),
classified AS (
    SELECT
        lt.id AS transaction_id,
        CASE
            WHEN lt.raw_reference = 'SAMPLE-TX-UNION-3000' THEN 'capital'::fund_nature
            WHEN lt.raw_reference = 'SAMPLE-TX-TRUST-1200' THEN 'capital'::fund_nature
            WHEN lt.raw_reference = 'SAMPLE-TX-CONST-2500' THEN 'prepayment'::fund_nature
            WHEN lt.raw_reference = 'SAMPLE-TX-REALESTATE-3000' THEN 'prepayment'::fund_nature
            WHEN lt.raw_reference = 'SAMPLE-TX-OTHER-0800' THEN 'suspense'::fund_nature
            ELSE 'provisional'::fund_nature
        END AS fund_nature,
        CASE
            WHEN lt.raw_reference IN ('SAMPLE-TX-UNION-3000', 'SAMPLE-TX-TRUST-1200') THEN '조합/신탁 입금 기본 출자금 분류'
            WHEN lt.raw_reference IN ('SAMPLE-TX-CONST-2500', 'SAMPLE-TX-REALESTATE-3000') THEN '권리증/부동산 관련 입금으로 선수금 분류'
            WHEN lt.raw_reference = 'SAMPLE-TX-OTHER-0800' THEN '비정상/검증대기 입금으로 예수금 분류'
            ELSE '분류 규칙 미일치'
        END AS reason,
        CASE
            WHEN lt.raw_reference = 'SAMPLE-TX-OTHER-0800' THEN 70
            ELSE 96
        END AS confidence
    FROM ledger_transactions lt
    WHERE lt.raw_reference LIKE 'SAMPLE-TX-%'
)
INSERT INTO transaction_classification_events (
    transaction_id,
    policy_id,
    fund_nature,
    classification_status,
    confidence,
    reason,
    reviewer,
    reviewed_at,
    is_current
)
SELECT
    c.transaction_id,
    dp.id,
    c.fund_nature,
    'approved',
    c.confidence,
    c.reason,
    'sample_seed',
    now(),
    true
FROM classified c
LEFT JOIN default_policy dp ON true
WHERE NOT EXISTS (
    SELECT 1
    FROM transaction_classification_events tce
    WHERE tce.transaction_id = c.transaction_id
      AND tce.is_current = true
);

-- -----------------------------------------------------
-- 7. Liability Pool 샘플 (idempotent)
-- -----------------------------------------------------
WITH target_party AS (
    SELECT id
    FROM party_profiles
    WHERE display_name = '샘플 권리자B'
      AND COALESCE(phone, '') = '010-9000-0002'
    LIMIT 1
),
target_cert AS (
    SELECT id
    FROM right_certificates
    WHERE certificate_number = 'SAMPLE-RC-0001'
    LIMIT 1
),
target_tx AS (
    SELECT id
    FROM ledger_transactions
    WHERE raw_reference = 'SAMPLE-TX-REALESTATE-3000'
    LIMIT 1
)
INSERT INTO liability_pool_entries (
    party_id,
    certificate_id,
    origin_transaction_id,
    liability_amount,
    pool_status,
    note
)
SELECT
    tp.id,
    tc.id,
    tt.id,
    30000000,
    'refundable',
    '샘플 권리증 3,000만원 환불대기'
FROM target_party tp
JOIN target_cert tc ON true
JOIN target_tx tt ON true
WHERE NOT EXISTS (
    SELECT 1
    FROM liability_pool_entries lpe
    WHERE lpe.party_id = tp.id
      AND lpe.certificate_id = tc.id
      AND lpe.origin_transaction_id = tt.id
);

-- -----------------------------------------------------
-- 8. 확인 쿼리
-- -----------------------------------------------------
SELECT 'financial_accounts' AS key, COUNT(*) AS value
FROM financial_accounts
WHERE account_name LIKE 'SAMPLE_%'
UNION ALL
SELECT 'ledger_transactions', COUNT(*)
FROM ledger_transactions
WHERE raw_reference LIKE 'SAMPLE-TX-%'
UNION ALL
SELECT 'classification_current', COUNT(*)
FROM transaction_classification_events
WHERE is_current = true
  AND transaction_id IN (
      SELECT id FROM ledger_transactions WHERE raw_reference LIKE 'SAMPLE-TX-%'
  )
UNION ALL
SELECT 'liability_pool_entries', COUNT(*)
FROM liability_pool_entries
WHERE note LIKE '샘플 권리증 3,000만원 환불대기%';

SELECT * FROM v_fund_nature_balance ORDER BY fund_nature;
SELECT * FROM v_liability_pool_summary ORDER BY pool_status;
