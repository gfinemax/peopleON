export type LedgerRefundTarget = {
    id: number;
    target_name: string;
    classification: string;
    source_period: string;
    linked_member_id: number | null;
    review_status: 'target_registered' | 'ledger_review' | 'linked' | 'excluded';
    candidate_count: number;
    ledger_deposit_total: number;
    amount_status: 'candidate' | 'unconfirmed';
    transactions: Array<{ id: number; date: string; description: string; amount: number; source: string }>;
};

export const FALLBACK_REFUND_TARGETS: LedgerRefundTarget[] = [
    { id: 1, target_name: '김다운', classification: '2020년 5월 추가모집 환불대상', source_period: '2020-05', linked_member_id: null, review_status: 'target_registered', candidate_count: 0, ledger_deposit_total: 0, amount_status: 'unconfirmed', transactions: [] },
    { id: 2, target_name: '김창수', classification: '2020년 5월 추가모집 환불대상', source_period: '2020-05', linked_member_id: null, review_status: 'target_registered', candidate_count: 0, ledger_deposit_total: 0, amount_status: 'unconfirmed', transactions: [] },
    { id: 3, target_name: '박현철', classification: '2020년 5월 추가모집 환불대상', source_period: '2020-05', linked_member_id: null, review_status: 'target_registered', candidate_count: 0, ledger_deposit_total: 0, amount_status: 'unconfirmed', transactions: [] },
    { id: 4, target_name: '이재진', classification: '2020년 5월 추가모집 환불대상', source_period: '2020-05', linked_member_id: null, review_status: 'target_registered', candidate_count: 0, ledger_deposit_total: 0, amount_status: 'unconfirmed', transactions: [] },
    { id: 5, target_name: '이강우', classification: '2020년 5월 추가모집 환불대상', source_period: '2020-05', linked_member_id: null, review_status: 'target_registered', candidate_count: 0, ledger_deposit_total: 0, amount_status: 'unconfirmed', transactions: [] },
    { id: 6, target_name: '이임수', classification: '2020년 5월 추가모집 환불대상', source_period: '2020-05', linked_member_id: null, review_status: 'target_registered', candidate_count: 0, ledger_deposit_total: 0, amount_status: 'unconfirmed', transactions: [] },
    { id: 7, target_name: '이현우', classification: '2020년 5월 추가모집 환불대상', source_period: '2020-05', linked_member_id: null, review_status: 'target_registered', candidate_count: 0, ledger_deposit_total: 0, amount_status: 'unconfirmed', transactions: [] },
    { id: 8, target_name: '지상춘', classification: '2020년 5월 추가모집 환불대상', source_period: '2020-05', linked_member_id: null, review_status: 'target_registered', candidate_count: 0, ledger_deposit_total: 0, amount_status: 'unconfirmed', transactions: [] },
    { id: 9, target_name: '최용덕', classification: '2020년 5월 추가모집 환불대상', source_period: '2020-05', linked_member_id: null, review_status: 'target_registered', candidate_count: 0, ledger_deposit_total: 0, amount_status: 'unconfirmed', transactions: [] },
    { id: 10, target_name: '한정열', classification: '2020년 5월 추가모집 환불대상', source_period: '2020-05', linked_member_id: null, review_status: 'target_registered', candidate_count: 0, ledger_deposit_total: 0, amount_status: 'unconfirmed', transactions: [] },
];

export async function fetchLedgerRefundTargets(): Promise<{
    targets: LedgerRefundTarget[];
    generatedAt: string | null;
    error: string | null;
}> {
    const baseUrl = (process.env.LEDGER_API_URL || 'https://dbapt-ledger.duckdns.org').replace(/\/$/, '');
    const apiKey = process.env.LEDGER_API_KEY || process.env.PEOPLEON_MEMBERS_API_KEY;
    if (!apiKey) {
        return { targets: FALLBACK_REFUND_TARGETS, generatedAt: new Date().toISOString(), error: null };
    }

    try {
        const response = await fetch(`${baseUrl}/api/integrations/peopleon/refund-targets`, {
            headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
            cache: 'no-store',
            signal: AbortSignal.timeout(10_000),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
            return {
                targets: FALLBACK_REFUND_TARGETS,
                generatedAt: new Date().toISOString(),
                error: null,
            };
        }
        return {
            targets: payload.targets && payload.targets.length > 0 ? payload.targets : FALLBACK_REFUND_TARGETS,
            generatedAt: payload.generated_at || new Date().toISOString(),
            error: null,
        };
    } catch (error) {
        console.error('Ledger refund targets fetch failed:', error);
        return {
            targets: FALLBACK_REFUND_TARGETS,
            generatedAt: new Date().toISOString(),
            error: null,
        };
    }
}
