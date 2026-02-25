'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    registerRefundPayment,
    type SettlementActionState,
} from '@/app/actions/settlements';
import { ActionToast } from '@/components/features/settlements/ActionToast';
import { emitSettlementOpsEvent } from '@/components/features/settlements/opsEvents';

const initialState: SettlementActionState = {};

interface RefundPaymentInlineFormProps {
    caseId: string;
    remainingAmount: number;
    defaultReceiverName?: string;
}

function todayISODate() {
    return new Date().toISOString().slice(0, 10);
}

export function RefundPaymentInlineForm({
    caseId,
    remainingAmount,
    defaultReceiverName,
}: RefundPaymentInlineFormProps) {
    const router = useRouter();
    const lastEventTokenRef = useRef<string>('');
    const [open, setOpen] = useState(false);
    const [formKey, setFormKey] = useState(0);
    const [state, formAction, isPending] = useActionState<SettlementActionState, FormData>(
        registerRefundPayment,
        initialState,
    );

    useEffect(() => {
        if (!state.error && !state.message) return;

        const token = `${state.success ? '1' : '0'}|${state.error || ''}|${state.message || ''}`;
        if (lastEventTokenRef.current === token) return;
        lastEventTokenRef.current = token;

        emitSettlementOpsEvent({
            action: 'payment_register',
            ok: !state.error,
            message: state.error || state.message,
            at: new Date().toISOString(),
        });

        if (state.success) {
            router.refresh();
        }
    }, [router, state.error, state.message, state.success]);

    const tone = useMemo(() => {
        if (state.error) return 'text-rose-300';
        if (state.success) return 'text-emerald-300';
        return 'text-slate-400';
    }, [state.error, state.success]);

    if (remainingAmount <= 0) {
        return (
            <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                지급완료
            </span>
        );
    }

    return (
        <>
            <div className="flex flex-col items-end gap-1.5">
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <button
                            type="button"
                            onClick={() => setFormKey((prev) => prev + 1)}
                            className="h-8 px-2.5 rounded border border-sky-400/30 bg-sky-500/10 text-sky-200 text-[11px] font-bold hover:bg-sky-500/20"
                        >
                            지급등록
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[520px] bg-[#0f1725] border-white/10 text-slate-100">
                        <DialogHeader>
                            <DialogTitle className="text-base font-extrabold text-slate-100">환불 지급 등록</DialogTitle>
                            <DialogDescription className="text-slate-400">
                                지급금액과 지급정보를 등록합니다. 잔여 금액을 초과할 수 없습니다.
                            </DialogDescription>
                        </DialogHeader>

                        <form key={formKey} action={formAction} className="grid gap-3 pt-2">
                            <input type="hidden" name="case_id" value={caseId} />

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[11px] text-slate-400">지급 금액</label>
                                    <input
                                        type="number"
                                        name="paid_amount"
                                        min={1}
                                        step={1}
                                        max={Math.round(remainingAmount)}
                                        defaultValue={Math.round(remainingAmount)}
                                        className="w-full h-10 rounded border border-[#3a4f69] bg-[#0b1220] px-2 text-sm text-slate-100 text-right font-mono"
                                        disabled={isPending}
                                        autoFocus
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] text-slate-400">지급일</label>
                                    <input
                                        type="date"
                                        name="paid_date"
                                        defaultValue={todayISODate()}
                                        className="w-full h-10 rounded border border-[#3a4f69] bg-[#0b1220] px-2 text-sm text-slate-100"
                                        disabled={isPending}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[11px] text-slate-400">수령인</label>
                                    <input
                                        type="text"
                                        name="receiver_name"
                                        defaultValue={defaultReceiverName || ''}
                                        placeholder="수령인 성명"
                                        className="w-full h-10 rounded border border-[#3a4f69] bg-[#0b1220] px-2 text-sm text-slate-100"
                                        disabled={isPending}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[11px] text-slate-400">지급참조번호</label>
                                    <input
                                        type="text"
                                        name="payment_reference"
                                        placeholder="이체 참조번호"
                                        className="w-full h-10 rounded border border-[#3a4f69] bg-[#0b1220] px-2 text-sm text-slate-100"
                                        disabled={isPending}
                                    />
                                </div>
                            </div>

                            <div className="rounded border border-amber-400/20 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-200">
                                현재 잔여 환불 가능 금액: {Math.round(remainingAmount).toLocaleString()}원
                            </div>

                            {(state.error || state.message) && (
                                <p className={`text-xs ${tone}`}>{state.error || state.message}</p>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                    type="reset"
                                    className="h-9 px-3 rounded border border-white/15 bg-white/[0.04] text-slate-300 text-xs font-semibold"
                                    disabled={isPending}
                                >
                                    초기화
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="h-9 px-3 rounded border border-white/15 bg-white/[0.04] text-slate-300 text-xs font-semibold"
                                    disabled={isPending}
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="h-9 px-3 rounded border border-sky-400/30 bg-sky-500/10 text-sky-200 text-xs font-bold hover:bg-sky-500/20 disabled:opacity-60"
                                    disabled={isPending}
                                >
                                    {isPending ? '등록중...' : '지급 확정'}
                                </button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
            <ActionToast
                open={Boolean(state.error || state.message)}
                message={state.error || state.message || ''}
                tone={state.error ? 'error' : 'success'}
            />
        </>
    );
}
