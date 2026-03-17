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
    buildDashboardRetentionStats,
    calculateDashboardRate,
} from '@/lib/server/dashboardOverviewBuilders';
import {
    type DashboardDepositAccountRow,
    type DashboardFavoriteEntityRow,
    type DashboardMemberPaymentRow,
    type DashboardNewMemberRow,
    type DashboardOverviewData,
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

export async function fetchDashboardOverviewData(supabase: SupabaseClient): Promise<DashboardOverviewData> {
    const unifiedPeople = await getUnifiedMembersSnapshot();
    const totalMembers = unifiedPeople.length;
    const registeredCount = unifiedPeople.filter((person) => person.is_registered).length;
    const registeredRate = totalMembers > 0 ? Math.round((registeredCount / totalMembers) * 100) : 0;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
        recentRolesRes,
        allPaymentsRes,
        memberPaymentsRes,
        unitTypesRes,
        accountsRes,
        recentPaymentsRes,
        newMembersRes,
        favoritesRes,
    ] = await Promise.all([
        supabase
            .from('membership_roles')
            .select('entity_id')
            .eq('is_registered', true)
            .gte('created_at', thirtyDaysAgo.toISOString()),
        supabase.from('payments').select('amount_due, amount_paid, step'),
        supabase
            .from('member_payments')
            .select('payment_type, amount_due, amount_paid, is_contribution, unit_type_id, deposit_account_id'),
        supabase.from('unit_types').select('id, name').eq('is_active', true),
        supabase.from('deposit_accounts').select('id, account_name, account_type').eq('is_active', true),
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
    const relationPeople = unifiedPeople.filter(
        (person) => person.role_types.includes('agent') || person.role_types.includes('related_party'),
    );
    const retention = buildDashboardRetentionStats(unifiedPeople);

    const allPayments = (allPaymentsRes.data as DashboardPaymentRow[] | null) || [];
    const totalAmount = allPayments.reduce((sum, payment) => sum + (payment.amount_due || 0), 0);
    const collectedAmount = allPayments.reduce((sum, payment) => sum + (payment.amount_paid || 0), 0);
    const paymentRate = calculateDashboardRate(collectedAmount, totalAmount);

    return {
        stats: {
            totalMembers,
            totalAmount,
            collectedAmount,
            paymentRate,
            registeredMembersCount: registeredCount,
            registeredMembersRate: registeredRate,
            recentRegisteredCount: new Set(
                (((recentRolesRes.data || []) as Array<{ entity_id: string }>).map((role) => role.entity_id)),
            ).size,
            certificateHolderCount: uniqueSourceOccurrences.length,
            relatedPartyCount: relationPeople.length,
            totalExpectedRefund: unifiedPeople.reduce((sum, person) => sum + person.settlement_expected, 0),
            totalPaidRefund: unifiedPeople.reduce((sum, person) => sum + person.settlement_paid, 0),
            totalRemainingRefund: unifiedPeople.reduce((sum, person) => sum + person.settlement_remaining, 0),
            retention,
        },
        events: buildDashboardEvents(
            (recentPaymentsRes.data as DashboardRecentPaymentRow[] | null) || [],
            (newMembersRes.data as DashboardNewMemberRow[] | null) || [],
        ),
        paymentBreakdown: buildDashboardPaymentBreakdown(allPayments),
        financialStats: buildDashboardFinancialStats(
            (memberPaymentsRes.data as DashboardMemberPaymentRow[] | null) || [],
            (unitTypesRes.data as DashboardUnitTypeRow[] | null) || [],
            (accountsRes.data as DashboardDepositAccountRow[] | null) || [],
        ),
        favoriteList: buildDashboardFavoriteMembers(
            (favoritesRes.data as DashboardFavoriteEntityRow[] | null) || [],
        ),
        actionList: buildDashboardDuplicateConflicts(unifiedPeople),
    };
}
