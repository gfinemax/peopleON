import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { BulkCreateCasesForm } from '@/components/features/settlements/BulkCreateCasesForm';
import { RefundPaymentInlineForm } from '@/components/features/settlements/RefundPaymentInlineForm';
import { SettlementAccessProbeForm } from '@/components/features/settlements/SettlementAccessProbeForm';
import { SettlementQaRunCard } from '@/components/features/settlements/SettlementQaRunCard';
import { SettlementStatusSyncForm } from '@/components/features/settlements/SettlementStatusSyncForm';
import { SettlementOpsChecklistCard } from '@/components/features/settlements/SettlementOpsChecklistCard';
import { SettlementAlertCenterCard } from '@/components/features/settlements/SettlementAlertCenterCard';
import { AccountingCompatReadyCard } from '@/components/features/settlements/AccountingCompatReadyCard';
import {
    buildSettlementPartyOwnershipMap,
    ownerTypeLabel,
    type PartyProfileLite,
    type MemberLite,
    type PartyRoleLite,
    type RightCertificateLite,
    type SettlementOwnerType,
} from '@/lib/settlement/partyOwnership';
import { fetchCertificateCompatRows } from '@/lib/server/certificateCompat';
import { fetchPartyRolesCompat } from '@/lib/server/partyRolesCompat';

export const dynamic = 'force-dynamic';

type SettlementSearchParams = {
    status?: 'all' | 'draft' | 'review' | 'approved' | 'paid' | 'rejected';
    diag?: 'all' | 'unlinked' | 'no_final_refund' | 'status_mismatch' | 'rejected_with_amount';
    q?: string;
    page?: string;
};

type CaseStatus = 'draft' | 'review' | 'approved' | 'paid' | 'rejected';

type SettlementCaseRow = {
    id: string;
    party_id: string;
    case_status: CaseStatus;
    created_at: string;
};

type PartyProfileRow = PartyProfileLite;

type MemberOwnerRow = MemberLite;

type PartyRoleRow = PartyRoleLite;

type RightCertificateRow = RightCertificateLite;

type SettlementLineRow = {
    case_id: string;
    line_type: 'final_refund';
    amount: number | string;
};

type RefundPaymentRow = {
    case_id: string;
    paid_amount: number | string;
    payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
};

const statusClassMap: Record<CaseStatus, string> = {
    draft: 'bg-slate-500/10 text-slate-200 border-slate-400/20',
    review: 'bg-amber-500/10 text-amber-200 border-amber-400/20',
    approved: 'bg-sky-500/10 text-sky-200 border-sky-400/20',
    paid: 'bg-emerald-500/10 text-emerald-200 border-emerald-400/20',
    rejected: 'bg-rose-500/10 text-rose-200 border-rose-400/20',
};

const statusLabelMap: Record<CaseStatus, string> = {
    draft: '작성중',
    review: '검토중',
    approved: '승인',
    paid: '지급완료',
    rejected: '반려',
};

