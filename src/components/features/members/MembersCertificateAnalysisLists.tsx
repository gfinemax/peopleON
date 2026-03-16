'use client';

import type { DuplicateSourceDetail, MemberHeldDetail } from '@/lib/members/sourceCertificateSummary';
import type { AnalysisMode, AnalysisNumberDetail, AnalysisView } from './membersKpiStripUtils';

function EmptyAnalysisState() {
    return (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] text-sm font-semibold text-slate-400">
            검색 조건에 맞는 원천 권리증 데이터가 없습니다.
        </div>
    );
}

function DuplicateAnalysisList({ details }: { details: DuplicateSourceDetail[] }) {
    if (details.length === 0) return <EmptyAnalysisState />;

    return (
        <div className="space-y-3">
            {details.map((detail) => (
                <div key={detail.id} className="rounded-xl border border-white/8 bg-[#182334] px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-lg font-black text-white">{detail.number}</p>
                        <span className="rounded border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">중복 {detail.duplicateCount}건</span>
                        <span className="rounded border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-200">조합원 {detail.registeredCount}명</span>
                        <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">기타 {detail.refundCount}명</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {detail.holders.map((holder) => (
                            <div key={`${detail.id}-${holder.id}`} className={`rounded-xl border px-3 py-2 ${holder.isRegistered ? 'border-violet-400/20 bg-violet-500/10 text-violet-100' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'}`}>
                                <p className="text-xs font-bold">{holder.name}</p>
                                <div className="mt-1 space-y-1 text-[11px] font-medium opacity-80">
                                    <p>{holder.phone || '연락처 없음'}</p>
                                    <p className="break-all">{holder.address || '주소 없음'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function NumberAnalysisList({ details }: { details: AnalysisNumberDetail[] }) {
    if (details.length === 0) return <EmptyAnalysisState />;

    return (
        <div className="space-y-3">
            {details.map((detail) => (
                <div key={detail.number} className="rounded-xl border border-white/8 bg-[#182334] px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-lg font-black text-white">{detail.number}</p>
                        <span className="rounded border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-100">보유 {detail.owners.length}명</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {detail.owners.map((owner) => (
                            <div key={`${detail.number}-${owner.id}`} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-slate-100">
                                <p className="text-xs font-bold">{owner.name}</p>
                                <div className="mt-1 space-y-1 text-[11px] font-medium text-slate-300">
                                    <p>{owner.phone || '연락처 없음'}</p>
                                    <p className="break-all">{owner.address || '주소 없음'}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function PersonAnalysisList({
    analysisMode,
    details,
}: {
    analysisMode: AnalysisMode;
    details: MemberHeldDetail[];
}) {
    if (details.length === 0) return <EmptyAnalysisState />;

    return (
        <div className="space-y-3">
            {details.map((detail) => (
                <div key={detail.id} className="rounded-xl border border-white/8 bg-[#182334] px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-black text-white">{detail.name}</p>
                                <span className="rounded border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-200">원천 {detail.sourceCount}건</span>
                                {analysisMode !== 'registered_internal' && detail.excludedSourceNumbers.length > 0 ? (
                                    <span className="rounded border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">중복 제외 {detail.excludedSourceNumbers.length}건</span>
                                ) : null}
                                <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-300">흐름 {detail.rightsFlow}</span>
                            </div>
                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                                <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">연락처</p>
                                    <p className="mt-1 text-sm font-semibold text-slate-100">{detail.phone || '연락처 없음'}</p>
                                </div>
                                <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">주소</p>
                                    <p className="mt-1 break-all text-sm font-semibold text-slate-100">{detail.address || '주소 없음'}</p>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {detail.sourceNumbers.length > 0 ? (
                                    detail.sourceNumbers.map((number) => (
                                        <span key={`${detail.id}-${number}`} className="rounded-md border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs font-bold text-sky-100">
                                            {number}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs font-semibold text-slate-500">표시 가능한 원천 권리증번호가 없습니다.</span>
                                )}
                            </div>
                            {analysisMode !== 'registered_internal' && detail.excludedSourceNumbers.length > 0 ? (
                                <div className="mt-3 border-t border-white/8 pt-3">
                                    <p className="mb-2 text-[11px] font-bold text-amber-300">중복으로 제외된 권리증번호</p>
                                    <div className="flex flex-wrap gap-2">
                                        {detail.excludedSourceNumbers.map((number, index) => (
                                            <span key={`${detail.id}-excluded-${number}-${index}`} className="rounded-md border border-amber-400/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-100">
                                                {number}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

export function MembersCertificateAnalysisBody({
    analysisMode,
    analysisView,
    filteredDuplicateDetails,
    filteredNumberDetails,
    filteredSourceDetails,
}: {
    analysisMode: AnalysisMode;
    analysisView: AnalysisView;
    filteredDuplicateDetails: DuplicateSourceDetail[];
    filteredNumberDetails: AnalysisNumberDetail[];
    filteredSourceDetails: MemberHeldDetail[];
}) {
    return (
        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
            {analysisMode === 'duplicates' ? (
                <DuplicateAnalysisList details={filteredDuplicateDetails} />
            ) : analysisView === 'number' ? (
                <NumberAnalysisList details={filteredNumberDetails} />
            ) : (
                <PersonAnalysisList analysisMode={analysisMode} details={filteredSourceDetails} />
            )}
        </div>
    );
}
