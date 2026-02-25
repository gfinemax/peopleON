'use client';

import { useEffect, useMemo, useState } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import { SETTLEMENT_OPS_EVENT, type SettlementOpsEventDetail } from '@/components/features/settlements/opsEvents';

type Severity = 'pass' | 'warn' | 'fail';

type OpsStatusResponse = {
    generated_at: string;
    latest_qa: {
        id: string;
        created_at: string;
        actor: string;
        overall: Severity;
        issue_count: number;
        pass_checks: number;
        warn_checks: number;
        fail_checks: number;
    } | null;
    latest_sync: {
        id: string;
        created_at: string;
        actor: string;
        scanned_count: number;
        updated_count: number;
        update_error_count: number;
        target_paid_count: number;
        target_approved_count: number;
    } | null;
    latest_probe: {
        id: string;
        created_at: string;
        actor: string;
    } | null;
    latest_case_create: {
        id: string;
        created_at: string;
        actor: string;
        target_count: number;
        created_count: number;
        failed_count: number;
    } | null;
    latest_payment: {
        id: string;
        created_at: string;
        actor: string;
        case_id: string | null;
        refund_payment_id: string | null;
        paid_amount: number;
    } | null;
};

const CHECKLIST_STORAGE_KEY = 'settlement_ops_checklist_v1';
const CHECKLIST_ITEMS = [
    { id: 'qa_before', title: 'QA 실행(사전 점검)', hint: '실패/주의 항목을 먼저 확인' },
    { id: 'status_sync', title: '상태 동기화 실행', hint: '상태 불일치 자동 보정' },
    { id: 'qa_after', title: 'QA 재실행(사후 점검)', hint: '이슈 감소 여부 확인' },
    { id: 'permission_probe', title: '권한/RLS 점검', hint: '운영 계정 권한 최종 확인' },
] as const;

type ChecklistState = Record<(typeof CHECKLIST_ITEMS)[number]['id'], boolean>;

function getDefaultChecklistState(): ChecklistState {
    return {
        qa_before: false,
        status_sync: false,
        qa_after: false,
        permission_probe: false,
    };
}

function severityClass(severity: Severity) {
    if (severity === 'fail') return 'border-rose-400/20 bg-rose-500/10 text-rose-200';
    if (severity === 'warn') return 'border-amber-400/20 bg-amber-500/10 text-amber-200';
    return 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200';
}

function shortToken(value: string | null | undefined) {
    return (value || '').slice(0, 8);
}

function actionLabel(action: SettlementOpsEventDetail['action']) {
    if (action === 'create_missing_cases') return '미생성 케이스 일괄 생성';
    if (action === 'status_sync') return '상태 동기화';
    if (action === 'payment_register') return '지급 등록';
    if (action === 'permission_probe') return '권한/RLS 점검';
    return 'QA 실행';
}

