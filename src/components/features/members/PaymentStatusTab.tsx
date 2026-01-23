'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';

interface PaymentRecord {
    step: number;
    step_name: string;
    amount_due: number;
    amount_paid: number;
    paid_date: string | null;
    is_paid: boolean;
}

interface PaymentStatusTabProps {
    memberId: string;
    memberName: string;
}

export function PaymentStatusTab({ memberId, memberName }: PaymentStatusTabProps) {
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);

    useEffect(() => {
        async function fetchPayments() {
            setLoading(true);
            const supabase = createClient();

            const { data } = await supabase
                .from('payments')
                .select('step, amount_due, amount_paid, paid_date, is_paid')
                .eq('member_id', memberId)
                .order('step', { ascending: true });

            // If no real data, use mock data for demo
            if (!data || data.length === 0) {
                setPayments([
                    { step: 1, step_name: '계약금', amount_due: 10000000, amount_paid: 10000000, paid_date: '2023-05-15', is_paid: true },
                    { step: 2, step_name: '1차 중도금', amount_due: 30000000, amount_paid: 30000000, paid_date: '2023-08-20', is_paid: true },
                    { step: 3, step_name: '2차 중도금', amount_due: 50000000, amount_paid: 20000000, paid_date: null, is_paid: false },
                    { step: 4, step_name: '잔금', amount_due: 110000000, amount_paid: 0, paid_date: null, is_paid: false },
                ]);
            } else {
                const stepNames = ['계약금', '1차 중도금', '2차 중도금', '잔금'];
                setPayments(data.map(p => ({
                    ...p,
                    step_name: stepNames[p.step - 1] || `${p.step}차`,
                })));
            }
            setLoading(false);
        }

        fetchPayments();
    }, [memberId]);

    // Calculate totals
    const totalDue = payments.reduce((sum, p) => sum + p.amount_due, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount_paid, 0);
    const totalUnpaid = totalDue - totalPaid;
    const paymentRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

    const getStatus = (payment: PaymentRecord) => {
        if (payment.is_paid) return { label: '수납완료', style: 'bg-success/10 text-success border-success/20' };
        if (payment.amount_paid > 0) return { label: '부분납', style: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200' };
        return { label: '미납', style: 'bg-destructive/10 text-destructive border-destructive/20' };
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center py-10">
                    <MaterialIcon name="progress_activity" className="animate-spin text-muted-foreground" size="lg" />
                </div>
            )}

            {!loading && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-lg bg-muted/50 p-4 border border-border">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">총 청구액</p>
                            <p className="text-lg font-bold text-foreground">
                                ₩{totalDue.toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-lg bg-success/5 p-4 border border-success/20">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">납부액</p>
                            <p className="text-lg font-bold text-success">
                                ₩{totalPaid.toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-lg bg-destructive/5 p-4 border border-destructive/20">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">미납액</p>
                            <p className="text-lg font-bold text-destructive">
                                ₩{totalUnpaid.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="rounded-lg bg-card p-4 border border-border">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-muted-foreground">납부 진행률</span>
                            <span className="text-sm font-bold text-foreground">{paymentRate}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                            <div
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${paymentRate}%` }}
                            />
                        </div>
                    </div>

                    {/* Payment Details Table */}
                    <div className="rounded-lg border border-border overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">회차</th>
                                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">청구액</th>
                                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">수납액</th>
                                    <th className="px-4 py-3 text-right font-semibold text-muted-foreground">미납액</th>
                                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">납부일</th>
                                    <th className="px-4 py-3 text-center font-semibold text-muted-foreground">상태</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {payments.map((payment) => {
                                    const status = getStatus(payment);
                                    const unpaid = payment.amount_due - payment.amount_paid;

                                    return (
                                        <tr key={payment.step} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-foreground">
                                                {payment.step_name}
                                            </td>
                                            <td className="px-4 py-3 text-right text-muted-foreground">
                                                {payment.amount_due.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium text-foreground">
                                                {payment.amount_paid.toLocaleString()}
                                            </td>
                                            <td className={`px-4 py-3 text-right font-bold ${unpaid > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                {unpaid > 0 ? unpaid.toLocaleString() : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center text-muted-foreground">
                                                {payment.paid_date || '-'}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${status.style}`}>
                                                    {status.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Action Button */}
                    {totalUnpaid > 0 && (
                        <button className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-primary text-white font-bold hover:bg-[#0f6bd0] transition-colors">
                            <MaterialIcon name="send" size="md" />
                            납부 요청 문자 발송
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
