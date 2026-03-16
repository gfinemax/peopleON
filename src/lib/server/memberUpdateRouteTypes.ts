export type MemberUpdatePayload = {
    id?: string;
    ids?: string[];
    name?: string | null;
    phone?: string | null;
    secondary_phone?: string | null;
    email?: string | null;
    address_legal?: string | null;
    birth_date?: string | null;
    resident_registration_number?: string | null;
    memo?: string | null;
    role_code?: string | null;
    representative?: {
        id?: string;
        name?: string | null;
        relation?: string | null;
        phone?: string | null;
    } | null;
    representative2?: {
        id?: string;
        name?: string | null;
        relation?: string | null;
        phone?: string | null;
    } | null;
    manual_certificate_count?: number | null;
    certificate_summary_review_status?: 'pending' | 'reviewed' | 'manual_locked' | null;
    certificate_summary_note?: string | null;
    certificate_summary_owner_group?: 'registered' | 'others' | null;
    deleted_rights_ids?: string[];
    updated_rights?: Array<{
        id: string;
        certificate_number_normalized?: string | null;
        certificate_number_raw?: string | null;
        certificate_status?: string | null;
        note?: string | null;
        issued_at?: string | null;
        principal_amount?: number | null;
        meta?: Record<string, unknown> | null;
        old_number?: string | null;
        new_number?: string | null;
    }>;
    merged_rights_payload?: {
        source_ids: string[];
        target_number: string;
        integration_type: 'consolidated' | 'unified_new';
        original_owner_id?: string;
        original_owner_name?: string;
    };
};

export type RepresentativePayload = NonNullable<MemberUpdatePayload['representative']>;
