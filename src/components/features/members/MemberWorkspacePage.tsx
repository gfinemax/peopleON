'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';
import type { MemberDetailDialogMember } from './memberDetailDialogTypes';
import type { MemberWorkspaceColumnId } from './memberWorkspacePresets';
import { MEMBER_WORKSPACE_COLUMNS } from './memberWorkspacePresets';
import { PAYMENT_TYPE_LABELS, type PaymentRecord } from './paymentStatusTabUtils';

type LogRow = {
    id: string;
    type: string | null;
    summary: string | null;
    staff_name: string | null;
    attachment: string | null;
    created_at: string;
};

interface WorkspaceData {
    payments: PaymentRecord[];
    logs: LogRow[];
}

const money = (value: number) => `${Math.round(value).toLocaleString('ko-KR')}원`;
const date = (value?: string | null) => value ? value.slice(0, 10) : '-';
const value = (input?: string | null) => input?.trim() || '-';

function useWorkspaceData(memberIds: string[]): WorkspaceData & { loading: boolean } {
    const [data, setData] = useState<WorkspaceData>({ payments: [], logs: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            const supabase = createClient();
            const [payments, logs] = await Promise.all([
                supabase.from('member_payments').select('*').in('entity_id', memberIds).order('sort_order'),
                supabase.from('interaction_logs').select('id,type,summary,staff_name,attachment,created_at').in('entity_id', memberIds).order('created_at', { ascending: false }).limit(30),
            ]);
            if (!cancelled) {
                setData({ payments: (payments.data || []) as PaymentRecord[], logs: (logs.data || []) as LogRow[] });
                setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [memberIds]);

    return { ...data, loading };
}

function Row({ label, children, strong = false }: { label: string; children: React.ReactNode; strong?: boolean }) {
    return <div className="grid min-h-7 grid-cols-[92px_minmax(0,1fr)] items-start border-b border-white/[0.055] py-1.5 text-[11px] last:border-b-0"><span className="text-slate-500">{label}</span><span className={strong ? 'font-bold text-slate-100' : 'text-slate-300'}>{children}</span></div>;
}

function Block({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
    return <section className="border-b border-white/[0.075] px-3 py-3 last:border-b-0"><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-black text-slate-100">{title}</h3>{action ? <span className="text-[10px] font-bold text-sky-400">{action}</span> : null}</div>{children}</section>;
}

export function MemberWorkspaceSummary({ member, visibleCount, onEdit, onBack }: { member: MemberDetailDialogMember; visibleCount: number; onEdit: () => void; onBack: () => void }) {
    const ids = [member.id];
    const { payments, logs } = useWorkspaceData(ids);
    const due = payments.reduce((sum, item) => sum + Number(item.amount_due || 0), 0);
    const paid = payments.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
    const rate = due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0;
    const latest = logs[0]?.created_at;
    const initials = member.name?.slice(0, 1) || '조';
    return <div className="m-3 grid min-h-[82px] grid-cols-[minmax(300px,1.8fr)_repeat(6,minmax(92px,1fr))_auto] items-center rounded-lg border border-white/[0.06] bg-[#0d2942] px-4 shadow-lg shadow-black/10">
        <div className="flex min-w-0 items-center gap-3 border-r border-white/[0.07] pr-4"><div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl font-black text-sky-700">{initials}</div><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="truncate text-xl font-black text-white">{member.name}</h1><span className="rounded bg-emerald-500/20 px-2 py-1 text-[10px] font-bold text-emerald-300">{member.status || '정상'}</span></div><p className="mt-1 truncate text-[10px] text-slate-400">회원번호 {member.member_number || '-'} <span className="mx-2 text-white/10">|</span> 연락처 {value(member.phone)}</p></div></div>
        <Metric label="희망 평형" text={value(member.preferred_unit_type)} />
        <Metric label="배정 평형" text={value(member.unit_group)} />
        <Metric label="증빙서류" text={`${logs.filter((log) => log.type === 'DOC' || log.attachment).length}건`} />
        <Metric label="납부율" text={`${rate}%`} progress={rate} />
        <Metric label="미납금" text={money(Math.max(0, due - paid))} danger />
        <Metric label="최근 상담일" text={date(latest)} />
        <div className="flex items-center gap-1 pl-3"><button onClick={onEdit} className="h-8 rounded border border-white/15 px-3 text-[10px] font-bold text-slate-200 hover:bg-white/5">상세 수정</button><button onClick={onBack} aria-label="목록으로" className="flex size-8 items-center justify-center text-slate-400 hover:text-white"><MaterialIcon name="chevron_left" size="sm" /></button></div>
        <span className="sr-only">현재 {visibleCount}개 열 표시</span>
    </div>;
}

function Metric({ label, text, progress, danger }: { label: string; text: string; progress?: number; danger?: boolean }) {
    return <div className="px-3 text-center"><p className="text-[10px] font-bold text-slate-500">{label}</p><p className={`mt-1 truncate text-sm font-black ${danger ? 'text-orange-500' : 'text-slate-100'}`}>{text}</p>{progress !== undefined ? <div className="mx-auto mt-1 h-0.5 w-16 overflow-hidden rounded bg-white/10"><div className="h-full bg-emerald-400" style={{ width: `${progress}%` }} /></div> : null}</div>;
}

export function MemberWorkspaceBoard({ memberIds, member, formData, columns }: { memberIds: string[]; member: MemberDetailDialogMember; formData: Partial<MemberDetailDialogMember>; columns: MemberWorkspaceColumnId[] }) {
    const { payments, logs, loading } = useWorkspaceData(memberIds);
    const width = columns.length >= 5 ? 270 : columns.length === 4 ? 310 : 380;
    return <div className="flex min-h-0 flex-1 flex-col bg-[#071e32]">
        <div className="mx-3 mb-1 flex min-h-12 shrink-0 items-center rounded-lg border border-white/[0.06] bg-[#0d2942] px-4"><div><strong className="text-xs text-slate-100">열 작업대</strong><span className="ml-2 text-[10px] text-slate-500">상단 구성 메뉴로 업무별 열을 전환하거나 열 선택에서 직접 구성할 수 있어.</span></div></div>
        <div className="flex-1 overflow-auto px-3 pb-3 scrollbar-thin scrollbar-thumb-white/10"><div className="grid min-h-full items-stretch gap-2" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(${width}px, 1fr))`, minWidth: columns.length * width + (columns.length - 1) * 8 }}>
            {columns.map((id) => <WorkspaceColumn key={id} id={id}><ColumnContent id={id} member={member} formData={formData} payments={payments} logs={logs} loading={loading} /></WorkspaceColumn>)}
        </div></div>
    </div>;
}

function WorkspaceColumn({ id, children }: { id: MemberWorkspaceColumnId; children: React.ReactNode }) {
    const definition = MEMBER_WORKSPACE_COLUMNS.find((item) => item.id === id);
    return <section className="min-w-0 overflow-hidden rounded-lg border border-white/[0.09] bg-[#0b263d]"><header className="flex h-11 items-center gap-2 border-b border-white/[0.09] px-3"><MaterialIcon name="drag_indicator" size="xs" className="text-slate-500"/><h2 className="text-sm font-black text-slate-100">{definition?.label}</h2><MaterialIcon name="minimize" size="xs" className="ml-auto text-slate-500"/></header>{children}</section>;
}

function ColumnContent({ id, member, formData, payments, logs, loading }: { id: MemberWorkspaceColumnId; member: MemberDetailDialogMember; formData: Partial<MemberDetailDialogMember>; payments: PaymentRecord[]; logs: LogRow[]; loading: boolean }) {
    const rights = formData.assetRights || [];
    if (id === 'profile') return <><Block title="기본 정보" action="수정"><Row label="이름" strong>{value(member.name)}</Row><Row label="생년월일">{date(member.birth_date)}</Row><Row label="성별">-</Row><Row label="연락처">{value(member.phone)}</Row><Row label="보조 연락처">{value(member.secondary_phone)}</Row><Row label="이메일">{value(member.email)}</Row><Row label="주소">{value(member.address_legal)}</Row></Block><Block title="선택 정보"><Row label="입주민 추천">-</Row><Row label="희망 평형" strong>{value(formData.preferred_unit_type)}</Row><Row label="배정 평형">{value(formData.unit_group)}</Row><Row label="비고">{value(formData.memo)}</Row></Block></>;
    if (id === 'relations') { const people = [member.representative, member.representative2].filter(Boolean); return <><Block title="가족·관계인" action="+ 추가">{people.length ? people.map((person) => <div key={person?.id || person?.name} className="grid grid-cols-[1fr_70px] gap-2 border-b border-white/[0.06] py-2 text-[11px]"><div><b className="text-slate-100">{person?.name}</b><span className="ml-2 text-emerald-400">{person?.relation}</span></div><span className="text-right text-slate-400">{value(person?.phone)}</span></div>) : <Empty text="등록된 관계인이 없어." />}</Block><Block title="대리 업무"><Row label="대리 인원">{member.acts_as_agent_for?.length || 0}명</Row>{member.acts_as_agent_for?.map((item) => <Row key={item.id} label={item.relation}>{item.name}</Row>)}</Block></>; }
    if (id === 'finance') { const due = payments.reduce((s,p)=>s+Number(p.amount_due||0),0); const paid = payments.reduce((s,p)=>s+Number(p.amount_paid||0),0); return <><Block title="조합원 자격" action="수정"><Row label="조합원 구분">{member.tiers?.join(', ') || member.tier || '-'}</Row><Row label="조합원 지위">{member.status || '-'}</Row><Row label="권리증">{rights.length}건</Row>{rights.slice(0,4).map((right, index)=><Row key={right.id} label={`권리 ${index+1}`}>{right.right_number || '-'}</Row>)}</Block><Block title="납부 현황" action={due ? `납부율 ${Math.round(paid/due*100)}%` : '납부율 0%'}><Row label="총 분담금">{money(due)}</Row><Row label="납부 총액">{money(paid)}</Row><Row label="미납 총액" strong>{money(Math.max(0,due-paid))}</Row>{payments.slice(0,8).map((payment)=><div key={payment.id} className="grid grid-cols-[1fr_auto] gap-2 border-b border-white/[0.055] py-2 text-[10px]"><span className="text-slate-400">{PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type}</span><span className={payment.amount_paid >= payment.amount_due ? 'text-emerald-400' : 'text-orange-400'}>{money(payment.amount_paid)}</span></div>)}</Block></>; }
    if (id === 'timeline') return <><Block title="최근 상담" action="+ 상담 등록">{loading ? <Empty text="불러오는 중..." /> : logs.filter((log)=>log.type !== 'DOC').slice(0,6).map((log)=><div key={log.id} className="border-b border-white/[0.06] py-2"><div className="flex justify-between text-[10px]"><span className="font-bold text-slate-300">{date(log.created_at)} · {log.type || 'NOTE'}</span><span className="text-slate-600">{log.staff_name || '조합사무실'}</span></div><p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-400">{log.summary || '-'}</p></div>)}</Block><Block title="활동 내역">{logs.slice(6,12).map((log)=><Row key={log.id} label={date(log.created_at)}>{log.summary || '-'}</Row>)}</Block></>;
    const docs = logs.filter((log)=>log.type === 'DOC' || log.attachment);
    return <><Block title="증빙서류" action={`+ 업로드  ${docs.length}건`}>{docs.length ? docs.slice(0,8).map((log)=><div key={log.id} className="grid grid-cols-[1fr_70px] gap-2 border-b border-white/[0.06] py-2 text-[10px]"><span className="truncate font-bold text-slate-300">{log.attachment || log.summary || '서류 기록'}</span><span className="text-right text-emerald-400">{date(log.created_at)}</span></div>) : <Empty text="등록된 문서가 없어." />}</Block><Block title="권리증 문서"><Row label="보유 건수">{rights.length}건</Row>{rights.slice(0,8).map((right)=><Row key={right.id} label="권리증">{right.right_number || '-'}</Row>)}</Block></>;
}

function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-[10px] text-slate-600">{text}</p>; }
