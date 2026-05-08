import type { SupabaseClient } from '@supabase/supabase-js';
import {
    collectSourceCertificateOccurrences,
    partitionSourceCertificateOccurrences,
} from '@/lib/members/unifiedPersonUtils';
import {
    buildDashboardDuplicateConflicts,
    buildDashboardEvents,
    buildDashboardFavoriteMembers,
    buildDashboardFinancialStats,
    buildDashboardPaymentBreakdown,
    calculateDashboardRate,
    buildDashboardRetentionStats,
} from '@/lib/server/dashboardOverviewBuilders';
import {
    type DashboardDepositAccountRow,
    type DashboardFavoriteEntityRow,
    type DashboardFinancialStats,
    type DashboardMemberPaymentRow,
    type DashboardNewMemberRow,
    type DashboardOverviewData,
    type DashboardPaymentBreakdown,
    type DashboardPaymentRow,
    type DashboardRecentPaymentRow,
    type DashboardUnitTypeRow,
} from '@/lib/server/dashboardOverviewTypes';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';

export { createEmptyDashboardOverviewData } from '@/lib/server/dashboardOverviewTypes';
export type {
    DashboardActionItem,
    DashboardEvent,
    DashboardFavoriteMember,
    DashboardFinancialStats,
    DashboardOverviewData,
    DashboardPaymentBreakdown,
    DashboardRetentionStats,
    DashboardStats,
} from '@/lib/server/dashboardOverviewTypes';

type DashboardPaymentTotalSummaryRow = {
    total_due: number | string | null;
    total_paid: number | string | null;
};

type DashboardPaymentStepSummaryRow = {
    bucket: string;
    due: number | string | null;
    paid: number | string | null;
};

type DashboardFinancialTotalSummaryRow = {
    payment_count: number | string | null;
    contribution_due: number | string | null;
    contribution_paid: number | string | null;
    certificate_paid: number | string | null;
    premium_recognized_paid: number | string | null;
};

type DashboardFinancialTypeSummaryRow = {
    payment_type: string;
    due: number | string | null;
    paid: number | string | null;
};

type DashboardFinancialUnitTypeSummaryRow = {
    unit_type_name: string;
    due: number | string | null;
    paid: number | string | null;
    count: number | string | null;
};

type DashboardFinancialAccountSummaryRow = {
    account_name: string;
    account_type: string | null;
    total: number | string | null;
};

