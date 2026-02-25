'use client';

import { useActionState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MaterialIcon } from '@/components/ui/icon';
import {
    syncSettlementCaseStatuses,
    type SettlementActionState,
} from '@/app/actions/settlements';
import { ActionToast } from '@/components/features/settlements/ActionToast';
import { emitSettlementOpsEvent } from '@/components/features/settlements/opsEvents';

const initialState: SettlementActionState = {};

export function SettlementStatusSyncForm() {
    const router = useRouter();
    const lastEventTokenRef = useRef<string>('');
    const [state, formAction, isPending] = useActionState<SettlementActionState, FormData>(
        syncSettlementCaseStatuses,
        initialState,
    );

    useEffect(() => {
        if (!state.error && !state.message) return;

        const token = `${state.success ? '1' : '0'}|${state.error || ''}|${state.message || ''}|${state.scannedCount || 0}`;
        if (lastEventTokenRef.current === token) return;
        lastEventTokenRef.current = token;

        emitSettlementOpsEvent({
            action: 'status_sync',
            ok: !state.error,
            message: state.error || state.message,
            at: new Date().toISOString(),
        });

        if (state.success) {
            router.refresh();
        }
    }, [router, state.error, state.message, state.scannedCount, state.success]);

    const statusTone = useMemo(() => {
        if (state.error) return 'text-rose-300';
        if (state.success) return 'text-emerald-300';
        return 'text-slate-400';
    }, [state.error, state.success]);

    return (
        <>
            <form action={formAction} className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        name="limit"
                        min={1}
                        max={20000}
                        defaultValue={2000}
                        className="w-20 h-9 rounded-lg border border-[#3a4f69] bg-[#0b1220] px-2 text-xs text-slate-100 text-right font-mono"
                    />
                    <button
                        type="submit"
                        disabled={isPending}
                        className="h-9 px-3 rounded-lg border border-indigo-400/30 bg-indigo-500/10 text-indigo-200 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-indigo-500/20 disabled:opacity-60"
                    >
                        <MaterialIcon name={isPending ? 'hourglass_top' : 'sync_alt'} size="sm" />
                        {isPending ? '동기화 중...' : '상태 동기화'}
                    </button>
                </div>
                {(state.error || state.message) && (
                    <p className={`text-[11px] ${statusTone}`}>
                        {state.error || state.message}
                        {state.scannedCount ? ` · 스캔 ${state.scannedCount.toLocaleString()}건` : ''}
                    </p>
                )}
            </form>
            <ActionToast
                open={Boolean(state.error || state.message)}
                message={state.error || state.message || ''}
                tone={state.error ? 'error' : 'success'}
            />
        </>
    );
}
