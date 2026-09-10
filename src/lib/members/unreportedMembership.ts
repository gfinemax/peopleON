export const UNREPORTED_MEMBER_ROLE_CODE = '미신고조합원';
export const UNREPORTED_MEMBER_LABEL = '미신고조합원';
export const UNREPORTED_RECRUITMENT_DATE = '2020-05-01';
export const UNREPORTED_CLAIMED_AMOUNT = 43_000_000;

export type UnreportedMembershipDisposition =
    | 'reviewing'
    | 'refund_planned'
    | 'rejoin_planned'
    | 'refunded'
    | 'rejoined';

export type UnreportedMembershipMeta = {
    record_id: string;
    recruitment_date: string;
    postal_code: string | null;
    claimed_amount: number;
    amount_verification_status: 'unconfirmed' | 'ledger_reviewed';
    disposition: UnreportedMembershipDisposition;
    basis: string;
};

export function getUnreportedMembershipMeta(meta?: Record<string, unknown> | null) {
    const value = meta?.unreported_membership;
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<UnreportedMembershipMeta>;
    if (typeof candidate.record_id !== 'string' || !candidate.record_id.trim()) return null;

    return {
        record_id: candidate.record_id.trim(),
        recruitment_date:
            typeof candidate.recruitment_date === 'string'
                ? candidate.recruitment_date
                : UNREPORTED_RECRUITMENT_DATE,
        postal_code: typeof candidate.postal_code === 'string' ? candidate.postal_code : null,
        claimed_amount:
            typeof candidate.claimed_amount === 'number' && Number.isFinite(candidate.claimed_amount)
                ? candidate.claimed_amount
                : UNREPORTED_CLAIMED_AMOUNT,
        amount_verification_status:
            candidate.amount_verification_status === 'ledger_reviewed' ? 'ledger_reviewed' : 'unconfirmed',
        disposition: candidate.disposition || 'reviewing',
        basis:
            typeof candidate.basis === 'string'
                ? candidate.basis
                : '2020년 5월 1일 추가모집 관련 행정지도',
    } satisfies UnreportedMembershipMeta;
}
