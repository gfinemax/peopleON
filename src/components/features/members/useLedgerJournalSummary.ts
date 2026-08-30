'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { LedgerJournalSummary } from '@/lib/server/ledgerJournalSummary';

export const EMPTY_LEDGER_SUMMARY: LedgerJournalSummary = {
    connected: false,
    generated_at: null,
    ledger_member: null,
    journal_url: null,
    recent_consultations: [],
    pinned_note: { note: '', updated_at: null, updated_by: null },
    payment_summary: null,
    error: null,
};

export function useLedgerJournalSummary(memberId: string) {
    const [summary, setSummary] = useState<LedgerJournalSummary>(EMPTY_LEDGER_SUMMARY);
    const [loading, setLoading] = useState(true);
    const requestIdRef = useRef(0);

    const reload = useCallback(async () => {
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        if (!memberId) {
            setSummary({ ...EMPTY_LEDGER_SUMMARY, error: '조회할 조합원 정보가 없어.' });
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(
                `/api/members/${encodeURIComponent(memberId)}/ledger-journal-summary`,
                { cache: 'no-store' },
            );
            const payload = await response.json().catch(() => null);
            if (requestIdRef.current === requestId) {
                setSummary(
                    payload && typeof payload.connected === 'boolean'
                        ? payload
                        : { ...EMPTY_LEDGER_SUMMARY, error: '회계프로그램 기록을 불러오지 못했어.' },
                );
            }
        } catch {
            if (requestIdRef.current === requestId) {
                setSummary({ ...EMPTY_LEDGER_SUMMARY, error: '회계프로그램 기록을 불러오지 못했어.' });
            }
        } finally {
            if (requestIdRef.current === requestId) setLoading(false);
        }
    }, [memberId]);

    useEffect(() => {
        void reload();
        return () => {
            requestIdRef.current += 1;
        };
    }, [reload]);

    return { summary, loading, reload };
}
