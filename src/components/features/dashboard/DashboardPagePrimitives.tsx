import Link from 'next/link';

import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

type KpiCardProps = {
    title: string;
    icon: string;
    value: string;
    unit?: string;
    trend?: string;
    trendIcon?: string;
    subtitle: string;
    iconColor: string;
    iconBg: string;
};

type DuplicateConflictMember = {
    id: string;
    member_number: string;
    tier: string;
    phone: string;
    href?: string;
};

type ActionRequiredRowProps = {
    name: string;
    memberId: string;
    tier: string;
    status: string;
    statusColor: string;
    amount: string;
    actionLabel: string;
    isPrimaryAction: boolean;
    href?: string;
};

type ActivityItemProps = {
    icon: string;
    iconColor: string;
    iconBg: string;
    title: string;
    desc: string;
    time: string;
    isLast: boolean;
};

type PaymentProgressRowProps = {
    label: string;
    rate: number;
    subtitle?: string;
};

type RetentionStats = {
    registeredActive: number;
    unregisteredActive: number;
    registeredWithdrawn: number;
    unregisteredWithdrawn: number;
    totalHistorical: number;
};

export function KpiCard({ title, icon, value, unit, trend, trendIcon, subtitle, iconColor, iconBg }: KpiCardProps) {
    return (
        <div className="group flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm hover:shadow-xl hover:border-border/80 transition-all duration-300">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg border transition-colors", iconBg, iconColor, "border-current/20")}>
                        <MaterialIcon name={icon} size="sm" />
                    </div>
                    <h3 className="text-sm font-bold text-muted-foreground">{title}</h3>
                </div>
                {trend && trendIcon ? (
                    <span className="flex items-center rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-black text-success border border-success/20">
                        <MaterialIcon name={trendIcon} size="xs" className="mr-1" /> {trend}
                    </span>
                ) : null}
            </div>
            <div className="flex items-baseline gap-2 mb-1">
                <p className="text-3xl font-black text-foreground tracking-tighter">{value}</p>
                {unit ? <span className="text-base font-bold text-muted-foreground">{unit}</span> : null}
            </div>
            <p className="text-[10px] font-bold text-muted-foreground/60">{subtitle}</p>
        </div>
    );
}

export function DuplicateConflictRow({ member }: { member: DuplicateConflictMember }) {
    return (
        <tr className="group hover:bg-muted/10 transition-colors">
            <td colSpan={5} className="p-3">
                <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/5 p-4 shadow-sm animate-pulse-slow">
                    <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-500">
                            <MaterialIcon name="warning" size="md" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 mb-1 cursor-default">
                                <span className="font-extrabold text-red-500 text-sm">권리증 충돌 오류</span>
                                <span className="text-[10px] font-bold text-red-500/70 tracking-wider font-mono bg-red-500/10 px-2 py-0.5 rounded-full">{member.member_number}</span>
                                <span className="text-[10px] font-black text-red-500 border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded uppercase tracking-wider">{member.tier}</span>
                            </div>
                            <p className="text-xs font-bold text-muted-foreground">
                                해당 권리증 번호를 <strong className="text-foreground">{member.phone}</strong> 님이 중복해서 소유하고 있습니다.
                            </p>
                        </div>
                    </div>
                    {member.href ? (
                        <Link href={member.href} className="shrink-0 inline-block rounded-lg px-4 py-2 text-xs font-black bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm shadow-red-500/20">
                            상세 보기
                        </Link>
                    ) : (
                        <button className="shrink-0 inline-block rounded-lg px-4 py-2 text-xs font-black bg-red-500 text-white hover:bg-red-600 transition-colors shadow-sm shadow-red-500/20">
                            상세 보기
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}

export function ActionRequiredRow({
    name,
    memberId,
    tier,
    status,
    statusColor,
    amount,
    actionLabel,
    isPrimaryAction,
    href,
}: ActionRequiredRowProps) {
    return (
        <tr className="group hover:bg-muted/10 transition-colors">
            <td className="pl-6 pr-4 py-3">
                <div className="flex flex-col">
                    <span className="font-extrabold text-foreground text-sm">{name}</span>
                    <span className="text-[10px] font-bold text-muted-foreground/60 tracking-wider font-mono mt-0.5">{memberId}</span>
                </div>
            </td>
            <td className="px-4 py-3">
                <span className={cn(
                    "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-black border uppercase tracking-wider",
                    tier === '1차' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                        tier === '지주' ? "bg-purple-500/10 text-purple-500 border-purple-500/20" :
                            "bg-success/10 text-success border-success/20"
                )}>
                    {tier}
                </span>
            </td>
            <td className="px-4 py-3">
                <span className={cn(
                    "inline-flex items-center rounded px-2 py-0.5 text-[10px] font-black border uppercase tracking-wider",
                    statusColor
                )}>
                    {status}
                </span>
            </td>
            <td className="px-4 py-3 text-right font-black text-foreground text-sm">
                {amount}
            </td>
            <td className="pl-4 pr-6 py-3 text-center">
                {href ? (
                    <Link href={href} className={cn(
                        "inline-block rounded-lg px-4 py-1.5 text-[10px] font-black transition-all shadow-sm",
                        isPrimaryAction
                            ? "bg-primary text-white hover:bg-primary-hover shadow-primary/20"
                            : "border border-border bg-card text-foreground hover:bg-muted/10"
                    )}>
                        {actionLabel}
                    </Link>
                ) : (
                    <button className={cn(
                        "rounded-lg px-4 py-1.5 text-[10px] font-black transition-all shadow-sm",
                        isPrimaryAction
                            ? "bg-primary text-white hover:bg-primary-hover shadow-primary/20"
                            : "border border-border bg-card text-foreground hover:bg-muted/10"
                    )}>
                        {actionLabel}
                    </button>
                )}
            </td>
        </tr>
    );
}

export function ActivityItem({ icon, iconColor, iconBg, title, desc, time, isLast }: ActivityItemProps) {
    return (
        <div className="relative flex gap-4">
            {!isLast && <div className="absolute left-[17px] top-8 bottom-0 w-px bg-border/30" />}
            <div className="flex flex-col items-center flex-shrink-0">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border border-border/50 z-10 shadow-sm", iconBg, iconColor)}>
                    <MaterialIcon name={icon} size="sm" filled />
                </div>
            </div>
            <div className={cn("flex flex-col gap-0.5 pt-0.5", !isLast ? "pb-8" : "")}>
                <h4 className="text-xs font-black text-foreground">{title}</h4>
                <p className="text-[12px] font-bold text-muted-foreground leading-snug">{desc}</p>
                <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest mt-1">{time}</span>
            </div>
        </div>
    );
}

export function PaymentProgressRow({ label, rate, subtitle }: PaymentProgressRowProps) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">{label}</span>
                    {subtitle && <span className="text-[10px] text-muted-foreground/60">{subtitle}</span>}
                </div>
                <span className="text-xs font-extrabold text-foreground">{rate}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10 dark:bg-white/10 shadow-inner">
                <div
                    className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        rate >= 90 ? "bg-success" : rate >= 50 ? "bg-yellow-500" : "bg-blue-500"
                    )}
                    style={{ width: `${rate}%` }}
                />
            </div>
        </div>
    );
}

