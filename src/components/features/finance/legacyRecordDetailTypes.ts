export interface LegacyRecord {
    id: string;
    original_name: string;
    rights_count: number;
    source_file: string;
    amount_paid: number;
    contract_date: string;
    raw_data: Record<string, unknown>;
    member_id: string | null;
    is_refunded: boolean;
    created_at: string;
    legacy_name?: string;
    certificates?: unknown;
}

export type LegacyRecordDetailTab = 'info' | 'raw';
