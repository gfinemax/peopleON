import { type UnifiedPerson } from '@/services/memberAggregation';

import {
    collectSourceCertificateOccurrences,
    normalizeSourceCertificateKey,
    partitionSourceCertificateOccurrences,
} from '@/lib/members/unifiedPersonUtils';

export type MemberHeldDetail = {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
    sourceCount: number;
    sourceNumbers: string[];
    excludedSourceNumbers: string[];
    rightsFlow: string;
};

export type DuplicateSourceDetail = {
    id: string;
    number: string;
    duplicateCount: number;
    registeredCount: number;
    refundCount: number;
    holders: { id: string; name: string; isRegistered: boolean; phone?: string | null; address?: string | null }[];
};

export type SourceCertificateSummary = {
    registeredInternalDistinctCount: number;
    registeredCertificateHolderCount: number;
    certificateTotalCount: number;
    refundCertificateCount: number;
    duplicateExcludedCount: number;
    allSourceDetails: MemberHeldDetail[];
    memberHeldDetails: MemberHeldDetail[];
    memberHeldDetailsInternal: MemberHeldDetail[];
    refundSourceDetails: MemberHeldDetail[];
    duplicateSourceDetails: DuplicateSourceDetail[];
};

function sortSourceDetails(left: MemberHeldDetail, right: MemberHeldDetail) {
    if (right.sourceCount !== left.sourceCount) return right.sourceCount - left.sourceCount;
    if (right.excludedSourceNumbers.length !== left.excludedSourceNumbers.length) {
        return right.excludedSourceNumbers.length - left.excludedSourceNumbers.length;
    }
    return left.name.localeCompare(right.name, 'ko-KR');
}

function buildMemberHeldDetails(
    people: UnifiedPerson[],
    includedSourceNumbersByPerson: Map<string, string[]>,
    excludedSourceNumbersByPerson: Map<string, string[]>,
): MemberHeldDetail[] {
    return people
        .map((person) => ({
            id: person.id,
            name: person.name,
            phone: person.phone,
            address: person.address_legal || null,
            sourceCount: (includedSourceNumbersByPerson.get(person.id) || []).length,
            sourceNumbers: includedSourceNumbersByPerson.get(person.id) || [],
            excludedSourceNumbers: excludedSourceNumbersByPerson.get(person.id) || [],
            rightsFlow: `${person.raw_certificate_count}→${person.managed_certificate_count}`,
        }))
        .filter((person) => person.sourceCount > 0 || person.excludedSourceNumbers.length > 0)
        .sort(sortSourceDetails);
}

export function buildSourceCertificateSummary(people: UnifiedPerson[]): SourceCertificateSummary {
    const sourceCertificateOccurrences = collectSourceCertificateOccurrences(people);
    const { uniqueSourceOccurrences, duplicateSourceOccurrences, excludedSourceOccurrences } =
        partitionSourceCertificateOccurrences(sourceCertificateOccurrences);
    const registeredSourceOccurrences = sourceCertificateOccurrences.filter((occurrence) => occurrence.isRegistered);
    const registeredInternalDistinctCount = new Set(registeredSourceOccurrences.map((occurrence) => occurrence.key)).size;

    const registeredCertificateHolderCount = uniqueSourceOccurrences.filter((occurrence) => occurrence.isRegistered).length;
    const certificateTotalCount = uniqueSourceOccurrences.length;
    const refundCertificateCount = uniqueSourceOccurrences.filter((occurrence) => !occurrence.isRegistered).length;

    const includedSourceNumbersByPerson = new Map<string, string[]>();
    for (const occurrence of uniqueSourceOccurrences) {
        const list = includedSourceNumbersByPerson.get(occurrence.personId) || [];
        list.push(occurrence.number);
        includedSourceNumbersByPerson.set(occurrence.personId, list);
    }

    const excludedSourceNumbersByPerson = new Map<string, string[]>();
    for (const occurrence of excludedSourceOccurrences) {
        const list = excludedSourceNumbersByPerson.get(occurrence.personId) || [];
        list.push(occurrence.number);
        excludedSourceNumbersByPerson.set(occurrence.personId, list);
    }

    const allSourceDetails = buildMemberHeldDetails(
        people,
        includedSourceNumbersByPerson,
        excludedSourceNumbersByPerson,
    );

    const memberHeldDetails = buildMemberHeldDetails(
        people.filter((person) => person.is_registered),
        includedSourceNumbersByPerson,
        excludedSourceNumbersByPerson,
    );

    const registeredInternalNumbersByPerson = new Map<string, string[]>();
    for (const occurrence of registeredSourceOccurrences) {
        const list = registeredInternalNumbersByPerson.get(occurrence.personId) || [];
        if (!list.some((item) => normalizeSourceCertificateKey(item) === occurrence.key)) {
            list.push(occurrence.number);
            registeredInternalNumbersByPerson.set(occurrence.personId, list);
        }
    }

    const memberHeldDetailsInternal = people
        .filter((person) => person.is_registered)
        .map((person) => ({
            id: person.id,
            name: person.name,
            phone: person.phone,
            address: person.address_legal || null,
            sourceCount: (registeredInternalNumbersByPerson.get(person.id) || []).length,
            sourceNumbers: registeredInternalNumbersByPerson.get(person.id) || [],
            excludedSourceNumbers: [],
            rightsFlow: `${person.raw_certificate_count}→${person.managed_certificate_count}`,
        }))
        .filter((person) => person.sourceCount > 0)
        .sort(sortSourceDetails);

    const refundSourceDetails = buildMemberHeldDetails(
        people.filter((person) => !person.is_registered),
        includedSourceNumbersByPerson,
        excludedSourceNumbersByPerson,
    );

    const duplicateSourceDetails = duplicateSourceOccurrences
        .map((occurrences, index) => {
            const holders = [...occurrences].sort((left, right) => {
                if (left.isRegistered !== right.isRegistered) return left.isRegistered ? -1 : 1;
                return left.name.localeCompare(right.name, 'ko-KR');
            });
            const representative = [...occurrences].sort((left, right) => right.number.length - left.number.length)[0];
            return {
                id: `${representative.key}-${index}`,
                number: representative.number,
                duplicateCount: occurrences.length,
                registeredCount: occurrences.filter((occurrence) => occurrence.isRegistered).length,
                refundCount: occurrences.filter((occurrence) => !occurrence.isRegistered).length,
                holders: holders.map((holder) => ({
                    id: holder.personId,
                    name: holder.name,
                    isRegistered: holder.isRegistered,
                    phone: holder.phone,
                    address: holder.address,
                })),
            };
        })
        .sort((left, right) => {
            if (right.duplicateCount !== left.duplicateCount) return right.duplicateCount - left.duplicateCount;
            return left.number.localeCompare(right.number, 'ko-KR');
        });

    return {
        registeredInternalDistinctCount,
        registeredCertificateHolderCount,
        certificateTotalCount,
        refundCertificateCount,
        duplicateExcludedCount: duplicateSourceOccurrences.length,
        allSourceDetails,
        memberHeldDetails,
        memberHeldDetailsInternal,
        refundSourceDetails,
        duplicateSourceDetails,
    };
}
