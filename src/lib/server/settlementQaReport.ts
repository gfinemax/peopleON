import {
    buildSettlementPartyOwnershipMap,
    type MemberLite,
    type PartyProfileLite,
    type PartyRoleLite,
    type RightCertificateLite,
} from '@/lib/settlement/partyOwnership';
import { fetchCertificateCompatRows } from '@/lib/server/certificateCompat';
import { fetchPartyRolesCompat } from '@/lib/server/partyRolesCompat';

type CaseStatus = 'draft' | 'review' | 'approved' | 'paid' | 'rejected';
type PaymentStatus = 'requested' | 'paid' | 'failed' | 'cancelled';
type Severity = 'pass' | 'warn' | 'fail';

type SettlementCaseRow = {
    id: string;
    party_id: string;
    case_status: CaseStatus;
    created_at: string;
};

type PartyProfileRow = PartyProfileLite;
type PartyRoleRow = PartyRoleLite;
type RightCertificateRow = RightCertificateLite;

type SettlementLineRow = {
    case_id: string;
    line_type: 'final_refund';
    amount: number | string;
};

type RefundPaymentRow = {
    id: string;
    case_id: string;
    paid_amount: number | string;
    payment_status: PaymentStatus;
    payment_reference: string | null;
};

export type QaCheck = {
    code: string;
    label: string;
    severity: Severity;
    count: number;
    detail: string;
    link: string | null;
};

export type QaPayload = {
    generated_at: string;
    overall: Severity;
    summary: {
        total_cases: number;
        pass_checks: number;
        warn_checks: number;
        fail_checks: number;
        issue_count: number;
    };
    checks: QaCheck[];
    audit_id?: string | null;
    audit_logged?: boolean;
    alert_logged?: boolean;
};

function parseMoney(value: number | string | null | undefined) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

export function extractSettlementQaUserRole(user: {
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
}) {
    const appRole = typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : '';
    const userRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : '';
    return (appRole || userRole || '').trim().toLowerCase();
}

