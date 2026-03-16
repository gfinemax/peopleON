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

export type AssetRightCertificateRow = {
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

export const isRightNumberStatus = (value?: string | null): value is RightNumberStatus =>
    value === 'confirmed' ||
    value === 'declared_owned' ||
    value === 'pending' ||
    value === 'missing' ||
    value === 'invalid' ||
    value === 'review_required';
