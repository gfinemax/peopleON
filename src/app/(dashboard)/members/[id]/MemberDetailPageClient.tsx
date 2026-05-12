'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/icon';
import { createClient } from '@/lib/supabase/client';
import { formatSafeDate, formatSafeDateTime } from '@/lib/utils';
import { MemberDetailDialog } from '@/components/features/members/MemberDetailDialog';
import { fetchMemberDetail } from '@/components/features/members/memberDetailDialogOperations';
import type { MemberDetailDialogMember } from '@/components/features/members/memberDetailDialogTypes';
import {
    getManagedCertificateNumbers,
    getRightsFlowHeadline,
    getRightsFlowSummary,
    parseCertificateMeta,
} from '@/components/features/members/memberDetailDialogUtils';
import type { AssetRight } from '@/components/features/members/memberDetailDialogUtils';

interface MemberDetailPageClientProps {
    memberId: string;
}

type CopyState = 'idle' | 'copied' | 'failed';
type SupabaseClient = ReturnType<typeof createClient>;
type SettlementLineType =
    | 'capital'
    | 'debt'
    | 'loss'
    | 'certificate_base_refund'
    | 'premium_recognition'
    | 'already_paid'
    | 'adjustment'
    | 'final_refund';
type SettlementCaseStatus = 'draft' | 'review' | 'approved' | 'paid' | 'rejected';

interface RecentActivity {
    id: string;
    type: string;
    title: string;
    summary: string;
    staffName: string | null;
    createdAt: string;
}

interface SettlementSummary {
    available: boolean;
    statusLabel: string;
    createdAtLabel: string;
    finalRefundAmount: number;
    paidAmount: number;
    requestedAmount: number;
    remainingAmount: number;
    payoutRate: number;
    rows: Array<{ label: string; value: string; muted?: boolean; emphasis?: boolean }>;
}

interface SettlementCaseRow {
    id: string;
    entity_id?: string;
    case_status: SettlementCaseStatus;
    created_at: string;
}

interface SettlementLineRow {
    line_type: SettlementLineType;
    amount: number | string | null;
}

interface RefundPaymentRow {
    paid_amount: number | string | null;
    payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
}

type ActivityLogRow = {
    id: string;
    type: string | null;
    summary: string | null;
    staff_name: string | null;
    created_at: string;
};

const krwFormatter = new Intl.NumberFormat('ko-KR');
const caseStatusLabel: Record<SettlementCaseStatus, string> = {
    draft: '작성중',
    review: '검토중',
    approved: '승인됨',
    paid: '지급완료',
    rejected: '반려',
};

const interactionTypeLabel: Record<string, string> = {
    CALL: '전화 상담',
    MEET: '대면 상담',
    SMS: '문자 발송',
    DOC: '서류 기록',
    REPAIR: '수리 건',
    NOTE: '메모',
};

function formatKRW(value?: number | string | null) {
    const amount = Number(value) || 0;
    return `₩${krwFormatter.format(amount)}`;
}

function parseMoney(value: number | string | null | undefined): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function getTierDisplay(tier: string) {
    if (tier === '등기조합원') return '조합원(등기)';
    if (tier === '지주조합원') return '조합원(지주)';
    if (tier === '일반분양') return '조합원(일반분양)';
    if (tier === '예비조합원') return '조합원(예비)';
    if (tier === '권리증보유자') return '권리증보유';
    return tier;
}

function getRightNumber(right: AssetRight) {
    return right.right_number || right.right_number_raw || right.certificate_number_normalized || right.certificate_number_raw || '번호 없음';
}

async function fetchLatestSettlementCase(supabase: SupabaseClient, entityId: string) {
    const viewRes = await supabase
        .from('vw_latest_settlement_case_by_entity')
        .select('id, entity_id, case_status, created_at')
        .eq('entity_id', entityId)
        .maybeSingle();

    if (!viewRes.error) {
        return (viewRes.data as SettlementCaseRow | null) || null;
    }

    const caseRes = await supabase
        .from('settlement_cases')
        .select('id, entity_id, case_status, created_at')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (caseRes.error) return null;
    return (caseRes.data as SettlementCaseRow | null) || null;
}

