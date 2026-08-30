'use client';

import { Input } from '@/components/ui/input';
import { MaterialIcon } from '@/components/ui/icon';
import type { MemberDetailDialogMember, MemberDetailDialogSaveFeedback } from './memberDetailDialogTypes';

type Member = MemberDetailDialogMember;
type Section = 'profile' | 'relations';

type Props = {
    section: Section;
    formData: Partial<Member>;
    saving: boolean;
    saveFeedback?: MemberDetailDialogSaveFeedback | null;
    onFieldChange: (field: keyof Member, value: unknown) => void;
    onSave: () => Promise<boolean>;
    onCancel: () => void;
};

const inputClassName = 'h-9 border-white/10 bg-[#071e32] text-sm font-semibold text-slate-100 placeholder:text-slate-600 focus-visible:ring-cyan-400/60';

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
    return <label className={wide ? 'col-span-full space-y-1.5' : 'space-y-1.5'}><span className="text-[11px] font-bold text-slate-400">{label}</span>{children}</label>;
}

function EditorActions({ saving, onSave, onCancel }: Pick<Props, 'saving' | 'onSave' | 'onCancel'>) {
    return <div className="flex items-center gap-1.5"><button type="button" onClick={onCancel} disabled={saving} className="h-8 rounded-md px-2 text-xs font-bold text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50">취소</button><button type="button" onClick={() => void onSave()} disabled={saving} className="inline-flex h-8 items-center gap-1 rounded-md bg-cyan-500 px-2.5 text-xs font-black text-[#032033] hover:bg-cyan-400 disabled:cursor-wait disabled:opacity-60"><MaterialIcon name={saving ? 'progress_activity' : 'check'} size="xs" className={saving ? 'animate-spin' : ''}/>{saving ? '저장 중' : '저장'}</button></div>;
}

function RepresentativeEditor({
    index,
    value,
    onChange,
}: {
    index: 1 | 2;
    value?: Member['representative'];
    onChange: (value: Member['representative']) => void;
}) {
    const current = value || { name: '', relation: '', phone: null };
    return <div className="rounded-lg border border-emerald-400/10 bg-emerald-500/[0.03] p-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-black text-emerald-200">관계인 {index}</p>{value ? <button type="button" onClick={() => onChange(null)} className="text-[11px] font-bold text-rose-300 hover:text-rose-200">삭제</button> : null}</div><div className="grid gap-2 sm:grid-cols-3 min-[1000px]:grid-cols-1"><Field label="성명"><Input className={inputClassName} value={current.name || ''} onChange={(event) => onChange({ ...current, name: event.target.value })} placeholder="성명" /></Field><Field label="관계"><Input className={inputClassName} value={current.relation || ''} onChange={(event) => onChange({ ...current, relation: event.target.value })} placeholder="자녀, 배우자 등" /></Field><Field label="연락처"><Input className={inputClassName} value={current.phone || ''} onChange={(event) => onChange({ ...current, phone: event.target.value })} placeholder="010-0000-0000" /></Field></div></div>;
}

export function MemberWorkspaceProfileEditor({ section, formData, saving, saveFeedback, onFieldChange, onSave, onCancel }: Props) {
    if (section === 'relations') {
        return <section className="border-b border-white/[0.075] px-4 py-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-slate-100">가족·관계인 편집</h3><p className="mt-0.5 text-[11px] text-slate-500">성명·관계·연락처를 함께 저장해.</p></div><EditorActions saving={saving} onSave={onSave} onCancel={onCancel}/></div><div className="space-y-3"><RepresentativeEditor index={1} value={formData.representative} onChange={(next) => onFieldChange('representative', next)}/><RepresentativeEditor index={2} value={formData.representative2} onChange={(next) => onFieldChange('representative2', next)}/></div>{saveFeedback?.tone === 'error' ? <p className="mt-3 rounded-md border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200">{saveFeedback.message}</p> : null}</section>;
    }

    return <><section className="border-b border-white/[0.075] px-4 py-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-slate-100">통합정보 편집</h3><p className="mt-0.5 text-[11px] text-slate-500">기본정보와 배정정보를 한 번에 저장해.</p></div><EditorActions saving={saving} onSave={onSave} onCancel={onCancel}/></div><div className="grid gap-x-3 gap-y-3 sm:grid-cols-2 min-[1000px]:grid-cols-1"><Field label="이름"><Input className={inputClassName} value={formData.name || ''} onChange={(event) => onFieldChange('name', event.target.value)} /></Field><Field label="생년월일"><Input type="date" className={inputClassName} value={formData.birth_date || ''} onChange={(event) => onFieldChange('birth_date', event.target.value)} /></Field><Field label="주민번호"><Input className={inputClassName} value={formData.resident_registration_number || ''} onChange={(event) => onFieldChange('resident_registration_number', event.target.value)} placeholder="000000-0000000" /></Field><Field label="연락처"><Input className={inputClassName} value={formData.phone || ''} onChange={(event) => onFieldChange('phone', event.target.value)} /></Field><Field label="보조 연락처"><Input className={inputClassName} value={formData.secondary_phone || ''} onChange={(event) => onFieldChange('secondary_phone', event.target.value)} /></Field><Field label="이메일"><Input type="email" className={inputClassName} value={formData.email || ''} onChange={(event) => onFieldChange('email', event.target.value)} /></Field><Field label="주소" wide><Input className={inputClassName} value={formData.address_legal || ''} onChange={(event) => onFieldChange('address_legal', event.target.value)} /></Field><Field label="입주 희망 평형"><Input className={inputClassName} value={formData.preferred_unit_type || ''} onChange={(event) => onFieldChange('preferred_unit_type', event.target.value)} placeholder="예: 84㎡ A형" /></Field><Field label="배정 평형·동호"><Input className={inputClassName} value={formData.unit_group || ''} onChange={(event) => onFieldChange('unit_group', event.target.value)} placeholder="예: 59㎡ · 101동 1203호" /></Field><Field label="관리자 메모" wide><textarea className="min-h-24 w-full resize-y rounded-md border border-white/10 bg-[#071e32] px-3 py-2 text-sm font-medium leading-5 text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20" value={formData.memo || ''} onChange={(event) => onFieldChange('memo', event.target.value)} /></Field></div>{saveFeedback?.tone === 'error' ? <p className="mt-3 rounded-md border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200">{saveFeedback.message}</p> : null}</section></>;
}
