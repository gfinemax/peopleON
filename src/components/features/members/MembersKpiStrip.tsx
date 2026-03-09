import { MaterialIcon } from '@/components/ui/icon';

type SummaryBlock = {
    total: number;
    members: number;
    recruitmentTarget: number;
};

type CertificateBlock = {
    total: number;
    memberHeld: number;
    externalHeld: number;
    refundEligible: number;
};

type RelationBlock = {
    total: number;
    agents: number;
    others: number;
};

type Segment = {
    label: string;
    value: number;
    colorClass: string;
    stroke: string;
};

interface MembersKpiStripProps {
    households: SummaryBlock;
    certificates: CertificateBlock;
    relations: RelationBlock;
}

function ratio(value: number, total: number) {
    if (total <= 0) return 0;
    return Math.round((value / total) * 1000) / 10;
}

function formatCount(value: number, unit: string) {
    return `${value.toLocaleString()}${unit}`;
}

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
            <circle cx="42" cy="42" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
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

function LegendRow({ segment, total, unit }: { segment: Segment; total: number; unit: string }) {
    return (
        <div className="flex items-center justify-between gap-3 border-t border-white/8 pt-2">
            <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${segment.colorClass}`} />
                <span className="truncate text-[11px] font-semibold text-slate-200">{segment.label}</span>
            </div>
            <div className="text-right">
                <p className="text-sm font-black text-white">{formatCount(segment.value, unit)}</p>
                <p className="text-[10px] text-slate-400">{ratio(segment.value, total)}%</p>
            </div>
        </div>
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

function CompactDonutCard({
    icon,
    title,
    subtitle,
    total,
    unit,
    pillText,
    pillClassName,
    segments,
    summaryRows,
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
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${pillClassName}`}>
                    {pillText}
                </span>
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
                        <LegendRow key={segment.label} segment={segment} total={total} unit={unit} />
                    ))}
                    {summaryRows?.map((row) => (
                        <SummaryRow key={row.label} label={row.label} value={row.value} />
                    ))}
                </div>
            </div>
        </article>
    );
}

export function MembersKpiStrip({ households, certificates, relations }: MembersKpiStripProps) {
    const householdSegments: Segment[] = [
        { label: '조합원', value: households.members, colorClass: 'bg-sky-400', stroke: '#38bdf8' },
        { label: '추가모집 예정', value: households.recruitmentTarget, colorClass: 'bg-amber-400', stroke: '#fbbf24' },
    ];

    const certificateSegments: Segment[] = [
        { label: '조합원 보유분', value: certificates.memberHeld, colorClass: 'bg-violet-400', stroke: '#a78bfa' },
        { label: '환불 권리증', value: certificates.externalHeld, colorClass: 'bg-emerald-400', stroke: '#34d399' },
    ];

    const relationSegments: Segment[] = [
        { label: '대리인', value: relations.agents, colorClass: 'bg-emerald-400', stroke: '#34d399' },
        { label: '관계인', value: relations.others, colorClass: 'bg-teal-200', stroke: '#99f6e4' },
    ];

    return (
        <section className="rounded-2xl border border-white/10 bg-[#0f1725] p-3 lg:p-4">
            <div className="grid gap-3 md:grid-cols-3">
                <CompactDonutCard
                    icon="apartment"
                    title="전체세대"
                    subtitle={`전체 ${households.total.toLocaleString()}세대 기준`}
                    total={households.total}
                    unit="세대"
                    pillText={`조합원 ${ratio(households.members, households.total)}%`}
                    pillClassName="border-sky-400/20 bg-sky-500/10 text-sky-200"
                    segments={householdSegments}
                />

                <CompactDonutCard
                    icon="folder"
                    title="권리증"
                    subtitle="예상 권리증 현황"
                    total={certificates.total}
                    unit="건"
                    pillText={`환불 권리증 ${formatCount(certificates.refundEligible, '건')}`}
                    pillClassName="border-violet-400/20 bg-violet-500/10 text-violet-200"
                    segments={certificateSegments}
                />

                <CompactDonutCard
                    icon="groups_2"
                    title="관계자"
                    subtitle="대리인과 관계인 구성 비율"
                    total={relations.total}
                    unit="명"
                    pillText={`관계자 ${formatCount(relations.total, '명')}`}
                    pillClassName="border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                    segments={relationSegments}
                />
            </div>
        </section>
    );
}
