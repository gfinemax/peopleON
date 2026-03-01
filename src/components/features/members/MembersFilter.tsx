'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface MembersFilterProps {
    roleCounts: Record<string, number>;
    tierCounts: Record<string, number>;
    relCounts: Record<string, number>;
    statusCounts: Record<string, number>;
    relationNames: string[];
    absoluteTotalCount: number;
    filteredCount: number;
    // Dashboard collapse props
    isDashboardCollapsed?: boolean;
    onToggleDashboard?: () => void;
}

type RoleTab = {
    id: string;
    label: string;
    count: number;
    icon: string;
};

const MAIN_ROLES = [
    { id: 'all', label: '전체', icon: 'folder_open' },
    { id: 'member', label: '조합원', icon: 'groups' },
    { id: 'landowner', label: '원지주', icon: 'landscape' },
    { id: 'investor', label: '투자/기타', icon: 'monetization_on' },
    { id: 'party', label: '관계자', icon: 'people_outline' },
];

const roleMemoMap: Record<string, string> = {
    all: '전체 인원 흐름을 한 번에 확인하고 이슈를 비교할 수 있습니다.',
    member: '조합 가입이 연계된 인원 및 일반분양 체결을 중점 관리합니다.',
    landowner: '아직 조합원이 아닌 원지주 특성을 고려해 개별 응대와 상태 이력 추적을 강화합니다.',
    investor: '권리증환불 대상자 등 제3의 투자/채권 성격의 권리자를 관리합니다.',
    party: '대리인이나 관계인 등 특정 조합원/권리에 연동된 인물 정보를 확인합니다.',
};

const tierGroupsByRole: Record<string, string[]> = {
    member: ['등기조합원', '1차', '지주조합원', '예비조합원', '일반분양'],
    landowner: ['지주'],
    investor: ['권리증보유자', '권리증번호있음', '권리증번호없음', '권리증환불'],
    party: ['대리인', '관계인'],
};

const normalizeTierQuery = (raw: string | null) => {
    if (!raw || raw === 'all') return 'all';
    if (raw === '1차') return '등기조합원';
    if (raw === '일반') return '일반분양';
    if (raw === '예비') return '예비조합원';
    if (raw === '3차') return '일반분양';
    if (raw === '4차') return 'all';
    if (raw === '권리증 환불') return '권리증환불';
    if (raw === '비조합원 권리증') return '권리증환불';
    return raw;
};

