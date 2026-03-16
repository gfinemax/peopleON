'use client';

import type { TimelineLogType } from '@/lib/server/activityFeed';

export const filterOptions: { value: 'all' | TimelineLogType; label: string; icon: string }[] = [
    { value: 'all', label: '전체', icon: 'stream' },
    { value: 'CALL', label: '상담', icon: 'call' },
    { value: 'MEET', label: '방문', icon: 'location_on' },
    { value: 'SMS', label: '문자', icon: 'sms' },
    { value: 'DOC', label: '기록', icon: 'description' },
    { value: 'REPAIR', label: '수리', icon: 'build' },
    { value: 'NOTE', label: '메모', icon: 'sticky_note_2' },
];

export const timelineToneMap: Record<
    TimelineLogType,
    { icon: string; ring: string; iconBg: string; iconText: string; chip: string }
> = {
    CALL: {
        icon: 'call',
        ring: 'ring-sky-500/20',
        iconBg: 'bg-sky-500/10',
        iconText: 'text-sky-300',
        chip: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
    },
    MEET: {
        icon: 'location_on',
        ring: 'ring-cyan-500/20',
        iconBg: 'bg-cyan-500/10',
        iconText: 'text-cyan-300',
        chip: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
    },
    SMS: {
        icon: 'sms',
        ring: 'ring-emerald-500/20',
        iconBg: 'bg-emerald-500/10',
        iconText: 'text-emerald-300',
        chip: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
    },
    DOC: {
        icon: 'description',
        ring: 'ring-violet-500/20',
        iconBg: 'bg-violet-500/10',
        iconText: 'text-violet-300',
        chip: 'border-violet-500/20 bg-violet-500/10 text-violet-200',
    },
    REPAIR: {
        icon: 'build',
        ring: 'ring-amber-500/20',
        iconBg: 'bg-amber-500/10',
        iconText: 'text-amber-300',
        chip: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
    },
    NOTE: {
        icon: 'sticky_note_2',
        ring: 'ring-slate-500/20',
        iconBg: 'bg-slate-500/10',
        iconText: 'text-slate-300',
        chip: 'border-white/[0.08] bg-white/[0.04] text-slate-200',
    },
};
