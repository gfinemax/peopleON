'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { UnitTypeForm } from './FinancialSettingsForms';
import {
    buildUnitTypePayload,
    createEmptyUnitTypeForm,
    formatFinancialAmount,
    type UnitType,
} from './financialSettingsUtils';
import {
    FinancialSettingsSectionCard,
    FinancialSettingsSectionLoading,
} from './FinancialSettingsPrimitives';

export function UnitTypesSection() {
    const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Partial<UnitType>>({});
    const [saving, setSaving] = useState(false);

    const resetEditor = () => {
        setEditingId(null);
        setForm({});
    };

    const fetchAll = async () => {
        setLoading(true);
        const supabase = createClient();
        const { data } = await supabase.from('unit_types').select('*').eq('is_active', true).order('area_sqm');
        setUnitTypes(data || []);
        setLoading(false);
    };

    useEffect(() => {
        void fetchAll();
    }, []);

    const startEdit = (unitType?: UnitType) => {
        setEditingId(unitType?.id || 'new');
        setForm(unitType || createEmptyUnitTypeForm());
    };

    const save = async () => {
        setSaving(true);
        const supabase = createClient();
        const payload = buildUnitTypePayload(form);

        if (editingId === 'new') {
            await supabase.from('unit_types').insert(payload);
        } else {
            await supabase.from('unit_types').update(payload).eq('id', editingId);
        }

        resetEditor();
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
        <FinancialSettingsSectionCard
            title="입주평형 관리"
            iconName="straighten"
            iconClassName="text-sky-400"
            onAdd={() => startEdit()}
        >
            {loading ? (
                <FinancialSettingsSectionLoading />
            ) : (
                <div className="space-y-3">
                    {unitTypes.map((unitType) => (
                        <div
                            key={unitType.id}
                            className={cn(
                                'rounded-lg border p-4 transition-all',
                                editingId === unitType.id ? 'border-primary/30 bg-primary/5' : 'border-border bg-background',
                            )}
                        >
                            {editingId === unitType.id ? (
                                <UnitTypeForm
                                    form={form}
                                    setForm={setForm}
                                    onSave={save}
                                    onCancel={resetEditor}
                                    saving={saving}
                                />
                            ) : (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="flex size-10 items-center justify-center rounded-lg bg-sky-500/10">
                                            <span className="text-sm font-black text-sky-400">{unitType.area_sqm}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground">{unitType.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                필증 {formatFinancialAmount(unitType.certificate_amount)} · 계약{' '}
                                                {formatFinancialAmount(unitType.contract_amount)} · 1차{' '}
                                                {formatFinancialAmount(unitType.installment_1_amount)} · 2차{' '}
                                                {formatFinancialAmount(unitType.installment_2_amount)} · 잔금{' '}
                                                {formatFinancialAmount(unitType.balance_amount)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => startEdit(unitType)}
                                            className="rounded p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                        >
                                            <MaterialIcon name="edit" size="sm" />
                                        </button>
                                        <button
                                            onClick={() => remove(unitType.id)}
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
                            <UnitTypeForm form={form} setForm={setForm} onSave={save} onCancel={resetEditor} saving={saving} />
                        </div>
                    )}

                    {unitTypes.length === 0 && editingId !== 'new' && (
                        <p className="py-6 text-center text-sm text-muted-foreground">등록된 평형이 없습니다.</p>
                    )}
                </div>
            )}
        </FinancialSettingsSectionCard>
    );
}