async function fetchSettlementLineSummaries(supabase: SupabaseClient, caseId: string) {
    const viewRes = await supabase
        .from('vw_settlement_case_line_type_summary')
        .select('line_type, amount')
        .eq('case_id', caseId);

    if (!viewRes.error) {
        return ((viewRes.data as SettlementLineRow[] | null) || []);
    }

    const lineRes = await supabase
        .from('settlement_lines')
        .select('line_type, amount')
        .eq('case_id', caseId);

    return ((lineRes.data as SettlementLineRow[] | null) || []);
}

async function fetchSettlementPaymentSummaries(supabase: SupabaseClient, caseId: string) {
    const viewRes = await supabase
        .from('vw_settlement_case_payment_status_summary')
        .select('paid_amount, payment_status')
        .eq('case_id', caseId);

    if (!viewRes.error) {
        return ((viewRes.data as RefundPaymentRow[] | null) || []);
    }

    const paymentRes = await supabase
        .from('refund_payments')
        .select('paid_amount, payment_status')
        .eq('case_id', caseId);

    return ((paymentRes.data as RefundPaymentRow[] | null) || []);
}

async function fetchSettlementSummary(supabase: SupabaseClient, entityId: string): Promise<SettlementSummary> {
    const settlementCase = await fetchLatestSettlementCase(supabase, entityId);

    if (!settlementCase) {
        return {
            available: false,
            statusLabel: '정산 프로필 미연결',
            createdAtLabel: '-',
            finalRefundAmount: 0,
            paidAmount: 0,
            requestedAmount: 0,
            remainingAmount: 0,
            payoutRate: 0,
            rows: [],
        };
    }

    const [settlementLines, refundPayments] = await Promise.all([
        fetchSettlementLineSummaries(supabase, settlementCase.id),
        fetchSettlementPaymentSummaries(supabase, settlementCase.id),
    ]);

    const totalsByType = settlementLines.reduce<Record<string, number>>((acc, line) => {
        acc[line.line_type] = (acc[line.line_type] || 0) + parseMoney(line.amount);
        return acc;
    }, {});

    const capitalAmount = totalsByType.capital || 0;
    const debtAmount = totalsByType.debt || 0;
    const certBaseAmount = totalsByType.certificate_base_refund || 0;
    const premiumAmount = totalsByType.premium_recognition || 0;
    const rawLossAmount = totalsByType.loss || 0;
    const rawAlreadyPaidAmount = totalsByType.already_paid || 0;
    const adjustmentAmount = totalsByType.adjustment || 0;
    const finalRefundAmount =
        totalsByType.final_refund ??
        (capitalAmount +
            debtAmount +
            certBaseAmount +
            premiumAmount +
            rawLossAmount +
            rawAlreadyPaidAmount +
            adjustmentAmount);
    const normalizedFinalRefundAmount = Math.max(finalRefundAmount, 0);
    const paidAmount = refundPayments.reduce((sum, payment) => (
        payment.payment_status === 'paid' ? sum + parseMoney(payment.paid_amount) : sum
    ), 0);
    const requestedAmount = refundPayments.reduce((sum, payment) => (
        payment.payment_status === 'requested' ? sum + parseMoney(payment.paid_amount) : sum
    ), 0);
    const remainingAmount = Math.max(normalizedFinalRefundAmount - paidAmount, 0);
    const payoutRate =
        normalizedFinalRefundAmount > 0
            ? Math.min((paidAmount / normalizedFinalRefundAmount) * 100, 100)
            : 0;

    return {
        available: true,
        statusLabel: caseStatusLabel[settlementCase.case_status] || settlementCase.case_status,
        createdAtLabel: formatSafeDate(settlementCase.created_at),
        finalRefundAmount: normalizedFinalRefundAmount,
        paidAmount,
        requestedAmount,
        remainingAmount,
        payoutRate,
        rows: [
            { label: '최종 환불 예정', value: formatKRW(normalizedFinalRefundAmount), emphasis: true },
            { label: '권리증 기준 환불', value: formatKRW(certBaseAmount) },
            { label: '인정 프리미엄', value: formatKRW(premiumAmount) },
            { label: '출자금 + 차입금', value: formatKRW(capitalAmount + debtAmount) },
            { label: '매몰비용 차감', value: formatKRW(Math.abs(rawLossAmount)), muted: true },
            { label: '기지급 차감', value: formatKRW(Math.abs(rawAlreadyPaidAmount)), muted: true },
            { label: '요청 지급액', value: formatKRW(requestedAmount), muted: true },
        ],
    };
}

