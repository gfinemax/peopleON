'use client';

import { GlobalSearch } from '@/components/features/search/GlobalSearch';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type {
    DashboardEvent,
    DashboardStats,
    PaymentBreakdown,
} from './MobileDashboardTypes';

const formatAmount = (value?: number) => `₩${Math.round(value || 0).toLocaleString('ko-KR')}`;

export function MobileDashboardHeader() {
    return (
        <header className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-sm transition-colors">
            <div className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-2">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="size-10 overflow-hidden rounded-full border-2 border-primary/20 bg-muted/20">
                            <img
                                src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin"
                                alt="Profile"
                                className="h-full w-full object-cover"
                            />
                        </div>
                        <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background" />
                    </div>
                    <div>
                        <h2 className="text-xs font-medium leading-tight text-muted-foreground">안녕하세요,</h2>
                        <h1 className="text-lg font-bold leading-tight text-foreground">관리자님</h1>
                    </div>
                </div>
                <button className="relative flex size-10 items-center justify-center rounded-full transition-colors hover:bg-muted/10">
                    <MaterialIcon name="notifications" size="md" className="text-muted-foreground" />
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full border border-background bg-destructive" />
                </button>
            </div>
            <div className="px-4 py-2 pb-1">
                <GlobalSearch
                    trigger={
                        <div className="relative group">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                <MaterialIcon name="search" size="sm" className="text-muted-foreground transition-colors group-focus-within:text-primary" />
                            </div>
                            <div className="block w-full cursor-text rounded-xl border-none bg-muted/30 py-3 pl-10 pr-3 text-left text-sm font-medium leading-5 text-muted-foreground shadow-sm transition-all">
                                조합원, 동호수 검색...
                            </div>
                        </div>
                    }
                />
            </div>
        </header>
    );
}

function MobileMetricCard({
    icon,
    label,
    value,
    suffix,
    accentClass,
    iconClass,
    highlight,
}: {
    icon: string;
    label: string;
    value: string;
    suffix?: string;
    accentClass: string;
    iconClass: string;
    highlight?: boolean;
}) {
    return (
        <div className="relative flex h-20 flex-col justify-center overflow-hidden rounded-xl border border-border/50 bg-card p-3 shadow-sm">
            <div className={cn('absolute right-0 top-0 h-full w-1', accentClass)} />
            {highlight ? (
                <div className="absolute right-[-10px] top-[-10px] h-16 w-16 rounded-full bg-primary/5 transition-transform duration-500 group-hover:scale-150" />
            ) : null}
            <div className="relative z-10 flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                    <MaterialIcon name={icon} size="sm" className={iconClass} />
                    <span className="text-xs font-bold">{label}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                    <p className="text-2xl font-black tracking-tight text-foreground">{value}</p>
                    {suffix ? <span className="text-[10px] font-bold text-muted-foreground">{suffix}</span> : null}
                </div>
            </div>
        </div>
    );
}

