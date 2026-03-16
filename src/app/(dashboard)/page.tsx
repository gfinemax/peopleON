import { Header } from '@/components/layout/Header';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

import {
    DashboardActionActivitySection,
    DashboardCollectionsSection,
    DashboardFavoritesSection,
    DashboardFinancialBreakdownSection,
    DashboardKpiSection,
} from '@/components/features/dashboard/DashboardPageSections';
import { MobileDashboard } from '@/components/features/dashboard/MobileDashboard';
import {
    createEmptyDashboardOverviewData,
    fetchDashboardOverviewData,
} from '@/lib/server/dashboardOverview';

export const dynamic = 'force-dynamic';

function isInvalidRefreshTokenError(error: unknown) {
    const message =
        typeof error === 'object' && error && 'message' in error
            ? String((error as { message?: unknown }).message || '')
            : '';

    return message.includes('Invalid Refresh Token') || message.includes('Refresh Token Not Found');
}

export default async function DashboardPage() {
    let dashboardData = createEmptyDashboardOverviewData();
    let currentUser: any = null;

    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
            if (isInvalidRefreshTokenError(authError)) {
                redirect('/login');
            }

            throw authError;
        }

        currentUser = user;
        dashboardData = await fetchDashboardOverviewData(supabase);

    } catch (error) {
        console.error("Dashboard Data Fetch Error:", error);
    }

    const {
        stats: safeStats,
        events: safeEvents,
        paymentBreakdown,
        financialStats,
        favoriteList,
        actionList,
    } = dashboardData;
    const totalMembers = safeStats.totalMembers;
    const registeredCount = safeStats.registeredMembersCount || 0;
    const registeredRate = safeStats.registeredMembersRate || 0;
    const recentRegisteredCount = safeStats.recentRegisteredCount || 0;

    return (
        <>
            <div className="lg:hidden">
                <MobileDashboard
                    stats={safeStats}
                    events={safeEvents}
                    paymentBreakdown={paymentBreakdown}
                />
            </div>
            <div className="hidden lg:flex flex-1 flex-col h-full overflow-hidden bg-background">
                <Header
                    title="통합 대시보드"
                    userEmail={currentUser?.email}
                    userName={currentUser?.user_metadata?.name || '관리자'}
                />

                <main className="flex flex-1 flex-col overflow-y-auto">
                    <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
                        {/* Page Heading */}
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
                                    안녕하세요, 관리자님
                                </h2>
                                <p className="text-muted-foreground/50 font-medium text-sm tracking-tight opacity-80">
                                    오늘의 주요 현황 및 조치 필요 항목을 확인하세요.
                                </p>
                            </div>
                        </div>

                        <DashboardKpiSection
                            totalMembers={totalMembers}
                            registeredCount={registeredCount}
                            registeredRate={registeredRate}
                            recentRegisteredCount={recentRegisteredCount}
                            stats={safeStats}
                        />

                        <DashboardCollectionsSection
                            financialStats={financialStats}
                            paymentBreakdown={paymentBreakdown}
                            totalAmount={safeStats.totalAmount}
                            retention={safeStats.retention}
                        />

                        <DashboardFinancialBreakdownSection financialStats={financialStats} />
                        <DashboardFavoritesSection favoriteList={favoriteList} />
                        <DashboardActionActivitySection actionList={actionList} />
                    </div>
                </main>
            </div>
        </>
    );
}
