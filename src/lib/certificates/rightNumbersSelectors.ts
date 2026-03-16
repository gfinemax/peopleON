import type { AssetRightCertificateRow, RightNumberStatus } from '@/lib/certificates/rightNumbersCore';
import { resolveCertificateRight } from '@/lib/certificates/rightNumbersCore';

const uniqueStrings = (values: Array<string | null | undefined>) =>
    Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));

export const getResolvedCertificateRights = (rights: AssetRightCertificateRow[] | null | undefined) =>
    (rights || [])
        .filter((right) => right.right_type === 'certificate')
        .map(resolveCertificateRight);

export const getConfirmedCertificateNumbers = (rights: AssetRightCertificateRow[] | null | undefined) => {
    const resolved = getResolvedCertificateRights(rights);
    const deduped = new Map<string, string>();

    for (const right of resolved) {
        if (!right.confirmedNumber || !right.normalizedKey) continue;
        const previous = deduped.get(right.normalizedKey);
        if (!previous || right.confirmedNumber.length > previous.length) {
            deduped.set(right.normalizedKey, right.confirmedNumber);
        }
    }

    return Array.from(deduped.values());
};

export const getCertificateSearchTokens = (rights: AssetRightCertificateRow[] | null | undefined) =>
    uniqueStrings([
        ...getResolvedCertificateRights(rights).map((right) => right.rawValue),
        ...getResolvedCertificateRights(rights).map((right) => right.confirmedNumber),
    ]);

const fallbackStatusLabel = (status: RightNumberStatus) => {
    switch (status) {
        case 'declared_owned':
            return '보유(미확정)';
        case 'pending':
            return '확인예정';
        case 'missing':
            return '없음';
        case 'invalid':
            return '오류';
        case 'review_required':
            return '검수필요';
        default:
            return '-';
    }
};

export const getCertificateDisplayText = (
    rights: AssetRightCertificateRow[] | null | undefined,
    options?: { includeFallbackStatus?: boolean },
) => {
    const confirmed = getConfirmedCertificateNumbers(rights);
    if (confirmed.length > 1) return confirmed.join(', ');
    if (confirmed.length === 1) return confirmed[0];

    if (!options?.includeFallbackStatus) return '-';

    const firstFallback = getResolvedCertificateRights(rights).find((right) => right.status !== 'confirmed');
    return firstFallback ? fallbackStatusLabel(firstFallback.status) : '-';
};
