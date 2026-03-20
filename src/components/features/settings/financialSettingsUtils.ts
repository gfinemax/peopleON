export interface UnitType {
    id: string;
    name: string;
    area_sqm: number;
    total_contribution: number;
    first_sale_price?: number;
    second_sale_price?: number;
    general_sale_price?: number;
    certificate_amount: number;
    contract_amount: number;
    installment_1_amount: number;
    installment_2_amount: number;
    balance_amount: number;
    is_active: boolean;
}

export interface DepositAccount {
    id: string;
    account_name: string;
    bank_name: string | null;
    account_number: string | null;
    account_type: string;
    is_official: boolean;
    is_active: boolean;
}

export const ACCOUNT_TYPE_OPTIONS = [
    { value: 'union', label: '조합계좌', color: 'text-blue-400' },
    { value: 'trust', label: '신탁계좌', color: 'text-emerald-400' },
    { value: 'external', label: '외부계좌', color: 'text-amber-400' },
    { value: 'recognized', label: '인정계좌', color: 'text-violet-400' },
] as const;

export const UNIT_TYPE_FORM_FIELDS = [
    { key: 'name', label: '평형명', type: 'text', placeholder: '예: 84㎡ A타입' },
    { key: 'area_sqm', label: '면적(㎡)', type: 'number' },
    { key: 'total_contribution', label: '기준 분담금(레거시)', type: 'number' },
    { key: 'first_sale_price', label: '1차 분양가', type: 'number' },
    { key: 'second_sale_price', label: '2차 분양가', type: 'number' },
    { key: 'general_sale_price', label: '일반분양가', type: 'number' },
    { key: 'certificate_amount', label: '필증 기준액', type: 'number' },
    { key: 'contract_amount', label: '계약금', type: 'number' },
    { key: 'installment_1_amount', label: '1차 분담금', type: 'number' },
    { key: 'installment_2_amount', label: '2차 분담금', type: 'number' },
    { key: 'balance_amount', label: '잔금', type: 'number' },
] as const;

export function formatFinancialAmount(value: number) {
    return `₩${value.toLocaleString()}`;
}

export function createEmptyUnitTypeForm(): Partial<UnitType> {
    return {
        name: '',
        area_sqm: 0,
        total_contribution: 0,
        first_sale_price: 0,
        second_sale_price: 0,
        general_sale_price: 0,
        certificate_amount: 30000000,
        contract_amount: 20000000,
        installment_1_amount: 50000000,
        installment_2_amount: 60000000,
        balance_amount: 0,
    };
}

export function buildUnitTypePayload(form: Partial<UnitType>) {
    return {
        name: form.name || '',
        area_sqm: Number(form.area_sqm) || 0,
        total_contribution: Number(form.total_contribution) || 0,
        first_sale_price: Number(form.first_sale_price) || Number(form.total_contribution) || 0,
        second_sale_price: Number(form.second_sale_price) || Number(form.total_contribution) || 0,
        general_sale_price: Number(form.general_sale_price) || Number(form.total_contribution) || 0,
        certificate_amount: Number(form.certificate_amount) || 0,
        contract_amount: Number(form.contract_amount) || 0,
        installment_1_amount: Number(form.installment_1_amount) || 0,
        installment_2_amount: Number(form.installment_2_amount) || 0,
        balance_amount: Number(form.balance_amount) || 0,
    };
}

export function createEmptyDepositAccountForm(): Partial<DepositAccount> {
    return {
        account_name: '',
        bank_name: '',
        account_number: '',
        account_type: 'union',
        is_official: false,
    };
}

export function buildDepositAccountPayload(form: Partial<DepositAccount>) {
    return {
        account_name: form.account_name || '',
        bank_name: form.bank_name || null,
        account_number: form.account_number || null,
        account_type: form.account_type || 'union',
        is_official: form.is_official ?? false,
    };
}

export function getAccountTypeOption(value: string) {
    return ACCOUNT_TYPE_OPTIONS.find((option) => option.value === value);
}

export function getAccountTypeContainerClass(accountType: string) {
    if (accountType === 'union') return 'bg-blue-500/10';
    if (accountType === 'trust') return 'bg-emerald-500/10';
    if (accountType === 'external') return 'bg-amber-500/10';
    return 'bg-violet-500/10';
}

export function getAccountTypeIconClass(accountType: string) {
    if (accountType === 'union') return 'text-blue-400';
    if (accountType === 'trust') return 'text-emerald-400';
    if (accountType === 'external') return 'text-amber-400';
    return 'text-violet-400';
}
