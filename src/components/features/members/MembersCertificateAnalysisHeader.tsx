'use client';

import { DialogTitle } from '@/components/ui/dialog';
import { MaterialIcon } from '@/components/ui/icon';
import type { DuplicateSourceDetail } from '@/lib/members/sourceCertificateSummary';
import type {
    AnalysisExportRow,
    AnalysisMode,
    AnalysisView,
    CertificateBlock,
} from './membersKpiStripUtils';

export function MembersCertificateAnalysisHeader({
    activePeopleCount,
    analysisMode,
    analysisQuery,
    analysisTitle,
    analysisView,
    certificates,
    duplicateSourceDetails,
    exportRows,
    filteredResultCount,
    onOpenAnalysis,
    onSetAnalysisQuery,
    onSetAnalysisView,
    onSetExportConfigOpen,
    onSetPrintConfigOpen,
    resultUnit,
}: {
    activePeopleCount: number;
    analysisMode: AnalysisMode;
    analysisQuery: string;
    analysisTitle: string;
    analysisView: AnalysisView;
    certificates: CertificateBlock;
    duplicateSourceDetails: DuplicateSourceDetail[];
    exportRows: AnalysisExportRow[];
    filteredResultCount: number;
    onOpenAnalysis: (mode: AnalysisMode) => void;
    onSetAnalysisQuery: (value: string) => void;
    onSetAnalysisView: (view: AnalysisView) => void;
    onSetExportConfigOpen: (open: boolean) => void;
    onSetPrintConfigOpen: (open: boolean) => void;
    resultUnit: string;
}) {
    return (
        <div className="border-b border-white/10 px-6 py-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <DialogTitle className="flex items-center gap-2 text-xl font-black">
                        <MaterialIcon name="folder" className="text-violet-300" />
                        권리증 분석
                    </DialogTitle>
                    <p className="mt-2 text-sm text-slate-400">
                        {analysisMode === 'duplicates'
                            ? '중복된 원천 권리증번호와 보유 명단을 확인합니다. 통합 관리번호는 제외됩니다.'
                            : `${analysisTitle} 기준의 활성 원천 권리증번호 목록입니다. 통합 관리번호는 제외됩니다.`}
                    </p>
                </div>
                {analysisMode !== 'duplicates' ? (
                    <div className="inline-flex items-center rounded-2xl border border-white/10 bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <button
                            type="button"
                            onClick={() => onSetAnalysisView('person')}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                                analysisView === 'person'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                            }`}
                        >
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${analysisView === 'person' ? 'bg-slate-900/10 text-slate-700' : 'bg-white/[0.06] text-slate-400'}`}>
                                <MaterialIcon name="groups" size="xs" />
                            </span>
                            사람 기준
                        </button>
                        <button
                            type="button"
                            onClick={() => onSetAnalysisView('number')}
                            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                                analysisView === 'number'
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-300 hover:bg-white/[0.06] hover:text-white'
                            }`}
                        >
                            <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${analysisView === 'number' ? 'bg-slate-900/10 text-slate-700' : 'bg-white/[0.06] text-slate-400'}`}>
                                <MaterialIcon name="tag" size="xs" />
                            </span>
                            번호 기준
                        </button>
                    </div>
                ) : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onSetExportConfigOpen(true)} disabled={exportRows.length === 0} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#0f172a] px-4 text-sm font-bold text-slate-100 transition-all hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-200 disabled:cursor-not-allowed disabled:opacity-40">
                    <MaterialIcon name="download" size="sm" />
                    엑셀 다운로드
                </button>
                <button type="button" onClick={() => onSetPrintConfigOpen(true)} disabled={exportRows.length === 0} className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-[#0f172a] px-4 text-sm font-bold text-slate-100 transition-all hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40">
                    <MaterialIcon name="print" size="sm" />
                    보고서 인쇄
                </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onOpenAnalysis('all')} className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${analysisMode === 'all' ? 'border-violet-400/20 bg-violet-500/10 text-violet-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'}`}>전체 원천권리증 {certificates.total.toLocaleString()}건</button>
                <button type="button" onClick={() => onOpenAnalysis('registered_global')} className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${analysisMode === 'registered_global' ? 'border-violet-400/20 bg-violet-500/10 text-violet-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'}`}>등기조합원 원천권리증 {certificates.memberHeld.toLocaleString()}건</button>
                <button type="button" onClick={() => onOpenAnalysis('registered_internal')} className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${analysisMode === 'registered_internal' ? 'border-sky-400/20 bg-sky-500/10 text-sky-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'}`}>116명 내부 중복 제거 {certificates.registeredInternalDistinct.toLocaleString()}건</button>
                <button type="button" onClick={() => onOpenAnalysis('refund')} className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${analysisMode === 'refund' ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'}`}>환불 권리증 {certificates.externalHeld.toLocaleString()}건</button>
                <button type="button" onClick={() => onOpenAnalysis('duplicates')} className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${analysisMode === 'duplicates' ? 'border-amber-400/20 bg-amber-500/10 text-amber-200' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]'}`}>중복 권리증 {certificates.duplicateExcluded.toLocaleString()}건</button>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                    {analysisMode === 'duplicates'
                        ? `중복 보유자 ${duplicateSourceDetails.reduce((sum, detail) => sum + detail.holders.length, 0).toLocaleString()}명`
                        : `보유 인원 ${activePeopleCount.toLocaleString()}명`}
                </span>
            </div>
            <div className="mt-4">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0c1524] px-3 py-2.5">
                    <MaterialIcon name="search" className="text-slate-500" size="sm" />
                    <input
                        type="text"
                        value={analysisQuery}
                        onChange={(event) => onSetAnalysisQuery(event.target.value)}
                        placeholder="이름, 권리증번호, 연락처, 주소 검색"
                        className="w-full bg-transparent text-sm font-medium text-white placeholder:text-slate-500 focus:outline-none"
                    />
                    {analysisQuery ? (
                        <button type="button" onClick={() => onSetAnalysisQuery('')} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-slate-300 transition-colors hover:bg-white/[0.08]">
                            초기화
                        </button>
                    ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold text-slate-300">
                        검색 결과 {filteredResultCount.toLocaleString()}
                        {resultUnit}
                    </span>
                    {analysisQuery ? (
                        <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-200">
                            검색어: {analysisQuery}
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
