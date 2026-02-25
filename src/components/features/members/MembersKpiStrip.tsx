import { MaterialIcon } from '@/components/ui/icon';

type Tone = 'default' | 'positive' | 'warn' | 'danger';

interface MembersKpiItem {
    label: string;
    value: string;
    icon: string;
    tone?: Tone;
    hint?: string;
}

interface MembersKpiStripProps {
    items: MembersKpiItem[];
}

function toneClass(tone: Tone) {
    if (tone === 'positive') return 'text-emerald-200 border-emerald-400/20 bg-emerald-500/10';
    if (tone === 'warn') return 'text-amber-200 border-amber-400/20 bg-amber-500/10';
    if (tone === 'danger') return 'text-rose-200 border-rose-400/20 bg-rose-500/10';
    return 'text-slate-100 border-white/10 bg-white/[0.03]';
}

export function MembersKpiStrip({ items }: MembersKpiStripProps) {
    return (
        <section className="rounded-2xl border border-white/10 bg-[#0f1725] p-3 lg:p-4">
            <div className="grid gap-2 sm:grid-cols-3">
                {items.map((item) => (
                    <div
                        key={item.label}
                        className={`rounded-xl border px-3 py-3 ${toneClass(item.tone || 'default')}`}
                    >
                        <div className="flex items-center gap-2">
                            <MaterialIcon name={item.icon} size="sm" className="opacity-80" />
                            <p className="text-[11px] font-semibold tracking-wide">{item.label}</p>
                        </div>
                        <p className="mt-2 text-lg font-black tracking-tight">{item.value}</p>
                        {item.hint && (
                            <p className="mt-1 text-[10px] opacity-75">{item.hint}</p>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
