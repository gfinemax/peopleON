'use client';

import { useMemo, useState } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ActivityFeedEntry, TimelineLogType } from '@/lib/server/activityFeed';
import { ActivityTimelineEntryCard } from './ActivityTimelineEntryCard';
import { ActivityTimelineMetricCard } from './ActivityTimelineMetricCard';
import { filterOptions } from './timelineExplorerConfig';

type ActivityTimelineExplorerProps = {
    activities: ActivityFeedEntry[];
};

export function ActivityTimelineExplorer({ activities }: ActivityTimelineExplorerProps) {
    const [query, setQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | TimelineLogType>('all');

    const filteredActivities = useMemo(() => {
        const normalized = query.trim().toLowerCase();

        return activities.filter((activity) => {
            const matchesFilter = activeFilter === 'all' || activity.type === activeFilter;
            if (!normalized) return matchesFilter;

            const haystack = [
                activity.memberName,
                activity.phone || '',
                activity.title,
                activity.summary,
                activity.staffName || '',
            ]
                .join(' ')
                .toLowerCase();

            return matchesFilter && haystack.includes(normalized);
        });
    }, [activities, activeFilter, query]);

    const totalCount = activities.length;
    const personCount = new Set(activities.map((activity) => activity.entityId)).size;
    const smsCount = activities.filter((activity) => activity.type === 'SMS').length;
    const consultationCount = activities.filter((activity) => activity.type === 'CALL' || activity.type === 'MEET').length;

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="flex-1 overflow-y-auto">
                <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 lg:px-6">
                    <section className="rounded-3xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(18,26,38,0.95),rgba(11,18,31,0.98))] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.22)] lg:p-6">
                        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex size-12 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/10 text-violet-300 shadow-[0_12px_24px_rgba(124,58,237,0.18)]">
                                        <MaterialIcon name="timeline" size="md" />
                                    </div>
                                    <div>
                                        <h1 className="text-[24px] font-black tracking-tight text-white">활동 타임라인</h1>
                                        <p className="mt-1 text-sm text-slate-400">
                                            사람별 활동 이력과 전체 운영 흐름을 한 화면에서 살펴봅니다.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <ActivityTimelineMetricCard label="전체 활동" value={`${totalCount}건`} tone="violet" />
                                    <ActivityTimelineMetricCard label="관련 인물" value={`${personCount}명`} tone="sky" />
                                    <ActivityTimelineMetricCard label="상담/방문" value={`${consultationCount}건`} tone="cyan" />
                                    <ActivityTimelineMetricCard label="문자 발송" value={`${smsCount}건`} tone="emerald" />
                                </div>

                                <div className="rounded-2xl border border-white/[0.06] bg-[#111a28] p-4">
                                    <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">보기 기준</p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {filterOptions.map((option) => (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => setActiveFilter(option.value)}
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                                                    activeFilter === option.value
                                                        ? 'border-primary/30 bg-primary/15 text-white shadow-[0_10px_24px_rgba(37,99,235,0.18)]'
                                                        : 'border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.05]',
                                                )}
                                            >
                                                <MaterialIcon name={option.icon} size="xs" />
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                                    <div className="relative flex-1">
                                        <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                            <MaterialIcon name="search" size="sm" />
                                        </div>
                                        <input
                                            type="text"
                                            value={query}
                                            onChange={(event) => setQuery(event.target.value)}
                                            placeholder="이름, 전화번호, 활동 내용 검색"
                                            className="h-12 w-full rounded-2xl border border-white/[0.08] bg-[#111a28] pl-11 pr-4 text-sm text-white placeholder:text-slate-500 outline-none transition-colors focus:border-primary/40"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 self-end lg:self-auto">
                                        <Badge className="border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-slate-200">
                                            {activeFilter === 'all'
                                                ? `전체 ${filteredActivities.length}건`
                                                : `${filterOptions.find((option) => option.value === activeFilter)?.label || '선택'} ${filteredActivities.length}건`}
                                        </Badge>
                                        {query && (
                                            <button
                                                type="button"
                                                onClick={() => setQuery('')}
                                                className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.05]"
                                            >
                                                <MaterialIcon name="close" size="xs" />
                                                초기화
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-white/[0.08] bg-[#0f1725] p-4 lg:p-5">
                                    {filteredActivities.length > 0 ? (
                                        <div className="relative">
                                            <div className="absolute left-[22px] top-2 hidden h-[calc(100%-1rem)] w-px bg-gradient-to-b from-white/[0.08] via-white/[0.06] to-transparent sm:block" />
                                            <div className="space-y-4">
                                                {filteredActivities.map((activity) => (
                                                    <ActivityTimelineEntryCard key={activity.id} activity={activity} />
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] text-center">
                                            <div className="flex size-12 items-center justify-center rounded-2xl bg-white/[0.03] text-slate-500">
                                                <MaterialIcon name="history_toggle_off" size="md" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-200">조건에 맞는 활동이 없습니다.</p>
                                                <p className="mt-1 text-xs text-slate-500">검색어나 보기 기준을 바꿔서 다시 확인해보세요.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
