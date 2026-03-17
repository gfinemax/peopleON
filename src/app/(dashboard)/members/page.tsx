import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { MembersKpiStrip } from '@/components/features/members/MembersKpiStrip';
import { DashboardManager } from '@/components/features/members/DashboardManager';
import { MemberActions } from '@/components/features/members/MemberActions';
import { MembersDataSection } from '@/components/features/members/MembersPageSections';
import { fetchPersonCertificateSummarySnapshot } from '@/lib/server/personCertificateSummary';
import { fetchRecentActivitySummariesSnapshotForPeople } from '@/lib/server/activityFeed';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';
import {
    getDisplayMemberStatus,
    isSettlementTarget,
} from '@/lib/members/unifiedPersonUtils';
import { buildSourceCertificateSummary } from '@/lib/members/sourceCertificateSummary';
import {
    buildMembersPageLink,
    comparePeople,
    filterMembers,
    getPageRange,
    getRelationFilterData,
    getRoleCounts,
    getStatusCounts,
    getTierCounts,
    isRoleMatch,
    MembersSearchParams,
    normalizeTierFilter,
} from '@/lib/members/membersPageUtils';

export const dynamic = 'force-dynamic';
const TOTAL_HOUSEHOLDS = 254;

export default async function MembersPage({
    searchParams,
}: {
    searchParams: Promise<MembersSearchParams>;
}) {
    const params = (await searchParams) || {};
    const query = params.q?.trim() || '';
    const sortField = params.sort || 'name';
    const sortOrder = (params.order as 'asc' | 'desc') || 'asc';
    const page = Math.max(1, Number(params.page) || 1);
    const roleFilter = params.role || 'all';
    const tierFilter = normalizeTierFilter(params.tier);
    const statusFilter = params.status || 'all';
    const relFilter = params.rel || 'all';
    const tagFilter = params.tag?.trim() || '';
    const pageSize = 50;

    const supabase = await createClient();

    const unifiedPeople = await getUnifiedMembersSnapshot();
    const personCertificateSnapshot = await fetchPersonCertificateSummarySnapshot(supabase);

    // --- Search History Integration ---
    const matchedEntityIds = new Set<string>();
    if (query) {
        const { data, error } = await supabase
            .from('interaction_logs')
            .select('entity_id')
            .ilike('summary', `%${query}%`);

        if (error) console.error("Search history error:", error);
        if (data) data.forEach(log => matchedEntityIds.add(log.entity_id));
    }
    // -----------------------------------

    const peopleInCurrentRole = unifiedPeople.filter((person) => isRoleMatch(person, roleFilter));
    const tierCounts = getTierCounts(peopleInCurrentRole);
    const roleCounts = getRoleCounts(unifiedPeople);
    const filteredPeople = filterMembers({
        peopleInCurrentRole,
        query,
        tierFilter,
        statusFilter,
        relFilter,
        tagFilter,
        matchedEntityIds,
    });

    const sortedPeople = [...filteredPeople].sort((a, b) => comparePeople(a, b, sortField, sortOrder));
    const totalCount = sortedPeople.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const normalizedPage = Math.min(page, totalPages);
    const { from, to } = getPageRange(normalizedPage, pageSize);

    // --- Performance Optimization: Fetch activities ONLY for displayed page ---
    const pageSlice = sortedPeople.slice(from, to + 1);
    const recentActivitiesByPerson = await fetchRecentActivitySummariesSnapshotForPeople(pageSlice);
    // --------------------------------------------------------------------------

    const displayedMembers = pageSlice.map(p => ({
        ...p,
        is_settlement_eligible: isSettlementTarget(p),
        display_status: getDisplayMemberStatus(p),
        _matchedLog: !!(query && Array.isArray(p.entity_ids) && p.entity_ids.some(id => matchedEntityIds.has(id))),
        recent_activity_summary: recentActivitiesByPerson.get(p.id)?.summary || null,
        recent_activity_title: recentActivitiesByPerson.get(p.id)?.title || null,
        recent_activity_time: recentActivitiesByPerson.get(p.id)?.relativeTime || null,
    }));

    const { relationNames, relCounts } = getRelationFilterData(unifiedPeople);

    const totalExpectedRefund = unifiedPeople.reduce((sum: number, p: any) => sum + p.settlement_expected, 0);
    const totalPaidRefund = unifiedPeople.reduce((sum: number, p: any) => sum + p.settlement_paid, 0);
    const totalRemainingRefund = unifiedPeople.reduce((sum: number, p: any) => sum + p.settlement_remaining, 0);
    const registeredCount = unifiedPeople.filter(p => p.is_registered).length;
    const {
        registeredInternalDistinctCount,
        registeredCertificateHolderCount,
        certificateTotalCount,
        refundCertificateCount,
        duplicateExcludedCount,
        allSourceDetails,
        memberHeldDetails,
        memberHeldDetailsInternal,
        refundSourceDetails,
        duplicateSourceDetails,
    } = buildSourceCertificateSummary(unifiedPeople);
    const reviewPendingCount = personCertificateSnapshot.rollups.reduce((sum: number, row: any) => sum + row.pending_review_count, 0);
    const additionalRecruitmentCount = Math.max(TOTAL_HOUSEHOLDS - registeredCount, 0);
    const relationPeople = unifiedPeople.filter(p => p.role_types.includes('agent') || p.role_types.includes('related_party'));
    const agentCount = relationPeople.filter(p => p.role_types.includes('agent')).length;
    const relationOtherCount = relationPeople.filter(p => !p.role_types.includes('agent') && p.role_types.includes('related_party')).length;
    const relationPeopleCount = agentCount + relationOtherCount;

    const statusCounts = getStatusCounts(unifiedPeople);

    const topRemaining = [...unifiedPeople]
        .filter(p => isSettlementTarget(p) && p.settlement_remaining > 0)
        .sort((a, b) => b.settlement_remaining - a.settlement_remaining)
        .slice(0, 5);

    return (
        <div className="flex-1 flex flex-col bg-background">
            <Header
                title="조합원 관리"
                iconName="person"
                leftContent={(
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <MaterialIcon name="groups" size="md" className="text-muted-foreground mr-[-2px]" />
                        <span className="text-[19px] font-bold text-foreground">전체 인물 {unifiedPeople.length.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">· 조회 <span className="text-primary">{totalCount.toLocaleString()}</span></span>
                    </div>
                )}
                rightContent={<MemberActions data={unifiedPeople} />}
            />

            <DashboardManager
                kpiSection={(
                    <MembersKpiStrip
                        key="members-kpi-section"
                        households={{
                            total: TOTAL_HOUSEHOLDS,
                            members: registeredCount,
                            recruitmentTarget: additionalRecruitmentCount,
                        }}
                        certificates={{
                            total: certificateTotalCount,
                            memberHeld: registeredCertificateHolderCount,
                            externalHeld: refundCertificateCount,
                            refundEligible: refundCertificateCount,
                            duplicateExcluded: duplicateExcludedCount,
                            registeredInternalDistinct: registeredInternalDistinctCount,
                        }}
                        allSourceDetails={allSourceDetails}
                        memberHeldDetails={memberHeldDetails}
                        memberHeldDetailsInternal={memberHeldDetailsInternal}
                        refundSourceDetails={refundSourceDetails}
                        duplicateSourceDetails={duplicateSourceDetails}
                        relations={{
                            total: relationPeopleCount,
                            agents: agentCount,
                            others: relationOtherCount,
                        }}
                    />
                )}
                qualitySection={null}
                filterData={{
                    roleCounts,
                    tierCounts,
                    statusCounts,
                    relCounts,
                    relationNames,
                    absoluteTotalCount: unifiedPeople.length,
                    filteredCount: totalCount,
                }}
            >
                <MembersDataSection
                    displayedMembers={displayedMembers}
                    filteredPeople={filteredPeople}
                    paramsKey={JSON.stringify(params)}
                    startIndex={from}
                    reviewPendingCount={reviewPendingCount}
                    duplicateExcludedCount={duplicateExcludedCount}
                    totalCount={totalCount}
                    from={from}
                    to={to}
                    normalizedPage={normalizedPage}
                    totalPages={totalPages}
                    totalRemainingRefund={totalRemainingRefund}
                    totalExpectedRefund={totalExpectedRefund}
                    totalPaidRefund={totalPaidRefund}
                    topRemaining={topRemaining}
                    getPageLink={(targetPage) => buildMembersPageLink({
                        query,
                        sortField,
                        sortOrder,
                        roleFilter,
                        tierFilter,
                        statusFilter,
                        relFilter,
                        tagFilter,
                        targetPage,
                    })}
                />
            </DashboardManager>
        </div>
    );
}
