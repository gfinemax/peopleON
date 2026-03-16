import { MaterialIcon } from '@/components/ui/icon';
import type { SettlementChecklistItem, SettlementDiagnostic } from '@/lib/server/settlementDashboard';

const formatAmount = (value: number) => `₩${Math.round(value).toLocaleString('ko-KR')}`;

export function MiniStat({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: string;
    tone?: 'default' | 'warn';
}) {
    return (
        <div className={`rounded-lg border p-3 ${tone === 'warn' ? 'border-amber-400/20 bg-amber-500/10' : 'border-white/10 bg-[#101725]'}`}>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
            <p className={`mt-1 text-sm font-black ${tone === 'warn' ? 'text-amber-200' : 'text-slate-100'}`}>{value}</p>
        </div>
    );
}

export function SettlementAmountCell({
    expected,
    paid,
    remaining,
}: {
    expected: number;
    paid: number;
    remaining: number;
}) {
    return (
        <div className="grid min-w-[320px] grid-cols-3 gap-2">
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                <p className="text-[10px] font-bold text-slate-400">환불 예정</p>
                <p className="mt-1 font-mono text-sm font-black text-slate-100">{formatAmount(expected)}</p>
            </div>
            <div className="rounded-lg border border-emerald-400/15 bg-emerald-500/[0.06] px-3 py-2">
                <p className="text-[10px] font-bold text-emerald-200/80">지급 완료</p>
                <p className="mt-1 font-mono text-sm font-black text-emerald-300">{formatAmount(paid)}</p>
            </div>
            <div className="rounded-lg border border-amber-400/15 bg-amber-500/[0.06] px-3 py-2">
                <p className="text-[10px] font-bold text-amber-200/80">남은 환불액</p>
                <p className="mt-1 font-mono text-sm font-black text-amber-200">{formatAmount(remaining)}</p>
            </div>
        </div>
    );
}

export function DiagnosticStat({
    label,
    value,
    level,
    message,
}: SettlementDiagnostic) {
    const toneClass =
        level === 'ok'
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            : level === 'danger'
              ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
              : 'border-amber-400/20 bg-amber-500/10 text-amber-200';

    return (
        <div className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-300">{label}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${toneClass}`}>
                    {value.toLocaleString()}건
                </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">{message}</p>
        </div>
    );
}

export function ChecklistItem({
    label,
    detail,
    status,
}: SettlementChecklistItem) {
    const style =
        status === 'pass'
            ? { box: 'border-emerald-400/20 bg-emerald-500/10', text: 'text-emerald-200', icon: 'check_circle', label: '정상' }
            : status === 'warn'
              ? { box: 'border-amber-400/20 bg-amber-500/10', text: 'text-amber-200', icon: 'error', label: '주의' }
              : { box: 'border-rose-400/20 bg-rose-500/10', text: 'text-rose-200', icon: 'cancel', label: '점검필요' };

    return (
        <div className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-200">{label}</p>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.box} ${style.text}`}>
                    <MaterialIcon name={style.icon} size="xs" />
                    {style.label}
                </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">{detail}</p>
        </div>
    );
}

export { formatAmount };