const parseMoney = (value: number | string | null | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const parseCount = (value: number | string | null | undefined) => Math.trunc(parseMoney(value));

const paymentTypeLabels: Record<string, string> = {
    certificate: '출자금(필증)',
    premium: '프리미엄',
    premium_recognized: '인정분',
    contract: '계약금',
    installment_1: '1차 분담금',
    installment_2: '2차 분담금',
    balance: '잔금',
    other: '기타',
};

const createEmptyPaymentBreakdown = (): DashboardPaymentBreakdown => ({
    step1: { due: 0, paid: 0, rate: 0 },
    step2: { due: 0, paid: 0, rate: 0 },
    step3: { due: 0, paid: 0, rate: 0 },
    general: { due: 0, paid: 0, rate: 0 },
});

const createEmptyFinancialStats = (): DashboardFinancialStats => ({
    contributionDue: 0,
    contributionPaid: 0,
    contributionRate: 0,
    investmentTotal: 0,
    additionalBurden: 0,
    byType: {},
    byUnitType: {},
    byAccount: {},
    hasData: false,
});

function buildDashboardPaymentSummaryFromRows(
    totalRow: DashboardPaymentTotalSummaryRow | null,
    stepRows: DashboardPaymentStepSummaryRow[],
) {
    const paymentBreakdown = createEmptyPaymentBreakdown();

    for (const row of stepRows) {
        if (!['step1', 'step2', 'step3', 'general'].includes(row.bucket)) continue;
        const bucket = row.bucket as keyof DashboardPaymentBreakdown;
        paymentBreakdown[bucket].due += parseMoney(row.due);
        paymentBreakdown[bucket].paid += parseMoney(row.paid);
    }

    for (const bucket of Object.keys(paymentBreakdown) as Array<keyof DashboardPaymentBreakdown>) {
        paymentBreakdown[bucket].rate = calculateDashboardRate(paymentBreakdown[bucket].paid, paymentBreakdown[bucket].due);
    }

    const totalAmount = parseMoney(totalRow?.total_due);
    const collectedAmount = parseMoney(totalRow?.total_paid);

    return {
        totalAmount,
        collectedAmount,
        paymentRate: calculateDashboardRate(collectedAmount, totalAmount),
        paymentBreakdown,
    };
}

function buildDashboardFinancialStatsFromRows(
    totalRow: DashboardFinancialTotalSummaryRow | null,
    typeRows: DashboardFinancialTypeSummaryRow[],
    unitRows: DashboardFinancialUnitTypeSummaryRow[],
    accountRows: DashboardFinancialAccountSummaryRow[],
) {
    const financialStats = createEmptyFinancialStats();
    const paymentCount = parseCount(totalRow?.payment_count);

    if (paymentCount === 0 && typeRows.length === 0) {
        return financialStats;
    }

    financialStats.contributionDue = parseMoney(totalRow?.contribution_due);
    financialStats.contributionPaid = parseMoney(totalRow?.contribution_paid);
    financialStats.investmentTotal =
        parseMoney(totalRow?.certificate_paid) + parseMoney(totalRow?.premium_recognized_paid);
    financialStats.additionalBurden = Math.max(0, financialStats.contributionDue - financialStats.investmentTotal);
    financialStats.contributionRate = calculateDashboardRate(
        financialStats.contributionPaid,
        financialStats.contributionDue,
    );

    for (const row of typeRows) {
        const due = parseMoney(row.due);
        const paid = parseMoney(row.paid);
        financialStats.byType[row.payment_type] = {
            label: paymentTypeLabels[row.payment_type] || row.payment_type,
            due,
            paid,
            rate: calculateDashboardRate(paid, due),
        };
    }

    for (const row of unitRows) {
        financialStats.byUnitType[row.unit_type_name] = {
            due: parseMoney(row.due),
            paid: parseMoney(row.paid),
            count: parseCount(row.count),
        };
    }

    for (const row of accountRows) {
        financialStats.byAccount[row.account_name] = {
            total: parseMoney(row.total),
            type: row.account_type || 'unknown',
        };
    }

    financialStats.hasData = true;
    return financialStats;
}

async function fetchPaymentOverviewSummary(supabase: SupabaseClient) {
    const [totalRes, stepRes] = await Promise.all([
        supabase
            .from('vw_dashboard_payment_total_summary')
            .select('total_due, total_paid')
            .single(),
        supabase
            .from('vw_dashboard_payment_step_summary')
            .select('bucket, due, paid'),
    ]);

    if (totalRes.error || stepRes.error) return null;

    return buildDashboardPaymentSummaryFromRows(
        totalRes.data as DashboardPaymentTotalSummaryRow | null,
        (stepRes.data as DashboardPaymentStepSummaryRow[] | null) || [],
    );
}

async function fetchFinancialStatsSummary(supabase: SupabaseClient) {
    const [totalRes, typeRes, unitRes, accountRes] = await Promise.all([
        supabase
            .from('vw_member_payment_financial_total_summary')
            .select('payment_count, contribution_due, contribution_paid, certificate_paid, premium_recognized_paid')
            .single(),
        supabase
            .from('vw_member_payment_type_summary')
            .select('payment_type, due, paid'),
        supabase
            .from('vw_member_payment_unit_type_summary')
            .select('unit_type_name, due, paid, count'),
        supabase
            .from('vw_member_payment_account_summary')
            .select('account_name, account_type, total'),
    ]);

    if (totalRes.error || typeRes.error || unitRes.error || accountRes.error) return null;

    return buildDashboardFinancialStatsFromRows(
        totalRes.data as DashboardFinancialTotalSummaryRow | null,
        (typeRes.data as DashboardFinancialTypeSummaryRow[] | null) || [],
        (unitRes.data as DashboardFinancialUnitTypeSummaryRow[] | null) || [],
        (accountRes.data as DashboardFinancialAccountSummaryRow[] | null) || [],
    );
}

async function fetchPaymentOverviewFallback(supabase: SupabaseClient) {
    const { data } = await supabase.from('payments').select('amount_due, amount_paid, step');
    const allPayments = (data as DashboardPaymentRow[] | null) || [];
    const totalAmount = allPayments.reduce((sum, payment) => sum + (payment.amount_due || 0), 0);
    const collectedAmount = allPayments.reduce((sum, payment) => sum + (payment.amount_paid || 0), 0);

    return {
        totalAmount,
        collectedAmount,
        paymentRate: calculateDashboardRate(collectedAmount, totalAmount),
        paymentBreakdown: buildDashboardPaymentBreakdown(allPayments),
    };
}

async function fetchFinancialStatsFallback(supabase: SupabaseClient) {
    const [memberPaymentsRes, unitTypesRes, accountsRes] = await Promise.all([
        supabase
            .from('member_payments')
            .select('payment_type, amount_due, amount_paid, is_contribution, unit_type_id, deposit_account_id'),
        supabase.from('unit_types').select('id, name').eq('is_active', true),
        supabase.from('deposit_accounts').select('id, account_name, account_type').eq('is_active', true),
    ]);

    return buildDashboardFinancialStats(
        (memberPaymentsRes.data as DashboardMemberPaymentRow[] | null) || [],
        (unitTypesRes.data as DashboardUnitTypeRow[] | null) || [],
        (accountsRes.data as DashboardDepositAccountRow[] | null) || [],
    );
}

export async function fetchDashboardOverviewData(supabase: SupabaseClient): Promise<DashboardOverviewData> {
    const unifiedPeople = await getUnifiedMembersSnapshot();
    const totalMembers = unifiedPeople.length;
    let registeredCount = 0;
    let relatedPartyCount = 0;
    let totalExpectedRefund = 0;
    let totalPaidRefund = 0;
    let totalRemainingRefund = 0;

    for (const person of unifiedPeople) {
        if (person.is_registered) registeredCount += 1;
        if (person.role_types.includes('agent') || person.role_types.includes('related_party')) {
            relatedPartyCount += 1;
        }
        totalExpectedRefund += person.settlement_expected;
        totalPaidRefund += person.settlement_paid;
        totalRemainingRefund += person.settlement_remaining;
    }

    const registeredRate = totalMembers > 0 ? Math.round((registeredCount / totalMembers) * 100) : 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
        recentRolesRes,
        paymentOverviewSummary,
        financialStatsSummary,
        recentPaymentsRes,
        newMembersRes,
        favoritesRes,
    ] = await Promise.all([
        supabase
            .from('membership_roles')
            .select('entity_id')
            .eq('is_registered', true)
            .gte('created_at', thirtyDaysAgo.toISOString()),
        fetchPaymentOverviewSummary(supabase),
        fetchFinancialStatsSummary(supabase),
        supabase
            .from('payments')
            .select('id, paid_date, step_name, step, amount_paid, account_entities(display_name)')
            .not('paid_date', 'is', null)
            .order('paid_date', { ascending: false })
            .limit(3),
        supabase
            .from('account_entities')
            .select('id, display_name, created_at, unit_group')
            .order('created_at', { ascending: false })
            .limit(3),
        supabase
            .from('account_entities')
            .select('id, display_name, member_number, tier, status, is_favorite')
            .eq('is_favorite', true)
            .order('display_name', { ascending: true })
            .limit(10),
    ]);

    const sourceCertificateOccurrences = collectSourceCertificateOccurrences(unifiedPeople);
    const { uniqueSourceOccurrences } = partitionSourceCertificateOccurrences(sourceCertificateOccurrences);
    const retention = buildDashboardRetentionStats(unifiedPeople);

    const paymentOverview = paymentOverviewSummary || await fetchPaymentOverviewFallback(supabase);
    const financialStats = financialStatsSummary || await fetchFinancialStatsFallback(supabase);

    return {
        stats: {
            totalMembers,
            totalAmount: paymentOverview.totalAmount,
            collectedAmount: paymentOverview.collectedAmount,
            paymentRate: paymentOverview.paymentRate,
            registeredMembersCount: registeredCount,
            registeredMembersRate: registeredRate,
            recentRegisteredCount: new Set(
                (((recentRolesRes.data || []) as Array<{ entity_id: string }>).map((role) => role.entity_id)),
            ).size,
            certificateHolderCount: uniqueSourceOccurrences.length,
            relatedPartyCount,
            totalExpectedRefund,
            totalPaidRefund,
            totalRemainingRefund,
            retention,
        },
        events: buildDashboardEvents(
            (recentPaymentsRes.data as DashboardRecentPaymentRow[] | null) || [],
            (newMembersRes.data as DashboardNewMemberRow[] | null) || [],
        ),
        paymentBreakdown: paymentOverview.paymentBreakdown,
        financialStats,
        favoriteList: buildDashboardFavoriteMembers(
            (favoritesRes.data as DashboardFavoriteEntityRow[] | null) || [],
        ),
        actionList: buildDashboardDuplicateConflicts(unifiedPeople),
    };
}
