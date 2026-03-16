'use client';

import { MaterialIcon } from '@/components/ui/icon';
import type { Segment } from './membersKpiStripUtils';
import { formatCount, ratio } from './membersKpiStripUtils';

function DonutChart({
    segments,
    total,
}: {
    segments: Segment[];
    total: number;
}) {
    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const circleSegments = segments
        .filter((segment) => segment.value > 0)
        .reduce<{ segment: Segment; length: number; offset: number }[]>((acc, segment) => {
            const length = total > 0 ? (segment.value / total) * circumference : 0;
            const previous = acc[acc.length - 1];
            const offset = previous ? previous.offset + previous.length : 0;

            acc.push({ segment, length, offset });
            return acc;
        }, []);

    return (
        <svg viewBox="0 0 84 84" className="h-24 w-24 shrink-0 -rotate-90">
            <circle
                cx="42"
                cy="42"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="10"
            />
            {circleSegments.map(({ segment, length, offset }) => (
                <circle
                    key={segment.label}
                    cx="42"
                    cy="42"
                    r={radius}
                    fill="none"
                    stroke={segment.stroke}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={-offset}
                />
            ))}
        </svg>
    );
}

function LegendRow({
    segment,
    total,
    unit,
    onClick,
}: {
    segment: Segment;
    total: number;
    unit: string;
    onClick?: () => void;
}) {
    const clickable = segment.interactive && onClick;

    return (
        <button
            type="button"
            onClick={clickable ? onClick : undefined}
            className={`flex w-full items-center justify-between gap-3 border-t border-white/8 pt-2 text-left ${
                clickable
                    ? 'cursor-pointer rounded-lg transition-colors hover:bg-white/[0.03] focus:outline-none focus:ring-1 focus:ring-violet-400/40'
                    : 'cursor-default'
            }`}
        >
            <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${segment.colorClass}`} />
                <span className="truncate text-[11px] font-semibold text-slate-200">{segment.label}</span>
                {clickable ? (
                    <span className="rounded border border-violet-400/20 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold text-violet-200">
                        클릭
                    </span>
                ) : null}
            </div>
            <div className="text-right">
                <p className="text-sm font-black text-white">{formatCount(segment.value, unit)}</p>
                <p className="text-[10px] text-slate-400">{ratio(segment.value, total)}%</p>
            </div>
        </button>
    );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-2">
            <span className="text-[11px] font-semibold text-slate-400">{label}</span>
            <span className="text-sm font-black text-white">{value}</span>
        </div>
    );
}

export function CompactDonutCard({
    icon,
    title,
    subtitle,
    total,
    unit,
    pillText,
    pillClassName,
    segments,
    summaryRows,
    onSegmentClick,
    onPillClick,
}: {
    icon: string;
    title: string;
    subtitle: string;
    total: number;
    unit: string;
    pillText: string;
    pillClassName: string;
    segments: Segment[];
    summaryRows?: { label: string; value: string }[];
    onSegmentClick?: (segment: Segment) => void;
    onPillClick?: () => void;
}) {
    return (
        <article className="min-w-0 rounded-2xl border border-white/10 bg-[#111a29] p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 text-slate-100">
                        <MaterialIcon name={icon} size="sm" className="opacity-90" />
                        <p className="truncate text-sm font-extrabold">{title}</p>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{subtitle}</p>
                </div>
                {onPillClick ? (
                    <button
                        type="button"
                        onClick={onPillClick}
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors hover:brightness-110 ${pillClassName}`}
                    >
                        {pillText}
                    </button>
                ) : (
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${pillClassName}`}>
                        {pillText}
                    </span>
                )}
            </div>

            <div className="mt-4 flex items-center gap-4">
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                    <DonutChart segments={segments} total={total} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-semibold text-slate-400">총합</span>
                        <span className="text-lg font-black tracking-tight text-white">{total.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-500">{unit}</span>
                    </div>
                </div>

                <div className="grid flex-1 gap-2">
                    {segments.map((segment) => (
                        <LegendRow
                            key={segment.label}
                            segment={segment}
                            total={total}
                            unit={unit}
                            onClick={onSegmentClick ? () => onSegmentClick(segment) : undefined}
                        />
                    ))}
                    {summaryRows?.map((row) => (
                        <SummaryRow key={row.label} label={row.label} value={row.value} />
                    ))}
                </div>
            </div>
        </article>
    );
}