export function RetentionWidget({ retention }: { retention: RetentionStats }) {
    const { registeredActive, unregisteredActive, registeredWithdrawn, unregisteredWithdrawn, totalHistorical } = retention;
    const calcPct = (val: number) => totalHistorical > 0 ? Math.round((val / totalHistorical) * 100) : 0;
    const pRegAct = calcPct(registeredActive);
    const pUnregAct = calcPct(unregisteredActive);
    const pRegWd = calcPct(registeredWithdrawn);
    const pUnregWd = calcPct(unregisteredWithdrawn);

    return (
        <div className="group flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm hover:shadow-xl hover:border-border/80 transition-all duration-300">
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500 border border-orange-500/20">
                        <MaterialIcon name="filter_alt" size="sm" />
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-sm font-bold text-muted-foreground">조합원 유지율 퍼널</h3>
                        <p className="text-[10px] font-bold text-muted-foreground/60 mt-0.5">누적 등록자 {totalHistorical.toLocaleString()}명 기준</p>
                    </div>
                </div>
                <span className="flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-black text-orange-500 border border-orange-500/20">
                    전체 흐름
                </span>
            </div>

            <div className="flex flex-col gap-3 mt-1 flex-1 justify-center">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted/50">
                    {pRegAct > 0 && <div style={{ width: `${pRegAct}%` }} className="bg-emerald-500 transition-all duration-500" title={`유지 (등기): ${registeredActive}명`} />}
                    {pUnregAct > 0 && <div style={{ width: `${pUnregAct}%` }} className="bg-emerald-400/60 transition-all duration-500" title={`유지 (미등기): ${unregisteredActive}명`} />}
                    {pRegWd > 0 && <div style={{ width: `${pRegWd}%` }} className="bg-rose-400 transition-all duration-500" title={`이탈 (등기 후): ${registeredWithdrawn}명`} />}
                    {pUnregWd > 0 && <div style={{ width: `${pUnregWd}%` }} className="bg-rose-500/50 transition-all duration-500" title={`이탈 (미등기): ${unregisteredWithdrawn}명`} />}
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-3 mt-2">
                    <div className="flex flex-col p-2 rounded bg-emerald-500/5 border border-emerald-500/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-[10px] font-bold text-muted-foreground">유지 (등기완료)</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-foreground">{registeredActive.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground">명</span>
                            <span className="text-[10px] font-bold text-emerald-500 ml-auto">{pRegAct}%</span>
                        </div>
                    </div>

                    <div className="flex flex-col p-2 rounded bg-emerald-400/5 border border-emerald-400/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-400/60"></div>
                            <span className="text-[10px] font-bold text-muted-foreground">유지 (미등기/기타)</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-foreground">{unregisteredActive.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground">명</span>
                            <span className="text-[10px] font-bold text-emerald-500/70 ml-auto">{pUnregAct}%</span>
                        </div>
                    </div>

                    <div className="flex flex-col p-2 rounded bg-rose-400/5 border border-rose-400/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                            <span className="text-[10px] font-bold text-muted-foreground">이탈 (등기 후)</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-foreground">{registeredWithdrawn.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground">명</span>
                            <span className="text-[10px] font-bold text-rose-500 ml-auto">{pRegWd}%</span>
                        </div>
                    </div>

                    <div className="flex flex-col p-2 rounded bg-rose-500/5 border border-rose-500/10">
                        <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-rose-500/50"></div>
                            <span className="text-[10px] font-bold text-muted-foreground">이탈 (미등기)</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-black text-foreground">{unregisteredWithdrawn.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground">명</span>
                            <span className="text-[10px] font-bold text-rose-500/70 ml-auto">{pUnregWd}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
