'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';

type Severity = 'pass' | 'warn' | 'fail';

type AlertItem = {
    id: string;
    created_at: string;
    actor: string;
    reason: string;
    overall: Severity;
    issue_count: number;
    qa_audit_id: string | null;
    deep_link: string | null;
};

type AlertHistoryResponse = {
    generated_at: string;
    items: AlertItem[];
};

function shortToken(value: unknown) {
    if (typeof value === 'string') return value.slice(0, 8);
    if (typeof value === 'number') return String(value).slice(0, 8);
    if (value && typeof value === 'object' && 'id' in value) {
        const nested = (value as { id?: unknown }).id;
        if (typeof nested === 'string') return nested.slice(0, 8);
    }
    return '';
}

function severityClass(severity: Severity) {
    if (severity === 'fail') return 'border-rose-400/20 bg-rose-500/10 text-rose-200';
    if (severity === 'warn') return 'border-amber-400/20 bg-amber-500/10 text-amber-200';
    return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200';
}

export function SettlementAlertCenterCard() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<AlertItem[]>([]);

    const loadAlerts = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/settlement/alerts/history?limit=20', { cache: 'no-store' });
            const payload = (await response.json().catch(() => null)) as AlertHistoryResponse | { error?: string } | null;
            const apiError =
                payload && typeof payload === 'object' && 'error' in payload
                    ? String(payload.error || '')
                    : '';
            if (!response.ok || !payload || !('items' in payload)) {
                setError(apiError || `알림 이력 조회 실패 (${response.status})`);
                return;
            }
            setItems(payload.items || []);
        } catch {
            setError('알림 이력 조회 중 네트워크 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadAlerts();
    }, []);

    const summary = useMemo(() => {
        const fail = items.filter((item) => item.overall === 'fail').length;
        const warn = items.filter((item) => item.overall === 'warn').length;
        return { fail, warn, total: items.length };
    }, [items]);

    return (
        <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-extrabold text-foreground">이슈 자동 알림 센터</h3>
                    <p className="mt-1 text-[11px] text-slate-400">
                        QA 실행에서 감지된 WARN/FAIL 알림 이력을 추적합니다.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-[10px] font-bold text-rose-200">
                        FAIL {summary.fail}
                    </span>
                    <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-200">
                        WARN {summary.warn}
                    </span>
                    <button
                        type="button"
                        onClick={loadAlerts}
                        disabled={loading}
                        className="h-8 px-2.5 rounded border border-white/15 bg-white/[0.04] text-slate-200 text-[11px] font-bold inline-flex items-center gap-1"
                    >
                        <MaterialIcon name={loading ? 'hourglass_top' : 'refresh'} size="xs" />
                        새로고침
                    </button>
                </div>
            </div>

            {error && (
                <p className="mt-2 rounded border border-rose-400/20 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-200">
                    {error}
                </p>
            )}

            <div className="mt-3 space-y-1.5">
                {items.length > 0 ? items.map((item) => (
                    <div key={item.id} className="rounded border border-white/[0.08] bg-[#0b1220] px-2.5 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2">
                                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${severityClass(item.overall)}`}>
                                    {item.overall.toUpperCase()}
                                </span>
                                <p className="text-[11px] font-semibold text-slate-100">{item.reason}</p>
                            </div>
                            <span className="text-[10px] text-slate-500">
                                {new Date(item.created_at).toLocaleString('ko-KR')}
                            </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                            <span className="text-slate-300">이슈 {item.issue_count.toLocaleString()}건</span>
                            {shortToken(item.qa_audit_id) && (
                                <span className="text-slate-500">qa {shortToken(item.qa_audit_id)}</span>
                            )}
                            <span className="text-slate-500">actor {shortToken(item.actor) || '-'}</span>
                            {item.deep_link && (
                                <Link href={item.deep_link} className="inline-flex items-center gap-1 font-bold text-sky-300 hover:text-sky-200">
                                    이슈 보기
                                    <MaterialIcon name="open_in_new" size="xs" />
                                </Link>
                            )}
                        </div>
                    </div>
                )) : (
                    <p className="text-[10px] text-slate-500">생성된 알림이 없습니다. QA 실행 후 자동 생성됩니다.</p>
                )}
            </div>
        </section>
    );
}
