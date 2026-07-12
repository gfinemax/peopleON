export type MemberExportRow = {
    id: string;
    name: string;
    phone: string | null;
    certificate_numbers?: string[];
    tier: string | null;
    tiers?: string[];
    unit_group: string | null;
    address_legal?: string | null;
    status: string | null;
    role_types?: string[];
    relationships?: { id?: string; name: string; relation: string; phone?: string }[] | null;
    acts_as_agent_for?: { id?: string; name: string; relation: string; type: string; category?: string }[] | null;
    real_owner?: { id: string; name: string } | null;
    nominees?: { id: string; name: string }[] | null;
    notes?: string | null;
    raw_certificate_count: number;
    managed_certificate_count: number;
};
