import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import {
    CertificateAuditKpiCard,
} from '@/components/features/finance/CertificateAuditPrimitives';
import {
    CertificateAuditDetailSection,
    CertificateAuditLegacyExclusiveSection,
    CertificateAuditPersonSummarySection,
    CertificateAuditQualitySection,
    CertificateAuditReviewQueueSection,
    CertificateAuditSegmentOverviewSection,
    CertificateAuditStatisticsSection,
} from '@/components/features/finance/CertificateAuditSections';
import { LegacyFilter } from '@/components/features/finance/LegacyFilter';
import {
    LEGACY_MEMBER_SEGMENT_LABEL_MAP,
} from '@/lib/legacy/memberSegments';
import { fetchPersonCertificateSummarySnapshot } from '@/lib/server/personCertificateSummary';
import {
    buildCertificateAuditDerivedData,
    buildPersonSummaryAuditData,
    fetchCertificateAuditQualityMetrics,
    isLegacySegment,
    parseFinanceCertificateRows,
    type FinanceCertificateEntityRow,
    type MembershipRoleLiteRow,
    type RegisteredEntityLiteRow,
    type StatusFilter,
} from '@/lib/server/certificateAudit';

export const dynamic = 'force-dynamic';

export default async function FinancePage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; status?: string; sort?: string; order?: string; page?: string }>;
}) {
    const params = await searchParams;
    const query = params?.q?.trim() || '';
    const sortField = (params?.sort === 'rights_count' ? 'certificate_count' : params?.sort) || 'certificate_count';
    const sortOrder = params?.order === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, Number(params?.page) || 1);
    const statusParam = params?.status || 'all';
    const statusFilter: StatusFilter = statusParam === 'all'
        ? 'all'
        : isLegacySegment(statusParam)
            ? statusParam
            : 'all';

    const supabase = await createClient();

    const [rightsRes, rolesRes, registeredEntitiesRes, personCertificateSnapshot] = await Promise.all([
        supabase
            .from('certificate_registry')
            .select(`
                id,
                entity_id,
                certificate_number_normalized,
                certificate_number_raw,
                certificate_status,
                source_type,
                note,
                is_active,
                account_entities (
                    id,
                    display_name,
                    phone
                )
            `)
            .eq('is_active', true),
        supabase
            .from('membership_roles')
            .select('entity_id, role_code, is_registered'),
        supabase
            .from('account_entities')
            .select('id, display_name, member_number, phone')
            .eq('entity_type', 'person'),
        fetchPersonCertificateSummarySnapshot(supabase),
    ]);

    const allRights = parseFinanceCertificateRows(
        ((rightsRes.data || []) as unknown) as Array<{
            id: string;
            entity_id: string;
            certificate_number_normalized: string | null;
            certificate_number_raw: string | null;
            certificate_status: string | null;
            source_type: string | null;
            note: unknown;
            account_entities?: FinanceCertificateEntityRow[] | FinanceCertificateEntityRow | null;
        }>,
    );
    const rightsError = rightsRes.error;
    const allRoles = (rolesRes.data || []) as MembershipRoleLiteRow[];
    const personSummaryAvailable = personCertificateSnapshot.available;
    const registeredEntities = (registeredEntitiesRes.data || []) as RegisteredEntityLiteRow[];

    if (rightsError) {
        console.error('Error fetching certificate_registry:', rightsError.message);
    }

    const {
        registeredPersonRollup,
        othersPersonRollup,
        totalManualLockedCount,
        totalPendingReviewCount,
        registeredSummaryReviewRows,
    } = buildPersonSummaryAuditData(
        personCertificateSnapshot.rollups,
        personCertificateSnapshot.summaries,
    );

    const {
        pagedRecords,
        totalCount,
        totalPages,
        safePage,
        from,
        to,
        duplicateNumbers,
        registeredMemberNumberSet,
        registeredMissingRightsRows,
        legacyNumberSet,
        legacyDuplicateRows,
        legacyNonDuplicateCount,
        legacyExclusiveUniqueRows,
        mergedNumberSet,
        overlapNumbers,
        registeredOnlyNumbers,
        legacyOnlyNumbers,
        mergedDuplicateRows,
        registeredDuplicateRows,
        segmentSummary,
        refundedPriorityRows,
        reviewRequiredRightRows,
        memberIdsFromLegacy,
    } = buildCertificateAuditDerivedData({
        allRights,
        allRoles,
        registeredEntities,
        query,
        statusFilter,
        sortField,
        sortOrder,
        page,
    });

    const {
        memberWithoutPartyCount,
        settlementCaseMissingCount,
        finalRefundMissingCount,
        settlementStatusMismatchCount,
        qualityIssueCount,
    } = await fetchCertificateAuditQualityMetrics(supabase, memberIdsFromLegacy);

    const getQueryLink = (next: { page?: number; status?: StatusFilter }) => {
        const search = new URLSearchParams();
        if (query) search.set('q', query);
        if (next.status && next.status !== 'all') search.set('status', next.status);
        else if (statusFilter !== 'all' && !next.status) search.set('status', statusFilter);
        search.set('sort', sortField);
        search.set('order', sortOrder);
        search.set('page', String(next.page || 1));
        return `/certificate-audit?${search.toString()}`;
    };

    const renderPageNumbers = () => {
        if (totalPages <= 1) return null;
        const pages = [];
        const maxVisible = 5;
        let startPage = Math.max(1, safePage - Math.floor(maxVisible / 2));
        const endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(
                <Link
                    key={i}
                    href={getQueryLink({ page: i })}
                    className={`size-8 flex items-center justify-center rounded border transition-all text-sm font-bold ${i === safePage
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                        : 'border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20'
                        }`}
                >
                    {i}
                </Link>
            );
        }
        return pages;
    };

    const currentStatusLabel = statusFilter === 'all'
        ? '전체 상태'
        : LEGACY_MEMBER_SEGMENT_LABEL_MAP[statusFilter];
    const exportSearchParams = new URLSearchParams();
    if (query) exportSearchParams.set('q', query);
    if (statusFilter !== 'all') exportSearchParams.set('status', statusFilter);
    exportSearchParams.set('sort', sortField);
    exportSearchParams.set('order', sortOrder);
    const exportHref = `/api/finance/rights-details/export?${exportSearchParams.toString()}`;
    const legacyExclusiveExportHref = '/api/finance/certificate-audit/legacy-exclusive-export';

    return (
        <div className="flex flex-1 flex-col h-full bg-background overflow-hidden">
            <Header title="권리증 검수" />

            <main className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-5 px-4 py-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto w-full">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-1">
                            <h2 className="text-xl lg:text-2xl font-extrabold tracking-tight text-foreground">
                                권리증 검수센터
                            </h2>
                            <p className="text-xs lg:text-sm text-muted-foreground">
                                등기·레거시 권리증을 대조하고 중복, 미연결, 검수 필요 이슈를 운영 관점에서 정리합니다.
                            </p>
                            {rightsError && (
                                <p className="text-xs text-destructive font-bold">
                                    데이터 조회 오류: {rightsError.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        {personSummaryAvailable ? (
                            <>
                                <CertificateAuditKpiCard title="등기 최종 권리증" value={`${registeredPersonRollup.effective_certificate_count}개`} tone="emerald" />
                                <CertificateAuditKpiCard title="등기 잠정 권리증" value={`${registeredPersonRollup.provisional_certificate_count}개`} tone="blue" />
                                <CertificateAuditKpiCard title="기타 최종 권리증" value={`${othersPersonRollup.effective_certificate_count}개`} tone="amber" />
                                <CertificateAuditKpiCard title="수동 고정 인원" value={`${totalManualLockedCount}명`} tone="slate" />
                                <CertificateAuditKpiCard title="사람별 검수대기" value={`${totalPendingReviewCount}명`} tone="red" />
                                <CertificateAuditKpiCard title="등기 미보유 인원" value={`${Math.max(registeredPersonRollup.owner_count - registeredPersonRollup.owner_with_certificate_count, 0)}명`} tone="red" />
                            </>
                        ) : (
                            <>
                                <CertificateAuditKpiCard title="통합 권리증번호(A∪B)" value={`${mergedNumberSet.size}개`} tone="blue" />
                                <CertificateAuditKpiCard title="등기 권리증(A)" value={`${registeredMemberNumberSet.size}개`} tone="emerald" />
                                <CertificateAuditKpiCard title="Legacy 권리증(B, 비등기)" value={`${legacyNumberSet.size}개`} tone="amber" />
                                <CertificateAuditKpiCard title="교집합 중복(A∩B)" value={`${overlapNumbers.length}개`} tone="red" />
                                <CertificateAuditKpiCard title="등기만(A-B)" value={`${registeredOnlyNumbers.length}개`} tone="slate" />
                                <CertificateAuditKpiCard title="Legacy만(B-A)" value={`${legacyOnlyNumbers.length}개`} tone="slate" />
                            </>
                        )}
                    </div>
                    {personSummaryAvailable && (
                        <CertificateAuditPersonSummarySection
                            registeredPersonRollup={registeredPersonRollup}
                            othersPersonRollup={othersPersonRollup}
                            registeredSummaryReviewRows={registeredSummaryReviewRows}
                        />
                    )}
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        <CertificateAuditKpiCard title="통합 중복 의심" value={`${mergedDuplicateRows.length}개`} tone="red" />
                        <CertificateAuditKpiCard title="등기 내부 중복" value={`${registeredDuplicateRows.length}개`} tone="amber" />
                        <CertificateAuditKpiCard title="Legacy 내부 중복" value={`${legacyDuplicateRows.length}개`} tone="amber" />
                        <CertificateAuditKpiCard title="중복 없는 Legacy" value={`${legacyNonDuplicateCount}개`} tone="emerald" />
                        <CertificateAuditKpiCard title="중복없는 Legacy-등기제외" value={`${legacyExclusiveUniqueRows.length}개`} tone="blue" />
                        <CertificateAuditKpiCard title="등기 미연결" value={`${registeredMissingRightsRows.length}건`} tone="red" />
                    </div>
                    <CertificateAuditQualitySection
                        qualityIssueCount={qualityIssueCount}
                        memberWithoutPartyCount={memberWithoutPartyCount}
                        settlementCaseMissingCount={settlementCaseMissingCount}
                        finalRefundMissingCount={finalRefundMissingCount}
                        settlementStatusMismatchCount={settlementStatusMismatchCount}
                    />
                    <CertificateAuditReviewQueueSection reviewRequiredRightRows={reviewRequiredRightRows} />
                    <p className="text-[11px] text-muted-foreground px-1">
                        Legacy 내부 중복은 B(비등기 Legacy)에서 같은 권리증번호가 2건 이상인 번호 수입니다.
                    </p>

                    <LegacyFilter />

                    <CertificateAuditStatisticsSection
                        mergedDuplicateRows={mergedDuplicateRows}
                        registeredMissingRightsRows={registeredMissingRightsRows}
                    />

                    <CertificateAuditLegacyExclusiveSection
                        legacyExclusiveExportHref={legacyExclusiveExportHref}
                        legacyExclusiveUniqueRows={legacyExclusiveUniqueRows}
                    />

                    <CertificateAuditSegmentOverviewSection
                        segmentSummary={segmentSummary}
                        refundedPriorityRows={refundedPriorityRows}
                        duplicateNumbers={duplicateNumbers}
                        getQueryLink={getQueryLink}
                    />

                    <CertificateAuditDetailSection
                        currentStatusLabel={currentStatusLabel}
                        totalCount={totalCount}
                        exportHref={exportHref}
                        pagedRecords={pagedRecords}
                        tableKey={JSON.stringify({ ...params, page: safePage })}
                        from={from}
                        to={to}
                        safePage={safePage}
                        totalPages={totalPages}
                        pageNumbers={renderPageNumbers()}
                        getQueryLink={getQueryLink}
                    />
                </div>
            </main>
        </div>
    );
}
