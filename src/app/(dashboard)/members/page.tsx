import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import Link from 'next/link';
import { MembersTable } from '@/components/features/members/MembersTable';
import { MembersFilter } from '@/components/features/members/MembersFilter';

export const dynamic = 'force-dynamic';

export default async function MembersPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; sort?: string; order?: string; page?: string; tier?: string; status?: string; tag?: string }>;
}) {
    // Safe defaults
    let params: any = {};
    let query = '';
    let sortField = 'name';
    let sortOrder = 'asc';
    let page = 1;
    let tier: string | undefined;
    let status: string | undefined;
    let tag: string | undefined;

    let members: any[] | null = [];
    let totalCount = 0;
    let absoluteTotalCount = 0;

    // Debug variable kept just in case of future issues, but UI will focus on data
    let fetchError: any = null;

    const pageSize = 30;

    // Helper to calculate derived values safely
    const getRange = (p: number, size: number) => {
        const f = (p - 1) * size;
        const t = f + size - 1;
        return { from: f, to: t };
    };

    try {
        const supabase = await createClient();

        // In Next.js 16, searchParams is a Promise
        params = await searchParams || {};
        query = params?.q || '';
        sortField = params?.sort || 'name';
        sortOrder = params?.order || 'asc';
        page = Number(params?.page) || 1;
        tier = params?.tier;
        status = params?.status;
        tag = params?.tag;

        const { from, to } = getRange(page, pageSize);

        // Fetch absolute total count ignoring filters
        const { count: absoluteCount } = await supabase
            .from('members')
            .select('*', { count: 'exact', head: true });

        absoluteTotalCount = absoluteCount || 0;

        let queryBuilder = supabase
            .from('members')
            .select('id, name, member_number, phone, tier, status, is_registered, unit_group, relationships(name, relation, phone)', { count: 'exact' });

        if (query) {
            queryBuilder = queryBuilder.or(`name.ilike.%${query}%,member_number.ilike.%${query}%,phone.ilike.%${query}%`);
        }

        if (tier) {
            queryBuilder = queryBuilder.eq('tier', tier);
        }

        if (status) {
            queryBuilder = queryBuilder.eq('status', status);
        }

        if (tag) {
            queryBuilder = queryBuilder.contains('tags', [tag]);
        }

        const { data, count, error } = await queryBuilder
            .order(sortField, { ascending: sortOrder === 'asc' })
            .range(from, to);

        if (error) {
            console.error("Members Fetch Error:", error);
            fetchError = error;
        }

        members = data || [];
        totalCount = count || 0;

    } catch (error) {
        console.error("Members Page Critical Error:", error);
        fetchError = error;
        // Keep defaults
        members = [];
        totalCount = 0;
    }

    // Derived values for render logic
    const { from, to } = getRange(page, pageSize);
    const totalPages = Math.ceil(totalCount / pageSize);
    const startRange = totalCount > 0 ? Math.min((page - 1) * pageSize + 1, totalCount) : 0;
    const endRange = Math.min(page * pageSize, totalCount);

    // Pagination helpers
    const getPageLink = (p: number) => {
        const search = new URLSearchParams();
        if (query) search.set('q', query);
        if (sortField) search.set('sort', sortField);
        if (sortOrder) search.set('order', sortOrder);
        if (tier) search.set('tier', tier);
        if (status) search.set('status', status);
        if (tag) search.set('tag', tag);
        search.set('page', p.toString());
        return `/members?${search.toString()}`;
    };

    const renderPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        // Logic to construct pagination
        // ... (reuse existing logic logic)
        // Re-implementing simplified logic here for robustness within the overwrite

        if (totalPages === 0) return null;

        let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);

        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

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

    // Calculate derived total count (use local count if not fetched separately successfully, but logic above handles it)
    const displayTotalCount = (typeof absoluteTotalCount !== 'undefined') ? absoluteTotalCount : totalCount;

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            <Header
                title="조합원 관리"
                iconName="person"
                leftContent={
                    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className="text-lg font-bold text-foreground">조합원 {displayTotalCount}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">· 검색 <span className="text-primary">{totalCount}</span></span>
                    </div>
                }
            />

            <div className="flex flex-col shrink-0 gap-0.5 px-4 lg:px-6 pt-2 lg:pt-4 pb-0 max-w-[1600px] mx-auto w-full">

                <MembersFilter />

            </div>

            {/* Desktop: Boxed, Mobile: Transparent & Fluid */}
            <div className="flex-1 flex flex-col min-h-0 lg:rounded-xl lg:border lg:border-white/[0.08] lg:bg-card overflow-hidden lg:shadow-sm lg:mx-6 mb-4 lg:mb-6">
                <div className="flex-1 min-h-0 overflow-hidden">
                    {members && members.length > 0 ? (
                        <MembersTable
                            members={members}
                            tableKey={JSON.stringify(params)}
                            startIndex={from}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 py-12">
                            {/* Show Error if exists, otherwise empty state */}
                            {fetchError ? (
                                <div className="text-center p-4 bg-red-500/10 border border-red-500/20 rounded-lg max-w-lg text-left">
                                    <p className="text-red-500 font-bold mb-2">데이터 로딩 오류</p>
                                    <div className="text-xs text-red-300 font-mono whitespace-pre-wrap break-all bg-black/50 p-4 rounded">
                                        <div className="mb-2 text-white font-bold">Error Message:</div>
                                        {fetchError instanceof Error ? fetchError.message : (fetchError?.message || 'Unknown Error')}
                                    </div>
                                    <p className="mt-4 text-xs text-muted-foreground">Vercel 환경변수 설정을 확인해주세요.</p>
                                </div>
                            ) : (
                                <>
                                    <MaterialIcon name="search_off" size="xl" className="opacity-20" />
                                    <p className="font-bold">검색 결과가 없습니다.</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer: Sticky on Mobile? Or just normal block. Adjusting for transparency */}
                <div className="shrink-0 z-20 lg:bg-[#161B22] lg:border-t lg:border-white/[0.08] bg-transparent">
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
        </div >
    );
}
