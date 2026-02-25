-- =====================================================
-- peopleON Settlement Case Builder Function
-- 전제:
-- - settlement_core_phase1.sql + phase2.sql 적용 완료
-- 목적:
-- - party_id 기준으로 정산 케이스/라인 자동 생성
-- - 정책 버전 선택(기본: default policy)
-- - draft/review/approved 케이스 중복 생성 방지(옵션으로 무시 가능)
-- =====================================================

CREATE OR REPLACE FUNCTION create_settlement_case(
    p_party_id uuid,
    p_policy_code text DEFAULT NULL,
    p_policy_version integer DEFAULT NULL,
    p_created_by text DEFAULT NULL,
    p_force_new boolean DEFAULT false
)
RETURNS TABLE (
    case_id uuid,
    policy_version_id uuid,
    final_refund numeric
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_policy_id uuid;
    v_case_id uuid;
    v_existing_case_id uuid;

    v_capital numeric(18,2) := 0;
    v_debt numeric(18,2) := 0;
    v_loss numeric(18,2) := 0;
    v_cert_base numeric(18,2) := 0;
    v_premium numeric(18,2) := 0;
    v_already_paid numeric(18,2) := 0;
    v_final_raw numeric(18,2) := 0;
    v_final numeric(18,2) := 0;
BEGIN
    IF p_party_id IS NULL THEN
        RAISE EXCEPTION 'p_party_id is required';
    END IF;

    -- 정책 버전 선택: 명시된 정책/버전 우선, 없으면 default
    IF p_policy_code IS NOT NULL THEN
        SELECT spv.id
          INTO v_policy_id
          FROM settlement_policy_versions spv
         WHERE spv.policy_code = p_policy_code
           AND (p_policy_version IS NULL OR spv.version = p_policy_version)
         ORDER BY spv.version DESC
         LIMIT 1;
    ELSE
        SELECT spv.id
          INTO v_policy_id
          FROM settlement_policy_versions spv
         WHERE spv.is_default = true
         ORDER BY spv.created_at DESC
         LIMIT 1;
    END IF;

    IF v_policy_id IS NULL THEN
        RAISE EXCEPTION 'No settlement policy found (policy_code=%, version=%)', p_policy_code, p_policy_version;
    END IF;

    -- 열린 케이스 중복 방지
    IF NOT p_force_new THEN
        SELECT sc.id
          INTO v_existing_case_id
          FROM settlement_cases sc
         WHERE sc.party_id = p_party_id
           AND sc.case_status IN ('draft', 'review', 'approved')
         ORDER BY sc.created_at DESC
         LIMIT 1;

        IF v_existing_case_id IS NOT NULL THEN
            RETURN QUERY
            SELECT v_existing_case_id, v_policy_id, NULL::numeric;
            RETURN;
        END IF;
    END IF;

    INSERT INTO settlement_cases (
        party_id,
        policy_version_id,
        case_status,
        created_by
    )
    VALUES (
        p_party_id,
        v_policy_id,
        'draft',
        COALESCE(p_created_by, 'system')
    )
    RETURNING id INTO v_case_id;

    -- capital
    SELECT COALESCE(SUM(
        CASE
            WHEN lt.direction = 'inflow' THEN lt.amount
            WHEN lt.direction = 'outflow' THEN -lt.amount
            ELSE 0
        END
    ), 0)
      INTO v_capital
      FROM transaction_party_links tpl
      JOIN ledger_transactions lt ON lt.id = tpl.transaction_id
      JOIN v_current_fund_classification vcf ON vcf.transaction_id = lt.id
     WHERE tpl.party_id = p_party_id
       AND tpl.link_role = 'payer'
       AND vcf.fund_nature = 'capital';

    -- debt
    SELECT COALESCE(SUM(
        CASE
            WHEN lt.direction = 'inflow' THEN lt.amount
            WHEN lt.direction = 'outflow' THEN -lt.amount
            ELSE 0
        END
    ), 0)
      INTO v_debt
      FROM transaction_party_links tpl
      JOIN ledger_transactions lt ON lt.id = tpl.transaction_id
      JOIN v_current_fund_classification vcf ON vcf.transaction_id = lt.id
     WHERE tpl.party_id = p_party_id
       AND tpl.link_role = 'payer'
       AND vcf.fund_nature = 'debt';

    -- loss allocations (party 직접 또는 party 소유 권리증)
    SELECT COALESCE(SUM(la.allocated_amount), 0)
      INTO v_loss
      FROM loss_allocations la
      LEFT JOIN right_certificates rc ON rc.id = la.certificate_id
     WHERE la.party_id = p_party_id
        OR (la.party_id IS NULL AND rc.holder_party_id = p_party_id);

    -- certificate refund base + premium
    SELECT
        COALESCE(SUM(rc.base_refund_amount), 0),
        COALESCE(SUM(COALESCE(rc.recognized_premium, 0)), 0)
      INTO v_cert_base, v_premium
      FROM right_certificates rc
     WHERE rc.holder_party_id = p_party_id
       AND rc.status IN ('active', 'merged');

    -- already paid refunds
    SELECT COALESCE(SUM(rp.paid_amount), 0)
      INTO v_already_paid
      FROM refund_payments rp
      JOIN settlement_cases sc ON sc.id = rp.case_id
     WHERE sc.party_id = p_party_id
       AND rp.payment_status = 'paid';

    v_final_raw := v_capital + v_debt + v_cert_base + v_premium - v_loss - v_already_paid;
    v_final := GREATEST(v_final_raw, 0);

    -- line inserts
    IF v_capital <> 0 THEN
        INSERT INTO settlement_lines (case_id, line_type, source_type, source_id, amount, note)
        VALUES (v_case_id, 'capital', 'system', NULL, v_capital, 'fund_nature=capital 합산');
    END IF;

    IF v_debt <> 0 THEN
        INSERT INTO settlement_lines (case_id, line_type, source_type, source_id, amount, note)
        VALUES (v_case_id, 'debt', 'system', NULL, v_debt, 'fund_nature=debt 합산');
    END IF;

    IF v_cert_base <> 0 THEN
        INSERT INTO settlement_lines (case_id, line_type, source_type, source_id, amount, note)
        VALUES (v_case_id, 'certificate_base_refund', 'certificate', NULL, v_cert_base, '권리증 기준 환불액 합산');
    END IF;

    IF v_premium <> 0 THEN
        INSERT INTO settlement_lines (case_id, line_type, source_type, source_id, amount, note)
        VALUES (v_case_id, 'premium_recognition', 'certificate', NULL, v_premium, '인정 프리미엄 합산');
    END IF;

    IF v_loss <> 0 THEN
        INSERT INTO settlement_lines (case_id, line_type, source_type, source_id, amount, note)
        VALUES (v_case_id, 'loss', 'loss_event', NULL, -v_loss, '매몰비용 배분 차감');
    END IF;

    IF v_already_paid <> 0 THEN
        INSERT INTO settlement_lines (case_id, line_type, source_type, source_id, amount, note)
        VALUES (v_case_id, 'already_paid', 'system', NULL, -v_already_paid, '기지급 환불금 차감');
    END IF;

    INSERT INTO settlement_lines (case_id, line_type, source_type, source_id, amount, note)
    VALUES (
        v_case_id,
        'final_refund',
        'system',
        NULL,
        v_final,
        CASE
            WHEN v_final_raw < 0 THEN '최종값 음수로 계산되어 0으로 보정'
            ELSE '자동 계산 결과'
        END
    );

    -- audit log
    INSERT INTO audit_logs (
        entity_type,
        entity_id,
        action,
        actor,
        reason,
        after_data
    )
    VALUES (
        'settlement_case',
        v_case_id,
        'create',
        COALESCE(p_created_by, 'system'),
        '자동 정산 케이스 생성',
        jsonb_build_object(
            'party_id', p_party_id,
            'policy_version_id', v_policy_id,
            'capital', v_capital,
            'debt', v_debt,
            'certificate_base_refund', v_cert_base,
            'premium', v_premium,
            'loss', v_loss,
            'already_paid', v_already_paid,
            'final_refund', v_final
        )
    );

    RETURN QUERY
    SELECT v_case_id, v_policy_id, v_final;
END;
$$;

