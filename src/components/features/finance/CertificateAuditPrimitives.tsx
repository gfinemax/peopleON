import Link from 'next/link';

import { MaterialIcon } from '@/components/ui/icon';

export function CertificateAuditKpiCard({
    title,
    value,
    tone,
}: {
    title: string;
    value: string;
    tone: 'blue' | 'emerald' | 'amber' | 'red' | 'slate';
}) {
    const toneClass =
        tone === 'blue'
            ? 'border-blue-500/20 bg-blue-500/5 text-blue-400'
            : tone === 'emerald'
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                : tone === 'amber'
                    ? 'border-amber-500/20 bg-amber-500/5 text-amber-400'
                    : tone === 'red'
                        ? 'border-red-500/20 bg-red-500/5 text-red-400'
                        : 'border-slate-500/20 bg-slate-500/5 text-slate-300';

    return (
        <div className={`rounded-xl border p-3 lg:p-4 ${toneClass}`}>
            <p className="text-[10px] lg:text-xs font-bold uppercase tracking-wider opacity-80">{title}</p>
            <p className="text-lg lg:text-2xl font-black mt-1 tracking-tight">{value}</p>
        </div>
    );
}

export function CertificateAuditSummaryStat({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: string;
    tone?: 'default' | 'emerald' | 'amber';
}) {
    const toneClass =
        tone === 'emerald'
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
            : tone === 'amber'
                ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                : 'border-white/[0.08] bg-[#161B22] text-slate-200';

    return (
        <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">{label}</p>
            <p className="mt-1 text-base font-black">{value}</p>
        </div>
    );
}

export function CertificateAuditQualityBadge({
    label,
    count,
    tone,
    href,
}: {
    label: string;
    count: number;
    tone: 'ok' | 'warn' | 'danger';
    href?: string;
}) {
    const toneClass =
        tone === 'ok'
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            : tone === 'danger'
                ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                : 'border-amber-400/20 bg-amber-500/10 text-amber-200';

    const badgeClass = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`;
    const content = (
        <>
            <span>{label}</span>
            <span className="font-black">{count.toLocaleString()}건</span>
        </>
    );

    if (!href) {
        return <div className={badgeClass}>{content}</div>;
    }

    return (
        <Link href={href} className={`${badgeClass} hover:opacity-90 transition-opacity`}>
            {content}
            <MaterialIcon name="open_in_new" size="xs" />
        </Link>
    );
}
