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
                    { step: 2, step_name: '1차중도금', amount_due: 30000000, amount_paid: 30000000, paid_date: '2023-08-20', is_paid: true },
                    { step: 3, step_name: '2차중도금', amount_due: 50000000, amount_paid: 20000000, paid_date: null, is_paid: false },
                    { step: 4, step_name: '잔금', amount_due: 110000000, amount_paid: 0, paid_date: null, is_paid: false },
                ]);
            } else {
                const stepNames = ['계약금', '1차중도금', '2차중도금', '잔금'];
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
        if (payment.is_paid) return { label: '완료', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
        if (payment.amount_paid > 0) return { label: '분납', style: 'bg-orange-500/10 text-orange-400 border-orange-500/20' };
        return { label: '미납', style: 'bg-red-500/10 text-red-400 border-red-500/20' };
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
                    <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-[#233040] p-4 border border-white/5 shadow-sm">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 opacity-70">총 청구액</p>
                            <p className="text-base sm:text-lg font-black text-white tracking-tight">
                                ₩{totalDue.toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-lg bg-emerald-900/10 p-4 border border-emerald-500/10 shadow-sm">
                            <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-wider mb-1">납부액</p>
                            <p className="text-base sm:text-lg font-black text-emerald-400 tracking-tight">
                                ₩{totalPaid.toLocaleString()}
                            </p>
                        </div>
                        <div className="rounded-lg bg-red-900/10 p-4 border border-red-500/10 shadow-sm">
                            <p className="text-[10px] font-bold text-red-400/70 uppercase tracking-wider mb-1">미납액</p>
                            <p className="text-base sm:text-lg font-black text-red-500 tracking-tight">
                                ₩{totalUnpaid.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="rounded-lg bg-[#233040] p-4 border border-white/5 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-400">납부 진행률</span>
                            <span className="text-xs font-black text-white">{paymentRate}%</span>
                        </div>
                        <div className="w-full bg-[#0F151B] rounded-full h-1.5 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                                style={{ width: `${paymentRate}%` }}
                            />
                        </div>
                    </div>

                    {/* Payment Details Table */}
                    <div className="rounded-lg border border-white/5 overflow-hidden bg-[#233040] shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs whitespace-nowrap">
                                <thead className="bg-[#1A2633] border-b border-white/5">
                                    <tr>
                                        <th className="px-3 py-3 text-left font-bold text-gray-400">회차</th>
                                        <th className="px-3 py-3 text-right font-bold text-gray-400">청구액</th>
                                        <th className="px-3 py-3 text-right font-bold text-gray-400">수납액</th>
                                        <th className="px-3 py-3 text-right font-bold text-gray-400">미납액</th>
                                        <th className="px-3 py-3 text-center font-bold text-gray-400">납부일</th>
                                        <th className="px-3 py-3 text-center font-bold text-gray-400">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {payments.map((payment) => {
                                        const status = getStatus(payment);
                                        const unpaid = payment.amount_due - payment.amount_paid;

                                        return (
                                            <tr key={payment.step} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-3 py-2.5 font-bold text-gray-200">
                                                    {payment.step_name}
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-gray-400 font-medium">
                                                    {payment.amount_due.toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-bold text-gray-100">
                                                    {payment.amount_paid.toLocaleString()}
                                                </td>
                                                <td className={`px-3 py-2.5 text-right font-bold ${unpaid > 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                                    {unpaid > 0 ? unpaid.toLocaleString() : '-'}
                                                </td>
                                                <td className="px-3 py-2.5 text-center text-gray-500 font-medium">
                                                    {payment.paid_date || '-'}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[10px] font-bold border ${status.style} min-w-[32px]`}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Action Button */}
                    {totalUnpaid > 0 && (
                        <button className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]">
                            <MaterialIcon name="send" size="sm" />
                            <span className="text-sm">납부 요청 문자 발송</span>
                        </button>
                    )}
                </>
            )}
        </div>
    );
}
