'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import { formatSafeDateTime } from '@/lib/utils';

type Severity = 'pass' | 'fail';

type CompatCheckItem = {
    key: string;
    label: string;
    legacy_count: number;
    compat_count: number;
    diff: number;
    status: Severity;
};

type CompatReadyResponse = {
    generated_at: string;
    overall: Severity;
    summary: {
        total_checks: number;
        pass_checks: number;
        fail_checks: number;
    };
    checks: CompatCheckItem[];
    notes?: string[];
    config?: {
        accounting_compat_only: boolean;
        fallback_allowed: boolean;
    };
    guard?: 'ok' | 'danger';
    recommendation?: string;
    audit_logged?: boolean;
    audit_id?: string | null;
};

type CompatHistoryItem = {
    id: string;
    created_at: string;
    actor: string;
    overall: Severity;
    pass_checks: number;
    fail_checks: number;
    total_checks: number;
    guard: string | null;
    recommendation: string | null;
};

type CompatHistoryResponse = {
    generated_at: string;
    items: CompatHistoryItem[];
};

function toneClass(status: Severity) {
    if (status === 'pass') return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200';
    return 'border-rose-400/20 bg-rose-500/10 text-rose-200';
}

export function AccountingCompatReadyCard() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [payload, setPayload] = useState<CompatReadyResponse | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [history, setHistory] = useState<CompatHistoryItem[]>([]);

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const response = await fetch('/api/accounting/compat-history?limit=6', { cache: 'no-store' });
            const body = (await response.json().catch(() => null)) as CompatHistoryResponse | null;
            if (!response.ok || !body || !('items' in body)) return;
            setHistory(body.items || []);
        } finally {
            setHistoryLoading(false);
        }
    }, []);

    const load = useCallback(async (shouldLog = false) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(
                `/api/accounting/compat-ready${shouldLog ? '?log=1' : ''}`,
                { cache: 'no-store' },
            );
            const body = (await response.json().catch(() => null)) as CompatReadyResponse | { error?: string } | null;
            if (!response.ok || !body || !('overall' in body)) {
                setError((body && 'error' in body ? body.error : null) || `검증 조회 실패 (${response.status})`);
                return;
            }
            setPayload(body);
            if (shouldLog) {
                void loadHistory();
            }
        } catch {
            setError('검증 조회 중 네트워크 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    }, [loadHistory]);

    useEffect(() => {
        void load();
        void loadHistory();
    }, [load, loadHistory]);

    const summaryTone = useMemo(() => {
        if (!payload) return 'border-white/[0.08] bg-[#0b1220] text-slate-200';
        return payload.overall === 'pass'
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            : 'border-rose-400/20 bg-rose-500/10 text-rose-200';
    }, [payload]);

    return (
        <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-extrabold text-foreground">회계 호환 전환 준비 상태</h3>
                    <p className="mt-1 text-[11px] text-slate-400">
                        legacy 집계와 compat 집계를 비교해 전환 가능 여부를 판정합니다.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        void load();
                    }}
                    disabled={loading}
                    className="h-8 px-2.5 rounded border border-white/15 bg-white/[0.04] text-slate-200 text-[11px] font-bold inline-flex items-center gap-1"
                >
                    <MaterialIcon name={loading ? 'hourglass_top' : 'refresh'} size="xs" />
                    새로고침
                </button>
                <button
                    type="button"
                    onClick={() => load(true)}
                    disabled={loading}
                    className="h-8 px-2.5 rounded border border-sky-400/30 bg-sky-500/10 text-sky-200 text-[11px] font-bold inline-flex items-center gap-1"
                >
                    <MaterialIcon name={loading ? 'hourglass_top' : 'playlist_add_check'} size="xs" />
                    진단 실행(기록)
                </button>
            </div>

            {error && (
                <p className="mt-2 rounded border border-rose-400/20 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-200">
                    {error}
                </p>
            )}

            <div className={`mt-3 rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${summaryTone}`}>
                {payload
                    ? `판정 ${payload.overall.toUpperCase()} · PASS ${payload.summary.pass_checks} / FAIL ${payload.summary.fail_checks} · ${payload.recommendation || ''}`
                    : '검증 결과 대기'}
            </div>

            {payload?.config && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                    <span
                        className={`rounded-full border px-2 py-1 font-bold ${payload.config.accounting_compat_only
                                ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                                : 'border-slate-400/30 bg-slate-500/10 text-slate-300'
                            }`}
                    >
                        MODE {payload.config.accounting_compat_only ? 'COMPAT_ONLY ON' : 'FALLBACK ON'}
                    </span>
                    <a
                        href="/api/accounting/compat-ready?format=csv"
                        className="rounded border border-white/15 bg-white/[0.04] px-2 py-1 font-semibold text-slate-200 hover:bg-white/[0.08]"
                    >
                        CSV 내보내기
                    </a>
                </div>
            )}

            {payload?.guard === 'danger' && (
                <div className="mt-2 rounded border border-rose-400/30 bg-rose-500/10 px-2.5 py-2 text-[11px] font-semibold text-rose-200">
                    위험 상태: COMPAT_ONLY가 켜진 상태에서 불일치가 감지되었습니다. 즉시 `ACCOUNTING_COMPAT_ONLY=false` 롤백이 필요합니다.
                </div>
            )}

            {payload && payload.audit_logged === false && (
                <div className="mt-2 rounded border border-amber-400/30 bg-amber-500/10 px-2.5 py-2 text-[11px] font-semibold text-amber-200">
                    진단 결과 기록(audit_logs) 저장에 실패했습니다.
                </div>
            )}

            {payload && (
                <>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                        {payload.checks.map((check) => (
                            <div key={check.key} className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] text-slate-200 font-semibold">{check.label}</p>
                                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${toneClass(check.status)}`}>
                                        {check.status.toUpperCase()}
                                    </span>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-400">
                                    legacy {check.legacy_count.toLocaleString()} / compat {check.compat_count.toLocaleString()}
                                </p>
                                <p className={`mt-1 text-[10px] font-semibold ${check.diff === 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                    diff {check.diff >= 0 ? `+${check.diff}` : check.diff}
                                </p>
                            </div>
                        ))}
                    </div>
                    {payload.notes && payload.notes.length > 0 && (
                        <div className="mt-2 rounded-lg border border-white/[0.08] bg-[#0b1220] px-2.5 py-2 text-[10px] text-slate-400 space-y-1">
                            {payload.notes.map((note, index) => (
                                <p key={`compat-note-${index}`}>- {note}</p>
                            ))}
                        </div>
                    )}
                </>
            )}

            <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#0b1220] p-2.5">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-200">최근 전환 진단 이력</p>
                    {historyLoading && <span className="text-[10px] text-slate-400">불러오는 중...</span>}
                </div>
                <div className="mt-2 space-y-1.5">
                    {history.length > 0 ? history.map((item) => (
                        <div key={item.id} className="rounded border border-white/[0.06] bg-[#101725] px-2 py-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${toneClass(item.overall)}`}>
                                        {item.overall.toUpperCase()}
                                    </span>
                                    <span className="text-[10px] text-slate-300">
                                        PASS {item.pass_checks} / FAIL {item.fail_checks}
                                    </span>
                                    {item.guard && (
                                        <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${item.guard === 'danger'
                                                ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                                                : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                                            }`}>
                                            {item.guard.toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[10px] text-slate-500">
                                    {formatSafeDateTime(item.created_at)}
                                </span>
                            </div>
                        </div>
                    )) : (
                        <p className="text-[10px] text-slate-500">진단 이력이 없습니다.</p>
                    )}
                </div>
            </div>
        </section>
    );
}
