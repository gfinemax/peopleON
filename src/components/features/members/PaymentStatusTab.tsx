'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';
import {
    AddPremiumControls,
    PaymentDetailsTable,
    PaymentProgressSection,
    PaymentRequestButton,
    PaymentSummarySection,
    UnitTypeSelectorSection,
} from './PaymentStatusTabSections';
import {
    buildPaymentSummary,
    createPremiumPaymentLines,
    createStructuredPaymentLines,
    derivePaymentStatus,
    type DepositAccount,
    type PaymentRecord,
    type UnitType,
} from './paymentStatusTabUtils';

interface PaymentStatusTabProps {
    memberIds: string[];
    memberName: string;
    unitGroup?: string | null;
}

export function PaymentStatusTab({ memberIds }: PaymentStatusTabProps) {
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

        const paymentRows = paymentsRes.data || [];
        setPayments(paymentRows);
        setUnitTypes(unitTypesRes.data || []);
        setAccounts(accountsRes.data || []);

        const firstPayment = paymentRows.find((payment) => payment.unit_type_id);
        if (firstPayment?.unit_type_id) {
            setSelectedUnitTypeId(firstPayment.unit_type_id);
        }

        setLoading(false);
    }, [memberIds]);

    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

    const handleAssignUnitType = async (unitTypeId: string) => {
        setSaving(true);
        const supabase = createClient();
        const unitType = unitTypes.find((item) => item.id === unitTypeId);
        if (!unitType) {
            setSaving(false);
            return;
        }

        await supabase
            .from('member_payments')
            .delete()
            .in('entity_id', memberIds)
            .in('payment_type', ['certificate', 'contract', 'installment_1', 'installment_2', 'balance']);

        const lines = createStructuredPaymentLines(memberIds, unitTypeId, unitType);
        await supabase.from('member_payments').insert(lines);

        setSelectedUnitTypeId(unitTypeId);
        await fetchAll();
        setSaving(false);
    };

    const handleAddPremium = async (type: 'premium' | 'premium_recognized') => {
        setSaving(true);
        const supabase = createClient();
        const lines = createPremiumPaymentLines(memberIds, selectedUnitTypeId, type);

        await supabase.from('member_payments').insert(lines);
        setAddingPremium(false);
        await fetchAll();
        setSaving(false);
    };

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
        const payment = payments.find((item) => item.id === editingId);
        const status = derivePaymentStatus(amountPaid, payment?.amount_due || 0);

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

    const summary = buildPaymentSummary(payments, unitTypes, selectedUnitTypeId);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <MaterialIcon name="progress_activity" className="animate-spin text-muted-foreground" size="lg" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <UnitTypeSelectorSection
                unitTypes={unitTypes}
                selectedUnitTypeId={selectedUnitTypeId}
                selectedUnitType={summary.selectedUnitType}
                saving={saving}
                onAssignUnitType={handleAssignUnitType}
            />
            <PaymentSummarySection
                totalInvestment={summary.totalInvestment}
                certificateAmount={summary.certificateAmount}
                premiumRecognized={summary.premiumRecognized}
                pureAdditionalBurden={summary.pureAdditionalBurden}
            />
            <PaymentProgressSection
                contributionRate={summary.contributionRate}
                totalContributionDue={summary.totalContributionDue}
                totalContributionPaid={summary.totalContributionPaid}
                totalContributionUnpaid={summary.totalContributionUnpaid}
            />
            <PaymentDetailsTable
                accounts={accounts}
                editForm={editForm}
                editingId={editingId}
                payments={payments}
                saving={saving}
                onCancelEdit={cancelEdit}
                onDelete={handleDelete}
                onEditFormChange={(patch) => setEditForm((current) => ({ ...current, ...patch }))}
                onSaveEdit={saveEdit}
                onStartEdit={startEdit}
            />
            <AddPremiumControls
                addingPremium={addingPremium}
                hasPayments={payments.length > 0}
                saving={saving}
                onAddPremium={handleAddPremium}
                onToggleAddingPremium={setAddingPremium}
            />
            <PaymentRequestButton totalContributionUnpaid={summary.totalContributionUnpaid} />
        </div>
    );
}
