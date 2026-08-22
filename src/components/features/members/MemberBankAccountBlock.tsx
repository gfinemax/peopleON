'use client';

import { useEffect, useState } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import {
    maskBankAccountNumber,
    MEMBER_BANK_ACCOUNT_PURPOSES,
    type MemberBankAccount,
} from '@/lib/members/memberBankAccount';

const emptyAccount: MemberBankAccount = {
    bank_name: '',
    account_number: '',
    account_holder: '',
    purpose: 'refund',
};

export function MemberBankAccountBlock({ memberId }: { memberId: string }) {
    const [account, setAccount] = useState<MemberBankAccount | null>(null);
    const [form, setForm] = useState<MemberBankAccount>(emptyAccount);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [message, setMessage] = useState('');
    const [allowed, setAllowed] = useState(true);

    useEffect(() => {
        let cancelled = false;
        void fetch(`/api/members/${memberId}/bank-account`, { cache: 'no-store' })
            .then(async (response) => ({ response, payload: await response.json().catch(() => null) }))
            .then(({ response, payload }) => {
                if (cancelled) return;
                if (response.status === 403) {
                    setAllowed(false);
                    return;
                }
                const next = payload?.account || null;
                setAccount(next);
                setForm(next || emptyAccount);
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [memberId]);

    if (!allowed) return null;

    const startEdit = () => {
        setForm(account || emptyAccount);
        setMessage('');
        setRevealed(false);
        setEditing(true);
    };

    const save = async () => {
        setSaving(true);
        setMessage('');
        const response = await fetch(`/api/members/${memberId}/bank-account`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
            setMessage(payload?.error || '계좌정보를 저장하지 못했습니다.');
        } else {
            setAccount(payload.account);
            setForm(payload.account);
            setEditing(false);
            setMessage('저장됐어. 회계프로그램의 API 자료 확인에서 선택 반영할 수 있어.');
        }
        setSaving(false);
    };

    return <section className="border-b border-white/[0.075] px-4 py-4 last:border-b-0">
        <div className="mb-2.5 flex items-center justify-between gap-3">
            <h3 className="whitespace-nowrap text-sm font-black text-slate-100">환불·지급 계좌</h3>
            {!loading && !editing ? <button type="button" onClick={startEdit} className="whitespace-nowrap rounded px-1.5 py-1 text-xs font-bold text-sky-400 hover:bg-sky-500/10 hover:text-sky-300">{account ? '계좌 수정' : '계좌 등록'}</button> : null}
        </div>
        {loading ? <p className="py-4 text-center text-xs font-medium text-slate-500">계좌정보를 불러오는 중...</p> : editing ? <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-[11px] font-bold text-slate-400">은행명<input value={form.bank_name} onChange={(event) => setForm((previous) => ({ ...previous, bank_name: event.target.value }))} placeholder="예: 국민은행" className="h-9 w-full rounded border border-white/10 bg-[#071e32] px-2 text-sm text-slate-100 outline-none focus:border-sky-400" /></label>
                <label className="space-y-1 text-[11px] font-bold text-slate-400">예금주<input value={form.account_holder} onChange={(event) => setForm((previous) => ({ ...previous, account_holder: event.target.value }))} placeholder="예: 오학동" className="h-9 w-full rounded border border-white/10 bg-[#071e32] px-2 text-sm text-slate-100 outline-none focus:border-sky-400" /></label>
            </div>
            <label className="block space-y-1 text-[11px] font-bold text-slate-400">계좌번호<input inputMode="numeric" value={form.account_number} onChange={(event) => setForm((previous) => ({ ...previous, account_number: event.target.value }))} placeholder="예: 123-456-789012" className="h-9 w-full rounded border border-white/10 bg-[#071e32] px-2 text-sm tabular-nums text-slate-100 outline-none focus:border-sky-400" /></label>
            <label className="block space-y-1 text-[11px] font-bold text-slate-400">용도<select value={form.purpose} onChange={(event) => setForm((previous) => ({ ...previous, purpose: event.target.value as MemberBankAccount['purpose'] }))} className="h-9 w-full rounded border border-white/10 bg-[#071e32] px-2 text-sm text-slate-100 outline-none focus:border-sky-400">{MEMBER_BANK_ACCOUNT_PURPOSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            {message ? <p className="text-xs font-semibold text-rose-300">{message}</p> : null}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(false)} className="h-8 rounded border border-white/10 px-3 text-xs font-bold text-slate-300">취소</button><button type="button" disabled={saving} onClick={() => void save()} className="h-8 rounded bg-sky-500 px-3 text-xs font-black text-white disabled:opacity-50">{saving ? '저장 중...' : '저장'}</button></div>
        </div> : account ? <div className="space-y-1">
            <div className="grid min-h-9 grid-cols-[108px_minmax(0,1fr)] items-center border-b border-white/[0.055] py-2 text-[13px]"><span className="font-medium text-slate-400">은행·예금주</span><span className="truncate font-semibold text-slate-200">{account.bank_name} · {account.account_holder}</span></div>
            <div className="grid min-h-9 grid-cols-[108px_minmax(0,1fr)] items-center border-b border-white/[0.055] py-2 text-[13px]"><span className="font-medium text-slate-400">계좌번호</span><span className="inline-flex min-w-0 items-center gap-1.5 font-semibold tabular-nums text-slate-200"><span className="truncate">{revealed ? account.account_number : maskBankAccountNumber(account.account_number)}</span><button type="button" onClick={() => setRevealed((value) => !value)} aria-label={revealed ? '계좌번호 감추기' : '계좌번호 보기'} aria-pressed={revealed} className="inline-flex size-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white/5 hover:text-sky-300"><MaterialIcon name={revealed ? 'visibility_off' : 'visibility'} size="xs" /></button></span></div>
            <div className="grid min-h-9 grid-cols-[108px_minmax(0,1fr)] items-center py-2 text-[13px]"><span className="font-medium text-slate-400">용도</span><span className="font-semibold text-slate-200">{MEMBER_BANK_ACCOUNT_PURPOSES.find((option) => option.value === account.purpose)?.label || '기타'}</span></div>
        </div> : <p className="py-5 text-center text-xs font-medium text-slate-500">등록된 환불·지급 계좌가 없어.</p>}
        {!editing && message ? <p className="mt-2 text-[11px] font-semibold leading-4 text-emerald-300">{message}</p> : null}
    </section>;
}
