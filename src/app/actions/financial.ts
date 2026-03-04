'use server';

import { createClient } from '@/lib/supabase/server';

// ── Unit Types ──────────────────────────────────────────

export interface UnitType {
    id: string;
    name: string;
    area_sqm: number;
    total_contribution: number;
    certificate_amount: number;
    contract_amount: number;
    installment_1_amount: number;
    installment_2_amount: number;
    balance_amount: number;
    is_active: boolean;
}

export async function getUnitTypes(): Promise<UnitType[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('unit_types')
        .select('*')
        .eq('is_active', true)
        .order('area_sqm', { ascending: true });

    if (error) {
        console.error('getUnitTypes error:', error);
        return [];
    }
    return data || [];
}

export async function upsertUnitType(unitType: Partial<UnitType> & { name: string; area_sqm: number }) {
    const supabase = await createClient();

    const payload = {
        name: unitType.name,
        area_sqm: unitType.area_sqm,
        total_contribution: unitType.total_contribution || 0,
        certificate_amount: unitType.certificate_amount || 0,
        contract_amount: unitType.contract_amount || 0,
        installment_1_amount: unitType.installment_1_amount || 0,
        installment_2_amount: unitType.installment_2_amount || 0,
        balance_amount: unitType.balance_amount || 0,
        is_active: unitType.is_active ?? true,
    };

    if (unitType.id) {
        const { error } = await supabase.from('unit_types').update(payload).eq('id', unitType.id);
        if (error) throw new Error(error.message);
    } else {
        const { error } = await supabase.from('unit_types').insert(payload);
        if (error) throw new Error(error.message);
    }
}

export async function deleteUnitType(id: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('unit_types').update({ is_active: false }).eq('id', id);
    if (error) throw new Error(error.message);
}

// ── Deposit Accounts ────────────────────────────────────

export interface DepositAccount {
    id: string;
    account_name: string;
    bank_name: string | null;
    account_number: string | null;
    account_type: 'union' | 'trust' | 'external' | 'recognized';
    is_official: boolean;
    is_active: boolean;
}

export async function getDepositAccounts(): Promise<DepositAccount[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('deposit_accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_type', { ascending: true });

    if (error) {
        console.error('getDepositAccounts error:', error);
        return [];
    }
    return data || [];
}

export async function upsertDepositAccount(account: Partial<DepositAccount> & { account_name: string }) {
    const supabase = await createClient();

    const payload = {
        account_name: account.account_name,
        bank_name: account.bank_name || null,
        account_number: account.account_number || null,
        account_type: account.account_type || 'union',
        is_official: account.is_official ?? false,
        is_active: account.is_active ?? true,
    };

    if (account.id) {
        const { error } = await supabase.from('deposit_accounts').update(payload).eq('id', account.id);
        if (error) throw new Error(error.message);
    } else {
        const { error } = await supabase.from('deposit_accounts').insert(payload);
        if (error) throw new Error(error.message);
    }
}

export async function deleteDepositAccount(id: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('deposit_accounts').update({ is_active: false }).eq('id', id);
    if (error) throw new Error(error.message);
}

// ── Member Payments ─────────────────────────────────────

