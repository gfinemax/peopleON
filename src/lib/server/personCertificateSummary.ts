import type { SupabaseClient } from '@supabase/supabase-js';

export type PersonCertificateOwnerGroup = 'registered' | 'others';
export type PersonCertificateReviewStatus = 'pending' | 'reviewed' | 'manual_locked';

export type PersonCertificateSummaryRow = {
    entity_id: string;
    display_name: string | null;
    owner_group: PersonCertificateOwnerGroup;
    provisional_certificate_count: number;
    manual_certificate_count: number | null;
    effective_certificate_count: number;
    review_status: PersonCertificateReviewStatus;
    conflict_certificate_count: number;
    summary_note: string | null;
    provisional_certificate_numbers: string[] | null;
    summary_updated_at: string | null;
};

export type PersonCertificateRollupRow = {
    owner_group: PersonCertificateOwnerGroup;
    owner_count: number;
    owner_with_certificate_count: number;
    provisional_certificate_count: number;
    effective_certificate_count: number;
    conflict_certificate_count: number;
    manual_locked_count: number;
    pending_review_count: number;
};

const DEFAULT_SUMMARY_ROWS: PersonCertificateSummaryRow[] = [];
const DEFAULT_ROLLUP_ROWS: PersonCertificateRollupRow[] = [];

function isMissingRelationError(error: { message?: string | null; code?: string | null } | null | undefined) {
    if (!error) return false;
    if (error.code === 'PGRST106' || error.code === '42P01') return true;
    const message = (error.message || '').toLowerCase();
    return message.includes('does not exist') || message.includes('could not find') || message.includes('relation');
}

const normalizeSummaryRow = (row: Partial<PersonCertificateSummaryRow>): PersonCertificateSummaryRow => ({
    entity_id: String(row.entity_id || ''),
    display_name: row.display_name || null,
    owner_group: row.owner_group === 'registered' ? 'registered' : 'others',
    provisional_certificate_count: Number(row.provisional_certificate_count || 0),
    manual_certificate_count: row.manual_certificate_count === null || row.manual_certificate_count === undefined
        ? null
        : Number(row.manual_certificate_count),
    effective_certificate_count: Number(row.effective_certificate_count || 0),
    review_status: row.review_status === 'manual_locked'
        ? 'manual_locked'
        : row.review_status === 'reviewed'
            ? 'reviewed'
            : 'pending',
    conflict_certificate_count: Number(row.conflict_certificate_count || 0),
    summary_note: row.summary_note || null,
    provisional_certificate_numbers: Array.isArray(row.provisional_certificate_numbers)
        ? row.provisional_certificate_numbers.filter((value): value is string => typeof value === 'string')
        : null,
    summary_updated_at: row.summary_updated_at || null,
});

const normalizeRollupRow = (row: Partial<PersonCertificateRollupRow>): PersonCertificateRollupRow => ({
    owner_group: row.owner_group === 'registered' ? 'registered' : 'others',
    owner_count: Number(row.owner_count || 0),
    owner_with_certificate_count: Number(row.owner_with_certificate_count || 0),
    provisional_certificate_count: Number(row.provisional_certificate_count || 0),
    effective_certificate_count: Number(row.effective_certificate_count || 0),
    conflict_certificate_count: Number(row.conflict_certificate_count || 0),
    manual_locked_count: Number(row.manual_locked_count || 0),
    pending_review_count: Number(row.pending_review_count || 0),
});

export async function fetchPersonCertificateSummarySnapshot(supabase: SupabaseClient): Promise<{
    available: boolean;
    summaries: PersonCertificateSummaryRow[];
    rollups: PersonCertificateRollupRow[];
}> {
    try {
        const [summariesRes, rollupsRes] = await Promise.all([
            supabase
                .from('vw_person_certificate_summary_current')
                .select('*')
                .order('owner_group', { ascending: false })
                .order('display_name', { ascending: true }),
            supabase
                .from('vw_person_certificate_rollup')
                .select('*')
                .order('owner_group', { ascending: false }),
        ]);

        if (isMissingRelationError(summariesRes.error) || isMissingRelationError(rollupsRes.error)) {
            return { available: false, summaries: DEFAULT_SUMMARY_ROWS, rollups: DEFAULT_ROLLUP_ROWS };
        }

        if (summariesRes.error || rollupsRes.error) {
            console.error('[personCertificateSummary] fetch failed', summariesRes.error || rollupsRes.error);
            return { available: false, summaries: DEFAULT_SUMMARY_ROWS, rollups: DEFAULT_ROLLUP_ROWS };
        }

        return {
            available: true,
            summaries: ((summariesRes.data as Partial<PersonCertificateSummaryRow>[] | null) || []).map(normalizeSummaryRow),
            rollups: ((rollupsRes.data as Partial<PersonCertificateRollupRow>[] | null) || []).map(normalizeRollupRow),
        };
    } catch (error) {
        console.error('[personCertificateSummary] unexpected fetch failure', error);
        return { available: false, summaries: DEFAULT_SUMMARY_ROWS, rollups: DEFAULT_ROLLUP_ROWS };
    }
}

export async function fetchPersonCertificateRollupsSnapshot(
    supabase: SupabaseClient,
): Promise<PersonCertificateRollupRow[]> {
    try {
        const { data, error } = await supabase
            .from('vw_person_certificate_rollup')
            .select(
                'owner_group, owner_count, owner_with_certificate_count, provisional_certificate_count, effective_certificate_count, conflict_certificate_count, manual_locked_count, pending_review_count',
            )
            .order('owner_group', { ascending: false });

        if (isMissingRelationError(error)) {
            return DEFAULT_ROLLUP_ROWS;
        }

        if (error) {
            console.error('[personCertificateSummary] rollup fetch failed', error);
            return DEFAULT_ROLLUP_ROWS;
        }

        return ((data as Partial<PersonCertificateRollupRow>[] | null) || []).map(normalizeRollupRow);
    } catch (error) {
        console.error('[personCertificateSummary] unexpected rollup fetch failure', error);
        return DEFAULT_ROLLUP_ROWS;
    }
}