async function fetchRecentActivities(supabase: SupabaseClient, memberIds: string[]): Promise<RecentActivity[]> {
    const { data, error } = await supabase
        .from('interaction_logs')
        .select('id, type, summary, staff_name, created_at')
        .in('entity_id', memberIds)
        .order('created_at', { ascending: false })
        .limit(5);

    if (error || !data) return [];

    return ((data as ActivityLogRow[]) || []).map((row) => {
        const type = row.type || 'NOTE';
        return {
            id: row.id,
            type,
            title: interactionTypeLabel[type] || '활동 기록',
            summary: row.summary || '',
            staffName: row.staff_name,
            createdAt: formatSafeDateTime(row.created_at),
        };
    });
}

function FieldRow({
    label,
    value,
}: {
    label: string;
    value: ReactNode;
}) {
    return (
        <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-slate-200 py-2 last:border-b-0 print:grid-cols-[30mm_1fr]">
            <dt className="text-xs font-semibold text-slate-500 print:text-[10pt]">{label}</dt>
            <dd className="min-w-0 break-keep text-sm font-medium text-slate-900 print:text-[10pt]">{value || '-'}</dd>
        </div>
    );
}

function Section({
    title,
    icon,
    children,
}: {
    title: string;
    icon: string;
    children: ReactNode;
}) {
    return (
        <section className="break-inside-avoid rounded-lg border border-slate-200 bg-white p-5 shadow-sm print:border-slate-300 print:p-0 print:shadow-none">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-950 print:border-b print:border-slate-300 print:pb-2 print:text-[12pt]">
                <MaterialIcon name={icon} size="sm" className="text-sky-600 print:hidden" />
                {title}
            </h2>
            {children}
        </section>
    );
}

