import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';
import { MembersTable } from '@/components/features/members/MembersTable';
import { MembersExportPrintButtons } from '@/components/features/members/MembersExportPrintButtons';
import { LinkedOperationPanel } from '@/components/features/members/OperationPanel';
import type { UnifiedPerson } from '@/services/memberAggregation';

function SlimQualityChip({ label, count, href }: { label: string; count: number; href: string }) {
    const toneClass = count > 0
        ? 'border-amber-400/20 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15'
        : 'border-white/[0.08] bg-[#161B22] text-slate-300 hover:bg-white/[0.05]';

    return (
        <Link
            href={href}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${toneClass}`}
        >
            <span>{label}</span>
            <span className="font-black">{count.toLocaleString()}건</span>
            <MaterialIcon name="open_in_new" size="xs" />
        </Link>
    );
}

export function MembersDataSection({
    displayedMembers,
    filteredPeople,
    paramsKey,
    startIndex,
    reviewPendingCount,
    duplicateExcludedCount,
    totalCount,
    from,
    to,
    normalizedPage,
    totalPages,
    totalRemainingRefund,
    totalExpectedRefund,
    totalPaidRefund,
    topRemaining,
    getPageLink,
}: {
    displayedMembers: UnifiedPerson[];
    filteredPeople: UnifiedPerson[];
    paramsKey: string;
    startIndex: number;
    reviewPendingCount: number;
    duplicateExcludedCount: number;
    totalCount: number;
    from: number;
    to: number;
    normalizedPage: number;
    totalPages: number;
    totalRemainingRefund: number;
    totalExpectedRefund: number;
    totalPaidRefund: number;
    topRemaining: UnifiedPerson[];
    getPageLink: (targetPage: number) => string;
}) {
    return (
        <div className="mb-4 flex flex-col lg:mb-6 lg:rounded-xl lg:border lg:border-white/[0.08] lg:bg-card lg:shadow-sm">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.04] px-3 pt-3 pb-2">
                <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <h2 className="text-sm font-bold text-slate-200">데이터 리스트</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        <SlimQualityChip label="검수 필요" count={reviewPendingCount} href="/certificate-audit" />
                        <SlimQualityChip label="중복 검토" count={duplicateExcludedCount} href="/certificate-audit" />
                    </div>
                </div>
                <MembersExportPrintButtons data={filteredPeople} />
            </div>
            <div className="p-2 lg:p-3">
                <div className="flex gap-3">
                    <div className="max-h-[68vh] min-w-0 flex-1 overflow-hidden rounded-lg border border-white/[0.06] bg-[#0f1725]">
                        {displayedMembers.length > 0 ? (
                            <MembersTable
                                members={displayedMembers}
                                tableKey={paramsKey}
                                startIndex={startIndex}
                            />
                        ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-4 py-12 text-muted-foreground">
                                <MaterialIcon name="search_off" size="xl" className="opacity-20" />
                                <p className="font-bold">검색 결과가 없습니다.</p>
                            </div>
                        )}
                    </div>

                    <LinkedOperationPanel
                        totalRemainingRefund={totalRemainingRefund}
                        totalExpectedRefund={totalExpectedRefund}
                        totalPaidRefund={totalPaidRefund}
                        topRemaining={topRemaining}
                    />
                </div>
            </div>

            <div className="z-20 shrink-0 bg-transparent lg:border-t lg:border-white/[0.08] lg:bg-[#161B22]">
                <div className="flex items-center justify-between px-6 py-3">
                    <p className="text-xs text-gray-400">
                        총 <span className="font-bold text-white">{totalCount.toLocaleString()}명</span> 중{' '}
                        <span className="text-white">{Math.min(from + 1, totalCount)}-{Math.min(to + 1, totalCount)}</span> 표시
                    </p>
                    <div className="flex items-center gap-1">
                        <Link href={getPageLink(Math.max(1, normalizedPage - 1))} className={`flex size-7 items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 ${normalizedPage <= 1 ? 'pointer-events-none opacity-50' : ''}`}>
                            <MaterialIcon name="chevron_left" size="sm" />
                        </Link>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                            const targetPage = Math.max(1, Math.min(totalPages - 4, normalizedPage - 2)) + index;
                            if (targetPage < 1 || targetPage > totalPages) return null;
                            return (
                                <Link key={targetPage} href={getPageLink(targetPage)} className={`flex size-7 items-center justify-center rounded border text-xs font-bold ${targetPage === normalizedPage ? 'border-primary bg-primary/10 text-primary' : 'border-white/[0.08] bg-[#161B22] text-gray-400'}`}>
                                    {targetPage}
                                </Link>
                            );
                        })}
                        <Link href={getPageLink(Math.min(totalPages, normalizedPage + 1))} className={`flex size-7 items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 ${normalizedPage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}>
                            <MaterialIcon name="chevron_right" size="sm" />
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
