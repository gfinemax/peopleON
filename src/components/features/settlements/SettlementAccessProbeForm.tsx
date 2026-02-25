'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import {
    probeSettlementAccess,
    type SettlementActionState,
} from '@/app/actions/settlements';
import { ActionToast } from '@/components/features/settlements/ActionToast';
import { emitSettlementOpsEvent } from '@/components/features/settlements/opsEvents';

const initialState: SettlementActionState = {};

export function SettlementAccessProbeForm() {
    const lastEventTokenRef = useRef<string>('');
    const [expanded, setExpanded] = useState(false);
    const [state, formAction, isPending] = useActionState<SettlementActionState, FormData>(
        probeSettlementAccess,
        initialState,
    );

    useEffect(() => {
        if (!state.error && !state.message) return;

        const token = `${state.success ? '1' : '0'}|${state.error || ''}|${state.message || ''}`;
        if (lastEventTokenRef.current === token) return;
        lastEventTokenRef.current = token;

        emitSettlementOpsEvent({
            action: 'permission_probe',
            ok: !state.error,
            message: state.error || state.message,
            at: new Date().toISOString(),
        });
    }, [state.error, state.message, state.success]);

    const summary = useMemo(() => {
        const details = state.details || [];
        const pass = details.filter((line) => line.startsWith('PASS')).length;
        const fail = details.filter((line) => line.startsWith('FAIL')).length;
        const warn = details.filter((line) => line.startsWith('WARN')).length;
        return { pass, fail, warn };
    }, [state.details]);

    const visibleDetails = expanded ? (state.details || []) : (state.details || []).slice(0, 6);

    return (
        <>
            <form action={formAction} className="flex flex-col items-start gap-1">
                <button
                    type="submit"
                    disabled={isPending}
                    className="h-9 px-3 rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-amber-500/20 disabled:opacity-60"
                >
                    <MaterialIcon name={isPending ? 'hourglass_top' : 'rule'} size="sm" />
                    {isPending ? '점검 중...' : '권한/RLS 점검'}
                </button>

                {state.details && state.details.length > 0 && (
                    <div className="mt-1 w-full max-w-[560px] rounded border border-white/10 bg-[#0b1220] px-2.5 py-2 text-[10px] text-slate-300 leading-relaxed">
                        <div className="mb-1.5 flex items-center gap-2">
                            <span className="rounded border border-emerald-300/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-200">PASS {summary.pass}</span>
                            <span className="rounded border border-amber-300/20 bg-amber-500/10 px-1.5 py-0.5 text-amber-200">WARN {summary.warn}</span>
                            <span className="rounded border border-rose-300/20 bg-rose-500/10 px-1.5 py-0.5 text-rose-200">FAIL {summary.fail}</span>
                        </div>
                        {visibleDetails.map((line, index) => (
                            <p key={`probe-line-${index}`}>{line}</p>
                        ))}
                        {state.details.length > 6 && (
                            <button
                                type="button"
                                onClick={() => setExpanded((prev) => !prev)}
                                className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-sky-300 hover:text-sky-200"
                            >
                                <MaterialIcon name={expanded ? 'expand_less' : 'expand_more'} size="xs" />
                                {expanded ? '결과 접기' : `전체 보기 (${state.details.length})`}
                            </button>
                        )}
                    </div>
                )}
            </form>
            <ActionToast
                open={Boolean(state.error || state.message)}
                message={state.error || state.message || ''}
                tone={state.error ? 'error' : state.success ? 'success' : 'info'}
            />
        </>
    );
}
