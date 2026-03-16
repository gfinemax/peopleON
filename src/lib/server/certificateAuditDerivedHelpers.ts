import {
    LEGACY_MEMBER_SEGMENT_LABEL_MAP,
    type LegacyMemberSegment,
} from '@/lib/legacy/memberSegments';
import { getConfirmedCertificateNumbers } from '@/lib/certificates/rightNumbers';
import type {
    BaseLegacyRecord,
    EnrichedLegacyRecord,
    FinanceCertificateRow,
    MembershipRoleLiteRow,
    RegisteredEntityLiteRow,
} from '@/lib/server/certificateAuditTypes';

export function getCertificateAuditSortValue(record: EnrichedLegacyRecord, sortField: string): string | number {
    switch (sortField) {
        case 'original_name':
            return record.original_name;
        case 'owner_name':
            return record.owner_name;
        case 'source_file':
            return record.source_file;
        case 'member_segment':
            return LEGACY_MEMBER_SEGMENT_LABEL_MAP[record.member_segment];
        case 'certificate_count':
        default:
            return record.certificate_count;
    }
}

function sanitizeCertificateNumber(value: string | null | undefined) {
    if (!value) return null;
    const trimmed = value.trim();
    if (trimmed.startsWith('19')) return null;
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(trimmed)) return null;
    return trimmed;
}

export function buildCertificateAuditRolesMap(allRoles: MembershipRoleLiteRow[]) {
    const rolesMap = new Map<string, MembershipRoleLiteRow[]>();

    for (const role of allRoles) {
        const existing = rolesMap.get(role.entity_id) || [];
        existing.push(role);
        rolesMap.set(role.entity_id, existing);
    }

    return rolesMap;
}

export function buildCertificateAuditRegisteredMembers(
    registeredEntities: RegisteredEntityLiteRow[],
    allRoles: MembershipRoleLiteRow[],
) {
    const registeredEntityIds = new Set(
        allRoles.filter((role) => role.is_registered).map((role) => role.entity_id),
    );

    return registeredEntities
        .filter((entity) => registeredEntityIds.has(entity.id))
        .map((member) => ({
            id: member.id,
            name: member.display_name,
        }));
}

export function buildCertificateAuditBaseLegacyRecords(
    allRights: FinanceCertificateRow[],
    rolesMap: Map<string, MembershipRoleLiteRow[]>,
) {
    const entitiesProcessed = new Set<string>();
    const baseRecords: BaseLegacyRecord[] = allRights.map((right) => {
        const entity = Array.isArray(right.account_entities)
            ? right.account_entities[0] || null
            : right.account_entities || null;

        if (entity) {
            entitiesProcessed.add(entity.id);
        }

        const contact =
            entity?.phone ||
            (typeof right.meta.contact === 'string' ? right.meta.contact : '-') ||
            '-';

        const certNumbers = getConfirmedCertificateNumbers([right])
            .map((number) => sanitizeCertificateNumber(number))
            .filter(Boolean) as string[];

        const entityRoles = entity ? (rolesMap.get(entity.id) || []) : [];
        const isRegistered = entityRoles.some((role) => role.is_registered);
        const activeRoleCode = entityRoles[0]?.role_code || '';

        let segment: LegacyMemberSegment = 'reserve_member';
        if (isRegistered) segment = 'registered_116';
        else if (right.status === 'refunded') segment = 'refunded';
        else if (activeRoleCode === '권리증보유자') segment = 'investor';
        else if (activeRoleCode.includes('2차')) segment = 'second_member';
        else if (activeRoleCode.includes('지주')) segment = 'landlord_member';
        else if (activeRoleCode.includes('일반')) segment = 'general_sale';

        return {
            id: right.id,
            original_name:
                (typeof right.meta.cert_name === 'string' ? right.meta.cert_name : null) ||
                entity?.display_name ||
                '-',
            source_file: typeof right.meta.source === 'string' ? right.meta.source : '-',
            raw_data: right.meta || {},
            member_id: right.entity_id,
            member_segment: segment,
            certificate_numbers: certNumbers,
            certificate_count: certNumbers.length,
            contact,
            member_name: entity?.display_name || null,
        };
    });

    return { baseRecords, entitiesProcessed };
}

export function enrichCertificateAuditLegacyRecords(baseRecords: BaseLegacyRecord[]) {
    return baseRecords.map<EnrichedLegacyRecord>((record) => ({
        id: record.id,
        original_name: record.original_name,
        source_file: record.source_file,
        raw_data: record.raw_data,
        member_id: record.member_id,
        member_segment: record.member_segment,
        certificate_numbers: record.certificate_numbers,
        certificate_count: record.certificate_count,
        contact: record.contact,
        owner_name: record.member_name || record.original_name,
        owner_type: record.member_id ? 'member_linked' : 'legacy_only',
    }));
}

export function getCertificateAuditSearchScopedRecords(records: EnrichedLegacyRecord[], query: string) {
    const lowerQuery = query.toLowerCase();

    if (!lowerQuery) {
        return records;
    }

    return records.filter((record) => {
        if (record.original_name.toLowerCase().includes(lowerQuery)) return true;
        if (record.owner_name.toLowerCase().includes(lowerQuery)) return true;
        if (record.contact !== '-' && record.contact.toLowerCase().includes(lowerQuery)) return true;
        return record.certificate_numbers.some((number) => number.toLowerCase().includes(lowerQuery));
    });
}
