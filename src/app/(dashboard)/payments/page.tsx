import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import {
    buildSettlementPartyOwnershipMap,
    ownerTypeLabel,
    type PartyRoleLite,
    type RightCertificateLite,
    type SettlementOwnerType,
} from '@/lib/settlement/partyOwnership';
import { fetchCertificateCompatRows } from '@/lib/server/certificateCompat';
import { fetchPartyRolesCompat } from '@/lib/server/partyRolesCompat';

export const dynamic = 'force-dynamic';

type PaymentSearchParams = {
    q?: string;
    tier?: string;
    status?: string;
    page?: string;
};

type PaymentStatus = '수납완료' | '부분납' | '미납';

type PaymentRowRaw = {
    id: string;
    member_id: string | null;
    step: number | null;
    step_name: string | null;
    amount_due: number | null;
    amount_paid: number | null;
    paid_date: string | null;
    is_paid: boolean | null;
};

type MemberLite = {
    id: string;
    name: string;
    member_number: string | null;
    phone: string | null;
    tier: string | null;
    status: string | null;
    unit_group: string | null;
};

type EnrichedPaymentRow = {
    id: string;
    member_id: string | null;
    party_id: string | null;
    name: string;
    owner_name: string;
    owner_type: SettlementOwnerType;
    member_number: string | null;
    phone: string | null;
    tier: string | null;
    member_status: string | null;
    unit_group: string | null;
    step: number;
    step_name: string;
    amount_due: number;
    amount_paid: number;
    unpaid: number;
    paid_date: string | null;
    payment_status: PaymentStatus;
};

type PartyProfileRow = {
    id: string;
    display_name: string;
    member_id: string | null;
};

type PartyRoleRow = PartyRoleLite;

type RightCertificateRow = RightCertificateLite;

type SettlementCaseRow = {
    id: string;
    party_id: string;
    case_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected';
    created_at: string;
};

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

type FundNatureBalanceRow = {
    fund_nature: string;
    net_amount: number | string | null;
};

