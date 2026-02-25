-- =====================================================
-- peopleON Settlement Seed (Policy / Rule baseline)
-- 전제:
-- 1) settlement_core_phase1.sql + phase2.sql 선실행
-- 2) docs/settlement-policy.example.json 기준값 반영
-- =====================================================

-- -----------------------------------------------------
-- 1. 분류 정책 (fund_classification_policies)
-- -----------------------------------------------------
WITH upsert_policy AS (
    INSERT INTO fund_classification_policies (
        policy_code,
        version,
        name,
        effective_from,
        effective_to,
        is_default,
        rule_json,
        created_by
    )
    VALUES (
        'FUND_NATURE_BASELINE',
        1,
        'Fund Nature Baseline Rule',
        DATE '2026-01-01',
        NULL,
        true,
        '{
          "rules": [
            {
              "name": "조합/신탁 입금은 기본 출자금",
              "priority": 10,
              "fund_nature": "capital",
              "conditions": [
                {"field":"destination_account_category","operator":"in","value":["union","trustee"]},
                {"field":"has_subscription_contract","operator":"eq","value":true}
              ],
              "required_documents": ["member_subscription_contract","bank_transfer_receipt"],
              "default_action": "classify"
            },
            {
              "name": "차입금 분류",
              "priority": 20,
              "fund_nature": "debt",
              "conditions": [
                {"field":"has_loan_contract","operator":"eq","value":true}
              ],
              "required_documents": ["loan_contract","bank_transfer_receipt"],
              "default_action": "classify"
            },
            {
              "name": "비정상/불명확 입금",
              "priority": 999,
              "fund_nature": "suspense",
              "conditions": [
                {"field":"is_abnormal_deposit","operator":"eq","value":true}
              ],
              "required_documents": ["bank_transfer_receipt"],
              "default_action": "manual_review"
            }
          ]
        }'::jsonb,
        'system_seed'
    )
    ON CONFLICT (policy_code, version)
    DO UPDATE SET
        name = EXCLUDED.name,
        effective_from = EXCLUDED.effective_from,
        effective_to = EXCLUDED.effective_to,
        is_default = EXCLUDED.is_default,
        rule_json = EXCLUDED.rule_json
    RETURNING id
)
SELECT id FROM upsert_policy;

-- 동일 policy_code의 다른 버전 default 해제
UPDATE fund_classification_policies
   SET is_default = false
 WHERE policy_code = 'FUND_NATURE_BASELINE'
   AND version <> 1
   AND is_default = true;

-- -----------------------------------------------------
-- 2. 분류별 필수 증빙
-- -----------------------------------------------------
WITH p AS (
    SELECT id
    FROM fund_classification_policies
    WHERE policy_code = 'FUND_NATURE_BASELINE'
      AND version = 1
)
INSERT INTO fund_nature_required_documents (policy_id, fund_nature, document_type, is_required, notes)
SELECT p.id, x.fund_nature::fund_nature, x.document_type::document_type, true, x.notes
FROM p
CROSS JOIN (
    VALUES
        ('capital', 'member_subscription_contract', '출자금 분류 필수'),
        ('capital', 'bank_transfer_receipt', '출자금 분류 필수'),
        ('debt', 'loan_contract', '차입금 분류 필수'),
        ('debt', 'bank_transfer_receipt', '차입금 분류 필수'),
        ('prepayment', 'rights_certificate', '권리증 선수금 분류 시 필요'),
        ('prepayment', 'deposit_confirmation_notarized', '권리증 공증 입금 확인서'),
        ('suspense', 'bank_transfer_receipt', '예수금 검토 기본증빙')
) AS x(fund_nature, document_type, notes)
ON CONFLICT (policy_id, fund_nature, document_type)
DO UPDATE SET
    is_required = EXCLUDED.is_required,
    notes = EXCLUDED.notes;

-- -----------------------------------------------------
-- 3. 정산 정책 (settlement_policy_versions)
-- -----------------------------------------------------
INSERT INTO settlement_policy_versions (
    policy_code,
    version,
    effective_from,
    effective_to,
    rules_json,
    approved_by,
    approved_at,
    is_default
)
VALUES (
    'REFUND_2026_BASELINE',
    1,
    DATE '2026-01-01',
    NULL,
    '{
      "policy_id": "REFUND_2026_BASELINE",
      "version": 1,
      "description": "출자금/차입금/권리증환불 및 프리미엄 인정 기준",
      "effective_from": "2026-01-01",
      "effective_to": null,
      "fund_nature_rules": [
        {
          "name": "조합/신탁 입금은 기본 출자금",
          "priority": 10,
          "fund_nature": "capital",
          "conditions": [
            {"field":"destination_account_category","operator":"in","value":["union","trustee"]},
            {"field":"has_subscription_contract","operator":"eq","value":true}
          ],
          "required_documents": ["member_subscription_contract","bank_transfer_receipt"],
          "default_action": "classify"
        },
        {
          "name": "차입금 분류",
          "priority": 20,
          "fund_nature": "debt",
          "conditions": [
            {"field":"has_loan_contract","operator":"eq","value":true}
          ],
          "required_documents": ["loan_contract","bank_transfer_receipt"],
          "default_action": "classify"
        },
        {
          "name": "비정상/불명확 입금",
          "priority": 999,
          "fund_nature": "suspense",
          "conditions": [
            {"field":"is_abnormal_deposit","operator":"eq","value":true}
          ],
          "required_documents": ["bank_transfer_receipt"],
          "default_action": "manual_review"
        }
      ],
      "certificate_refund": {
        "base_amount": 30000000,
        "currency": "KRW",
        "eligibility_roles": ["certificate_holder", "refund_applicant"],
        "include_real_estate_payments": true,
        "liability_pool_code": "RIGHTS_30M_POOL"
      },
      "premium_policy": {
        "enabled": true,
        "decision_mode": "manual",
        "minimum": 20000000,
        "maximum": 30000000,
        "rules": []
      },
      "loss_policy": {
        "recognition_mode": "ratio",
        "allocation_basis": "capital_ratio",
        "cap_percentage": 100,
        "allow_negative_refund": false
      },
      "allocation_policy": {
        "partial_allocation": true,
        "priority_order": ["capital", "prepayment", "debt", "suspense"],
        "unmatched_treatment": "manual_review"
      },
      "approval_policy": {
        "steps": [
          {"step_order":1,"step_name":"담당자 검토","required_role":"ops_manager","need_comment":true},
          {"step_order":2,"step_name":"재무 승인","required_role":"finance_manager","need_comment":true}
        ]
      },
      "reclassification_policy": {
        "allow_batch": true,
        "require_reason": true,
        "require_audit_attachment": true
      }
    }'::jsonb,
    'system_seed',
    now(),
    true
)
ON CONFLICT (policy_code, version)
DO UPDATE SET
    effective_from = EXCLUDED.effective_from,
    effective_to = EXCLUDED.effective_to,
    rules_json = EXCLUDED.rules_json,
    is_default = EXCLUDED.is_default;

UPDATE settlement_policy_versions
   SET is_default = false
 WHERE policy_code = 'REFUND_2026_BASELINE'
   AND version <> 1
   AND is_default = true;
