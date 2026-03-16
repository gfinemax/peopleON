import {
    FinanceCertificateRow,
    MembershipRoleLiteRow,
    RegisteredEntityLiteRow,
    StatusFilter,
} from '@/lib/server/certificateAuditTypes';
import {
    buildCertificateAuditBaseLegacyRecords,
    buildCertificateAuditRegisteredMembers,
    buildCertificateAuditRolesMap,
    enrichCertificateAuditLegacyRecords,
    getCertificateAuditSearchScopedRecords,
    getCertificateAuditSortValue,
} from '@/lib/server/certificateAuditDerivedHelpers';
import { buildCertificateAuditDerivedMetrics } from '@/lib/server/certificateAuditDerivedMetrics';

export function buildCertificateAuditDerivedData({
    allRights,
    allRoles,
    registeredEntities,
    query,
    statusFilter,
    sortField,
    sortOrder,
    page,
}: {
    allRights: FinanceCertificateRow[];
    allRoles: MembershipRoleLiteRow[];
    registeredEntities: RegisteredEntityLiteRow[];
    query: string;
    statusFilter: StatusFilter;
    sortField: string;
    sortOrder: 'asc' | 'desc';
    page: number;
}) {
    const rolesMap = buildCertificateAuditRolesMap(allRoles);
    const registeredMembers = buildCertificateAuditRegisteredMembers(registeredEntities, allRoles);
    const { baseRecords, entitiesProcessed } = buildCertificateAuditBaseLegacyRecords(allRights, rolesMap);

    for (const member of registeredMembers) {
        if (entitiesProcessed.has(member.id)) continue;

        baseRecords.push({
            id: `v-${member.id}`,
            original_name: member.name || '-',
            source_file: 'RegisteredDB',
            raw_data: {},
            member_id: member.id,
            member_segment: 'registered_116',
            certificate_numbers: [],
            certificate_count: 0,
            contact: '-',
            member_name: member.name,
        });
    }

    const enrichedRecords = enrichCertificateAuditLegacyRecords(baseRecords);
    const searchScopedRecords = getCertificateAuditSearchScopedRecords(enrichedRecords, query);
    const segmentScopedRecords = statusFilter === 'all'
        ? searchScopedRecords
        : searchScopedRecords.filter((record) => record.member_segment === statusFilter);

    const sortedRecords = [...segmentScopedRecords].sort((leftRecord, rightRecord) => {
        const left = getCertificateAuditSortValue(leftRecord, sortField);
        const right = getCertificateAuditSortValue(rightRecord, sortField);
        const direction = sortOrder === 'asc' ? 1 : -1;

        if (typeof left === 'number' && typeof right === 'number') {
            return (left - right) * direction;
        }

        return String(left).localeCompare(String(right), 'ko') * direction;
    });

    const pageSize = 50;
    const totalCount = sortedRecords.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * pageSize;
    const to = from + pageSize;
    const pagedRecords = sortedRecords.slice(from, to);

    const metrics = buildCertificateAuditDerivedMetrics({
        allRights,
        enrichedRecords,
        searchScopedRecords,
        segmentScopedRecords,
    });

    return {
        enrichedRecords,
        pagedRecords,
        totalCount,
        totalPages,
        safePage,
        from,
        to,
        ...metrics,
    };
}
