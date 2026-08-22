export type MemberBankAccount = {
    bank_name: string;
    account_number: string;
    account_holder: string;
    purpose: 'refund' | 'payment' | 'other';
    updated_at?: string | null;
};

export const MEMBER_BANK_ACCOUNT_PURPOSES = [
    { value: 'refund', label: '환불 계좌' },
    { value: 'payment', label: '지급 계좌' },
    { value: 'other', label: '기타' },
] as const;

export function normalizeBankAccountNumber(value: string) {
    return value.replace(/[^0-9-]/g, '').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}

export function maskBankAccountNumber(value: string) {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 4) return '*'.repeat(digits.length || 4);
    const visibleTail = digits.slice(-4);
    const maskedHead = '*'.repeat(Math.max(4, digits.length - 4));
    return `${maskedHead}-${visibleTail}`;
}
