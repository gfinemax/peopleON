'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MaterialIcon } from '@/components/ui/icon';
import type { MemberDetailDialogMember } from './memberDetailDialogTypes';
import type { TabType } from './memberDetailDialogTypes';
import type { MemberWorkspaceColumnId } from './memberWorkspacePresets';
import { MEMBER_WORKSPACE_COLUMNS } from './memberWorkspacePresets';
import { PAYMENT_TYPE_LABELS, type PaymentRecord } from './paymentStatusTabUtils';
import { MemberProfilePhoto } from './MemberProfilePhoto';
import { MemberBankAccountBlock } from './MemberBankAccountBlock';
import { formatAssignedUnitType } from '@/lib/members/memberUnitDisplay';
import type { LedgerJournalSummary } from '@/lib/server/ledgerJournalSummary';

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

type WorkspaceColumnWidths = Partial<Record<MemberWorkspaceColumnId, number>>;

const WORKSPACE_WIDTH_STORAGE_KEY = 'peopleon-member-workspace-column-widths-v2';
const DEFAULT_WORKSPACE_COLUMN_WIDTHS: Record<MemberWorkspaceColumnId, number> = {
    profile: 24,
    relations: 22,
    finance: 24,
    timeline: 30,
    documents: 22,
};
const MIN_WORKSPACE_COLUMN_WIDTHS: Record<MemberWorkspaceColumnId, number> = {
    profile: 260,
    relations: 240,
    finance: 280,
    timeline: 300,
    documents: 240,
};

const normalizeWorkspaceWidths = (columns: MemberWorkspaceColumnId[], saved: WorkspaceColumnWidths = {}) => {
    const raw = columns.map((id) => Math.max(1, Number(saved[id] ?? DEFAULT_WORKSPACE_COLUMN_WIDTHS[id])));
    const total = raw.reduce((sum, width) => sum + width, 0) || 1;
    return Object.fromEntries(columns.map((id, index) => [id, raw[index] / total * 100])) as WorkspaceColumnWidths;
};

const EMPTY_LEDGER_SUMMARY: LedgerJournalSummary = {
    connected: false,
    generated_at: null,
    ledger_member: null,
    journal_url: null,
    recent_consultations: [],
    pinned_note: { note: '', updated_at: null, updated_by: null },
    payment_summary: null,
    error: null,
};

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

const splitUnitAssignment = (input?: string | null) => {
    const raw = input?.trim() || '';
    if (!raw) return { unitType: '-', dongHo: '-' };

    const dongHoMatch = raw.match(/\d+\s*동(?:\s*[-·/]?\s*\d+\s*호)?/u);
    if (!dongHoMatch) return { unitType: raw, dongHo: '-' };

    const unitType = raw
        .replace(dongHoMatch[0], '')
        .replace(/^[-\s·,/|]+|[-\s·,/|]+$/gu, '')
        .trim();

    return { unitType: unitType || '-', dongHo: dongHoMatch[0].replace(/\s+/g, ' ') };
};

function ResidentNumberValue({ residentNumber }: { residentNumber?: string | null }) {
    const [visibleNumber, setVisibleNumber] = useState<string | null>(null);
    const fullNumber = residentNumber?.trim() || '';
    const visible = Boolean(fullNumber) && visibleNumber === fullNumber;
    const maskedNumber = fullNumber ? `${fullNumber.slice(0, 8)}******` : '-';

    return <span className="inline-flex min-w-0 items-center gap-2"><span className="truncate tabular-nums">{visible ? fullNumber : maskedNumber}</span>{fullNumber ? <button type="button" onClick={() => setVisibleNumber(visible ? null : fullNumber)} aria-label={visible ? '주민등록번호 감추기' : '주민등록번호 보기'} aria-pressed={visible} className="inline-flex size-7 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white/5 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"><MaterialIcon name={visible ? 'visibility_off' : 'visibility'} size="xs" /></button> : null}</span>;
}

