'use client';

import { readAllPages } from '@/lib/supabase/readAllPages';
import { useStableIds } from '@/lib/hooks/useStableIds';

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
    createMissingSystemUnionFeeLines,
    createPremiumPaymentLines,
    createStructuredPaymentLines,
    derivePaymentStatus,
    getDisplayPayments,
    SYSTEM_UNION_FEE_NOTE,
    type DepositAccount,
    type PaymentRecord,
    type UnitType,
} from './paymentStatusTabUtils';
import { useLedgerJournalSummary } from './useLedgerJournalSummary';
import type { LedgerJournalSummary } from '@/lib/server/ledgerJournalSummary';

interface PaymentStatusTabProps {
    memberIds: string[];
    memberName: string;
    unitGroup?: string | null;
    memberTiers?: string[] | null;
    isRegistered?: boolean;
}

type PaymentTabData = {
    paymentRows: PaymentRecord[];
    unitTypeRows: UnitType[];
    accountRows: DepositAccount[];
    selectedUnitTypeId: string | null;
};

export function PaymentStatusTab({
    memberIds: inputMemberIds,
    memberName,
    memberTiers = [],
    isRegistered = false,
}: PaymentStatusTabProps) {
    const memberIds = useStableIds(inputMemberIds);
    const normalizedMemberTiers = memberTiers || [];
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState<PaymentRecord[]>([]);
    const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
    const [accounts, setAccounts] = useState<DepositAccount[]>([]);
    const [selectedUnitTypeId, setSelectedUnitTypeId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<PaymentRecord>>({});
    const [saving, setSaving] = useState(false);
    const [addingPremium, setAddingPremium] = useState(false);
    const ledgerJournal = useLedgerJournalSummary(memberIds[0] || '');

    const loadPaymentTabData = useCallback(async (): Promise<PaymentTabData> => {
        const supabase = createClient();

        const [paymentsRes, unitTypesRes, accountsRes] = await Promise.all([
            readAllPages(supabase.from('member_payments').select('id, entity_id, unit_type_id, payment_type, amount_due, amount_paid, deposit_account_id, paid_date, receipt_note, is_contribution, status, sort_order').in('entity_id', memberIds).order('sort_order', { ascending: true }).order('id', { ascending: true })),
            readAllPages(supabase.from('unit_types').select('id, name, area_sqm, total_contribution, first_sale_price, second_sale_price, general_sale_price, certificate_amount, contract_amount, installment_1_amount, installment_2_amount, balance_amount, is_active').eq('is_active', true).order('area_sqm', { ascending: true }).order('id', { ascending: true })),
            readAllPages(supabase.from('deposit_accounts').select('id, account_name, bank_name, account_number, account_type, is_official, is_active').eq('is_active', true).order('account_type', { ascending: true }).order('id', { ascending: true })),
        ]);

        let paymentRows = paymentsRes.data || [];
        const missingUnionFeeLines = createMissingSystemUnionFeeLines(paymentRows);

        if (missingUnionFeeLines.length > 0) {
            const { error: insertError } = await supabase.from('member_payments').insert(missingUnionFeeLines);
            if (!insertError) {
                const refreshedPaymentsRes = await readAllPages(supabase
                    .from('member_payments')
                    .select('id, entity_id, unit_type_id, payment_type, amount_due, amount_paid, deposit_account_id, paid_date, receipt_note, is_contribution, status, sort_order')
                    .in('entity_id', memberIds)
                    .order('sort_order', { ascending: true }).order('id', { ascending: true }));
                paymentRows = refreshedPaymentsRes.data || paymentRows;
            }
        }

        const firstPayment = getDisplayPayments(paymentRows).find((payment) => payment.unit_type_id);
        return {
            paymentRows: paymentRows as PaymentRecord[],
            unitTypeRows: (unitTypesRes.data || []) as UnitType[],
            accountRows: (accountsRes.data || []) as DepositAccount[],
            selectedUnitTypeId: firstPayment?.unit_type_id || null,
        };
    }, [memberIds]);

    const applyPaymentTabData = (data: PaymentTabData) => {
        setPayments(data.paymentRows);
        setUnitTypes(data.unitTypeRows);
        setAccounts(data.accountRows);
        if (data.selectedUnitTypeId) {
            setSelectedUnitTypeId(data.selectedUnitTypeId);
        }
        setLoading(false);
    };

    const fetchAll = useCallback(async () => {
        applyPaymentTabData(await loadPaymentTabData());
    }, [loadPaymentTabData]);

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const data = await loadPaymentTabData();
            if (cancelled) return;
            setPayments(data.paymentRows);
            setUnitTypes(data.unitTypeRows);
            setAccounts(data.accountRows);
            if (data.selectedUnitTypeId) {
                setSelectedUnitTypeId(data.selectedUnitTypeId);
            }
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [loadPaymentTabData]);

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

        await supabase
            .from('member_payments')
            .delete()
            .in('entity_id', memberIds)
            .eq('payment_type', 'other')
            .eq('receipt_note', SYSTEM_UNION_FEE_NOTE);

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

        const patch = {
            amount_paid: amountPaid,
            deposit_account_id: editForm.deposit_account_id || null,
            paid_date: editForm.paid_date || null,
            receipt_note: editForm.receipt_note || null,
            status,
        };
        const { data: saved, error } = await supabase.from('member_payments').update(patch).eq('id', editingId).select('id').maybeSingle();
        if (error || !saved) {
            setSaving(false);
            alert('납부 항목을 저장하지 못했습니다. 다시 시도해 주세요.');
            return;
        }
        setPayments((rows) => rows.map((row) => row.id === editingId ? { ...row, ...patch } : row));

        setEditingId(null);
        setEditForm({});
        setSaving(false);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm({});
    };

    const handleDelete = async (id: string) => {
        if (!confirm('이 납부 항목을 삭제하시겠습니까?')) return;
        const supabase = createClient();
        const { data: deleted, error } = await supabase.from('member_payments').delete().eq('id', id).select('id').maybeSingle();
        if (error || !deleted) {
            alert('납부 항목을 삭제하지 못했습니다. 다시 시도해 주세요.');
            return;
        }
        setPayments((rows) => rows.filter((row) => row.id !== id));
    };

    const displayPayments = getDisplayPayments(payments);
    const summary = buildPaymentSummary(displayPayments, unitTypes, selectedUnitTypeId, normalizedMemberTiers, isRegistered);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-10">
                <MaterialIcon name="progress_activity" className="animate-spin text-muted-foreground" size="lg" />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <LedgerPaymentOverview
                memberName={memberName}
                loading={ledgerJournal.loading}
                summary={ledgerJournal.summary}
                onReload={() => void ledgerJournal.reload()}
            />
            <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-white/[0.07]" />
                <p className="text-[11px] font-bold text-slate-500">PeopleON 납부 계획 · 수기 관리</p>
                <div className="h-px flex-1 bg-white/[0.07]" />
            </div>
            <UnitTypeSelectorSection
                unitTypes={unitTypes}
                selectedUnitTypeId={selectedUnitTypeId}
                selectedUnitType={summary.selectedUnitType}
                selectedUnitContributionTotal={summary.selectedUnitContributionTotal}
                salePriceLabel={summary.salePriceLabel}
                saving={saving}
                onAssignUnitType={handleAssignUnitType}
            />
            <PaymentSummarySection
                totalInvestment={summary.totalInvestment}
                certificateAmount={summary.certificateAmount}
                premiumRecognized={summary.premiumRecognized}
                pureAdditionalBurden={summary.pureAdditionalBurden}
                unionFeeDue={summary.unionFeeDue}
                unionFeePaid={summary.unionFeePaid}
                unionFeeStatus={summary.unionFeeStatus}
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
                payments={displayPayments}
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

