export type RightNumberStatus =
    | 'confirmed'
    | 'declared_owned'
    | 'pending'
    | 'missing'
    | 'invalid'
    | 'review_required';

export const RIGHT_NUMBER_STATUS_OPTIONS: RightNumberStatus[] = [
    'confirmed',
    'declared_owned',
    'pending',
    'missing',
    'invalid',
    'review_required',
];

export const RIGHT_NUMBER_STATUS_LABEL: Record<RightNumberStatus, string> = {
    confirmed: '확정',
    declared_owned: '보유',
    pending: '확인예정',
    missing: '없음',
    invalid: '오류',
    review_required: '검수필요',
};

type AssetRightCertificateRow = {
    right_type?: string | null;
    right_number?: string | null;
    right_number_raw?: string | null;
    right_number_status?: string | null;
    right_number_note?: string | null;
};

export type ResolvedCertificateRight = {
    rawValue: string | null;
    confirmedNumber: string | null;
    normalizedKey: string | null;
    status: RightNumberStatus;
    note: string | null;
};

export type CertificateStorageFields = {
    right_number: string | null;
    right_number_raw: string | null;
    right_number_status: RightNumberStatus;
    right_number_note: string | null;
};

const DECLARED_OWNED_KEYWORDS = [
    '보유',
    '권리증보유',
    '권리보유',
    '권리증 있음',
    '있음',
    '소지',
];

const PENDING_KEYWORDS = [
    '차후',
    '추후',
    '나중',
    '확인후',
    '확인 후',
    '제출예정',
    '제출 예정',
    '쪽지로',
    '미제출',
    '추후통보',
    '추후 통보',
    '예정',
];

const MISSING_KEYWORDS = [
    '없음',
    '미보유',
    '해당없음',
    '해당 없음',
    '없다',
    'x',
    'null',
    'none',
];

const EXACT_MISSING_VALUES = new Set([
    '',
    '-',
    '--',
    'x',
    'X',
    'null',
    'NULL',
    'none',
    'None',
]);

const REVIEW_REQUIRED_KEYWORDS = [
    '분실',
    '구두',
    '참조',
    '메모',
    '외',
    '복수',
    '기존자료',
    '기존 자료',
];

const SUPPORTIVE_TOKENS = [
    '보유',
    '권리증',
    '권리증번호',
    '필증',
    '증서',
    '번호',
    '있음',
    '소지',
    '권리보유',
    '확정',
    '명의변경',
    '명의 변경',
    '재발급',
    '재 발급',
];

const CERTIFICATE_PATTERNS = [
    /\b\d{2,4}[-./]\d{1,2}[-./][0-9A-Za-z가-힣]+\b/u,
    /\b\d{1,2}[-./]\d{1,2}\s*no\.?\s*\d{1,2}[-./]\d{1,2}\b/iu,
    /\b\d{4}[-./]\d{1,2}\b/u,
    /\b특[-./]?[0-9A-Za-z가-힣-]+\b/u,
    /\b[0-9A-Za-z가-힣-]+[-./]?특\b/u,
    /\b\d{2,4}[-./]특[-./]?[0-9A-Za-z가-힣]+\b/u,
    /\b2\d{3}\b/u,
];

const normalizeText = (value?: string | null) => (value || '').replace(/\s+/g, '').trim().toLowerCase();

const uniqueStrings = (values: Array<string | null | undefined>) =>
    Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));

export const isRightNumberStatus = (value?: string | null): value is RightNumberStatus =>
    value === 'confirmed' ||
    value === 'declared_owned' ||
    value === 'pending' ||
    value === 'missing' ||
    value === 'invalid' ||
    value === 'review_required';

export const normalizeCertificateNumber = (value?: string | null) => {
    const raw = (value || '').trim();
    if (!raw) return '';

    return raw
        .replace(/[./]/g, '-')
        .replace(/\s+/g, '')
        .toLowerCase()
        .split('-')
        .map((part) => (/^\d+$/.test(part) ? String(Number(part)) : part))
        .join('-');
};

const isLikelyPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    return /^01\d{8,9}$/.test(digits);
};

const isObviouslyInvalidRaw = (value: string) => {
    if (isLikelyPhoneNumber(value)) return true;
    if (/^19\d{2}[./-]\d{2}[./-]\d{2}$/.test(value.trim())) return true;
    if (/^19\d{2}\d{2}\d{2}$/.test(value.trim())) return true;
    return false;
};

const includesKeyword = (raw: string, keywords: string[]) => {
    const normalized = normalizeText(raw);
    return keywords.some((keyword) => normalized.includes(normalizeText(keyword)));
};

const stripCandidateRemainder = (raw: string, candidate: string) => {
    let remainder = raw.replace(candidate, ' ');
    remainder = remainder.replace(/[()[\],:;]+/g, ' ');
    remainder = remainder.replace(/\s+/g, ' ').trim();
    if (!remainder) return '';

    let normalized = normalizeText(remainder);
    for (const token of SUPPORTIVE_TOKENS) {
        normalized = normalized.replaceAll(normalizeText(token), '');
    }
    normalized = normalized.replace(/[-_/]/g, '');
    return normalized.trim();
};

