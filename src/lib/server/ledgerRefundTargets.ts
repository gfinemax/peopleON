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

export async function fetchLedgerRefundTargets(): Promise<{
    targets: LedgerRefundTarget[];
    generatedAt: string | null;
    error: string | null;
}> {
    const baseUrl = (process.env.LEDGER_API_URL || 'https://dbapt-ledger.duckdns.org').replace(/\/$/, '');
    const apiKey = process.env.LEDGER_API_KEY || process.env.PEOPLEON_MEMBERS_API_KEY;
    if (!apiKey) {
        return { targets: [], generatedAt: null, error: '회계프로그램 연동 키가 설정되지 않았어.' };
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
                targets: [],
                generatedAt: null,
                error: `회계프로그램 조회에 실패했어. (HTTP ${response.status})`,
            };
        }
        return {
            targets: Array.isArray(payload.targets) ? payload.targets : [],
            generatedAt: payload.generated_at || new Date().toISOString(),
            error: null,
        };
    } catch (error) {
        console.error('Ledger refund targets fetch failed:', error);
        return {
            targets: [],
            generatedAt: null,
            error: '회계프로그램에 연결하지 못했어.',
        };
    }
}