const LEDGER_ALLOCATION_LABELS = [
    ['cert', '출자금(필증)'],
    ['op_fee', '운영비'],
    ['business_promotion_fee', '사업추진비'],
    ['join_fee', '계약금'],
    ['land1', '1차 분담금'],
    ['land2', '2차 분담금'],
] as const;

function LedgerPaymentOverview({
    memberName,
    loading,
    summary,
    onReload,
}: {
    memberName: string;
    loading: boolean;
    summary: LedgerJournalSummary;
    onReload: () => void;
}) {
    const payment = summary.payment_summary;
    const ledgerBaseUrl = (process.env.NEXT_PUBLIC_LEDGER_URL || 'https://dbapt-ledger.duckdns.org').replace(/\/$/, '');
    const paymentHref = payment?.payment_url ? `${ledgerBaseUrl}${payment.payment_url}` : null;

    return (
        <section className="overflow-hidden rounded-xl border border-emerald-400/20 bg-emerald-500/[0.055] shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-400/10 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                        <MaterialIcon name="account_balance" size="sm" />
                    </span>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-black text-slate-100">회계원장 API 납부현황</h3>
                            {summary.connected ? (
                                <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">연결됨</span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {summary.ledger_member?.name || memberName} · 회계프로그램 원장 기준
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button type="button" onClick={onReload} disabled={loading} className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-2.5 text-[11px] font-bold text-slate-300 hover:bg-white/5 disabled:opacity-50">
                        <MaterialIcon name="refresh" size="xs" className={loading ? 'animate-spin' : ''} />새로고침
                    </button>
                    {paymentHref ? (
                        <button type="button" onClick={() => window.open(paymentHref, '_blank', 'noopener,noreferrer')} className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2.5 text-[11px] font-bold text-emerald-200 hover:bg-emerald-500/15">
                            회계원장 열기<MaterialIcon name="open_in_new" size="xs" />
                        </button>
                    ) : null}
                </div>
            </div>

            {loading ? (
                <p className="px-4 py-8 text-center text-xs font-semibold text-slate-400">회계원장 납부내역을 불러오는 중...</p>
            ) : summary.error ? (
                <div className="px-4 py-6 text-center">
                    <p className="text-xs font-bold text-rose-300">{summary.error}</p>
                    <p className="mt-1 text-[11px] text-slate-500">연결 오류가 표시되면 관리자에게 API 설정을 확인해 달라고 요청해줘.</p>
                </div>
            ) : !summary.connected ? (
                <p className="px-4 py-8 text-center text-xs font-semibold text-slate-400">회계원장에 연결된 조합원 정보가 없어.</p>
            ) : !payment ? (
                <p className="px-4 py-8 text-center text-xs font-semibold text-slate-400">회계원장에 등록된 납부내역이 없어.</p>
            ) : (
                <div className="p-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <LedgerMetric label="실납부 합계" value={payment.total_paid} primary />
                        <LedgerMetric label="총 입금" value={payment.gross_paid} />
                        <LedgerMetric label="환불·출금" value={Number(payment.refund_sum || 0) + Number(payment.withdrawal_sum || 0)} />
                    </div>
                    <div className="mt-4 grid grid-cols-1 overflow-hidden rounded-lg border border-white/[0.07] sm:grid-cols-2 lg:grid-cols-3">
                        {LEDGER_ALLOCATION_LABELS.map(([key, label]) => (
                            <div key={key} className="flex min-h-10 items-center justify-between gap-3 border-b border-white/[0.055] px-3 py-2 text-xs sm:border-r lg:[&:nth-child(3n)]:border-r-0">
                                <span className="font-medium text-slate-400">{label}</span>
                                <span className="whitespace-nowrap font-bold tabular-nums text-slate-200">{money(Number(payment.allocations[key] || 0))}</span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-2 text-right text-[10px] text-slate-600">조회 기준 {formatLedgerDate(summary.generated_at)}</p>
                </div>
            )}
        </section>
    );
}

function LedgerMetric({ label, value, primary = false }: { label: string; value: number; primary?: boolean }) {
    return (
        <div className="rounded-lg border border-white/[0.07] bg-[#162536] px-4 py-3">
            <p className="text-[10px] font-bold text-slate-500">{label}</p>
            <p className={`mt-1 text-lg font-black tabular-nums ${primary ? 'text-emerald-300' : 'text-slate-100'}`}>{money(Number(value || 0))}</p>
        </div>
    );
}

function money(value: number) {
    return `${Math.round(value).toLocaleString('ko-KR')}원`;
}

function formatLedgerDate(value: string | null) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.slice(0, 16);
    return date.toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
}
