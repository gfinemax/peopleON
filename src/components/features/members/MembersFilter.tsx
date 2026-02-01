'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useState, useEffect } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

export function MembersFilter() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Local state for immediate feedback
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [tier, setTier] = useState(searchParams.get('tier') || 'all');
    const [status, setStatus] = useState(searchParams.get('status') || 'all');
    const [tag, setTag] = useState(searchParams.get('tag') || '');
    const [sort, setSort] = useState(searchParams.get('sort') || 'member_number');
    const [order, setOrder] = useState(searchParams.get('order') || 'asc');

    // Sync with URL changes
    useEffect(() => {
        setQuery(searchParams.get('q') || '');
        setTier(searchParams.get('tier') || 'all');
        setStatus(searchParams.get('status') || 'all');
        setTag(searchParams.get('tag') || '');
        setSort(searchParams.get('sort') || 'member_number');
        setOrder(searchParams.get('order') || 'asc');
    }, [searchParams]);

    // Update URL helper
    const updateSearch = useCallback((key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'all') {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        // Reset page on filter change
        if (key !== 'page') {
            params.set('page', '1');
        }
        router.push(`${pathname}?${params.toString()}`);
    }, [pathname, router, searchParams]);

    const handleSearch = () => {
        updateSearch('q', query);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            updateSearch('tag', tag);
        }
    };

    const clearFilters = () => {
        router.push(pathname);
    };

    const removeFilter = (key: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete(key);
        params.set('page', '1');
        router.push(`${pathname}?${params.toString()}`);
    };

    const activeTier = searchParams.get('tier');
    const activeStatus = searchParams.get('status');
    const activeTag = searchParams.get('tag');

    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="flex flex-col rounded-xl border border-border/40 bg-card/20 backdrop-blur-sm p-2 space-y-2">
            {/* Top Row: Search + Actions */}
            <div className="flex gap-2 items-center">
                <div className="relative flex-1 group">
                    <MaterialIcon
                        name="search"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors font-bold"
                        size="sm"
                    />
                    <input
                        type="text"
                        placeholder="이름, 동호수, 전화번호 검색"
                        className="h-9 w-full rounded-lg border border-border bg-card/60 pl-9 pr-4 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`h-9 px-3 rounded-lg border border-border bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card hover:border-primary/50 transition-all flex items-center justify-center gap-1.5 ${isExpanded ? 'text-primary border-primary/50' : ''}`}
                    title="상세 필터"
                >
                    <MaterialIcon name="tune" size="sm" />
                </button>
                <button
                    onClick={handleSearch}
                    className="h-9 px-4 rounded-lg bg-primary text-white font-black text-xs hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all whitespace-nowrap"
                >
                    검색
                </button>
            </div>

            {/* Collapsible Advanced Filters */}
            {isExpanded && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="col-span-1 lg:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider ml-0.5">차수</label>
                        <Select value={tier} onValueChange={(val) => updateSearch('tier', val)}>
                            <SelectTrigger className="h-9 rounded-lg bg-card/60 border-border w-full text-xs">
                                <SelectValue placeholder="전체" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체</SelectItem>
                                <SelectItem value="1차">1차</SelectItem>
                                <SelectItem value="2차">2차</SelectItem>
                                <SelectItem value="3차">3차</SelectItem>
                                <SelectItem value="지주">지주</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="col-span-1 lg:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider ml-0.5">상태</label>
                        <Select value={status} onValueChange={(val) => updateSearch('status', val)}>
                            <SelectTrigger className="h-9 rounded-lg bg-card/60 border-border w-full text-xs">
                                <SelectValue placeholder="전체" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체</SelectItem>
                                <SelectItem value="정상">정상</SelectItem>
                                <SelectItem value="탈퇴예정">탈퇴예정</SelectItem>
                                <SelectItem value="소송중">소송중</SelectItem>
                                <SelectItem value="자격상실">자격상실</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {/* Sort Filter */}
                    <div className="col-span-1 lg:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider ml-0.5">정렬 기준</label>
                        <Select value={sort} onValueChange={(val) => updateSearch('sort', val)}>
                            <SelectTrigger className="h-9 rounded-lg bg-card/60 border-border w-full text-xs">
                                <SelectValue placeholder="번호순" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="member_number">번호순</SelectItem>
                                <SelectItem value="name">이름순</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="col-span-1 lg:col-span-2 space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider ml-0.5">정렬 순서</label>
                        <div className="flex h-9 rounded-lg bg-card/60 border border-border p-1">
                            <button
                                onClick={() => updateSearch('order', 'asc')}
                                className={`flex-1 flex items-center justify-center rounded text-[10px] font-bold transition-all ${order === 'asc' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-white/5'}`}
                            >
                                오름차순
                            </button>
                            <button
                                onClick={() => updateSearch('order', 'desc')}
                                className={`flex-1 flex items-center justify-center rounded text-[10px] font-bold transition-all ${order === 'desc' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:bg-white/5'}`}
                            >
                                내림차순
                            </button>
                        </div>
                    </div>

                    <div className="col-span-2 md:col-span-2 lg:col-span-4 space-y-1.5">
                        <label className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider ml-0.5">태그</label>
                        <input
                            type="text"
                            placeholder="#태그 입력"
                            className="h-9 w-full rounded-lg border border-border bg-card/60 px-3 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all font-mono"
                            value={tag}
                            onChange={(e) => setTag(e.target.value)}
                            onKeyDown={handleTagKeyDown}
                        />
                    </div>
                </div>
            )}

            <div className="h-px bg-border/20 w-full" />

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-wider">활성 필터:</span>
                    <div className="flex items-center gap-2">
                        {activeTier && (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-black text-primary border border-primary/20">
                                차수: {activeTier}
                                <button onClick={() => removeFilter('tier')} className="hover:text-white transition-colors">
                                    <MaterialIcon name="close" size="xs" />
                                </button>
                            </span>
                        )}
                        {activeStatus && (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-black text-primary border border-primary/20">
                                상태: {activeStatus}
                                <button onClick={() => removeFilter('status')} className="hover:text-white transition-colors">
                                    <MaterialIcon name="close" size="xs" />
                                </button>
                            </span>
                        )}
                        {activeTag && (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-black text-primary border border-primary/20">
                                태그: #{activeTag}
                                <button onClick={() => removeFilter('tag')} className="hover:text-white transition-colors">
                                    <MaterialIcon name="close" size="xs" />
                                </button>
                            </span>
                        )}
                        {!activeTier && !activeStatus && !activeTag && (
                            <span className="text-[10px] text-muted-foreground/30">없음</span>
                        )}
                    </div>
                </div>
                {(activeTier || activeStatus || activeTag || query) && (
                    <button
                        onClick={clearFilters}
                        className="text-[10px] font-bold text-muted-foreground/40 hover:text-white underline underline-offset-4 tracking-wider transition-colors"
                    >
                        필터 초기화
                    </button>
                )}
            </div>
        </div>
    );
}
