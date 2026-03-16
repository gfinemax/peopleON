import type { SupabaseClient } from '@supabase/supabase-js';

type PartyProfileRow = {
    id: string;
    member_id: string | null;
};

type SettlementCaseRow = {
    id: string;
    party_id: string;
    case_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected';
    created_at: string;
};

type SettlementLineRow = {
    case_id: string;
    amount: number | string;
};

type RefundPaymentRow = {
    case_id: string;
    paid_amount: number | string;
    payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
};

export async function fetchCertificateAuditQualityMetrics(
    supabase: SupabaseClient,
    memberIdsFromLegacy: string[],
) {
    let memberWithoutPartyCount = 0;
    let settlementCaseMissingCount = 0;
    let finalRefundMissingCount = 0;
    let settlementStatusMismatchCount = 0;

    if (memberIdsFromLegacy.length === 0) {
        return {
            memberWithoutPartyCount,
            settlementCaseMissingCount,
            finalRefundMissingCount,
            settlementStatusMismatchCount,
            qualityIssueCount: 0,
        };
    }

    const { data: partyProfilesRaw } = await supabase
        .from('party_profiles')
        .select('id, member_id')
        .in('member_id', memberIdsFromLegacy);

    const partyProfiles = ((partyProfilesRaw as PartyProfileRow[] | null) || []);
    const partyByMember = new Map(
        partyProfiles
            .filter((party) => Boolean(party.member_id))
            .map((party) => [party.member_id as string, party.id]),
    );

    memberWithoutPartyCount = memberIdsFromLegacy.filter((memberId) => !partyByMember.get(memberId)).length;

    const memberPartyIds = memberIdsFromLegacy
        .map((memberId) => partyByMember.get(memberId))
        .filter((partyId): partyId is string => Boolean(partyId));

    if (memberPartyIds.length === 0) {
        settlementCaseMissingCount = memberIdsFromLegacy.length;
        return {
            memberWithoutPartyCount,
            settlementCaseMissingCount,
            finalRefundMissingCount,
            settlementStatusMismatchCount,
            qualityIssueCount:
                memberWithoutPartyCount +
                settlementCaseMissingCount +
                finalRefundMissingCount +
                settlementStatusMismatchCount,
        };
    }

    const { data: settlementCasesRaw } = await supabase
        .from('settlement_cases')
        .select('id, party_id, case_status, created_at')
        .in('party_id', memberPartyIds)
        .order('created_at', { ascending: false });

    const settlementCases = ((settlementCasesRaw as SettlementCaseRow[] | null) || []);
    const latestCaseByParty = new Map<string, SettlementCaseRow>();
    for (const settlementCase of settlementCases) {
        if (!latestCaseByParty.has(settlementCase.party_id)) {
            latestCaseByParty.set(settlementCase.party_id, settlementCase);
        }
    }

    settlementCaseMissingCount = memberPartyIds.filter((partyId) => !latestCaseByParty.has(partyId)).length;

    const latestCaseIds = Array.from(latestCaseByParty.values()).map((item) => item.id);
    if (latestCaseIds.length > 0) {
        const [linesRes, paymentsRes] = await Promise.all([
            supabase
                .from('settlement_lines')
                .select('case_id, amount')
                .in('case_id', latestCaseIds)
                .eq('line_type', 'final_refund'),
            supabase
                .from('refund_payments')
                .select('case_id, paid_amount, payment_status')
                .in('case_id', latestCaseIds),
        ]);

        const expectedByCase = new Map<string, number>();
        for (const line of (((linesRes.data as SettlementLineRow[] | null) || []))) {
            expectedByCase.set(line.case_id, (expectedByCase.get(line.case_id) || 0) + Number(line.amount || 0));
        }

        const paidByCase = new Map<string, number>();
        for (const payment of (((paymentsRes.data as RefundPaymentRow[] | null) || []))) {
            if (payment.payment_status !== 'paid') continue;
            paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + Number(payment.paid_amount || 0));
        }

        let paidStatusMismatchCount = 0;
        let shouldBePaidCount = 0;
        for (const settlementCase of latestCaseByParty.values()) {
            const expected = Math.max(expectedByCase.get(settlementCase.id) || 0, 0);
            const paid = paidByCase.get(settlementCase.id) || 0;
            const remaining = Math.max(expected - paid, 0);

            if (expected <= 0) finalRefundMissingCount += 1;
            if (settlementCase.case_status === 'paid' && remaining > 0) paidStatusMismatchCount += 1;
            if (
                settlementCase.case_status !== 'paid' &&
                settlementCase.case_status !== 'rejected' &&
                expected > 0 &&
                remaining <= 0
            ) {
                shouldBePaidCount += 1;
            }
        }

        settlementStatusMismatchCount = paidStatusMismatchCount + shouldBePaidCount;
    }

    return {
        memberWithoutPartyCount,
        settlementCaseMissingCount,
        finalRefundMissingCount,
        settlementStatusMismatchCount,
        qualityIssueCount:
            memberWithoutPartyCount +
            settlementCaseMissingCount +
            finalRefundMissingCount +
            settlementStatusMismatchCount,
    };
}
