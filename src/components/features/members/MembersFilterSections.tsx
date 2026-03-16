'use client';

import { MaterialIcon } from '@/components/ui/icon';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type RoleTab = {
    id: string;
    label: string;
    count: number;
    icon: string;
};

type FilterChip = {
    key: string;
    label: string;
    tone: 'blue' | 'indigo' | 'sky';
};

const chipToneClass: Record<FilterChip['tone'], string> = {
    blue: 'bg-blue-500/10 text-blue-200 border-blue-500/20',
    indigo: 'bg-indigo-500/10 text-indigo-200 border-indigo-500/20 shadow-[0_0_10px_rgba(99,102,241,0.1)]',
    sky: 'bg-sky-300/10 text-sky-200 border-sky-300/20',
};

export function MembersRoleTabs({
    roleTabs,
    activeRole,
    onSelectRole,
}: {
    roleTabs: RoleTab[];
    activeRole: string;
    onSelectRole: (role: string) => void;
}) {
    return (
        <div className="flex items-end gap-0.5 overflow-x-auto scrollbar-hide py-1">
            {roleTabs.map((tab) => {
                const isActive = tab.id === activeRole;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onSelectRole(tab.id)}
                        className={cn(
                            'relative rounded-t-lg border-b-2 px-2.5 py-1.5 text-[13px] font-bold whitespace-nowrap transition-colors',
                            isActive
                                ? 'border-blue-400 bg-blue-500/10 text-blue-400'
                                : 'border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200',
                        )}
                    >
                        <span className="flex items-center gap-1">
                            <MaterialIcon name={tab.icon} size="xs" />
                            {tab.label}
                            <span
                                className={cn(
                                    'ml-0.5 rounded-full bg-black/30 px-1 py-0.5 text-[9px] leading-none',
                                    isActive ? 'text-blue-300' : 'text-slate-500',
                                )}
                            >
                                {tab.count.toLocaleString()}
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export function MembersSearchBar({
    query,
    isDashboardCollapsed,
    onQueryChange,
    onToggleDashboard,
}: {
    query: string;
    isDashboardCollapsed?: boolean;
    onQueryChange: (value: string) => void;
    onToggleDashboard?: () => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <div className="relative group w-full md:w-56">
                <MaterialIcon
                    name="search"
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-sky-300"
                    size="sm"
                />
                <input
                    type="text"
                    placeholder="이름, 동호수, 전화번호"
                    className="h-9 w-full rounded-md border border-[#324764] bg-[#0d182b] pl-9 pr-4 text-sm text-slate-100 placeholder:text-slate-500 transition-all focus:border-sky-400 focus:outline-none"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                />
            </div>

            <button
                type="button"
                onClick={onToggleDashboard}
                className={cn(
                    'flex h-9 flex-shrink-0 items-center gap-1.5 rounded-md border px-3 text-xs font-bold transition-all',
                    isDashboardCollapsed
                        ? 'border-purple-500/40 bg-purple-500/10 text-purple-300'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:text-white',
                )}
            >
                <MaterialIcon name="monitoring" size="sm" />
                <span className="hidden md:inline">{isDashboardCollapsed ? '대시보드 보기' : '대시보드 닫기'}</span>
            </button>
        </div>
    );
}

export function MembersFilterControls({
    activeOrder,
    activeRel,
    activeSort,
    activeStatus,
    activeTabCount,
    activeTier,
    activeRole,
    relationNames,
    relCounts,
    statusCounts,
    tierCounts,
    tierGroups,
    onUpdateSearch,
}: {
    activeOrder: string;
    activeRel: string;
    activeSort: string;
    activeStatus: string | null;
    activeTabCount: number;
    activeTier: string;
    activeRole: string;
    relationNames: string[];
    relCounts: Record<string, number>;
    statusCounts: Record<string, number>;
    tierCounts: Record<string, number>;
    tierGroups: string[];
    onUpdateSearch: (key: string, value: string) => void;
}) {
    return (
        <div className="mb-4 flex flex-wrap items-center gap-2">
            {tierGroups.length > 0 && (
                <Select value={activeTier} onValueChange={(value) => onUpdateSearch('tier', value)}>
                    <SelectTrigger className="h-9 min-w-[120px] rounded-md border-white/10 bg-[#0d182b] text-xs text-slate-100 transition-colors hover:border-blue-500/30">
                        <span className="flex items-center gap-1.5">
                            <span className="mr-1 font-bold text-slate-500">분류:</span>
                            <SelectValue placeholder="분류 전체" />
                        </span>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">분류 전체 ({activeTabCount.toLocaleString()})</SelectItem>
                        {tierGroups.map((tierName) => {
                            let display = tierName === '등기조합원' ? '등기' : tierName === '예비조합원' ? '예비' : tierName === '지주조합원' ? '지주' : tierName === '2차' ? '2차' : tierName;
                            if (tierName === '권리증보유자') display = '권리증보유';
                            if (activeRole === 'member') display = `조합원(${display})`;
                            else if (activeRole === 'landowner') display = `원지주(${display})`;

                            return (
                                <SelectItem key={tierName} value={tierName}>
                                    {display} ({tierCounts[tierName] || 0})
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
            )}

            <Select value={activeStatus || 'all'} onValueChange={(value) => onUpdateSearch('status', value)}>
                <SelectTrigger className="h-9 min-w-[120px] rounded-md border-white/10 bg-[#0d182b] text-xs text-slate-100 transition-colors hover:border-blue-500/30">
                    <span className="flex items-center gap-1.5">
                        <span className="mr-1 font-bold text-slate-500">상태:</span>
                        <SelectValue placeholder="상태 전체" />
                    </span>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">상태 전체</SelectItem>
                    {Object.entries(statusCounts)
                        .filter(([status]) => !['기타', 'null', '비조합원', '미정', '소송'].includes(status))
                        .sort(([left], [right]) => {
                            const order = ['정상', '환불', '제명', '탈퇴', '정산대기', '지급완료', '연결필요', '케이스누락'];
                            return order.indexOf(left) - order.indexOf(right);
                        })
                        .map(([status, count]) => (
                            <SelectItem key={status} value={status}>
                                {status} ({count})
                            </SelectItem>
                        ))}
                </SelectContent>
            </Select>

            <Select value={activeRel} onValueChange={(value) => onUpdateSearch('rel', value)}>
                <SelectTrigger className="h-9 min-w-[120px] rounded-md border-white/10 bg-[#0d182b] text-xs text-slate-100 transition-colors hover:border-blue-500/30">
                    <span className="flex items-center gap-1.5">
                        <span className="mr-1 font-bold text-slate-500">관계:</span>
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

            <div className="ml-auto flex items-center gap-px rounded-md border border-white/10 bg-white/5 p-0.5">
                <Select value={activeSort} onValueChange={(value) => onUpdateSearch('sort', value)}>
                    <SelectTrigger className="h-8 min-w-[90px] border-none bg-transparent text-xs text-slate-100 focus:ring-0">
                        <SelectValue placeholder="정렬" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="member_number">번호순</SelectItem>
                        <SelectItem value="name">이름순</SelectItem>
                        <SelectItem value="tier">차수순</SelectItem>
                    </SelectContent>
                </Select>
                <div className="mx-1 h-4 w-px bg-white/10" />
                <button
                    onClick={() => onUpdateSearch('order', activeOrder === 'asc' ? 'desc' : 'asc')}
                    className="flex h-8 items-center gap-1 rounded px-2 text-slate-400 transition-colors hover:bg-white/5"
                    title={activeOrder === 'asc' ? '오름차순' : '내림차순'}
                >
                    <MaterialIcon name={activeOrder === 'asc' ? 'arrow_upward' : 'arrow_downward'} size="xs" />
                    <span className="text-[10px] font-bold">{activeOrder === 'asc' ? 'ASC' : 'DESC'}</span>
                </button>
            </div>
        </div>
    );
}

export function MembersActiveFilters({
    chips,
    hasAnyFilter,
    onClearAll,
    onRemove,
}: {
    chips: FilterChip[];
    hasAnyFilter: boolean;
    onClearAll: () => void;
    onRemove: (key: string) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">활성 필터:</span>
                <div className="flex items-center gap-2 flex-wrap">
                    {chips.length > 0 ? chips.map((chip) => (
                        <span
                            key={chip.key}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-black',
                                chipToneClass[chip.tone],
                            )}
                        >
                            {chip.label}
                            <button onClick={() => onRemove(chip.key)} className="transition-colors hover:text-white">
                                <MaterialIcon name="close" size="xs" />
                            </button>
                        </span>
                    )) : (
                        <span className="text-[10px] text-slate-500">없음</span>
                    )}
                </div>
            </div>
            {hasAnyFilter && (
                <button
                    onClick={onClearAll}
                    className="text-[10px] font-bold tracking-wider text-slate-400 underline underline-offset-4 transition-colors hover:text-white"
                >
                    필터 초기화
                </button>
            )}
        </div>
    );
}
