import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import Link from 'next/link';
import { LegacyTable } from '@/components/features/finance/LegacyTable';
import { LegacyFilter } from '@/components/features/finance/LegacyFilter';
import { MobileFinanceView } from '@/components/features/finance/MobileFinanceView';

export const dynamic = 'force-dynamic';

export default async function FinancePage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; status?: string; sort?: string; order?: string; page?: string }>;
}) {
    const supabase = await createClient();

    // In Next.js 16, searchParams is a Promise
    const params = await searchParams;
    const query = params?.q || '';
    const status = params?.status || 'all';
    const sortField = params?.sort || 'rights_count';
    const sortOrder = params?.order || 'desc';
    const page = Number(params?.page) || 1;
    const pageSize = 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // 1. Stats Calculation (Global)
    const { count: totalLegacyCount } = await supabase.from('legacy_records').select('*', { count: 'exact', head: true });
    const { count: refundedCount } = await supabase.from('legacy_records').select('*', { count: 'exact', head: true }).eq('is_refunded', true);

    // 2. Prepare Filter Query
    let queryBuilder = supabase
        .from('legacy_records')
        .select('*', { count: 'exact' });

    let sumQueryBuilder = supabase
        .from('legacy_records')
        .select('rights_count');

    if (query) {
        queryBuilder = queryBuilder.ilike('original_name', `%${query}%`);
        sumQueryBuilder = sumQueryBuilder.ilike('original_name', `%${query}%`);
    }

    if (status === 'matched') {
        queryBuilder = queryBuilder.not('member_id', 'is', null);
        sumQueryBuilder = sumQueryBuilder.not('member_id', 'is', null);
    } else if (status === 'unmatched') {
        queryBuilder = queryBuilder.is('member_id', null);
        sumQueryBuilder = sumQueryBuilder.is('member_id', null);
    }

    // 3. Execute Queries
    // Main List
    const { data: legacyRecords, count, error } = await queryBuilder
        .order(sortField, { ascending: sortOrder === 'asc' })
        .range(from, to);

    // Sum Calculation (Fetch all matching rights_count)
    const { data: sumData } = await sumQueryBuilder;
    const filteredRightsSum = sumData?.reduce((acc, curr) => acc + (curr.rights_count || 0), 0) || 0;

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startRange = Math.min((page - 1) * pageSize + 1, totalCount);
    const endRange = Math.min(page * pageSize, totalCount);

    // Pagination helper
    const getPageLink = (p: number) => {
        const search = new URLSearchParams();
        if (query) search.set('q', query);
        if (status && status !== 'all') search.set('status', status);
        if (sortField) search.set('sort', sortField);
        if (sortOrder) search.set('order', sortOrder);
        search.set('page', p.toString());
        return `/finance?${search.toString()}`;
    };

    const renderPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        if (totalPages === 0) return null;

        for (let i = startPage; i <= endPage; i++) {
            pages.push(
                <Link
                    key={i}
                    href={getPageLink(i)}
                    className={`size-8 flex items-center justify-center rounded border transition-all text-sm font-bold ${i === page
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                        : 'border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20'
                        }`}
                >
                    {i}
                </Link>
            );
        }
        return pages;
    };

    // 4. Fetch Payments for Mobile Finance View
    const { data: financePayments } = await supabase.from('payments').select('step, amount_due, amount_paid, is_paid');

    // Calculate Summary
    const fTotal = financePayments?.reduce((sum, p) => sum + (p.amount_due || 0), 0) || 0;
    const fPaid = financePayments?.reduce((sum, p) => sum + (p.amount_paid || 0), 0) || 0;
    const fOverdue = fTotal - fPaid; // Simplified as unpaid
    const fProgress = fTotal > 0 ? Math.round((fPaid / fTotal) * 100) : 0;

    // Calculate Rounds
    const roundMap: Record<number, { round: number; amount: number; collected: number; count: number }> = {};
    financePayments?.forEach(p => {
        if (!roundMap[p.step]) {
            roundMap[p.step] = { round: p.step, amount: 0, collected: 0, count: 0 };
        }
        roundMap[p.step].amount += p.amount_due || 0;
        roundMap[p.step].collected += p.amount_paid || 0;
        roundMap[p.step].count += 1;
    });

    const financeRounds = Object.values(roundMap).map(r => ({
        round: r.round,
        amount: r.amount,
        collected: r.collected,
        count: r.count,
        status: (r.collected >= r.amount && r.amount > 0) ? 'completed' : 'pending' as 'completed' | 'pending' | 'overdue',
        dueDate: `2024.12.${30 - r.round}` // Mock Due Date
    })).sort((a, b) => a.round - b.round);

    return (
        <>
            <div className="lg:hidden">
                <MobileFinanceView
                    summary={{
                        totalAmount: fTotal,
                        paidAmount: fPaid,
                        overdueAmount: fOverdue,
                        progress: fProgress,
                        remainingAmount: fOverdue
                    }}
                    rounds={financeRounds}
                />
            </div>
            <div className="hidden lg:flex flex-1 flex-col h-full bg-background overflow-hidden">
                <Header title="자금 및 권리 관리" />

                {/* 1. Fixed Top Section: Title + Stats + Filter */}
                <div className="flex flex-col shrink-0 gap-4 px-4 lg:px-6 pt-2 lg:pt-4 pb-0 max-w-[1600px] mx-auto w-full">
                    {/* Title Area & Stats */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start justify-between">
                            <div className="space-y-0.5">
                                <h2 className="text-xl font-extrabold tracking-tight text-white">
                                    과거 권리증/환불 데이터 목록
                                </h2>
                                <p className="text-muted-foreground/60 font-medium text-xs tracking-tight opacity-70">
                                    마이그레이션된 과거 데이터와 환불 대상자 정보를 조회하고 관리합니다.
                                </p>
                            </div>
                            <div className="flex gap-4">
                                {/* Mini Stats */}
                                <div className="flex items-center gap-4 bg-card/20 border border-border/40 rounded-lg px-4 py-2">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase">총 기록</span>
                                        <span className="text-lg font-black text-white">{totalLegacyCount?.toLocaleString()}</span>
                                    </div>
                                    <div className="w-px h-8 bg-border/20" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase">검색된 권리증 합계</span>
                                        <span className="text-lg font-black text-blue-400">{filteredRightsSum.toLocaleString()}개</span>
                                    </div>
                                    <div className="w-px h-8 bg-border/20" />
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground font-bold uppercase">환불 대상</span>
                                        <span className="text-lg font-black text-destructive">{refundedCount?.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Filter Block */}
                    <LegacyFilter />

                    {/* 3. Table Action Bar */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-0.5 pb-0">
                        <div className="flex items-baseline gap-2">
                            <span className="text-lg font-black text-white whitespace-nowrap">전체 {totalCount.toLocaleString()}건</span>
                            <span className="text-xs font-bold text-muted-foreground/60">중 검색 결과 <span className="text-primary">{count || 0}</span>건</span>
                        </div>
                        <div className="flex gap-2">
                            <button className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/20 px-3 py-2 text-[10px] font-bold text-muted-foreground hover:bg-card/40 hover:text-white transition-all uppercase tracking-wider h-8">
                                <MaterialIcon name="download" size="sm" />
                                엑셀 다운로드
                            </button>
                        </div>
                    </div>
                </div>

                {/* 4. Unified List Box (Table + Pagination) */}
                <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-white/[0.08] bg-card overflow-hidden shadow-sm mx-4 lg:mx-6 mb-4 mt-2">
                    {/* Scrollable Table Area */}
                    <div className="flex-1 overflow-auto min-h-0 scrollbar-thin scrollbar-thumb-border/30">
                        {legacyRecords && legacyRecords.length > 0 ? (
                            <LegacyTable
                                records={legacyRecords}
                                tableKey={JSON.stringify(params)}
                            />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 py-12">
                                <MaterialIcon name="search_off" size="xl" className="opacity-20" />
                                <p className="font-bold">데이터가 없습니다.</p>
                            </div>
                        )}
                    </div>

                    {/* Fixed Pagination Footer */}
                    <div className="shrink-0 z-20 bg-[#161B22] border-t border-white/[0.08]">
                        <div className="px-6 py-3 flex items-center justify-between">
                            <p className="text-xs text-gray-400">
                                총 <span className="font-bold text-white">{totalCount.toLocaleString()}개</span> 결과 중 <span className="text-white">{startRange}-{endRange}</span> 표시
                            </p>
                            <div className="flex items-center gap-1">
                                <Link
                                    href={getPageLink(Math.max(1, page - 1))}
                                    className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20 transition-all ${page <= 1 ? 'pointer-events-none opacity-50' : ''}`}
                                >
                                    <MaterialIcon name="chevron_left" size="sm" />
                                </Link>

                                {renderPageNumbers()}

                                <Link
                                    href={getPageLink(Math.min(totalPages, page + 1))}
                                    className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20 transition-all ${page >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
                                >
                                    <MaterialIcon name="chevron_right" size="sm" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
