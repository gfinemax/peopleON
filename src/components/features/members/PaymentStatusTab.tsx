'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────

interface UnitType {
    id: string;
    name: string;
    area_sqm: number;
    total_contribution: number;
    certificate_amount: number;
    contract_amount: number;
    installment_1_amount: number;
    installment_2_amount: number;
    balance_amount: number;
}

interface DepositAccount {
    id: string;
    account_name: string;
    bank_name: string | null;
    account_type: string;
    is_official: boolean;
}

interface PaymentRecord {
    id: string;
    entity_id: string;
    unit_type_id: string | null;
    payment_type: string;
    amount_due: number;
    amount_paid: number;
    deposit_account_id: string | null;
    paid_date: string | null;
    receipt_note: string | null;
    is_contribution: boolean;
    status: string;
    sort_order: number;
}

interface PaymentStatusTabProps {
    memberIds: string[];
    memberName: string;
    unitGroup?: string | null;
}

// ── Constants ───────────────────────────────────────────

const PAYMENT_TYPE_LABELS: Record<string, string> = {
    certificate: '출자금(필증)',
    premium: '프리미엄',
    premium_recognized: '프리미엄 인정분',
    contract: '계약금',
    installment_1: '1차 분담금',
    installment_2: '2차 분담금',
    balance: '잔금',
    other: '기타',
};

const PAYMENT_TYPE_ICONS: Record<string, string> = {
    certificate: 'receipt_long',
    premium: 'diamond',
    premium_recognized: 'verified',
    contract: 'edit_document',
    installment_1: 'looks_one',
    installment_2: 'looks_two',
    balance: 'account_balance',
    other: 'more_horiz',
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    union: '조합',
    trust: '신탁',
    external: '외부',
    recognized: '인정',
};

// ── Component ───────────────────────────────────────────

