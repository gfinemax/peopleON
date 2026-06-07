import type { RecentActivitySummary } from '@/lib/server/activityFeed';
import {
    getDisplayMemberStatus,
    isSettlementTarget,
} from '@/lib/members/unifiedPersonUtils';
import {
    comparePeople,
    filterMembers,
    getPageRange,
    getRelationFilterData,
    getRoleCounts,
    getStatusCounts,
    getTierCounts,
    isRoleMatch,
    normalizeTierFilter,
} from '@/lib/members/membersPageUtils';
import type { UnifiedPerson } from '@/services/memberAggregation';

export const DEFAULT_MEMBERS_TABLE_PAGE_SIZE = 50;
export const MAX_MEMBERS_TABLE_PAGE_SIZE = 200;
const DEFAULT_SORT_FIELD = 'name';
const ALLOWED_SORT_FIELDS = new Set([
    'name',
    'member_number',
    'phone',
    'tier',
    'status',
    'settlement_remaining',
    'settlement_expected',
]);

export type MembersTableQuery = {
    query: string;
    sortField: string;
    sortOrder: 'asc' | 'desc';
    page: number;
    pageSize: number;
    roleFilter: string;
    tierFilter: string;
    statusFilter: string;
    relFilter: string;
    tagFilter: string;
};

export type MembersTableRow = {
    id: string;
    entity_ids: string[];
    member_id: string | null;
    party_id: string | null;
    name: string;
    phone: string | null;
    certificate_display: string | null;
    certificate_numbers?: string[];
    tier: string | null;
    tiers?: string[];
    unit_group: string | null;
    address_legal: string | null;
    status: string | null;
    display_status: string;
    is_registered: boolean;
    is_favorite?: boolean;
    tags?: string[] | null;
    role_types: UnifiedPerson['role_types'];
    source_type: UnifiedPerson['source_type'];
    ui_role: UnifiedPerson['ui_role'];
    relationships?: UnifiedPerson['relationships'];
    settlement_status: UnifiedPerson['settlement_status'];
    settlement_expected: number;
    settlement_paid: number;
    settlement_remaining: number;
    is_settlement_eligible: boolean;
    raw_certificate_count: number;
    managed_certificate_count: number;
    has_merged_certificates: boolean;
    recent_activity_summary: string | null;
    recent_activity_title: string | null;
    recent_activity_time: string | null;
    matched_log: boolean;
};

export function getMembersTablePagePeople({
    unifiedPeople,
    matchedEntityIds,
    query,
}: {
    unifiedPeople: UnifiedPerson[];
    matchedEntityIds: Set<string>;
    query: MembersTableQuery;
}) {
    const peopleInCurrentRole = unifiedPeople.filter((person) => isRoleMatch(person, query.roleFilter));
    const filteredPeople = filterMembers({
        peopleInCurrentRole,
        query: query.query,
        tierFilter: query.tierFilter,
        statusFilter: query.statusFilter,
        relFilter: query.relFilter,
        tagFilter: query.tagFilter,
        matchedEntityIds,
    });
    const sortedPeople = [...filteredPeople].sort((left, right) =>
        comparePeople(left, right, query.sortField, query.sortOrder),
    );

    const totalCount = sortedPeople.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / query.pageSize));
    const page = Math.min(query.page, totalPages);
    const { from, to } = getPageRange(page, query.pageSize);

    return {
        peopleInCurrentRole,
        filteredPeople,
        sortedPeople,
        pageSlice: sortedPeople.slice(from, to + 1),
        totalCount,
        totalPages,
        page,
        from,
        to,
    };
}

