'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';
import type { MemberDetailDialogMember } from './memberDetailDialogTypes';
import type { TabType } from './memberDetailDialogTypes';
import type { MemberWorkspaceColumnId } from './memberWorkspacePresets';
import { MEMBER_WORKSPACE_COLUMNS } from './memberWorkspacePresets';
import { PAYMENT_TYPE_LABELS, type PaymentRecord } from './paymentStatusTabUtils';
import { MemberProfilePhoto } from './MemberProfilePhoto';

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
const getMemberCategory = (member: MemberDetailDialogMember) => {
    const tiers = [...(member.tiers || []), member.tier || '', member.role_code || '', member.status || ''];
    const hasTier = (keyword: string) => tiers.some((tier) => tier.includes(keyword));

    if (hasTier('환불')) return '환불조합원';
    if (member.owner_group === 'registered' || member.is_registered || hasTier('등기조합원')) return '등기조합원';
    if (hasTier('예비')) return '예비조합원';
    if (hasTier('관계인')) return '관계인';
    if (member.acts_as_agent_for?.length || hasTier('대리인')) return '대리인';
    if (member.assetRights?.length || hasTier('권리증') || hasTier('가입신청필증') || hasTier('투자')) return '투자자';
    return '미분류';
};

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

function Row({ label, children, strong = false, multiline = false }: { label: string; children: React.ReactNode; strong?: boolean; multiline?: boolean }) {
    const title = typeof children === 'string' || typeof children === 'number' ? String(children) : undefined;
    return <div className="grid min-h-9 grid-cols-[108px_minmax(0,1fr)] items-center border-b border-white/[0.055] py-2 text-[13px] last:border-b-0"><span className="whitespace-nowrap font-medium text-slate-400">{label}</span><span title={title} className={`${strong ? 'font-bold text-slate-100' : 'font-medium text-slate-200'} ${multiline ? 'line-clamp-2 leading-5' : 'truncate whitespace-nowrap'}`}>{children}</span></div>;
}

function Block({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
    return <section className="border-b border-white/[0.075] px-4 py-4 last:border-b-0"><div className="mb-2.5 flex items-center justify-between gap-3"><h3 className="whitespace-nowrap text-sm font-black text-slate-100">{title}</h3>{action ? <button type="button" onClick={onAction} className="whitespace-nowrap rounded px-1.5 py-1 text-xs font-bold text-sky-400 hover:bg-sky-500/10 hover:text-sky-300">{action}</button> : null}</div>{children}</section>;
}

export function MemberWorkspaceSummary({ member, onEdit, onDelete, onPrint, onBack, onPhotoChanged }: { member: MemberDetailDialogMember; onEdit: () => void; onDelete: () => void; onPrint: () => void; onBack: () => void; onPhotoChanged?: () => void }) {
    const ids = [member.id];
    const { payments, logs } = useWorkspaceData(ids);
    const due = payments.reduce((sum, item) => sum + Number(item.amount_due || 0), 0);
    const paid = payments.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
    const rate = due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0;
    const latest = logs[0]?.created_at;
    const memberCategory = getMemberCategory(member);
    return <div className="m-3 grid min-h-[82px] grid-cols-[minmax(300px,1.8fr)_repeat(6,minmax(92px,1fr))_auto] items-center rounded-lg border border-white/[0.06] bg-[#0d2942] px-4 shadow-lg shadow-black/10">
        <div className="flex min-w-0 items-center gap-3 border-r border-white/[0.07] pr-4"><MemberProfilePhoto memberId={member.id} name={member.name} hasImage={Boolean(member.profile_image_path)} onChanged={onPhotoChanged} /><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-2xl font-black text-white">{member.name}</h2><span className="whitespace-nowrap rounded-full border border-cyan-400/15 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-300">{memberCategory}</span></div><p className="mt-1 truncate whitespace-nowrap text-xs font-medium text-slate-400">회원번호(필증번호) {member.member_number || '-'}</p></div></div>
        <Metric label="희망 평형" text={value(member.preferred_unit_type)} />
        <Metric label="배정 평형" text={value(member.unit_group)} />
        <Metric label="증빙서류" text={`${logs.filter((log) => log.type === 'DOC' || log.attachment).length}건`} />
        <Metric label="납부율" text={`${rate}%`} progress={rate} />
        <Metric label="미납금" text={money(Math.max(0, due - paid))} danger />
        <Metric label="최근 상담일" text={date(latest)} />
        <div className="flex items-center gap-1 pl-3"><button onClick={onDelete} className="flex h-9 items-center gap-1 whitespace-nowrap rounded border border-rose-400/15 px-2 text-xs font-bold text-rose-300 hover:bg-rose-500/10"><MaterialIcon name="delete_outline" size="xs" />삭제</button><button onClick={onEdit} className="flex h-9 items-center gap-1 whitespace-nowrap rounded border border-white/15 px-2 text-xs font-bold text-slate-200 hover:bg-white/5"><MaterialIcon name="edit" size="xs" />수정</button><button onClick={onPrint} className="flex h-9 items-center gap-1 whitespace-nowrap rounded border border-sky-400/15 px-2 text-xs font-bold text-sky-200 hover:bg-sky-500/10"><MaterialIcon name="picture_as_pdf" size="xs" />공유/PDF</button><button onClick={onBack} aria-label="목록으로" className="flex size-9 items-center justify-center text-slate-400 hover:text-white"><MaterialIcon name="chevron_left" size="sm" /></button></div>
    </div>;
}

function Metric({ label, text, progress, danger }: { label: string; text: string; progress?: number; danger?: boolean }) {
    return <div className="min-w-0 px-3 text-center"><p className="whitespace-nowrap text-xs font-bold text-slate-400">{label}</p><p title={text} className={`mt-1 truncate whitespace-nowrap text-base font-black tabular-nums ${danger ? 'text-orange-500' : 'text-slate-100'}`}>{text}</p>{progress !== undefined ? <div className="mx-auto mt-1 h-0.5 w-16 overflow-hidden rounded bg-white/10"><div className="h-full bg-emerald-400" style={{ width: `${progress}%` }} /></div> : null}</div>;
}

export function MemberWorkspaceBoard({ memberIds, member, formData, columns, onOpenManagement }: { memberIds: string[]; member: MemberDetailDialogMember; formData: Partial<MemberDetailDialogMember>; columns: MemberWorkspaceColumnId[]; onOpenManagement?: (tab: TabType) => void }) {
    const { payments, logs, loading } = useWorkspaceData(memberIds);
    return <div className="flex min-h-0 flex-1 flex-col bg-[#071e32]">
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-3 pb-3 scrollbar-thin scrollbar-thumb-white/10"><div className="grid min-h-full grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] items-stretch gap-2">
            {columns.map((id) => <WorkspaceColumn key={id} id={id}><ColumnContent id={id} member={member} formData={formData} payments={payments} logs={logs} loading={loading} onOpenManagement={onOpenManagement} /></WorkspaceColumn>)}
        </div></div>
    </div>;
}

