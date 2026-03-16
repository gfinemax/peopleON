import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import {
    KpiCard,
    PaymentProgressRow,
    RetentionWidget,
} from '@/components/features/dashboard/DashboardPagePrimitives';
import type {
    DashboardFinancialStats,
    DashboardPaymentBreakdown,
    DashboardStats,
} from '@/lib/server/dashboardOverview';
export {
    DashboardActionActivitySection,
    DashboardFavoritesSection,
} from '@/components/features/dashboard/DashboardPageEngagementSections';

const FINANCIAL_TYPE_ORDER = [
    'certificate',
    'premium_recognized',
    'contract',
    'installment_1',
    'installment_2',
    'balance',
    'other',
];

function formatAmount(value: number) {
    return `₩${Math.round(value).toLocaleString('ko-KR')}`;
}

export function DashboardKpiSection({
    totalMembers,
    registeredCount,
    registeredRate,
    recentRegisteredCount,
    stats,
}: {
    totalMembers: number;
    registeredCount: number;
    registeredRate: number;
    recentRegisteredCount: number;
    stats: DashboardStats;
}) {
    return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
                title="전체 인물"
                icon="groups"
                value={totalMembers.toLocaleString()}
                unit="명"
                subtitle="조합원관리 집계 기준"
                iconColor="text-blue-500"
                iconBg="bg-blue-500/10"
            />

            <div className="group flex flex-col justify-between rounded-lg border border-border bg-card p-6 shadow-sm hover:shadow-xl hover:border-border/80 transition-all duration-300">
                <div className="flex flex-col mb-4">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                            <MaterialIcon name="how_to_reg" size="sm" />
                        </div>
                        <h3 className="text-sm font-bold text-muted-foreground">등기 조합원 현황</h3>
                    </div>
                    <div className="flex items-baseline gap-2 mb-1">
                        <p className="text-3xl font-black text-foreground tracking-tighter">{registeredCount.toLocaleString()}</p>
                        <span className="text-base font-bold text-muted-foreground">명</span>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground/60">전체 인물 대비 {registeredRate}%</p>
                </div>
                <div className="mt-auto flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border/50">
                    <div className="flex items-center gap-2">
                        <MaterialIcon name="update" size="xs" className="text-muted-foreground" />
                        <span className="text-xs font-bold text-muted-foreground">최근 30일 신규 등기</span>
                    </div>
                    <span className="text-sm font-black text-indigo-500">
                        +{recentRegisteredCount}명
                    </span>
                </div>
            </div>

            <KpiCard
                title="원천 권리증"
                icon="folder"
                value={stats.certificateHolderCount.toLocaleString()}
                unit="건"
                subtitle="중복 제외 원천 권리증"
                iconColor="text-violet-500"
                iconBg="bg-violet-500/10"
            />

            <KpiCard
                title="관계인"
                icon="groups_2"
                value={stats.relatedPartyCount.toLocaleString()}
                unit="명"
                subtitle="대리인 포함"
                iconColor="text-rose-500"
                iconBg="bg-rose-500/10"
            />

            <KpiCard
                title="환불 예정"
                icon="account_balance_wallet"
                value={formatAmount(stats.totalExpectedRefund)}
                subtitle="세입자 제외"
                iconColor="text-amber-500"
                iconBg="bg-amber-500/10"
            />

            <KpiCard
                title="지급 완료"
                icon="paid"
                value={formatAmount(stats.totalPaidRefund)}
                subtitle="누적 현황"
                iconColor="text-emerald-500"
                iconBg="bg-emerald-500/10"
            />

            <KpiCard
                title="잔여 환불"
                icon="receipt_long"
                value={formatAmount(stats.totalRemainingRefund)}
                subtitle="예정 - 지급"
                iconColor={stats.totalRemainingRefund > 0 ? 'text-rose-500' : 'text-emerald-500'}
                iconBg={stats.totalRemainingRefund > 0 ? 'bg-rose-500/10' : 'bg-emerald-500/10'}
            />
        </div>
    );
}

