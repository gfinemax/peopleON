export type CertificateMeta = {
    node_type?: 'raw' | 'derivative';
    parent_right_id?: string;
    original_owner_id?: string;
    original_owner_name?: string;
    integration_type?: 'none' | 'consolidated' | 'unified_new';
    merged_at?: string;
    merged_by?: string;
};

export type RoleType =
    | 'member'
    | 'certificate_holder'
    | 'related_party'
    | 'refund_applicant'
    | 'agent';

export type UnifiedPerson = {
    id: string;
    entity_ids: string[];
    member_id: string | null;
    party_id: string | null;
    name: string;
    certificate_display?: string | null;
    certificate_numbers?: string[];
    certificate_search_tokens?: string[];
    phone: string | null;
    address_legal?: string | null;
    tier: string | null;
    status: string | null;
    is_registered: boolean;
    unit_group: string | null;
    is_favorite?: boolean;
    tags?: string[] | null;
    relationships?: { id?: string; name: string; relation: string; phone?: string }[] | null;
    role_types: RoleType[];
    source_type: 'member' | 'party_only';
    ui_role:
        | 'member'
        | 'landowner'
        | 'general'
        | 'investor'
        | 'agent'
        | 'party'
        | 'other';
    settlement_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected' | null;
    settlement_expected: number;
    settlement_paid: number;
    settlement_remaining: number;
    notes?: string | null;
    meta?: Record<string, unknown> | null;
    tiers?: string[];
    is_duplicate_name?: boolean;
    acts_as_agent_for?: { id?: string; name: string; relation: string; type: string; category?: string }[] | null;
    real_owner?: { id: string; name: string } | null;
    nominees?: { id: string; name: string }[] | null;
    _hasLiveCertData?: boolean;
    birth_date: string | null;
    source_certificate_row_count: number;
    raw_certificate_count: number;
    managed_certificate_count: number;
    has_merged_certificates: boolean;
};
