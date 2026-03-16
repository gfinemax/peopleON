'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { DepositAccountForm } from './FinancialSettingsForms';
import {
    buildDepositAccountPayload,
    createEmptyDepositAccountForm,
    getAccountTypeContainerClass,
    getAccountTypeIconClass,
    getAccountTypeOption,
    type DepositAccount,
} from './financialSettingsUtils';
import {
    FinancialSettingsSectionCard,
    FinancialSettingsSectionLoading,
} from './FinancialSettingsPrimitives';

export function DepositAccountsSection() {
    const [accounts, setAccounts] = useState<DepositAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<DepositAccount>>({});
    const [saving, setSaving] = useState(false);

    const resetEditor = () => {
        setEditingId(null);
        setForm({});
    };

    const fetchAll = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.from('deposit_accounts').select('*').eq('is_active', true).order('account_type');
        setAccounts(data || []);
        setLoading(false);
    };

    useEffect(() => {
        void fetchAll();
    }, []);

    const startEdit = (account?: DepositAccount) => {
        setEditingId(account?.id || 'new');
        setForm(account || createEmptyDepositAccountForm());
    };

    const save = async () => {
        setSaving(true);
        const supabase = createClient();
        const payload = buildDepositAccountPayload(form);

        if (editingId === 'new') {
            await supabase.from('deposit_accounts').insert(payload);
        } else {
            await supabase.from('deposit_accounts').update(payload).eq('id', editingId);
        }

        resetEditor();
        await fetchAll();
        setSaving(false);
    };

    const remove = async (id: string) => {
        if (!confirm('이 계좌를 비활성화하시겠습니까?')) return;
        const supabase = createClient();
        await supabase.from('deposit_accounts').update({ is_active: false }).eq('id', id);
        await fetchAll();
    };

    return (
        <FinancialSettingsSectionCard
            title="입금 계좌 관리"
            iconName="account_balance"
            iconClassName="text-emerald-400"
            onAdd={() => startEdit()}
        >
            {loading ? (
                <FinancialSettingsSectionLoading />
            ) : (
                <div className="space-y-3">
                    {accounts.map((account) => (
                        <div
                            key={account.id}
                            className={cn(
                                'rounded-lg border p-4 transition-all',
                                editingId === account.id ? 'border-primary/30 bg-primary/5' : 'border-border bg-background',
                            )}
                        >
                            {editingId === account.id ? (
                                <DepositAccountForm
                                    form={form}
                                    setForm={setForm}
                                    onSave={save}
                                    onCancel={resetEditor}
                                    saving={saving}
                                />
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className={cn(
                                                'flex size-10 items-center justify-center rounded-lg',
                                                getAccountTypeContainerClass(account.account_type),
                                            )}
                                        >
                                            <MaterialIcon
                                                name={account.account_type === 'trust' ? 'assured_workload' : 'account_balance'}
                                                size="sm"
                                                className={getAccountTypeIconClass(account.account_type)}
                                            />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-foreground">{account.account_name}</p>
                                                {getAccountTypeOption(account.account_type) ? (
                                                    <span
                                                        className={cn(
                                                            'text-[10px] font-bold',
                                                            getAccountTypeOption(account.account_type)?.color,
                                                        )}
                                                    >
                                                        {getAccountTypeOption(account.account_type)?.label}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-muted-foreground">
                                                        {account.account_type}
                                                    </span>
                                                )}
                                                {account.is_official && (
                                                    <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1 text-[9px] text-blue-400">
                                                        공식
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {account.bank_name || '은행 미정'}
                                                {account.account_number ? ` · ${account.account_number}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => startEdit(account)}
                                            className="rounded p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                        >
                                            <MaterialIcon name="edit" size="sm" />
                                        </button>
                                        <button
                                            onClick={() => remove(account.id)}
                                            className="rounded p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <MaterialIcon name="delete_outline" size="sm" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}

                    {editingId === 'new' && (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                            <DepositAccountForm
                                form={form}
                                setForm={setForm}
                                onSave={save}
                                onCancel={resetEditor}
                                saving={saving}
                            />
                        </div>
                    )}

                    {accounts.length === 0 && editingId !== 'new' && (
                        <p className="py-6 text-center text-sm text-muted-foreground">등록된 계좌가 없습니다.</p>
                    )}
                </div>
            )}
        </FinancialSettingsSectionCard>
    );
}
