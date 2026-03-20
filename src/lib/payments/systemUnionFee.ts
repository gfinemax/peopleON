export const SYSTEM_UNION_FEE_AMOUNT = 10_000_000;
export const SYSTEM_UNION_FEE_LABEL = '조합비(분담금 포함)';
export const SYSTEM_UNION_FEE_NOTE = '__system_union_fee_included__';
export const SYSTEM_UNION_FEE_PAYMENT_TYPE = 'other';
export const SYSTEM_UNION_FEE_SORT_ORDER = 2;

export const STRUCTURED_PAYMENT_TYPES = [
    'certificate',
    'contract',
    'installment_1',
    'installment_2',
    'balance',
] as const;

type PaymentLike = {
    id?: string;
    entity_id: string;
    unit_type_id: string | null;
    payment_type: string;
    amount_due?: number | string | null;
    amount_paid?: number | string | null;
    deposit_account_id?: string | null;
    paid_date?: string | null;
    receipt_note?: string | null;
    is_contribution?: boolean;
    status?: string;
    sort_order?: number;
};

const parseMoney = (value: number | string | null | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

export const isStructuredPaymentType = (paymentType: string) =>
    STRUCTURED_PAYMENT_TYPES.includes(paymentType as (typeof STRUCTURED_PAYMENT_TYPES)[number]);

export const isSystemUnionFeePayment = (payment: Pick<PaymentLike, 'payment_type' | 'receipt_note'>) =>
    payment.payment_type === SYSTEM_UNION_FEE_PAYMENT_TYPE && payment.receipt_note === SYSTEM_UNION_FEE_NOTE;

export function getMissingSystemUnionFeeTargets<T extends PaymentLike>(payments: T[]) {
    const structuredTargets = new Map<string, string | null>();
    let hasUnionFee = false;

    for (const payment of payments) {
        if (isStructuredPaymentType(payment.payment_type) && !structuredTargets.has(payment.entity_id)) {
            structuredTargets.set(payment.entity_id, payment.unit_type_id ?? null);
        }

        if (isSystemUnionFeePayment(payment)) {
            hasUnionFee = true;
        }
    }

    if (hasUnionFee) return [];

    const firstTarget = Array.from(structuredTargets.entries())[0];
    if (!firstTarget) return [];

    const [entity_id, unit_type_id] = firstTarget;
    return [{ entity_id, unit_type_id }];
}

export function createSystemUnionFeePayments(targets: Array<{ entity_id: string; unit_type_id: string | null }>) {
    return targets.map(({ entity_id, unit_type_id }) => ({
        entity_id,
        unit_type_id,
        payment_type: SYSTEM_UNION_FEE_PAYMENT_TYPE,
        amount_due: SYSTEM_UNION_FEE_AMOUNT,
        amount_paid: 0,
        deposit_account_id: null,
        paid_date: null,
        receipt_note: SYSTEM_UNION_FEE_NOTE,
        is_contribution: true,
        status: 'pending',
        sort_order: SYSTEM_UNION_FEE_SORT_ORDER,
    }));
}

export function getSystemUnionFeeSummary<T extends PaymentLike>(payments: T[]) {
    const unionFeePayments = payments.filter(isSystemUnionFeePayment);
    const actualPaid = unionFeePayments.reduce((sum, payment) => sum + parseMoney(payment.amount_paid), 0);
    const missingTargets = getMissingSystemUnionFeeTargets(payments);
    const hasUnionFee = unionFeePayments.length > 0;
    const actualDue = hasUnionFee ? SYSTEM_UNION_FEE_AMOUNT : 0;
    const missingDue = hasUnionFee ? 0 : missingTargets.length * SYSTEM_UNION_FEE_AMOUNT;
    const totalDue = actualDue + missingDue;
    const totalPaid = Math.min(actualPaid, totalDue);
    const totalUnpaid = Math.max(totalDue - totalPaid, 0);

    return {
        actualDue,
        actualPaid,
        missingDue,
        missingTargets,
        totalDue,
        totalPaid,
        totalUnpaid,
    };
}

export function getCollapsedSystemUnionFeePayment<T extends PaymentLike>(payments: T[]) {
    const unionFeePayments = payments.filter(isSystemUnionFeePayment);
    const missingTargets = getMissingSystemUnionFeeTargets(payments);

    if (unionFeePayments.length === 0 && missingTargets.length === 0) {
        return null;
    }

    const primaryPayment = unionFeePayments[0];
    const [fallbackTarget] = missingTargets;
    const latestPaidRow = [...unionFeePayments]
        .filter((payment) => payment.paid_date)
        .sort((left, right) => new Date(right.paid_date || '').getTime() - new Date(left.paid_date || '').getTime())[0];
    const totalPaid = Math.min(
        unionFeePayments.reduce((sum, payment) => sum + parseMoney(payment.amount_paid), 0),
        SYSTEM_UNION_FEE_AMOUNT,
    );

    return {
        id: primaryPayment?.id ?? `system-union-fee-${fallbackTarget?.entity_id || 'pending'}`,
        entity_id: primaryPayment?.entity_id ?? fallbackTarget?.entity_id ?? '',
        unit_type_id: primaryPayment?.unit_type_id ?? fallbackTarget?.unit_type_id ?? null,
        payment_type: SYSTEM_UNION_FEE_PAYMENT_TYPE,
        amount_due: SYSTEM_UNION_FEE_AMOUNT,
        amount_paid: totalPaid,
        deposit_account_id: latestPaidRow?.deposit_account_id ?? primaryPayment?.deposit_account_id ?? null,
        paid_date: latestPaidRow?.paid_date ?? primaryPayment?.paid_date ?? null,
        receipt_note: SYSTEM_UNION_FEE_NOTE,
        is_contribution: true,
        status: totalPaid >= SYSTEM_UNION_FEE_AMOUNT ? 'paid' : totalPaid > 0 ? 'partial' : 'pending',
        sort_order: SYSTEM_UNION_FEE_SORT_ORDER,
    };
}
