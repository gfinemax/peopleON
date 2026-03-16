'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

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
}

export interface DepositAccount {
    id: string;
    account_name: string;
    bank_name: string | null;
    account_type: string;
    is_official: boolean;
}

export interface PaymentRecord {
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

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
    certificate: '출자금(필증)',
    premium: '프리미엄',
    premium_recognized: '프리미엄 인정분',
    contract: '계약금',
    installment_1: '1차 분담금',
    installment_2: '2차 분담금',
    balance: '잔금',
    other: '기타',
};

export const PAYMENT_TYPE_ICONS: Record<string, string> = {
    certificate: 'receipt_long',
    premium: 'diamond',
    premium_recognized: 'verified',
    contract: 'edit_document',
    installment_1: 'looks_one',
    installment_2: 'looks_two',
    balance: 'account_balance',
    other: 'more_horiz',
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
    union: '조합',
    trust: '신탁',
    external: '외부',
    recognized: '인정',
};

const STRUCTURED_PAYMENT_DEFINITIONS = [
    { payment_type: 'certificate', amountKey: 'certificate_amount', sort_order: 1 },
    { payment_type: 'contract', amountKey: 'contract_amount', sort_order: 3 },
    { payment_type: 'installment_1', amountKey: 'installment_1_amount', sort_order: 4 },
    { payment_type: 'installment_2', amountKey: 'installment_2_amount', sort_order: 5 },
    { payment_type: 'balance', amountKey: 'balance_amount', sort_order: 6 },
] as const;

export function createStructuredPaymentLines(memberIds: string[], unitTypeId: string, unitType: UnitType) {
    return memberIds.flatMap((entityId) =>
        STRUCTURED_PAYMENT_DEFINITIONS.map(({ payment_type, amountKey, sort_order }) => ({
            entity_id: entityId,
            unit_type_id: unitTypeId,
            payment_type,
            amount_due: unitType[amountKey],
            amount_paid: 0,
            deposit_account_id: null,
            paid_date: null,
            receipt_note: null,
            is_contribution: true,
            status: 'pending',
            sort_order,
        })),
    );
}

export function createPremiumPaymentLines(
    memberIds: string[],
    selectedUnitTypeId: string | null,
    type: 'premium' | 'premium_recognized',
) {
    return memberIds.map((entityId) => ({
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
        sort_order: 2,
    }));
}

export function derivePaymentStatus(amountPaid: number, amountDue: number) {
    if (amountPaid > 0 && amountPaid >= amountDue) return 'paid';
    if (amountPaid > 0) return 'partial';
    return 'pending';
}

export function buildPaymentSummary(
    payments: PaymentRecord[],
    unitTypes: UnitType[],
    selectedUnitTypeId: string | null,
) {
    const contributionPayments = payments.filter((payment) => payment.is_contribution && payment.payment_type !== 'premium');
    const totalContributionDue = contributionPayments.reduce((sum, payment) => sum + Number(payment.amount_due), 0);
    const totalContributionPaid = contributionPayments.reduce((sum, payment) => sum + Number(payment.amount_paid), 0);
    const totalContributionUnpaid = totalContributionDue - totalContributionPaid;
    const contributionRate =
        totalContributionDue > 0 ? Math.round((totalContributionPaid / totalContributionDue) * 100) : 0;
    const certificateAmount = payments
        .filter((payment) => payment.payment_type === 'certificate')
        .reduce((sum, payment) => sum + Number(payment.amount_paid), 0);
    const premiumRecognized = payments
        .filter((payment) => payment.payment_type === 'premium_recognized')
        .reduce((sum, payment) => sum + Number(payment.amount_paid), 0);
    const totalInvestment = certificateAmount + premiumRecognized;
    const pureAdditionalBurden = totalContributionDue - totalInvestment;
    const selectedUnitType = unitTypes.find((unitType) => unitType.id === selectedUnitTypeId);

    return {
        certificateAmount,
        contributionRate,
        premiumRecognized,
        pureAdditionalBurden,
        selectedUnitType,
        totalContributionDue,
        totalContributionPaid,
        totalContributionUnpaid,
        totalInvestment,
    };
}

export function getAccountBadgeClass(accountType: string) {
    if (accountType === 'union') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (accountType === 'trust') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
}

export function renderPaymentStatusBadge(status: string, payment: PaymentRecord) {
    if (payment.payment_type === 'premium') {
        return (
            <span className="inline-flex items-center rounded border border-violet-500/20 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-400">
                별도
            </span>
        );
    }

    if (payment.payment_type === 'premium_recognized') {
        return (
            <span className="inline-flex items-center rounded border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
                반영
            </span>
        );
    }

    if (status === 'paid') {
        return (
            <span className="inline-flex items-center rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                완료
            </span>
        );
    }

    if (status === 'partial') {
        return (
            <span className="inline-flex items-center rounded border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                분납
            </span>
        );
    }

    if (status === 'overdue') {
        return (
            <span className="inline-flex items-center rounded border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400">
                연체
            </span>
        );
    }

    return (
        <span className="inline-flex items-center rounded border border-slate-500/20 bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-400">
            미납
        </span>
    );
}

export function PaymentTypeIcon({
    paymentType,
    isPremiumType,
}: {
    paymentType: string;
    isPremiumType: boolean;
}) {
    return (
        <MaterialIcon
            name={PAYMENT_TYPE_ICONS[paymentType] || 'payments'}
            className={cn('text-[16px]', isPremiumType ? 'text-violet-400' : 'text-gray-500')}
        />
    );
}
