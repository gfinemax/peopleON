import { Header } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';
import { fetchPaymentDashboardData } from '@/lib/server/paymentDashboard';
import {
    PaymentsFilterSection,
    PaymentsHeroSection,
    PaymentsQualitySection,
    PaymentsStatsSection,
    PaymentsTableSection,
} from '@/components/features/payments/PaymentsPageSections';

export const dynamic = 'force-dynamic';

type PaymentSearchParams = {
    q?: string;
    tier?: string;
    status?: string;
    page?: string;
};

export default async function PaymentsPage({
    searchParams,
}: {
    searchParams: Promise<PaymentSearchParams>;
}) {
    const params = (await searchParams) || {};
    const query = (params.q || '').trim();
    const tierFilter = params.tier || 'all';
    const statusFilter = params.status || 'all';
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = 30;

    const supabase = await createClient();
    const unifiedPeople = await getUnifiedMembersSnapshot();

    const {
        paymentErrorMessage,
        tiers,
        filteredRows,
        totalRows,
        totalContributionDue,
        totalContributionPaid,
        totalContributionUnpaid,
        totalInvestment,
        totalAdditionalBurden,
        totalSettlementRemaining,
        collectionRate,
        paymentLineMissingCount,
        unitTypeMissingCount,
        unpaidCount,
        settlementPendingCount,
    } = await fetchPaymentDashboardData(supabase, unifiedPeople, query, tierFilter, statusFilter);

    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const normalizedPage = Math.min(page, totalPages);
    const from = (normalizedPage - 1) * pageSize;
    const to = from + pageSize;
    const pagedRows = filteredRows.slice(from, to);

    const getPageLink = (targetPage: number) => {
        const search = new URLSearchParams();
        if (query) search.set('q', query);
        if (tierFilter !== 'all') search.set('tier', tierFilter);
        if (statusFilter !== 'all') search.set('status', statusFilter);
        search.set('page', String(targetPage));
        return `/payments?${search.toString()}`;
    };

    return (
        <div className="flex h-full flex-1 flex-col overflow-hidden">
            <Header title="분담금 관리" iconName="payments" />

            <main className="flex-1 overflow-y-auto bg-background">
                <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 p-4 lg:p-6">
                    <PaymentsHeroSection />
                    <PaymentsStatsSection
                        totalRows={totalRows}
                        totalContributionDue={totalContributionDue}
                        totalContributionPaid={totalContributionPaid}
                        totalContributionUnpaid={totalContributionUnpaid}
                        totalInvestment={totalInvestment}
                        totalAdditionalBurden={totalAdditionalBurden}
                        totalSettlementRemaining={totalSettlementRemaining}
                        collectionRate={collectionRate}
                        unpaidCount={unpaidCount}
                        settlementPendingCount={settlementPendingCount}
                    />
                    <PaymentsQualitySection
                        paymentLineMissingCount={paymentLineMissingCount}
                        unitTypeMissingCount={unitTypeMissingCount}
                        unpaidCount={unpaidCount}
                        settlementPendingCount={settlementPendingCount}
                    />
                    <PaymentsFilterSection
                        query={query}
                        tierFilter={tierFilter}
                        statusFilter={statusFilter}
                        tiers={tiers}
                        paymentErrorMessage={paymentErrorMessage}
                    />
                    <PaymentsTableSection
                        pagedRows={pagedRows}
                        totalRows={totalRows}
                        from={from}
                        to={to}
                        normalizedPage={normalizedPage}
                        totalPages={totalPages}
                        getPageLink={getPageLink}
                    />
                </div>
            </main>
        </div>
    );
}
