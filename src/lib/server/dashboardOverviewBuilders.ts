import type { UnifiedPerson } from '@/services/memberAggregation';
import type {
    DashboardActionItem,
    DashboardDepositAccountRow,
    DashboardEvent,
    DashboardFavoriteEntityRow,
    DashboardFavoriteMember,
    DashboardFinancialStats,
    DashboardMemberPaymentRow,
    DashboardNewMemberRow,
    DashboardPaymentBreakdown,
    DashboardPaymentRow,
    DashboardRecentPaymentRow,
    DashboardRetentionStats,
    DashboardUnitTypeRow,
} from '@/lib/server/dashboardOverviewTypes';

export function calculateDashboardRate(paid: number, due: number) {
    return due > 0 ? Math.round((paid / due) * 100) : 0;
}

export function buildDashboardRetentionStats(unifiedPeople: UnifiedPerson[]): DashboardRetentionStats {
    let registeredActive = 0;
    let unregisteredActive = 0;
    let registeredWithdrawn = 0;
    let unregisteredWithdrawn = 0;

    for (const person of unifiedPeople) {
        const isWithdrawnStatus = ['탈퇴', '제명'].includes(person.status || '');
        const isHistoricalMember = person.role_types.includes('member') || isWithdrawnStatus;

        if (!isHistoricalMember) continue;

        if (person.is_registered) {
            if (isWithdrawnStatus) registeredWithdrawn += 1;
            else registeredActive += 1;
        } else {
            if (isWithdrawnStatus) unregisteredWithdrawn += 1;
            else unregisteredActive += 1;
        }
    }

    return {
        registeredActive,
        unregisteredActive,
        registeredWithdrawn,
        unregisteredWithdrawn,
        totalHistorical: registeredActive + unregisteredActive + registeredWithdrawn + unregisteredWithdrawn,
    };
}

export function buildDashboardPaymentBreakdown(allPayments: DashboardPaymentRow[] | null): DashboardPaymentBreakdown {
    const paymentBreakdown: DashboardPaymentBreakdown = {
        step1: { due: 0, paid: 0, rate: 0 },
        step2: { due: 0, paid: 0, rate: 0 },
        step3: { due: 0, paid: 0, rate: 0 },
        general: { due: 0, paid: 0, rate: 0 },
    };

    if (!allPayments) {
        return paymentBreakdown;
    }

    for (const payment of allPayments) {
        const step = payment.step || 0;
        const due = payment.amount_due || 0;
        const paid = payment.amount_paid || 0;

        if (step === 1) {
            paymentBreakdown.step1.due += due;
            paymentBreakdown.step1.paid += paid;
        } else if (step === 2) {
            paymentBreakdown.step2.due += due;
            paymentBreakdown.step2.paid += paid;
        } else if (step === 3) {
            paymentBreakdown.step3.due += due;
            paymentBreakdown.step3.paid += paid;
        } else if (step > 3) {
            paymentBreakdown.general.due += due;
            paymentBreakdown.general.paid += paid;
        }
    }

    paymentBreakdown.step1.rate = calculateDashboardRate(paymentBreakdown.step1.paid, paymentBreakdown.step1.due);
    paymentBreakdown.step2.rate = calculateDashboardRate(paymentBreakdown.step2.paid, paymentBreakdown.step2.due);
    paymentBreakdown.step3.rate = calculateDashboardRate(paymentBreakdown.step3.paid, paymentBreakdown.step3.due);
    paymentBreakdown.general.rate = calculateDashboardRate(paymentBreakdown.general.paid, paymentBreakdown.general.due);

    return paymentBreakdown;
}

