'use client';

import { ReactNode } from 'react';
import { useDashboard } from './DashboardManager';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/icon';

interface LinkedOperationPanelProps {
    totalRemainingRefund: number;
    totalExpectedRefund: number;
    totalPaidRefund: number;
    topRemaining: Array<{
        id: string;
        name: string;
        tier: string | null;
        settlement_remaining: number;
    }>;
}

const formatAmount = (value: number) => `₩${Math.round(value).toLocaleString('ko-KR')}`;

export function LinkedOperationPanel({
    totalRemainingRefund,
    totalExpectedRefund,
    totalPaidRefund,
    topRemaining,
}: LinkedOperationPanelProps) {
    const { isCollapsed } = useDashboard();

    if (isCollapsed) return null;

    return (
        <aside className="hidden xl:flex xl:w-[310px] shrink-0 flex-col gap-3 transition-all">
            <div className="rounded-xl border border-white/[0.08] bg-[#101725] p-4">
                <h3 className="text-sm font-extrabold text-foreground mb-3">운영 패널</h3>
                <div className="space-y-2.5">
                    <div className="rounded-lg border border-[#28466c] bg-[#10233b] px-3 py-2">
                        <p className="text-[10px] text-slate-300 uppercase tracking-wider">잔여 환불액</p>
                        <p className="mt-1 text-sm font-bold text-white">{formatAmount(totalRemainingRefund)}</p>
                    </div>
                    <div className="rounded-lg border border-[#3f5a32] bg-[#1a2a16] px-3 py-2">
                        <p className="text-[10px] text-emerald-200 uppercase tracking-wider">지급 완료율</p>
                        <p className="mt-1 text-sm font-bold text-emerald-100">
                            {totalExpectedRefund > 0 ? `${Math.round((totalPaidRefund / totalExpectedRefund) * 100)}%` : '0%'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#101725] p-4">
                <h3 className="text-sm font-extrabold text-foreground mb-3">잔여 환불 상위</h3>
                <div className="space-y-2">
                    {topRemaining.map(p => (
                        <div key={p.id} className="rounded-lg border border-white/[0.06] bg-[#0b1220] px-3 py-2">
                            <p className="text-xs font-bold text-white truncate">{p.name}</p>
                            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
                                <span>{p.tier || '미분류'}</span>
                                <span className="font-mono">{formatAmount(p.settlement_remaining)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}