function WorkspaceColumn({ id, children }: { id: MemberWorkspaceColumnId; children: React.ReactNode }) {
    const definition = MEMBER_WORKSPACE_COLUMNS.find((item) => item.id === id);
    return <section className="min-w-0 overflow-hidden rounded-lg border border-white/[0.09] bg-[#0b263d]"><header className="flex h-12 items-center gap-2 border-b border-white/[0.09] px-4"><MaterialIcon name="drag_indicator" size="xs" className="text-slate-500"/><h2 className="whitespace-nowrap text-base font-black text-slate-100">{definition?.label}</h2><MaterialIcon name="minimize" size="xs" className="ml-auto text-slate-500"/></header>{children}</section>;
}

function ColumnContent({ id, member, formData, payments, logs, loading, onOpenManagement }: { id: MemberWorkspaceColumnId; member: MemberDetailDialogMember; formData: Partial<MemberDetailDialogMember>; payments: PaymentRecord[]; logs: LogRow[]; loading: boolean; onOpenManagement?: (tab: TabType) => void }) {
    const rights = formData.assetRights || [];
    const memberCategory = getMemberCategory(member);
    if (id === 'profile') { const people = [member.representative, member.representative2].filter(Boolean); const maskedSsn = member.resident_registration_number ? `${member.resident_registration_number.slice(0, 8)}******` : '-'; return <><Block title="기본 정보" action="수정" onAction={() => onOpenManagement?.('info')}><Row label="이름" strong>{value(member.name)}</Row><Row label="회원번호(필증번호)">{value(member.member_number)}</Row><Row label="생년월일">{date(member.birth_date)}</Row><Row label="주민번호">{maskedSsn}</Row><Row label="연락처">{value(member.phone)}</Row><Row label="보조 연락처">{value(member.secondary_phone)}</Row><Row label="이메일">{value(member.email)}</Row><Row label="주소">{value(member.address_legal)}</Row><Row label="가입 구분">{memberCategory}</Row></Block><Block title="선택·배정 정보"><Row label="희망 평형" strong>{value(formData.preferred_unit_type)}</Row><Row label="배정 평형·동호">{value(formData.unit_group)}</Row><Row label="소유 구분">{member.owner_group === 'registered' ? '등기조합원' : '기타'}</Row><Row label="관리자 메모" multiline>{value(formData.memo)}</Row></Block><Block title="가족·관계인" action="+ 추가" onAction={() => onOpenManagement?.('info')}>{people.length ? people.map((person) => <div key={person?.id || person?.name} className="grid min-h-10 grid-cols-[minmax(90px,1fr)_64px_130px] items-center gap-2 border-b border-white/[0.06] py-2 text-[13px]"><b className="truncate whitespace-nowrap text-slate-100" title={person?.name}>{person?.name}</b><span className="truncate whitespace-nowrap font-semibold text-emerald-400" title={person?.relation}>{person?.relation}</span><span className="whitespace-nowrap text-right font-medium tabular-nums text-slate-300" title={value(person?.phone)}>{value(person?.phone)}</span></div>) : <Empty text="등록된 관계인이 없어." />}{member.acts_as_agent_for?.map((item) => <Row key={item.id} label={`${item.relation} 대리`}>{item.name}</Row>)}</Block>{member.tags?.length ? <Block title="AI 분석 인사이트"><div className="flex flex-wrap gap-2">{member.tags.map((tag) => <span key={tag} className="rounded-lg border border-cyan-400/15 bg-cyan-500/10 px-2 py-1 text-xs font-bold text-cyan-200">{tag}</span>)}</div></Block> : null}</>; }
    if (id === 'relations') { const people = [member.representative, member.representative2].filter(Boolean); return <><Block title="가족·관계인" action="+ 추가">{people.length ? people.map((person) => <div key={person?.id || person?.name} className="grid min-h-10 grid-cols-[minmax(90px,1fr)_64px_130px] items-center gap-2 border-b border-white/[0.06] py-2 text-[13px]"><b className="truncate whitespace-nowrap text-slate-100" title={person?.name}>{person?.name}</b><span className="truncate whitespace-nowrap font-semibold text-emerald-400" title={person?.relation}>{person?.relation}</span><span className="whitespace-nowrap text-right font-medium tabular-nums text-slate-300" title={value(person?.phone)}>{value(person?.phone)}</span></div>) : <Empty text="등록된 관계인이 없어." />}</Block><Block title="대리 업무"><Row label="대리 인원">{member.acts_as_agent_for?.length || 0}명</Row>{member.acts_as_agent_for?.map((item) => <Row key={item.id} label={item.relation}>{item.name}</Row>)}</Block></>; }
    if (id === 'finance') { const due = payments.reduce((s,p)=>s+Number(p.amount_due||0),0); const paid = payments.reduce((s,p)=>s+Number(p.amount_paid||0),0); return <><Block title="조합원 자격" action="가입신청필증 관리" onAction={() => onOpenManagement?.('admin')}><Row label="조합원 구분">{memberCategory}</Row><Row label="조합원 지위">{member.status || '-'}</Row><Row label="가입신청필증">{rights.length}건</Row>{rights.slice(0,4).map((right, index)=><Row key={right.id} label={`필증번호 ${index+1}`}>{right.right_number || '-'}</Row>)}</Block><Block title="납부 현황" action={due ? `납부율 ${Math.round(paid/due*100)}% · 관리` : '납부 관리'} onAction={() => onOpenManagement?.('payment')}><Row label="총 분담금">{money(due)}</Row><Row label="납부 총액">{money(paid)}</Row><Row label="미납 총액" strong>{money(Math.max(0,due-paid))}</Row>{payments.slice(0,8).map((payment)=><div key={payment.id} className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.055] py-2 text-[13px]"><span className="truncate whitespace-nowrap font-medium text-slate-400">{PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type}</span><span className={`whitespace-nowrap text-right font-semibold tabular-nums ${payment.amount_paid >= payment.amount_due ? 'text-emerald-400' : 'text-orange-400'}`}>{money(payment.amount_paid)}</span></div>)}</Block></>; }
    if (id === 'timeline') return <><Block title="최근 상담" action="+ 상담 등록" onAction={() => onOpenManagement?.('timeline')}>{loading ? <Empty text="불러오는 중..." /> : logs.filter((log)=>log.type !== 'DOC').slice(0,6).map((log)=><div key={log.id} className="border-b border-white/[0.06] py-3"><div className="flex min-w-0 items-center justify-between gap-3 text-xs"><span className="whitespace-nowrap font-bold tabular-nums text-slate-300">{date(log.created_at)} · {log.type || 'NOTE'}</span><span className="truncate whitespace-nowrap text-slate-500">{log.staff_name || '조합사무실'}</span></div><p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-slate-300">{log.summary || '-'}</p></div>)}</Block><Block title="활동 내역" action="전체 보기" onAction={() => onOpenManagement?.('timeline')}>{logs.slice(6,12).map((log)=><Row key={log.id} label={date(log.created_at)} multiline>{log.summary || '-'}</Row>)}</Block></>;
    const docs = logs.filter((log)=>log.type === 'DOC' || log.attachment);
    return <><Block title="증빙서류" action={`기록 관리 · ${docs.length}건`} onAction={() => onOpenManagement?.('timeline')}>{docs.length ? docs.slice(0,8).map((log)=><div key={log.id} className="grid min-h-9 grid-cols-[minmax(0,1fr)_92px] items-center gap-3 border-b border-white/[0.06] py-2 text-[13px]"><span className="truncate whitespace-nowrap font-bold text-slate-300" title={log.attachment || log.summary || '서류 기록'}>{log.attachment || log.summary || '서류 기록'}</span><span className="whitespace-nowrap text-right font-medium tabular-nums text-emerald-400">{date(log.created_at)}</span></div>) : <Empty text="등록된 문서가 없어." />}</Block><Block title="가입신청필증 문서" action="가입신청필증 관리" onAction={() => onOpenManagement?.('admin')}><Row label="보유 건수">{rights.length}건</Row>{rights.slice(0,8).map((right)=><Row key={right.id} label="가입신청필증">{right.right_number || '-'}</Row>)}</Block></>;
}

function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-xs font-medium text-slate-500">{text}</p>; }
