import type { RightNumberStatus } from '@/lib/certificates/rightNumbers';

export type AssetRight = {
    id: string;
    entity_id: string;
    right_type?: string | null;
    right_number?: string | null;
    right_number_raw?: string | null;
    right_number_status?: RightNumberStatus | null;
    right_number_note?: string | null;
    issued_at?: string | null;
    principal_amount?: number | string | null;
    holder_name?: string | null;
    issued_date?: string | null;
    price_text?: string | null;
    certificate_price?: number | string | null;
    premium_price?: number | string | null;
    broker_fee?: number | string | null;
    acquisition_source?: string | null;
    certificate_number_normalized?: string | null;
    certificate_number_raw?: string | null;
    certificate_status?: RightNumberStatus | null;
    note?: unknown | null;
    meta?: ({ cert_name?: string } & Record<string, unknown>) | null;
};

export type RepresentativeInfo = {
    id?: string;
    name: string;
    relation: string;
    phone: string | null;
};

export type CertificateSummaryReviewStatus = 'pending' | 'reviewed' | 'manual_locked';

export const CERTIFICATE_SUMMARY_STATUS_LABEL: Record<CertificateSummaryReviewStatus, string> = {
    pending: '검수대기',
    reviewed: '검토완료',
    manual_locked: '수동고정',
};

type HeaderCertificateDisplayItem = {
    value: string;
    isManaged: boolean;
};

export const parseCertificateMeta = (note: unknown): Record<string, unknown> => {
    if (!note) return {};
    if (typeof note === 'object' && !Array.isArray(note)) return note as Record<string, unknown>;
    if (typeof note === 'string' && (note.startsWith('{') || note.startsWith('['))) {
        try {
            return JSON.parse(note) as Record<string, unknown>;
        } catch {
            return {};
        }
    }
    return {};
};

export const isJsonLikeNote = (note: unknown) => {
    if (typeof note === 'object' && note && !Array.isArray(note)) return true;
    if (typeof note === 'string') {
        const trimmed = note.trim();
        return trimmed.startsWith('{') || trimmed.startsWith('[');
    }
    return false;
};

export const syncCertificateNoteNumber = (note: unknown, rightNumberRaw: string | null, fallbackNote: string | null) => {
    if (!isJsonLikeNote(note)) {
        return fallbackNote;
    }

    const meta = parseCertificateMeta(note);
    if (Object.keys(meta).length === 0) {
        return fallbackNote;
    }

    return JSON.stringify({
        ...meta,
        권리증번호: rightNumberRaw || null,
    });
};

export const parseHeaderCertificateDisplay = (value?: string | null): HeaderCertificateDisplayItem[] =>
    (value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .filter((item) => item !== '-')
        .map((item) => ({
            value: item.replace(/\s*\[통합\]\s*$/u, ''),
            isManaged: item.includes('[통합]'),
        }));

export const summarizeHeaderCertificateValues = (values: string[]) => {
    if (values.length === 0) return '-';
    return values.join(', ');
};

export const getRightsFlowSummary = (rights?: AssetRight[] | null) => {
    const activeRights = (rights || []).filter((right) => (right.right_type || 'certificate') === 'certificate');
    let rawCount = 0;
    let managedCount = 0;

    for (const right of activeRights) {
        const meta = parseCertificateMeta(right.right_number_note);
        if (meta.node_type !== 'derivative') {
            rawCount += 1;
        }
        if (typeof meta.parent_right_id !== 'string') {
            managedCount += 1;
        }
    }

    return {
        rawCount,
        managedCount,
    };
};

export const getRightsFlowHeadline = (rawCount: number, managedCount: number) => {
    if (rawCount === 1 && managedCount === 1) return '유지';
    if (rawCount > managedCount) return `통합됨 (${rawCount}→${managedCount})`;
    return `${rawCount}원천 → ${managedCount}관리`;
};

export const getReadableRightNote = (note: unknown) => {
    if (!note) return '-';
    if (!isJsonLikeNote(note)) return String(note);

    const meta = parseCertificateMeta(note);
    if (meta.node_type === 'derivative') return '통합 흐름 메타 저장됨';
    if (meta.node_type === 'raw' || typeof meta.parent_right_id === 'string') return '원천 흐름 메타 저장됨';
    return '권리 흐름 메타 저장됨';
};

export const getManagedCertificateNumbers = (rights: AssetRight[] | null | undefined) => {
    const managedNumbers = new Map<string, string>();

    for (const right of rights || []) {
        const meta = parseCertificateMeta(right.right_number_note);
        if (meta.node_type !== 'derivative') continue;

        const value = (right.right_number_raw || right.right_number || '').trim();
        if (!value) continue;

        const key = right.right_number || value;
        const previous = managedNumbers.get(key);
        if (!previous || value.length > previous.length) {
            managedNumbers.set(key, value);
        }
    }

    return Array.from(managedNumbers.values());
};