export function parseMembersTableQuery(url: URL): MembersTableQuery {
    const rawSortField = url.searchParams.get('sort') || DEFAULT_SORT_FIELD;
    const rawSortOrder = url.searchParams.get('order') === 'desc' ? 'desc' : 'asc';
    const rawPage = Number(url.searchParams.get('page') || 1);
    const rawPageSize = Number(url.searchParams.get('pageSize') || DEFAULT_MEMBERS_TABLE_PAGE_SIZE);

    return {
        query: (url.searchParams.get('q') || '').trim(),
        sortField: ALLOWED_SORT_FIELDS.has(rawSortField) ? rawSortField : DEFAULT_SORT_FIELD,
        sortOrder: rawSortOrder,
        page: Math.max(1, Number.isFinite(rawPage) ? Math.floor(rawPage) : 1),
        pageSize: Math.min(
            MAX_MEMBERS_TABLE_PAGE_SIZE,
            Math.max(1, Number.isFinite(rawPageSize) ? Math.floor(rawPageSize) : DEFAULT_MEMBERS_TABLE_PAGE_SIZE),
        ),
        roleFilter: url.searchParams.get('role') || 'all',
        tierFilter: normalizeTierFilter(url.searchParams.get('tier') || undefined),
        statusFilter: url.searchParams.get('status') || 'all',
        relFilter: url.searchParams.get('rel') || 'all',
        tagFilter: (url.searchParams.get('tag') || '').trim(),
    };
}

export function buildMembersTablePayload({
    unifiedPeople,
    matchedEntityIds,
    recentActivitiesByPerson,
    query,
}: {
    unifiedPeople: UnifiedPerson[];
    matchedEntityIds: Set<string>;
    recentActivitiesByPerson: Map<string, RecentActivitySummary>;
    query: MembersTableQuery;
}) {
    const {
        peopleInCurrentRole,
        pageSlice,
        totalCount,
        totalPages,
        page,
        from,
        to,
    } = getMembersTablePagePeople({
        unifiedPeople,
        matchedEntityIds,
        query,
    });

    const rows: MembersTableRow[] = pageSlice.map((person) => {
        const recentActivity = recentActivitiesByPerson.get(person.id);

        return {
            id: person.id,
            entity_ids: person.entity_ids,
            member_id: person.member_id,
            party_id: person.party_id,
            name: person.name,
            phone: person.phone,
            certificate_display: person.certificate_display || null,
            certificate_numbers: person.certificate_numbers,
            tier: person.tier,
            tiers: person.tiers,
            unit_group: person.unit_group,
            address_legal: person.address_legal || null,
            status: person.status,
            display_status: getDisplayMemberStatus(person),
            is_registered: person.is_registered,
            is_favorite: person.is_favorite,
            tags: person.tags,
            role_types: person.role_types,
            source_type: person.source_type,
            ui_role: person.ui_role,
            relationships: person.relationships,
            settlement_status: person.settlement_status,
            settlement_expected: person.settlement_expected,
            settlement_paid: person.settlement_paid,
            settlement_remaining: person.settlement_remaining,
            is_settlement_eligible: isSettlementTarget(person),
            raw_certificate_count: person.raw_certificate_count,
            managed_certificate_count: person.managed_certificate_count,
            has_merged_certificates: person.has_merged_certificates,
            recent_activity_summary: recentActivity?.summary || null,
            recent_activity_title: recentActivity?.title || null,
            recent_activity_time: recentActivity?.relativeTime || null,
            matched_log: Boolean(
                query.query &&
                person.entity_ids.some((entityId) => matchedEntityIds.has(entityId)),
            ),
        };
    });

    const { relationNames, relCounts } = getRelationFilterData(unifiedPeople);

    return {
        success: true,
        generated_at: new Date().toISOString(),
        query,
        rows,
        pagination: {
            page,
            page_size: query.pageSize,
            total_count: totalCount,
            total_pages: totalPages,
            from,
            to: Math.min(to, Math.max(totalCount - 1, 0)),
            has_previous: page > 1,
            has_next: page < totalPages,
        },
        filters: {
            absolute_total_count: unifiedPeople.length,
            role_counts: getRoleCounts(unifiedPeople),
            tier_counts: getTierCounts(peopleInCurrentRole),
            status_counts: getStatusCounts(unifiedPeople),
            relation_names: relationNames,
            relation_counts: relCounts,
        },
    };
}
