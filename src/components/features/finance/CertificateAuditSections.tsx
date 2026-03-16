import Link from 'next/link';
import type { ReactNode } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import { LegacyTable } from '@/components/features/finance/LegacyTable';
import type { LegacyMemberSegment } from '@/lib/legacy/memberSegments';
export {
    CertificateAuditLegacyExclusiveSection,
    CertificateAuditPersonSummarySection,
    CertificateAuditQualitySection,
    CertificateAuditReviewQueueSection,
    CertificateAuditSegmentOverviewSection,
    CertificateAuditStatisticsSection,
} from './CertificateAuditReportSections';

type SegmentSummaryRow = {
    segment: LegacyMemberSegment;
    ownerCount: number;
    certificateCount: number;
};

type RefundedPriorityRow = {
    id: string;
    original_name: string;
    certificate_count: number;
    contact: string;
};

type LegacyRecordRow = {
    id: string;
    original_name: string;
    owner_name: string;
    owner_type: 'member_linked' | 'certificate_holder_linked' | 'legacy_only';
    source_file: string;
    raw_data: Record<string, unknown>;
    member_id: string | null;
    certificate_numbers: string[];
    certificate_count: number;
    member_segment: LegacyMemberSegment;
    contact: string;
};

type QueryLinkBuilder = (next: { page?: number; status?: LegacyMemberSegment | 'all' }) => string;

export function CertificateAuditDetailSection({
    currentStatusLabel,
    totalCount,
    exportHref,
    pagedRecords,
    tableKey,
    from,
    to,
    safePage,
    totalPages,
    pageNumbers,
    getQueryLink,
}: {
    currentStatusLabel: string;
    totalCount: number;
    exportHref: string;
    pagedRecords: LegacyRecordRow[];
    tableKey: string;
    from: number;
    to: number;
    safePage: number;
    totalPages: number;
    pageNumbers: ReactNode;
    getQueryLink: QueryLinkBuilder;
}) {
    return (
        <section className="rounded-xl border border-white/[0.08] bg-card overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm lg:text-base font-extrabold text-foreground">권리증 상세 리스트</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold">
                        {currentStatusLabel}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">
                        총 <span className="font-bold text-foreground">{totalCount.toLocaleString()}건</span>
                    </p>
                    <a
                        href={exportHref}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors"
                    >
                        <MaterialIcon name="download" size="sm" />
                        엑셀 출력
                    </a>
                </div>
            </div>

            <div className="max-h-[520px] overflow-auto">
                {pagedRecords.length > 0 ? (
                    <LegacyTable records={pagedRecords} tableKey={tableKey} />
                ) : (
                    <div className="h-48 flex items-center justify-center text-muted-foreground">
                        검색 결과가 없습니다.
                    </div>
                )}
            </div>

            <div className="px-4 py-3 border-t border-white/[0.08] flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                    {totalCount === 0
                        ? '표시할 데이터가 없습니다.'
                        : `${from + 1}-${Math.min(to, totalCount)} / ${totalCount.toLocaleString()}건`}
                </p>
                <div className="flex items-center gap-1">
                    <Link
                        href={getQueryLink({ page: Math.max(1, safePage - 1) })}
                        className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20 transition-all ${safePage <= 1 ? 'pointer-events-none opacity-50' : ''}`}
                    >
                        <MaterialIcon name="chevron_left" size="sm" />
                    </Link>
                    {pageNumbers}
                    <Link
                        href={getQueryLink({ page: Math.min(totalPages, safePage + 1) })}
                        className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20 transition-all ${safePage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
                    >
                        <MaterialIcon name="chevron_right" size="sm" />
                    </Link>
                </div>
            </div>
        </section>
    );
}
