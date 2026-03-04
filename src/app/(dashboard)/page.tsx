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
        retention: {
            registeredActive: 0,
            unregisteredActive: 0,
            registeredWithdrawn: 0,
            unregisteredWithdrawn: 0,
            totalHistorical: 0
        }
    };
    let safeEvents: any[] = [];
    let paymentBreakdown = {
        step1: { due: 0, paid: 0, rate: 0 },
        step2: { due: 0, paid: 0, rate: 0 },
        step3: { due: 0, paid: 0, rate: 0 },
        general: { due: 0, paid: 0, rate: 0 },
    };

    // New financial stats from member_payments
    let financialStats = {
        contributionDue: 0,
        contributionPaid: 0,
        contributionRate: 0,
        investmentTotal: 0,  // 출자금 (필증 + 인정분)
        additionalBurden: 0, // 추가 부담금
        byType: {} as Record<string, { label: string; due: number; paid: number; rate: number }>,
        byUnitType: {} as Record<string, { due: number; paid: number; count: number }>,
        byAccount: {} as Record<string, { total: number; type: string }>,
        hasData: false,
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

        // Calculate Retention Stats
        let registeredActive = 0;
        let unregisteredActive = 0;
        let registeredWithdrawn = 0;
        let unregisteredWithdrawn = 0;

        unifiedPeople.forEach(p => {
            const isWithdrawnStatus = ['탈퇴', '제명'].includes(p.status || '');
            const isHistoricalMember = p.role_types.includes('member') || isWithdrawnStatus;

            if (isHistoricalMember) {
                if (p.is_registered) {
                    if (isWithdrawnStatus) {
                        registeredWithdrawn++;
                    } else {
                        registeredActive++;
                    }
                } else {
                    if (isWithdrawnStatus) {
                        unregisteredWithdrawn++;
                    } else {
                        unregisteredActive++;
                    }
                }
            }
        });

        const totalHistorical = registeredActive + unregisteredActive + registeredWithdrawn + unregisteredWithdrawn;

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
            relatedPartyCount,
            retention: {
                registeredActive,
                unregisteredActive,
                registeredWithdrawn,
                unregisteredWithdrawn,
                totalHistorical
            }
        };

        // ── New Financial Stats from member_payments ──
        const { data: memberPayments } = await supabase
            .from('member_payments')
            .select('payment_type, amount_due, amount_paid, is_contribution, unit_type_id, deposit_account_id');

        const { data: unitTypesData } = await supabase.from('unit_types').select('id, name').eq('is_active', true);
        const { data: accountsData } = await supabase.from('deposit_accounts').select('id, account_name, account_type').eq('is_active', true);

        if (memberPayments && memberPayments.length > 0) {
            const unitMap = new Map((unitTypesData || []).map(u => [u.id, u.name]));
            const accountMap = new Map((accountsData || []).map(a => [a.id, { name: a.account_name, type: a.account_type }]));

            const typeLabels: Record<string, string> = {
                certificate: '출자금(필증)',
                premium: '프리미엄',
                premium_recognized: '인정분',
                contract: '계약금',
                installment_1: '1차 분담금',
                installment_2: '2차 분담금',
                balance: '잔금',
                other: '기타',
            };

            let certPaid = 0;
            let premRecPaid = 0;

            for (const p of memberPayments) {
                const due = Number(p.amount_due) || 0;
                const paid = Number(p.amount_paid) || 0;

                if (p.is_contribution && p.payment_type !== 'premium') {
                    financialStats.contributionDue += due;
                    financialStats.contributionPaid += paid;
                }

                if (p.payment_type === 'certificate') certPaid += paid;
                if (p.payment_type === 'premium_recognized') premRecPaid += paid;

                // By type
                if (!financialStats.byType[p.payment_type]) {
                    financialStats.byType[p.payment_type] = { label: typeLabels[p.payment_type] || p.payment_type, due: 0, paid: 0, rate: 0 };
                }
                financialStats.byType[p.payment_type].due += due;
                financialStats.byType[p.payment_type].paid += paid;

                // By unit type
                if (p.unit_type_id) {
                    const utName = unitMap.get(p.unit_type_id) || '미정';
                    if (!financialStats.byUnitType[utName]) financialStats.byUnitType[utName] = { due: 0, paid: 0, count: 0 };
                    financialStats.byUnitType[utName].due += due;
                    financialStats.byUnitType[utName].paid += paid;
                }

                // By account
                if (p.deposit_account_id && paid > 0) {
                    const acc = accountMap.get(p.deposit_account_id);
                    const accName = acc?.name || '미지정';
                    if (!financialStats.byAccount[accName]) financialStats.byAccount[accName] = { total: 0, type: acc?.type || 'unknown' };
                    financialStats.byAccount[accName].total += paid;
                }
            }

            financialStats.investmentTotal = certPaid + premRecPaid;
            financialStats.additionalBurden = Math.max(0, financialStats.contributionDue - financialStats.investmentTotal);
            financialStats.contributionRate = financialStats.contributionDue > 0
                ? Math.round((financialStats.contributionPaid / financialStats.contributionDue) * 100) : 0;

            // Calculate rates per type
            for (const key of Object.keys(financialStats.byType)) {
                const t = financialStats.byType[key];
                t.rate = t.due > 0 ? Math.round((t.paid / t.due) * 100) : 0;
            }

            // Count unique entities per unit type
            const entityUnitMap = new Map<string, Set<string>>();
            for (const p of memberPayments) {
                if (p.unit_type_id) {
                    const utName = unitMap.get(p.unit_type_id) || '미정';
                    if (!entityUnitMap.has(utName)) entityUnitMap.set(utName, new Set());
                    // We don't have entity_id in this select, so count based on payment lines
                }
            }

            financialStats.hasData = true;
        }

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

        // Merge them, prioritizing duplicates
        actionList = duplicateConflicts.slice(0, 8); // Show up to 8 action items


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
                                    {financialStats.hasData ? (
                                        <span className="flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-black text-success border border-success/20">
                                            수납률 {financialStats.contributionRate}%
                                        </span>
                                    ) : (
                                        <span className="flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-black text-success border border-success/20">
                                            총 {Math.round(safeStats.totalAmount / 100000000)}억원
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-3 mt-2 flex-1">
                                    {financialStats.hasData ? (
                                        <>
                                            {Object.entries(financialStats.byType)
                                                .filter(([key]) => !['premium'].includes(key))
                                                .sort(([, a], [, b]) => {
                                                    const order = ['certificate', 'premium_recognized', 'contract', 'installment_1', 'installment_2', 'balance', 'other'];
                                                    return order.indexOf(a.label === a.label ? '' : '') || 0;
                                                })
                                                .map(([key, val]) => (
                                                    <PaymentProgressRow
                                                        key={key}
                                                        label={val.label}
                                                        rate={val.rate}
                                                        subtitle={val.due > 0 ? `₩${val.paid.toLocaleString()} / ₩${val.due.toLocaleString()}` : undefined}
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

                            {/* Retention Funnel Overview */}
                            <RetentionWidget retention={safeStats.retention} />
                        </div>

                        {/* Financial Breakdown: Unit Type & Account (only when data exists) */}
                        {financialStats.hasData && (
                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                {/* By Unit Type */}
                                {Object.keys(financialStats.byUnitType).length > 0 && (
                                    <div className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">
                                                <MaterialIcon name="straighten" size="sm" />
                                            </div>
                                            <h3 className="text-sm font-bold text-muted-foreground">평형별 수납 현황</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {Object.entries(financialStats.byUnitType).map(([name, val]) => {
                                                const rate = val.due > 0 ? Math.round((val.paid / val.due) * 100) : 0;
                                                return (
                                                    <div key={name} className="space-y-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-foreground">{name}</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-muted-foreground">₩{val.paid.toLocaleString()} / ₩{val.due.toLocaleString()}</span>
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

                                {/* By Account */}
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
                                                .sort(([, a], [, b]) => b.total - a.total)
                                                .map(([name, val]) => {
                                                    const totalAll = Object.values(financialStats.byAccount).reduce((s, v) => s + v.total, 0);
                                                    const pct = totalAll > 0 ? Math.round((val.total / totalAll) * 100) : 0;
                                                    const typeColor = val.type === 'union' ? 'bg-blue-500' :
                                                        val.type === 'trust' ? 'bg-emerald-500' :
                                                            val.type === 'external' ? 'bg-amber-500' : 'bg-violet-500';
                                                    const typeLabel = val.type === 'union' ? '조합' :
                                                        val.type === 'trust' ? '신탁' :
                                                            val.type === 'external' ? '외부' : '인정';

                                                    return (
                                                        <div key={name} className="flex items-center gap-3 py-1.5">
                                                            <div className={cn("w-2 h-2 rounded-full", typeColor)} />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs font-bold text-foreground truncate">{name}</span>
                                                                    <span className="text-[9px] text-muted-foreground bg-muted px-1 rounded">{typeLabel}</span>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-black text-foreground">₩{val.total.toLocaleString()}</span>
                                                            <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

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
                                                    member.status === '충돌오류' ? (
                                                        <DuplicateConflictRow key={member.id} member={member} />
                                                    ) : (
                                                        <ActionRequiredRow
                                                            key={member.id}
                                                            name={member.name}
                                                            memberId={member.member_number}
                                                            tier={member.tier || '-'}
                                                            status={member.status || '미확인'}
                                                            statusColor={
                                                                member.status === '탈퇴' ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                                                                    member.status === '소송중' ? "bg-orange-500/10 text-orange-500 border-orange-500/20" :
                                                                        "bg-gray-500/10 text-gray-500 border-gray-500/20"
                                                            }
                                                            amount={member.phone || '-'}
                                                            actionLabel="상세 보기"
                                                            isPrimaryAction={true}
                                                            href={member.href}
                                                        />
                                                    )
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

function DuplicateConflictRow({ member }: { member: any }) {
    return (
        <tr className="group hover:bg-muted/10 transition-colors">
            <td colSpan={5} className="p-3">
                <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/5 p-4 shadow-sm animate-pulse-slow">
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-500">
                            <MaterialIcon name="warning" size="md" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1 cursor-default">
                                <span className="font-extrabold text-red-500 text-sm">권리증 충돌 오류</span>
                                <span className="text-[10px] font-bold text-red-500/70 tracking-wider font-mono bg-red-500/10 px-2 py-0.5 rounded-full">{member.member_number}</span>
                                <span className="text-[10px] font-black text-red-500 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded uppercase tracking-wider">{member.tier}</span>
                            </div>
                            <p className="text-xs font-bold text-muted-foreground">
                                해당 권리증 번호를 <strong className="text-foreground">{member.phone}</strong> 님이 중복해서 소유하고 있습니다.
                            </p>
                        </div>
                    </div>
                    {member.href ? (
                        <Link href={member.href} className="shrink-0 inline-block rounded-lg px-4 py-2 text-xs font-black bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm shadow-red-500/20">
                            상세 보기
                        </Link>
                    ) : (
                        <button className="shrink-0 inline-block rounded-lg px-4 py-2 text-xs font-black bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm shadow-red-500/20">
                            상세 보기
                        </button>
                    )}
                </div>
            </td>
        </tr>
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

function PaymentProgressRow({ label, rate, subtitle }: { label: string, rate: number, subtitle?: string }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">{label}</span>
                    {subtitle && <span className="text-[10px] text-muted-foreground/60">{subtitle}</span>}
                </div>
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

function RetentionWidget({ retention }: { retention: any }) {
    const { registeredActive, unregisteredActive, registeredWithdrawn, unregisteredWithdrawn, totalHistorical } = retention;

    // Percentages
    const calcPct = (val: number) => totalHistorical > 0 ? Math.round((val / totalHistorical) * 100) : 0;

    const pRegAct = calcPct(registeredActive);
    const pUnregAct = calcPct(unregisteredActive);
    const pRegWd = calcPct(registeredWithdrawn);
    const pUnregWd = calcPct(unregisteredWithdrawn);

    return (
        <div className="group flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-xl hover:border-border/80 transition-all duration-300">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20">
                        <MaterialIcon name="filter_alt" size="sm" />
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-sm font-bold text-muted-foreground">조합원 유지율 퍼널</h3>
                        <p className="text-[10px] font-bold text-muted-foreground/60 mt-0.5">누적 등록자 {totalHistorical.toLocaleString()}명 기준</p>
                    </div>
                </div>
                <span className="flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-black text-orange-500 border border-orange-500/20">
                    전체 흐름
                </span>
            </div>

            <div className="flex flex-col gap-3 mt-1 flex-1 justify-center">
                {/* Visual Funnel Bar */}
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/50">
                    {pRegAct > 0 && <div style={{ width: `${pRegAct}%` }} className="bg-emerald-500 transition-all duration-500" title={`유지 (등기): ${registeredActive}명`} />}
                    {pUnregAct > 0 && <div style={{ width: `${pUnregAct}%` }} className="bg-emerald-400/60 transition-all duration-500" title={`유지 (미등기): ${unregisteredActive}명`} />}
                    {pRegWd > 0 && <div style={{ width: `${pRegWd}%` }} className="bg-rose-400 transition-all duration-500" title={`이탈 (등기후): ${registeredWithdrawn}명`} />}
                    {pUnregWd > 0 && <div style={{ width: `${pUnregWd}%` }} className="bg-rose-500/50 transition-all duration-500" title={`이탈 (미등기): ${unregisteredWithdrawn}명`} />}
                </div>

                {/* Legend & Stats */}
                <div className="grid grid-cols-2 gap-x-2 gap-y-3 mt-2">
                    <div className="flex flex-col p-2 rounded bg-emerald-500/5 border border-emerald-500/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-[10px] font-bold text-muted-foreground">유지 (등기완료)</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-foreground">{registeredActive.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground">명</span>
                            <span className="text-[10px] font-bold text-emerald-500 ml-auto">{pRegAct}%</span>
                        </div>
                    </div>

                    <div className="flex flex-col p-2 rounded bg-emerald-400/5 border border-emerald-400/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-400/60"></div>
                            <span className="text-[10px] font-bold text-muted-foreground">유지 (미등기/기타)</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-foreground">{unregisteredActive.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground">명</span>
                            <span className="text-[10px] font-bold text-emerald-500/70 ml-auto">{pUnregAct}%</span>
                        </div>
                    </div>

                    <div className="flex flex-col p-2 rounded bg-rose-400/5 border border-rose-400/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                            <span className="text-[10px] font-bold text-muted-foreground">이탈 (등기 후)</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-foreground">{registeredWithdrawn.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground">명</span>
                            <span className="text-[10px] font-bold text-rose-500 ml-auto">{pRegWd}%</span>
                        </div>
                    </div>

                    <div className="flex flex-col p-2 rounded bg-rose-500/5 border border-rose-500/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-rose-500/50"></div>
                            <span className="text-[10px] font-bold text-muted-foreground">이탈 (미등기)</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-foreground">{unregisteredWithdrawn.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground">명</span>
                            <span className="text-[10px] font-bold text-rose-500/70 ml-auto">{pUnregWd}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
