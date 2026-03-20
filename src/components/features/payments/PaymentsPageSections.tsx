import Link from 'next/link';
import { MaterialIcon } from '@/components/ui/icon';
import type {
    PersonPaymentSummary,
} from '@/lib/server/paymentDashboard';
import { PaymentsTableClient } from './PaymentsTableClient';
import {
    QualityBadge,
    StatCard,
} from './PaymentsPagePrimitives';

const formatAmount = (value: number) => `₩${Math.round(value).toLocaleString('ko-KR')}`;

export function PaymentsHeroSection() {
    return (
        <section className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#0f1725_0%,#111b2e_100%)] p-5 shadow-lg shadow-black/20">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-sky-200">
                        <MaterialIcon name="payments" size="xs" />
                        사람 기준 납부 운영
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white">권리증 근거를 유지한 사람별 분담금 관리</h2>
                    <p className="text-sm text-slate-400">
                        권리증 금액 근거는 유지하고, 청구·수납·미납은 인물 기준으로 합산해 확인합니다.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/settlements" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 text-xs font-bold text-sky-200">
                        <MaterialIcon name="currency_exchange" size="sm" />
                        정산/환불 이동
                    </Link>
                    <Link href="/certificate-audit" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-3 text-xs font-bold text-slate-200">
                        <MaterialIcon name="fact_check" size="sm" />
                        권리증 검수 이동
                    </Link>
                </div>
            </div>
        </section>
    );
}

export function PaymentsStatsSection({
    totalRows,
    totalContributionDue,
    totalContributionPaid,
    totalContributionUnpaid,
    totalInvestment,
    totalAdditionalBurden,
    totalSettlementRemaining,
    collectionRate,
    unpaidCount,
    settlementPendingCount,
}: {
    totalRows: number;
    totalContributionDue: number;
    totalContributionPaid: number;
    totalContributionUnpaid: number;
    totalInvestment: number;
    totalAdditionalBurden: number;
    totalSettlementRemaining: number;
    collectionRate: number;
    unpaidCount: number;
    settlementPendingCount: number;
}) {
    return (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <StatCard title="총 분담금 청구액" value={formatAmount(totalContributionDue)} icon="receipt_long" tone="default" hint={`${totalRows.toLocaleString()}명 기준`} />
            <StatCard title="총 수납액" value={formatAmount(totalContributionPaid)} icon="paid" tone="positive" hint={`수납률 ${collectionRate}%`} />
            <StatCard title="총 미납액" value={formatAmount(totalContributionUnpaid)} icon="warning" tone="danger" hint={`${unpaidCount.toLocaleString()}명 미완료`} />
            <StatCard title="출자금 반영" value={formatAmount(totalInvestment)} icon="savings" tone="positive" hint="필증 + 인정분" />
            <StatCard title="추가 부담금" value={formatAmount(totalAdditionalBurden)} icon="account_balance_wallet" tone="warn" hint="총분담금 - 출자금" />
            <StatCard title="정산 잔여" value={formatAmount(totalSettlementRemaining)} icon="schedule" tone={totalSettlementRemaining > 0 ? 'danger' : 'positive'} hint={`${settlementPendingCount.toLocaleString()}명 진행`} />
        </section>
    );
}

export function PaymentsQualitySection({
    paymentLineMissingCount,
    unitTypeMissingCount,
    unpaidCount,
    settlementPendingCount,
}: {
    paymentLineMissingCount: number;
    unitTypeMissingCount: number;
    unpaidCount: number;
    settlementPendingCount: number;
}) {
    const issueCount = paymentLineMissingCount + unitTypeMissingCount;

    return (
        <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <MaterialIcon name="verified_user" size="sm" className="text-sky-300" />
                    <p className="text-sm font-extrabold text-foreground">납부 운영 체크</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${issueCount > 0 ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                        {issueCount > 0 ? `이슈 ${issueCount.toLocaleString()}건` : '이슈 없음'}
                    </span>
                    <Link href="/certificate-audit" className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-semibold text-violet-200 hover:bg-violet-500/15">
                        <MaterialIcon name="fact_check" size="xs" />
                        <span>권리증 검수센터</span>
                    </Link>
                </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
                <QualityBadge label="납부선 미설정" count={paymentLineMissingCount} tone={paymentLineMissingCount > 0 ? 'warn' : 'ok'} />
                <QualityBadge label="평형 미지정" count={unitTypeMissingCount} tone={unitTypeMissingCount > 0 ? 'warn' : 'ok'} />
                <QualityBadge label="미납 인물" count={unpaidCount} tone={unpaidCount > 0 ? 'danger' : 'ok'} />
                <QualityBadge label="정산 잔여" count={settlementPendingCount} tone={settlementPendingCount > 0 ? 'warn' : 'ok'} />
            </div>
        </section>
    );
}

export function PaymentsFilterSection({
    query,
    tierFilter,
    statusFilter,
    tiers,
    paymentErrorMessage,
}: {
    query: string;
    tierFilter: string;
    statusFilter: string;
    tiers: string[];
    paymentErrorMessage: string | null;
}) {
    return (
        <section className="rounded-xl border border-white/10 bg-[#101725] p-4">
            <form method="GET" className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1.4fr)_220px_220px_140px_120px]">
                <input
                    name="q"
                    defaultValue={query}
                    placeholder="성명, 연락처, 주소, 권리증번호, 평형, 계좌 검색"
                    className="h-11 rounded-lg border border-[#334a69] bg-[#0b1220] px-3 text-sm text-slate-100 placeholder:text-slate-500"
                />
                <select name="tier" defaultValue={tierFilter} className="h-11 rounded-lg border border-[#334a69] bg-[#0b1220] px-3 text-sm text-slate-100">
                    <option value="all">전체 구분</option>
                    {tiers.map((tier) => (
                        <option key={tier} value={tier}>{tier}</option>
                    ))}
                </select>
                <select name="status" defaultValue={statusFilter} className="h-11 rounded-lg border border-[#334a69] bg-[#0b1220] px-3 text-sm text-slate-100">
                    <option value="all">전체 수납상태</option>
                    <option value="수납완료">수납완료</option>
                    <option value="부분납">부분납</option>
                    <option value="미납">미납</option>
                    <option value="미설정">미설정</option>
                </select>
                <button type="submit" className="h-11 rounded-lg bg-sky-600 text-sm font-bold text-white hover:bg-sky-500">필터 적용</button>
                <Link href="/payments" className="inline-flex h-11 items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] text-sm font-bold text-slate-200">초기화</Link>
            </form>
            {paymentErrorMessage && <p className="mt-2 text-xs text-rose-300">분담금 데이터 조회 오류: {paymentErrorMessage}</p>}
        </section>
    );
}

export function PaymentsTableSection({
    pagedRows,
    totalRows,
    from,
    to,
    normalizedPage,
    totalPages,
    getPageLink,
}: {
    pagedRows: PersonPaymentSummary[];
    totalRows: number;
    from: number;
    to: number;
    normalizedPage: number;
    totalPages: number;
    getPageLink: (targetPage: number) => string;
}) {
    return (
        <PaymentsTableClient
            pagedRows={pagedRows}
            totalRows={totalRows}
            from={from}
            to={to}
            normalizedPage={normalizedPage}
            totalPages={totalPages}
            prevHref={getPageLink(Math.max(1, normalizedPage - 1))}
            nextHref={getPageLink(Math.min(totalPages, normalizedPage + 1))}
        />
    );
}
