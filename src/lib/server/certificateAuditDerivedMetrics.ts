import {
    LEGACY_MEMBER_SEGMENT_LABEL_MAP,
    type LegacyMemberSegment,
} from '@/lib/legacy/memberSegments';
import {
    normalizeCertificateNumber,
    resolveCertificateRight,
} from '@/lib/certificates/rightNumbers';
import type {
    DuplicateCountRow,
    EnrichedLegacyRecord,
    FinanceCertificateRow,
    LegacyExclusiveUniqueRow,
    ReviewRequiredRightRow,
    SegmentSummaryRow,
} from '@/lib/server/certificateAuditTypes';

const SEGMENT_ORDER: LegacyMemberSegment[] = [
    'registered_116',
    'reserve_member',
    'second_member',
    'landlord_member',
    'general_sale',
    'refunded',
    'investor',
];

export function buildCertificateAuditDerivedMetrics(args: {
    allRights: FinanceCertificateRow[];
    enrichedRecords: EnrichedLegacyRecord[];
    searchScopedRecords: EnrichedLegacyRecord[];
    segmentScopedRecords: EnrichedLegacyRecord[];
}) {
    const { allRights, enrichedRecords, searchScopedRecords, segmentScopedRecords } = args;

    const numberFrequency = new Map<string, number>();
    for (const number of searchScopedRecords.flatMap((record) => record.certificate_numbers)) {
        numberFrequency.set(number, (numberFrequency.get(number) || 0) + 1);
    }
    const duplicateNumbers = [...numberFrequency.entries()]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);

    const registeredBaseRecords = enrichedRecords.filter((record) => record.member_segment === 'registered_116');
    const registeredCertificateFrequency = new Map<string, number>();
    for (const number of registeredBaseRecords.flatMap((record) => record.certificate_numbers)) {
        const normalized = normalizeCertificateNumber(number);
        if (!normalized) continue;
        registeredCertificateFrequency.set(
            normalized,
            (registeredCertificateFrequency.get(normalized) || 0) + 1,
        );
    }

    const registeredMemberNumberSet = new Set(registeredCertificateFrequency.keys());
    const registeredMissingRightsRows = registeredBaseRecords.filter((record) => record.certificate_count === 0);
    const legacyBaseRecords = enrichedRecords.filter((record) => record.member_segment !== 'registered_116');
    const legacyNumberFrequency = new Map<string, number>();
    for (const number of legacyBaseRecords.flatMap((record) => record.certificate_numbers)) {
        legacyNumberFrequency.set(number, (legacyNumberFrequency.get(number) || 0) + 1);
    }

    const legacyNumberSet = new Set(legacyNumberFrequency.keys());
    const legacyDuplicateRows = [...legacyNumberFrequency.entries()]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);
    const legacyNonDuplicateCount = [...legacyNumberFrequency.values()].filter((count) => count === 1).length;

    const legacyRecordByNumber = new Map<string, EnrichedLegacyRecord>();
    for (const record of legacyBaseRecords) {
        for (const number of record.certificate_numbers) {
            if (!legacyRecordByNumber.has(number)) {
                legacyRecordByNumber.set(number, record);
            }
        }
    }

    const legacyExclusiveUniqueNumbers = [...legacyNumberFrequency.entries()]
        .filter(([number, count]) => count === 1 && !registeredMemberNumberSet.has(number))
        .map(([number]) => number)
        .sort((a, b) => a.localeCompare(b, 'ko'));

    const legacyExclusiveUniqueRows = legacyExclusiveUniqueNumbers.map<LegacyExclusiveUniqueRow>((number) => {
        const owner = legacyRecordByNumber.get(number);

        return {
            number,
            ownerName: owner?.original_name || '-',
            ownerSegmentLabel: owner ? LEGACY_MEMBER_SEGMENT_LABEL_MAP[owner.member_segment] : '-',
            contact: owner?.contact || '-',
            sourceFile: owner?.source_file || '-',
        };
    });

    const mergedNumberSet = new Set([...registeredMemberNumberSet, ...legacyNumberSet]);
    const overlapNumbers = [...registeredMemberNumberSet].filter((number) => legacyNumberSet.has(number));
    const registeredOnlyNumbers = [...registeredMemberNumberSet].filter((number) => !legacyNumberSet.has(number));
    const legacyOnlyNumbers = [...legacyNumberSet].filter((number) => !registeredMemberNumberSet.has(number));

    const mergedDuplicateRows = [...mergedNumberSet]
        .map<DuplicateCountRow>((number) => ({
            number,
            registeredCount: registeredCertificateFrequency.get(number) || 0,
            legacyCount: legacyNumberFrequency.get(number) || 0,
            totalCount:
                (registeredCertificateFrequency.get(number) || 0) +
                (legacyNumberFrequency.get(number) || 0),
        }))
        .filter((row) => row.totalCount > 1)
        .sort((a, b) => b.totalCount - a.totalCount);

    const registeredDuplicateRows = [...registeredCertificateFrequency.entries()]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);

    const segmentSummary = SEGMENT_ORDER.map<SegmentSummaryRow>((segment) => {
        const rows = searchScopedRecords.filter((record) => record.member_segment === segment);
        return {
            segment,
            ownerCount: rows.length,
            certificateCount: new Set(rows.flatMap((row) => row.certificate_numbers)).size,
        };
    });

    const refundedPriorityRows = searchScopedRecords
        .filter((record) => record.member_segment === 'refunded' && record.certificate_count > 0)
        .sort((a, b) => b.certificate_count - a.certificate_count)
        .slice(0, 8);

    const reviewRequiredRightRows = allRights
        .map<ReviewRequiredRightRow>((right) => {
            const resolved = resolveCertificateRight(right);
            const entity = Array.isArray(right.account_entities)
                ? right.account_entities[0] || null
                : right.account_entities || null;

            return {
                id: right.id,
                entityId: right.entity_id,
                ownerName: typeof right.meta.cert_name === 'string' ? right.meta.cert_name : entity?.display_name || '-',
                rawValue: resolved.rawValue || '-',
                status: resolved.status,
                note: resolved.note || '-',
            };
        })
        .filter((row) => row.status === 'review_required' || row.status === 'invalid')
        .sort((a, b) => a.ownerName.localeCompare(b.ownerName, 'ko'));

    const memberIdsFromLegacy = Array.from(
        new Set(
            segmentScopedRecords
                .map((record) => record.member_id)
                .filter((memberId): memberId is string => Boolean(memberId)),
        ),
    );

    return {
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
    };
}
