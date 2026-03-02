import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import { MobileDashboard } from '@/components/features/dashboard/MobileDashboard';
import { getUnifiedMembers } from '@/services/memberAggregation';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    // Safe Data Handling
    // Safe Data Handling
    // Safe Data Handling
    let safeStats = {
        totalMembers: 0,
        totalAmount: 0,
        collectedAmount: 0,
        paymentRate: 0,
        registeredMembersCount: 0,
        registeredMembersRate: 0,
        recentRegisteredCount: 0,
        certificateHolderCount: 0,
        relatedPartyCount: 0,
    };
    let safeEvents: any[] = [];
    let paymentBreakdown = {
        step1: { due: 0, paid: 0, rate: 0 },
        step2: { due: 0, paid: 0, rate: 0 },
        step3: { due: 0, paid: 0, rate: 0 },
        general: { due: 0, paid: 0, rate: 0 },
    };

    let t1Count = 0;
    let lOwnerCount = 0;
    let tier1Percent = 0;
    let landOwnerPercent = 0;
    let totalMembers = 0;
    let registeredCount = 0;
    let registeredRate = 0;
    let recentRegisteredCount = 0;
    let favoriteList: any[] = [];
    let actionList: any[] = [];
    let currentUser: any = null;

    try {
        const supabase = await createClient();

        const { data: { user } } = await supabase.auth.getUser();
        currentUser = user;

        // Fetch unified view for accurate dashboard KPI
        const { unifiedPeople } = await getUnifiedMembers(supabase);

        totalMembers = unifiedPeople.filter((p) => p.role_types.includes('member')).length;
        registeredCount = unifiedPeople.filter((p) => p.is_registered).length;
        registeredRate = totalMembers > 0 ? Math.round((registeredCount / totalMembers) * 100) : 0;

        // Fetch recent registered roles
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: recentRoles } = await supabase
            .from('membership_roles')
            .select('entity_id')
            .eq('is_registered', true)
            .gte('created_at', thirtyDaysAgo.toISOString());

        recentRegisteredCount = new Set((recentRoles || []).map(r => r.entity_id)).size;

        // Additional counts for new dashboard cards
        const certificateHolderCount = unifiedPeople.filter((p) => p.role_types.includes('certificate_holder')).length;
        const relatedPartyCount = unifiedPeople.filter((p) => p.role_types.includes('related_party')).length;

        // Fetch payments
        const { data: allPayments } = await supabase.from('payments').select('amount_due, amount_paid, step');

        const totalAmountVal = allPayments?.reduce((acc: any, p: any) => acc + (p.amount_due || 0), 0) || 0;
        const collectedAmountVal = allPayments?.reduce((acc: any, p: any) => acc + (p.amount_paid || 0), 0) || 0;
        const paymentStatsRate = totalAmountVal > 0 ? Math.round((collectedAmountVal / totalAmountVal) * 100) : 0;

        // Calculate breakdown by step
        if (allPayments) {
            allPayments.forEach((p: any) => {
                const step = p.step || 0;
                const due = p.amount_due || 0;
                const paid = p.amount_paid || 0;

                if (step === 1) { paymentBreakdown.step1.due += due; paymentBreakdown.step1.paid += paid; }
                else if (step === 2) { paymentBreakdown.step2.due += due; paymentBreakdown.step2.paid += paid; }
                else if (step === 3) { paymentBreakdown.step3.due += due; paymentBreakdown.step3.paid += paid; }
                else if (step > 3) { paymentBreakdown.general.due += due; paymentBreakdown.general.paid += paid; }
            });

            paymentBreakdown.step1.rate = paymentBreakdown.step1.due > 0 ? Math.round((paymentBreakdown.step1.paid / paymentBreakdown.step1.due) * 100) : 0;
            paymentBreakdown.step2.rate = paymentBreakdown.step2.due > 0 ? Math.round((paymentBreakdown.step2.paid / paymentBreakdown.step2.due) * 100) : 0;
            paymentBreakdown.step3.rate = paymentBreakdown.step3.due > 0 ? Math.round((paymentBreakdown.step3.paid / paymentBreakdown.step3.due) * 100) : 0;
            paymentBreakdown.general.rate = paymentBreakdown.general.due > 0 ? Math.round((paymentBreakdown.general.paid / paymentBreakdown.general.due) * 100) : 0;
        }

        safeStats = {
            totalMembers,
            totalAmount: totalAmountVal,
            collectedAmount: collectedAmountVal,
            paymentRate: paymentStatsRate,
            registeredMembersCount: registeredCount,
            registeredMembersRate: registeredRate,
            recentRegisteredCount: recentRegisteredCount,
            certificateHolderCount,
            relatedPartyCount
        };

        // Fetch events
        const { data: recentPayments } = await supabase
            .from('payments')
            .select('*, account_entities(display_name)')
            .not('paid_date', 'is', null)
            .order('paid_date', { ascending: false })
            .limit(3);

        const { data: newMembers } = await supabase
            .from('account_entities')
            .select('id, display_name, created_at, unit_group')
            .order('created_at', { ascending: false })
            .limit(3);

        // Fetch Favorites
        const { data: favs } = await supabase
            .from('account_entities')
            .select('*')
            .eq('is_favorite', true)
            .order('display_name', { ascending: true })
            .limit(10);

        favoriteList = favs || [];

        // Identify Duplicate Certificate Holders
        const certNumberMap = new Map<string, any[]>();
        unifiedPeople.forEach(p => {
            if (p.role_types.includes('certificate_holder') && p.member_number && p.member_number !== '-') {
                const nums = p.member_number.split(',').map(n => n.replace(/\s?외\s?\d+건/, '').trim()).filter(Boolean);
                nums.forEach(n => {
                    const normNum = n.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/[\s]/g, '').toLowerCase();
                    if (normNum) {
                        const existing = certNumberMap.get(normNum) || [];
                        existing.push({ person: p, rawNum: n });
                        certNumberMap.set(normNum, existing);
                    }
                });
            }
        });

        const duplicateConflicts: any[] = [];
        const seenDuplicateIds = new Set<string>();

        for (const [certNum, items] of certNumberMap.entries()) {
            if (items.length > 1) {
                const people = items.map(i => i.person);
                const rawNum = items[0].rawNum;

                const namesText = people.map(p => p.name).join(', ');

                people.forEach(p => seenDuplicateIds.add(p.id));
                duplicateConflicts.push({
                    id: `dup-${certNum}`,
                    name: `🛑 [권리증 충돌]`,
                    member_number: rawNum,
                    tier: `중복 (${people.length}명)`,
                    phone: namesText, // Passed to amount/phoneText in row
                    status: '충돌오류',
                    href: `/members?q=${encodeURIComponent(rawNum)}`
                });
            }
        }

        // Fetch Action Required (withdrawn/lawsuit members)
        const { data: withdrawnRoles } = await supabase
            .from('membership_roles')
            .select('entity_id')
            .eq('role_status', 'inactive')
            .limit(10); // Fetch a bit more to mix

        let dbActionList: any[] = [];
        if (withdrawnRoles && withdrawnRoles.length > 0) {
            const entityIds = withdrawnRoles.map((r: { entity_id: string }) => r.entity_id);
            // Don't fetch if they are already in duplicateConflicts to avoid showing them twice
            const filteredEntityIds = entityIds.filter(id => !seenDuplicateIds.has(id));

            if (filteredEntityIds.length > 0) {
                const { data: actions } = await supabase
                    .from('account_entities')
                    .select('id, display_name, phone, member_number, status')
                    .in('id', filteredEntityIds);

                dbActionList = (actions || []).map((a: any) => ({
                    id: a.id,
                    name: a.display_name,
                    member_number: a.member_number,
                    tier: '기타', // We can get this from unifiedPeople if needed, but let's keep it simple or look it up
                    phone: a.phone,
                    status: a.status || '탈퇴', // Or lawsuit
                    href: `/members/${a.id}`
                }));
            }
        }

        // Merge them, prioritizing duplicates
        actionList = [...duplicateConflicts, ...dbActionList].slice(0, 8); // Show up to 8 action items


        // Process Events
        const rawEvents: any[] = [];

        recentPayments?.forEach((p: any) => {
            const memberName = Array.isArray(p.account_entities) ? p.account_entities[0]?.display_name : p.account_entities?.display_name;
            rawEvents.push({
                id: `pay-${p.id}`,
                dateVal: new Date(p.paid_date || Date.now()).getTime(),
                title: `수납 확인: ${memberName || '조합원'}`,
                time: typeof p.paid_date === 'string' ? p.paid_date.substring(5, 10) : '-',
                desc: `${p.step_name || p.step + '차'} 납부 완료 (${(p.amount_paid || 0).toLocaleString()}원)`,
                type: 'payment'
            });
        });

        newMembers?.forEach((m: any) => {
            rawEvents.push({
                id: `new-${m.id}`,
                dateVal: new Date(m.created_at || Date.now()).getTime(),
                title: `신규 가입: ${m.display_name || '이름 미정'}`,
                time: typeof m.created_at === 'string' ? m.created_at.substring(5, 10) : '-',
                desc: `${m.unit_group || '동호수 미정'} 조합원 등록`,
                type: 'member'
            });
        });

        safeEvents = rawEvents
            .sort((a, b) => b.dateVal - a.dateVal)
            .slice(0, 5)
            .map(e => ({
                id: String(e.id),
                title: String(e.title),
                time: String(e.time),
                desc: String(e.desc),
                type: e.type
            }));

    } catch (error) {
        console.error("Dashboard Data Fetch Error:", error);
    }

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

                        {/* KPI Stats Grid */}
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                            {/* Stat 1: Total Members */}
                            <KpiCard
                                title="총 조합원"
                                icon="groups"
                                value={totalMembers.toLocaleString()}
                                unit="명"
                                trend="+2.5%"
                                trendIcon="trending_up"
                                subtitle="지난달 대비 32명 증가"
                                iconColor="text-blue-500"
                                iconBg="bg-blue-500/10"
                            />

                            {/* Stat 2: Registered Members Indicator */}
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
                                    <p className="text-[10px] font-bold text-muted-foreground/60">전체 대비 {registeredRate}% 완료</p>
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

                            {/* Stat 3: Certificate Holders */}
                            <KpiCard
                                title="권리증 보유"
                                icon="folder"
                                value={safeStats.certificateHolderCount.toLocaleString()}
                                unit="명"
                                subtitle="중복 병합 완료"
                                iconColor="text-violet-500"
                                iconBg="bg-violet-500/10"
                            />

                            {/* Stat 4: Related Parties */}
                            <KpiCard
                                title="관계인"
                                icon="groups_2"
                                value={safeStats.relatedPartyCount.toLocaleString()}
                                unit="명"
                                subtitle="대리인 포함"
                                iconColor="text-rose-500"
                                iconBg="bg-rose-500/10"
                            />
                        </div>

                        {/* Financial and Recent Events Grid */}
                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mt-2">
                            {/* Total Collections Overview & Details */}
                            <div className="group flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-xl hover:border-border/80 transition-all duration-300">
                                <div className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success border border-success/20">
                                            <MaterialIcon name="payments" size="sm" />
                                        </div>
                                        <h3 className="text-sm font-bold text-muted-foreground">분담금 수납 현황</h3>
                                    </div>
                                    <span className="flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-black text-success border border-success/20">
                                        총 {Math.round(safeStats.totalAmount / 100000000)}억원
                                    </span>
                                </div>
                                <div className="space-y-3 mt-2 flex-1">
                                    <PaymentProgressRow label="1차 분담금" rate={paymentBreakdown.step1.rate} />
                                    <PaymentProgressRow label="2차 분담금" rate={paymentBreakdown.step2.rate} />
                                    <PaymentProgressRow label="3차 분담금" rate={paymentBreakdown.step3.rate} />
                                    <PaymentProgressRow label="기타 납입건" rate={paymentBreakdown.general.rate} />
                                </div>
                            </div>
                        </div>

                        {/* Favorite Members Section */}
                        {favoriteList && favoriteList.length > 0 && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-2 px-1">
                                    <MaterialIcon name="star" size="md" className="text-yellow-400" filled />
                                    <h3 className="text-lg font-extrabold text-foreground">즐겨찾기 조합원</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {favoriteList.map((member: any) => (
                                        <Link
                                            key={member.id}
                                            href={`/members?q=${member.name}`}
                                            className="group relative flex flex-col p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-all hover:shadow-md hover:border-primary/30"
                                        >
                                            <div className="absolute top-3 right-3 text-yellow-400">
                                                <MaterialIcon name="star" size="sm" filled />
                                            </div>
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="size-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-sm border border-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                                                    {member.name.slice(0, 1)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-foreground">{member.name}</p>
                                                    <p className="text-[11px] font-mono text-muted-foreground">{member.member_number}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold text-muted-foreground border border-border">
                                                    {member.tier || '차수미정'}
                                                </span>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded text-[10px] font-bold border",
                                                    member.status === '정상' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                                                        member.status === '탈퇴' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                                                            "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                                )}>
                                                    {member.status || '상태미정'}
                                                </span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

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
                                                <th className="pl-6 pr-4 py-3 font-black text-[10px] uppercase tracking-[0.2em]">이름 / 조합원 번호</th>
                                                <th className="px-4 py-3 font-black text-[10px] uppercase tracking-[0.2em]">구분</th>
                                                <th className="px-4 py-3 font-black text-[10px] uppercase tracking-[0.2em]">상태</th>
                                                <th className="px-4 py-3 font-black text-[10px] uppercase tracking-[0.2em] text-right">전화번호</th>
                                                <th className="pl-4 pr-6 py-3 font-black text-[10px] uppercase tracking-[0.2em] text-center">조치</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/20">
                                            {actionList && actionList.length > 0 ? (
                                                actionList.map((member: any) => (
                                                    <ActionRequiredRow
                                                        key={member.id}
                                                        name={member.name}
                                                        memberId={member.member_number}
                                                        tier={member.tier || '-'}
                                                        status={member.status || '미확인'}
                                                        statusColor={
                                                            member.status === '충돌오류' ? "bg-red-500/20 text-red-600 border-red-500/30 font-black animate-pulse" :
                                                                member.status === '탈퇴' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                                                                    member.status === '소송중' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                                                                        "bg-gray-500/10 text-gray-500 border-gray-500/20"
                                                        }
                                                        amount={member.phone || '-'}
                                                        actionLabel="상세 보기"
                                                        isPrimaryAction={true}
                                                        href={member.href}
                                                    />
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm font-bold">
                                                        조치가 필요한 조합원이 없습니다.
                                                    </td>
                                                </tr>
                                            )}
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

// Keep components defined for later restoration
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

function ActionRequiredRow({ name, memberId, tier, status, statusColor, amount, actionLabel, isPrimaryAction, href }: any) {
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
                    tier.includes('중복') ? "bg-red-500/10 text-red-500 border-red-500/20" :
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
                {amount}
            </td>
            <td className="pl-4 pr-6 py-3 text-center">
                {href ? (
                    <Link href={href} className={cn(
                        "inline-block rounded-lg px-4 py-1.5 text-[10px] font-black transition-all shadow-sm",
                        isPrimaryAction
                            ? "bg-primary text-white hover:bg-primary-hover shadow-primary/20"
                            : "border border-border bg-card text-foreground hover:bg-muted/10"
                    )}>
                        {actionLabel}
                    </Link>
                ) : (
                    <button className={cn(
                        "rounded-lg px-4 py-1.5 text-[10px] font-black transition-all shadow-sm",
                        isPrimaryAction
                            ? "bg-primary text-white hover:bg-primary-hover shadow-primary/20"
                            : "border border-border bg-card text-foreground hover:bg-muted/10"
                    )}>
                        {actionLabel}
                    </button>
                )}
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
                    <MaterialIcon name={icon} size="sm" filled />
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

function PaymentProgressRow({ label, rate }: { label: string, rate: number }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground">{label}</span>
                <span className="text-xs font-extrabold text-foreground">{rate}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 dark:bg-white/10 shadow-inner">
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        rate >= 90 ? "bg-success" : rate >= 50 ? "bg-yellow-500" : "bg-blue-500"
                    )}
                    style={{ width: `${rate}%` }}
                />
            </div>
        </div>
    );
}
