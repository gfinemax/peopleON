import type { SettlementOwnerType } from '@/lib/settlement/partyOwnership';
import type {
    PartyProfileRow,
    SettlementChecklistItem,
    SettlementDashboardRow,
    SettlementDiagFilter,
    SettlementDiagnostic,
    SettlementOwnershipSummary,
    SettlementCaseRow,
} from '@/lib/server/settlementDashboardTypes';

export const parseMoney = (value: number | string | null | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

export function buildSettlementRows(
    settlementCases: SettlementCaseRow[],
    partyMap: Map<string, PartyProfileRow>,
    ownershipByParty: Map<string, SettlementOwnershipSummary>,
    finalLineByCase: Map<string, number>,
    paidByCase: Map<string, number>,
) {
    return settlementCases.map((settlementCase) => {
        const party = partyMap.get(settlementCase.party_id);
        const ownership = ownershipByParty.get(settlementCase.party_id) || {
            owner_name: party?.display_name || '-',
            owner_type: 'unlinked' as SettlementOwnerType,
        };
        const expected = Math.max(finalLineByCase.get(settlementCase.id) || 0, 0);
        const paid = paidByCase.get(settlementCase.id) || 0;
        const remaining = Math.max(expected - paid, 0);
        return { settlementCase, party, ownership, expected, paid, remaining };
    });
}

export function filterSettlementRows(
    rows: SettlementDashboardRow[],
    query: string,
    diagFilter: SettlementDiagFilter,
) {
    const normalizedQuery = query.toLowerCase();

    return rows
        .filter((row) => {
            if (!query) return true;
            const target = `${row.ownership.owner_name} ${row.party?.display_name || ''} ${row.settlementCase.id}`.toLowerCase();
            return target.includes(normalizedQuery);
        })
        .filter((row) => {
            if (diagFilter === 'all') return true;
            if (diagFilter === 'unlinked') return row.ownership.owner_type === 'unlinked';
            if (diagFilter === 'no_final_refund') return row.expected <= 0;
            if (diagFilter === 'status_mismatch') {
                const isPaidButRemaining = row.settlementCase.case_status === 'paid' && row.remaining > 0;
                const isNotPaidButNoRemaining =
                    row.expected > 0 &&
                    row.remaining <= 0 &&
                    row.settlementCase.case_status !== 'paid' &&
                    row.settlementCase.case_status !== 'rejected';
                return isPaidButRemaining || isNotPaidButNoRemaining;
            }
            if (diagFilter === 'rejected_with_amount') {
                return row.settlementCase.case_status === 'rejected' && row.expected > 0;
            }
            return true;
        });
}

export function buildSettlementDiagnostics(rows: SettlementDashboardRow[]) {
    const unlinkedCount = rows.filter((row) => row.ownership.owner_type === 'unlinked').length;
    const zeroFinalRefundCount = rows.filter((row) => row.expected <= 0).length;
    const paidStatusMismatchCount = rows.filter(
        (row) => row.settlementCase.case_status === 'paid' && row.remaining > 0,
    ).length;
    const shouldBePaidCount = rows.filter(
        (row) =>
            row.expected > 0 &&
            row.remaining <= 0 &&
            row.settlementCase.case_status !== 'paid' &&
            row.settlementCase.case_status !== 'rejected',
    ).length;
    const rejectedWithAmountCount = rows.filter(
        (row) => row.settlementCase.case_status === 'rejected' && row.expected > 0,
    ).length;

    const diagnostics: SettlementDiagnostic[] = [
        {
            label: '명의 미연결 케이스',
            value: unlinkedCount,
            level: unlinkedCount > 0 ? 'warn' : 'ok',
            message: 'member_id 또는 권리증 소유 연결 필요',
        },
        {
            label: '최종환불선 미설정',
            value: zeroFinalRefundCount,
            level: zeroFinalRefundCount > 0 ? 'warn' : 'ok',
            message: 'settlement_lines.final_refund 확인',
        },
        {
            label: '상태 불일치(지급완료)',
            value: paidStatusMismatchCount + shouldBePaidCount,
            level: paidStatusMismatchCount + shouldBePaidCount > 0 ? 'danger' : 'ok',
            message: 'case_status 와 지급잔여 동기화 필요',
        },
        {
            label: '반려 케이스 금액 보유',
            value: rejectedWithAmountCount,
            level: rejectedWithAmountCount > 0 ? 'warn' : 'ok',
            message: '반려 사유와 금액 정합성 점검',
        },
    ];

    const diagnosticIssueCount = diagnostics.reduce(
        (sum, item) => sum + (item.level === 'ok' ? 0 : item.value),
        0,
    );

    const qaChecklist: SettlementChecklistItem[] = [
        {
            label: '명의 연결 정합성',
            detail: `미연결 ${unlinkedCount.toLocaleString()}건`,
            status: unlinkedCount === 0 ? 'pass' : 'fail',
        },
        {
            label: '최종 환불선 기입',
            detail: `미설정 ${zeroFinalRefundCount.toLocaleString()}건`,
            status: zeroFinalRefundCount === 0 ? 'pass' : 'warn',
        },
        {
            label: '케이스 상태 동기화',
            detail: `불일치 ${(paidStatusMismatchCount + shouldBePaidCount).toLocaleString()}건`,
            status: paidStatusMismatchCount + shouldBePaidCount === 0 ? 'pass' : 'fail',
        },
        {
            label: '반려 케이스 금액 검토',
            detail: `금액 보유 ${rejectedWithAmountCount.toLocaleString()}건`,
            status: rejectedWithAmountCount === 0 ? 'pass' : 'warn',
        },
    ];

    return { diagnostics, diagnosticIssueCount, qaChecklist };
}