export function MobileDashboardMetrics({
    paymentBreakdown,
    stats,
}: {
    paymentBreakdown?: PaymentBreakdown;
    stats: DashboardStats;
}) {
    return (
        <div className="space-y-3 px-3 pt-1">
            <div className="grid grid-cols-2 gap-2">
                <div className="group">
                    <MobileMetricCard
                        icon="groups"
                        label="전체 인물"
                        value={stats.totalMembers.toLocaleString()}
                        accentClass="bg-primary/0"
                        iconClass="text-primary"
                        highlight
                    />
                </div>
                <MobileMetricCard
                    icon="how_to_reg"
                    label="등기 조합원"
                    value={(stats.registeredMembersCount || 0).toLocaleString()}
                    suffix={`(${stats.registeredMembersRate || 0}%)`}
                    accentClass="bg-indigo-500"
                    iconClass="text-indigo-500"
                />
                <MobileMetricCard
                    icon="folder"
                    label="원천 권리증"
                    value={(stats.certificateHolderCount || 0).toLocaleString()}
                    suffix="건"
                    accentClass="bg-violet-500"
                    iconClass="text-violet-500"
                />
                <MobileMetricCard
                    icon="groups_2"
                    label="관계인"
                    value={(stats.relatedPartyCount || 0).toLocaleString()}
                    suffix="명"
                    accentClass="bg-rose-500"
                    iconClass="text-rose-500"
                />
                <MobileMetricCard
                    icon="account_balance_wallet"
                    label="환불 예정"
                    value={formatAmount(stats.totalExpectedRefund)}
                    accentClass="bg-amber-500"
                    iconClass="text-amber-500"
                />
                <MobileMetricCard
                    icon="paid"
                    label="지급 완료"
                    value={formatAmount(stats.totalPaidRefund)}
                    accentClass="bg-emerald-500"
                    iconClass="text-emerald-500"
                />
                <MobileMetricCard
                    icon="receipt_long"
                    label="잔여 환불"
                    value={formatAmount(stats.totalRemainingRefund)}
                    accentClass={(stats.totalRemainingRefund || 0) > 0 ? 'bg-rose-500' : 'bg-emerald-500'}
                    iconClass={(stats.totalRemainingRefund || 0) > 0 ? 'text-rose-500' : 'text-emerald-500'}
                />
            </div>

            <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <MaterialIcon name="payments" size="sm" className="text-success" />
                        <h4 className="text-xs font-bold text-foreground">납부 현황 잔액</h4>
                    </div>
                    <span className="text-xs font-black text-foreground">
                        {stats.paymentRate}% <span className="text-[10px] font-medium text-muted-foreground">수납 완료</span>
                    </span>
                </div>
                <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-white/10 shadow-inner">
                    <div className="relative h-full rounded-full bg-primary" style={{ width: `${stats.paymentRate}%` }}>
                        <div className="absolute inset-0 h-full w-full animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite] bg-white/20" />
                    </div>
                </div>

                {paymentBreakdown ? (
                    <div className="mb-3 flex flex-col gap-1.5">
                        <PaymentBreakdownRow label="1차납" rate={paymentBreakdown.step1.rate} barClass="bg-success" />
                        <PaymentBreakdownRow label="2차납" rate={paymentBreakdown.step2.rate} barClass="bg-success" />
                        <PaymentBreakdownRow label="3차납" rate={paymentBreakdown.step3.rate} barClass="bg-yellow-500" />
                        <PaymentBreakdownRow label="기타" rate={paymentBreakdown.general.rate} barClass="bg-blue-500" />
                    </div>
                ) : null}

                <div className="flex justify-between border-t border-border/50 px-2 pt-2 text-[10px] font-bold text-muted-foreground">
                    <span>₩{Math.round(stats.collectedAmount / 100000000)}억 수납</span>
                    <span>₩{Math.round((stats.totalAmount - stats.collectedAmount) / 100000000)}억 미납</span>
                </div>
            </div>
        </div>
    );
}

function PaymentBreakdownRow({
    label,
    rate,
    barClass,
}: {
    label: string;
    rate: number;
    barClass: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <span className="w-16 text-[10px] text-muted-foreground">{label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10 shadow-inner">
                <div className={cn('h-full', barClass)} style={{ width: `${rate}%` }} />
            </div>
            <span className="w-6 text-right text-[10px] font-bold">{rate}%</span>
        </div>
    );
}

export function MobileDashboardActivityFeed({ events }: { events: DashboardEvent[] }) {
    return (
        <div className="mb-6 px-3">
            <div className="mb-2 mt-4 flex items-center justify-between">
                <h3 className="text-base font-extrabold text-foreground">최근 활동</h3>
                <button className="text-[10px] font-bold text-primary hover:underline">더 보기</button>
            </div>

            <div className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
                <div className="relative pl-2">
                    <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border/40" />

                    {events.length > 0 ? (
                        events.map((event) => (
                            <TimelineItem
                                key={event.id}
                                title={event.title}
                                time={event.time}
                                desc={event.desc}
                                color={
                                    event.type === 'payment'
                                        ? 'bg-success'
                                        : event.type === 'issue'
                                          ? 'bg-destructive'
                                          : 'bg-primary'
                                }
                            />
                        ))
                    ) : (
                        <div className="py-4 text-center text-xs text-muted-foreground">
                            최근 활동 내역이 없습니다.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TimelineItem({
    title,
    time,
    desc,
    color,
}: {
    title: string;
    time: string;
    desc: string;
    color: string;
}) {
    return (
        <div className="group relative mb-6 flex gap-4 last:mb-0">
            <div className="relative z-10 mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-card ring-2 ring-border">
                <div className={cn('h-2 w-2 rounded-full', color)} />
            </div>
            <div className="flex-1">
                <div className="flex items-start justify-between">
                    <h4 className="text-sm font-bold text-foreground">{title}</h4>
                    <span className="rounded bg-muted/30 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{time}</span>
                </div>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{desc}</p>
            </div>
        </div>
    );
}