export function DashboardCollectionsSection({
    financialStats,
    paymentBreakdown,
    totalAmount,
    retention,
}: {
    financialStats: DashboardFinancialStats;
    paymentBreakdown: DashboardPaymentBreakdown;
    totalAmount: number;
    retention: DashboardStats['retention'];
}) {
    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-2">
            <div className="group flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-xl hover:border-border/80 transition-all duration-300">
                <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success border border-success/20">
                            <MaterialIcon name="payments" size="sm" />
                        </div>
                        <h3 className="text-sm font-bold text-muted-foreground">분담금 수납 현황</h3>
                    </div>
                    {financialStats.hasData ? (
                        <span className="flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-black text-success border border-success/20">
                            수납률 {financialStats.contributionRate}%
                        </span>
                    ) : (
                        <span className="flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-black text-success border border-success/20">
                            총 {Math.round(totalAmount / 100000000)}억원
                        </span>
                    )}
                </div>
                <div className="space-y-3 mt-2 flex-1">
                    {financialStats.hasData ? (
                        <>
                            {Object.entries(financialStats.byType)
                                .filter(([key]) => key !== 'premium')
                                .sort(([leftKey], [rightKey]) => (
                                    FINANCIAL_TYPE_ORDER.indexOf(leftKey) - FINANCIAL_TYPE_ORDER.indexOf(rightKey)
                                ))
                                .map(([key, value]) => (
                                    <PaymentProgressRow
                                        key={key}
                                        label={value.label}
                                        rate={value.rate}
                                        subtitle={value.due > 0 ? `₩${value.paid.toLocaleString()} / ₩${value.due.toLocaleString()}` : undefined}
                                    />
                                ))}
                        </>
                    ) : (
                        <>
                            <PaymentProgressRow label="1차 분담금" rate={paymentBreakdown.step1.rate} />
                            <PaymentProgressRow label="2차 분담금" rate={paymentBreakdown.step2.rate} />
                            <PaymentProgressRow label="3차 분담금" rate={paymentBreakdown.step3.rate} />
                            <PaymentProgressRow label="기타 납입건" rate={paymentBreakdown.general.rate} />
                        </>
                    )}
                </div>
                {financialStats.hasData && (
                    <div className="mt-4 pt-3 border-t border-border/50 grid grid-cols-2 gap-3">
                        <div className="rounded-md bg-emerald-500/5 p-2.5 border border-emerald-500/10">
                            <p className="text-[9px] font-bold text-emerald-500/70 uppercase tracking-wider">출자금</p>
                            <p className="text-sm font-black text-emerald-500">₩{financialStats.investmentTotal.toLocaleString()}</p>
                        </div>
                        <div className="rounded-md bg-amber-500/5 p-2.5 border border-amber-500/10">
                            <p className="text-[9px] font-bold text-amber-500/70 uppercase tracking-wider">추가 부담</p>
                            <p className="text-sm font-black text-amber-500">₩{financialStats.additionalBurden.toLocaleString()}</p>
                        </div>
                    </div>
                )}
            </div>

            <RetentionWidget retention={retention} />
        </div>
    );
}

export function DashboardFinancialBreakdownSection({
    financialStats,
}: {
    financialStats: DashboardFinancialStats;
}) {
    if (!financialStats.hasData) {
        return null;
    }

    const totalAllAccounts = Object.values(financialStats.byAccount).reduce((sum, value) => sum + value.total, 0);

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {Object.keys(financialStats.byUnitType).length > 0 && (
                <div className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">
                            <MaterialIcon name="straighten" size="sm" />
                        </div>
                        <h3 className="text-sm font-bold text-muted-foreground">평형별 수납 현황</h3>
                    </div>
                    <div className="space-y-3">
                        {Object.entries(financialStats.byUnitType).map(([name, value]) => {
                            const rate = value.due > 0 ? Math.round((value.paid / value.due) * 100) : 0;

                            return (
                                <div key={name} className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-foreground">{name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-muted-foreground">₩{value.paid.toLocaleString()} / ₩{value.due.toLocaleString()}</span>
                                            <span className="text-xs font-black text-foreground">{rate}%</span>
                                        </div>
                                    </div>
                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-700"
                                            style={{ width: `${rate}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {Object.keys(financialStats.byAccount).length > 0 && (
                <div className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500 border border-violet-500/20">
                            <MaterialIcon name="account_balance" size="sm" />
                        </div>
                        <h3 className="text-sm font-bold text-muted-foreground">계좌별 입금 현황</h3>
                    </div>
                    <div className="space-y-2">
                        {Object.entries(financialStats.byAccount)
                            .sort(([, left], [, right]) => right.total - left.total)
                            .map(([name, value]) => {
                                const pct = totalAllAccounts > 0 ? Math.round((value.total / totalAllAccounts) * 100) : 0;
                                const typeColor = value.type === 'union'
                                    ? 'bg-blue-500'
                                    : value.type === 'trust'
                                        ? 'bg-emerald-500'
                                        : value.type === 'external'
                                            ? 'bg-amber-500'
                                            : 'bg-violet-500';
                                const typeLabel = value.type === 'union'
                                    ? '조합'
                                    : value.type === 'trust'
                                        ? '신탁'
                                        : value.type === 'external'
                                            ? '외부'
                                            : '인정';

                                return (
                                    <div key={name} className="flex items-center gap-3 py-1.5">
                                        <div className={cn('w-2 h-2 rounded-full', typeColor)} />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold text-foreground truncate">{name}</span>
                                                <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">{typeLabel}</span>
                                            </div>
                                        </div>
                                        <span className="text-xs font-black text-foreground">₩{value.total.toLocaleString()}</span>
                                        <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
}
