import type { PartyProfileLite, SettlementOwnerType } from '@/lib/settlement/partyOwnership';

export type SettlementDiagFilter =
    | 'all'
    | 'unlinked'
    | 'no_final_refund'
    | 'status_mismatch'
    | 'rejected_with_amount';

export type SettlementStatusFilter =
    | 'all'
    | 'draft'
    | 'review'
    | 'approved'
    | 'paid'
    | 'rejected';

export type CaseStatus = 'draft' | 'review' | 'approved' | 'paid' | 'rejected';

export type SettlementCaseRow = {
    id: string;
    party_id: string;
    case_status: CaseStatus;
    created_at: string;
};

export type PartyProfileRow = PartyProfileLite;

export type SettlementLineRow = {
    case_id: string;
    line_type: 'final_refund';
    amount: number | string;
};

export type RefundPaymentRow = {
    case_id: string;
    paid_amount: number | string;
    payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
};

export type SettlementOwnershipSummary = {
    owner_name: string;
    owner_type: SettlementOwnerType;
};

export type SettlementDashboardRow = {
    settlementCase: SettlementCaseRow;
    party?: PartyProfileRow;
    ownership: SettlementOwnershipSummary;
    expected: number;
    paid: number;
    remaining: number;
};

export type SettlementDiagnostic = {
    label: string;
    value: number;
    level: 'ok' | 'warn' | 'danger';
    message: string;
};

export type SettlementChecklistItem = {
    label: string;
    detail: string;
    status: 'pass' | 'warn' | 'fail';
};

export type SettlementDashboardData = {
    rows: SettlementDashboardRow[];
    loadErrorMessage: string | null;
    totalCases: number;
    expectedTotal: number;
    paidTotal: number;
    remainingTotal: number;
    connectedCount: number;
    pendingCount: number;
    diagnostics: SettlementDiagnostic[];
    diagnosticIssueCount: number;
    qaChecklist: SettlementChecklistItem[];
};
