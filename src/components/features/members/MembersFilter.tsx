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
    absoluteTotalCount: number;
    filteredCount: number;
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
    { id: 'general', label: '일반분양', icon: 'apartment' },
    { id: 'investor', label: '투자/기타', icon: 'monetization_on' },
    { id: 'party', label: '관계자', icon: 'people_outline' },
];

const roleMemoMap: Record<string, string> = {
    all: '전체 인원 흐름을 한 번에 확인하고 이슈를 비교할 수 있습니다.',
    member: '조합 가입이 연계된 인원(등기, 1/2차, 예비, 지주조합원)을 중점 관리합니다.',
    landowner: '아직 조합원이 아닌 원지주 특성을 고려해 개별 응대와 상태 이력 추적을 강화합니다.',
    general: '일반분양 대상은 분납/미납 전환 이슈를 우선 모니터링합니다.',
    investor: '권리증환불 대상자 등 제3의 투자/채권 성격의 권리자를 관리합니다.',
    party: '대리인이나 관계인 등 특정 조합원/권리에 연동된 인물 정보를 확인합니다.',
};

const tierGroupsByRole: Record<string, string[]> = {
    member: ['등기조합원', '1차', '2차', '지주조합원', '예비조합원'],
    general: ['일반분양', '3차'],
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
    absoluteTotalCount,
    filteredCount,
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
    const activeSort = searchParams.get('sort') || 'name';
    const activeOrder = searchParams.get('order') || 'asc';

    // Local state for immediate feedback
    const [query, setQuery] = useState(searchParams.get('q') || '');
    const [tagInput, setTagInput] = useState(searchParams.get('tag') || '');
    const [isExpanded, setIsExpanded] = useState(false);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

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

    return (
        <div className="flex flex-col gap-3">
            <section className="overflow-hidden rounded-2xl flex flex-col pt-2 bg-[#0F151B] border border-white/10 shadow-[0_10px_28px_rgba(0,0,0,0.26)]">
                <div className="hidden md:flex flex-col flex-1 min-h-0 relative px-0 pb-0">
                    <div className="flex items-end px-4 relative z-10 overflow-x-auto scrollbar-hide">
                        {roleTabs.map((tab) => {
                            const isActive = tab.id === activeRole;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => updateSearch('role', tab.id)}
                                    className={cn(
                                        "relative group flex flex-col items-center justify-center min-w-[120px] pb-3 px-4 outline-none transition-all",
                                        isActive ? "pt-3.5 z-20" : "pt-4 text-gray-500 hover:text-gray-300 z-10"
                                    )}
                                >
                                    {isActive ? (
                                        <>
                                            <div className="absolute bottom-0 -left-4 w-4 h-4 z-10 pointer-events-none"
                                                style={{ background: 'radial-gradient(circle at top left, transparent 16px, #1A2633 16.5px)' }} />
                                            <div className="absolute inset-0 bg-[#1A2633] rounded-t-xl z-0 shadow-[-1px_-1px_0_rgba(255,255,255,0.05)]" />
                                            <div className="absolute top-0 left-2 right-2 h-[2px] bg-gradient-to-r from-blue-400/0 via-blue-400 to-blue-400/0 opacity-70 z-20" />
                                            <div className="absolute bottom-0 -right-4 w-4 h-4 z-10 pointer-events-none"
                                                style={{ background: 'radial-gradient(circle at top right, transparent 16px, #1A2633 16.5px)' }} />
                                            <div className="relative z-20 flex flex-col items-center gap-1.5 w-full">
                                                <div className="flex flex-row items-center gap-2">
                                                    <MaterialIcon name={tab.icon} className="text-[18px] text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                    <p className="text-white text-[15px] font-bold tracking-wide">{tab.label}</p>
                                                </div>
                                                <p className="text-[12px] text-slate-300">총 {tab.count.toLocaleString()}명</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="absolute inset-x-2 top-2 bottom-0 rounded-t-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="relative z-10 flex flex-col items-center gap-1.5 w-full">
                                                <div className="flex flex-row items-center gap-2">
                                                    <MaterialIcon name={tab.icon} className="text-[18px]" />
                                                    <p className="text-[14px] font-semibold">{tab.label}</p>
                                                </div>
                                                <p className="text-[12px] opacity-70">총 {tab.count.toLocaleString()}명</p>
                                            </div>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#1A2633] z-0" />
                    </div>

                    <div className="flex-1 bg-[#1A2633] relative z-0 flex flex-col px-4 py-3 pb-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <MaterialIcon name="folder_managed" size="sm" className="text-sky-300" />
                                <span className="text-[13px] font-semibold text-slate-100">{activeTab.label}</span>
                                <span className="text-[12px] text-slate-400">전체 {absoluteTotalCount.toLocaleString()}</span>
                                <span className="text-[12px] text-slate-300">선택 {activeTab.count.toLocaleString()}</span>
                                <span className="text-[12px] text-sky-200">조회 {filteredCount.toLocaleString()}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSummaryExpanded((prev) => !prev)}
                                className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <span>{isSummaryExpanded ? '요약 접기' : '요약 보기'}</span>
                                <MaterialIcon name={isSummaryExpanded ? 'expand_less' : 'expand_more'} size="xs" />
                            </button>
                        </div>

                        {tierGroupsByRole[activeRole] && (
                            <div className="mt-3 flex flex-wrap gap-2 bg-[#0D151F] p-2.5 rounded-lg border border-white/5 shadow-inner">
                                <button
                                    onClick={() => updateSearch('tier', 'all')}
                                    className={cn(
                                        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border",
                                        activeTier === 'all'
                                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-sm'
                                            : 'bg-white/5 text-slate-400 hover:text-white border-transparent hover:border-white/10'
                                    )}
                                >
                                    모든 {activeTab.label}
                                </button>
                                {tierGroupsByRole[activeRole].map((tierName) => {
                                    const count = tierCounts[tierName] || 0;
                                    return (
                                        <button
                                            key={tierName}
                                            onClick={() => updateSearch('tier', tierName)}
                                            className={cn(
                                                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors border",
                                                activeTier === tierName
                                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                                    : 'bg-white/5 text-slate-400 hover:text-white border-transparent hover:border-white/10'
                                            )}
                                        >
                                            {tierName}
                                            <span className={cn(
                                                "text-[10px] px-1.5 rounded-full",
                                                activeTier === tierName ? 'bg-blue-500/20 text-blue-200' : 'bg-black/40 text-slate-500'
                                            )}>{count}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {isSummaryExpanded && (
                            <div className="mt-2 rounded-lg border border-white/10 bg-[#0F151B] p-3 shadow-inner">
                                <p className="text-[12px] leading-relaxed text-slate-300">{activeMemo}</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-[#24334a] bg-[#162943] px-3 py-3 md:hidden">
                    <label htmlFor="cohort-tab-select" className="mb-1 block text-[11px] font-semibold tracking-wide text-slate-300">
                        역할 분류
                    </label>
                    <div className="relative">
                        <select
                            id="cohort-tab-select"
                            value={activeRole}
                            onChange={(event) => updateSearch('role', event.target.value)}
                            className="h-11 w-full appearance-none rounded-lg border border-[#38557a] bg-[#0a1628] px-3 pr-10 text-sm font-semibold text-slate-100 outline-none transition-colors focus:border-sky-400"
                        >
                            {roleTabs.map((tab) => (
                                <option key={tab.id} value={tab.id}>
                                    {tab.label} ({tab.count.toLocaleString()})
                                </option>
                            ))}
                        </select>
                        <MaterialIcon name="expand_more" size="md" className="pointer-events-none absolute right-3 top-3 text-slate-400" />
                    </div>
                </div>

                <div className="border-t border-[#24334a] bg-[#162943] px-3 pb-2.5 pt-2 md:hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#2d415f] bg-[#0b1628] px-3 py-2">
                        <div className="flex items-center gap-2">
                            <MaterialIcon name="folder_managed" size="sm" className="text-sky-300" />
                            <span className="text-[13px] font-semibold text-slate-100">{activeTab.label}</span>
                            <span className="text-[12px] text-slate-400">전체 {absoluteTotalCount.toLocaleString()}</span>
                            <span className="text-[12px] text-slate-300">선택 {activeTab.count.toLocaleString()}</span>
                            <span className="text-[12px] text-sky-200">조회 {filteredCount.toLocaleString()}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsSummaryExpanded((prev) => !prev)}
                            className="inline-flex items-center gap-1 rounded-md border border-[#355074] bg-[#11233a] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:text-white"
                        >
                            <span>{isSummaryExpanded ? '요약 접기' : '요약 보기'}</span>
                            <MaterialIcon name={isSummaryExpanded ? 'expand_less' : 'expand_more'} size="xs" />
                        </button>
                    </div>

                    {tierGroupsByRole[activeRole] && (
                        <div className="mt-2 flex overflow-x-auto gap-2 bg-[#0a1628] p-2 rounded-lg border border-[#223a5a] scrollbar-hide">
                            <button
                                onClick={() => updateSearch('tier', 'all')}
                                className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${activeTier === 'all' ? 'bg-[#4EA5FF] text-[#0b1628]' : 'bg-[#1a2f49] text-slate-300 hover:text-white border border-transparent'}`}
                            >
                                전체
                            </button>
                            {tierGroupsByRole[activeRole].map((tierName) => {
                                const count = tierCounts[tierName] || 0;
                                return (
                                    <button
                                        key={tierName}
                                        onClick={() => updateSearch('tier', tierName)}
                                        className={`flex flex-shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${activeTier === tierName ? 'bg-[#4EA5FF] text-[#0b1628]' : 'bg-[#1a2f49] text-slate-400 hover:text-white border border-transparent'}`}
                                    >
                                        {tierName} <span className="opacity-60">{count}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {isSummaryExpanded && (
                        <div className="mt-2 rounded-lg border border-[#2f4562] bg-[#0b1628] p-3">
                            <p className="text-[12px] leading-relaxed text-slate-300">{activeMemo}</p>
                        </div>
                    )}
                </div>
            </section>

            <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-[#101725] p-3">
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1 group">
                        <MaterialIcon
                            name="search"
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-sky-300 transition-colors"
                            size="sm"
                        />
                        <input
                            type="text"
                            placeholder="이름, 동호수, 전화번호 검색"
                            className="h-10 w-full rounded-lg border border-[#324764] bg-[#0d182b] pl-9 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none transition-all"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className={`h-10 px-3 rounded-lg border transition-all flex items-center justify-center ${isExpanded ? 'border-sky-300/40 bg-sky-300/10 text-sky-200' : 'border-[#37516f] bg-[#0d182b] text-slate-300 hover:text-white'}`}
                        title="상세 필터"
                    >
                        <MaterialIcon name="tune" size="sm" />
                    </button>
                    <button
                        onClick={handleSearch}
                        className="h-10 px-4 rounded-lg bg-sky-600 text-white font-bold text-sm hover:bg-sky-500 transition-all whitespace-nowrap"
                    >
                        검색
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => updateSearch('status', activeStatus === '정상' ? 'all' : '정상')}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${activeStatus === '정상' ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200' : 'border-[#37516f] bg-[#0d182b] text-slate-200 hover:text-white'}`}
                    >
                        정상만 보기
                    </button>
                    <button
                        type="button"
                        onClick={() => updateSearch('status', activeStatus === '소송중' ? 'all' : '소송중')}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${activeStatus === '소송중' ? 'border-orange-300/40 bg-orange-300/10 text-orange-200' : 'border-[#37516f] bg-[#0d182b] text-slate-200 hover:text-white'}`}
                    >
                        소송중 보기
                    </button>
                    <button
                        type="button"
                        onClick={() => updateSearch('status', activeStatus === '정산대기' ? 'all' : '정산대기')}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${activeStatus === '정산대기' ? 'border-amber-300/40 bg-amber-300/10 text-amber-200' : 'border-[#37516f] bg-[#0d182b] text-slate-200 hover:text-white'}`}
                    >
                        정산대기
                    </button>
                    <button
                        type="button"
                        onClick={() => updateSearch('status', activeStatus === '지급완료' ? 'all' : '지급완료')}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${activeStatus === '지급완료' ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200' : 'border-[#37516f] bg-[#0d182b] text-slate-200 hover:text-white'}`}
                    >
                        지급완료
                    </button>
                    <button
                        type="button"
                        onClick={() => updateSearch('status', activeStatus === '연결필요' ? 'all' : '연결필요')}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${activeStatus === '연결필요' ? 'border-rose-300/40 bg-rose-300/10 text-rose-200' : 'border-[#37516f] bg-[#0d182b] text-slate-200 hover:text-white'}`}
                    >
                        연결필요
                    </button>
                    <button
                        type="button"
                        onClick={() => updateSearch('status', activeStatus === '케이스누락' ? 'all' : '케이스누락')}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${activeStatus === '케이스누락' ? 'border-amber-300/40 bg-amber-300/10 text-amber-200' : 'border-[#37516f] bg-[#0d182b] text-slate-200 hover:text-white'}`}
                    >
                        케이스누락
                    </button>
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="rounded-full border border-sky-300/40 bg-sky-300/10 px-3 py-1.5 text-xs font-semibold text-sky-200"
                    >
                        필터 초기화
                    </button>
                </div>

                {isExpanded && (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="col-span-1 lg:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">역할군</label>
                            <Select
                                value={activeRole}
                                onValueChange={(val) => {
                                    updateSearch('role', val);
                                }}
                            >
                                <SelectTrigger className="h-9 rounded-lg bg-[#0d182b] border-[#324764] w-full text-xs text-slate-100">
                                    <SelectValue placeholder="전체" />
                                </SelectTrigger>
                                <SelectContent>
                                    {roleTabs.map((tab) => (
                                        <SelectItem key={tab.id} value={tab.id}>
                                            {tab.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-1 lg:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">상태</label>
                            <Select
                                value={activeStatus || 'all'}
                                onValueChange={(val) => {
                                    updateSearch('status', val);
                                }}
                            >
                                <SelectTrigger className="h-9 rounded-lg bg-[#0d182b] border-[#324764] w-full text-xs text-slate-100">
                                    <SelectValue placeholder="전체" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">전체</SelectItem>
                                    <SelectItem value="정상">정상</SelectItem>
                                    <SelectItem value="탈퇴예정">탈퇴예정</SelectItem>
                                    <SelectItem value="소송중">소송중</SelectItem>
                                    <SelectItem value="자격상실">자격상실</SelectItem>
                                    <SelectItem value="연결필요">연결필요</SelectItem>
                                    <SelectItem value="케이스누락">케이스누락</SelectItem>
                                    <SelectItem value="정산대기">정산대기</SelectItem>
                                    <SelectItem value="지급완료">지급완료</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-1 lg:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">정렬 기준</label>
                            <Select
                                value={activeSort}
                                onValueChange={(val) => {
                                    updateSearch('sort', val);
                                }}
                            >
                                <SelectTrigger className="h-9 rounded-lg bg-[#0d182b] border-[#324764] w-full text-xs text-slate-100">
                                    <SelectValue placeholder="번호순" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="member_number">번호순</SelectItem>
                                    <SelectItem value="name">이름순</SelectItem>
                                    <SelectItem value="tier">차수순</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-1 lg:col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">정렬 순서</label>
                            <div className="flex h-9 rounded-lg bg-[#0d182b] border border-[#324764] p-1">
                                <button
                                    onClick={() => {
                                        updateSearch('order', 'asc');
                                    }}
                                    className={`flex-1 flex items-center justify-center rounded text-[10px] font-bold transition-all ${activeOrder === 'asc' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5'}`}
                                >
                                    오름차순
                                </button>
                                <button
                                    onClick={() => {
                                        updateSearch('order', 'desc');
                                    }}
                                    className={`flex-1 flex items-center justify-center rounded text-[10px] font-bold transition-all ${activeOrder === 'desc' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5'}`}
                                >
                                    내림차순
                                </button>
                            </div>
                        </div>

                        <div className="col-span-2 md:col-span-2 lg:col-span-4 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-0.5">태그</label>
                            <input
                                type="text"
                                placeholder="#태그 입력"
                                className="h-9 w-full rounded-lg border border-[#324764] bg-[#0d182b] px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none transition-all font-mono"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleTagKeyDown}
                            />
                        </div>
                    </div>
                )}

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
                            {activeTier !== 'all' && (
                                <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-300/10 px-2 py-1 text-[10px] font-black text-sky-200 border border-sky-300/20">
                                    분류: {activeTier}
                                    <button onClick={() => updateSearch('tier', 'all')} className="hover:text-white transition-colors">
                                        <MaterialIcon name="close" size="xs" />
                                    </button>
                                </span>
                            )}
                            {activeStatus && (
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
                            {!activeStatus && !activeTag && activeRole === 'all' && activeTier === 'all' && (
                                <span className="text-[10px] text-slate-500">없음</span>
                            )}
                        </div>
                    </div>
                    {(activeRole !== 'all' || activeTier !== 'all' || activeStatus || activeTag || query) && (
                        <button
                            onClick={clearFilters}
                            className="text-[10px] font-bold text-slate-400 hover:text-white underline underline-offset-4 tracking-wider transition-colors"
                        >
                            필터 초기화
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