export function SettlementOpsChecklistCard() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [opsStatus, setOpsStatus] = useState<OpsStatusResponse | null>(null);
    const [checks, setChecks] = useState<ChecklistState>(getDefaultChecklistState());
    const [lastAction, setLastAction] = useState<SettlementOpsEventDetail | null>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Partial<ChecklistState>;
            setChecks((prev) => ({ ...prev, ...parsed }));
        } catch {
            // ignore
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(checks));
    }, [checks]);

    const loadOpsStatus = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/settlement/ops/status', { cache: 'no-store' });
            const payload = (await response.json().catch(() => null)) as
                | OpsStatusResponse
                | { error?: string }
                | null;
            const apiError =
                payload && typeof payload === 'object' && 'error' in payload
                    ? String(payload.error || '')
                    : '';

            if (!response.ok || !payload || !('generated_at' in payload)) {
                setError(apiError || `운영 상태 조회 실패 (${response.status})`);
                return;
            }
            setOpsStatus(payload as OpsStatusResponse);
        } catch {
            setError('운영 상태 조회 중 네트워크 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadOpsStatus();
    }, []);

    useEffect(() => {
        const onActionDone = (event: Event) => {
            const customEvent = event as CustomEvent<SettlementOpsEventDetail>;
            if (!customEvent.detail) return;
            setLastAction(customEvent.detail);
            void loadOpsStatus();
        };

        window.addEventListener(SETTLEMENT_OPS_EVENT, onActionDone);
        return () => {
            window.removeEventListener(SETTLEMENT_OPS_EVENT, onActionDone);
        };
    }, []);

    const progress = useMemo(() => {
        const done = CHECKLIST_ITEMS.filter((item) => checks[item.id]).length;
        return { done, total: CHECKLIST_ITEMS.length };
    }, [checks]);

    const toggleCheck = (id: keyof ChecklistState) => {
        setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const resetChecks = () => {
        setChecks(getDefaultChecklistState());
    };

    return (
        <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-extrabold text-foreground">운영/배포 실행 체크리스트</h3>
                    <p className="mt-1 text-[11px] text-slate-400">
                        운영 검수 순서를 화면에서 바로 실행하고 진행률을 추적합니다.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[10px] font-bold text-sky-200">
                        진행 {progress.done}/{progress.total}
                    </span>
                    <button
                        type="button"
                        onClick={loadOpsStatus}
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

            {lastAction && (
                <div className={`mt-2 rounded border px-2.5 py-2 text-[11px] ${
                    lastAction.ok
                        ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                        : 'border-amber-400/20 bg-amber-500/10 text-amber-200'
                }`}>
                    최근 실행: {actionLabel(lastAction.action)} · {lastAction.message || '-'} · {new Date(lastAction.at).toLocaleTimeString('ko-KR')}
                </div>
            )}

            <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-2">
                <div className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-2.5">
                    <p className="text-[10px] text-slate-400">최근 QA</p>
                    {opsStatus?.latest_qa ? (
                        <div className="mt-1">
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${severityClass(opsStatus.latest_qa.overall)}`}>
                                {opsStatus.latest_qa.overall.toUpperCase()} · 이슈 {opsStatus.latest_qa.issue_count}
                            </span>
                            <p className="mt-1 text-[10px] text-slate-500">
                                {new Date(opsStatus.latest_qa.created_at).toLocaleString('ko-KR')}
                            </p>
                        </div>
                    ) : (
                        <p className="mt-1 text-[10px] text-slate-500">실행 이력 없음</p>
                    )}
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-2.5">
                    <p className="text-[10px] text-slate-400">최근 상태 동기화</p>
                    {opsStatus?.latest_sync ? (
                        <div className="mt-1 text-[10px] text-slate-300">
                            <p>업데이트 {opsStatus.latest_sync.updated_count}건</p>
                            <p className="text-slate-500">{new Date(opsStatus.latest_sync.created_at).toLocaleString('ko-KR')}</p>
                        </div>
                    ) : (
                        <p className="mt-1 text-[10px] text-slate-500">실행 이력 없음</p>
                    )}
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-2.5">
                    <p className="text-[10px] text-slate-400">최근 권한/RLS 점검</p>
                    {opsStatus?.latest_probe ? (
                        <p className="mt-1 text-[10px] text-slate-300">
                            {new Date(opsStatus.latest_probe.created_at).toLocaleString('ko-KR')}
                        </p>
                    ) : (
                        <p className="mt-1 text-[10px] text-slate-500">실행 이력 없음</p>
                    )}
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-2.5">
                    <p className="text-[10px] text-slate-400">최근 케이스 일괄생성</p>
                    {opsStatus?.latest_case_create ? (
                        <div className="mt-1 text-[10px] text-slate-300">
                            <p>성공 {opsStatus.latest_case_create.created_count} / 실패 {opsStatus.latest_case_create.failed_count}</p>
                            <p className="text-slate-500">{new Date(opsStatus.latest_case_create.created_at).toLocaleString('ko-KR')}</p>
                        </div>
                    ) : (
                        <p className="mt-1 text-[10px] text-slate-500">실행 이력 없음</p>
                    )}
                </div>

                <div className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-2.5">
                    <p className="text-[10px] text-slate-400">최근 지급등록</p>
                    {opsStatus?.latest_payment ? (
                        <div className="mt-1 text-[10px] text-slate-300">
                            <p>금액 {Math.round(opsStatus.latest_payment.paid_amount).toLocaleString()}원</p>
                            <p className="text-slate-500">pay {shortToken(opsStatus.latest_payment.refund_payment_id)}</p>
                            <p className="text-slate-500">{new Date(opsStatus.latest_payment.created_at).toLocaleString('ko-KR')}</p>
                        </div>
                    ) : (
                        <p className="mt-1 text-[10px] text-slate-500">실행 이력 없음</p>
                    )}
                </div>
            </div>

            <div className="mt-3 space-y-2">
                {CHECKLIST_ITEMS.map((item, index) => (
                    <div key={item.id} className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-2.5">
                        <div className="flex items-center justify-between gap-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={checks[item.id]}
                                    onChange={() => toggleCheck(item.id)}
                                    className="size-4 rounded border border-slate-500 bg-[#0f1725]"
                                />
                                <span className="text-[12px] font-semibold text-slate-100">
                                    {index + 1}. {item.title}
                                </span>
                            </label>
                            <a href="#settlement-actions" className="text-[10px] font-bold text-sky-300 hover:text-sky-200">
                                상단 실행영역
                            </a>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500 pl-6">{item.hint}</p>
                    </div>
                ))}
            </div>

            <div className="mt-2 flex items-center justify-end">
                <button
                    type="button"
                    onClick={resetChecks}
                    className="h-8 px-2.5 rounded border border-white/15 bg-white/[0.04] text-slate-300 text-[11px] font-bold"
                >
                    체크 초기화
                </button>
            </div>
        </section>
    );
}
