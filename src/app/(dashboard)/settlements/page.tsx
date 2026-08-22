import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { DashboardEntryNotice } from '@/components/layout/DashboardEntryNotice';
import {
    SettlementsActionPanel,
    SettlementsCasesTableSection,
    SettlementsDiagnosticsSection,
    SettlementsFilterSection,
    SettlementsStatsStrip,
    SettlementsToolsSection,
} from '@/components/features/settlements/SettlementsPageSections';
import {
    fetchSettlementDashboardData,
    type SettlementDiagFilter,
    type SettlementStatusFilter,
} from '@/lib/server/settlementDashboard';
import { SpecialRefundTargetsSection } from '@/components/features/settlements/SpecialRefundTargetsSection';
import { fetchLedgerRefundTargets } from '@/lib/server/ledgerRefundTargets';

export const dynamic = 'force-dynamic';

type SettlementSearchParams = {
    status?: SettlementStatusFilter;
    diag?: SettlementDiagFilter;
    q?: string;
    page?: string;
    remaining?: string;
    from?: string;
    view?: string;
};

export default async function SettlementsPage({
    searchParams,
}: {
    searchParams: Promise<SettlementSearchParams>;
}) {
    const params = (await searchParams) || {};
    const statusFilter: SettlementStatusFilter = params.status || 'all';
    const diagFilterRaw = params.diag || 'all';
    const diagFilter: SettlementDiagFilter = (
        diagFilterRaw === 'all' ||
        diagFilterRaw === 'unlinked' ||
        diagFilterRaw === 'no_final_refund' ||
        diagFilterRaw === 'status_mismatch' ||
        diagFilterRaw === 'rejected_with_amount'
    )
        ? diagFilterRaw
        : 'all';
    const query = (params.q || '').trim();
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = 30;
    const remainingOnly = params.remaining === '1';
    const expectedOnly = params.from === 'dashboard' && params.view === 'expected';

    const supabase = await createClient();
    const ledgerRefundTargets = await fetchLedgerRefundTargets();
    const {
        rows: fetchedRows,
        loadErrorMessage,
        totalCases: fetchedTotalCases,
        expectedTotal,
        paidTotal,
        remainingTotal,
        connectedCount,
        pendingCount,
        diagnostics,
        diagnosticIssueCount,
        qaChecklist,
    } = await fetchSettlementDashboardData(
        supabase,
        statusFilter,
        diagFilter,
        query,
    );

    const rows = remainingOnly
        ? fetchedRows.filter((row) => row.remaining > 0)
        : expectedOnly
          ? fetchedRows.filter((row) => row.expected > 0)
          : fetchedRows;
    const totalCases = remainingOnly || expectedOnly ? rows.length : fetchedTotalCases;

    const totalPages = Math.max(1, Math.ceil(totalCases / pageSize));
    const normalizedPage = Math.min(page, totalPages);
    const from = (normalizedPage - 1) * pageSize;
    const to = from + pageSize;
    const pagedRows = rows.slice(from, to);

    const diagnosticsExportHref = '/api/settlement/diagnostics/export?scope=issues';
    const diagnosticsFullExportHref = '/api/settlement/diagnostics/export?scope=all';

    const statusTabs: Array<{ value: SettlementStatusFilter; label: string }> = [
        { value: 'all', label: '전체' },
        { value: 'draft', label: '작성중' },
        { value: 'review', label: '검토중' },
        { value: 'approved', label: '승인' },
        { value: 'paid', label: '지급완료' },
        { value: 'rejected', label: '반려' },
    ];

    const diagTabs: Array<{ value: SettlementDiagFilter; label: string }> = [
        { value: 'all', label: '전체진단' },
        { value: 'unlinked', label: '미연결' },
        { value: 'no_final_refund', label: '환불선누락' },
        { value: 'status_mismatch', label: '상태불일치' },
        { value: 'rejected_with_amount', label: '반려금액' },
    ];

    const getLink = (next: {
        status?: SettlementSearchParams['status'];
        diag?: SettlementSearchParams['diag'];
        page?: number;
        q?: string;
    }) => {
        const search = new URLSearchParams();
        const nextStatus = next.status ?? statusFilter;
        const nextDiag = next.diag ?? diagFilter;
        const nextQ = next.q ?? query;
        if (nextStatus && nextStatus !== 'all') search.set('status', nextStatus);
        if (nextDiag && nextDiag !== 'all') search.set('diag', nextDiag);
        if (nextQ) search.set('q', nextQ);
        if (remainingOnly) search.set('remaining', '1');
        if (params.from) search.set('from', params.from);
        if (params.view) search.set('view', params.view);
        search.set('page', String(next.page || 1));
        return `/settlements?${search.toString()}`;
    };

    const statusTabLinks = statusTabs.map((tab) => ({
        ...tab,
        href: getLink({ status: tab.value, page: 1 }),
        active: statusFilter === tab.value,
    }));
    const diagTabLinks = diagTabs.map((tab) => ({
        ...tab,
        href: getLink({ diag: tab.value, page: 1 }),
        active: diagFilter === tab.value,
    }));
    const resetHref = getLink({ status: statusFilter, diag: diagFilter, q: '', page: 1 });
    const prevHref = getLink({ page: Math.max(1, normalizedPage - 1) });
    const nextHref = getLink({ page: Math.min(totalPages, normalizedPage + 1) });

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            <Header title="정산 / 환불" iconName="currency_exchange" />

            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-3 lg:px-6 py-3 lg:py-4 space-y-3">
                    <DashboardEntryNotice from={params.from} view={params.view} resetHref="/settlements" />
                    <SettlementsActionPanel
                        diagnosticsExportHref={diagnosticsExportHref}
                        diagnosticsFullExportHref={diagnosticsFullExportHref}
                    />
                    <SpecialRefundTargetsSection
                        targets={ledgerRefundTargets.targets}
                        generatedAt={ledgerRefundTargets.generatedAt}
                        error={ledgerRefundTargets.error}
                    />
                    <SettlementsStatsStrip
                        totalCases={totalCases}
                        connectedCount={connectedCount}
                        expectedTotal={expectedTotal}
                        paidTotal={paidTotal}
                        remainingTotal={remainingTotal}
                    />
                    <SettlementsDiagnosticsSection
                        diagnostics={diagnostics}
                        diagnosticIssueCount={diagnosticIssueCount}
                    />
                    <SettlementsFilterSection
                        diagTabs={diagTabLinks}
                        statusTabs={statusTabLinks}
                        statusFilter={statusFilter}
                        diagFilter={diagFilter}
                        query={query}
                        resetHref={resetHref}
                        pendingCount={pendingCount}
                    />
                </div>

                <div className="px-3 lg:px-6 pb-4 lg:pb-6">
                    <SettlementsCasesTableSection
                        loadErrorMessage={loadErrorMessage}
                        pagedRows={pagedRows}
                        totalCases={totalCases}
                        from={from}
                        to={to}
                        normalizedPage={normalizedPage}
                        totalPages={totalPages}
                        prevHref={prevHref}
                        nextHref={nextHref}
                    />
                </div>

                <div className="px-3 lg:px-6 pb-4 lg:pb-6">
                    <SettlementsToolsSection qaChecklist={qaChecklist} />
                </div>
            </div>
        </div>
    );
}