export function MembersFilter({
    roleCounts,
    tierCounts,
    relCounts,
    statusCounts,
    relationNames,
    absoluteTotalCount,
    filteredCount,
    isDashboardCollapsed,
    onToggleDashboard,
}: MembersFilterProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const rawActiveRole = searchParams.get('role') || 'all';
    const activeRole = roleCounts[rawActiveRole] !== undefined ? rawActiveRole : 'all';

    const rawActiveTier = normalizeTierQuery(searchParams.get('tier'));
    const activeTier = rawActiveTier === 'all' || typeof tierCounts[rawActiveTier] === 'number'
        ? rawActiveTier
        : 'all';

    const activeStatus = searchParams.get('status');
    const activeTag = searchParams.get('tag');
    const activeRel = searchParams.get('rel') || 'all';
    const activeSort = searchParams.get('sort') || 'name';
    const activeOrder = searchParams.get('order') || 'asc';

    // Local state for Option C Layout
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [tagInput, setTagInput] = useState(searchParams.get('tag') || '');

    const roleTabs = useMemo<RoleTab[]>(() => {
        return MAIN_ROLES.map((role) => ({
            ...role,
            count: roleCounts[role.id] ?? 0,
        }));
    }, [roleCounts]);

    const activeTab = roleTabs.find((tab) => tab.id === activeRole) || roleTabs[0];
    const activeMemo = roleMemoMap[activeTab.id] || '';

    // Update URL helper
    const updateSearch = useCallback((key: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value && value !== 'all') {
            params.set(key, value);
        } else {
            params.delete(key);
        }

        if (key === 'role') {
            params.delete('tier');
            params.delete('rel');
        }

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
            updateSearch('tag', tagInput);
        }
    };

    const clearFilters = () => {
        setQuery('');
        setTagInput('');
        router.push(pathname);
    };

    const removeFilter = (key: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete(key);
        params.set('page', '1');
        if (key === 'tag') {
            setTagInput('');
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    // Calculate total active filters for the badge
    const activeFilterCount = (activeTier !== 'all' ? 1 : 0) + (activeStatus ? 1 : 0) + (activeRel !== 'all' ? 1 : 0) + (activeTag ? 1 : 0);



    return (
        <div className="flex flex-col gap-0 border-b border-white/5 mb-4 relative">
            {/* --- Option C: Slim Top Header --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">

                {/* Left: Slim Role Tabs */}
                <div className="flex items-end gap-0.5 overflow-x-auto scrollbar-hide py-1">
                    {roleTabs.map((tab) => {
                        const isActive = tab.id === activeRole;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => updateSearch('role', tab.id)}
                                className={cn(
                                    "relative px-2.5 py-1.5 font-bold text-[13px] transition-colors whitespace-nowrap rounded-t-lg",
                                    isActive
                                        ? "text-blue-400 bg-blue-500/10 border-b-2 border-blue-400"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-b-2 border-transparent"
                                )}
                            >
                                <span className="flex items-center gap-1">
                                    <MaterialIcon name={tab.icon} size="xs" />
                                    {tab.label}
                                    <span className={cn("ml-0.5 px-1 py-0.5 rounded-full text-[9px] leading-none bg-black/30", isActive ? "text-blue-300" : "text-slate-500")}>
                                        {tab.count.toLocaleString()}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Right: Search Bar & Filter Toggle */}
                <div className="flex items-center gap-2">
                    <div className="relative group w-full md:w-56">
                        <MaterialIcon
                            name="search"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-300 transition-colors"
                            size="sm"
                        />
                        <input
                            type="text"
                            placeholder="이름, 동호수, 전화번호"
                            className="h-9 w-full rounded-md border border-[#324764] bg-[#0d182b] pl-9 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none transition-all"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    <button
                        onClick={handleSearch}
                        className="h-9 px-3 rounded-md bg-sky-600 text-white font-bold text-sm hover:bg-sky-500 transition-all flex-shrink-0"
                    >
                        조회
                    </button>

                    <button
                        type="button"
                        onClick={onToggleDashboard}
                        className={cn(
                            "h-9 px-3 rounded-md border transition-all flex items-center gap-1.5 text-xs font-bold flex-shrink-0",
                            isDashboardCollapsed
                                ? "border-purple-500/40 bg-purple-500/10 text-purple-300"
                                : "border-white/10 bg-white/5 text-slate-300 hover:text-white"
                        )}
                    >
                        <MaterialIcon name="monitoring" size="sm" />
                        <span className="hidden md:inline">{isDashboardCollapsed ? '대시보드 보기' : '대시보드 닫기'}</span>
                    </button>
                </div>
            </div>

            {/* --- Inline Dropdown Filters --- */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {/* 1. Tier Dropdown */}
                {tierGroupsByRole[activeRole] && tierGroupsByRole[activeRole].length > 0 && (
                    <Select value={activeTier} onValueChange={(val) => updateSearch('tier', val)}>
                        <SelectTrigger className="h-9 min-w-[120px] rounded-md bg-[#0d182b] border-white/10 text-xs text-slate-100 hover:border-blue-500/30 transition-colors">
                            <span className="flex items-center gap-1.5">
                                <span className="text-slate-500 font-bold mr-1">분류:</span>
                                <SelectValue placeholder="분류 전체" />
                            </span>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">분류 전체 ({activeTab.count.toLocaleString()})</SelectItem>
                            {tierGroupsByRole[activeRole].map((tierName) => (
                                <SelectItem key={tierName} value={tierName}>
                                    {tierName} ({tierCounts[tierName] || 0})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* 2. Status Dropdown */}
                <Select value={activeStatus || 'all'} onValueChange={(val) => updateSearch('status', val)}>
                    <SelectTrigger className="h-9 min-w-[120px] rounded-md bg-[#0d182b] border-white/10 text-xs text-slate-100 hover:border-blue-500/30 transition-colors">
                        <span className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-bold mr-1">상태:</span>
                            <SelectValue placeholder="상태 전체" />
                        </span>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">상태 전체</SelectItem>
                        {Object.entries(statusCounts)
                            .filter(([status]) => status !== '기타' && status !== 'null')
                            .sort(([a], [b]) => {
                                const order = ['정상', '제명', '탈퇴', '정산대기', '지급완료', '연결필요', '케이스누락'];
                                return order.indexOf(a) - order.indexOf(b);
                            })
                            .map(([status, count]) => (
                                <SelectItem key={status} value={status}>
                                    {status} ({count})
                                </SelectItem>
                            ))}
                    </SelectContent>
                </Select>

                {/* 3. Relation Dropdown */}
                <Select value={activeRel} onValueChange={(val) => updateSearch('rel', val)}>
                    <SelectTrigger className="h-9 min-w-[120px] rounded-md bg-[#0d182b] border-white/10 text-xs text-slate-100 hover:border-blue-500/30 transition-colors">
                        <span className="flex items-center gap-1.5">
                            <span className="text-slate-500 font-bold mr-1">관계:</span>
                            <SelectValue placeholder="관계 전체" />
                        </span>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">관계 전체</SelectItem>
                        {relationNames.map((name) => (
                            <SelectItem key={name} value={name}>
                                {name} ({relCounts[name] || 0})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* 4. Sorting Dropdown */}
                <div className="flex items-center gap-px bg-white/5 p-0.5 rounded-md border border-white/10 ml-auto">
                    <Select value={activeSort} onValueChange={(val) => updateSearch('sort', val)}>
                        <SelectTrigger className="h-8 min-w-[90px] bg-transparent border-none text-xs text-slate-100 focus:ring-0">
                            <SelectValue placeholder="정렬" />
                        </SelectTrigger>
                        <SelectContent px-2>
                            <SelectItem value="member_number">번호순</SelectItem>
                            <SelectItem value="name">이름순</SelectItem>
                            <SelectItem value="tier">차수순</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button
                        onClick={() => updateSearch('order', activeOrder === 'asc' ? 'desc' : 'asc')}
                        className="h-8 px-2 rounded hover:bg-white/5 text-slate-400 transition-colors flex items-center gap-1"
                        title={activeOrder === 'asc' ? '오름차순' : '내림차순'}
                    >
                        <MaterialIcon name={activeOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'} size="xs" />
                        <span className="text-[10px] font-bold">{activeOrder === 'asc' ? 'ASC' : 'DESC'}</span>
                    </button>
                </div>
            </div>



            <div className="h-px bg-white/10 w-full" />

            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">활성 필터:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                        {activeRole !== 'all' && (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2 py-1 text-[10px] font-black text-blue-200 border border-blue-500/20">
                                역할군: {activeTab.label}
                                <button onClick={() => updateSearch('role', 'all')} className="hover:text-white transition-colors">
                                    <MaterialIcon name="close" size="xs" />
                                </button>
                            </span>
                        )}
                        {activeRel !== 'all' && (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-2 py-1 text-[10px] font-black text-indigo-200 border border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
                                관계: {activeRel}
                                <button onClick={() => updateSearch('rel', 'all')} className="hover:text-white transition-colors">
                                    <MaterialIcon name="close" size="xs" />
                                </button>
                            </span>
                        )}
                        {activeTier !== 'all' && (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-300/10 px-2 py-1 text-[10px] font-black text-sky-200 border border-sky-300/20">
                                분류: {activeTier}
                                <button onClick={() => updateSearch('tier', 'all')} className="hover:text-white transition-colors">
                                    <MaterialIcon name="close" size="xs" />
                                </button>
                            </span>
                        )}
                        {activeStatus && activeStatus !== 'all' && (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-300/10 px-2 py-1 text-[10px] font-black text-sky-200 border border-sky-300/20">
                                상태: {activeStatus}
                                <button onClick={() => removeFilter('status')} className="hover:text-white transition-colors">
                                    <MaterialIcon name="close" size="xs" />
                                </button>
                            </span>
                        )}
                        {activeTag && (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-300/10 px-2 py-1 text-[10px] font-black text-sky-200 border border-sky-300/20">
                                태그: #{activeTag}
                                <button onClick={() => removeFilter('tag')} className="hover:text-white transition-colors">
                                    <MaterialIcon name="close" size="xs" />
                                </button>
                            </span>
                        )}
                        {!activeStatus && !activeTag && activeRole === 'all' && activeTier === 'all' && activeRel === 'all' && (
                            <span className="text-[10px] text-slate-500">없음</span>
                        )}
                    </div>
                </div>
                {(activeRole !== 'all' || activeTier !== 'all' || activeRel !== 'all' || (activeStatus && activeStatus !== 'all') || activeTag || query) && (
                    <button
                        onClick={clearFilters}
                        className="text-[10px] font-bold text-slate-400 hover:text-white underline underline-offset-4 tracking-wider transition-colors"
                    >
                        필터 초기화
                    </button>
                )}
            </div>
        </div>
    );
}