export function PaymentStatusTab({ memberIds, memberName, unitGroup }: PaymentStatusTabProps) {
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
    const [accounts, setAccounts] = useState<DepositAccount[]>([]);
    const [selectedUnitTypeId, setSelectedUnitTypeId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<PaymentRecord>>({});
    const [saving, setSaving] = useState(false);
    const [addingPremium, setAddingPremium] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();

        const [paymentsRes, unitTypesRes, accountsRes] = await Promise.all([
            supabase.from('member_payments').select('*').in('entity_id', memberIds).order('sort_order', { ascending: true }),
            supabase.from('unit_types').select('*').eq('is_active', true).order('area_sqm', { ascending: true }),
            supabase.from('deposit_accounts').select('*').eq('is_active', true).order('account_type', { ascending: true }),
        ]);

        setPayments(paymentsRes.data || []);
        setUnitTypes(unitTypesRes.data || []);
        setAccounts(accountsRes.data || []);

        // Determine selected unit type from existing payments
        const firstPayment = (paymentsRes.data || []).find(p => p.unit_type_id);
        if (firstPayment?.unit_type_id) {
            setSelectedUnitTypeId(firstPayment.unit_type_id);
        }

        setLoading(false);
    }, [memberIds]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // ── Unit Type Assignment ────────────────────────────

    const handleAssignUnitType = async (unitTypeId: string) => {
        setSaving(true);
        const supabase = createClient();
        const unitType = unitTypes.find(u => u.id === unitTypeId);
        if (!unitType) { setSaving(false); return; }

        // Delete existing structured payments
        await supabase
            .from('member_payments')
            .delete()
            .in('entity_id', memberIds)
            .in('payment_type', ['certificate', 'contract', 'installment_1', 'installment_2', 'balance']);

        // Generate new payment lines for each entity
        const lines: Omit<PaymentRecord, 'id'>[] = [];
        for (const entityId of memberIds) {
            lines.push(
                { entity_id: entityId, unit_type_id: unitTypeId, payment_type: 'certificate', amount_due: unitType.certificate_amount, amount_paid: 0, deposit_account_id: null, paid_date: null, receipt_note: null, is_contribution: true, status: 'pending', sort_order: 1 },
                { entity_id: entityId, unit_type_id: unitTypeId, payment_type: 'contract', amount_due: unitType.contract_amount, amount_paid: 0, deposit_account_id: null, paid_date: null, receipt_note: null, is_contribution: true, status: 'pending', sort_order: 3 },
                { entity_id: entityId, unit_type_id: unitTypeId, payment_type: 'installment_1', amount_due: unitType.installment_1_amount, amount_paid: 0, deposit_account_id: null, paid_date: null, receipt_note: null, is_contribution: true, status: 'pending', sort_order: 4 },
                { entity_id: entityId, unit_type_id: unitTypeId, payment_type: 'installment_2', amount_due: unitType.installment_2_amount, amount_paid: 0, deposit_account_id: null, paid_date: null, receipt_note: null, is_contribution: true, status: 'pending', sort_order: 5 },
                { entity_id: entityId, unit_type_id: unitTypeId, payment_type: 'balance', amount_due: unitType.balance_amount, amount_paid: 0, deposit_account_id: null, paid_date: null, receipt_note: null, is_contribution: true, status: 'pending', sort_order: 6 },
            );
        }

        await supabase.from('member_payments').insert(lines);
        setSelectedUnitTypeId(unitTypeId);
        await fetchAll();
        setSaving(false);
    };

    // ── Add Premium ─────────────────────────────────────

    const handleAddPremium = async (type: 'premium' | 'premium_recognized') => {
        setSaving(true);
        const supabase = createClient();
        const lines = memberIds.map(entityId => ({
            entity_id: entityId,
            unit_type_id: selectedUnitTypeId,
            payment_type: type,
            amount_due: 0,
            amount_paid: 0,
            deposit_account_id: null,
            paid_date: null,
            receipt_note: null,
            is_contribution: type === 'premium_recognized',
            status: 'pending' as const,
            sort_order: type === 'premium' ? 2 : 2,
        }));

        await supabase.from('member_payments').insert(lines);
        setAddingPremium(false);
        await fetchAll();
        setSaving(false);
    };

    // ── Inline Edit ─────────────────────────────────────

    const startEdit = (payment: PaymentRecord) => {
        setEditingId(payment.id);
        setEditForm({
            amount_paid: payment.amount_paid,
            deposit_account_id: payment.deposit_account_id,
            paid_date: payment.paid_date,
            receipt_note: payment.receipt_note,
        });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        setSaving(true);
        const supabase = createClient();

        const amountPaid = Number(editForm.amount_paid) || 0;
        const payment = payments.find(p => p.id === editingId);
        let status = 'pending';
        if (amountPaid > 0 && amountPaid >= (payment?.amount_due || 0)) status = 'paid';
        else if (amountPaid > 0) status = 'partial';

        await supabase.from('member_payments').update({
            amount_paid: amountPaid,
            deposit_account_id: editForm.deposit_account_id || null,
            paid_date: editForm.paid_date || null,
            receipt_note: editForm.receipt_note || null,
            status,
        }).eq('id', editingId);

        setEditingId(null);
        setEditForm({});
        await fetchAll();
        setSaving(false);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleDelete = async (id: string) => {
        if (!confirm('이 납부 항목을 삭제하시겠습니까?')) return;
        const supabase = createClient();
        await supabase.from('member_payments').delete().eq('id', id);
        await fetchAll();
    };

    // ── Calculations ────────────────────────────────────

    const contributionPayments = payments.filter(p => p.is_contribution && p.payment_type !== 'premium');
    const premiumPayments = payments.filter(p => p.payment_type === 'premium' || p.payment_type === 'premium_recognized');

    const totalContributionDue = contributionPayments.reduce((s, p) => s + Number(p.amount_due), 0);
    const totalContributionPaid = contributionPayments.reduce((s, p) => s + Number(p.amount_paid), 0);
    const totalContributionUnpaid = totalContributionDue - totalContributionPaid;
    const contributionRate = totalContributionDue > 0 ? Math.round((totalContributionPaid / totalContributionDue) * 100) : 0;

    const certificateAmount = payments.filter(p => p.payment_type === 'certificate').reduce((s, p) => s + Number(p.amount_paid), 0);
    const premiumRecognized = payments.filter(p => p.payment_type === 'premium_recognized').reduce((s, p) => s + Number(p.amount_paid), 0);
    const totalInvestment = certificateAmount + premiumRecognized;
    const pureAdditionalBurden = totalContributionDue - totalInvestment;

    const selectedUnitType = unitTypes.find(u => u.id === selectedUnitTypeId);

    // ── Status Badge ────────────────────────────────────

    const getStatusBadge = (status: string, payment: PaymentRecord) => {
        if (payment.payment_type === 'premium') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-violet-500/10 text-violet-400 border-violet-500/20">별도</span>;
        }
        if (payment.payment_type === 'premium_recognized') {
            return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">반영</span>;
        }
        switch (status) {
            case 'paid':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">완료</span>;
            case 'partial':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-orange-500/10 text-orange-400 border-orange-500/20">분납</span>;
            case 'overdue':
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-red-500/10 text-red-400 border-red-500/20">연체</span>;
            default:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border bg-slate-500/10 text-slate-400 border-slate-500/20">미납</span>;
        }
    };

    // ── Render ───────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <MaterialIcon name="progress_activity" className="animate-spin text-muted-foreground" size="lg" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">

            {/* 1. Unit Type Selector */}
            <div className="rounded-lg bg-[#233040] p-4 border border-white/5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                    <MaterialIcon name="straighten" className="text-sky-400 text-[20px]" />
                    <p className="text-xs font-bold text-gray-300">배정 평형</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    {unitTypes.map(ut => (
                        <button
                            key={ut.id}
                            onClick={() => handleAssignUnitType(ut.id)}
                            disabled={saving}
                            className={cn(
                                "px-4 py-2 rounded-lg border text-sm font-bold transition-all",
                                selectedUnitTypeId === ut.id
                                    ? "bg-sky-500/20 border-sky-400/40 text-sky-300 ring-1 ring-sky-500/30"
                                    : "bg-white/[0.03] border-white/[0.08] text-gray-400 hover:bg-white/[0.06] hover:text-gray-200"
                            )}
                        >
                            {ut.name}
                        </button>
                    ))}
                    {unitTypes.length === 0 && (
                        <p className="text-xs text-gray-500">평형 정보가 없습니다. 설정에서 추가해주세요.</p>
                    )}
                </div>
                {selectedUnitType && (
                    <p className="mt-2 text-[11px] text-gray-500">
                        총 분담금: <span className="text-gray-300 font-bold">₩{selectedUnitType.total_contribution.toLocaleString()}</span>
                    </p>
                )}
            </div>

            {/* 2. Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-[#233040] p-4 border border-white/5 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <MaterialIcon name="savings" className="text-[14px] text-emerald-500" />
                        출자금 (필증+인정분)
                    </p>
                    <p className="text-lg font-black text-emerald-400 tracking-tight">
                        ₩{totalInvestment.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                        필증 {certificateAmount.toLocaleString()} + 인정 {premiumRecognized.toLocaleString()}
                    </p>
                </div>
                <div className="rounded-lg bg-[#233040] p-4 border border-white/5 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <MaterialIcon name="account_balance_wallet" className="text-[14px] text-amber-500" />
                        추가 부담금
                    </p>
                    <p className={cn("text-lg font-black tracking-tight", pureAdditionalBurden > 0 ? "text-amber-400" : "text-gray-500")}>
                        ₩{Math.max(0, pureAdditionalBurden).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                        총분담금 - 출자금
                    </p>
                </div>
            </div>

            {/* 3. Progress Bar (contribution only) */}
            <div className="rounded-lg bg-[#233040] p-4 border border-white/5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">분담금 납부 진행률</span>
                        <span className="text-[10px] text-gray-500">(프리미엄 제외)</span>
                    </div>
                    <span className="text-xs font-black text-white">{contributionRate}%</span>
                </div>
                <div className="w-full bg-[#0F151B] rounded-full h-1.5 overflow-hidden">
                    <div
                        className="bg-gradient-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        style={{ width: `${contributionRate}%` }}
                    />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div>
                        <p className="text-[10px] text-gray-500">총 청구</p>
                        <p className="text-xs font-bold text-white">₩{totalContributionDue.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-emerald-500">수납</p>
                        <p className="text-xs font-bold text-emerald-400">₩{totalContributionPaid.toLocaleString()}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-red-500">미납</p>
                        <p className="text-xs font-bold text-red-400">₩{totalContributionUnpaid.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* 4. Payment Details Table */}
            <div className="rounded-lg border border-white/5 overflow-hidden bg-[#233040] shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs whitespace-nowrap">
                        <thead className="bg-[#1A2633] border-b border-white/5">
                            <tr>
                                <th className="px-3 py-3 text-left font-bold text-gray-400">항목</th>
                                <th className="px-3 py-3 text-right font-bold text-gray-400">청구액</th>
                                <th className="px-3 py-3 text-right font-bold text-gray-400">수납액</th>
                                <th className="px-3 py-3 text-center font-bold text-gray-400">계좌</th>
                                <th className="px-3 py-3 text-center font-bold text-gray-400">납부일</th>
                                <th className="px-3 py-3 text-center font-bold text-gray-400">상태</th>
                                <th className="px-3 py-3 text-center font-bold text-gray-400">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {payments.map((payment) => {
                                const unpaid = Number(payment.amount_due) - Number(payment.amount_paid);
                                const isEditing = editingId === payment.id;
                                const accountName = accounts.find(a => a.id === payment.deposit_account_id);
                                const isPremiumType = payment.payment_type === 'premium' || payment.payment_type === 'premium_recognized';

                                return (
                                    <tr key={payment.id} className={cn(
                                        "hover:bg-white/[0.02] transition-colors",
                                        isPremiumType && "bg-violet-500/[0.03]"
                                    )}>
                                        {/* Item Name */}
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <MaterialIcon
                                                    name={PAYMENT_TYPE_ICONS[payment.payment_type] || 'payments'}
                                                    className={cn("text-[16px]", isPremiumType ? "text-violet-400" : "text-gray-500")}
                                                />
                                                <div>
                                                    <span className="font-bold text-gray-200">
                                                        {PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type}
                                                    </span>
                                                    {!payment.is_contribution && (
                                                        <span className="ml-1.5 text-[9px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1 rounded">분담금제외</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        {/* Amount Due */}
                                        <td className="px-3 py-2.5 text-right text-gray-400 font-medium">
                                            {Number(payment.amount_due) > 0 ? Number(payment.amount_due).toLocaleString() : '―'}
                                        </td>
                                        {/* Amount Paid */}
                                        <td className="px-3 py-2.5 text-right">
                                            {isEditing ? (
                                                <input
                                                    type="number"
                                                    value={editForm.amount_paid || ''}
                                                    onChange={e => setEditForm(f => ({ ...f, amount_paid: Number(e.target.value) }))}
                                                    className="w-24 rounded bg-[#0F151B] border border-white/10 px-2 py-1 text-right text-white text-xs focus:border-blue-500 outline-none"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className={cn("font-bold", Number(payment.amount_paid) > 0 ? "text-gray-100" : "text-gray-600")}>
                                                    {Number(payment.amount_paid) > 0 ? Number(payment.amount_paid).toLocaleString() : '0'}
                                                </span>
                                            )}
                                        </td>
                                        {/* Account */}
                                        <td className="px-3 py-2.5 text-center">
                                            {isEditing ? (
                                                <select
                                                    value={editForm.deposit_account_id || ''}
                                                    onChange={e => setEditForm(f => ({ ...f, deposit_account_id: e.target.value || null }))}
                                                    className="rounded bg-[#0F151B] border border-white/10 px-1 py-1 text-[10px] text-white focus:border-blue-500 outline-none"
                                                >
                                                    <option value="">미지정</option>
                                                    {accounts.map(a => (
                                                        <option key={a.id} value={a.id}>
                                                            {a.account_name} ({ACCOUNT_TYPE_LABELS[a.account_type] || a.account_type})
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                accountName ? (
                                                    <span className={cn(
                                                        "text-[10px] px-1.5 py-0.5 rounded border",
                                                        accountName.account_type === 'union' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                                            accountName.account_type === 'trust' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                                "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                    )}>
                                                        {accountName.account_name}
                                                    </span>
                                                ) : <span className="text-gray-600">―</span>
                                            )}
                                        </td>
                                        {/* Paid Date */}
                                        <td className="px-3 py-2.5 text-center">
                                            {isEditing ? (
                                                <input
                                                    type="date"
                                                    value={editForm.paid_date || ''}
                                                    onChange={e => setEditForm(f => ({ ...f, paid_date: e.target.value || null }))}
                                                    className="rounded bg-[#0F151B] border border-white/10 px-1 py-1 text-[10px] text-white focus:border-blue-500 outline-none"
                                                />
                                            ) : (
                                                <span className="text-gray-500 font-medium">{payment.paid_date || '―'}</span>
                                            )}
                                        </td>
                                        {/* Status */}
                                        <td className="px-3 py-2.5 text-center">
                                            {getStatusBadge(payment.status, payment)}
                                        </td>
                                        {/* Actions */}
                                        <td className="px-3 py-2.5 text-center">
                                            {isEditing ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={saveEdit}
                                                        disabled={saving}
                                                        className="p-1 rounded hover:bg-emerald-500/10 text-emerald-400 transition-colors"
                                                    >
                                                        <MaterialIcon name="check" size="sm" />
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="p-1 rounded hover:bg-red-500/10 text-red-400 transition-colors"
                                                    >
                                                        <MaterialIcon name="close" size="sm" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-1">
                                                    <button
                                                        onClick={() => startEdit(payment)}
                                                        className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-blue-400 transition-colors"
                                                    >
                                                        <MaterialIcon name="edit" size="sm" />
                                                    </button>
                                                    {isPremiumType && (
                                                        <button
                                                            onClick={() => handleDelete(payment.id)}
                                                            className="p-1 rounded hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors"
                                                        >
                                                            <MaterialIcon name="delete_outline" size="sm" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {payments.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500 text-sm">
                                        배정 평형을 선택하면 납부 항목이 자동 생성됩니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 5. Add Premium Button */}
            {payments.length > 0 && (
                <div className="flex gap-2">
                    {!addingPremium ? (
                        <button
                            onClick={() => setAddingPremium(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-500/20 bg-violet-500/5 text-violet-400 text-xs font-bold hover:bg-violet-500/10 transition-colors"
                        >
                            <MaterialIcon name="add" size="sm" />
                            프리미엄 항목 추가
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleAddPremium('premium')}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-300 text-xs font-bold hover:bg-violet-500/20 transition-colors"
                            >
                                <MaterialIcon name="diamond" size="sm" />
                                프리미엄 (분담금 제외)
                            </button>
                            <button
                                onClick={() => handleAddPremium('premium_recognized')}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 text-xs font-bold hover:bg-cyan-500/20 transition-colors"
                            >
                                <MaterialIcon name="verified" size="sm" />
                                프리미엄 인정분 (출자금 반영)
                            </button>
                            <button
                                onClick={() => setAddingPremium(false)}
                                className="px-2 py-2 rounded-lg text-gray-500 text-xs hover:text-gray-300 transition-colors"
                            >
                                취소
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* 6. Action Button */}
            {totalContributionUnpaid > 0 && (
                <button className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]">
                    <MaterialIcon name="send" size="sm" />
                    <span className="text-sm">납부 요청 문자 발송</span>
                </button>
            )}
        </div>
    );
}
