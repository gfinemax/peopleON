'use client';

import { cn } from '@/lib/utils';

export function ActivityTimelineMetricCard({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone: 'violet' | 'sky' | 'cyan' | 'emerald';
}) {
    const toneClass = {
        violet: 'border-violet-500/20 bg-violet-500/10 text-violet-200',
        sky: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
        cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
        emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    }[tone];

    return (
        <div className={cn('rounded-2xl border p-3', toneClass)}>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
            <p className="mt-2 text-xl font-black tracking-tight">{value}</p>
        </div>
    );
}
