export {
    classifyCertificateInput,
    extractConfirmedCertificateNumber,
    normalizeCertificateNumber,
} from '@/lib/certificates/rightNumbersClassifier';
export {
    buildCertificateStorageFields,
    resolveCertificateRight,
} from '@/lib/certificates/rightNumbersStorage';
export {
    isRightNumberStatus,
    RIGHT_NUMBER_STATUS_LABEL,
    RIGHT_NUMBER_STATUS_OPTIONS,
} from '@/lib/certificates/rightNumbersTypes';
export type {
    AssetRightCertificateRow,
    CertificateStorageFields,
    ResolvedCertificateRight,
    RightNumberStatus,
} from '@/lib/certificates/rightNumbersTypes';
