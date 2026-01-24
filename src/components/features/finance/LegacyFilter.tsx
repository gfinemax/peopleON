'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';
import { MaterialIcon } from '@/components/ui/icon';

export function LegacyFilter() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Local state
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [status, setStatus] = useState(searchParams.get('status') || 'all');

    // Sync with URL
    useEffect(() => {
        setQuery(searchParams.get('q') || '');
        setStatus(searchParams.get('status') || 'all');
    }, [searchParams]);

    // Update URL helper
    const updateSearch = useCallback((key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'all') {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        if (key !== 'page') {
            params.set('page', '1');
        }
        router.push(`${pathname}?${params.toString()}`);
    }, [pathname, router, searchParams]);

    const handleSearch = () => {
        updateSearch('q', query);
    };

    const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newStatus = e.target.value;
        setStatus(newStatus);
        updateSearch('status', newStatus);
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
                <div className="md:col-span-9 lg:col-span-9 space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider ml-0.5">과거 기록 검색</label>
                    <div className="relative group">
                        <MaterialIcon
                            name="search"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors font-bold"
                            size="sm"
                        />
                        <input
                            type="text"
                            placeholder="이름 (Original Name) 검색"
                            className="h-9 w-full rounded-lg border border-border bg-card/60 pl-9 pr-4 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                </div>
                <div className="md:col-span-2 lg:col-span-2 space-y-1.5">
                    <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider ml-0.5">상태 필터</label>
                    <select
                        className="h-9 w-full rounded-lg border border-border bg-card/60 px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all appearance-none"
                        value={status}
                        onChange={handleStatusChange}
                    >
                        <option value="all">전체 상태</option>
                        <option value="matched">조합원 매칭됨</option>
                        <option value="unmatched">과거/환불 상태</option>
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
                        {status !== 'all' && <span>상태: <span className="text-primary">{status === 'matched' ? '매칭됨' : '과거/환불'}</span></span>}
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
