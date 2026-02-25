import type { SupabaseClient } from '@supabase/supabase-js';

type RoleType = 'member' | 'certificate_holder' | 'related_party' | 'refund_applicant';

type CompatRoleRow = {
    entity_id: string;
    role_code: string;
    role_status: string;
};

type EntityRow = {
    id: string;
    source_party_id: string | null;
};

type LegacyRoleRow = {
    party_id: string;
    role_type: RoleType;
    role_status: string;
};

export type PartyRoleCompatRow = {
    party_id: string;
    role_type: RoleType;
    role_status: string;
};

const uniqueStrings = (values?: Array<string | null | undefined>) =>
    Array.from(new Set((values || []).filter((value): value is string => Boolean(value && value.trim()))));

function isCompatOnlyMode() {
    return process.env.ACCOUNTING_COMPAT_ONLY === 'true';
}

function mapRoleCodeToRoleType(roleCode: string): RoleType | null {
    const normalized = (roleCode || '').trim();
    if (!normalized) return null;

    if (
        normalized === '등기조합원' ||
        normalized === '2차' ||
        normalized === '일반분양' ||
        normalized === '지주' ||
        normalized === '지주조합원' ||
        normalized === '예비조합원'
    ) {
        return 'member';
    }
    if (normalized === '권리증환불') return 'certificate_holder';
    if (normalized === '관계인') return 'related_party';
    if (normalized === '대리인') return null;
    return null;
}

export async function fetchPartyRolesCompat(
    supabase: SupabaseClient,
    options?: {
        partyIds?: string[];
    },
): Promise<PartyRoleCompatRow[]> {
    const partyIds = uniqueStrings(options?.partyIds);
    const compatOnly = isCompatOnlyMode();

    // 1) Preferred path: v_member_roles_compat + account_entities mapping
    try {
        let entityRows: EntityRow[] = [];
        if (partyIds.length > 0) {
            const { data: entityRowsByParty, error: entityRowsByPartyError } = await supabase
                .from('account_entities')
                .select('id, source_party_id')
                .in('source_party_id', partyIds);

            if (!entityRowsByPartyError) {
                entityRows = (entityRowsByParty as EntityRow[] | null) || [];
                if (entityRows.length === 0) return [];
            }
        } else {
            const { data: allEntityRows, error: allEntityRowsError } = await supabase
                .from('account_entities')
                .select('id, source_party_id')
                .not('source_party_id', 'is', null);

            if (!allEntityRowsError) {
                entityRows = (allEntityRows as EntityRow[] | null) || [];
            }
        }

        if (entityRows.length > 0) {
            const entityIds = uniqueStrings(entityRows.map((row) => row.id));
            const entityIdToPartyId = new Map<string, string>(
                entityRows
                    .filter((row) => Boolean(row.source_party_id))
                    .map((row) => [row.id, row.source_party_id as string]),
            );

            let compatQuery = supabase
                .from('v_member_roles_compat')
                .select('entity_id, role_code, role_status');

            if (entityIds.length > 0) {
                compatQuery = compatQuery.in('entity_id', entityIds);
            }

            const { data: compatRowsRaw, error: compatError } = await compatQuery;
            if (!compatError) {
                const compatRows = (compatRowsRaw as CompatRoleRow[] | null) || [];
                return compatRows
                    .map((row) => {
                        const partyId = entityIdToPartyId.get(row.entity_id);
                        const roleType = mapRoleCodeToRoleType(row.role_code);
                        if (!partyId || !roleType) return null;
                        return {
                            party_id: partyId,
                            role_type: roleType,
                            role_status: row.role_status || 'active',
                        } as PartyRoleCompatRow;
                    })
                    .filter((row): row is PartyRoleCompatRow => Boolean(row));
            }
        }
    } catch {
        // fallback below
    }

    if (compatOnly) {
        console.warn('[partyRolesCompat] compat view read failed; compat-only mode skips legacy fallback');
        return [];
    }

    // 2) Fallback path: membership_roles (new table, replaces legacy party_roles)
    try {
        // Map entity_id → source_party_id for result mapping
        let entityRows: EntityRow[] = [];
        if (partyIds.length > 0) {
            const { data: entityRowsByParty } = await supabase
                .from('account_entities')
                .select('id, source_party_id')
                .in('source_party_id', partyIds);
            entityRows = (entityRowsByParty as EntityRow[] | null) || [];
        } else {
            const { data: allEntityRows } = await supabase
                .from('account_entities')
                .select('id, source_party_id')
                .not('source_party_id', 'is', null);
            entityRows = (allEntityRows as EntityRow[] | null) || [];
        }

        if (entityRows.length === 0) return [];

        const entityIds = uniqueStrings(entityRows.map((row) => row.id));
        const entityIdToPartyId = new Map<string, string>(
            entityRows
                .filter((row) => Boolean(row.source_party_id))
                .map((row) => [row.id, row.source_party_id as string]),
        );

        let rolesQuery = supabase
            .from('membership_roles')
            .select('entity_id, role_code, role_status');

        if (entityIds.length > 0) {
            rolesQuery = rolesQuery.in('entity_id', entityIds);
        }

        const { data: rolesRaw, error: rolesError } = await rolesQuery;
        if (rolesError) {
            console.error('[partyRolesCompat] failed to load membership_roles:', rolesError);
            return [];
        }

        return ((rolesRaw as CompatRoleRow[] | null) || [])
            .map((row) => {
                const partyId = entityIdToPartyId.get(row.entity_id);
                const roleType = mapRoleCodeToRoleType(row.role_code);
                if (!partyId || !roleType) return null;
                return {
                    party_id: partyId,
                    role_type: roleType,
                    role_status: row.role_status || 'active',
                } as PartyRoleCompatRow;
            })
            .filter((row): row is PartyRoleCompatRow => Boolean(row));
    } catch (e) {
        console.error('[partyRolesCompat] fallback failed:', e);
        return [];
    }
}
