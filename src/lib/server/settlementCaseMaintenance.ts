import type { CertificateCompatRow } from '@/lib/server/certificateCompat';
import type { PartyRoleCompatRow } from '@/lib/server/partyRolesCompat';

type PartyProfileRow = {
    id: string;
    member_id: string | null;
};

type ExistingCaseRow = {
    party_id: string;
};

type SettlementCaseRow = {
    id: string;
    case_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected';
};

type SettlementLineAmountRow = {
    case_id: string;
    amount: number | string;
};

type RefundPaymentAmountRow = {
    case_id: string;
    paid_amount: number | string;
    payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
};

export function selectTargetPartyIdsForMissingCases({
    partyProfiles,
    partyRoles,
    certificateRows,
    existingCases,
    limit,
}: {
    partyProfiles: PartyProfileRow[];
    partyRoles: PartyRoleCompatRow[];
    certificateRows: CertificateCompatRow[];
    existingCases: ExistingCaseRow[];
    limit: number;
}) {
    const candidatePartyIds = new Set<string>();

    for (const party of partyProfiles) {
        if (party.member_id) {
            candidatePartyIds.add(party.id);
        }
    }

    for (const role of partyRoles) {
        if (role.role_type === 'member' || role.role_type === 'certificate_holder') {
            candidatePartyIds.add(role.party_id);
        }
    }

    for (const certificate of certificateRows) {
        candidatePartyIds.add(certificate.holder_party_id);
    }

    const existingCasePartyIds = new Set(existingCases.map((row) => row.party_id));

    return Array.from(candidatePartyIds)
        .filter((partyId) => !existingCasePartyIds.has(partyId))
        .slice(0, limit);
}

export function buildExpectedAmountByCase(lines: SettlementLineAmountRow[]) {
    const expectedByCase = new Map<string, number>();

    for (const line of lines) {
        expectedByCase.set(line.case_id, (expectedByCase.get(line.case_id) || 0) + Number(line.amount || 0));
    }

    return expectedByCase;
}

export function buildPaidAmountByCase(payments: RefundPaymentAmountRow[]) {
    const paidByCase = new Map<string, number>();

    for (const payment of payments) {
        if (payment.payment_status !== 'paid') continue;
        paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + Number(payment.paid_amount || 0));
    }

    return paidByCase;
}

export function classifySettlementStatusTargets(
    cases: SettlementCaseRow[],
    expectedByCase: Map<string, number>,
    paidByCase: Map<string, number>,
) {
    const toPaidIds: string[] = [];
    const toApprovedIds: string[] = [];

    for (const settlementCase of cases) {
        const expected = Math.max(expectedByCase.get(settlementCase.id) || 0, 0);
        const paid = paidByCase.get(settlementCase.id) || 0;
        const remaining = Math.max(expected - paid, 0);

        const shouldBePaid =
            expected > 0 &&
            remaining <= 0 &&
            settlementCase.case_status !== 'paid' &&
            settlementCase.case_status !== 'rejected';

        const shouldBeApproved =
            settlementCase.case_status === 'paid' &&
            remaining > 0;

        if (shouldBePaid) toPaidIds.push(settlementCase.id);
        if (shouldBeApproved) toApprovedIds.push(settlementCase.id);
    }

    return { toPaidIds, toApprovedIds };
}