export interface MemberPayment {
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

export async function getMemberPayments(entityIds: string[]): Promise<MemberPayment[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from('member_payments')
        .select('*')
        .in('entity_id', entityIds)
        .order('sort_order', { ascending: true });

    if (error) {
        console.error('getMemberPayments error:', error);
        return [];
    }
    return data || [];
}

export async function upsertMemberPayment(payment: Partial<MemberPayment> & { entity_id: string; payment_type: string }) {
    const supabase = await createClient();

    const payload = {
        entity_id: payment.entity_id,
        unit_type_id: payment.unit_type_id || null,
        payment_type: payment.payment_type,
        amount_due: payment.amount_due || 0,
        amount_paid: payment.amount_paid || 0,
        deposit_account_id: payment.deposit_account_id || null,
        paid_date: payment.paid_date || null,
        receipt_note: payment.receipt_note || null,
        is_contribution: payment.is_contribution ?? true,
        status: payment.status || 'pending',
        sort_order: payment.sort_order || 0,
    };

    if (payment.id) {
        const { error } = await supabase.from('member_payments').update(payload).eq('id', payment.id);
        if (error) throw new Error(error.message);
    } else {
        const { error } = await supabase.from('member_payments').insert(payload);
        if (error) throw new Error(error.message);
    }
}

export async function deleteMemberPayment(id: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('member_payments').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

/**
 * Assign a unit type to a member and auto-generate payment schedule
 */
export async function assignUnitTypeToMember(entityId: string, unitTypeId: string) {
    const supabase = await createClient();

    // 1. Get unit type details
    const { data: unitType, error: utErr } = await supabase
        .from('unit_types')
        .select('*')
        .eq('id', unitTypeId)
        .single();

    if (utErr || !unitType) throw new Error('평형 정보를 찾을 수 없습니다.');

    // 2. Delete existing auto-generated payments for this entity
    await supabase
        .from('member_payments')
        .delete()
        .eq('entity_id', entityId)
        .in('payment_type', ['certificate', 'contract', 'installment_1', 'installment_2', 'balance']);

    // 3. Auto-generate payment lines based on unit type
    const paymentLines = [
        {
            entity_id: entityId,
            unit_type_id: unitTypeId,
            payment_type: 'certificate',
            amount_due: unitType.certificate_amount,
            amount_paid: 0,
            is_contribution: true,
            status: 'pending',
            sort_order: 1,
        },
        {
            entity_id: entityId,
            unit_type_id: unitTypeId,
            payment_type: 'contract',
            amount_due: unitType.contract_amount,
            amount_paid: 0,
            is_contribution: true,
            status: 'pending',
            sort_order: 3,
        },
        {
            entity_id: entityId,
            unit_type_id: unitTypeId,
            payment_type: 'installment_1',
            amount_due: unitType.installment_1_amount,
            amount_paid: 0,
            is_contribution: true,
            status: 'pending',
            sort_order: 4,
        },
        {
            entity_id: entityId,
            unit_type_id: unitTypeId,
            payment_type: 'installment_2',
            amount_due: unitType.installment_2_amount,
            amount_paid: 0,
            is_contribution: true,
            status: 'pending',
            sort_order: 5,
        },
        {
            entity_id: entityId,
            unit_type_id: unitTypeId,
            payment_type: 'balance',
            amount_due: unitType.balance_amount,
            amount_paid: 0,
            is_contribution: true,
            status: 'pending',
            sort_order: 6,
        },
    ];

    const { error: insertErr } = await supabase.from('member_payments').insert(paymentLines);
    if (insertErr) throw new Error(insertErr.message);
}

// ── Payment Statistics ──────────────────────────────────

export interface PaymentStatistics {
    totalDue: number;
    totalPaid: number;
    totalUnpaid: number;
    contributionDue: number;        // 분담금만 (프리미엄 제외)
    contributionPaid: number;
    contributionUnpaid: number;
    byType: Record<string, { due: number; paid: number }>;
    byUnitType: Record<string, { count: number; paid: number; due: number }>;
    byAccount: Record<string, { name: string; total: number }>;
}

export async function getPaymentStatistics(): Promise<PaymentStatistics> {
    const supabase = await createClient();

    const { data: payments } = await supabase
        .from('member_payments')
        .select('payment_type, amount_due, amount_paid, is_contribution, unit_type_id, deposit_account_id');

    const { data: unitTypes } = await supabase.from('unit_types').select('id, name').eq('is_active', true);
    const { data: accounts } = await supabase.from('deposit_accounts').select('id, account_name').eq('is_active', true);

    const unitMap = new Map((unitTypes || []).map(u => [u.id, u.name]));
    const accountMap = new Map((accounts || []).map(a => [a.id, a.account_name]));

    const stats: PaymentStatistics = {
        totalDue: 0, totalPaid: 0, totalUnpaid: 0,
        contributionDue: 0, contributionPaid: 0, contributionUnpaid: 0,
        byType: {}, byUnitType: {}, byAccount: {},
    };

    for (const p of (payments || [])) {
        const due = Number(p.amount_due) || 0;
        const paid = Number(p.amount_paid) || 0;

        stats.totalDue += due;
        stats.totalPaid += paid;

        if (p.is_contribution) {
            stats.contributionDue += due;
            stats.contributionPaid += paid;
        }

        // By type
        if (!stats.byType[p.payment_type]) stats.byType[p.payment_type] = { due: 0, paid: 0 };
        stats.byType[p.payment_type].due += due;
        stats.byType[p.payment_type].paid += paid;

        // By unit type
        if (p.unit_type_id) {
            const utName = unitMap.get(p.unit_type_id) || p.unit_type_id;
            if (!stats.byUnitType[utName]) stats.byUnitType[utName] = { count: 0, paid: 0, due: 0 };
            stats.byUnitType[utName].due += due;
            stats.byUnitType[utName].paid += paid;
        }

        // By account
        if (p.deposit_account_id && paid > 0) {
            const accName = accountMap.get(p.deposit_account_id) || '미지정';
            if (!stats.byAccount[accName]) stats.byAccount[accName] = { name: accName, total: 0 };
            stats.byAccount[accName].total += paid;
        }
    }

    stats.totalUnpaid = stats.totalDue - stats.totalPaid;
    stats.contributionUnpaid = stats.contributionDue - stats.contributionPaid;

    return stats;
}
