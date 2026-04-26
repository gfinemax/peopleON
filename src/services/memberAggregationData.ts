import { type SupabaseClient } from '@supabase/supabase-js';

export type AccountEntityRecord = {
    id: string;
    entity_type?: string | null;
    display_name: string;
    phone: string | null;
    address_legal: string | null;
    unit_group: string | null;
    memo: string | null;
    is_favorite?: boolean;
    tags?: string[] | null;
    email?: string | null;
    meta?: Record<string, unknown> | null;
    status: string | null;
    birth_date: string | null;
};

export type MembershipRoleRecord = {
    id: string;
    entity_id: string;
    role_code: string;
    role_status: string;
    is_registered: boolean;
};

export type CertificateRegistryRecord = {
    id: string;
    entity_id: string;
    certificate_number_normalized: string | null;
    certificate_number_raw: string | null;
    certificate_status: string | null;
    source_type?: string | null;
    note: unknown;
    is_active: boolean;
    is_confirmed_for_count?: boolean | null;
};

export type AggregatedRightRecord = {
    id: string;
    entity_id: string;
    right_type: 'certificate';
    right_number: string | null;
    right_number_raw: string | null;
    right_number_status: string | null;
    right_number_note: string | null;
    note: unknown;
    is_active: boolean;
    is_confirmed_for_count?: boolean | null;
};

export type SettlementCaseRecord = {
    id: string;
    entity_id: string;
    case_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected';
    created_at: string;
};

type SettlementLineRecord = {
    case_id: string;
    line_type: string;
    amount: number | string | null;
};

type RefundPaymentRecord = {
    case_id: string;
    paid_amount: number | string | null;
    payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
};

export type RelationshipLookupRecord = {
    to_entity_id: string;
    from_entity_id: string;
    relation_type: 'agent' | 'nominee_owner';
    relation_note: string | null;
    agent_entity?: { display_name?: string | null } | null;
    owner_entity?: { display_name?: string | null } | null;
};

