import { type SupabaseClient } from '@supabase/supabase-js';
import { type UnifiedPerson } from '@/services/memberAggregation';
import { isSettlementTarget, splitSourceCertificateDisplay } from '@/lib/members/unifiedPersonUtils';
import { getSystemUnionFeeSummary, isSystemUnionFeePayment } from '@/lib/payments/systemUnionFee';

export type PaymentStatus = '수납완료' | '부분납' | '미납' | '미설정';

type MemberPaymentRow = {
    id: string;
    entity_id: string;
    unit_type_id: string | null;
    payment_type: string;
    amount_due: number | string | null;
    amount_paid: number | string | null;
    deposit_account_id: string | null;
    paid_date: string | null;
    receipt_note: string | null;
    is_contribution: boolean;
    status: string;
    sort_order: number;
};

type UnitTypeRow = {
    id: string;
    name: string;
    area_sqm: number | null;
};

type DepositAccountRow = {
    id: string;
    account_name: string;
    account_type: string | null;
};

export type PersonPaymentSummary = {
    id: string;
    entityIds: string[];
    name: string;
    phone: string | null;
    address: string | null;
    tier: string | null;
    status: string | null;
    unitGroup: string | null;
    isRegistered: boolean;
    certificateDisplay: string | null;
    sourceCertificateCount: number;
    managedCertificateCount: number;
    rightsFlowLabel: string;
    unitTypeNames: string[];
    accountNames: string[];
    paymentCount: number;
    totalContributionDue: number;
    totalContributionPaid: number;
    totalContributionUnpaid: number;
    totalInvestment: number;
    additionalBurden: number;
    unionFeeDue: number;
    unionFeePaid: number;
    unionFeeUnpaid: number;
    unionFeeStatus: '완납' | '일부납' | '미납' | '미설정';
    latestPaidDate: string | null;
    paymentStatus: PaymentStatus;
    settlementSummary: string;
    settlementTone: 'neutral' | 'warn' | 'positive' | 'danger';
    settlementRemaining: number;
    settlementTarget: boolean;
};

export type PaymentDashboardData = {
    paymentErrorMessage: string | null;
    tiers: string[];
    filteredRows: PersonPaymentSummary[];
    totalRows: number;
    totalContributionDue: number;
    totalContributionPaid: number;
    totalContributionUnpaid: number;
    totalInvestment: number;
    totalAdditionalBurden: number;
    totalSettlementRemaining: number;
    collectionRate: number;
    paymentLineMissingCount: number;
    unitTypeMissingCount: number;
    unpaidCount: number;
    settlementPendingCount: number;
};

