'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { PaymentStatus, PersonPaymentSummary } from '@/lib/server/paymentDashboard';

const formatAmount = (value: number) => `₩${Math.round(value).toLocaleString('ko-KR')}`;

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('ko-KR');
};

export function PersonPaymentRow({
    row,
    onOpenMemberDetail,
}: {
    row: PersonPaymentSummary;
    onOpenMemberDetail: (row: PersonPaymentSummary) => void;
}) {
    const unionFeeTone =
        row.unionFeeStatus === '완납'
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            : row.unionFeeStatus === '일부납'
              ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
              : row.unionFeeStatus === '미납'
                ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                : 'border-white/10 bg-white/[0.04] text-slate-300';

    return (
        <tr className="align-top hover:bg-white/[0.02]">
            <td className="min-w-[150px] px-3 py-4">
                <div className="space-y-1.5">
                    <button
                        type="button"
                        onClick={() => onOpenMemberDetail(row)}
                        className="inline-flex text-left text-base font-black text-slate-100 transition-colors hover:text-sky-300"
                    >
                        {row.name}
                    </button>
                    <p className="text-[11px] text-slate-400">{row.phone || '연락처 미입력'}</p>
                </div>
            </td>
            <td className="min-w-[140px] px-3 py-4">
                <div className="flex flex-wrap gap-2">
                    {row.isRegistered && <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-200">등기</span>}
                    {row.tier && <span className="rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-black text-sky-200">{row.tier}</span>}
                    {row.status && (
                        <span
                            className={cn(
                                'rounded-full border px-2 py-0.5 text-[10px] font-black',
                                row.status === '정상' && 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
                                row.status === '탈퇴' && 'border-rose-400/20 bg-rose-500/10 text-rose-200',
                                row.status === '제명' && 'border-amber-400/20 bg-amber-500/10 text-amber-200',
                                !['정상', '탈퇴', '제명'].includes(row.status) && 'border-white/10 bg-white/[0.04] text-slate-300',
                            )}
                        >
                            {row.status}
                        </span>
                    )}
                    <PaymentStatusBadge status={row.paymentStatus} />
                </div>
            </td>
            <td className="min-w-[250px] px-4 py-4">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-bold text-white">{row.rightsFlowLabel}</span>
                        <span className="rounded-md border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[11px] font-bold text-violet-200">원천 {row.sourceCertificateCount}건</span>
                        {row.managedCertificateCount > 0 && <span className="rounded-md border border-sky-400/20 bg-sky-500/10 px-2 py-1 text-[11px] font-bold text-sky-200">관리 {row.managedCertificateCount}건</span>}
                    </div>
                    <p className="break-all text-[11px] text-slate-300">{row.certificateDisplay || '권리증번호 없음'}</p>
                    <div className="flex flex-wrap gap-1.5">
                        {row.unitTypeNames.length > 0 ? row.unitTypeNames.map((unitName) => (
                            <span key={unitName} className="rounded border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">{unitName}</span>
                        )) : (
                            <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-bold text-slate-400">평형 미지정</span>
                        )}
                    </div>
                </div>
            </td>
            <td className="min-w-[360px] px-4 py-4">
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                        <AmountCell label="출자금" value={formatAmount(row.totalInvestment)} tone="investment" />
                        <AmountCell label="총분담금" value={formatAmount(row.totalContributionDue)} tone="total" />
                        <AmountCell label="수납액" value={formatAmount(row.totalContributionPaid)} tone="paid" />
                        <AmountCell
                            label="미납액"
                            value={formatAmount(row.totalContributionUnpaid)}
                            tone={row.totalContributionUnpaid > 0 ? 'unpaid' : 'muted'}
                            helper={row.additionalBurden > 0 ? `추가부담 ${formatAmount(row.additionalBurden)}` : undefined}
                        />
                    </div>
                    <div className={cn('flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2', unionFeeTone)}>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-80">조합비(분담금 포함)</p>
                            <p className="mt-1 text-xs font-bold">
                                {row.unionFeeDue > 0 ? '필수 납부 항목' : '평형 배정 후 자동 생성'}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black">{row.unionFeeStatus}</p>
                            {row.unionFeeDue > 0 ? (
                                <p className="mt-1 text-[11px] font-semibold">
                                    {formatAmount(row.unionFeePaid)} / {formatAmount(row.unionFeeDue)}
                                </p>
                            ) : (
                                <p className="mt-1 text-[11px] font-semibold text-slate-300">수납선 미생성</p>
                            )}
                        </div>
                    </div>
                </div>
            </td>
            <td className="min-w-[180px] px-4 py-4">
                <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-200">{formatDate(row.latestPaidDate)}</p>
                    <p className="break-all text-[11px] text-slate-400">{row.accountNames.length > 0 ? row.accountNames.join(', ') : '입금 계좌 미기록'}</p>
                </div>
            </td>
            <td className="px-4 py-4 text-center">
                <span
                    className={cn(
                        'inline-flex rounded-full border px-2 py-1 text-xs font-semibold',
                        row.settlementTone === 'neutral' && 'border-white/10 bg-white/[0.04] text-slate-300',
                        row.settlementTone === 'warn' && 'border-amber-400/20 bg-amber-500/10 text-amber-200',
                        row.settlementTone === 'positive' && 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
                        row.settlementTone === 'danger' && 'border-rose-400/20 bg-rose-500/10 text-rose-200',
                    )}
                >
                    {row.settlementSummary}
                </span>
            </td>
            <td className="px-4 py-4 text-center">
                <button
                    type="button"
                    onClick={() => onOpenMemberDetail(row)}
                    className="inline-flex items-center justify-center rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-200 transition-colors hover:bg-sky-500/20"
                >
                    개인 상세
                </button>
            </td>
        </tr>
    );
}

export function AmountCell({
    label,
    value,
    tone,
    helper,
}: {
    label: string;
    value: string;
    tone: 'investment' | 'total' | 'paid' | 'unpaid' | 'muted';
    helper?: string;
}) {
    const toneClass =
        tone === 'investment'
            ? 'border-emerald-400/15 bg-emerald-500/10 text-emerald-200'
            : tone === 'total'
              ? 'border-sky-400/15 bg-sky-500/10 text-sky-100'
              : tone === 'paid'
                ? 'border-cyan-400/15 bg-cyan-500/10 text-cyan-200'
                : tone === 'unpaid'
                  ? 'border-rose-400/15 bg-rose-500/10 text-rose-200'
                  : 'border-white/10 bg-white/[0.03] text-slate-400';

    return (
        <div className={cn('rounded-xl border px-3 py-2.5', toneClass)}>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-80">{label}</p>
            <p className="mt-1 font-mono text-base font-black">{value}</p>
            {helper ? <p className="mt-1 text-[10px] font-bold opacity-80">{helper}</p> : <div className="mt-1 h-[14px]" />}
        </div>
    );
}

export function StatCard({
    title,
    value,
    icon,
    tone = 'default',
    hint,
}: {
    title: string;
    value: string;
    icon: string;
    tone?: 'default' | 'positive' | 'warn' | 'danger';
    hint?: string;
}) {
    const toneClass =
        tone === 'positive'
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            : tone === 'warn'
              ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
              : tone === 'danger'
                ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                : 'border-white/10 bg-white/[0.03] text-slate-100';

    return (
        <div className={`rounded-xl border p-4 ${toneClass}`}>
            <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide">{title}</p>
                <MaterialIcon name={icon} size="sm" className="opacity-80" />
            </div>
            <p className="mt-3 text-xl font-black">{value}</p>
            {hint && <p className="mt-1 text-[11px] opacity-75">{hint}</p>}
        </div>
    );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
    if (status === '수납완료') {
        return <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black text-emerald-200">수납완료</span>;
    }
    if (status === '부분납') {
        return <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black text-amber-200">부분납</span>;
    }
    if (status === '미설정') {
        return <span className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-black text-slate-300">미설정</span>;
    }
    return <span className="inline-flex rounded-full border border-rose-400/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-black text-rose-200">미납</span>;
}

export function QualityBadge({
    label,
    count,
    tone,
}: {
    label: string;
    count: number;
    tone: 'ok' | 'warn' | 'danger';
}) {
    const toneClass =
        tone === 'ok'
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            : tone === 'danger'
              ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
              : 'border-amber-400/20 bg-amber-500/10 text-amber-200';

    return (
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
            <span>{label}</span>
            <span className="font-black">{count.toLocaleString()}건</span>
        </div>
    );
}

export { formatAmount };
