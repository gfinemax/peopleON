'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export interface FinanceSummary {
    totalAmount: number;
    paidAmount: number;
    overdueAmount: number;
    progress: number;
    remainingAmount: number;
}

export interface FinanceRound {
    round: number;
    amount: number; // Total Expected
    collected: number; // Total Paid
    count: number; // Count of records
    status: 'completed' | 'pending' | 'overdue';
    dueDate?: string;
}

interface MobileFinanceViewProps {
    summary: FinanceSummary;
    rounds: FinanceRound[];
}

export function MobileFinanceView({ summary, rounds }: MobileFinanceViewProps) {
    const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

    const filteredPayments = rounds.filter(p => {
        if (filter === 'all') return true;
        if (filter === 'completed') return p.status === 'completed';
        if (filter === 'pending') return p.status === 'pending' || p.status === 'overdue';
        return true;
    });

    return (
        <div className="flex flex-col min-h-screen bg-background pb-24">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm transition-colors border-b border-border/40 pt-[calc(env(safe-area-inset-top)+5px)]">
                <div className="flex items-center px-4 pb-3 pt-2 justify-between h-auto min-h-12">
                    <button className="flex items-center justify-center size-10 rounded-full hover:bg-muted/10 transition-colors">
                        <MaterialIcon name="arrow_back_ios_new" size="sm" />
                    </button>
                    <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center">자금 관리 현황</h2>
                    <button className="flex items-center justify-center size-10 rounded-full hover:bg-muted/10 transition-colors">
                        <MaterialIcon name="filter_list" size="sm" />
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col gap-6 p-4 w-full max-w-md mx-auto">
                {/* Summary Section */}
                <section className="flex flex-col gap-4">
                    {/* Gradient Card */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-lg shadow-blue-500/20">
                        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
                        <div className="relative z-10 flex flex-col gap-1">
                            <div className="flex items-center gap-2 opacity-90">
                                <MaterialIcon name="account_balance_wallet" size="sm" className="text-white" />
                                <p className="text-sm font-medium text-white">총 계약 금액</p>
                            </div>
                            <h1 className="text-3xl font-black tracking-tight mb-2">
                                {(summary.totalAmount / 100000000).toFixed(1)}억원
                            </h1>
                            <div className="mt-4 flex flex-col gap-2">
                                <div className="flex justify-between text-xs font-medium opacity-90 text-white">
                                    <span>진행률 ({summary.progress}%)</span>
                                    <span>잔금 {(summary.remainingAmount / 100000000).toFixed(1)}억원</span>
                                </div>
                                <div className="h-2 w-full overflow-hidden rounded-full bg-black/20">
                                    <div
                                        className="h-full bg-white rounded-full transition-all duration-1000"
                                        style={{ width: `${summary.progress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-sm border border-border/50">
                            <div className="flex items-center gap-2">
                                <div className="flex size-8 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                                    <MaterialIcon name="check_circle" size="xs" />
                                </div>
                                <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">완납</p>
                            </div>
                            <p className="text-xl font-black text-foreground">{(summary.paidAmount / 100000000).toFixed(1)}억원</p>
                        </div>
                        <div className="flex flex-col gap-2 rounded-xl bg-card p-4 shadow-sm border border-border/50">
                            <div className="flex items-center gap-2">
                                <div className="flex size-8 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                                    <MaterialIcon name="warning" size="xs" />
                                </div>
                                <p className="text-muted-foreground text-xs font-bold uppercase tracking-wider">미납</p>
                            </div>
                            <p className="text-xl font-black text-foreground">{(summary.overdueAmount / 100000000).toFixed(1)}억원</p>
                            <p className="text-[10px] text-red-500 font-bold">전체 대비 {((summary.overdueAmount / summary.totalAmount) * 100).toFixed(1)}%</p>
                        </div>
                    </div>
                </section>

                {/* Filter Segment */}
                <section>
                    <div className="flex w-full rounded-xl bg-muted p-1 gap-1">
                        {[
                            { value: 'all', label: '전체' },
                            { value: 'pending', label: '미납' },
                            { value: 'completed', label: '완납' },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => setFilter(opt.value as any)}
                                className={cn(
                                    "flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-medium transition-all active:scale-95",
                                    filter === opt.value
                                        ? "bg-background text-foreground shadow-sm font-bold"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Payment List */}
                <section className="flex flex-col gap-3 pb-8">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">회차별 납부 현황</h3>

                    {filteredPayments.map((p) => {
                        const isCompleted = p.status === 'completed';
                        const isOverdue = p.status === 'overdue';
                        const percent = Math.round((p.collected / p.amount) * 100);

                        return (
                            <div
                                key={p.round}
                                className={cn(
                                    "group flex items-center justify-between gap-4 rounded-xl bg-card p-4 shadow-sm border transition-all",
                                    isOverdue ? "border-red-500/30" : "border-border/50"
                                )}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "flex size-12 shrink-0 items-center justify-center rounded-full font-black text-lg",
                                        isOverdue ? "bg-red-500/10 text-red-500" : "bg-muted/50 text-muted-foreground"
                                    )}>
                                        {String(p.round).padStart(2, '0')}
                                    </div>
                                    <div className="flex flex-col items-start gap-0.5">
                                        <p className="text-base font-black text-foreground">{p.round}회차</p>
                                        <p className={cn("text-xs font-medium", isOverdue ? "text-red-500" : "text-muted-foreground")}>
                                            수납률 {percent}% ({p.count}건)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1.5">
                                    <span className="text-base font-black text-foreground">{(p.collected / 100000000).toFixed(1)}억원</span>
                                    {isCompleted ? (
                                        <div className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-green-600 dark:text-green-400">
                                            <MaterialIcon name="check_circle" size="xs" />
                                            <span className="text-[10px] font-bold">완료</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                                            <MaterialIcon name="schedule" size="xs" />
                                            <span className="text-[10px] font-bold">진행중</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </section>
            </main>
        </div>
    );
}
