import type { SupabaseClient } from '@supabase/supabase-js';

type CompatViewRow = {
    certificate_number: string;
    status: string;
    entity_id: string;
};

type EntityRow = {
    id: string;
    source_party_id: string | null;
};

export type CertificateCompatRow = {
    certificate_number: string;
    status: string;
    holder_party_id: string;
};

const uniqueStrings = (values?: Array<string | null | undefined>) =>
    Array.from(new Set((values || []).filter((value): value is string => Boolean(value && value.trim()))));

function isCompatOnlyMode() {
    return process.env.ACCOUNTING_COMPAT_ONLY === 'true';
}

export async function fetchCertificateCompatRows(
    supabase: SupabaseClient,
    options?: {
        certificateNumbers?: string[];
        holderPartyIds?: string[];
    },
): Promise<CertificateCompatRow[]> {
    const certificateNumbers = uniqueStrings(options?.certificateNumbers);
    const holderPartyIds = uniqueStrings(options?.holderPartyIds);
    const compatOnly = isCompatOnlyMode();

    // 1) Preferred path: compatibility view + account_entities mapping
    try {
        let holderEntityIds: string[] | null = null;
        if (holderPartyIds.length > 0) {
            const { data: entityRowsByParty, error: entityRowsByPartyError } = await supabase
                .from('account_entities')
                .select('id, source_party_id')
                .in('source_party_id', holderPartyIds);

            if (!entityRowsByPartyError) {
                holderEntityIds = ((entityRowsByParty as EntityRow[] | null) || []).map((row) => row.id);
                if (holderEntityIds.length === 0) return [];
            }
        }

        let viewQuery = supabase
            .from('v_right_certificates_compat')
            .select('certificate_number, status, entity_id');

        if (certificateNumbers.length > 0) {
            viewQuery = viewQuery.in('certificate_number', certificateNumbers);
        }
        if (holderEntityIds) {
            viewQuery = viewQuery.in('entity_id', holderEntityIds);
        }

        const { data: compatRowsRaw, error: compatError } = await viewQuery;
        if (!compatError) {
            const compatRows = (compatRowsRaw as CompatViewRow[] | null) || [];
            if (compatRows.length === 0) return [];

            const entityIds = uniqueStrings(compatRows.map((row) => row.entity_id));
            const { data: entityRowsRaw } = entityIds.length > 0
                ? await supabase
                    .from('account_entities')
                    .select('id, source_party_id')
                    .in('id', entityIds)
                : { data: [] as EntityRow[] };

            const entityMap = new Map<string, string>(
                ((entityRowsRaw as EntityRow[] | null) || [])
                    .filter((row) => Boolean(row.source_party_id))
                    .map((row) => [row.id, row.source_party_id as string]),
            );

            return compatRows
                .map((row) => ({
                    certificate_number: row.certificate_number,
                    status: row.status,
                    holder_party_id: entityMap.get(row.entity_id) || '',
                }))
                .filter((row) => Boolean(row.holder_party_id));
        }
    } catch {
        // fallback below
    }

    if (compatOnly) {
        console.warn('[certificateCompat] compat view read failed; compat-only mode skips legacy fallback');
        return [];
    }

    // 2) Fallback path: asset_rights (new table, replaces legacy right_certificates)
    try {
        let assetQuery = supabase
            .from('asset_rights')
            .select('right_number, status, entity_id');

        if (certificateNumbers.length > 0) {
            assetQuery = assetQuery.in('right_number', certificateNumbers);
        }

        const { data: assetRowsRaw, error: assetError } = await assetQuery;
        if (assetError) {
            console.error('[certificateCompat] failed to load asset_rights:', assetError);
            return [];
        }

        const assetRows = (assetRowsRaw as Array<{ right_number: string; status: string; entity_id: string }> | null) || [];
        if (assetRows.length === 0) return [];

        // Map entity_id → source_party_id (if available)
        const entityIds = uniqueStrings(assetRows.map((row) => row.entity_id));
        const { data: entityRowsRaw } = entityIds.length > 0
            ? await supabase
                .from('account_entities')
                .select('id, source_party_id')
                .in('id', entityIds)
            : { data: [] as EntityRow[] };

        const entityMap = new Map<string, string>(
            ((entityRowsRaw as EntityRow[] | null) || [])
                .map((row) => [row.id, row.source_party_id || row.id]), // Use entity_id as fallback for party_id
        );

        const results = assetRows
            .map((row) => ({
                certificate_number: row.right_number,
                status: row.status,
                holder_party_id: entityMap.get(row.entity_id) || '',
            }))
            .filter((row) => Boolean(row.holder_party_id));

        if (holderPartyIds.length > 0) {
            const holderSet = new Set(holderPartyIds);
            return results.filter((row) => holderSet.has(row.holder_party_id));
        }
        return results;
    } catch (e) {
        console.error('[certificateCompat] fallback failed:', e);
        return [];
    }
}
