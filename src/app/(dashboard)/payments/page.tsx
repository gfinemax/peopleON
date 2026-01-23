import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; tier?: string; status?: string }>;
}) {
    const supabase = await createClient();
    const params = await searchParams;
    const query = params?.q || '';

    // Fetch members with legacy payment data
    let queryBuilder = supabase
        .from('members')
        .select('id, name, member_number, phone, tier, status, unit_group')
        .order('member_number', { ascending: true })
        .limit(100);

    if (query) {
        queryBuilder = queryBuilder.or(`name.ilike.%${query}%,member_number.ilike.%${query}%`);
    }

    const { data: members } = await queryBuilder;

    // Mock payment stats (replace with real data later)
    const totalCollection = 1240000000;
    const totalUnpaid = 124500000;
    const collectionRate = 85;

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <Header title="분담금 수납 및 미납 관리" />

            <main className="flex-1 overflow-y-auto bg-background">
                <div className="p-6 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
                    {/* Page Header */}
                    <div className="flex flex-wrap justify-between items-end gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground tracking-tight">
                                분담금 수납 및 미납 관리
                            </h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                회원별 분담금 납부 내역 및 미납 현황을 실시간으로 관리하고 정산합니다.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button className="flex items-center gap-2 rounded-lg h-10 px-4 bg-card border border-border text-foreground text-sm font-medium shadow-sm hover:bg-accent transition-colors">
                                <MaterialIcon name="download" size="md" />
                                보고서 다운로드
                            </button>
                            <button className="flex items-center gap-2 rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-md hover:bg-[#0f6bd0] transition-colors">
                                <MaterialIcon name="upload_file" size="md" />
                                엑셀 업로드
                            </button>
                        </div>
                    </div>

                    {/* KPI Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Total Collection */}
                        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card border border-border shadow-sm">
                            <div className="flex justify-between items-start">
                                <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">
                                    총 수납액
                                </p>
                                <MaterialIcon name="trending_up" className="text-success" size="md" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <p className="text-foreground tracking-tight text-2xl font-bold">
                                    ₩{(totalCollection / 100000000).toFixed(1)}억
                                </p>
                                <span className="text-success text-xs font-bold bg-success/10 px-2 py-0.5 rounded border border-success/20">
                                    +5.2%
                                </span>
                            </div>
                            <p className="text-muted-foreground text-xs">전월 대비 증가</p>
                        </div>

                        {/* Total Unpaid */}
                        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card border border-border shadow-sm relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-destructive/5 to-transparent pointer-events-none" />
                            <div className="flex justify-between items-start relative z-10">
                                <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">
                                    총 미납액
                                </p>
                                <MaterialIcon name="warning" className="text-destructive" size="md" />
                            </div>
                            <div className="flex items-baseline gap-2 relative z-10">
                                <p className="text-foreground tracking-tight text-2xl font-bold">
                                    ₩{(totalUnpaid / 100000000).toFixed(1)}억
                                </p>
                                <span className="text-destructive text-xs font-bold bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20">
                                    +1.2%
                                </span>
                            </div>
                            <p className="text-muted-foreground text-xs relative z-10">
                                집중 관리 필요 (32세대)
                            </p>
                        </div>

                        {/* Collection Rate */}
                        <div className="flex flex-col gap-2 rounded-xl p-6 bg-card border border-border shadow-sm">
                            <div className="flex justify-between items-start">
                                <p className="text-muted-foreground text-sm font-medium uppercase tracking-wider">
                                    이번 달 수납률
                                </p>
                                <MaterialIcon name="pie_chart" className="text-muted-foreground" size="md" />
                            </div>
                            <div className="flex items-baseline gap-2">
                                <p className="text-foreground tracking-tight text-2xl font-bold">
                                    {collectionRate}%
                                </p>
                                <span className="text-destructive text-xs font-bold bg-destructive/10 px-2 py-0.5 rounded border border-destructive/20">
                                    -2.0%
                                </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                                <div
                                    className="bg-primary h-1.5 rounded-full"
                                    style={{ width: `${collectionRate}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Monthly Chart Section */}
                    <div className="flex flex-col md:flex-row gap-6 rounded-xl p-6 bg-card border border-border shadow-sm">
                        <div className="flex flex-col gap-4 min-w-[240px]">
                            <div>
                                <h3 className="text-foreground text-lg font-bold">월별 수납 진행률</h3>
                                <p className="text-muted-foreground text-sm mt-1">최근 6개월 수납 추이</p>
                            </div>
                            <div className="mt-auto">
                                <p className="text-3xl font-bold text-foreground">92%</p>
                                <p className="text-sm text-success flex items-center gap-1 mt-1">
                                    <MaterialIcon name="arrow_upward" size="sm" />
                                    목표 대비 초과 달성
                                </p>
                            </div>
                        </div>
                        <div className="flex-1 grid grid-cols-6 gap-2 sm:gap-4 items-end h-[200px] border-b border-border pb-2">
                            {[60, 75, 50, 85, 92, 40].map((height, idx) => (
                                <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                                    <div
                                        className="relative w-full max-w-[40px] bg-primary/20 rounded-t-sm group-hover:bg-primary/30 transition-all"
                                        style={{ height: `${height}%` }}
                                    >
                                        <div
                                            className={`absolute bottom-0 w-full rounded-t-sm ${idx === 5 ? 'bg-primary/50' : 'bg-primary'}`}
                                            style={{ height: '100%' }}
                                        />
                                    </div>
                                    <span className={`text-xs font-medium ${idx === 5 ? 'text-foreground font-bold' : 'text-muted-foreground'}`}>
                                        {['8월', '9월', '10월', '11월', '12월', '1월'][idx]}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Filters and Search */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                            <select className="h-10 pl-3 pr-8 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer min-w-[120px] shadow-sm">
                                <option>전체 차수</option>
                                <option>계약금</option>
                                <option>1차 중도금</option>
                                <option>2차 중도금</option>
                                <option>잔금</option>
                            </select>
                            <select className="h-10 pl-3 pr-8 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer min-w-[120px] shadow-sm">
                                <option>전체 상태</option>
                                <option>수납 완료</option>
                                <option className="text-destructive">미납</option>
                                <option>부분 수납</option>
                            </select>
                        </div>
                        <div className="flex gap-3 w-full md:w-auto">
                            <div className="relative flex-1 md:w-80">
                                <input
                                    name="q"
                                    defaultValue={query}
                                    className="w-full h-10 pl-10 pr-4 rounded-lg bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
                                    placeholder="회원명, 동/호수 검색"
                                    type="text"
                                />
                                <MaterialIcon
                                    name="search"
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                                    size="md"
                                />
                            </div>
                            <button className="h-10 px-4 rounded-lg bg-card border border-border hover:bg-accent text-foreground text-sm font-medium whitespace-nowrap transition-colors shadow-sm">
                                검색
                            </button>
                        </div>
                    </div>

                    {/* Payments Table */}
                    <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left whitespace-nowrap">
                                <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4">동/호수</th>
                                        <th className="px-6 py-4">회원명</th>
                                        <th className="px-6 py-4">차수</th>
                                        <th className="px-6 py-4">납부기한</th>
                                        <th className="px-6 py-4">수납일</th>
                                        <th className="px-6 py-4 text-right">청구액</th>
                                        <th className="px-6 py-4 text-right">수납액</th>
                                        <th className="px-6 py-4 text-right">미납액</th>
                                        <th className="px-6 py-4 text-center">상태</th>
                                        <th className="px-6 py-4 text-center">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-foreground">
                                    <PaymentRow
                                        unit="101동 1204호"
                                        name="홍길동"
                                        step="2차 중도금"
                                        dueDate="2023-10-30"
                                        paidDate="2023-10-28"
                                        amountDue={50000000}
                                        amountPaid={50000000}
                                        status="수납완료"
                                    />
                                    <PaymentRow
                                        unit="102동 305호"
                                        name="김철수"
                                        step="2차 중도금"
                                        dueDate="2023-10-30"
                                        paidDate="-"
                                        amountDue={50000000}
                                        amountPaid={0}
                                        status="미납"
                                        isOverdue
                                    />
                                    <PaymentRow
                                        unit="103동 1501호"
                                        name="이영희"
                                        step="1차 중도금"
                                        dueDate="2023-09-30"
                                        paidDate="2023-10-05"
                                        amountDue={30000000}
                                        amountPaid={10000000}
                                        status="부분납"
                                    />
                                    <PaymentRow
                                        unit="104동 802호"
                                        name="박지성"
                                        step="2차 중도금"
                                        dueDate="2023-10-30"
                                        paidDate="2023-10-25"
                                        amountDue={50000000}
                                        amountPaid={50000000}
                                        status="수납완료"
                                    />
                                    <PaymentRow
                                        unit="105동 201호"
                                        name="손흥민"
                                        step="잔금"
                                        dueDate="2023-11-15"
                                        paidDate="-"
                                        amountDue={120000000}
                                        amountPaid={0}
                                        status="미납"
                                        isOverdue
                                    />
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="border-t border-border px-6 py-4 flex items-center justify-between bg-card">
                            <p className="text-sm text-muted-foreground">
                                총 <span className="font-medium text-foreground">1,248</span>건 중{' '}
                                <span className="font-medium text-foreground">1-10</span> 표시
                            </p>
                            <div className="flex items-center gap-2">
                                <button className="p-2 rounded hover:bg-accent text-muted-foreground">
                                    <MaterialIcon name="chevron_left" size="md" />
                                </button>
                                <button className="size-8 rounded bg-primary text-white text-sm font-medium flex items-center justify-center shadow-sm">
                                    1
                                </button>
                                <button className="size-8 rounded hover:bg-accent text-muted-foreground text-sm font-medium flex items-center justify-center">
                                    2
                                </button>
                                <button className="size-8 rounded hover:bg-accent text-muted-foreground text-sm font-medium flex items-center justify-center">
                                    3
                                </button>
                                <span className="text-muted-foreground">...</span>
                                <button className="size-8 rounded hover:bg-accent text-muted-foreground text-sm font-medium flex items-center justify-center">
                                    12
                                </button>
                                <button className="p-2 rounded hover:bg-accent text-muted-foreground">
                                    <MaterialIcon name="chevron_right" size="md" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function PaymentRow({
    unit,
    name,
    step,
    dueDate,
    paidDate,
    amountDue,
    amountPaid,
    status,
    isOverdue = false,
}: {
    unit: string;
    name: string;
    step: string;
    dueDate: string;
    paidDate: string;
    amountDue: number;
    amountPaid: number;
    status: '수납완료' | '미납' | '부분납';
    isOverdue?: boolean;
}) {
    const unpaid = amountDue - amountPaid;

    const statusStyles = {
        '수납완료': 'bg-success/10 text-success border-success/20',
        '미납': 'bg-destructive/10 text-destructive border-destructive/20',
        '부분납': 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200 dark:border-orange-800/30',
    };

    return (
        <tr className="hover:bg-muted/50 transition-colors">
            <td className="px-6 py-4 font-medium">{unit}</td>
            <td className="px-6 py-4">{name}</td>
            <td className="px-6 py-4">
                <span className="bg-muted px-2 py-1 rounded text-xs text-muted-foreground border border-border">
                    {step}
                </span>
            </td>
            <td className={`px-6 py-4 ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                {dueDate}
            </td>
            <td className="px-6 py-4 text-muted-foreground">{paidDate}</td>
            <td className="px-6 py-4 text-right text-muted-foreground">
                {amountDue.toLocaleString()}
            </td>
            <td className="px-6 py-4 text-right font-medium">
                {amountPaid.toLocaleString()}
            </td>
            <td className={`px-6 py-4 text-right font-bold ${status === '미납' ? 'text-destructive' : status === '부분납' ? 'text-orange-500' : 'text-muted-foreground'}`}>
                {unpaid > 0 ? unpaid.toLocaleString() : '0'}
            </td>
            <td className="px-6 py-4 text-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[status]}`}>
                    {status}
                </span>
            </td>
            <td className="px-6 py-4 text-center">
                {status === '미납' ? (
                    <button className="text-white bg-destructive hover:bg-red-600 rounded px-2 py-1 text-xs font-bold transition-colors shadow-sm">
                        독촉
                    </button>
                ) : (
                    <button className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-accent">
                        <MaterialIcon name="more_horiz" size="md" />
                    </button>
                )}
            </td>
        </tr>
    );
}
