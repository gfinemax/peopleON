import { type SupabaseClient } from '@supabase/supabase-js';
import { type UnifiedPerson } from '@/services/memberAggregation';
import { isSettlementTarget, splitSourceCertificateDisplay } from '@/lib/members/unifiedPersonUtils';
import {
    getSystemUnionFeeSummary,
    isSystemUnionFeePayment,
    SYSTEM_UNION_FEE_AMOUNT,
} from '@/lib/payments/systemUnionFee';

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

type MemberPaymentEntitySummaryRow = {
    entity_id: string;
    payment_count: number | string | null;
    contribution_due_base: number | string | null;
    contribution_paid_base: number | string | null;
    certificate_paid: number | string | null;
    premium_recognized_paid: number | string | null;
    union_fee_actual_paid: number | string | null;
    union_fee_count: number | string | null;
    structured_count: number | string | null;
    latest_paid_date: string | null;
    unit_type_names: string[] | null;
    account_names: string[] | null;
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

const parseCount = (value: number | string | null | undefined) => Math.trunc(parseMoney(value));

const toStringArray = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
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

async function fetchPaymentEntitySummaries(supabase: SupabaseClient, entityIds: string[]) {
    if (entityIds.length === 0) return [] as MemberPaymentEntitySummaryRow[];

    const { data, error } = await supabase
        .from('vw_member_payment_entity_summary')
        .select(
            'entity_id, payment_count, contribution_due_base, contribution_paid_base, certificate_paid, premium_recognized_paid, union_fee_actual_paid, union_fee_count, structured_count, latest_paid_date, unit_type_names, account_names',
        )
        .in('entity_id', entityIds);

    if (error) return null;
    return (data as MemberPaymentEntitySummaryRow[] | null) || [];
}

function getUnionFeeStatus(due: number, paid: number): PersonPaymentSummary['unionFeeStatus'] {
    if (due <= 0) return '미설정';
    if (paid >= due) return '완납';
    if (paid > 0) return '일부납';
    return '미납';
}

function buildPaymentSummariesFromEntitySummaries(
    unifiedPeople: UnifiedPerson[],
    entitySummaryRows: MemberPaymentEntitySummaryRow[],
) {
    const summaryByEntity = new Map(entitySummaryRows.map((row) => [row.entity_id, row]));

    return unifiedPeople
        .map<PersonPaymentSummary>((person) => {
            let paymentCount = 0;
            let contributionDue = 0;
            let contributionPaid = 0;
            let certificatePaid = 0;
            let premiumRecognized = 0;
            let unionFeeActualPaid = 0;
            let unionFeeCount = 0;
            let structuredCount = 0;
            let latestPaidDate: string | null = null;
            let latestPaidTime = 0;
            const unitTypeNameSet = new Set<string>();
            const accountNameSet = new Set<string>();

            for (const entityId of person.entity_ids) {
                const summary = summaryByEntity.get(entityId);
                if (!summary) continue;

                paymentCount += parseCount(summary.payment_count);
                contributionDue += parseMoney(summary.contribution_due_base);
                contributionPaid += parseMoney(summary.contribution_paid_base);
                certificatePaid += parseMoney(summary.certificate_paid);
                premiumRecognized += parseMoney(summary.premium_recognized_paid);
                unionFeeActualPaid += parseMoney(summary.union_fee_actual_paid);
                unionFeeCount += parseCount(summary.union_fee_count);
                structuredCount += parseCount(summary.structured_count);

                if (summary.latest_paid_date) {
                    const paidTime = new Date(summary.latest_paid_date).getTime();
                    if (Number.isFinite(paidTime) && paidTime > latestPaidTime) {
                        latestPaidTime = paidTime;
                        latestPaidDate = summary.latest_paid_date;
                    }
                }

                for (const name of toStringArray(summary.unit_type_names)) unitTypeNameSet.add(name);
                for (const name of toStringArray(summary.account_names)) accountNameSet.add(name);
            }

            const unionFeeDue = unionFeeCount > 0 || structuredCount > 0 ? SYSTEM_UNION_FEE_AMOUNT : 0;
            const unionFeePaid = Math.min(unionFeeActualPaid, unionFeeDue);
            const unionFeeUnpaid = Math.max(unionFeeDue - unionFeePaid, 0);
            const totalContributionDue = contributionDue + unionFeeDue;
            const totalContributionPaid = contributionPaid + unionFeePaid;
            const totalContributionUnpaid = Math.max(totalContributionDue - totalContributionPaid, 0);
            const totalInvestment = certificatePaid + premiumRecognized;
            const additionalBurden = Math.max(totalContributionDue - totalInvestment, 0);
            const unitTypeNames = Array.from(unitTypeNameSet);
            const accountNames = Array.from(accountNameSet);
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
                paymentCount,
                totalContributionDue,
                totalContributionPaid,
                totalContributionUnpaid,
                totalInvestment,
                additionalBurden,
                unionFeeDue,
                unionFeePaid,
                unionFeeUnpaid,
                unionFeeStatus: getUnionFeeStatus(unionFeeDue, unionFeePaid),
                latestPaidDate,
                paymentStatus: getPaymentStatus(totalContributionDue, totalContributionPaid, paymentCount),
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
            const unionFeeSummary = getSystemUnionFeeSummary(personPayments);
            let contributionDue = 0;
            let contributionPaid = 0;
            let certificatePaid = 0;
            let premiumRecognized = 0;
            let latestPaidDate: string | null = null;
            let latestPaidTime = 0;
            const unitTypeNameSet = new Set<string>();
            const accountNameSet = new Set<string>();

            for (const payment of personPayments) {
                const paid = parseMoney(payment.amount_paid);

                if (payment.is_contribution && payment.payment_type !== 'premium' && !isSystemUnionFeePayment(payment)) {
                    contributionDue += parseMoney(payment.amount_due);
                    contributionPaid += paid;
                }

                if (payment.payment_type === 'certificate') certificatePaid += paid;
                if (payment.payment_type === 'premium_recognized') premiumRecognized += paid;

                if (payment.paid_date) {
                    const paidTime = new Date(payment.paid_date).getTime();
                    if (Number.isFinite(paidTime) && paidTime > latestPaidTime) {
                        latestPaidTime = paidTime;
                        latestPaidDate = payment.paid_date;
                    }
                }

                if (payment.unit_type_id) {
                    unitTypeNameSet.add(unitTypeMap.get(payment.unit_type_id)?.name || payment.unit_type_id);
                }

                if (paid > 0 && payment.deposit_account_id) {
                    accountNameSet.add(accountMap.get(payment.deposit_account_id)?.account_name || '미지정');
                }
            }

            const totalContributionDue = contributionDue + unionFeeSummary.totalDue;
            const totalContributionPaid = contributionPaid + unionFeeSummary.totalPaid;
            const totalContributionUnpaid = Math.max(totalContributionDue - totalContributionPaid, 0);
            const totalInvestment = certificatePaid + premiumRecognized;
            const additionalBurden = Math.max(totalContributionDue - totalInvestment, 0);
            const unionFeeStatus = getUnionFeeStatus(unionFeeSummary.totalDue, unionFeeSummary.totalPaid);

            const unitTypeNames = Array.from(unitTypeNameSet);
            const accountNames = Array.from(accountNameSet);

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

    const entitySummaryRows = await fetchPaymentEntitySummaries(supabase, allEntityIds);
    let paymentErrorMessage: string | null = null;
    let paymentSummaries: PersonPaymentSummary[];

    if (entitySummaryRows) {
        paymentSummaries = buildPaymentSummariesFromEntitySummaries(unifiedPeople, entitySummaryRows);
    } else {
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
        paymentErrorMessage = memberPaymentsRes.error?.message || null;
        paymentSummaries = buildPaymentSummaries(unifiedPeople, paymentRows, unitTypes, depositAccounts);
    }

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

    let totalContributionDue = 0;
    let totalContributionPaid = 0;
    let totalContributionUnpaid = 0;
    let totalInvestment = 0;
    let totalAdditionalBurden = 0;
    let totalSettlementRemaining = 0;
    let paymentLineMissingCount = 0;
    let unitTypeMissingCount = 0;
    let unpaidCount = 0;
    let settlementPendingCount = 0;

    for (const row of filteredRows) {
        totalContributionDue += row.totalContributionDue;
        totalContributionPaid += row.totalContributionPaid;
        totalContributionUnpaid += row.totalContributionUnpaid;
        totalInvestment += row.totalInvestment;
        totalAdditionalBurden += row.additionalBurden;
        totalSettlementRemaining += row.settlementRemaining;
        if (row.paymentCount === 0) paymentLineMissingCount += 1;
        if (row.paymentCount > 0 && row.unitTypeNames.length === 0) unitTypeMissingCount += 1;
        if (row.paymentStatus === '미납' || row.paymentStatus === '부분납') unpaidCount += 1;
        if (row.settlementTarget && row.settlementRemaining > 0) settlementPendingCount += 1;
    }

    const totalRows = filteredRows.length;
    const collectionRate = totalContributionDue > 0 ? Math.round((totalContributionPaid / totalContributionDue) * 100) : 0;

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