export function buildDashboardFinancialStats(
    memberPayments: DashboardMemberPaymentRow[] | null,
    unitTypesData: DashboardUnitTypeRow[] | null,
    accountsData: DashboardDepositAccountRow[] | null,
): DashboardFinancialStats {
    const financialStats: DashboardFinancialStats = {
        contributionDue: 0,
        contributionPaid: 0,
        contributionRate: 0,
        investmentTotal: 0,
        additionalBurden: 0,
        byType: {},
        byUnitType: {},
        byAccount: {},
        hasData: false,
    };

    if (!memberPayments || memberPayments.length === 0) {
        return financialStats;
    }

    const unitMap = new Map((unitTypesData || []).map((unitType) => [unitType.id, unitType.name]));
    const accountMap = new Map(
        (accountsData || []).map((account) => [account.id, { name: account.account_name, type: account.account_type }]),
    );

    const typeLabels: Record<string, string> = {
        certificate: '출자금(필증)',
        premium: '프리미엄',
        premium_recognized: '인정분',
        contract: '계약금',
        installment_1: '1차 분담금',
        installment_2: '2차 분담금',
        balance: '잔금',
        other: '기타',
    };

    let certificatePaid = 0;
    let premiumRecognizedPaid = 0;

    for (const payment of memberPayments) {
        const due = Number(payment.amount_due) || 0;
        const paid = Number(payment.amount_paid) || 0;

        if (payment.is_contribution && payment.payment_type !== 'premium') {
            financialStats.contributionDue += due;
            financialStats.contributionPaid += paid;
        }

        if (payment.payment_type === 'certificate') certificatePaid += paid;
        if (payment.payment_type === 'premium_recognized') premiumRecognizedPaid += paid;

        if (!financialStats.byType[payment.payment_type]) {
            financialStats.byType[payment.payment_type] = {
                label: typeLabels[payment.payment_type] || payment.payment_type,
                due: 0,
                paid: 0,
                rate: 0,
            };
        }
        financialStats.byType[payment.payment_type].due += due;
        financialStats.byType[payment.payment_type].paid += paid;

        if (payment.unit_type_id) {
            const unitTypeName = unitMap.get(payment.unit_type_id) || '미정';
            if (!financialStats.byUnitType[unitTypeName]) {
                financialStats.byUnitType[unitTypeName] = { due: 0, paid: 0, count: 0 };
            }
            financialStats.byUnitType[unitTypeName].due += due;
            financialStats.byUnitType[unitTypeName].paid += paid;
        }

        if (payment.deposit_account_id && paid > 0) {
            const account = accountMap.get(payment.deposit_account_id);
            const accountName = account?.name || '미지정';
            if (!financialStats.byAccount[accountName]) {
                financialStats.byAccount[accountName] = { total: 0, type: account?.type || 'unknown' };
            }
            financialStats.byAccount[accountName].total += paid;
        }
    }

    financialStats.investmentTotal = certificatePaid + premiumRecognizedPaid;
    financialStats.additionalBurden = Math.max(0, financialStats.contributionDue - financialStats.investmentTotal);
    financialStats.contributionRate = calculateDashboardRate(
        financialStats.contributionPaid,
        financialStats.contributionDue,
    );

    for (const key of Object.keys(financialStats.byType)) {
        const typeRow = financialStats.byType[key];
        typeRow.rate = calculateDashboardRate(typeRow.paid, typeRow.due);
    }

    financialStats.hasData = true;
    return financialStats;
}

export function buildDashboardDuplicateConflicts(unifiedPeople: UnifiedPerson[]): DashboardActionItem[] {
    const certificateNumberMap = new Map<string, Array<{ person: UnifiedPerson; rawNum: string }>>();

    for (const person of unifiedPeople) {
        const certificateNumbers = person.certificate_numbers || [];
        if (!person.role_types.includes('certificate_holder') || certificateNumbers.length === 0) continue;

        for (const number of certificateNumbers) {
            const normalizedNumber = number
                .replace(/(^|[^0-9])0+(?=\d)/g, '$1')
                .replace(/\s/g, '')
                .toLowerCase();

            if (!normalizedNumber) continue;

            const existing = certificateNumberMap.get(normalizedNumber) || [];
            existing.push({ person, rawNum: number });
            certificateNumberMap.set(normalizedNumber, existing);
        }
    }

    const duplicateConflicts: DashboardActionItem[] = [];

    for (const [certificateNumber, items] of certificateNumberMap.entries()) {
        if (items.length <= 1) continue;

        const people = items.map((item) => item.person);
        const rawNumber = items[0].rawNum;
        const namesText = people.map((person) => person.name).join(', ');

        duplicateConflicts.push({
            id: `dup-${certificateNumber}`,
            name: `🛑 [권리증 충돌]`,
            member_number: rawNumber,
            tier: `중복 (${people.length}명)`,
            phone: namesText,
            status: '충돌오류',
            href: `/members?q=${encodeURIComponent(rawNumber)}`,
        });
    }

    return duplicateConflicts.slice(0, 8);
}

export function buildDashboardEvents(
    recentPayments: DashboardRecentPaymentRow[] | null,
    newMembers: DashboardNewMemberRow[] | null,
): DashboardEvent[] {
    const rawEvents: Array<DashboardEvent & { dateVal: number }> = [];

    recentPayments?.forEach((payment) => {
        const memberName = Array.isArray(payment.account_entities)
            ? payment.account_entities[0]?.display_name
            : payment.account_entities?.display_name;

        rawEvents.push({
            id: `pay-${payment.id}`,
            dateVal: new Date(payment.paid_date || Date.now()).getTime(),
            title: `수납 확인: ${memberName || '조합원'}`,
            time: typeof payment.paid_date === 'string' ? payment.paid_date.substring(5, 10) : '-',
            desc: `${payment.step_name || `${payment.step || 0}차`} 납부 완료 (${(payment.amount_paid || 0).toLocaleString()}원)`,
            type: 'payment',
        });
    });

    newMembers?.forEach((member) => {
        rawEvents.push({
            id: `new-${member.id}`,
            dateVal: new Date(member.created_at || Date.now()).getTime(),
            title: `신규 가입: ${member.display_name || '이름 미정'}`,
            time: typeof member.created_at === 'string' ? member.created_at.substring(5, 10) : '-',
            desc: `${member.unit_group || '동호수 미정'} 조합원 등록`,
            type: 'member',
        });
    });

    return rawEvents
        .sort((a, b) => b.dateVal - a.dateVal)
        .slice(0, 5)
        .map((event) => ({
            id: event.id,
            title: event.title,
            time: event.time,
            desc: event.desc,
            type: event.type,
        }));
}

export function buildDashboardFavoriteMembers(rows: DashboardFavoriteEntityRow[] | null): DashboardFavoriteMember[] {
    return (rows || []).map((row) => ({
        id: row.id,
        name: row.display_name || '이름 미정',
        member_number: row.member_number,
        tier: row.tier,
        status: row.status,
    }));
}