const settlementStatusLabelMap: Record<'draft' | 'review' | 'approved' | 'paid' | 'rejected', string> = {
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

const getRightsFlowHeadline = (rawCount: number, managedCount: number) => {
    if ((rawCount === 0 && managedCount === 0) || (rawCount === 1 && managedCount === 1)) {
        return '유지';
    }
    if (rawCount > managedCount) {
        return `통합됨 (${rawCount}→${managedCount})`;
    }
    return `${rawCount}원천 → ${managedCount}관리`;
};

const getPaymentStatus = (due: number, paid: number, paymentCount: number): PaymentStatus => {
    if (paymentCount === 0) return '미설정';
    if (due > 0 && paid >= due) return '수납완료';
    if (paid > 0) return '부분납';
    return '미납';
};

const getSettlementSummary = (person: UnifiedPerson) => {
    const target = isSettlementTarget(person);
    if (!target) {
        return { label: '해당없음', tone: 'neutral' as const };
    }
    if (!person.party_id) {
        return { label: '대상 연결 필요', tone: 'warn' as const };
    }
    if (!person.settlement_status) {
        return { label: '정산대상', tone: 'warn' as const };
    }
    if (person.settlement_remaining > 0) {
        return { label: '잔여 있음', tone: 'danger' as const };
    }
    if (person.settlement_status === 'paid') {
        return { label: '지급완료', tone: 'positive' as const };
    }
    return {
        label: `정산 진행중 · ${settlementStatusLabelMap[person.settlement_status] || '진행중'}`,
        tone: 'warn' as const,
    };
};

const buildSearchTarget = (summary: PersonPaymentSummary) =>
    [
        summary.name,
        summary.phone || '',
        summary.address || '',
        summary.unitGroup || '',
        summary.tier || '',
        summary.certificateDisplay || '',
        summary.unitTypeNames.join(' '),
        summary.accountNames.join(' '),
    ]
        .join(' ')
        .toLowerCase();

function buildPaymentSummaries(
    unifiedPeople: UnifiedPerson[],
    paymentRows: MemberPaymentRow[],
    unitTypes: UnitTypeRow[],
    depositAccounts: DepositAccountRow[],
) {
    const unitTypeMap = new Map(unitTypes.map((item) => [item.id, item]));
    const accountMap = new Map(depositAccounts.map((item) => [item.id, item]));
    const paymentsByEntity = new Map<string, MemberPaymentRow[]>();

    for (const payment of paymentRows) {
        const list = paymentsByEntity.get(payment.entity_id) || [];
        list.push(payment);
        paymentsByEntity.set(payment.entity_id, list);
    }

    return unifiedPeople
        .map<PersonPaymentSummary>((person) => {
            const personPayments = person.entity_ids.flatMap((entityId) => paymentsByEntity.get(entityId) || []);
            const contributionPayments = personPayments.filter(
                (payment) => payment.is_contribution && payment.payment_type !== 'premium' && !isSystemUnionFeePayment(payment),
            );
            const unionFeeSummary = getSystemUnionFeeSummary(personPayments);
            const totalContributionDue =
                contributionPayments.reduce((sum, payment) => sum + parseMoney(payment.amount_due), 0) + unionFeeSummary.totalDue;
            const totalContributionPaid =
                contributionPayments.reduce((sum, payment) => sum + parseMoney(payment.amount_paid), 0) + unionFeeSummary.totalPaid;
            const totalContributionUnpaid = Math.max(totalContributionDue - totalContributionPaid, 0);

            const certificatePaid = personPayments
                .filter((payment) => payment.payment_type === 'certificate')
                .reduce((sum, payment) => sum + parseMoney(payment.amount_paid), 0);
            const premiumRecognized = personPayments
                .filter((payment) => payment.payment_type === 'premium_recognized')
                .reduce((sum, payment) => sum + parseMoney(payment.amount_paid), 0);
            const totalInvestment = certificatePaid + premiumRecognized;
            const additionalBurden = Math.max(totalContributionDue - totalInvestment, 0);
            const unionFeeStatus =
                unionFeeSummary.totalDue <= 0
                    ? '미설정'
                    : unionFeeSummary.totalPaid >= unionFeeSummary.totalDue
                      ? '완납'
                      : unionFeeSummary.totalPaid > 0
                        ? '일부납'
                        : '미납';

            const latestPaidDate = personPayments
                .map((payment) => payment.paid_date)
                .filter((value): value is string => Boolean(value))
                .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] || null;

            const unitTypeNames = Array.from(
                new Set(
                    personPayments
                        .map((payment) => payment.unit_type_id)
                        .filter((value): value is string => Boolean(value))
                        .map((id) => unitTypeMap.get(id)?.name || id),
                ),
            );

            const accountNames = Array.from(
                new Set(
                    personPayments
                        .filter((payment) => parseMoney(payment.amount_paid) > 0 && payment.deposit_account_id)
                        .map((payment) => accountMap.get(payment.deposit_account_id || '')?.account_name || '미지정'),
                ),
            );

            const settlementSummary = getSettlementSummary(person);

            return {
                id: person.id,
                entityIds: person.entity_ids,
                name: person.name,
                phone: person.phone,
                address: person.address_legal || null,
                tier: person.tier,
                status: person.status,
                unitGroup: person.unit_group,
                isRegistered: person.is_registered,
                certificateDisplay: person.certificate_display || null,
                sourceCertificateCount: splitSourceCertificateDisplay(person.certificate_display).length,
                managedCertificateCount: person.managed_certificate_count,
                rightsFlowLabel: getRightsFlowHeadline(person.raw_certificate_count, person.managed_certificate_count),
                unitTypeNames,
                accountNames,
                paymentCount: personPayments.length,
                totalContributionDue,
                totalContributionPaid,
                totalContributionUnpaid,
                totalInvestment,
                additionalBurden,
                unionFeeDue: unionFeeSummary.totalDue,
                unionFeePaid: unionFeeSummary.totalPaid,
                unionFeeUnpaid: unionFeeSummary.totalUnpaid,
                unionFeeStatus,
                latestPaidDate,
                paymentStatus: getPaymentStatus(totalContributionDue, totalContributionPaid, personPayments.length),
                settlementSummary: settlementSummary.label,
                settlementTone: settlementSummary.tone,
                settlementRemaining: person.settlement_remaining,
                settlementTarget: isSettlementTarget(person),
            };
        })
        .sort((left, right) => {
            if (right.totalContributionUnpaid !== left.totalContributionUnpaid) {
                return right.totalContributionUnpaid - left.totalContributionUnpaid;
            }
            if (right.totalContributionDue !== left.totalContributionDue) {
                return right.totalContributionDue - left.totalContributionDue;
            }
            return left.name.localeCompare(right.name, 'ko-KR');
        });
}

