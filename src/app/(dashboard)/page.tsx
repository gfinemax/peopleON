import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import { MobileDashboard } from '@/components/features/dashboard/MobileDashboard';

export default async function DashboardPage() {
    const supabase = await createClient();

    // Fetch real data
    const { count: memberCount } = await supabase.from('members').select('*', { count: 'exact', head: true });
    const { count: tier1Count } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('tier', '1차');
    const { count: landOwnerCount } = await supabase.from('members').select('*', { count: 'exact', head: true }).eq('tier', '지주');

    // Calculate percentages
    const totalMembers = memberCount || 1240; // Fallback for demo if no data
    const t1Count = tier1Count || 558;
    const lOwnerCount = landOwnerCount || 372;
    const tier1Percent = Math.round((t1Count / totalMembers) * 100);
    const landOwnerPercent = Math.round((lOwnerCount / totalMembers) * 100);

    // Fetch payments for stats (using lightweight query)
    const { data: allPayments } = await supabase.from('payments').select('amount_due, amount_paid');
    const totalAmount = allPayments?.reduce((acc: any, p: any) => acc + (p.amount_due || 0), 0) || 0;
    const collectedAmount = allPayments?.reduce((acc: any, p: any) => acc + (p.amount_paid || 0), 0) || 0;
    const paymentStatsRate = totalAmount > 0 ? Math.round((collectedAmount / totalAmount) * 100) : 0; // Renamed to avoid collision

    // Fetch recent events
    // 1. Recent Payments
    const { data: recentPayments } = await supabase
        .from('payments')
        .select('*, members(name)')
        .not('paid_date', 'is', null)
        .order('paid_date', { ascending: false })
        .limit(3);

    // 2. New Members
    const { data: newMembers } = await supabase
        .from('members')
        .select('id, name, created_at, unit_group')
        .order('created_at', { ascending: false })
        .limit(3);

    // Combine and Sort Events
    const events: any[] = [];

    recentPayments?.forEach((p: any) => {
        events.push({
            id: `pay-${p.id}`,
            date: new Date(p.paid_date),
            title: `수납 확인: ${p.members?.name || '조합원'}`,
            time: p.paid_date?.substring(5, 10), // MM-DD
            desc: `${p.step_name || p.step + '차'} 납부 완료 (${p.amount_paid.toLocaleString()}원)`,
            type: 'payment'
        });
    });

    newMembers?.forEach((m: any) => {
        events.push({
            id: `new-${m.id}`,
            date: new Date(m.created_at),
            title: `신규 가입: ${m.name}`,
            time: m.created_at?.substring(5, 10),
            desc: `${m.unit_group || '동호수 미정'} 조합원 등록`,
            type: 'member'
        });
    });

    // Sort by date desc
    const sortedEvents = events.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5).map(e => ({
        id: e.id,
        title: e.title,
        time: e.time,
        desc: e.desc,
        type: e.type
    }));

    return (
        <>
            <div className="lg:hidden">
                <MobileDashboard
                    stats={{
                        totalMembers: totalMembers,
                        totalAmount: totalAmount,
                        collectedAmount: collectedAmount,
                        paymentRate: paymentStatsRate
                    }}
                    events={sortedEvents as any}
                />
            </div>
            <div className="hidden lg:flex flex-1 flex-col h-full overflow-hidden bg-background">
                <Header title="통합 대시보드" />

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
                            <div className="flex gap-2">
                                <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-bold text-foreground hover:bg-muted/10 transition-all shadow-sm">
                                    <MaterialIcon name="file_download" size="sm" />
                                    보고서 다운로드
                                </button>
                                <Link
                                    href="/members?action=new"
                                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white shadow-lg shadow-primary/30 hover:bg-primary-hover transition-all"
                                >
                                    <MaterialIcon name="add" size="sm" />
                                    신규 회원 등록
                                </Link>
                            </div>
                        </div>

                        {/* KPI Stats Grid */}
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                            {/* Stat 1: Total Members */}
                            <KpiCard
                                title="총 조합원"
                                icon="groups"
                                value={totalMembers.toLocaleString()}
                                unit="명"
                                trend="+2.5%"
                                trendIcon="trending_up"
                                subtitle={<>지난달 대비 <span className="text-foreground font-bold">32명</span> 증가</>}
                                iconColor="text-blue-500"
                                iconBg="bg-blue-500/10"
                            />

                            {/* Stat 2: Member Distribution */}
                            <div className="group flex flex-col rounded-lg border border-border bg-card p-8 shadow-sm hover:shadow-xl hover:border-border/80 transition-all duration-300">
                                <div className="mb-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                            <MaterialIcon name="pie_chart" size="md" />
                                        </div>
                                        <h3 className="text-base font-bold text-muted-foreground">조합원 현황</h3>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-muted-foreground">
                                                1차 <span className="text-muted-foreground/60 ml-1">({tier1Percent}%)</span>
                                            </span>
                                            <span className="text-sm font-extrabold text-foreground">{t1Count.toLocaleString()}명</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                                            <div
                                                className="bg-primary h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${tier1Percent}%` }}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-bold text-muted-foreground">
                                                지주 <span className="text-muted-foreground/60 ml-1">({landOwnerPercent}%)</span>
                                            </span>
                                            <span className="text-sm font-extrabold text-foreground">{lOwnerCount.toLocaleString()}명</span>
                                        </div>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
                                            <div
                                                className="bg-purple-500 h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${landOwnerPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stat 3: Total Collections */}
                            <div className="group flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm hover:shadow-xl hover:border-border/80 transition-all duration-300">
                                <div className="mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success border border-success/20">
                                            <MaterialIcon name="payments" size="sm" />
                                        </div>
                                        <h3 className="text-sm font-bold text-muted-foreground">총 수납액</h3>
                                    </div>
                                    <span className="flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-black text-success border border-success/20">
                                        <MaterialIcon name="trending_up" size="xs" className="mr-1" /> +15.0%
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-2 mb-4">
                                    <p className="text-3xl font-black text-foreground tracking-tighter">145.0</p>
                                    <span className="text-base font-bold text-muted-foreground">억원</span>
                                </div>
                                <div className="flex w-full gap-4">
                                    <div className="flex flex-col gap-1.5 w-1/2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">수납완료</span>
                                            <span className="text-[10px] font-black text-foreground">92%</span>
                                        </div>
                                        <div className="h-1.5 w-full rounded-full bg-muted/30">
                                            <div className="h-full rounded-full bg-success shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: '92%' }} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5 w-1/2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">미수납</span>
                                            <span className="text-[10px] font-black text-foreground">8%</span>
                                        </div>
                                        <div className="h-1.5 w-full rounded-full bg-muted/30">
                                            <div className="h-full rounded-full bg-destructive/60" style={{ width: '8%' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Content Section: Action Required & Recent Activity */}
                        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                            {/* Table (8/12 col span) */}
                            <div className="flex flex-col rounded-lg border border-border bg-card shadow-sm lg:col-span-8 overflow-hidden">
                                <div className="flex items-center justify-between bg-card/30 p-6 border-b border-border/50">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                                            <MaterialIcon name="warning" className="text-destructive" size="sm" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-extrabold text-foreground">조치 필요 조합원</h3>
                                            <p className="text-[10px] font-bold text-muted-foreground mt-0.5">
                                                <span className="text-destructive bg-destructive/10 px-1 py-0.5 rounded mr-1">High Risk</span>
                                                긴급 관리가 필요한 조합원 목록입니다.
                                            </p>
                                        </div>
                                    </div>
                                    <Link
                                        href="/members"
                                        className="text-sm font-bold text-primary hover:text-primary-hover transition-colors"
                                    >
                                        전체 보기
                                    </Link>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="text-muted-foreground/50 border-b border-border/30">
                                            <tr>
                                                <th className="pl-6 pr-4 py-3 font-black text-[10px] uppercase tracking-[0.2em]">이름 / 조합원 번로</th>
                                                <th className="px-4 py-3 font-black text-[10px] uppercase tracking-[0.2em]">구분</th>
                                                <th className="px-4 py-3 font-black text-[10px] uppercase tracking-[0.2em]">상태</th>
                                                <th className="px-4 py-3 font-black text-[10px] uppercase tracking-[0.2em] text-right">미납액</th>
                                                <th className="pl-4 pr-6 py-3 font-black text-[10px] uppercase tracking-[0.2em] text-center">조치</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/20">
                                            <ActionRequiredRow
                                                name="홍길동"
                                                memberId="Mem-2023-089"
                                                tier="1차"
                                                status="장기 미납"
                                                statusColor="bg-red-500/10 text-red-500 border-red-500/20"
                                                amount={3500000}
                                                actionLabel="납부 요청"
                                                isPrimaryAction
                                            />
                                            <ActionRequiredRow
                                                name="이영희"
                                                memberId="Mem-2023-102"
                                                tier="지주"
                                                status="서류 미비"
                                                statusColor="bg-orange-500/10 text-orange-500 border-orange-500/20"
                                                amount={null}
                                                actionLabel="문자 발송"
                                            />
                                            <ActionRequiredRow
                                                name="박철수"
                                                memberId="Mem-2024-005"
                                                tier="2차"
                                                status="미납"
                                                statusColor="bg-red-500/10 text-red-500 border-red-500/20"
                                                amount={1200000}
                                                actionLabel="납부 요청"
                                                isPrimaryAction
                                            />
                                            <ActionRequiredRow
                                                name="최민수"
                                                memberId="Mem-2023-311"
                                                tier="1차"
                                                status="계약 확인"
                                                statusColor="bg-amber-500/10 text-amber-500 border-amber-500/20"
                                                amount={null}
                                                actionLabel="확인 하기"
                                            />
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Recent Activity (4/12 col span) */}
                            <div className="flex flex-col rounded-lg border border-border bg-card shadow-sm lg:col-span-4 h-fit">
                                <div className="flex items-center justify-between p-4 border-b border-border/50">
                                    <h3 className="text-lg font-extrabold text-foreground">최근 활동</h3>
                                    <button className="rounded-lg p-1.5 hover:bg-muted/20 text-muted-foreground hover:text-foreground transition-colors">
                                        <MaterialIcon name="more_horiz" size="sm" />
                                    </button>
                                </div>
                                <div className="flex flex-col p-6 bg-card/10">
                                    <ActivityItem
                                        icon="sms"
                                        iconColor="text-blue-400"
                                        iconBg="bg-blue-400/10"
                                        title="납부 안내 문자 발송"
                                        desc="미납 회원 24명에게 안내 메시지 발송 완료"
                                        time="10분 전"
                                        isLast={false}
                                    />
                                    <ActivityItem
                                        icon="payments"
                                        iconColor="text-success"
                                        iconBg="bg-success/10"
                                        title="수납 확인: 김철수"
                                        desc="3차 분담금 15,000,000원 입금 확인"
                                        time="1시간 전"
                                        isLast={false}
                                    />
                                    <ActivityItem
                                        icon="person_add"
                                        iconColor="text-purple-400"
                                        iconBg="bg-purple-400/10"
                                        title="신규 회원 등록"
                                        desc="신규 지주 조합원 '이미자' 등록 완료"
                                        time="3시간 전"
                                        isLast={false}
                                    />
                                    <ActivityItem
                                        icon="edit_note"
                                        iconColor="text-orange-400"
                                        iconBg="bg-orange-400/10"
                                        title="규약 변경 승인"
                                        desc="관리자 승인 대기중"
                                        time="어제"
                                        isLast={true}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}

