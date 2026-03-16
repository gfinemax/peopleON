import {
    LEGACY_MEMBER_SEGMENT_OPTIONS,
    type LegacyMemberSegment,
} from '@/lib/legacy/memberSegments';
import type { RightNumberStatus } from '@/lib/certificates/rightNumbers';

export type StatusFilter = 'all' | LegacyMemberSegment;

export interface EnrichedLegacyRecord {
    id: string;
    original_name: string;
    source_file: string;
    raw_data: Record<string, unknown>;
    member_id: string | null;
    member_segment: LegacyMemberSegment;
    certificate_numbers: string[];
    certificate_count: number;
    contact: string;
    owner_name: string;
    owner_type: 'member_linked' | 'certificate_holder_linked' | 'legacy_only';
}

export interface MembershipRoleLiteRow {
    entity_id: string;
    role_code: string | null;
    is_registered: boolean | null;
}

export interface RegisteredEntityLiteRow {
    id: string;
    display_name: string | null;
    member_number: string | null;
    phone: string | null;
}

export type FinanceCertificateEntityRow = {
    id: string;
    display_name: string | null;
    phone: string | null;
    member_number: string | null;
};

export interface FinanceCertificateRow {
    id: string;
    entity_id: string;
    status: string | null;
    meta: Record<string, unknown>;
    account_entities?: FinanceCertificateEntityRow[] | FinanceCertificateEntityRow | null;
    right_type: 'certificate';
    right_number: string | null;
    right_number_raw: string | null;
    right_number_status: string | null;
    right_number_note: string | null;
}

export type CertificateRegistrySourceRow = {
    id: string;
    entity_id: string;
    certificate_number_normalized: string | null;
    certificate_number_raw: string | null;
    certificate_status: string | null;
    source_type: string | null;
    note: unknown;
    account_entities?: FinanceCertificateEntityRow[] | FinanceCertificateEntityRow | null;
};

export type BaseLegacyRecord = {
    id: string;
    original_name: string;
    source_file: string;
    raw_data: Record<string, unknown>;
    member_id: string | null;
    member_segment: LegacyMemberSegment;
    certificate_numbers: string[];
    certificate_count: number;
    contact: string;
    member_name: string | null;
};

export type LegacyExclusiveUniqueRow = {
    number: string;
    ownerName: string;
    ownerSegmentLabel: string;
    contact: string;
    sourceFile: string;
};

export type DuplicateCountRow = {
    number: string;
    registeredCount: number;
    legacyCount: number;
    totalCount: number;
};

export type SegmentSummaryRow = {
    segment: LegacyMemberSegment;
    ownerCount: number;
    certificateCount: number;
};

export type ReviewRequiredRightRow = {
    id: string;
    entityId: string;
    ownerName: string;
    rawValue: string;
    status: RightNumberStatus;
    note: string;
};

export function isLegacySegment(value: string): value is LegacyMemberSegment {
    return LEGACY_MEMBER_SEGMENT_OPTIONS.some((option) => option.value === value);
}
