'use client';

import type {
    AssetRight,
    CertificateSummaryReviewStatus,
} from './memberDetailDialogUtils';

export interface MemberDetailDialogMember {
    id: string;
    name: string;
    member_number: string;
    certificate_display?: string | null;
    certificate_numbers?: string[] | null;
    phone: string | null;
    secondary_phone?: string | null;
    email: string | null;
    address_legal: string | null;
    tier: string | null;
    status: string | null;
    is_registered: boolean;
    unit_group: string | null;
    memo: string | null;
    tags?: string[] | null;
    tiers?: string[] | null;
    role_code?: string | null;
    representative?: {
        id?: string;
        name: string;
        relation: string;
        phone: string | null;
    } | null;
    representative2?: {
        id?: string;
        name: string;
        relation: string;
        phone: string | null;
    } | null;
    assetRights?: AssetRight[] | null;
    real_owner?: { id: string; name: string } | null;
    nominees?: { id: string; name: string }[] | null;
    birth_date?: string | null;
    resident_registration_number?: string | null;
    acts_as_agent_for?: { id: string; name: string; relation: string }[] | null;
    owner_group?: 'registered' | 'others' | null;
    provisional_certificate_count?: number | null;
    manual_certificate_count?: number | null;
    effective_certificate_count?: number | null;
    certificate_summary_review_status?: CertificateSummaryReviewStatus | null;
    certificate_summary_note?: string | null;
    certificate_summary_conflict_count?: number | null;
    certificate_summary_is_grouped?: boolean;
}

export interface MemberDetailDialogSaveFeedback {
    tone: 'success' | 'warn' | 'error';
    message: string;
}

export type TabType = 'info' | 'timeline' | 'payment' | 'admin';
