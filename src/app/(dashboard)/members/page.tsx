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
    let sortField = 'member_number';
    let sortOrder = 'asc';
    let page = 1;
    let tier: string | undefined;
    let status: string | undefined;
    let tag: string | undefined;

    let members: any[] | null = [];
    let totalCount = 0;

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
        sortField = params?.sort || 'member_number';
        sortOrder = params?.order || 'asc';
        page = Number(params?.page) || 1;
        tier = params?.tier;
        status = params?.status;
        tag = params?.tag;

        const { from, to } = getRange(page, pageSize);

        let queryBuilder = supabase
            .from('members')
            // REMOVED relationships(name, relation) to debug fetch error
            .select('id, name, member_number, phone, tier, status, is_registered, unit_group', { count: 'exact' });

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
        }

        members = data || [];
        totalCount = count || 0;

    } catch (error) {
        console.error("Members Page Critical Error:", error);
        // Keep defaults
        members = [];
        totalCount = 0;
    }

    // Derived values for render logic (using safe defaults if needed)
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

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            <Header title="조합원 관리" />

            {/* 1. Fixed Top Section: Title + Action Bar */}
            <div className="flex flex-col shrink-0 gap-0.5 px-4 lg:px-6 pt-2 lg:pt-4 pb-0 max-w-[1600px] mx-auto w-full">
                {/* Title Area */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-0.5">
                        <h2 className="text-xl font-extrabold tracking-tight text-white">
                            조합원명부 관리
                        </h2>
                        <p className="text-muted-foreground/60 font-medium text-xs tracking-tight opacity-70">
                            조합원의 상세 정보 조회 및 관리, 문자 발송 및 라벨 출력이 가능합니다.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 text-xs font-bold text-white hover:bg-card transition-all shadow-sm h-9">
                            <MaterialIcon name="upload_file" size="sm" />
                            엑셀 일괄 등록
                        </button>
                        <Link
                            href="/members?action=new"
                            className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white shadow-lg shadow-primary/30 hover:bg-primary-hover transition-all h-9"
                        >
                            <MaterialIcon name="add" size="sm" />
                            신규 조합원 등록
                        </Link>
                    </div>
                </div>

                {/* 2. Filter Block (Fixed) - Client Component */}
                <MembersFilter />

                {/* 3. Table Action Bar (Fixed) */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-0.5 pb-0">
                    <div className="flex items-baseline gap-2">
                        <span className="text-lg font-black text-white whitespace-nowrap">전체 {totalCount.toLocaleString()}명</span>
                        <span className="text-xs font-bold text-muted-foreground/60">중 검색 결과 <span className="text-primary">{totalCount || 0}</span>명</span>
                    </div>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/20 px-3 py-2 text-[10px] font-bold text-muted-foreground hover:bg-card/40 hover:text-white transition-all uppercase tracking-wider h-8">
                            <MaterialIcon name="chat" size="sm" />
                            문자 발송
                        </button>
                        <button className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/20 px-3 py-2 text-[10px] font-bold text-muted-foreground hover:bg-card/40 hover:text-white transition-all uppercase tracking-wider h-8">
                            <MaterialIcon name="print" size="sm" />
                            라벨 출력
                        </button>
                        <button className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/20 px-3 py-2 text-[10px] font-bold text-muted-foreground hover:bg-card/40 hover:text-white transition-all uppercase tracking-wider h-8">
                            <MaterialIcon name="download" size="sm" />
                            엑셀 다운로드
                        </button>
                    </div>
                </div>
            </div>

            {/* 4. Unified List Box (Table + Pagination) */}
            <div className="flex-1 flex flex-col min-h-0 rounded-xl border border-white/[0.08] bg-card overflow-hidden shadow-sm mx-4 lg:mx-6 mb-4">
                {/* Scrollable Table Area - Logic moved to MembersTable for sticky support */}
                <div className="flex-1 min-h-0 overflow-hidden">
                    {members && members.length > 0 ? (
                        <MembersTable
                            members={members}
                            tableKey={JSON.stringify(params)}
                            startIndex={from}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 py-12">
                            <MaterialIcon name="search_off" size="xl" className="opacity-20" />
                            <p className="font-bold">검색 결과가 없습니다.</p>
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
    );
}
