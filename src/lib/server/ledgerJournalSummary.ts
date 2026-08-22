export type LedgerConsultation = {
    id: number;
    occurred_at: string;
    contact_type: string | null;
    contact_person_type: string | null;
    contact_person: string | null;
    title: string | null;
    content: string | null;
    request_note: string | null;
    result_note: string | null;
    status: string | null;
    source: string;
    created_by_display: string | null;
    updated_at: string | null;
};

export type LedgerJournalSummary = {
    connected: boolean;
    generated_at: string | null;
    ledger_member: { id: number; name: string } | null;
    journal_url: string | null;
    recent_consultations: LedgerConsultation[];
    pinned_note: { note: string; updated_at: string | null; updated_by: string | null };
    payment_summary: {
        total_paid: number;
        gross_paid: number;
        withdrawal_sum: number;
        refund_sum: number;
        business_promotion_fee: number;
        allocations: {
            op_fee: number;
            business_promotion_fee: number;
            cert: number;
            join_fee: number;
            land1: number;
            land2: number;
        };
        payment_url: string;
    } | null;
    error: string | null;
};

const emptySummary = (overrides: Partial<LedgerJournalSummary> = {}): LedgerJournalSummary => ({
    connected: false,
    generated_at: null,
    ledger_member: null,
    journal_url: null,
    recent_consultations: [],
    pinned_note: { note: '', updated_at: null, updated_by: null },
    payment_summary: null,
    error: null,
    ...overrides,
});

export async function fetchLedgerMemberJournalSummary(peopleonId: string): Promise<LedgerJournalSummary> {
    const baseUrl = (process.env.LEDGER_API_URL || 'http://dbapt-ledger.duckdns.org').replace(/\/$/, '');
    const apiKey = process.env.LEDGER_API_KEY || process.env.PEOPLEON_MEMBERS_API_KEY;
    if (!apiKey) return emptySummary({ error: '회계프로그램 API 키가 설정되지 않았어.' });

    try {
        const response = await fetch(
            `${baseUrl}/api/integrations/peopleon/members/${encodeURIComponent(peopleonId)}/journal-summary?limit=5`,
            {
                headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
                cache: 'no-store',
                signal: AbortSignal.timeout(10_000),
            },
        );
        const payload = await response.json().catch(() => null);
        if (response.status === 404) return emptySummary();
        if (!response.ok || !payload?.success) {
            return emptySummary({ error: payload?.detail || '회계프로그램 연결에 실패했어.' });
        }
        return {
            connected: true,
            generated_at: payload.generated_at || null,
            ledger_member: payload.ledger_member || null,
            journal_url: payload.journal_url || null,
            recent_consultations: payload.recent_consultations || [],
            pinned_note: payload.pinned_note || { note: '', updated_at: null, updated_by: null },
            payment_summary: payload.payment_summary || null,
            error: null,
        };
    } catch (error) {
        console.error('Ledger journal summary fetch failed:', error);
        return emptySummary({ error: '회계프로그램 기록을 불러오지 못했어.' });
    }
}
