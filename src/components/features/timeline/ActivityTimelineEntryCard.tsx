'use client';

import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { ActivityFeedEntry } from '@/lib/server/activityFeed';
import { timelineToneMap } from './timelineExplorerConfig';

export function ActivityTimelineEntryCard({ activity }: { activity: ActivityFeedEntry }) {
    const tone = timelineToneMap[activity.type];

    return (
        <div className="group relative grid gap-3 rounded-2xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(18,26,38,0.98),rgba(12,18,30,0.92))] p-4 transition-all hover:border-white/[0.12] hover:bg-[linear-gradient(180deg,rgba(21,31,46,0.98),rgba(13,20,33,0.95))] lg:grid-cols-[48px_minmax(0,1fr)_120px]">
            <div className="relative z-10 hidden sm:flex">
                <div className={cn('flex size-11 items-center justify-center rounded-2xl ring-1', tone.iconBg, tone.ring)}>
                    <MaterialIcon name={tone.icon} size="sm" className={tone.iconText} />
                </div>
            </div>

            <div className="min-w-0">
                <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-black tracking-tight text-white">
                                {activity.title}
                            </h3>
                            <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold', tone.chip)}>
                                {activity.memberName}
                            </span>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">
                            {activity.summary}
                        </p>
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {activity.phone && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
                            <MaterialIcon name="call" size="xs" />
                            {activity.phone}
                        </span>
                    )}
                    {activity.staffName && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
                            <MaterialIcon name="badge" size="xs" />
                            {activity.staffName}
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1">
                        <MaterialIcon name="schedule" size="xs" />
                        {activity.absoluteTime}
                    </span>
                </div>
            </div>

            <div className="flex flex-col items-start gap-2 lg:items-end">
                <span className="text-xs font-semibold text-slate-500">
                    {activity.relativeTime}
                </span>
                <Link
                    href={`/members/${activity.entityId}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/15 hover:text-white"
                >
                    <MaterialIcon name="open_in_new" size="xs" />
                    조합원 보기
                </Link>
            </div>
        </div>
    );
}
