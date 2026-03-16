import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';
import { BulkCreateCasesForm } from '@/components/features/settlements/BulkCreateCasesForm';
import { SettlementAccessProbeForm } from '@/components/features/settlements/SettlementAccessProbeForm';
import { SettlementQaRunCard } from '@/components/features/settlements/SettlementQaRunCard';
import { SettlementStatusSyncForm } from '@/components/features/settlements/SettlementStatusSyncForm';
import { SettlementOpsChecklistCard } from '@/components/features/settlements/SettlementOpsChecklistCard';
import { SettlementAlertCenterCard } from '@/components/features/settlements/SettlementAlertCenterCard';
import { AccountingCompatReadyCard } from '@/components/features/settlements/AccountingCompatReadyCard';
import {
    type SettlementChecklistItem,
    type SettlementDiagnostic,
} from '@/lib/server/settlementDashboard';
import {
    ChecklistItem,
    DiagnosticStat,
    formatAmount,
    MiniStat,
} from './SettlementsPagePrimitives';
export { SettlementsCasesTableSection } from './SettlementsCasesTable';

type FilterTabLink = {
    value: string;
    label: string;
    href: string;
    active: boolean;
};

export function SettlementsActionPanel({
    diagnosticsExportHref,
    diagnosticsFullExportHref,
}: {
    diagnosticsExportHref: string;
    diagnosticsFullExportHref: string;
}) {
    return (
        <section id="settlement-actions" className="rounded-xl border border-white/[0.08] bg-[#101725] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-black text-foreground">정산 운영</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        정산 시작, 지급 진행, 남은 환불액을 운영 단위로 관리합니다.
                    </p>
                </div>
                <div className="flex min-w-[320px] flex-col items-stretch gap-2">
                    <div className="rounded-xl border border-sky-400/15 bg-sky-500/[0.04] p-2.5">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-black text-sky-200">
                                업무 실행
                            </span>
                            <span className="text-[11px] text-slate-400">정산 시작과 상태 정리를 먼저 처리합니다.</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <BulkCreateCasesForm />
                            <SettlementStatusSyncForm />
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-2 py-0.5 text-[10px] font-black text-slate-200">
                                관리자 도구
                            </span>
                            <span className="text-[11px] text-slate-400">진단/이동/권한 점검은 필요할 때만 사용합니다.</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <SettlementAccessProbeForm />
                            <Link href={diagnosticsExportHref} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20">
                                <MaterialIcon name="download" size="sm" />
                                진단CSV(이슈)
                            </Link>
                            <Link href={diagnosticsFullExportHref} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-xs font-bold text-slate-200">
                                <MaterialIcon name="download_for_offline" size="sm" />
                                진단CSV(전체)
                            </Link>
                            <Link href="/members" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-xs font-bold text-slate-200">
                                <MaterialIcon name="group" size="sm" />
                                인물관리 이동
                            </Link>
                            <Link href="/certificate-audit" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 text-xs font-bold text-violet-200 hover:bg-violet-500/20">
                                <MaterialIcon name="fact_check" size="sm" />
                                권리증 검수 이동
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export function SettlementsStatsStrip({
    totalCases,
    connectedCount,
    expectedTotal,
    paidTotal,
    remainingTotal,
}: {
    totalCases: number;
    connectedCount: number;
    expectedTotal: number;
    paidTotal: number;
    remainingTotal: number;
}) {
    return (
        <section className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <MiniStat label="케이스 수" value={`${totalCases.toLocaleString()}건`} />
            <MiniStat label="정산 대상 연결" value={`${connectedCount.toLocaleString()}건`} />
            <MiniStat label="총 환불 예정" value={formatAmount(expectedTotal)} />
            <MiniStat label="지급 완료" value={formatAmount(paidTotal)} />
            <MiniStat label="남은 환불액" value={formatAmount(remainingTotal)} tone={remainingTotal > 0 ? 'warn' : 'default'} />
        </section>
    );
}

export function SettlementsDiagnosticsSection({
    diagnostics,
    diagnosticIssueCount,
}: {
    diagnostics: SettlementDiagnostic[];
    diagnosticIssueCount: number;
}) {
    return (
        <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h3 className="text-sm font-extrabold text-foreground">정산 오류 점검</h3>
                    <p className="mt-1 text-[11px] text-slate-400">정산 전에 막히는 연결·환불선·상태 오류를 빠르게 확인합니다.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${diagnosticIssueCount > 0 ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                        {diagnosticIssueCount > 0 ? `이슈 ${diagnosticIssueCount.toLocaleString()}건` : '이슈 없음'}
                    </span>
                    <Link href="/certificate-audit" className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/15">
                        <MaterialIcon name="fact_check" size="xs" />
                        <span>권리증 검수센터</span>
                    </Link>
                </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                {diagnostics.map((item) => (
                    <DiagnosticStat key={item.label} label={item.label} value={item.value} level={item.level} message={item.message} />
                ))}
            </div>
        </section>
    );
}

export function SettlementsFilterSection({
    diagTabs,
    statusTabs,
    statusFilter,
    diagFilter,
    query,
    resetHref,
    pendingCount,
}: {
    diagTabs: FilterTabLink[];
    statusTabs: FilterTabLink[];
    statusFilter: string;
    diagFilter: string;
    query: string;
    resetHref: string;
    pendingCount: number;
}) {
    return (
        <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
            <div className="flex flex-wrap items-center gap-2">
                {diagTabs.map((tab) => (
                    <Link
                        key={`diag-${tab.value}`}
                        href={tab.href}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${tab.active ? 'border-amber-400/40 bg-amber-500/10 text-amber-200' : 'border-white/15 bg-white/[0.03] text-slate-300 hover:text-slate-100'}`}
                    >
                        {tab.label}
                    </Link>
                ))}
                <div className="mx-0.5 h-5 w-px bg-white/10" />
                {statusTabs.map((tab) => (
                    <Link
                        key={tab.value}
                        href={tab.href}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${tab.active ? 'border-sky-400/40 bg-sky-500/10 text-sky-200' : 'border-white/15 bg-white/[0.03] text-slate-300 hover:text-slate-100'}`}
                    >
                        {tab.label}
                    </Link>
                ))}
                <form method="GET" className="ml-auto flex items-center gap-2">
                    {statusFilter !== 'all' ? <input type="hidden" name="status" value={statusFilter} /> : null}
                    {diagFilter !== 'all' ? <input type="hidden" name="diag" value={diagFilter} /> : null}
                    <input
                        name="q"
                        defaultValue={query}
                        placeholder="인물명/케이스ID 검색"
                        className="h-9 rounded-lg border border-[#334a69] bg-[#0b1220] px-3 text-xs text-slate-100 placeholder:text-slate-500"
                    />
                    <button type="submit" className="h-9 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white hover:bg-sky-500">검색</button>
                    <Link href={resetHref} className="inline-flex h-9 items-center rounded-lg border border-white/15 bg-white/[0.03] px-3 text-xs font-bold text-slate-300">초기화</Link>
                </form>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">잔여 환불이 있는 케이스: {pendingCount.toLocaleString()}건</p>
        </section>
    );
}

export function SettlementsToolsSection({
    qaChecklist,
}: {
    qaChecklist: SettlementChecklistItem[];
}) {
    return (
        <details className="group rounded-xl border border-white/[0.08] bg-[#101725]">
            <summary className="flex list-none cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                    <p className="text-sm font-extrabold text-foreground">운영 도구</p>
                    <p className="mt-1 text-[11px] text-slate-400">자동 점검, 알림, 체크리스트, 권한 점검 등 관리자 도구를 접어서 관리합니다.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-slate-300">QA/알림/체크리스트</span>
                    <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-200">펼쳐보기</span>
                    <MaterialIcon name="expand_more" size="sm" className="text-slate-400 transition-transform group-open:rotate-180" />
                </div>
            </summary>
            <div className="space-y-3 border-t border-white/[0.08] px-3 py-3 lg:px-4">
                <section className="rounded-xl border border-white/[0.08] bg-[#0f1725] p-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-extrabold text-foreground">자동 점검 결과</h3>
                        <span className="text-[10px] text-slate-400">실데이터 기준 자동 진단</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                        {qaChecklist.map((item) => (
                            <ChecklistItem key={item.label} label={item.label} detail={item.detail} status={item.status} />
                        ))}
                    </div>
                </section>
                <SettlementQaRunCard />
                <SettlementAlertCenterCard />
                <SettlementOpsChecklistCard />
                <AccountingCompatReadyCard />
            </div>
        </details>
    );
}
