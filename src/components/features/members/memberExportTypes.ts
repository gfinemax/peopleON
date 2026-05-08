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
    notes?: string | null;
    raw_certificate_count: number;
    managed_certificate_count: number;
};