function AssignedUnitValue({ unitType, compact = false }: { unitType: string; compact?: boolean }) {
    const [displayUnit, setDisplayUnit] = useState<'sqm' | 'pyeong'>('sqm');
    const displayValue = formatAssignedUnitType(unitType, displayUnit);

    return <span className={`inline-flex min-w-0 items-center ${compact ? 'justify-center gap-1' : 'gap-2'}`}><span className="truncate whitespace-nowrap tabular-nums">{displayValue}</span>{unitType !== '-' ? <span className="inline-flex shrink-0 items-center rounded border border-sky-400/20 bg-sky-500/5 p-0.5" aria-label="평형 표시 단위 선택"><button type="button" onClick={() => setDisplayUnit('sqm')} aria-pressed={displayUnit === 'sqm'} className={`rounded px-1.5 py-0.5 text-[10px] font-black ${displayUnit === 'sqm' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-sky-300'}`}>㎡</button><button type="button" onClick={() => setDisplayUnit('pyeong')} aria-pressed={displayUnit === 'pyeong'} className={`rounded px-1.5 py-0.5 text-[10px] font-black ${displayUnit === 'pyeong' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-sky-300'}`}>평</button></span> : null}</span>;
}

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

function useLedgerJournalSummary(memberId: string) {
    const [summary, setSummary] = useState<LedgerJournalSummary>(EMPTY_LEDGER_SUMMARY);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/members/${encodeURIComponent(memberId)}/ledger-journal-summary`, { cache: 'no-store' });
                const payload = await response.json().catch(() => null);
                if (!cancelled) setSummary(payload || { ...EMPTY_LEDGER_SUMMARY, error: '회계프로그램 기록을 불러오지 못했어.' });
            } catch {
                if (!cancelled) setSummary({ ...EMPTY_LEDGER_SUMMARY, error: '회계프로그램 기록을 불러오지 못했어.' });
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [memberId]);

    return { summary, loading };
}

function Row({ label, children, strong = false, multiline = false, alignRight = false }: { label: string; children: React.ReactNode; strong?: boolean; multiline?: boolean; alignRight?: boolean }) {
    const title = typeof children === 'string' || typeof children === 'number' ? String(children) : undefined;
    return <div className="grid min-h-9 grid-cols-[108px_minmax(0,1fr)] items-center border-b border-white/[0.055] py-2 text-[13px] last:border-b-0"><span className="whitespace-nowrap font-medium text-slate-400">{label}</span><span title={title} className={`${strong ? 'font-bold text-slate-100' : 'font-medium text-slate-200'} ${multiline ? 'line-clamp-2 leading-5' : 'truncate whitespace-nowrap'} ${alignRight ? 'text-right tabular-nums' : ''}`}>{children}</span></div>;
}

function Block({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
    return <section className="border-b border-white/[0.075] px-4 py-4 last:border-b-0"><div className="mb-2.5 flex items-center justify-between gap-3"><h3 className="whitespace-nowrap text-sm font-black text-slate-100">{title}</h3>{action ? <button type="button" onClick={onAction} className="whitespace-nowrap rounded px-1.5 py-1 text-xs font-bold text-sky-400 hover:bg-sky-500/10 hover:text-sky-300">{action}</button> : null}</div>{children}</section>;
}

export function MemberWorkspaceSummary({ member, onEdit, onDelete, onPrint, onBack, onPhotoChanged }: { member: MemberDetailDialogMember; onEdit: () => void; onDelete: () => void; onPrint: () => void; onBack: () => void; onPhotoChanged?: () => void }) {
    const ids = [member.id];
    const { payments, logs } = useWorkspaceData(ids);
    const due = payments.reduce((sum, item) => sum + Number(item.amount_due || 0), 0);
    const ledger = useLedgerJournalSummary(member.id);
    const localPaid = payments.reduce((sum, item) => sum + Number(item.amount_paid || 0), 0);
    const paid = ledger.summary.connected && ledger.summary.payment_summary
        ? Number(ledger.summary.payment_summary.total_paid || 0)
        : localPaid;
    const rate = due > 0 ? Math.min(100, Math.round((paid / due) * 100)) : 0;
    const latest = logs[0]?.created_at;
    const memberCategory = getMemberCategory(member);
    const assignment = splitUnitAssignment(member.unit_group);
    return <div className="m-3 grid min-h-[82px] grid-cols-[minmax(300px,1.8fr)_repeat(6,minmax(92px,1fr))_auto] items-center rounded-lg border border-white/[0.06] bg-[#0d2942] px-4 shadow-lg shadow-black/10">
        <div className="flex min-w-0 items-center gap-3 border-r border-white/[0.07] pr-4"><MemberProfilePhoto memberId={member.id} name={member.name} hasImage={Boolean(member.profile_image_path)} onChanged={onPhotoChanged} /><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-2xl font-black text-white">{member.name}</h2><span className="whitespace-nowrap rounded-full border border-cyan-400/15 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-300">{memberCategory}</span></div><p className="mt-1 truncate whitespace-nowrap text-xs font-medium text-slate-400">회원번호(필증번호) {member.member_number || '-'}</p></div></div>
        <Metric label="최근 상담일" text={date(latest)} showFull />
        <div className="min-w-0 px-2 text-center"><p className="whitespace-nowrap text-xs font-bold text-slate-400">배정 평형</p><div className="mt-1 text-sm font-black text-slate-100"><AssignedUnitValue unitType={assignment.unitType} compact /></div></div>
        <Metric label="동·호수" text={assignment.dongHo} />
        <Metric label="증빙서류" text={`${logs.filter((log) => log.type === 'DOC' || log.attachment).length}건`} />
        <Metric label="납부율" text={`${rate}%`} progress={rate} />
        <Metric label="미납금" text={money(Math.max(0, due - paid))} danger />
        <div className="flex items-center gap-1 pl-3"><button onClick={onDelete} className="flex h-9 items-center gap-1 whitespace-nowrap rounded border border-rose-400/15 px-2 text-xs font-bold text-rose-300 hover:bg-rose-500/10"><MaterialIcon name="delete_outline" size="xs" />삭제</button><button onClick={onEdit} className="flex h-9 items-center gap-1 whitespace-nowrap rounded border border-white/15 px-2 text-xs font-bold text-slate-200 hover:bg-white/5"><MaterialIcon name="edit" size="xs" />수정</button><button onClick={onPrint} className="flex h-9 items-center gap-1 whitespace-nowrap rounded border border-sky-400/15 px-2 text-xs font-bold text-sky-200 hover:bg-sky-500/10"><MaterialIcon name="picture_as_pdf" size="xs" />공유/PDF</button><button onClick={onBack} aria-label="목록으로" className="flex size-9 items-center justify-center text-slate-400 hover:text-white"><MaterialIcon name="chevron_left" size="sm" /></button></div>
    </div>;
}

function Metric({ label, text, progress, danger, showFull = false }: { label: string; text: string; progress?: number; danger?: boolean; showFull?: boolean }) {
    return <div className={`min-w-0 text-center ${showFull ? 'px-1' : 'px-3'}`}><p className="whitespace-nowrap text-xs font-bold text-slate-400">{label}</p><p title={text} className={`mt-1 whitespace-nowrap font-black tabular-nums ${showFull ? 'text-sm tracking-tight' : 'truncate text-base'} ${danger ? 'text-orange-500' : 'text-slate-100'}`}>{text}</p>{progress !== undefined ? <div className="mx-auto mt-1 h-0.5 w-16 overflow-hidden rounded bg-white/10"><div className="h-full bg-emerald-400" style={{ width: `${progress}%` }} /></div> : null}</div>;
}

export function MemberWorkspaceBoard({ memberIds, member, formData, columns, onOpenManagement }: { memberIds: string[]; member: MemberDetailDialogMember; formData: Partial<MemberDetailDialogMember>; columns: MemberWorkspaceColumnId[]; onOpenManagement?: (tab: TabType) => void }) {
    const { payments, logs, loading } = useWorkspaceData(memberIds);
    const ledgerJournal = useLedgerJournalSummary(member.id);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const widthsRef = useRef<WorkspaceColumnWidths>({});
    const [columnWidths, setColumnWidths] = useState<WorkspaceColumnWidths>(() => normalizeWorkspaceWidths(columns));
    const columnKey = columns.join('|');

    useEffect(() => {
        let saved: WorkspaceColumnWidths = {};
        try { saved = JSON.parse(window.localStorage.getItem(WORKSPACE_WIDTH_STORAGE_KEY) || '{}'); } catch { saved = {}; }
        const activeColumns = columnKey.split('|').filter(Boolean) as MemberWorkspaceColumnId[];
        const normalized = normalizeWorkspaceWidths(activeColumns, saved);
        const frame = window.requestAnimationFrame(() => {
            widthsRef.current = normalized;
            setColumnWidths(normalized);
        });
        return () => window.cancelAnimationFrame(frame);
    }, [columnKey]);

    const updateColumnWidths = (next: WorkspaceColumnWidths, persist = false) => {
        widthsRef.current = next;
        setColumnWidths(next);
        if (persist) window.localStorage.setItem(WORKSPACE_WIDTH_STORAGE_KEY, JSON.stringify(next));
    };

    const adjustColumnPair = (separatorIndex: number, deltaPercent: number, persist = false) => {
        const leftId = columns[separatorIndex];
        const rightId = columns[separatorIndex + 1];
        const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width || 1;
        const totalMinimumWidth = columns.reduce((sum, id) => sum + MIN_WORKSPACE_COLUMN_WIDTHS[id], 0) + Math.max(0, columns.length - 1) * 8;
        const minimumScale = Math.min(1, workspaceWidth / totalMinimumWidth);
        const leftStart = Number(widthsRef.current[leftId] ?? DEFAULT_WORKSPACE_COLUMN_WIDTHS[leftId]);
        const rightStart = Number(widthsRef.current[rightId] ?? DEFAULT_WORKSPACE_COLUMN_WIDTHS[rightId]);
        const leftMin = MIN_WORKSPACE_COLUMN_WIDTHS[leftId] * minimumScale / workspaceWidth * 100;
        const rightMin = MIN_WORKSPACE_COLUMN_WIDTHS[rightId] * minimumScale / workspaceWidth * 100;
        const boundedDelta = Math.max(leftMin - leftStart, Math.min(deltaPercent, rightStart - rightMin));
        updateColumnWidths({ ...widthsRef.current, [leftId]: leftStart + boundedDelta, [rightId]: rightStart - boundedDelta }, persist);
    };

    const startColumnResize = (event: React.PointerEvent<HTMLDivElement>, separatorIndex: number) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        const startX = event.clientX;
        const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width || 1;
        const startWidths = { ...widthsRef.current };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        const move = (moveEvent: PointerEvent) => {
            widthsRef.current = startWidths;
            adjustColumnPair(separatorIndex, (moveEvent.clientX - startX) / workspaceWidth * 100);
        };
        const finish = () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.localStorage.setItem(WORKSPACE_WIDTH_STORAGE_KEY, JSON.stringify(widthsRef.current));
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', finish);
            window.removeEventListener('pointercancel', finish);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', finish);
        window.addEventListener('pointercancel', finish);
    };

    const resetColumnWidths = () => {
        const reset = normalizeWorkspaceWidths(columns);
        updateColumnWidths(reset, true);
    };

    const gridTemplateColumns = columns.flatMap((id, index) => [
        ...(index ? ['8px'] : []),
        `minmax(0, ${columnWidths[id] ?? DEFAULT_WORKSPACE_COLUMN_WIDTHS[id]}fr)`,
    ]).join(' ');
    const workspaceMinWidth = columns.reduce((sum, id) => sum + MIN_WORKSPACE_COLUMN_WIDTHS[id], 0) + Math.max(0, columns.length - 1) * 8;

    return <div className="flex min-h-0 flex-1 flex-col bg-[#071e32]">
        <div className="flex h-10 shrink-0 items-center justify-between px-3 text-[11px] text-slate-500"><span className="hidden lg:inline">열 사이 구분선을 드래그하거나 방향키로 너비를 조절할 수 있어.</span><button type="button" onClick={resetColumnWidths} className="ml-auto inline-flex h-7 items-center gap-1 rounded-md border border-white/10 px-2.5 font-bold text-slate-300 hover:border-sky-400/30 hover:bg-sky-500/10 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"><MaterialIcon name="restart_alt" size="xs" />열 너비 초기화</button></div>
        <div className="flex-1 overflow-x-hidden overflow-y-auto px-3 pb-3 scrollbar-thin scrollbar-thumb-white/10"><div ref={workspaceRef} className="member-workspace-grid grid min-h-full w-full items-stretch" style={{ gridTemplateColumns }}>
            {columns.map((id, index) => <Fragment key={id}>{index > 0 ? <div className="member-workspace-resizer group relative z-20 flex cursor-col-resize touch-none items-stretch justify-center" role="separator" aria-label={`${MEMBER_WORKSPACE_COLUMNS.find((item) => item.id === columns[index - 1])?.label}와 ${MEMBER_WORKSPACE_COLUMNS.find((item) => item.id === id)?.label} 열 너비 조절`} aria-orientation="vertical" aria-valuemin={MIN_WORKSPACE_COLUMN_WIDTHS[columns[index - 1]]} aria-valuenow={Math.round((columnWidths[columns[index - 1]] || 0) / 100 * workspaceMinWidth)} tabIndex={0} onPointerDown={(event) => startColumnResize(event, index - 1)} onDoubleClick={resetColumnWidths} onKeyDown={(event) => { if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return; event.preventDefault(); const pixels = event.shiftKey ? 48 : 16; const width = workspaceRef.current?.getBoundingClientRect().width || 1; adjustColumnPair(index - 1, (event.key === 'ArrowRight' ? pixels : -pixels) / width * 100, true); }}><span className="my-3 w-px rounded-full bg-white/10 transition-all group-hover:w-0.5 group-hover:bg-sky-400 group-focus-visible:w-0.5 group-focus-visible:bg-sky-300" /></div> : null}<WorkspaceColumn id={id}><ColumnContent id={id} member={member} formData={formData} payments={payments} logs={logs} loading={loading} ledgerJournal={ledgerJournal} onOpenManagement={onOpenManagement} /></WorkspaceColumn></Fragment>)}
        </div></div>
    </div>;
}

function WorkspaceColumn({ id, children }: { id: MemberWorkspaceColumnId; children: React.ReactNode }) {
    const definition = MEMBER_WORKSPACE_COLUMNS.find((item) => item.id === id);
    return <section className="min-w-0 overflow-hidden rounded-lg border border-white/[0.09] bg-[#0b263d]"><header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-white/[0.09] bg-[#0b263d] px-4"><MaterialIcon name="drag_indicator" size="xs" className="text-slate-500"/><h2 className="whitespace-nowrap text-base font-black text-slate-100">{definition?.label}</h2><MaterialIcon name="minimize" size="xs" className="ml-auto text-slate-500"/></header>{children}</section>;
}

function RelationshipRow({ name, relation, phone }: { name?: string | null; relation?: string | null; phone?: string | null }) {
    return <div className="flex min-h-10 min-w-0 items-center gap-2 border-b border-white/[0.06] py-2 text-[13px]">
        <b className="min-w-0 flex-1 truncate whitespace-nowrap text-slate-100" title={name || undefined}>{value(name)}</b>
        <span className="w-14 shrink-0 truncate whitespace-nowrap text-right font-semibold text-emerald-400" title={relation || undefined}>{value(relation)}</span>
        <span className="ml-auto shrink-0 whitespace-nowrap pr-0.5 text-right font-medium tabular-nums text-slate-300" title={value(phone)}>{value(phone)}</span>
    </div>;
}

function ColumnContent({ id, member, formData, payments, logs, loading, ledgerJournal, onOpenManagement }: { id: MemberWorkspaceColumnId; member: MemberDetailDialogMember; formData: Partial<MemberDetailDialogMember>; payments: PaymentRecord[]; logs: LogRow[]; loading: boolean; ledgerJournal: { summary: LedgerJournalSummary; loading: boolean }; onOpenManagement?: (tab: TabType) => void }) {
    const rights = formData.assetRights || [];
    const memberCategory = getMemberCategory(member);
    const assignment = splitUnitAssignment(formData.unit_group || member.unit_group);
    if (id === 'profile') { const people = [member.representative, member.representative2].filter(Boolean); return <><Block title="기본 정보" action="수정" onAction={() => onOpenManagement?.('info')}><Row label="이름" strong>{value(member.name)}</Row><Row label="회원번호(필증번호)">{value(member.member_number)}</Row><Row label="생년월일">{date(member.birth_date)}</Row><Row label="주민번호"><ResidentNumberValue residentNumber={member.resident_registration_number} /></Row><Row label="연락처">{value(member.phone)}</Row><Row label="보조 연락처">{value(member.secondary_phone)}</Row><Row label="이메일">{value(member.email)}</Row><Row label="주소">{value(member.address_legal)}</Row><Row label="가입 구분">{memberCategory}</Row></Block><Block title="선택·배정 정보"><Row label="배정 평형" strong><AssignedUnitValue unitType={assignment.unitType} /></Row><Row label="동·호수">{assignment.dongHo}</Row><Row label="소유 구분">{member.owner_group === 'registered' ? '등기조합원' : '기타'}</Row><Row label="관리자 메모" multiline>{value(formData.memo)}</Row></Block><Block title="가족·관계인" action="+ 추가" onAction={() => onOpenManagement?.('info')}>{people.length ? people.map((person) => <RelationshipRow key={person?.id || person?.name} name={person?.name} relation={person?.relation} phone={person?.phone} />) : <Empty text="등록된 관계인이 없어." />}{member.acts_as_agent_for?.map((item) => <Row key={item.id} label={`${item.relation} 대리`}><span>{item.name}</span><span className="ml-3 text-slate-400">{value(item.phone)}</span></Row>)}</Block>{member.tags?.length ? <Block title="AI 분석 인사이트"><div className="flex flex-wrap gap-2">{member.tags.map((tag) => <span key={tag} className="rounded-lg border border-cyan-400/15 bg-cyan-500/10 px-2 py-1 text-xs font-bold text-cyan-200">{tag}</span>)}</div></Block> : null}</>; }
    if (id === 'relations') { const people = [member.representative, member.representative2].filter(Boolean); return <><Block title="가족·관계인" action="+ 추가">{people.length ? people.map((person) => <RelationshipRow key={person?.id || person?.name} name={person?.name} relation={person?.relation} phone={person?.phone} />) : <Empty text="등록된 관계인이 없어." />}</Block><Block title="대리 업무"><Row label="대리 인원">{member.acts_as_agent_for?.length || 0}명</Row>{member.acts_as_agent_for?.map((item) => <Row key={item.id} label={item.relation}>{item.name}</Row>)}</Block></>; }
    if (id === 'finance') {
        const due = payments.reduce((sum, payment) => sum + Number(payment.amount_due || 0), 0);
        const ledgerPayment = ledgerJournal.summary.connected ? ledgerJournal.summary.payment_summary : null;
        const localPaid = payments.reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
        const paid = ledgerPayment ? Number(ledgerPayment.total_paid || 0) : localPaid;
        const allocation = ledgerPayment?.allocations;
        const ledgerLines = allocation ? [
            ['출자금(필증)', allocation.cert],
            ['기타', allocation.op_fee],
            ['계약금', allocation.join_fee],
            ['1차 분담금', allocation.land1],
            ['2차 분담금', allocation.land2],
            ['잔금', Math.max(0, paid - allocation.cert - allocation.op_fee - allocation.join_fee - allocation.land1 - allocation.land2)],
        ] as const : null;
        const ledgerBaseUrl = (process.env.NEXT_PUBLIC_LEDGER_URL || 'http://dbapt-ledger.duckdns.org').replace(/\/$/, '');
        const openLedgerPayment = ledgerPayment?.payment_url
            ? () => window.open(`${ledgerBaseUrl}${ledgerPayment.payment_url}`, '_blank', 'noopener,noreferrer')
            : () => onOpenManagement?.('payment');
        return <><Block title="조합원 자격" action="가입신청필증 관리" onAction={() => onOpenManagement?.('admin')}><Row label="조합원 구분">{memberCategory}</Row><Row label="조합원 지위">{member.status || '-'}</Row><Row label="가입신청필증">{rights.length}건</Row>{rights.slice(0,4).map((right, index)=><Row key={right.id} label={`필증번호 ${index+1}`}>{right.right_number || '-'}</Row>)}</Block><Block title="납부 현황" action={due ? `납부율 ${Math.round(paid/due*100)}% · 관리` : '납부 관리'} onAction={openLedgerPayment}><Row label="총 분담금" alignRight>{money(due)}</Row><Row label="납부 총액" alignRight>{ledgerJournal.loading ? '회계원장 조회 중' : money(paid)}</Row><Row label="미납 총액" strong alignRight>{ledgerJournal.loading ? '-' : money(Math.max(0,due-paid))}</Row>{ledgerLines ? ledgerLines.map(([label, amount])=><div key={label} className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.055] py-2 text-[13px]"><span className="truncate whitespace-nowrap font-medium text-slate-400">{label}</span><span className={`whitespace-nowrap text-right font-semibold tabular-nums ${amount > 0 ? 'text-emerald-400' : 'text-orange-400'}`}>{money(amount)}</span></div>) : payments.slice(0,8).map((payment)=><div key={payment.id} className="grid min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.055] py-2 text-[13px]"><span className="truncate whitespace-nowrap font-medium text-slate-400">{PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type}</span><span className={`whitespace-nowrap text-right font-semibold tabular-nums ${payment.amount_paid >= payment.amount_due ? 'text-emerald-400' : 'text-orange-400'}`}>{money(payment.amount_paid)}</span></div>)}</Block><MemberBankAccountBlock memberId={member.id} memberName={member.name} defaultPurpose={memberCategory === '환불조합원' ? 'refund' : 'payment'} /></>;
    }
    if (id === 'timeline') return <TimelineColumn logs={logs} loading={loading} ledgerJournal={ledgerJournal} onOpenManagement={onOpenManagement} />;
    const docs = logs.filter((log)=>log.type === 'DOC' || log.attachment);
    return <><Block title="증빙서류" action={`기록 관리 · ${docs.length}건`} onAction={() => onOpenManagement?.('timeline')}>{docs.length ? docs.slice(0,8).map((log)=><div key={log.id} className="grid min-h-9 grid-cols-[minmax(0,1fr)_92px] items-center gap-3 border-b border-white/[0.06] py-2 text-[13px]"><span className="truncate whitespace-nowrap font-bold text-slate-300" title={log.attachment || log.summary || '서류 기록'}>{log.attachment || log.summary || '서류 기록'}</span><span className="whitespace-nowrap text-right font-medium tabular-nums text-emerald-400">{date(log.created_at)}</span></div>) : <Empty text="등록된 문서가 없어." />}</Block><Block title="가입신청필증 문서" action="가입신청필증 관리" onAction={() => onOpenManagement?.('admin')}><Row label="보유 건수">{rights.length}건</Row>{rights.slice(0,8).map((right)=><Row key={right.id} label="가입신청필증">{right.right_number || '-'}</Row>)}</Block></>;
}

function TimelineColumn({ logs, loading, ledgerJournal, onOpenManagement }: { logs: LogRow[]; loading: boolean; ledgerJournal: { summary: LedgerJournalSummary; loading: boolean }; onOpenManagement?: (tab: TabType) => void }) {
    const { summary, loading: ledgerLoading } = ledgerJournal;
    const ledgerBaseUrl = (process.env.NEXT_PUBLIC_LEDGER_URL || 'http://dbapt-ledger.duckdns.org').replace(/\/$/, '');
    const journalHref = summary.journal_url ? `${ledgerBaseUrl}${summary.journal_url}` : null;
    return <>
        <Block title="최근 상담" action="+ 상담 등록" onAction={() => onOpenManagement?.('timeline')}>
            {loading ? <Empty text="불러오는 중..." /> : logs.filter((log)=>log.type !== 'DOC').slice(0,6).map((log)=><div key={log.id} className="min-w-0 border-b border-white/[0.06] py-3"><div className="flex min-w-0 items-center justify-between gap-3 text-xs"><span className="min-w-0 flex-1 truncate whitespace-nowrap font-bold tabular-nums text-slate-300"><span className="mr-1.5 rounded border border-sky-400/20 bg-sky-500/10 px-1.5 py-0.5 text-[10px] text-sky-300">PeopleON</span>{date(log.created_at)} · {log.type || 'NOTE'}</span><span className="shrink-0 truncate whitespace-nowrap text-slate-500">{log.staff_name || '조합사무실'}</span></div><p className="mt-1.5 line-clamp-2 min-w-0 break-words text-[13px] leading-5 text-slate-300">{log.summary || '-'}</p></div>)}
        </Block>
        <Block title="회계프로그램 통합기록" action={journalHref ? '전체 기록 보기' : undefined} onAction={journalHref ? () => window.open(journalHref, '_blank', 'noopener,noreferrer') : undefined}>
            {ledgerLoading ? <Empty text="회계프로그램 기록을 불러오는 중..." /> : summary.error ? <p className="py-5 text-center text-xs font-semibold text-rose-300">{summary.error}</p> : !summary.connected ? <Empty text="회계프로그램 조합원 연결이 필요해." /> : summary.recent_consultations.length ? summary.recent_consultations.map((entry)=><div key={entry.id} className="min-w-0 border-b border-white/[0.06] py-3"><div className="flex min-w-0 items-center justify-between gap-3 text-xs"><span className="min-w-0 flex-1 truncate whitespace-nowrap font-bold tabular-nums text-slate-300"><span className="mr-1.5 rounded border border-emerald-400/20 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">회계원장</span>{date(entry.occurred_at)} · {entry.contact_type || '기록'}</span><span className="shrink-0 truncate whitespace-nowrap text-slate-500">{entry.created_by_display || '조합사무실'}</span></div><p className="mt-1.5 line-clamp-2 min-w-0 break-words text-[13px] font-semibold leading-5 text-slate-200">{entry.title || entry.content || '-'}</p>{entry.title && entry.content ? <p className="mt-1 line-clamp-2 min-w-0 break-words text-xs leading-5 text-slate-400">{entry.content}</p> : null}</div>) : <Empty text="등록된 회계프로그램 상담기록이 없어." />}
            {summary.connected ? <p className="pt-2 text-right text-[10px] text-slate-600">조회 기준 {date(summary.generated_at)}</p> : null}
        </Block>
        <Block title="통합기록 메모">
            {ledgerLoading ? <Empty text="메모를 불러오는 중..." /> : summary.error ? <Empty text="회계프로그램 메모를 확인할 수 없어." /> : !summary.connected ? <Empty text="회계프로그램 조합원 연결이 필요해." /> : summary.pinned_note.note ? <div><p className="whitespace-pre-wrap break-words text-[13px] font-medium leading-6 text-slate-300">{summary.pinned_note.note}</p><p className="mt-2 text-right text-[10px] text-slate-600">최근 수정 {date(summary.pinned_note.updated_at)}{summary.pinned_note.updated_by ? ` · ${summary.pinned_note.updated_by}` : ''}</p></div> : <Empty text="등록된 통합기록 메모가 없어." />}
        </Block>
        <Block title="활동 내역" action="전체 보기" onAction={() => onOpenManagement?.('timeline')}>{logs.slice(6,12).map((log)=><Row key={log.id} label={date(log.created_at)} multiline>{log.summary || '-'}</Row>)}</Block>
    </>;
}

function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-xs font-medium text-slate-500">{text}</p>; }
