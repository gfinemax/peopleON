'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';
import { formatSafeDateTime } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { emitSettlementOpsEvent } from '@/components/features/settlements/opsEvents';

type Severity = 'pass' | 'warn' | 'fail';

type QaCheck = {
    code: string;
    label: string;
    severity: Severity;
    count: number;
    detail: string;
    link: string | null;
};

type QaReport = {
    generated_at: string;
    overall: Severity;
    summary: {
        total_cases: number;
        pass_checks: number;
        warn_checks: number;
        fail_checks: number;
        issue_count: number;
    };
    checks: QaCheck[];
    audit_id?: string | null;
    audit_logged?: boolean;
};

type QaHistoryItem = {
    id: string;
    created_at: string;
    actor: string;
    overall: Severity;
    issue_count: number;
    pass_checks: number;
    warn_checks: number;
    fail_checks: number;
    generated_at: string | null;
    checks: QaCheck[];
};

type QaHistoryResponse = {
    generated_at: string;
    items: QaHistoryItem[];
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

export function SettlementQaRunCard() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [report, setReport] = useState<QaReport | null>(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [history, setHistory] = useState<QaHistoryItem[]>([]);
    const [selectedHistory, setSelectedHistory] = useState<QaHistoryItem | null>(null);

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const response = await fetch('/api/settlement/qa/history?limit=8', { cache: 'no-store' });
            const payload = (await response.json().catch(() => null)) as QaHistoryResponse | { error?: string } | null;
            if (!response.ok || !payload || !('items' in payload)) return;
            setHistory(payload.items || []);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        void loadHistory();
    }, []);

    const overallLabel = useMemo(() => {
        if (!report) return '';
        if (report.overall === 'fail') return '실패';
        if (report.overall === 'warn') return '주의';
        return '정상';
    }, [report]);

    const runQa = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/settlement/qa/report', { cache: 'no-store' });
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload) {
                setError(payload?.error || `QA 리포트 생성 실패 (${response.status})`);
                emitSettlementOpsEvent({
                    action: 'qa_run',
                    ok: false,
                    message: payload?.error || `QA 리포트 생성 실패 (${response.status})`,
                    at: new Date().toISOString(),
                });
                return;
            }
            const qaReport = payload as QaReport;
            setReport(qaReport);
            emitSettlementOpsEvent({
                action: 'qa_run',
                ok: qaReport.overall !== 'fail',
                message: `QA ${qaReport.overall.toUpperCase()} · 이슈 ${qaReport.summary.issue_count}건`,
                at: new Date().toISOString(),
            });
            await loadHistory();
        } catch {
            setError('QA 리포트 요청 중 네트워크 오류가 발생했습니다.');
            emitSettlementOpsEvent({
                action: 'qa_run',
                ok: false,
                message: 'QA 리포트 요청 중 네트워크 오류',
                at: new Date().toISOString(),
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-extrabold text-foreground">실데이터 QA 자동 점검</h3>
                    <p className="mt-1 text-[11px] text-slate-400">
                        정산 데이터 무결성/상태 정합성을 즉시 검증합니다.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={runQa}
                        disabled={loading}
                        className="h-9 px-3 rounded-lg border border-sky-400/30 bg-sky-500/10 text-sky-200 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-sky-500/20 disabled:opacity-60"
                    >
                        <MaterialIcon name={loading ? 'hourglass_top' : 'task'} size="sm" />
                        {loading ? '점검 중...' : 'QA 실행'}
                    </button>
                    <a
                        href="/api/settlement/qa/report?format=csv"
                        className="h-9 px-3 rounded-lg border border-white/15 bg-white/[0.04] text-slate-200 text-xs font-bold inline-flex items-center gap-1.5"
                    >
                        <MaterialIcon name="download" size="sm" />
                        CSV
                    </a>
                </div>
            </div>

            {error && (
                <p className="mt-2 rounded border border-rose-400/20 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-200">
                    {error}
                </p>
            )}

            {report && (
                <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className={`rounded-full border px-2 py-0.5 font-bold ${severityClass(report.overall)}`}>
                            {overallLabel}
                        </span>
                        <span className="text-slate-300">케이스 {report.summary.total_cases.toLocaleString()}건</span>
                        <span className="text-emerald-200">PASS {report.summary.pass_checks}</span>
                        <span className="text-amber-200">WARN {report.summary.warn_checks}</span>
                        <span className="text-rose-200">FAIL {report.summary.fail_checks}</span>
                        <span className="text-slate-400">
                            실행시각 {formatSafeDateTime(report.generated_at)}
                        </span>
                        {report.audit_logged === false && (
                            <span className="text-rose-300">이력 저장 실패</span>
                        )}
                        {report.audit_logged && shortToken(report.audit_id) && (
                            <span className="text-slate-400">로그ID {shortToken(report.audit_id)}</span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                        {report.checks.map((check) => (
                            <div key={check.code} className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[11px] font-semibold text-slate-100">{check.label}</p>
                                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${severityClass(check.severity)}`}>
                                        {check.count.toLocaleString()}건
                                    </span>
                                </div>
                                <p className="mt-1 text-[10px] text-slate-400">{check.detail}</p>
                                {check.link && check.count > 0 && (
                                    <Link href={check.link} className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-sky-300 hover:text-sky-200">
                                        상세 이동
                                        <MaterialIcon name="open_in_new" size="xs" />
                                    </Link>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-3 rounded-lg border border-white/[0.08] bg-[#0b1220] p-2.5">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-200">최근 QA 실행 이력</p>
                    {historyLoading && <span className="text-[10px] text-slate-400">불러오는 중...</span>}
                </div>
                <div className="mt-2 space-y-1.5">
                    {history.length > 0 ? history.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setSelectedHistory(item)}
                            className="w-full rounded border border-white/[0.06] bg-[#101725] px-2 py-1.5 text-left hover:bg-[#13203a] transition-colors"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="flex items-center gap-2">
                                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${severityClass(item.overall)}`}>
                                        {item.overall.toUpperCase()}
                                    </span>
                                    <span className="text-[10px] text-slate-300">
                                        이슈 {item.issue_count.toLocaleString()}건
                                    </span>
                                </div>
                                <span className="text-[10px] text-slate-500">
                                    {formatSafeDateTime(item.created_at)}
                                </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                                <span className="text-emerald-200">P {item.pass_checks}</span>
                                <span className="text-amber-200">W {item.warn_checks}</span>
                                <span className="text-rose-200">F {item.fail_checks}</span>
                                <span className="text-slate-500">actor {shortToken(item.actor) || '-'}</span>
                            </div>
                        </button>
                    )) : (
                        <p className="text-[10px] text-slate-500">실행 이력이 없습니다.</p>
                    )}
                </div>
            </div>

            <Dialog open={Boolean(selectedHistory)} onOpenChange={(open) => !open && setSelectedHistory(null)}>
                <DialogContent className="sm:max-w-[760px] bg-[#0f1725] border-white/10 text-slate-100">
                    <DialogHeader>
                        <DialogTitle className="text-base font-extrabold">QA 실행 스냅샷</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            {selectedHistory
                                ? `실행시각 ${formatSafeDateTime(selectedHistory.created_at)} · actor ${selectedHistory.actor}`
                                : ''}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedHistory && (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span className={`rounded-full border px-2 py-0.5 font-bold ${severityClass(selectedHistory.overall)}`}>
                                    {selectedHistory.overall.toUpperCase()}
                                </span>
                                <span className="text-slate-300">이슈 {selectedHistory.issue_count.toLocaleString()}건</span>
                                <span className="text-emerald-200">P {selectedHistory.pass_checks}</span>
                                <span className="text-amber-200">W {selectedHistory.warn_checks}</span>
                                <span className="text-rose-200">F {selectedHistory.fail_checks}</span>
                            </div>

                            <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
                                {selectedHistory.checks.length > 0 ? selectedHistory.checks.map((check) => (
                                    <div key={`${selectedHistory.id}-${check.code}`} className="rounded border border-white/[0.08] bg-[#0b1220] p-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[11px] font-semibold text-slate-100">{check.label}</p>
                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${severityClass(check.severity)}`}>
                                                {check.count.toLocaleString()}건
                                            </span>
                                        </div>
                                        <p className="mt-1 text-[10px] text-slate-400">{check.detail}</p>
                                        {check.link && check.count > 0 && (
                                            <Link href={check.link} className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-sky-300 hover:text-sky-200">
                                                상세 이동
                                                <MaterialIcon name="open_in_new" size="xs" />
                                            </Link>
                                        )}
                                    </div>
                                )) : (
                                    <p className="text-[11px] text-slate-400">이력 상세 데이터가 없습니다.</p>
                                )}
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}