export function escapeSettlementQaCsvCell(value: string | number) {
    const text = String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

export async function buildSettlementQaPayload({
    supabase,
    userId,
}: {
    supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>;
    userId: string;
}) {
    const { data: settlementCasesRaw, error: casesError } = await supabase
        .from('settlement_cases')
        .select('id, party_id, case_status, created_at')
        .order('created_at', { ascending: false });

    if (casesError) {
        throw new Error(casesError.message);
    }

    const settlementCases = (settlementCasesRaw as SettlementCaseRow[] | null) || [];
    const caseIds = settlementCases.map((item) => item.id);
    const partyIds = Array.from(new Set(settlementCases.map((item) => item.party_id)));
    const caseIdSet = new Set(caseIds);

    const [partiesRes, partyRoles, certRows, linesRes, paymentsRes] = await Promise.all([
        partyIds.length > 0
            ? supabase
                .from('party_profiles')
                .select('id, display_name, member_id')
                .in('id', partyIds)
            : Promise.resolve({ data: [], error: null }),
        partyIds.length > 0
            ? fetchPartyRolesCompat(supabase, { partyIds })
            : Promise.resolve([]),
        partyIds.length > 0
            ? fetchCertificateCompatRows(supabase, { holderPartyIds: partyIds })
            : Promise.resolve([]),
        caseIds.length > 0
            ? supabase
                .from('settlement_lines')
                .select('case_id, line_type, amount')
                .in('case_id', caseIds)
                .eq('line_type', 'final_refund')
            : Promise.resolve({ data: [], error: null }),
        supabase
            .from('refund_payments')
            .select('id, case_id, paid_amount, payment_status, payment_reference'),
    ]);

    if (partiesRes.error) throw new Error(partiesRes.error.message);
    if (linesRes.error) throw new Error(linesRes.error.message);
    if (paymentsRes.error) throw new Error(paymentsRes.error.message);

    const parties = (partiesRes.data as PartyProfileRow[] | null) || [];
    const memberIds = Array.from(
        new Set(
            parties
                .map((party) => party.member_id)
                .filter((memberId): memberId is string => Boolean(memberId)),
        ),
    );
    const { data: membersData } = memberIds.length > 0
        ? await supabase
            .from('account_entities')
            .select('id, display_name')
            .in('id', memberIds)
        : { data: [] as Array<{ id: string; display_name: string }> };

    const ownershipMap = buildSettlementPartyOwnershipMap({
        parties,
        members: ((membersData as Array<{ id: string; display_name: string }> | null) || []).map((member) => ({
            id: member.id,
            name: member.display_name,
        })) as MemberLite[],
        partyRoles: partyRoles as PartyRoleRow[],
        rightCertificates: certRows.map((row) => ({
            holder_party_id: row.holder_party_id,
            status: row.status,
        })) as RightCertificateRow[],
    });

    const expectedByCase = new Map<string, number>();
    for (const line of ((linesRes.data as SettlementLineRow[] | null) || [])) {
        expectedByCase.set(line.case_id, (expectedByCase.get(line.case_id) || 0) + parseMoney(line.amount));
    }

    const refundPayments = (paymentsRes.data as RefundPaymentRow[] | null) || [];
    const paidByCase = new Map<string, number>();
    for (const payment of refundPayments) {
        if (payment.payment_status !== 'paid') continue;
        paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + parseMoney(payment.paid_amount));
    }

    let unlinkedCases = 0;
    let finalRefundMissing = 0;
    let statusMismatch = 0;
    let rejectedWithAmount = 0;
    for (const settlementCase of settlementCases) {
        const ownership = ownershipMap.get(settlementCase.party_id);
        const expected = Math.max(expectedByCase.get(settlementCase.id) || 0, 0);
        const paid = paidByCase.get(settlementCase.id) || 0;
        const remaining = Math.max(expected - paid, 0);

        if (!ownership || ownership.owner_type === 'unlinked') unlinkedCases += 1;
        if (expected <= 0) finalRefundMissing += 1;
        if (settlementCase.case_status === 'paid' && remaining > 0) statusMismatch += 1;
        if (
            settlementCase.case_status !== 'paid' &&
            settlementCase.case_status !== 'rejected' &&
            expected > 0 &&
            remaining <= 0
        ) {
            statusMismatch += 1;
        }
        if (settlementCase.case_status === 'rejected' && expected > 0) rejectedWithAmount += 1;
    }

    const orphanPayments = refundPayments.filter((payment) => !caseIdSet.has(payment.case_id)).length;
    const paidRefs = refundPayments
        .filter((payment) => payment.payment_status === 'paid' && payment.payment_reference)
        .map((payment) => payment.payment_reference as string);
    const refCountMap = new Map<string, number>();
    for (const ref of paidRefs) refCountMap.set(ref, (refCountMap.get(ref) || 0) + 1);
    const duplicatePaymentReferences = Array.from(refCountMap.values()).filter((count) => count > 1).length;

    const checks: QaCheck[] = [
        {
            code: 'unlinked_cases',
            label: '명의 미연결 케이스',
            severity: unlinkedCases > 0 ? 'warn' : 'pass',
            count: unlinkedCases,
            detail: 'member_id 또는 권리증 소유 연결 확인',
            link: '/settlements?diag=unlinked',
        },
        {
            code: 'final_refund_missing',
            label: '최종환불선 미설정',
            severity: finalRefundMissing > 0 ? 'warn' : 'pass',
            count: finalRefundMissing,
            detail: 'settlement_lines.final_refund 입력 필요',
            link: '/settlements?diag=no_final_refund',
        },
        {
            code: 'status_mismatch',
            label: '상태 불일치',
            severity: statusMismatch > 0 ? 'fail' : 'pass',
            count: statusMismatch,
            detail: 'case_status 와 잔여 환불금 정합성 점검',
            link: '/settlements?diag=status_mismatch',
        },
        {
            code: 'rejected_with_amount',
            label: '반려 케이스 금액 보유',
            severity: rejectedWithAmount > 0 ? 'warn' : 'pass',
            count: rejectedWithAmount,
            detail: '반려 사유/기준금액 검토',
            link: '/settlements?diag=rejected_with_amount',
        },
        {
            code: 'orphan_payments',
            label: '케이스 없는 지급 레코드',
            severity: orphanPayments > 0 ? 'fail' : 'pass',
            count: orphanPayments,
            detail: 'refund_payments.case_id 무결성 확인',
            link: null,
        },
        {
            code: 'duplicate_paid_reference',
            label: '중복 지급참조번호',
            severity: duplicatePaymentReferences > 0 ? 'warn' : 'pass',
            count: duplicatePaymentReferences,
            detail: '동일 payment_reference 재사용 점검',
            link: null,
        },
    ];

    const failChecks = checks.filter((item) => item.severity === 'fail' && item.count > 0).length;
    const warnChecks = checks.filter((item) => item.severity === 'warn' && item.count > 0).length;
    const passChecks = checks.length - failChecks - warnChecks;
    const overall: Severity = failChecks > 0 ? 'fail' : warnChecks > 0 ? 'warn' : 'pass';
    const payload: QaPayload = {
        generated_at: new Date().toISOString(),
        overall,
        summary: {
            total_cases: settlementCases.length,
            pass_checks: passChecks,
            warn_checks: warnChecks,
            fail_checks: failChecks,
            issue_count: checks.reduce((sum, item) => sum + (item.severity === 'pass' ? 0 : item.count), 0),
        },
        checks,
    };

    const { data: auditData, error: auditError } = await supabase
        .from('audit_logs')
        .insert({
            entity_type: 'qa_report',
            entity_id: null,
            action: 'run',
            actor: userId,
            reason: '정산 QA 자동 점검 실행',
            metadata: {
                generated_at: payload.generated_at,
                overall: payload.overall,
                summary: payload.summary,
                checks: payload.checks,
            },
        })
        .select('id')
        .maybeSingle();

    payload.audit_id = auditData?.id || null;
    payload.audit_logged = !auditError;

    if (payload.overall !== 'pass') {
        const deepLink = payload.overall === 'fail'
            ? '/settlements?diag=status_mismatch'
            : '/settlements?diag=all';
        const { error: alertError } = await supabase
            .from('audit_logs')
            .insert({
                entity_type: 'settlement_alert',
                entity_id: payload.audit_id || null,
                action: 'create',
                actor: userId,
                reason: `정산 QA ${payload.overall.toUpperCase()} 감지`,
                metadata: {
                    qa_audit_id: payload.audit_id || null,
                    overall: payload.overall,
                    issue_count: payload.summary.issue_count,
                    generated_at: payload.generated_at,
                    deep_link: deepLink,
                    summary: payload.summary,
                },
            });
        payload.alert_logged = !alertError;
    } else {
        payload.alert_logged = true;
    }

    return payload;
}
