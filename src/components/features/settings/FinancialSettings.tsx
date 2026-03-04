'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────

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
    is_active: boolean;
}

interface DepositAccount {
    id: string;
    account_name: string;
    bank_name: string | null;
    account_number: string | null;
    account_type: string;
    is_official: boolean;
    is_active: boolean;
}

const ACCOUNT_TYPE_OPTIONS = [
    { value: 'union', label: '조합계좌', color: 'text-blue-400' },
    { value: 'trust', label: '신탁계좌', color: 'text-emerald-400' },
    { value: 'external', label: '외부계좌', color: 'text-amber-400' },
    { value: 'recognized', label: '인정계좌', color: 'text-violet-400' },
];

const fmt = (v: number) => `₩${v.toLocaleString()}`;

// ── Unit Types Section ────────────────────────

export function UnitTypesSection() {
    const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<UnitType>>({});
    const [saving, setSaving] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.from('unit_types').select('*').eq('is_active', true).order('area_sqm');
        setUnitTypes(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, []);

    const startEdit = (ut?: UnitType) => {
        setEditingId(ut?.id || 'new');
        setForm(ut || { name: '', area_sqm: 0, total_contribution: 0, certificate_amount: 30000000, contract_amount: 20000000, installment_1_amount: 50000000, installment_2_amount: 60000000, balance_amount: 0 });
    };

    const save = async () => {
        setSaving(true);
        const supabase = createClient();
        const payload = {
            name: form.name || '',
            area_sqm: Number(form.area_sqm) || 0,
            total_contribution: Number(form.total_contribution) || 0,
            certificate_amount: Number(form.certificate_amount) || 0,
            contract_amount: Number(form.contract_amount) || 0,
            installment_1_amount: Number(form.installment_1_amount) || 0,
            installment_2_amount: Number(form.installment_2_amount) || 0,
            balance_amount: Number(form.balance_amount) || 0,
        };

        if (editingId === 'new') {
            await supabase.from('unit_types').insert(payload);
        } else {
            await supabase.from('unit_types').update(payload).eq('id', editingId);
        }
        setEditingId(null);
        setForm({});
        await fetchAll();
        setSaving(false);
    };

    const remove = async (id: string) => {
        if (!confirm('이 평형을 비활성화하시겠습니까?')) return;
        const supabase = createClient();
        await supabase.from('unit_types').update({ is_active: false }).eq('id', id);
        await fetchAll();
    };

    return (
        <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <MaterialIcon name="straighten" size="sm" className="text-sky-400" />
                    입주평형 관리
                </h3>
                <button onClick={() => startEdit()} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors flex items-center gap-1">
                    <MaterialIcon name="add" size="xs" /> 추가
                </button>
            </div>
            <div className="p-4">
                {loading ? (
                    <div className="flex justify-center py-6"><MaterialIcon name="progress_activity" className="animate-spin text-muted-foreground" /></div>
                ) : (
                    <div className="space-y-3">
                        {unitTypes.map(ut => (
                            <div key={ut.id} className={cn("rounded-lg border p-4 transition-all", editingId === ut.id ? "border-primary/30 bg-primary/5" : "border-border bg-background")}>
                                {editingId === ut.id ? (
                                    <UnitForm form={form} setForm={setForm} onSave={save} onCancel={() => { setEditingId(null); setForm({}); }} saving={saving} />
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="size-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
                                                <span className="text-sm font-black text-sky-400">{ut.area_sqm}</span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-foreground">{ut.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    필증 {fmt(ut.certificate_amount)} · 계약 {fmt(ut.contract_amount)} · 1차 {fmt(ut.installment_1_amount)} · 2차 {fmt(ut.installment_2_amount)} · 잔금 {fmt(ut.balance_amount)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => startEdit(ut)} className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                                                <MaterialIcon name="edit" size="sm" />
                                            </button>
                                            <button onClick={() => remove(ut.id)} className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                                <MaterialIcon name="delete_outline" size="sm" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {editingId === 'new' && (
                            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                                <UnitForm form={form} setForm={setForm} onSave={save} onCancel={() => { setEditingId(null); setForm({}); }} saving={saving} />
                            </div>
                        )}
                        {unitTypes.length === 0 && editingId !== 'new' && (
                            <p className="text-sm text-muted-foreground text-center py-6">등록된 평형이 없습니다.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function UnitForm({ form, setForm, onSave, onCancel, saving }: {
    form: Partial<UnitType>;
    setForm: (f: any) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
}) {
    const fields = [
        { key: 'name', label: '평형명', type: 'text', placeholder: '예: 84㎡ A타입' },
        { key: 'area_sqm', label: '면적(㎡)', type: 'number' },
        { key: 'total_contribution', label: '총 분담금', type: 'number' },
        { key: 'certificate_amount', label: '필증 기준액', type: 'number' },
        { key: 'contract_amount', label: '계약금', type: 'number' },
        { key: 'installment_1_amount', label: '1차 분담금', type: 'number' },
        { key: 'installment_2_amount', label: '2차 분담금', type: 'number' },
        { key: 'balance_amount', label: '잔금', type: 'number' },
    ];

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {fields.map(f => (
                    <div key={f.key} className="space-y-1">
                        <label className="text-[11px] font-medium text-muted-foreground">{f.label}</label>
                        <input
                            type={f.type}
                            value={(form as any)[f.key] ?? ''}
                            placeholder={f.placeholder}
                            onChange={e => setForm((prev: any) => ({ ...prev, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                            className="w-full h-9 px-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                    </div>
                ))}
            </div>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">취소</button>
                <button onClick={onSave} disabled={saving} className="px-4 py-1.5 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    {saving ? '저장 중...' : '저장'}
                </button>
            </div>
        </div>
    );
}


// ── Deposit Accounts Section ──────────────────

export function DepositAccountsSection() {
    const [accounts, setAccounts] = useState<DepositAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<DepositAccount>>({});
    const [saving, setSaving] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.from('deposit_accounts').select('*').eq('is_active', true).order('account_type');
        setAccounts(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, []);

    const startEdit = (acc?: DepositAccount) => {
        setEditingId(acc?.id || 'new');
        setForm(acc || { account_name: '', bank_name: '', account_number: '', account_type: 'union', is_official: false });
    };

    const save = async () => {
        setSaving(true);
        const supabase = createClient();
        const payload = {
            account_name: form.account_name || '',
            bank_name: form.bank_name || null,
            account_number: form.account_number || null,
            account_type: form.account_type || 'union',
            is_official: form.is_official ?? false,
        };

        if (editingId === 'new') {
            await supabase.from('deposit_accounts').insert(payload);
        } else {
            await supabase.from('deposit_accounts').update(payload).eq('id', editingId);
        }
        setEditingId(null);
        setForm({});
        await fetchAll();
        setSaving(false);
    };

    const remove = async (id: string) => {
        if (!confirm('이 계좌를 비활성화하시겠습니까?')) return;
        const supabase = createClient();
        await supabase.from('deposit_accounts').update({ is_active: false }).eq('id', id);
        await fetchAll();
    };

    const getAccountBadge = (type: string) => {
        const opt = ACCOUNT_TYPE_OPTIONS.find(o => o.value === type);
        return opt ? <span className={cn("text-[10px] font-bold", opt.color)}>{opt.label}</span> : type;
    };

    return (
        <div className="rounded-lg border border-border bg-card shadow-sm">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    <MaterialIcon name="account_balance" size="sm" className="text-emerald-400" />
                    입금 계좌 관리
                </h3>
                <button onClick={() => startEdit()} className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors flex items-center gap-1">
                    <MaterialIcon name="add" size="xs" /> 추가
                </button>
            </div>
            <div className="p-4">
                {loading ? (
                    <div className="flex justify-center py-6"><MaterialIcon name="progress_activity" className="animate-spin text-muted-foreground" /></div>
                ) : (
                    <div className="space-y-3">
                        {accounts.map(acc => (
                            <div key={acc.id} className={cn("rounded-lg border p-4 transition-all", editingId === acc.id ? "border-primary/30 bg-primary/5" : "border-border bg-background")}>
                                {editingId === acc.id ? (
                                    <AccountForm form={form} setForm={setForm} onSave={save} onCancel={() => { setEditingId(null); setForm({}); }} saving={saving} />
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "size-10 rounded-lg flex items-center justify-center",
                                                acc.account_type === 'union' ? "bg-blue-500/10" :
                                                    acc.account_type === 'trust' ? "bg-emerald-500/10" :
                                                        acc.account_type === 'external' ? "bg-amber-500/10" : "bg-violet-500/10"
                                            )}>
                                                <MaterialIcon
                                                    name={acc.account_type === 'trust' ? 'assured_workload' : 'account_balance'}
                                                    size="sm"
                                                    className={
                                                        acc.account_type === 'union' ? "text-blue-400" :
                                                            acc.account_type === 'trust' ? "text-emerald-400" :
                                                                acc.account_type === 'external' ? "text-amber-400" : "text-violet-400"
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-foreground">{acc.account_name}</p>
                                                    {getAccountBadge(acc.account_type)}
                                                    {acc.is_official && (
                                                        <span className="text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 rounded">공식</span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    {acc.bank_name || '은행 미정'} {acc.account_number ? `· ${acc.account_number}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button onClick={() => startEdit(acc)} className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors">
                                                <MaterialIcon name="edit" size="sm" />
                                            </button>
                                            <button onClick={() => remove(acc.id)} className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                                <MaterialIcon name="delete_outline" size="sm" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {editingId === 'new' && (
                            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                                <AccountForm form={form} setForm={setForm} onSave={save} onCancel={() => { setEditingId(null); setForm({}); }} saving={saving} />
                            </div>
                        )}
                        {accounts.length === 0 && editingId !== 'new' && (
                            <p className="text-sm text-muted-foreground text-center py-6">등록된 계좌가 없습니다.</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function AccountForm({ form, setForm, onSave, onCancel, saving }: {
    form: Partial<DepositAccount>;
    setForm: (f: any) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
}) {
    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">계좌명</label>
                    <input
                        type="text"
                        value={form.account_name || ''}
                        onChange={e => setForm((prev: any) => ({ ...prev, account_name: e.target.value }))}
                        className="w-full h-9 px-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="예: 조합 주거래"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">은행명</label>
                    <input
                        type="text"
                        value={form.bank_name || ''}
                        onChange={e => setForm((prev: any) => ({ ...prev, bank_name: e.target.value }))}
                        className="w-full h-9 px-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="예: 국민은행"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">계좌유형</label>
                    <select
                        value={form.account_type || 'union'}
                        onChange={e => setForm((prev: any) => ({ ...prev, account_type: e.target.value }))}
                        className="w-full h-9 px-2 rounded-md bg-background border border-border text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                        {ACCOUNT_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">공식 계좌</label>
                    <div className="h-9 flex items-center">
                        <button
                            type="button"
                            onClick={() => setForm((prev: any) => ({ ...prev, is_official: !prev.is_official }))}
                            className={cn(
                                "relative w-11 h-6 rounded-full transition-colors",
                                form.is_official ? "bg-primary" : "bg-muted"
                            )}
                        >
                            <span className={cn(
                                "absolute top-1 size-4 rounded-full bg-white transition-transform shadow-sm",
                                form.is_official ? "left-6" : "left-1"
                            )} />
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <button onClick={onCancel} className="px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">취소</button>
                <button onClick={onSave} disabled={saving} className="px-4 py-1.5 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    {saving ? '저장 중...' : '저장'}
                </button>
            </div>
        </div>
    );
}
