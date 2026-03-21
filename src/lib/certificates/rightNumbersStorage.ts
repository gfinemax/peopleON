import {
    AssetRightCertificateRow,
    CertificateStorageFields,
    ResolvedCertificateRight,
    RightNumberStatus,
    isRightNumberStatus,
} from '@/lib/certificates/rightNumbersTypes';
import {
    classifyCertificateInput,
    extractConfirmedCertificateNumber,
    normalizeCertificateNumber,
} from '@/lib/certificates/rightNumbersClassifier';

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
            right_number: classified.normalizedKey,
            right_number_raw: classified.rawValue,
            right_number_status: classified.status,
            right_number_note: trimmedNote ?? classified.note,
        };
    }

    if (statusOverride === 'confirmed') {
        const confirmedNumber = extractConfirmedCertificateNumber(rawValue) || rawValue;
        return {
            right_number: normalizeCertificateNumber(confirmedNumber || rawValue) || null,
            right_number_raw: rawValue,
            right_number_status: 'confirmed',
            right_number_note: trimmedNote,
        };
    }

    return {
        right_number: null,
        right_number_raw: rawValue,
        right_number_status: statusOverride,
        right_number_note:
            trimmedNote ?? (statusOverride === 'review_required' || statusOverride === 'invalid' ? rawValue : null),
    };
};

export const resolveCertificateRight = (right: AssetRightCertificateRow): ResolvedCertificateRight => {
    const rawValue = (right.right_number_raw || right.right_number || '').trim() || null;
    const storedStatus = isRightNumberStatus(right.right_number_status) ? right.right_number_status : null;
    const note = (right.right_number_note || '').trim() || null;
    const classifiedFromRaw = classifyCertificateInput(rawValue);

    if (storedStatus) {
        if (storedStatus !== 'confirmed' && classifiedFromRaw.status === 'confirmed') {
            return {
                ...classifiedFromRaw,
                note,
            };
        }

        const normalizedSource = (right.right_number || '').trim() || null;
        const extractedFromRaw = extractConfirmedCertificateNumber(rawValue);
        const confirmedNumber =
        storedStatus === 'confirmed'
            ? ((normalizedSource && (!rawValue || normalizedSource.length > rawValue.length)
                  ? normalizedSource
                  : rawValue || normalizedSource || '').trim() || null)
            : null;
        const normalizedKey =
            storedStatus === 'confirmed'
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
