import { type UnifiedPerson } from '@/services/memberAggregation';

export type SourceCertificateOccurrence = {
    personId: string;
    name: string;
    isRegistered: boolean;
    phone: string | null;
    address: string | null;
    number: string;
    key: string;
    rightsFlow: string;
};

export const hiddenMemberStatusValues = new Set(['비조합원', '미정', '소송']);

export const splitSourceCertificateDisplay = (value?: string | null) =>
    (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== '-')
        .filter((item) => !item.includes('[통합]'));

export const normalizeSourceCertificateKey = (value: string) =>
    value.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/\s+/g, '').toLowerCase();

export const isSettlementTarget = (person: UnifiedPerson) => {
    if (person.is_registered) {
        return ['탈퇴', '제명'].includes(person.status || '');
    }

    return person.role_types.includes('certificate_holder');
};

export const isSimpleCertificateHolder = (person: UnifiedPerson) => {
    const roles = person.role_types || [];
    return !person.is_registered && roles.length === 1 && roles[0] === 'certificate_holder';
};

export const getDisplayMemberStatus = (person: UnifiedPerson) => {
    if (isSimpleCertificateHolder(person)) {
        return '환불';
    }

    return person.status || '기타';
};

export const collectSourceCertificateOccurrences = (
    people: UnifiedPerson[],
): SourceCertificateOccurrence[] =>
    people.flatMap((person) =>
        splitSourceCertificateDisplay(person.certificate_display).map((number) => ({
            personId: person.id,
            name: person.name,
            isRegistered: person.is_registered,
            phone: person.phone,
            address: person.address_legal || null,
            number,
            key: normalizeSourceCertificateKey(number),
            rightsFlow: `${person.raw_certificate_count}→${person.managed_certificate_count}`,
        })),
    );

export function partitionSourceCertificateOccurrences(occurrences: SourceCertificateOccurrence[]) {
    const occurrencesByKey = new Map<string, SourceCertificateOccurrence[]>();

    for (const occurrence of occurrences) {
        const list = occurrencesByKey.get(occurrence.key) || [];
        list.push(occurrence);
        occurrencesByKey.set(occurrence.key, list);
    }

    const groups = Array.from(occurrencesByKey.values());
    const uniqueSourceOccurrences = groups
        .filter((group) => group.length === 1)
        .map(([occurrence]) => occurrence);
    const duplicateSourceOccurrences = groups.filter((group) => group.length > 1);

    return {
        occurrencesByKey,
        uniqueSourceOccurrences,
        duplicateSourceOccurrences,
    };
}
