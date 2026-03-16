'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useMemo, useState, useEffect } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import {
    MembersActiveFilters,
    MembersFilterControls,
    MembersRoleTabs,
    MembersSearchBar,
} from './MembersFilterSections';

interface MembersFilterProps {
    roleCounts: Record<string, number>;
    tierCounts: Record<string, number>;
    relCounts: Record<string, number>;
    statusCounts: Record<string, number>;
    relationNames: string[];
    absoluteTotalCount: number;
    filteredCount: number;
    isDashboardCollapsed?: boolean;
    onToggleDashboard?: () => void;
}

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

const MAIN_ROLES = [
    { id: 'all', label: '전체', icon: 'folder_open' },
    { id: 'member', label: '조합원', icon: 'groups' },
    { id: 'landowner', label: '원지주', icon: 'landscape' },
    { id: 'investor', label: '투자/기타', icon: 'monetization_on' },
    { id: 'party', label: '관계자', icon: 'people_outline' },
];

const tierGroupsByRole: Record<string, string[]> = {
    member: ['등기조합원', '지주조합원', '2차', '일반분양', '예비조합원'],
    landowner: ['지주'],
    investor: ['권리증보유자', '권리증번호있음', '권리증번호없음', '권리증환불'],
    party: ['대리인', '관계인'],
};

const normalizeTierQuery = (raw: string | null) => {
    if (!raw || raw === 'all') return 'all';
    if (raw === '1차') return '2차';
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
    const activeTier =
        rawActiveTier === 'all' || typeof tierCounts[rawActiveTier] === 'number' ? rawActiveTier : 'all';
    const activeStatus = searchParams.get('status');
    const activeTag = searchParams.get('tag');
    const activeRel = searchParams.get('rel') || 'all';
    const activeSort = searchParams.get('sort') || 'name';
    const activeOrder = searchParams.get('order') || 'asc';

    const [query, setQuery] = useState(searchParams.get('q') || '');
    const debouncedQuery = useDebounce(query, 400);
    const [tagInput] = useState(searchParams.get('tag') || '');

    const roleTabs = useMemo<RoleTab[]>(
        () =>
            MAIN_ROLES.map((role) => ({
                ...role,
                count: roleCounts[role.id] ?? 0,
            })),
        [roleCounts],
    );

    const activeTab = roleTabs.find((tab) => tab.id === activeRole) || roleTabs[0];

    const updateSearch = useCallback(
        (key: string, value: string) => {
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
        },
        [pathname, router, searchParams],
    );

    useEffect(() => {
        const currentQuery = searchParams.get('q') || '';
        if (debouncedQuery !== currentQuery) {
            updateSearch('q', debouncedQuery);
        }
    }, [debouncedQuery, searchParams, updateSearch]);

    const clearFilters = () => {
        setQuery('');
        router.push(pathname);
    };

    const removeFilter = (key: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete(key);
        params.set('page', '1');
        router.push(`${pathname}?${params.toString()}`);
    };

    const filterChips = [
        activeRole !== 'all' ? { key: 'role', label: `역할군: ${activeTab.label}`, tone: 'blue' as const } : null,
        activeRel !== 'all' ? { key: 'rel', label: `관계: ${activeRel}`, tone: 'indigo' as const } : null,
        activeTier !== 'all' ? { key: 'tier', label: `분류: ${activeTier}`, tone: 'sky' as const } : null,
        activeStatus && activeStatus !== 'all' ? { key: 'status', label: `상태: ${activeStatus}`, tone: 'sky' as const } : null,
        activeTag ? { key: 'tag', label: `태그: #${activeTag}`, tone: 'sky' as const } : null,
    ].filter((chip): chip is FilterChip => Boolean(chip));

    const hasAnyFilter =
        activeRole !== 'all' ||
        activeTier !== 'all' ||
        activeRel !== 'all' ||
        Boolean(activeStatus && activeStatus !== 'all') ||
        Boolean(activeTag) ||
        Boolean(query);

    return (
        <div className="relative mb-4 flex flex-col gap-0 border-b border-white/5">
            <div className="flex flex-col justify-between gap-4 py-2 md:flex-row md:items-center">
                <MembersRoleTabs roleTabs={roleTabs} activeRole={activeRole} onSelectRole={(role) => updateSearch('role', role)} />
                <MembersSearchBar
                    query={query}
                    isDashboardCollapsed={isDashboardCollapsed}
                    onQueryChange={setQuery}
                    onToggleDashboard={onToggleDashboard}
                />
            </div>

            <MembersFilterControls
                activeOrder={activeOrder}
                activeRel={activeRel}
                activeSort={activeSort}
                activeStatus={activeStatus}
                activeTabCount={activeTab.count}
                activeTier={activeTier}
                activeRole={activeRole}
                relationNames={relationNames}
                relCounts={relCounts}
                statusCounts={statusCounts}
                tierCounts={tierCounts}
                tierGroups={tierGroupsByRole[activeRole] || []}
                onUpdateSearch={updateSearch}
            />

            <div className="h-px w-full bg-white/10" />

            <MembersActiveFilters
                chips={filterChips}
                hasAnyFilter={hasAnyFilter}
                onClearAll={clearFilters}
                onRemove={(key) => {
                    if (key === 'role') {
                        updateSearch('role', 'all');
                        return;
                    }
                    if (key === 'rel') {
                        updateSearch('rel', 'all');
                        return;
                    }
                    if (key === 'tier') {
                        updateSearch('tier', 'all');
                        return;
                    }
                    removeFilter(key);
                }}
            />
        </div>
    );
}
