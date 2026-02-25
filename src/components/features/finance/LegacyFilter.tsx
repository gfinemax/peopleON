'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useRef } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import {
    LEGACY_MEMBER_SEGMENT_OPTIONS,
    type LegacyMemberSegment,
} from '@/lib/legacy/memberSegments';

export function LegacyFilter() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const queryInputRef = useRef<HTMLInputElement | null>(null);

    const query = searchParams.get('q') || '';
    const status = searchParams.get('status') || 'all';
    const rawSort = searchParams.get('sort') || 'certificate_count';
    const sort = rawSort === 'rights_count' ? 'certificate_count' : rawSort;
    const order = searchParams.get('order') || 'desc';

    // Update URL helper
    const updateParams = useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());

        for (const [key, value] of Object.entries(updates)) {
            if (!value || value === 'all') {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        }

        params.set('page', '1');
        router.push(`${pathname}?${params.toString()}`);
    }, [pathname, router, searchParams]);

    const handleSearch = () => {
        const nextQuery = queryInputRef.current?.value?.trim() || '';
        updateParams({ q: nextQuery || null });
    };

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value;
        updateParams({ status: newStatus });
    };

    const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const [nextSort, nextOrder] = e.target.value.split(':');
        updateParams({
            sort: nextSort,
            order: nextOrder || 'desc',
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const clearFilters = () => {
        router.push(pathname);
    };

    return (
        <div className="flex flex-col rounded-xl border border-border/40 bg-card/20 backdrop-blur-sm p-2 space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-6 lg:col-span-6 space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider ml-0.5">과거 기록 검색</label>
                    <div className="relative group">
                        <MaterialIcon
                            name="search"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors font-bold"
                            size="sm"
                        />
                        <input
                            key={query}
                            type="text"
                            placeholder="이름 / 권리증번호 검색"
                            className="h-9 w-full rounded-lg border border-border bg-card/60 pl-9 pr-4 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            defaultValue={query}
                            ref={queryInputRef}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>
                <div className="md:col-span-3 lg:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider ml-0.5">조합원 상태</label>
                    <select
                        className="h-9 w-full rounded-lg border border-border bg-card/60 px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all appearance-none"
                        value={status}
                        onChange={handleStatusChange}
                    >
                        <option value="all">전체 상태</option>
                        {LEGACY_MEMBER_SEGMENT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="md:col-span-2 lg:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider ml-0.5">정렬</label>
                    <select
                        className="h-9 w-full rounded-lg border border-border bg-card/60 px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all appearance-none"
                        value={`${sort}:${order}`}
                        onChange={handleSortChange}
                    >
                        <option value="certificate_count:desc">권리증 많은순</option>
                        <option value="certificate_count:asc">권리증 적은순</option>
                        <option value="original_name:asc">이름 오름차순</option>
                        <option value="original_name:desc">이름 내림차순</option>
                    </select>
                </div>
                <div className="md:col-span-1 lg:col-span-1">
                    <button
                        onClick={handleSearch}
                        className="h-9 w-full rounded-lg bg-primary text-white font-black text-xs hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                    >
                        검색
                    </button>
                </div>
            </div>

            {(query || status !== 'all') && (
                <div className="flex items-center justify-between pt-1 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider flex gap-2">
                        {query && <span>검색어: <span className="text-primary">{query}</span></span>}
                        {status !== 'all' && (
                            <span>
                                상태: <span className="text-primary">
                                    {LEGACY_MEMBER_SEGMENT_OPTIONS.find((option) => option.value === status as LegacyMemberSegment)?.label || status}
                                </span>
                            </span>
                        )}
                    </span>
                    <button
                        onClick={clearFilters}
                        className="text-[10px] font-bold text-muted-foreground/40 hover:text-white underline underline-offset-4 tracking-wider transition-colors"
                    >
                        필터 초기화
                    </button>
                </div>
            )}
        </div>
    );
}