export const extractConfirmedCertificateNumber = (value?: string | null) => {
    const raw = (value || '').trim();
    if (!raw) return null;

    let bestMatch: string | null = null;
    for (const pattern of CERTIFICATE_PATTERNS) {
        const matches = raw.match(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`));
        if (!matches) continue;

        for (const match of matches) {
            const candidate = match.replace(/[./]/g, '-').replace(/\s+/g, '');
            if (isLikelyPhoneNumber(candidate)) continue;
            if (!bestMatch || candidate.length > bestMatch.length) {
                bestMatch = candidate;
            }
        }
    }

    return bestMatch;
};

export const classifyCertificateInput = (value?: string | null): ResolvedCertificateRight => {
    const rawValue = (value || '').trim() || null;

    if (!rawValue || EXACT_MISSING_VALUES.has(rawValue)) {
        return {
            rawValue: null,
            confirmedNumber: null,
            normalizedKey: null,
            status: 'missing',
            note: null,
        };
    }

    if (includesKeyword(rawValue, MISSING_KEYWORDS)) {
        return {
            rawValue,
            confirmedNumber: null,
            normalizedKey: null,
            status: 'missing',
            note: null,
        };
    }

    const confirmedNumber = extractConfirmedCertificateNumber(rawValue);
    if (confirmedNumber) {
        const remainder = stripCandidateRemainder(rawValue, confirmedNumber);
        const status = remainder ? 'review_required' : 'confirmed';
        return {
            rawValue,
            confirmedNumber: status === 'confirmed' ? confirmedNumber : null,
            normalizedKey: status === 'confirmed' ? normalizeCertificateNumber(confirmedNumber) : null,
            status,
            note: status === 'review_required' ? rawValue : null,
        };
    }

    if (includesKeyword(rawValue, DECLARED_OWNED_KEYWORDS)) {
        return {
            rawValue,
            confirmedNumber: null,
            normalizedKey: null,
            status: 'declared_owned',
            note: null,
        };
    }

    if (includesKeyword(rawValue, PENDING_KEYWORDS)) {
        return {
            rawValue,
            confirmedNumber: null,
            normalizedKey: null,
            status: 'pending',
            note: null,
        };
    }

    if (includesKeyword(rawValue, REVIEW_REQUIRED_KEYWORDS)) {
        return {
            rawValue,
            confirmedNumber: null,
            normalizedKey: null,
            status: 'review_required',
            note: rawValue,
        };
    }

    if (isObviouslyInvalidRaw(rawValue)) {
        return {
            rawValue,
            confirmedNumber: null,
            normalizedKey: null,
            status: 'invalid',
            note: rawValue,
        };
    }

    return {
        rawValue,
        confirmedNumber: null,
        normalizedKey: null,
        status: 'review_required',
        note: rawValue,
    };
};

export const buildCertificateStorageFields = (
    rawInput?: string | null,
    statusOverride?: RightNumberStatus | null,
    noteOverride?: string | null,
): CertificateStorageFields => {
    const rawValue = (rawInput || '').trim() || null;
    const trimmedNote = (noteOverride || '').trim() || null;

    if (!statusOverride) {
        const classified = classifyCertificateInput(rawValue);
        return {
            right_number: classified.confirmedNumber,
            right_number_raw: classified.rawValue,
            right_number_status: classified.status,
            right_number_note: trimmedNote ?? classified.note,
        };
    }

    if (statusOverride === 'confirmed') {
        const confirmedNumber = extractConfirmedCertificateNumber(rawValue) || rawValue;
        return {
            right_number: confirmedNumber || null,
            right_number_raw: rawValue,
            right_number_status: 'confirmed',
            right_number_note: trimmedNote,
        };
    }

    return {
        right_number: null,
        right_number_raw: rawValue,
        right_number_status: statusOverride,
        right_number_note: trimmedNote ?? ((statusOverride === 'review_required' || statusOverride === 'invalid') ? rawValue : null),
    };
};

export const resolveCertificateRight = (right: AssetRightCertificateRow): ResolvedCertificateRight => {
    const rawValue = (right.right_number_raw || right.right_number || '').trim() || null;
    const storedStatus = isRightNumberStatus(right.right_number_status) ? right.right_number_status : null;
    const note = (right.right_number_note || '').trim() || null;

    if (storedStatus) {
        const normalizedSource = (right.right_number || '').trim() || null;
        const extractedFromRaw = extractConfirmedCertificateNumber(rawValue);
        const confirmedNumber = storedStatus === 'confirmed'
            ? ((rawValue || normalizedSource || extractedFromRaw || '').trim() || null)
            : null;
        const normalizedKey = storedStatus === 'confirmed'
            ? normalizeCertificateNumber(normalizedSource || extractedFromRaw || confirmedNumber)
            : null;

        return {
            rawValue,
            confirmedNumber,
            normalizedKey: normalizedKey || null,
            status: storedStatus,
            note,
        };
    }

    return classifyCertificateInput(rawValue);
};

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
