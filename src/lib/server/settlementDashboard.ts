import { type SupabaseClient } from '@supabase/supabase-js';
import {
    buildSettlementPartyOwnershipMap,
    type MemberLite,
    ownerTypeLabel,
    type PartyRoleLite,
    type RightCertificateLite,
} from '@/lib/settlement/partyOwnership';
import { fetchCertificateCompatRows } from '@/lib/server/certificateCompat';
import { fetchPartyRolesCompat } from '@/lib/server/partyRolesCompat';
import {
    buildSettlementDiagnostics,
    buildSettlementRows,
    filterSettlementRows,
    parseMoney,
} from '@/lib/server/settlementDashboardBuilders';
import type {
    PartyProfileRow,
    RefundPaymentRow,
    SettlementCaseRow,
    SettlementDashboardData,
    SettlementDiagFilter,
    SettlementLineRow,
    SettlementOwnershipSummary,
    SettlementStatusFilter,
} from '@/lib/server/settlementDashboardTypes';

type PartyRoleRow = PartyRoleLite;
type RightCertificateRow = RightCertificateLite;

async function fetchSettlementCases(
    supabase: SupabaseClient,
    statusFilter: SettlementStatusFilter,
) {
    let queryBuilder = supabase
        .from('settlement_cases')
        .select('id, party_id, case_status, created_at')
        .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
        queryBuilder = queryBuilder.eq('case_status', statusFilter);
    }

    const { data, error } = await queryBuilder;
    return {
        rows: (data as SettlementCaseRow[] | null) || [],
        errorMessage: error?.message || null,
    };
}

async function fetchOwnershipMaps(
    supabase: SupabaseClient,
    partyIds: string[],
) {
    let partyMap = new Map<string, PartyProfileRow>();
    let ownershipByParty = new Map<string, SettlementOwnershipSummary>();

    if (partyIds.length === 0) {
        return { partyMap, ownershipByParty };
    }

    const [partiesRes, roles, certificates] = await Promise.all([
        supabase
            .from('party_profiles')
            .select('id, display_name, member_id')
            .in('id', partyIds),
        fetchPartyRolesCompat(supabase, { partyIds }),
        fetchCertificateCompatRows(supabase, { holderPartyIds: partyIds }),
    ]);

    const partiesData = (partiesRes.data as PartyProfileRow[] | null) || [];
    const partyRoles = roles as PartyRoleRow[];
    const rightCertificates = certificates.map((row) => ({
        holder_party_id: row.holder_party_id,
        status: row.status,
    })) as RightCertificateRow[];

    partyMap = new Map(partiesData.map((party) => [party.id, party]));

    const memberIds = Array.from(
        new Set(
            partiesData
                .map((party) => party.member_id)
                .filter((memberId): memberId is string => Boolean(memberId)),
        ),
    );

    const { data: membersData } = memberIds.length > 0
        ? await supabase
            .from('account_entities')
            .select('id, display_name')
            .in('id', memberIds)
        : { data: [] as Array<{ id: string; display_name: string }> };

    const ownershipMap = buildSettlementPartyOwnershipMap({
        parties: partiesData,
        members: (((membersData as Array<{ id: string; display_name: string }> | null) || []).map((member) => ({
            id: member.id,
            name: member.display_name,
        })) as MemberLite[]),
        partyRoles,
        rightCertificates,
    });

    ownershipByParty = new Map<string, SettlementOwnershipSummary>(
        Array.from(ownershipMap.values()).map((item) => [
            item.party_id,
            { owner_name: item.owner_name, owner_type: item.owner_type },
        ]),
    );

    return { partyMap, ownershipByParty };
}

async function fetchSettlementAmounts(
    supabase: SupabaseClient,
    caseIds: string[],
) {
    let finalLineByCase = new Map<string, number>();
    let paidByCase = new Map<string, number>();

    if (caseIds.length === 0) {
        return { finalLineByCase, paidByCase };
    }

    const [linesRes, paymentsRes] = await Promise.all([
        supabase
            .from('settlement_lines')
            .select('case_id, line_type, amount')
            .in('case_id', caseIds)
            .eq('line_type', 'final_refund'),
        supabase
            .from('refund_payments')
            .select('case_id, paid_amount, payment_status')
            .in('case_id', caseIds),
    ]);

    const lines = (linesRes.data as SettlementLineRow[] | null) || [];
    const payments = (paymentsRes.data as RefundPaymentRow[] | null) || [];

    finalLineByCase = new Map<string, number>();
    for (const line of lines) {
        finalLineByCase.set(line.case_id, (finalLineByCase.get(line.case_id) || 0) + parseMoney(line.amount));
    }

    paidByCase = new Map<string, number>();
    for (const payment of payments) {
        if (payment.payment_status !== 'paid') continue;
        paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + parseMoney(payment.paid_amount));
    }

    return { finalLineByCase, paidByCase };
}

export async function fetchSettlementDashboardData(
    supabase: SupabaseClient,
    statusFilter: SettlementStatusFilter,
    diagFilter: SettlementDiagFilter,
    query: string,
): Promise<SettlementDashboardData> {
    const { rows: settlementCases, errorMessage } = await fetchSettlementCases(supabase, statusFilter);
    if (errorMessage) {
        const emptyDiagnostics = buildSettlementDiagnostics([]);
        return {
            rows: [],
            loadErrorMessage: errorMessage,
            totalCases: 0,
            expectedTotal: 0,
            paidTotal: 0,
            remainingTotal: 0,
            connectedCount: 0,
            pendingCount: 0,
            diagnostics: emptyDiagnostics.diagnostics,
            diagnosticIssueCount: 0,
            qaChecklist: emptyDiagnostics.qaChecklist,
        };
    }

    const partyIds = Array.from(new Set(settlementCases.map((item) => item.party_id)));
    const { partyMap, ownershipByParty } = await fetchOwnershipMaps(supabase, partyIds);
    const caseIds = settlementCases.map((item) => item.id);
    const { finalLineByCase, paidByCase } = await fetchSettlementAmounts(supabase, caseIds);

    const rawRows = buildSettlementRows(
        settlementCases,
        partyMap,
        ownershipByParty,
        finalLineByCase,
        paidByCase,
    );
    const rows = filterSettlementRows(rawRows, query, diagFilter);

    const expectedTotal = rows.reduce((sum, row) => sum + row.expected, 0);
    const paidTotal = rows.reduce((sum, row) => sum + row.paid, 0);
    const remainingTotal = rows.reduce((sum, row) => sum + row.remaining, 0);
    const connectedCount = rows.filter((row) => row.ownership.owner_type !== 'unlinked').length;
    const pendingCount = rows.filter((row) => row.remaining > 0).length;
    const { diagnostics, diagnosticIssueCount, qaChecklist } = buildSettlementDiagnostics(rows);

    return {
        rows,
        loadErrorMessage: null,
        totalCases: rows.length,
        expectedTotal,
        paidTotal,
        remainingTotal,
        connectedCount,
        pendingCount,
        diagnostics,
        diagnosticIssueCount,
        qaChecklist,
    };
}

export { ownerTypeLabel };
export type {
    CaseStatus,
    SettlementCaseRow,
    SettlementChecklistItem,
    SettlementDashboardData,
    SettlementDashboardRow,
    SettlementDiagFilter,
    SettlementDiagnostic,
    SettlementStatusFilter,
} from '@/lib/server/settlementDashboardTypes';
