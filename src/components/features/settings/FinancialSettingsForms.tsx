'use client';

import type { Dispatch, SetStateAction } from 'react';
import { cn } from '@/lib/utils';
import { ACCOUNT_TYPE_OPTIONS, UNIT_TYPE_FORM_FIELDS, type DepositAccount, type UnitType } from './financialSettingsUtils';

function FormActions({
    onCancel,
    onSave,
    saving,
}: {
    onCancel: () => void;
    onSave: () => void;
    saving: boolean;
}) {
    return (
        <div className="flex justify-end gap-2">
            <button
                onClick={onCancel}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
                취소
            </button>
            <button
                onClick={onSave}
                disabled={saving}
                className="rounded-md bg-primary px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
                {saving ? '저장 중...' : '저장'}
            </button>
        </div>
    );
}

export function UnitTypeForm({
    form,
    setForm,
    onSave,
    onCancel,
    saving,
}: {
    form: Partial<UnitType>;
    setForm: Dispatch<SetStateAction<Partial<UnitType>>>;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
}) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {UNIT_TYPE_FORM_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">{field.label}</label>
                        <input
                            type={field.type}
                            value={form[field.key] ?? ''}
                            placeholder={'placeholder' in field ? field.placeholder : undefined}
                            onChange={(event) =>
                                setForm((prev) => ({
                                    ...prev,
                                    [field.key]: field.type === 'number' ? Number(event.target.value) : event.target.value,
                                }))
                            }
                            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                ))}
            </div>
            <FormActions onCancel={onCancel} onSave={onSave} saving={saving} />
        </div>
    );
}

export function DepositAccountForm({
    form,
    setForm,
    onSave,
    onCancel,
    saving,
}: {
    form: Partial<DepositAccount>;
    setForm: Dispatch<SetStateAction<Partial<DepositAccount>>>;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
}) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">계좌명</label>
                    <input
                        type="text"
                        value={form.account_name || ''}
                        onChange={(event) => setForm((prev) => ({ ...prev, account_name: event.target.value }))}
                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="예: 조합 주거래"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">은행명</label>
                    <input
                        type="text"
                        value={form.bank_name || ''}
                        onChange={(event) => setForm((prev) => ({ ...prev, bank_name: event.target.value }))}
                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="예: 국민은행"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">계좌유형</label>
                    <select
                        value={form.account_type || 'union'}
                        onChange={(event) => setForm((prev) => ({ ...prev, account_type: event.target.value }))}
                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        {ACCOUNT_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">공식 계좌</label>
                    <div className="flex h-9 items-center">
                        <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, is_official: !prev.is_official }))}
                            className={cn(
                                'relative h-6 w-11 rounded-full transition-colors',
                                form.is_official ? 'bg-primary' : 'bg-muted',
                            )}
                        >
                            <span
                                className={cn(
                                    'absolute top-1 size-4 rounded-full bg-white shadow-sm transition-transform',
                                    form.is_official ? 'left-6' : 'left-1',
                                )}
                            />
                        </button>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1 sm:col-span-2">
                    <label className="text-[11px] font-medium text-muted-foreground">계좌번호</label>
                    <input
                        type="text"
                        value={form.account_number || ''}
                        onChange={(event) => setForm((prev) => ({ ...prev, account_number: event.target.value }))}
                        className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="예: 123-456-789012"
                    />
                </div>
            </div>
            <FormActions onCancel={onCancel} onSave={onSave} saving={saving} />
        </div>
    );
}