const parseMoney = (value: number | string | null | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const mapCertificateRows = (rows: CertificateRegistryRecord[]) =>
    rows.map<AggregatedRightRecord>((row) => ({
        id: row.id,
        entity_id: row.entity_id,
        right_type: 'certificate',
        right_number: row.certificate_number_normalized,
        right_number_raw: row.certificate_number_raw,
        right_number_status: row.certificate_status,
        right_number_note: typeof row.note === 'string' ? row.note : null,
        note: row.note,
        is_active: row.is_active,
        is_confirmed_for_count: row.is_confirmed_for_count,
    }));

export const groupByEntityId = <T extends { entity_id: string }>(items: T[]) => {
    const grouped = new Map<string, T[]>();
    for (const item of items) {
        const existing = grouped.get(item.entity_id) || [];
        existing.push(item);
        grouped.set(item.entity_id, existing);
    }
    return grouped;
};

export async function fetchAggregationBaseData(supabase: SupabaseClient) {
    const [entitiesRes, rolesRes, rightsRes, casesRes, relsRes] = await Promise.all([
        supabase
            .from('account_entities')
            .select('id, entity_type, display_name, phone, address_legal, unit_group, memo, is_favorite, tags, status, birth_date'),
        supabase
            .from('membership_roles')
            .select('id, entity_id, role_code, role_status, is_registered'),
        supabase
            .from('certificate_registry')
            .select('id, entity_id, certificate_number_normalized, certificate_number_raw, certificate_status, source_type, note, is_active, is_confirmed_for_count')
            .eq('is_active', true),
        supabase
            .from('settlement_cases')
            .select('id, entity_id, case_status, created_at')
            .order('created_at', { ascending: false }),
        supabase
            .from('entity_relationships')
            .select('to_entity_id, from_entity_id, relation_type, relation_note, agent_entity:account_entities!from_entity_id(display_name), owner_entity:account_entities!to_entity_id(display_name)')
            .in('relation_type', ['agent', 'nominee_owner']),
    ]);

    const fetchError =
        entitiesRes.error ||
        rolesRes.error ||
        rightsRes.error ||
        casesRes.error ||
        relsRes.error ||
        null;

    if (fetchError) {
        return {
            fetchError,
            entities: [] as AccountEntityRecord[],
            roles: [] as MembershipRoleRecord[],
            rights: [] as AggregatedRightRecord[],
            settlementCases: [] as SettlementCaseRecord[],
            relationsList: [] as RelationshipLookupRecord[],
        };
    }

    return {
        fetchError: null,
        entities: ((entitiesRes.data as AccountEntityRecord[] | null) || []),
        roles: ((rolesRes.data as MembershipRoleRecord[] | null) || []),
        rights: mapCertificateRows((rightsRes.data as CertificateRegistryRecord[] | null) || []),
        settlementCases: ((casesRes.data as SettlementCaseRecord[] | null) || []),
        relationsList: ((relsRes.data as RelationshipLookupRecord[] | null) || []),
    };
}

export async function fetchAggregationIdentityData(supabase: SupabaseClient) {
    const [entitiesRes, rolesRes] = await Promise.all([
        supabase
            .from('account_entities')
            .select('id, entity_type, display_name, phone, address_legal, unit_group, memo, is_favorite, tags, status, birth_date'),
        supabase
            .from('membership_roles')
            .select('id, entity_id, role_code, role_status, is_registered'),
    ]);

    const fetchError = entitiesRes.error || rolesRes.error || null;

    if (fetchError) {
        return {
            fetchError,
            entities: [] as AccountEntityRecord[],
            roles: [] as MembershipRoleRecord[],
        };
    }

    return {
        fetchError: null,
        entities: ((entitiesRes.data as AccountEntityRecord[] | null) || []),
        roles: ((rolesRes.data as MembershipRoleRecord[] | null) || []),
    };
}

export async function fetchSettlementAmounts(
    supabase: SupabaseClient,
    settlementCases: SettlementCaseRecord[],
) {
    const latestCaseByEntity = new Map<string, SettlementCaseRecord>();
    for (const settlementCase of settlementCases) {
        if (!latestCaseByEntity.has(settlementCase.entity_id)) {
            latestCaseByEntity.set(settlementCase.entity_id, settlementCase);
        }
    }

    const latestCaseIds = Array.from(latestCaseByEntity.values()).map((item) => item.id);
    if (latestCaseIds.length === 0) {
        return {
            latestCaseByEntity,
            finalRefundByCase: new Map<string, number>(),
            paidByCase: new Map<string, number>(),
        };
    }

    const [linesRes, paymentsRes] = await Promise.all([
        supabase
            .from('settlement_lines')
            .select('case_id, line_type, amount')
            .in('case_id', latestCaseIds),
        supabase
            .from('refund_payments')
            .select('case_id, paid_amount, payment_status')
            .in('case_id', latestCaseIds),
    ]);

    const settlementLines = (linesRes.data as SettlementLineRecord[] | null) || [];
    const refundPayments = (paymentsRes.data as RefundPaymentRecord[] | null) || [];

    const finalRefundByCase = new Map<string, number>();
    for (const line of settlementLines) {
        if (line.line_type !== 'final_refund') continue;
        finalRefundByCase.set(line.case_id, (finalRefundByCase.get(line.case_id) || 0) + parseMoney(line.amount));
    }

    const paidByCase = new Map<string, number>();
    for (const payment of refundPayments) {
        if (payment.payment_status !== 'paid') continue;
        paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + parseMoney(payment.paid_amount));
    }

    return { latestCaseByEntity, finalRefundByCase, paidByCase };
}

export function buildRelationshipMaps(relationsList: RelationshipLookupRecord[]) {
    const agentsByEntity = new Map<string, { id?: string; name: string; relation: string; phone?: string }[]>();
    const actsAsAgentFor = new Map<string, { owner_id: string; owner_name: string; relation: string }[]>();
    const realOwnerByNominee = new Map<string, { id: string; name: string }>();
    const nomineesByOwner = new Map<string, { id: string; name: string }[]>();

    for (const rel of relationsList) {
        if (rel.relation_type === 'agent') {
            const existingAgents = agentsByEntity.get(rel.to_entity_id) || [];
            existingAgents.push({
                id: rel.from_entity_id,
                name: rel.agent_entity?.display_name || '알 수 없음',
                relation: rel.relation_note || '대리인',
            });
            agentsByEntity.set(rel.to_entity_id, existingAgents);

            const existingOwners = actsAsAgentFor.get(rel.from_entity_id) || [];
            existingOwners.push({
                owner_id: rel.to_entity_id,
                owner_name: rel.owner_entity?.display_name || '알 수 없음',
                relation: rel.relation_note || '대리인',
            });
            actsAsAgentFor.set(rel.from_entity_id, existingOwners);
        } else if (rel.relation_type === 'nominee_owner') {
            realOwnerByNominee.set(rel.from_entity_id, {
                id: rel.to_entity_id,
                name: rel.owner_entity?.display_name || '알 수 없음',
            });

            const existingNominees = nomineesByOwner.get(rel.to_entity_id) || [];
            existingNominees.push({
                id: rel.from_entity_id,
                name: rel.agent_entity?.display_name || '알 수 없음',
            });
            nomineesByOwner.set(rel.to_entity_id, existingNominees);
        }
    }

    return { agentsByEntity, actsAsAgentFor, realOwnerByNominee, nomineesByOwner };
}