function KpiCard({ title, icon, value, unit, trend, trendIcon, subtitle, iconColor, iconBg }: any) {
    return (
        <div className="group flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm hover:shadow-xl hover:border-border/80 transition-all duration-300">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg border transition-colors", iconBg, iconColor, "border-current/20")}>
                        <MaterialIcon name={icon} size="sm" />
                    </div>
                    <h3 className="text-sm font-bold text-muted-foreground">{title}</h3>
                </div>
                {trend && (
                    <span className="flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-black text-success border border-success/20">
                        <MaterialIcon name={trendIcon} size="xs" className="mr-1" /> {trend}
                    </span>
                )}
            </div>
            <div className="flex items-baseline gap-2 mb-1">
                <p className="text-3xl font-black text-foreground tracking-tighter">{value}</p>
                <span className="text-base font-bold text-muted-foreground">{unit}</span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground/60">{subtitle}</p>
        </div>
    );
}

function ActionRequiredRow({ name, memberId, tier, status, statusColor, amount, actionLabel, isPrimaryAction }: any) {
    return (
        <tr className="group hover:bg-muted/10 transition-colors">
            <td className="pl-6 pr-4 py-3">
                <div className="flex flex-col">
                    <span className="font-extrabold text-foreground text-sm">{name}</span>
                    <span className="text-[10px] font-bold text-muted-foreground/60 tracking-wider font-mono mt-0.5">{memberId}</span>
                </div>
            </td>
            <td className="px-4 py-3">
                <span className={cn(
                    "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-black border uppercase tracking-wider",
                    tier === '1차' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                        tier === '지주' ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                            "bg-success/10 text-success border-success/20"
                )}>
                    {tier}
                </span>
            </td>
            <td className="px-4 py-3">
                <span className={cn(
                    "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-black border uppercase tracking-wider",
                    statusColor
                )}>
                    {status}
                </span>
            </td>
            <td className="px-4 py-3 text-right font-black text-foreground text-sm">
                {amount ? `₩${amount.toLocaleString()}` : '-'}
            </td>
            <td className="pl-4 pr-6 py-3 text-center">
                <button className={cn(
                    "rounded-lg px-4 py-1.5 text-[10px] font-black transition-all shadow-sm",
                    isPrimaryAction
                        ? "bg-primary text-white hover:bg-primary-hover shadow-primary/20"
                        : "border border-border bg-card text-foreground hover:bg-muted/10"
                )}>
                    {actionLabel}
                </button>
            </td>
        </tr>
    );
}

function ActivityItem({ icon, iconColor, iconBg, title, desc, time, isLast }: any) {
    return (
        <div className="relative flex gap-4">
            {!isLast && (
                <div className="absolute left-[17px] top-8 bottom-0 w-px bg-border/30" />
            )}
            <div className="flex flex-col items-center flex-shrink-0">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 z-10 shadow-sm", iconBg, iconColor)}>
                    <MaterialIcon name={icon} size="xs" filled />
                </div>
            </div>
            <div className={cn("flex flex-col gap-0.5 pt-0.5", !isLast ? "pb-8" : "")}>
                <h4 className="text-xs font-black text-foreground">{title}</h4>
                <p className="text-[12px] font-bold text-muted-foreground leading-snug">{desc}</p>
                <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest mt-1">{time}</span>
            </div>
        </div>
    );
}