const stepLabelMap: Record<number, string> = {
    1: '계약금',
    2: '1차 중도금',
    3: '2차 중도금',
    4: '잔금',
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

const ownerTypeTextClass: Record<SettlementOwnerType, string> = {
    member_linked: 'text-emerald-300',
    certificate_holder: 'text-sky-300',
    unlinked: 'text-slate-400',
};

const derivePaymentStatus = (amountDue: number, amountPaid: number): PaymentStatus => {
    if (amountDue > 0 && amountPaid >= amountDue) return '수납완료';
    if (amountPaid > 0) return '부분납';
    return '미납';
};

export default async function PaymentsPage({
    searchParams,
}: {
    searchParams: Promise<PaymentSearchParams>;
}) {
    const params = (await searchParams) || {};
    const query = (params.q || '').trim();
    const tierFilter = params.tier || 'all';
    const statusFilter = params.status || 'all';
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = 50;

    const supabase = await createClient();

    const { data: paymentRowsRaw, error: paymentError } = await supabase
        .from('payments')
        .select('id, member_id, step, step_name, amount_due, amount_paid, paid_date, is_paid')
        .order('step', { ascending: true });

    const payments = (paymentRowsRaw as PaymentRowRaw[] | null) || [];
    const memberIds = Array.from(
        new Set(payments.map((payment) => payment.member_id).filter((id): id is string => Boolean(id))),
    );

    let memberMap = new Map<string, MemberLite>();
    if (memberIds.length > 0) {
        const { data: membersRaw } = await supabase
            .from('account_entities')
            .select('id, display_name, member_number, phone, unit_group')
            .in('id', memberIds);

        const members = ((membersRaw as Array<{ id: string; display_name: string; member_number: string | null; phone: string | null; unit_group: string | null }>) || []).map(m => ({
            id: m.id,
            name: m.display_name,
            member_number: m.member_number,
            phone: m.phone,
            tier: null,
            status: null,
            unit_group: m.unit_group,
        }));
        memberMap = new Map(members.map((member) => [member.id, member]));
    }

    let partyByMember = new Map<string, string>();
    let ownershipByParty = new Map<string, { owner_name: string; owner_type: SettlementOwnerType }>();
    if (memberIds.length > 0) {
        const { data: partyProfilesRaw } = await supabase
            .from('party_profiles')
            .select('id, display_name, member_id')
            .in('member_id', memberIds);

        const partyProfiles = (partyProfilesRaw as PartyProfileRow[] | null) || [];
        partyByMember = new Map(
            partyProfiles
                .filter((party) => Boolean(party.member_id))
                .map((party) => [party.member_id as string, party.id]),
        );

        const partyIds = partyProfiles.map((party) => party.id);
        const [roles, certificates] = partyIds.length > 0
            ? await Promise.all([
                fetchPartyRolesCompat(supabase, { partyIds }),
                fetchCertificateCompatRows(supabase, { holderPartyIds: partyIds }),
            ])
            : [
                [] as PartyRoleRow[],
                [] as RightCertificateRow[],
            ];

        const ownershipMap = buildSettlementPartyOwnershipMap({
            parties: partyProfiles,
            members: Array.from(memberMap.values()).map((member) => ({ id: member.id, name: member.name })),
            partyRoles: roles,
            rightCertificates: certificates.map((row) => ({
                holder_party_id: row.holder_party_id,
                status: row.status,
            })),
        });

        ownershipByParty = new Map(
            Array.from(ownershipMap.values()).map((item) => [
                item.party_id,
                { owner_name: item.owner_name, owner_type: item.owner_type },
            ]),
        );
    }

    const allRows: EnrichedPaymentRow[] = payments.map((payment) => {
        const member = payment.member_id ? memberMap.get(payment.member_id) : undefined;
        const partyId = payment.member_id ? (partyByMember.get(payment.member_id) || null) : null;
        const ownership = partyId ? ownershipByParty.get(partyId) : undefined;
        const amountDue = parseMoney(payment.amount_due);
        const amountPaid = parseMoney(payment.amount_paid);
        const unpaid = Math.max(amountDue - amountPaid, 0);
        const step = payment.step || 0;
        const stepName = payment.step_name || stepLabelMap[step] || `${step}차`;
        const ownerName = ownership?.owner_name || member?.name || '미연결 인물';
        const ownerType = ownership?.owner_type || 'unlinked';

        return {
            id: payment.id,
            member_id: payment.member_id,
            party_id: partyId,
            name: member?.name || ownerName,
            owner_name: ownerName,
            owner_type: ownerType,
            member_number: member?.member_number || null,
            phone: member?.phone || null,
            tier: member?.tier || null,
            member_status: member?.status || null,
            unit_group: member?.unit_group || null,
            step,
            step_name: stepName,
            amount_due: amountDue,
            amount_paid: amountPaid,
            unpaid,
            paid_date: payment.paid_date,
            payment_status: derivePaymentStatus(amountDue, amountPaid),
        };
    });

    const tiers = Array.from(new Set(allRows.map((row) => row.tier).filter((tier): tier is string => Boolean(tier)))).sort((a, b) => a.localeCompare(b, 'ko-KR'));

    const filteredRows = allRows
        .filter((row) => {
            if (!query) return true;
            const target = `${row.owner_name} ${row.name} ${row.member_number || ''} ${row.phone || ''} ${row.unit_group || ''}`.toLowerCase();
            return target.includes(query.toLowerCase());
        })
        .filter((row) => (tierFilter === 'all' ? true : row.tier === tierFilter))
        .filter((row) => (statusFilter === 'all' ? true : row.payment_status === statusFilter));

    const totalRows = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const normalizedPage = Math.min(page, totalPages);
    const from = (normalizedPage - 1) * pageSize;
    const to = from + pageSize;
    const pagedRows = filteredRows.slice(from, to);

    const totalDue = filteredRows.reduce((sum, row) => sum + row.amount_due, 0);
    const totalPaid = filteredRows.reduce((sum, row) => sum + row.amount_paid, 0);
    const totalUnpaid = Math.max(totalDue - totalPaid, 0);
    const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;
    const householdCount = new Set(filteredRows.map((row) => row.party_id || row.member_id).filter(Boolean)).size;
    const unpaidCount = filteredRows.filter((row) => row.payment_status !== '수납완료').length;

    const ownerLinkMissingCount = new Set(
        filteredRows
            .filter((row) => row.owner_type === 'unlinked')
            .map((row) => (row.member_id ? `member:${row.member_id}` : `payment:${row.id}`)),
    ).size;

    const filteredPartyIds = Array.from(
        new Set(filteredRows.map((row) => row.party_id).filter((partyId): partyId is string => Boolean(partyId))),
    );

    let remainingRefund = 0;
    let paidRefund = 0;
    let expectedRefund = 0;
    let settlementPendingCases = 0;
    let latestCaseByParty = new Map<string, SettlementCaseRow>();
    let expectedByCase = new Map<string, number>();
    let paidByCase = new Map<string, number>();

    if (filteredPartyIds.length > 0) {
        const { data: settlementCasesRaw } = await supabase
            .from('settlement_cases')
            .select('id, party_id, case_status, created_at')
            .in('party_id', filteredPartyIds)
            .order('created_at', { ascending: false });

        const settlementCases = (settlementCasesRaw as SettlementCaseRow[] | null) || [];
        latestCaseByParty = new Map<string, SettlementCaseRow>();
        for (const settlementCase of settlementCases) {
            if (!latestCaseByParty.has(settlementCase.party_id)) {
                latestCaseByParty.set(settlementCase.party_id, settlementCase);
            }
        }

        const latestCaseIds = Array.from(latestCaseByParty.values()).map((item) => item.id);
        if (latestCaseIds.length > 0) {
            const [linesRes, paymentsRes] = await Promise.all([
                supabase
                    .from('settlement_lines')
                    .select('case_id, line_type, amount')
                    .in('case_id', latestCaseIds)
                    .eq('line_type', 'final_refund'),
                supabase
                    .from('refund_payments')
                    .select('case_id, paid_amount, payment_status')
                    .in('case_id', latestCaseIds),
            ]);

            const lines = (linesRes.data as SettlementLineRow[] | null) || [];
            const paymentsForCases = (paymentsRes.data as RefundPaymentRow[] | null) || [];
            expectedByCase = new Map<string, number>();
            for (const line of lines) {
                expectedByCase.set(line.case_id, (expectedByCase.get(line.case_id) || 0) + parseMoney(line.amount));
            }
            paidByCase = new Map<string, number>();
            for (const payment of paymentsForCases) {
                if (payment.payment_status !== 'paid') continue;
                paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + parseMoney(payment.paid_amount));
            }

            for (const settlementCase of latestCaseByParty.values()) {
                const expected = Math.max(expectedByCase.get(settlementCase.id) || 0, 0);
                const paid = paidByCase.get(settlementCase.id) || 0;
                const remaining = Math.max(expected - paid, 0);
                expectedRefund += expected;
                paidRefund += paid;
                remainingRefund += remaining;
                if (remaining > 0) settlementPendingCases += 1;
            }
        }
    }

    const settlementCaseMissingCount = filteredPartyIds.filter((partyId) => !latestCaseByParty.has(partyId)).length;

    const finalRefundMissingCount = Array.from(latestCaseByParty.values()).filter((settlementCase) => {
        return (expectedByCase.get(settlementCase.id) || 0) <= 0;
    }).length;

    let paidStatusMismatchCount = 0;
    let shouldBePaidCount = 0;
    for (const settlementCase of latestCaseByParty.values()) {
        const expected = Math.max(expectedByCase.get(settlementCase.id) || 0, 0);
        const paid = paidByCase.get(settlementCase.id) || 0;
        const remaining = Math.max(expected - paid, 0);

        if (settlementCase.case_status === 'paid' && remaining > 0) paidStatusMismatchCount += 1;
        if (
            settlementCase.case_status !== 'paid' &&
            settlementCase.case_status !== 'rejected' &&
            expected > 0 &&
            remaining <= 0
        ) {
            shouldBePaidCount += 1;
        }
    }
    const settlementStatusMismatchCount = paidStatusMismatchCount + shouldBePaidCount;
    const qualityIssueCount =
        ownerLinkMissingCount +
        settlementCaseMissingCount +
        finalRefundMissingCount +
        settlementStatusMismatchCount;

    const { data: fundBalancesRaw } = await supabase
        .from('v_fund_nature_balance')
        .select('fund_nature, net_amount');
    const fundBalances = ((fundBalancesRaw as FundNatureBalanceRow[] | null) || []).slice(0, 5);

    const getPageLink = (targetPage: number) => {
        const search = new URLSearchParams();
        if (query) search.set('q', query);
        if (tierFilter !== 'all') search.set('tier', tierFilter);
        if (statusFilter !== 'all') search.set('status', statusFilter);
        search.set('page', String(targetPage));
        return `/payments?${search.toString()}`;
    };

    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
            <Header title="분담금 관리" iconName="payments" />

            <main className="flex-1 overflow-y-auto bg-background">
                <div className="p-4 lg:p-6 space-y-4 max-w-[1600px] mx-auto w-full">
                    <section className="rounded-2xl border border-white/10 bg-[#0f1725] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-extrabold text-foreground">분담금 + 정산 연계 운영</h2>
                                <p className="mt-1 text-xs text-slate-400">수납 현황과 정산/환불 흐름을 같은 화면에서 확인합니다.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link href="/settlements" className="h-9 px-3 rounded-lg border border-sky-400/30 bg-sky-500/10 text-sky-200 text-xs font-bold inline-flex items-center gap-1.5">
                                    <MaterialIcon name="currency_exchange" size="sm" />
                                    정산/환불 이동
                                </Link>
                                <Link href="/finance" className="h-9 px-3 rounded-lg border border-white/15 bg-white/[0.04] text-slate-200 text-xs font-bold inline-flex items-center gap-1.5">
                                    <MaterialIcon name="account_balance" size="sm" />
                                    자금흐름 이동
                                </Link>
                            </div>
                        </div>
                    </section>

                    <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3">
                        <StatCard title="총 청구액" value={formatAmount(totalDue)} icon="receipt_long" tone="default" hint={`${totalRows.toLocaleString()}건 기준`} />
                        <StatCard title="총 수납액" value={formatAmount(totalPaid)} icon="paid" tone="positive" hint={`수납률 ${collectionRate}%`} />
                        <StatCard title="총 미납액" value={formatAmount(totalUnpaid)} icon="warning" tone="danger" hint={`${unpaidCount.toLocaleString()}건 미완료`} />
                        <StatCard title="정산 예정" value={formatAmount(expectedRefund)} icon="account_balance_wallet" tone="warn" hint={`${settlementPendingCases.toLocaleString()}건 진행`} />
                        <StatCard title="정산 지급" value={formatAmount(paidRefund)} icon="payments" tone="positive" hint="환불 지급 기준" />
                        <StatCard title="정산 잔여" value={formatAmount(remainingRefund)} icon="schedule" tone={remainingRefund > 0 ? 'danger' : 'positive'} hint={`${householdCount.toLocaleString()}세대 연결`} />
                    </section>

                    <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <MaterialIcon name="verified_user" size="sm" className="text-sky-300" />
                                <p className="text-sm font-extrabold text-foreground">정산 데이터 품질 경고</p>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${qualityIssueCount > 0 ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                                    {qualityIssueCount > 0 ? `이슈 ${qualityIssueCount.toLocaleString()}건` : '이슈 없음'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link href="/api/settlement/diagnostics/export?scope=issues" className="h-8 px-2.5 rounded border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-[11px] font-bold inline-flex items-center gap-1">
                                    <MaterialIcon name="download" size="xs" />
                                    진단CSV
                                </Link>
                                <Link href="/settlements" className="h-8 px-2.5 rounded border border-white/15 bg-white/[0.04] text-slate-200 text-[11px] font-bold inline-flex items-center gap-1">
                                    <MaterialIcon name="open_in_new" size="xs" />
                                    정산페이지
                                </Link>
                            </div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                            <QualityBadge label="명의 미연결" count={ownerLinkMissingCount} tone={ownerLinkMissingCount > 0 ? 'warn' : 'ok'} href="/settlements?diag=unlinked" />
                            <QualityBadge label="정산케이스 누락" count={settlementCaseMissingCount} tone={settlementCaseMissingCount > 0 ? 'warn' : 'ok'} href="/members?status=%EC%BC%80%EC%9D%B4%EC%8A%A4%EB%88%84%EB%9D%BD" />
                            <QualityBadge label="최종환불선 미설정" count={finalRefundMissingCount} tone={finalRefundMissingCount > 0 ? 'warn' : 'ok'} href="/settlements?diag=no_final_refund" />
                            <QualityBadge label="상태 불일치" count={settlementStatusMismatchCount} tone={settlementStatusMismatchCount > 0 ? 'danger' : 'ok'} href="/settlements?diag=status_mismatch" />
                        </div>
                    </section>

                    {fundBalances.length > 0 && (
                        <section className="rounded-xl border border-white/10 bg-[#101725] p-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-extrabold text-foreground">자금 성격 스냅샷</h3>
                                <span className="text-[10px] text-slate-400 uppercase tracking-widest">v_fund_nature_balance</span>
                            </div>
                            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                                {fundBalances.map((item) => (
                                    <div key={item.fund_nature} className="rounded-lg border border-white/[0.08] bg-[#0b1220] p-3">
                                        <p className="text-[11px] text-slate-400 uppercase tracking-wide">{item.fund_nature}</p>
                                        <p className="mt-1 text-sm font-black text-slate-100">{formatAmount(parseMoney(item.net_amount))}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="rounded-xl border border-white/10 bg-[#101725] p-4">
                        <form method="GET" className="grid grid-cols-1 lg:grid-cols-5 gap-2">
                            <input name="q" defaultValue={query} placeholder="회원명, 조합원번호, 연락처, 동/호수 검색" className="h-10 rounded-lg border border-[#334a69] bg-[#0b1220] px-3 text-sm text-slate-100 placeholder:text-slate-500" />
                            <select name="tier" defaultValue={tierFilter} className="h-10 rounded-lg border border-[#334a69] bg-[#0b1220] px-3 text-sm text-slate-100">
                                <option value="all">전체 차수</option>
                                {tiers.map((tier) => (
                                    <option key={tier} value={tier}>{tier}</option>
                                ))}
                            </select>
                            <select name="status" defaultValue={statusFilter} className="h-10 rounded-lg border border-[#334a69] bg-[#0b1220] px-3 text-sm text-slate-100">
                                <option value="all">전체 수납상태</option>
                                <option value="수납완료">수납완료</option>
                                <option value="부분납">부분납</option>
                                <option value="미납">미납</option>
                            </select>
                            <button type="submit" className="h-10 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold">필터 적용</button>
                            <Link href="/payments" className="h-10 rounded-lg border border-white/15 bg-white/[0.04] text-slate-200 text-sm font-bold inline-flex items-center justify-center">초기화</Link>
                        </form>
                        {paymentError && (
                            <p className="mt-2 text-xs text-rose-300">payments 조회 오류: {paymentError.message}</p>
                        )}
                    </section>

                    <section className="rounded-xl border border-white/10 bg-[#101725] overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm whitespace-nowrap">
                                <thead className="bg-[#121d2d] border-b border-white/[0.08] text-slate-300">
                                    <tr>
                                        <th className="px-4 py-3 text-left">동/호수</th>
                                        <th className="px-4 py-3 text-left">명의/회원</th>
                                        <th className="px-4 py-3 text-left">차수/회차</th>
                                        <th className="px-4 py-3 text-left">수납일</th>
                                        <th className="px-4 py-3 text-right">청구액</th>
                                        <th className="px-4 py-3 text-right">수납액</th>
                                        <th className="px-4 py-3 text-right">미납액</th>
                                        <th className="px-4 py-3 text-center">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.06]">
                                    {pagedRows.length > 0 ? pagedRows.map((row) => (
                                        <tr key={row.id} className="hover:bg-white/[0.02]">
                                            <td className="px-4 py-3 text-slate-200">{row.unit_group || '-'}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-slate-100">{row.owner_name}</p>
                                                <p className={`text-[10px] ${ownerTypeTextClass[row.owner_type]}`}>
                                                    {ownerTypeLabel(row.owner_type)}
                                                </p>
                                                <p className="text-[11px] text-slate-400">
                                                    {row.name}
                                                    {row.member_number ? ` · ${row.member_number}` : ''}
                                                    {row.tier ? ` · ${row.tier}` : ''}
                                                </p>
                                            </td>
                                            <td className="px-4 py-3 text-slate-300">{row.step_name}</td>
                                            <td className="px-4 py-3 text-slate-300">{row.paid_date ? new Date(row.paid_date).toLocaleDateString('ko-KR') : '-'}</td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-300">{row.amount_due.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono text-emerald-300">{row.amount_paid.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono text-amber-200">{row.unpaid.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-center">
                                                <PaymentStatusBadge status={row.payment_status} />
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-10 text-center text-slate-400">조건에 맞는 수납 내역이 없습니다.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t border-white/[0.08] px-4 py-3 flex items-center justify-between text-xs">
                            <p className="text-slate-400">
                                총 <span className="text-slate-200 font-bold">{totalRows.toLocaleString()}건</span> 중 {totalRows === 0 ? 0 : from + 1}-{Math.min(to, totalRows)}
                            </p>
                            <div className="flex items-center gap-1">
                                <Link href={getPageLink(Math.max(1, normalizedPage - 1))} className={`size-7 inline-flex items-center justify-center rounded border border-white/[0.1] ${normalizedPage <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-white/[0.06]'}`}>
                                    <MaterialIcon name="chevron_left" size="sm" />
                                </Link>
                                <span className="px-2 text-slate-300">{normalizedPage} / {totalPages}</span>
                                <Link href={getPageLink(Math.min(totalPages, normalizedPage + 1))} className={`size-7 inline-flex items-center justify-center rounded border border-white/[0.1] ${normalizedPage >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-white/[0.06]'}`}>
                                    <MaterialIcon name="chevron_right" size="sm" />
                                </Link>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    tone = 'default',
    hint,
}: {
    title: string;
    value: string;
    icon: string;
    tone?: 'default' | 'positive' | 'warn' | 'danger';
    hint?: string;
}) {
    const toneClass =
        tone === 'positive'
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            : tone === 'warn'
                ? 'border-amber-400/20 bg-amber-500/10 text-amber-200'
                : tone === 'danger'
                    ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-100';

    return (
        <div className={`rounded-xl border p-3 ${toneClass}`}>
            <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-wide">{title}</p>
                <MaterialIcon name={icon} size="sm" className="opacity-80" />
            </div>
            <p className="mt-2 text-lg font-black">{value}</p>
            {hint && <p className="mt-1 text-[10px] opacity-75">{hint}</p>}
        </div>
    );
}

function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
    if (status === '수납완료') {
        return <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200">수납완료</span>;
    }
    if (status === '부분납') {
        return <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-200">부분납</span>;
    }
    return <span className="inline-flex rounded-full border border-rose-400/20 bg-rose-500/10 px-2 py-1 text-xs font-semibold text-rose-200">미납</span>;
}

function QualityBadge({
    label,
    count,
    tone,
    href,
}: {
    label: string;
    count: number;
    tone: 'ok' | 'warn' | 'danger';
    href?: string;
}) {
    const toneClass =
        tone === 'ok'
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            : tone === 'danger'
                ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                : 'border-amber-400/20 bg-amber-500/10 text-amber-200';

    const badgeClass = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`;
    const content = (
        <>
            <span>{label}</span>
            <span className="font-black">{count.toLocaleString()}건</span>
        </>
    );

    if (!href) {
        return <div className={badgeClass}>{content}</div>;
    }

    return (
        <Link href={href} className={`${badgeClass} hover:opacity-90 transition-opacity`}>
            {content}
            <MaterialIcon name="open_in_new" size="xs" />
        </Link>
    );
}