export async function fetchPaymentDashboardData(
    supabase: SupabaseClient,
    unifiedPeople: UnifiedPerson[],
    query: string,
    tierFilter: string,
    statusFilter: string,
): Promise<PaymentDashboardData> {
    const allEntityIds = Array.from(new Set(unifiedPeople.flatMap((person) => person.entity_ids)));

    const [memberPaymentsRes, unitTypesRes, accountsRes] = await Promise.all([
        allEntityIds.length > 0
            ? supabase
                .from('member_payments')
                .select('id, entity_id, unit_type_id, payment_type, amount_due, amount_paid, deposit_account_id, paid_date, receipt_note, is_contribution, status, sort_order')
                .in('entity_id', allEntityIds)
                .order('sort_order', { ascending: true })
            : Promise.resolve({ data: [], error: null }),
        supabase
            .from('unit_types')
            .select('id, name, area_sqm')
            .eq('is_active', true)
            .order('area_sqm', { ascending: true }),
        supabase
            .from('deposit_accounts')
            .select('id, account_name, account_type')
            .eq('is_active', true)
            .order('account_type', { ascending: true }),
    ]);

    const paymentRows = (memberPaymentsRes.data as MemberPaymentRow[] | null) || [];
    const unitTypes = (unitTypesRes.data as UnitTypeRow[] | null) || [];
    const depositAccounts = (accountsRes.data as DepositAccountRow[] | null) || [];
    const paymentErrorMessage = memberPaymentsRes.error?.message || null;

    const paymentSummaries = buildPaymentSummaries(unifiedPeople, paymentRows, unitTypes, depositAccounts);

    const tiers = Array.from(
        new Set(paymentSummaries.map((row) => row.tier).filter((tier): tier is string => Boolean(tier))),
    ).sort((left, right) => left.localeCompare(right, 'ko-KR'));

    const filteredRows = paymentSummaries
        .filter((row) => {
            if (!query) return true;
            return buildSearchTarget(row).includes(query.toLowerCase());
        })
        .filter((row) => (tierFilter === 'all' ? true : (row.tier || '미지정') === tierFilter))
        .filter((row) => (statusFilter === 'all' ? true : row.paymentStatus === statusFilter));

    const totalRows = filteredRows.length;
    const totalContributionDue = filteredRows.reduce((sum, row) => sum + row.totalContributionDue, 0);
    const totalContributionPaid = filteredRows.reduce((sum, row) => sum + row.totalContributionPaid, 0);
    const totalContributionUnpaid = filteredRows.reduce((sum, row) => sum + row.totalContributionUnpaid, 0);
    const totalInvestment = filteredRows.reduce((sum, row) => sum + row.totalInvestment, 0);
    const totalAdditionalBurden = filteredRows.reduce((sum, row) => sum + row.additionalBurden, 0);
    const totalSettlementRemaining = filteredRows.reduce((sum, row) => sum + row.settlementRemaining, 0);
    const collectionRate = totalContributionDue > 0 ? Math.round((totalContributionPaid / totalContributionDue) * 100) : 0;
    const paymentLineMissingCount = filteredRows.filter((row) => row.paymentCount === 0).length;
    const unitTypeMissingCount = filteredRows.filter((row) => row.paymentCount > 0 && row.unitTypeNames.length === 0).length;
    const unpaidCount = filteredRows.filter((row) => row.paymentStatus === '미납' || row.paymentStatus === '부분납').length;
    const settlementPendingCount = filteredRows.filter((row) => row.settlementTarget && row.settlementRemaining > 0).length;

    return {
        paymentErrorMessage,
        tiers,
        filteredRows,
        totalRows,
        totalContributionDue,
        totalContributionPaid,
        totalContributionUnpaid,
        totalInvestment,
        totalAdditionalBurden,
        totalSettlementRemaining,
        collectionRate,
        paymentLineMissingCount,
        unitTypeMissingCount,
        unpaidCount,
        settlementPendingCount,
    };
}