function RightsTable({ rights }: { rights: AssetRight[] }) {
    if (rights.length === 0) {
        return (
            <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                등록된 권리증 정보가 없습니다.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm print:min-w-0 print:text-[9pt]">
                <thead>
                    <tr className="border-b border-slate-300 text-xs uppercase text-slate-500 print:text-[8pt]">
                        <th className="py-2 pr-3 font-bold">구분</th>
                        <th className="py-2 pr-3 font-bold">권리증 번호</th>
                        <th className="py-2 pr-3 font-bold">발급일</th>
                        <th className="py-2 pr-3 font-bold">금액</th>
                        <th className="py-2 pr-3 font-bold">취득 정보</th>
                    </tr>
                </thead>
                <tbody>
                    {rights.map((right) => {
                        const meta = parseCertificateMeta(right.right_number_note);
                        const isManaged = meta.node_type === 'derivative';
                        const purchaseParts = [
                            right.holder_name ? `성명 ${right.holder_name}` : null,
                            right.issued_date ? `필증발급 ${right.issued_date}` : null,
                            right.acquisition_source ? `구입처 ${right.acquisition_source}` : null,
                        ].filter(Boolean);

                        return (
                            <tr key={right.id} className="border-b border-slate-200 last:border-b-0">
                                <td className="py-3 pr-3 align-top">
                                    <span className="rounded border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700 print:border-0 print:p-0 print:text-[9pt]">
                                        {isManaged ? '통합 관리번호' : '원천 권리증'}
                                    </span>
                                </td>
                                <td className="break-all py-3 pr-3 align-top font-mono font-bold text-slate-950">
                                    {getRightNumber(right)}
                                    {right.right_number_status && right.right_number_status !== 'confirmed' ? (
                                        <div className="mt-1 text-[11px] font-normal text-amber-700 print:text-[8pt]">
                                            {right.right_number_status}
                                        </div>
                                    ) : null}
                                </td>
                                <td className="py-3 pr-3 align-top font-mono text-slate-700">{right.issued_at || '-'}</td>
                                <td className="py-3 pr-3 align-top font-mono font-semibold text-slate-900">
                                    {formatKRW(right.certificate_price || right.principal_amount)}
                                    {Number(right.premium_price) > 0 ? (
                                        <div className="text-[11px] text-slate-500 print:text-[8pt]">
                                            P {formatKRW(right.premium_price)}
                                        </div>
                                    ) : null}
                                </td>
                                <td className="py-3 pr-3 align-top text-slate-700">
                                    {purchaseParts.length > 0 ? purchaseParts.join(' / ') : '-'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function SettlementSummarySection({ settlement }: { settlement: SettlementSummary | null }) {
    if (!settlement || !settlement.available) {
        return (
            <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                생성된 정산 프로필이 없습니다.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 print:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
                    <p className="text-xs font-bold text-slate-500">정산 상태</p>
                    <p className="mt-1 text-lg font-black text-slate-950 print:text-[12pt]">{settlement.statusLabel}</p>
                    <p className="mt-1 text-xs text-slate-500">생성일 {settlement.createdAtLabel}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
                    <p className="text-xs font-bold text-slate-500">지급 완료</p>
                    <p className="mt-1 font-mono text-lg font-black text-slate-950 print:text-[12pt]">
                        {formatKRW(settlement.paidAmount)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{settlement.payoutRate.toFixed(1)}% 지급</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
                    <p className="text-xs font-bold text-slate-500">잔여 예정액</p>
                    <p className="mt-1 font-mono text-lg font-black text-slate-950 print:text-[12pt]">
                        {formatKRW(settlement.remainingAmount)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">요청 {formatKRW(settlement.requestedAmount)}</p>
                </div>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 print:grid-cols-2">
                {settlement.rows.map((row) => (
                    <div
                        key={row.label}
                        className="flex items-center justify-between border-b border-slate-200 py-2 text-sm print:text-[9pt]"
                    >
                        <dt className={row.muted ? 'font-medium text-slate-500' : 'font-semibold text-slate-600'}>
                            {row.label}
                        </dt>
                        <dd className={row.emphasis ? 'font-mono font-black text-slate-950' : 'font-mono font-bold text-slate-800'}>
                            {row.value}
                        </dd>
                    </div>
                ))}
            </dl>
        </div>
    );
}

function RecentActivitiesList({ activities }: { activities: RecentActivity[] }) {
    if (activities.length === 0) {
        return (
            <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                등록된 최근 활동이 없습니다.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {activities.map((activity) => (
                <div key={activity.id} className="break-inside-avoid border-b border-slate-200 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="rounded border border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700 print:border-0 print:p-0 print:text-[9pt]">
                                {activity.title}
                            </span>
                            {activity.staffName ? (
                                <span className="text-xs font-semibold text-slate-500 print:text-[8pt]">
                                    {activity.staffName}
                                </span>
                            ) : null}
                        </div>
                        <time className="font-mono text-xs text-slate-500 print:text-[8pt]">{activity.createdAt}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-keep text-sm leading-relaxed text-slate-800 print:text-[9pt]">
                        {activity.summary || '-'}
                    </p>
                </div>
            ))}
        </div>
    );
}

export function MemberDetailPageClient({ memberId }: MemberDetailPageClientProps) {
    const router = useRouter();
    const memberIds = useMemo(() => [memberId], [memberId]);
    const [member, setMember] = useState<MemberDetailDialogMember | null>(null);
    const [settlementSummary, setSettlementSummary] = useState<SettlementSummary | null>(null);
    const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [copyState, setCopyState] = useState<CopyState>('idle');

    useEffect(() => {
        let cancelled = false;

        void (async () => {
            const supabase = createClient();
            const [data, settlement, activities] = await Promise.all([
                fetchMemberDetail(memberIds),
                fetchSettlementSummary(supabase, memberId),
                fetchRecentActivities(supabase, memberIds),
            ]);
            if (cancelled) return;
            setMember(data);
            setSettlementSummary(settlement);
            setRecentActivities(activities);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [memberId, memberIds]);

    const refreshMember = useCallback(async () => {
        setLoading(true);
        const supabase = createClient();
        const [data, settlement, activities] = await Promise.all([
            fetchMemberDetail(memberIds),
            fetchSettlementSummary(supabase, memberId),
            fetchRecentActivities(supabase, memberIds),
        ]);
        setMember(data);
        setSettlementSummary(settlement);
        setRecentActivities(activities);
        setLoading(false);
    }, [memberId, memberIds]);

    const rights = useMemo(() => {
        return [...(member?.assetRights || [])].sort((left, right) => {
            const leftMeta = parseCertificateMeta(left.right_number_note);
            const rightMeta = parseCertificateMeta(right.right_number_note);
            const leftPriority = leftMeta.node_type === 'derivative' ? 0 : 1;
            const rightPriority = rightMeta.node_type === 'derivative' ? 0 : 1;
            return leftPriority - rightPriority;
        });
    }, [member?.assetRights]);

    const rightsFlowSummary = useMemo(() => getRightsFlowSummary(member?.assetRights), [member?.assetRights]);
    const managedCertificateNumbers = useMemo(() => getManagedCertificateNumbers(member?.assetRights), [member?.assetRights]);
    const totalCertificateAmount = useMemo(
        () => rights.reduce((sum, right) => sum + (Number(right.certificate_price) || Number(right.principal_amount) || 0), 0),
        [rights],
    );
    const latestActivity = recentActivities[0] || null;

    const handleCopyLink = async () => {
        setCopyState('idle');
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopyState('copied');
        } catch {
            setCopyState('failed');
        }
    };

    const handleSaved = async () => {
        await refreshMember();
        router.refresh();
    };

    if (loading) {
        return (
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-muted-foreground">
                <MaterialIcon name="sync" className="mr-2 animate-spin" size="sm" />
                조합원 상세 정보를 불러오는 중입니다.
            </div>
        );
    }

    if (!member) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center">
                <MaterialIcon name="error_outline" size="xl" className="text-muted-foreground" />
                <p className="text-sm font-semibold text-muted-foreground">존재하지 않거나 불러올 수 없는 조합원입니다.</p>
                <Button asChild variant="outline">
                    <Link href="/members">조합원 목록으로 이동</Link>
                </Button>
            </div>
        );
    }

    return (
        <>
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 14mm;
                    }

                    body {
                        background: #ffffff !important;
                    }

                    body * {
                        visibility: hidden !important;
                    }

                    #member-share-print,
                    #member-share-print * {
                        visibility: visible !important;
                    }

                    #member-share-print {
                        position: absolute !important;
                        inset: 0 auto auto 0 !important;
                        width: 100% !important;
                        background: #ffffff !important;
                        color: #0f172a !important;
                    }
                }
            `}</style>

            <div className="flex min-h-full flex-1 overflow-y-auto bg-slate-100 p-4 md:p-8 print:overflow-visible print:bg-white print:p-0">
                <div className="mx-auto flex max-w-6xl flex-col gap-4 print:max-w-none">
                    <div className="sticky top-0 z-20 -mx-4 -mt-4 mb-4 border-b border-slate-200/80 bg-slate-100/95 px-4 py-3 backdrop-blur md:-mx-8 md:-mt-8 md:px-8 print:hidden">
                        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Link
                                    href="/members"
                                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50"
                                >
                                    <MaterialIcon name="arrow_back" size="xs" />
                                    목록으로 돌아가기
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setDialogOpen(true)}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 text-sm font-black text-sky-700 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-100"
                                >
                                    <MaterialIcon name="open_in_new" size="xs" />
                                    업무 모달로 돌아가기
                                </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleCopyLink}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50"
                                >
                                    <MaterialIcon name="link" size="xs" />
                                    {copyState === 'copied' ? '복사됨' : copyState === 'failed' ? '복사 실패' : '공유 링크 복사'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => window.print()}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-sky-500 bg-sky-500 px-4 text-sm font-black text-white shadow-sm transition-colors hover:border-sky-600 hover:bg-sky-600"
                                >
                                    <MaterialIcon name="picture_as_pdf" size="xs" />
                                    PDF/인쇄
                                </button>
                            </div>
                        </div>
                    </div>

                    <article id="member-share-print" className="rounded-xl bg-white p-6 text-slate-950 shadow-sm print:rounded-none print:p-0 print:shadow-none">
                        <header className="mb-6 border-b border-slate-300 pb-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between print:flex-row">
                                <div>
                                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-500 print:text-[9pt]">
                                        People On 조합원 상세
                                    </p>
                                    <h1 className="text-3xl font-black tracking-tight text-slate-950 print:text-[22pt]">
                                        {member.name}
                                    </h1>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 print:border-slate-300 print:bg-white print:text-slate-900">
                                            {member.status || '상태 미정'}
                                        </span>
                                        {(member.tiers || []).map((tier, index) => (
                                            <span
                                                key={`${tier}-${index}`}
                                                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 print:border-slate-300 print:bg-white print:text-slate-900"
                                            >
                                                {getTierDisplay(tier)}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="min-w-[220px] rounded-lg border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 print:text-[8pt]">대표 권리증</p>
                                    <p className="mt-2 break-all font-mono text-sm font-black text-slate-950 print:text-[10pt]">
                                        {member.certificate_display || '-'}
                                    </p>
                                    <p className="mt-3 text-xs text-slate-500 print:text-[8pt]">
                                        출력일 {new Date().toLocaleDateString('ko-KR')}
                                    </p>
                                </div>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 print:grid-cols-4">
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
                                <p className="text-xs font-bold text-slate-500">최근 활동</p>
                                <p className="mt-1 break-keep text-base font-black text-slate-950 print:text-[11pt]">
                                    {latestActivity ? latestActivity.title : '활동 없음'}
                                </p>
                                <p className="mt-1 font-mono text-xs text-slate-500 print:text-[8pt]">
                                    {latestActivity ? latestActivity.createdAt : '-'}
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
                                <p className="text-xs font-bold text-slate-500">정산 상태</p>
                                <p className="mt-1 text-base font-black text-slate-950 print:text-[11pt]">
                                    {settlementSummary?.statusLabel || '확인 안됨'}
                                </p>
                                <p className="mt-1 font-mono text-xs text-slate-500 print:text-[8pt]">
                                    {settlementSummary?.available ? formatKRW(settlementSummary.finalRefundAmount) : '-'}
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
                                <p className="text-xs font-bold text-slate-500">권리 흐름</p>
                                <p className="mt-1 font-mono text-base font-black text-slate-950 print:text-[11pt]">
                                    {getRightsFlowHeadline(rightsFlowSummary.rawCount, rightsFlowSummary.managedCount)}
                                </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 print:border-slate-300 print:bg-white">
                                <p className="text-xs font-bold text-slate-500">등록 금액 합계</p>
                                <p className="mt-1 font-mono text-base font-black text-slate-950 print:text-[11pt]">
                                    {formatKRW(totalCertificateAmount)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 print:text-[8pt]">
                                    관리번호 {managedCertificateNumbers.length}건
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr] print:grid-cols-2">
                            <Section title="기본 정보" icon="person">
                                <dl>
                                    <FieldRow label="성명" value={member.name} />
                                    <FieldRow label="생년월일" value={member.birth_date || '미입력'} />
                                    <FieldRow label="휴대전화" value={member.phone || '미입력'} />
                                    <FieldRow label="보조 휴대전화" value={member.secondary_phone || '미입력'} />
                                    <FieldRow label="이메일" value={member.email || '미입력'} />
                                    <FieldRow label="현주소" value={member.address_legal || '미입력'} />
                                </dl>
                            </Section>

                            <Section title="대리인 및 메모" icon="groups">
                                <dl>
                                    <FieldRow
                                        label="대리인1"
                                        value={
                                            member.representative
                                                ? `${member.representative.name} (${member.representative.relation}) ${member.representative.phone || ''}`
                                                : '없음'
                                        }
                                    />
                                    <FieldRow
                                        label="대리인2"
                                        value={
                                            member.representative2
                                                ? `${member.representative2.name} (${member.representative2.relation}) ${member.representative2.phone || ''}`
                                                : '없음'
                                        }
                                    />
                                    <FieldRow
                                        label="대리 수행"
                                        value={
                                            member.acts_as_agent_for?.length
                                                ? member.acts_as_agent_for.map((item) => `${item.name} (${item.relation})`).join(', ')
                                                : '없음'
                                        }
                                    />
                                    <FieldRow
                                        label="관리자 메모"
                                        value={<span className="whitespace-pre-wrap">{member.memo || '메모 없음'}</span>}
                                    />
                                </dl>
                            </Section>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr] print:grid-cols-1">
                            <Section title="정산 요약" icon="payments">
                                <SettlementSummarySection settlement={settlementSummary} />
                            </Section>

                            <Section title="최근 활동" icon="history">
                                <RecentActivitiesList activities={recentActivities} />
                            </Section>
                        </div>

                        <div className="mt-5">
                            <Section title="권리증 및 취득 정보" icon="description">
                                <RightsTable rights={rights} />
                            </Section>
                        </div>
                    </article>
                </div>
            </div>

            <MemberDetailDialog
                memberId={memberId}
                memberIds={memberIds}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSaved={handleSaved}
            />
        </>
    );
}