const parseMoney = (value: number | string | null | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const formatAmount = (value: number) => `₩${Math.round(value).toLocaleString('ko-KR')}`;

const ownerBadgeClass: Record<SettlementOwnerType, string> = {
    member_linked: 'text-emerald-200',
    certificate_holder: 'text-sky-200',
    unlinked: 'text-slate-400',
};

export default async function SettlementsPage({
    searchParams,
}: {
    searchParams: Promise<SettlementSearchParams>;
}) {
    const params = (await searchParams) || {};
    const statusFilter = params.status || 'all';
    const diagFilterRaw = params.diag || 'all';
    const diagFilter: SettlementSearchParams['diag'] = (
        diagFilterRaw === 'all' ||
        diagFilterRaw === 'unlinked' ||
        diagFilterRaw === 'no_final_refund' ||
        diagFilterRaw === 'status_mismatch' ||
        diagFilterRaw === 'rejected_with_amount'
    )
        ? diagFilterRaw
        : 'all';
    const query = (params.q || '').trim();
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = 30;

    const supabase = await createClient();

    let queryBuilder = supabase
        .from('settlement_cases')
        .select('id, party_id, case_status, created_at')
        .order('created_at', { ascending: false });

    if (statusFilter !== 'all') {
        queryBuilder = queryBuilder.eq('case_status', statusFilter);
    }

    const { data: settlementCasesRaw, error } = await queryBuilder;
    const settlementCases = (settlementCasesRaw as SettlementCaseRow[] | null) || [];
    const partyIds = Array.from(new Set(settlementCases.map((item) => item.party_id)));

    let partyMap = new Map<string, PartyProfileRow>();
    let ownershipByParty = new Map<string, {
        owner_name: string;
        owner_type: SettlementOwnerType;
    }>();
    if (partyIds.length > 0) {
        const [partiesRes, roles, certificates] = await Promise.all([
            supabase
                .from('party_profiles')
                .select('id, display_name, member_id')
                .in('id', partyIds),
            fetchPartyRolesCompat(supabase, { partyIds }),
            fetchCertificateCompatRows(supabase, { holderPartyIds: partyIds }),
        ]);

        const partiesData = (partiesRes.data as PartyProfileRow[] | null) || [];
        const partyRoles = roles as PartyRoleRow[];
        const rightCertificates = certificates.map((row) => ({
            holder_party_id: row.holder_party_id,
            status: row.status,
        })) as RightCertificateRow[];

        partyMap = new Map(
            partiesData.map((party) => [party.id, party]),
        );

        const memberIds = Array.from(
            new Set(
                partiesData
                    .map((party) => party.member_id)
                    .filter((memberId): memberId is string => Boolean(memberId)),
            ),
        );

        const { data: membersData } = memberIds.length > 0
            ? await supabase
                .from('account_entities')
                .select('id, display_name')
                .in('id', memberIds)
            : { data: [] as Array<{ id: string; display_name: string }> };

        const ownershipMap = buildSettlementPartyOwnershipMap({
            parties: partiesData,
            members: ((membersData as Array<{ id: string; display_name: string }> | null) || []).map(m => ({ id: m.id, name: m.display_name })),
            partyRoles,
            rightCertificates,
        });

        ownershipByParty = new Map(
            Array.from(ownershipMap.values()).map((item) => [
                item.party_id,
                { owner_name: item.owner_name, owner_type: item.owner_type },
            ]),
        );
    }

    const caseIds = settlementCases.map((item) => item.id);
    let finalLineByCase = new Map<string, number>();
    let paidByCase = new Map<string, number>();
    if (caseIds.length > 0) {
        const [linesRes, paymentsRes] = await Promise.all([
            supabase
                .from('settlement_lines')
                .select('case_id, line_type, amount')
                .in('case_id', caseIds)
                .eq('line_type', 'final_refund'),
            supabase
                .from('refund_payments')
                .select('case_id, paid_amount, payment_status')
                .in('case_id', caseIds),
        ]);

        const lines = (linesRes.data as SettlementLineRow[] | null) || [];
        const payments = (paymentsRes.data as RefundPaymentRow[] | null) || [];

        finalLineByCase = new Map<string, number>();
        for (const line of lines) {
            finalLineByCase.set(line.case_id, (finalLineByCase.get(line.case_id) || 0) + parseMoney(line.amount));
        }

        paidByCase = new Map<string, number>();
        for (const payment of payments) {
            if (payment.payment_status !== 'paid') continue;
            paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + parseMoney(payment.paid_amount));
        }
    }

    const rows = settlementCases
        .map((settlementCase) => {
            const party = partyMap.get(settlementCase.party_id);
            const ownership = ownershipByParty.get(settlementCase.party_id) || {
                owner_name: party?.display_name || '-',
                owner_type: 'unlinked' as SettlementOwnerType,
            };
            const expected = Math.max(finalLineByCase.get(settlementCase.id) || 0, 0);
            const paid = paidByCase.get(settlementCase.id) || 0;
            const remaining = Math.max(expected - paid, 0);
            return { settlementCase, party, ownership, expected, paid, remaining };
        })
        .filter((row) => {
            if (!query) return true;
            const target = `${row.ownership.owner_name} ${row.party?.display_name || ''} ${row.settlementCase.id}`.toLowerCase();
            return target.includes(query.toLowerCase());
        })
        .filter((row) => {
            if (diagFilter === 'all') return true;
            if (diagFilter === 'unlinked') return row.ownership.owner_type === 'unlinked';
            if (diagFilter === 'no_final_refund') return row.expected <= 0;
            if (diagFilter === 'status_mismatch') {
                const isPaidButRemaining = row.settlementCase.case_status === 'paid' && row.remaining > 0;
                const isNotPaidButNoRemaining =
                    row.expected > 0 &&
                    row.remaining <= 0 &&
                    row.settlementCase.case_status !== 'paid' &&
                    row.settlementCase.case_status !== 'rejected';
                return isPaidButRemaining || isNotPaidButNoRemaining;
            }
            if (diagFilter === 'rejected_with_amount') {
                return row.settlementCase.case_status === 'rejected' && row.expected > 0;
            }
            return true;
        });

    const totalCases = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalCases / pageSize));
    const normalizedPage = Math.min(page, totalPages);
    const from = (normalizedPage - 1) * pageSize;
    const to = from + pageSize;
    const pagedRows = rows.slice(from, to);

    const expectedTotal = rows.reduce((sum, row) => sum + row.expected, 0);
    const paidTotal = rows.reduce((sum, row) => sum + row.paid, 0);
    const remainingTotal = rows.reduce((sum, row) => sum + row.remaining, 0);
    const connectedCount = rows.filter((row) => row.ownership.owner_type !== 'unlinked').length;
    const pendingCount = rows.filter((row) => row.remaining > 0).length;
    const unlinkedCount = rows.filter((row) => row.ownership.owner_type === 'unlinked').length;
    const zeroFinalRefundCount = rows.filter((row) => row.expected <= 0).length;
    const paidStatusMismatchCount = rows.filter(
        (row) => row.settlementCase.case_status === 'paid' && row.remaining > 0,
    ).length;
    const shouldBePaidCount = rows.filter(
        (row) =>
            row.expected > 0 &&
            row.remaining <= 0 &&
            row.settlementCase.case_status !== 'paid' &&
            row.settlementCase.case_status !== 'rejected',
    ).length;
    const rejectedWithAmountCount = rows.filter(
        (row) => row.settlementCase.case_status === 'rejected' && row.expected > 0,
    ).length;

    const diagnostics = [
        {
            label: '명의 미연결 케이스',
            value: unlinkedCount,
            level: unlinkedCount > 0 ? 'warn' : 'ok',
            message: 'member_id 또는 권리증 소유 연결 필요',
        },
        {
            label: '최종환불선 미설정',
            value: zeroFinalRefundCount,
            level: zeroFinalRefundCount > 0 ? 'warn' : 'ok',
            message: 'settlement_lines.final_refund 확인',
        },
        {
            label: '상태 불일치(지급완료)',
            value: paidStatusMismatchCount + shouldBePaidCount,
            level: paidStatusMismatchCount + shouldBePaidCount > 0 ? 'danger' : 'ok',
            message: 'case_status 와 지급잔여 동기화 필요',
        },
        {
            label: '반려 케이스 금액 보유',
            value: rejectedWithAmountCount,
            level: rejectedWithAmountCount > 0 ? 'warn' : 'ok',
            message: '반려 사유와 금액 정합성 점검',
        },
    ] as const;

    const diagnosticIssueCount = diagnostics.reduce(
        (sum, item) => sum + (item.level === 'ok' ? 0 : item.value),
        0,
    );

    const qaChecklist = [
        {
            label: '명의 연결 정합성',
            detail: `미연결 ${unlinkedCount.toLocaleString()}건`,
            status: unlinkedCount === 0 ? 'pass' : 'fail',
        },
        {
            label: '최종 환불선 기입',
            detail: `미설정 ${zeroFinalRefundCount.toLocaleString()}건`,
            status: zeroFinalRefundCount === 0 ? 'pass' : 'warn',
        },
        {
            label: '케이스 상태 동기화',
            detail: `불일치 ${(paidStatusMismatchCount + shouldBePaidCount).toLocaleString()}건`,
            status: paidStatusMismatchCount + shouldBePaidCount === 0 ? 'pass' : 'fail',
        },
        {
            label: '반려 케이스 금액 검토',
            detail: `금액 보유 ${rejectedWithAmountCount.toLocaleString()}건`,
            status: rejectedWithAmountCount === 0 ? 'pass' : 'warn',
        },
    ] as const;

    const diagnosticsExportHref = '/api/settlement/diagnostics/export?scope=issues';
    const diagnosticsFullExportHref = '/api/settlement/diagnostics/export?scope=all';

    const statusTabs: Array<{ value: SettlementSearchParams['status']; label: string }> = [
        { value: 'all', label: '전체' },
        { value: 'draft', label: '작성중' },
        { value: 'review', label: '검토중' },
        { value: 'approved', label: '승인' },
        { value: 'paid', label: '지급완료' },
        { value: 'rejected', label: '반려' },
    ];

    const diagTabs: Array<{ value: SettlementSearchParams['diag']; label: string }> = [
        { value: 'all', label: '전체진단' },
        { value: 'unlinked', label: '미연결' },
        { value: 'no_final_refund', label: '환불선누락' },
        { value: 'status_mismatch', label: '상태불일치' },
        { value: 'rejected_with_amount', label: '반려금액' },
    ];

    const getLink = (next: {
        status?: SettlementSearchParams['status'];
        diag?: SettlementSearchParams['diag'];
        page?: number;
        q?: string;
    }) => {
        const search = new URLSearchParams();
        const nextStatus = next.status ?? statusFilter;
        const nextDiag = next.diag ?? diagFilter;
        const nextQ = next.q ?? query;
        if (nextStatus && nextStatus !== 'all') search.set('status', nextStatus);
        if (nextDiag && nextDiag !== 'all') search.set('diag', nextDiag);
        if (nextQ) search.set('q', nextQ);
        search.set('page', String(next.page || 1));
        return `/settlements?${search.toString()}`;
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
            <Header title="정산 / 환불" iconName="currency_exchange" />

            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="px-3 lg:px-6 py-3 lg:py-4 space-y-3">
                    <section id="settlement-actions" className="rounded-xl border border-white/[0.08] bg-[#101725] p-4">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black text-foreground">정산 케이스 운영</h2>
                                <p className="mt-1 text-sm text-slate-400">케이스 상태, 지급 진행, 잔여 환불을 운영 단위로 관리합니다.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <BulkCreateCasesForm />
                                <SettlementStatusSyncForm />
                                <SettlementAccessProbeForm />
                                <Link href={diagnosticsExportHref} className="h-9 px-3 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-emerald-500/20">
                                    <MaterialIcon name="download" size="sm" />
                                    진단CSV(이슈)
                                </Link>
                                <Link href={diagnosticsFullExportHref} className="h-9 px-3 rounded-lg border border-white/15 bg-white/[0.04] text-slate-200 text-xs font-bold inline-flex items-center gap-1.5">
                                    <MaterialIcon name="download_for_offline" size="sm" />
                                    진단CSV(전체)
                                </Link>
                                <Link href="/members" className="h-9 px-3 rounded-lg border border-white/15 bg-white/[0.04] text-slate-200 text-xs font-bold inline-flex items-center gap-1.5">
                                    <MaterialIcon name="group" size="sm" />
                                    인물관리 이동
                                </Link>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                        <MiniStat label="케이스 수" value={`${totalCases.toLocaleString()}건`} />
                        <MiniStat label="명의 연결" value={`${connectedCount.toLocaleString()}건`} />
                        <MiniStat label="예정 환불" value={formatAmount(expectedTotal)} />
                        <MiniStat label="지급 완료" value={formatAmount(paidTotal)} />
                        <MiniStat label="잔여 환불" value={formatAmount(remainingTotal)} tone={remainingTotal > 0 ? 'warn' : 'default'} />
                    </section>

                    <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h3 className="text-sm font-extrabold text-foreground">운영 진단</h3>
                                <p className="mt-1 text-[11px] text-slate-400">
                                    연결/정산선/상태 정합성을 빠르게 점검합니다.
                                </p>
                            </div>
                            <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold ${diagnosticIssueCount > 0 ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                                {diagnosticIssueCount > 0 ? `이슈 ${diagnosticIssueCount.toLocaleString()}건` : '이슈 없음'}
                            </span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                            {diagnostics.map((item) => (
                                <DiagnosticStat
                                    key={item.label}
                                    label={item.label}
                                    value={item.value}
                                    level={item.level}
                                    message={item.message}
                                />
                            ))}
                        </div>
                    </section>

                    <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-extrabold text-foreground">운영 QA 체크리스트</h3>
                            <span className="text-[10px] text-slate-400">실데이터 기준 자동 진단</span>
                        </div>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                            {qaChecklist.map((item) => (
                                <ChecklistItem
                                    key={item.label}
                                    label={item.label}
                                    detail={item.detail}
                                    status={item.status}
                                />
                            ))}
                        </div>
                    </section>

                    <SettlementQaRunCard />
                    <SettlementAlertCenterCard />
                    <SettlementOpsChecklistCard />
                    <AccountingCompatReadyCard />

                    <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
                        <div className="flex flex-wrap items-center gap-2">
                            {diagTabs.map((tab) => (
                                <Link
                                    key={`diag-${tab.value}`}
                                    href={getLink({ diag: tab.value, page: 1 })}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${diagFilter === tab.value
                                        ? 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                                        : 'border-white/15 bg-white/[0.03] text-slate-300 hover:text-slate-100'
                                        }`}
                                >
                                    {tab.label}
                                </Link>
                            ))}

                            <div className="h-5 w-px bg-white/10 mx-0.5" />

                            {statusTabs.map((tab) => (
                                <Link
                                    key={tab.value}
                                    href={getLink({ status: tab.value, page: 1 })}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${statusFilter === tab.value
                                        ? 'border-sky-400/40 bg-sky-500/10 text-sky-200'
                                        : 'border-white/15 bg-white/[0.03] text-slate-300 hover:text-slate-100'
                                        }`}
                                >
                                    {tab.label}
                                </Link>
                            ))}

                            <form method="GET" className="ml-auto flex items-center gap-2">
                                {statusFilter !== 'all' && <input type="hidden" name="status" value={statusFilter} />}
                                {diagFilter !== 'all' && <input type="hidden" name="diag" value={diagFilter} />}
                                <input
                                    name="q"
                                    defaultValue={query}
                                    placeholder="인물명/케이스ID 검색"
                                    className="h-9 rounded-lg border border-[#334a69] bg-[#0b1220] px-3 text-xs text-slate-100 placeholder:text-slate-500"
                                />
                                <button type="submit" className="h-9 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold">검색</button>
                                <Link href={getLink({ status: statusFilter, diag: diagFilter, q: '', page: 1 })} className="h-9 px-3 rounded-lg border border-white/15 bg-white/[0.03] text-slate-300 text-xs font-bold inline-flex items-center">초기화</Link>
                            </form>
                        </div>
                        <p className="mt-2 text-[11px] text-slate-400">잔여 환불이 있는 케이스: {pendingCount.toLocaleString()}건</p>
                    </section>
                </div>

                <div className="px-3 lg:px-6 pb-4 lg:pb-6">
                    <div className="min-h-[360px] max-h-[72vh] rounded-xl border border-white/[0.08] bg-[#101725] overflow-hidden">
                        {error ? (
                            <div className="h-full flex items-center justify-center text-sm text-rose-300">
                                정산 데이터를 불러오지 못했습니다: {error.message}
                            </div>
                        ) : pagedRows.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center gap-2 text-slate-400">
                                <MaterialIcon name="inventory_2" size="xl" className="opacity-40" />
                                <p>조건에 맞는 정산 케이스가 없습니다.</p>
                            </div>
                        ) : (
                            <div className="h-full overflow-auto">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-[#121d2d] text-slate-300 border-b border-white/[0.08]">
                                        <tr>
                                            <th className="px-4 py-3 text-left">케이스 ID</th>
                                            <th className="px-4 py-3 text-left">인물</th>
                                            <th className="px-4 py-3 text-left">상태</th>
                                            <th className="px-4 py-3 text-right">정산예정</th>
                                            <th className="px-4 py-3 text-right">지급</th>
                                            <th className="px-4 py-3 text-right">잔여</th>
                                            <th className="px-4 py-3 text-right">지급등록</th>
                                            <th className="px-4 py-3 text-left">생성일</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.06]">
                                        {pagedRows.map(({ settlementCase, party, ownership, expected, paid, remaining }) => (
                                            <tr key={settlementCase.id} className="hover:bg-white/[0.02]">
                                                <td className="px-4 py-3 font-mono text-xs text-slate-300">{settlementCase.id}</td>
                                                <td className="px-4 py-3 text-slate-100">
                                                    <p className="font-semibold">{ownership.owner_name}</p>
                                                    <p className={`text-[11px] ${ownerBadgeClass[ownership.owner_type]}`}>
                                                        {ownerTypeLabel(ownership.owner_type)}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClassMap[settlementCase.case_status]}`}>
                                                        {statusLabelMap[settlementCase.case_status]}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-slate-200">{formatAmount(expected)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-emerald-300">{formatAmount(paid)}</td>
                                                <td className="px-4 py-3 text-right font-mono text-amber-200">{formatAmount(remaining)}</td>
                                                <td className="px-4 py-3 text-right">
                                                    <RefundPaymentInlineForm
                                                        caseId={settlementCase.id}
                                                        remainingAmount={remaining}
                                                        defaultReceiverName={ownership.owner_name || party?.display_name || ''}
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-slate-300">{new Date(settlementCase.created_at).toLocaleDateString('ko-KR')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="border-t border-white/[0.08] px-4 py-3 flex items-center justify-between text-xs">
                            <p className="text-slate-400">
                                총 <span className="text-slate-200 font-bold">{totalCases.toLocaleString()}건</span> 중 {totalCases === 0 ? 0 : from + 1}-{Math.min(to, totalCases)}
                            </p>
                            <div className="flex items-center gap-1">
                                <Link href={getLink({ page: Math.max(1, normalizedPage - 1) })} className={`size-7 inline-flex items-center justify-center rounded border border-white/[0.1] ${normalizedPage <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-white/[0.06]'}`}>
                                    <MaterialIcon name="chevron_left" size="sm" />
                                </Link>
                                <span className="px-2 text-slate-300">{normalizedPage} / {totalPages}</span>
                                <Link href={getLink({ page: Math.min(totalPages, normalizedPage + 1) })} className={`size-7 inline-flex items-center justify-center rounded border border-white/[0.1] ${normalizedPage >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-white/[0.06]'}`}>
                                    <MaterialIcon name="chevron_right" size="sm" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MiniStat({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: string;
    tone?: 'default' | 'warn';
}) {
    return (
        <div className={`rounded-lg border p-3 ${tone === 'warn' ? 'border-amber-400/20 bg-amber-500/10' : 'border-white/10 bg-[#101725]'}`}>
            <p className="text-[11px] text-slate-400 uppercase tracking-wide">{label}</p>
            <p className={`mt-1 text-sm font-black ${tone === 'warn' ? 'text-amber-200' : 'text-slate-100'}`}>{value}</p>
        </div>
    );
}

function DiagnosticStat({
    label,
    value,
    level,
    message,
}: {
    label: string;
    value: number;
    level: 'ok' | 'warn' | 'danger';
    message: string;
}) {
    const toneClass =
        level === 'ok'
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            : level === 'danger'
                ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                : 'border-amber-400/20 bg-amber-500/10 text-amber-200';

    return (
        <div className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-300">{label}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${toneClass}`}>
                    {value.toLocaleString()}건
                </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">{message}</p>
        </div>
    );
}

function ChecklistItem({
    label,
    detail,
    status,
}: {
    label: string;
    detail: string;
    status: 'pass' | 'warn' | 'fail';
}) {
    const style =
        status === 'pass'
            ? {
                box: 'border-emerald-400/20 bg-emerald-500/10',
                text: 'text-emerald-200',
                icon: 'check_circle',
                label: '정상',
            }
            : status === 'warn'
                ? {
                    box: 'border-amber-400/20 bg-amber-500/10',
                    text: 'text-amber-200',
                    icon: 'error',
                    label: '주의',
                }
                : {
                    box: 'border-rose-400/20 bg-rose-500/10',
                    text: 'text-rose-200',
                    icon: 'cancel',
                    label: '점검필요',
                };

    return (
        <div className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-3">
            <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-slate-200 font-semibold">{label}</p>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.box} ${style.text}`}>
                    <MaterialIcon name={style.icon} size="xs" />
                    {style.label}
                </span>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">{detail}</p>
        </div>
    );
}
