import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { formatSafeDate } from '@/lib/utils';
import { MemberDetailRightPanel } from '@/components/features/members/MemberDetailRightPanel';
import { MemberDetailSidebar } from '@/components/features/members/MemberProfilePageSections';

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

interface MemberProfileRow {
    id: string;
    display_name: string;
    phone: string | null;
    email: string | null;
    address_legal: string | null;
    memo: string | null;
}

interface SettlementCaseRow {
    id: string;
    entity_id?: string;
    case_status: SettlementCaseStatus;
    created_at: string;
}

interface SettlementLineRow {
    line_type: SettlementLineType;
    amount: number | string;
}

interface RefundPaymentRow {
    paid_amount: number | string;
    payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
}

interface LatestInteractionRow {
    created_at: string;
    type: string | null;
}

interface AssetRightRow {
    id: string;
    right_type: string | null;
    right_number: string | null;
    principal_amount: number | string | null;
    recognized_value: number | string | null;
    status: string | null;
    issued_at: string | null;
    land_lot_info: string | null;
    meta: Record<string, unknown> | null;
}

interface RelationshipRow {
    related_entity_id: string;
    relationship_type: string;
    is_active: boolean;
    related_entity?: { display_name?: string | null; phone?: string | null } | null;
}

const caseStatusLabel: Record<SettlementCaseStatus, string> = {
    draft: '작성중',
    review: '검토중',
    approved: '승인됨',
    paid: '지급완료',
    rejected: '반려',
};

const krwFormatter = new Intl.NumberFormat('ko-KR');

function parseMoney(value: number | string | null | undefined): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function formatKRW(value: number): string {
    return `₩${krwFormatter.format(Math.round(value))}`;
}

function formatDate(value?: string | null): string {
    return formatSafeDate(value);
}

const normalizeAssetRight = (right: AssetRightRow) => ({
    id: right.id,
    right_type: right.right_type || 'certificate',
    right_number: right.right_number || '-',
    principal_amount: parseMoney(right.principal_amount),
    recognized_value: parseMoney(right.recognized_value),
    status: right.status || 'unknown',
    issued_at: right.issued_at,
    land_lot_info: right.land_lot_info,
    meta: right.meta || {},
});

const interactionTypeLabel: Record<string, string> = {
    CALL: '전화 상담',
    MEET: '대면 상담',
    SMS: '문자 발송',
    DOC: '서류 기록',
    REPAIR: '수리 건',
    NOTE: '메모',
};

async function fetchLatestSettlementCase(supabase: Awaited<ReturnType<typeof createClient>>, entityId: string) {
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
        .select('id, case_status, created_at')
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (caseRes.error) return null;
    return (caseRes.data as SettlementCaseRow | null) || null;
}

async function fetchSettlementLineSummaries(
    supabase: Awaited<ReturnType<typeof createClient>>,
    caseId: string,
) {
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

async function fetchSettlementPaymentSummaries(
    supabase: Awaited<ReturnType<typeof createClient>>,
    caseId: string,
) {
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

export default async function MemberDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const supabase = await createClient();
    const { id } = await params;

    // Fetch Entity
    const { data: member, error: memberError } = await supabase
        .from('account_entities')
        .select('id, display_name, phone, email, address_legal, memo')
        .eq('id', id)
        .single();

    if (memberError || !member) {
        return <div className="p-20 text-center font-bold text-muted-foreground">존재하지 않는 조합원입니다.</div>;
    }

    // Parallel Fetching
    const [roleRes, latestLogRes, rightsRes, relsRes, settlementCase] = await Promise.all([
        supabase
            .from('membership_roles')
            .select('role_code, role_status, is_registered')
            .eq('entity_id', id)
            .limit(1)
            .maybeSingle(),
        supabase
            .from('interaction_logs')
            .select('created_at, type')
            .eq('entity_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('asset_rights')
            .select('id, right_type, right_number, principal_amount, recognized_value, status, issued_at, land_lot_info, meta')
            .eq('entity_id', id)
            .order('created_at', { ascending: false }),
        supabase
            .from('entity_relationships')
            .select('related_entity_id, relationship_type, is_active, related_entity:account_entities!related_entity_id(display_name, phone)')
            .eq('entity_id', id)
            .eq('is_active', true),
        fetchLatestSettlementCase(supabase, id),
    ]);

    const roleData = roleRes.data;
    const latestLog = latestLogRes.data as LatestInteractionRow | null;
    const assetRights = ((rightsRes.data || []) as AssetRightRow[]).map(normalizeAssetRight);
    const relationshipsData = (relsRes.data || []) as RelationshipRow[];

    const memberTier = roleData?.role_code || '';
    const memberStatus = roleData?.role_status === 'inactive' ? '탈퇴' : '정상';

    // Get relationships (agents, family, etc.)
    const relationships = relationshipsData.map((rel) => ({
        name: rel.related_entity?.display_name || 'N/A',
        relation: rel.relationship_type === 'agent' ? '대리인' :
            rel.relationship_type === 'spouse' ? '배우자' :
                rel.relationship_type === 'child' ? '자녀' : rel.relationship_type,
        phone: rel.related_entity?.phone || null
    }));

    // Representative is typically the first agent
    const representative = relationships.find(r => r.relation === '대리인') || relationships[0] || null;

    // Settlement Summary — directly by entity_id
    let settlementLines: SettlementLineRow[] = [];
    let refundPayments: RefundPaymentRow[] = [];

    if (settlementCase) {
        [settlementLines, refundPayments] = await Promise.all([
            fetchSettlementLineSummaries(supabase, settlementCase.id),
            fetchSettlementPaymentSummaries(supabase, settlementCase.id),
        ]);
    }

    const totalsByType = settlementLines.reduce<Record<string, number>>((acc, line) => {
        const key = line.line_type;
        const amount = parseMoney(line.amount);
        acc[key] = (acc[key] || 0) + amount;
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

    let paidPaymentAmount = 0;
    let requestedPaymentAmount = 0;

    for (const payment of refundPayments) {
        if (payment.payment_status === 'paid') paidPaymentAmount += parseMoney(payment.paid_amount);
        if (payment.payment_status === 'requested') requestedPaymentAmount += parseMoney(payment.paid_amount);
    }

    const remainingAmount = Math.max(normalizedFinalRefundAmount - paidPaymentAmount, 0);
    const payoutRate =
        normalizedFinalRefundAmount > 0
            ? Math.min((paidPaymentAmount / normalizedFinalRefundAmount) * 100, 100)
            : 0;

    const latestLogType = latestLog?.type ? interactionTypeLabel[latestLog.type] || '활동 기록' : '활동 기록';
    const recentActivityLabel = latestLog?.created_at
        ? `${formatSafeDate(latestLog.created_at)} (${latestLogType})`
        : '활동 기록 없음';

    const settlementRows = [
        {
            label: '최종 환불 예정',
            value: formatKRW(normalizedFinalRefundAmount),
            emphasis: true,
        },
        {
            label: '권리증 기준 환불',
            value: formatKRW(certBaseAmount),
        },
        {
            label: '인정 프리미엄',
            value: formatKRW(premiumAmount),
        },
        {
            label: '출자금 + 차입금',
            value: formatKRW(capitalAmount + debtAmount),
        },
        {
            label: '매몰비용 차감',
            value: formatKRW(Math.abs(rawLossAmount)),
            muted: true,
        },
        {
            label: '기지급 차감',
            value: formatKRW(Math.abs(rawAlreadyPaidAmount)),
            muted: true,
        },
        {
            label: '요청 지급액',
            value: formatKRW(requestedPaymentAmount),
            muted: true,
        },
    ];

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden font-sans">
            <Header title="조합원 상세 관리" />

            <main className="flex-1 overflow-y-auto">
                <div className="flex flex-col lg:flex-row gap-8 p-8 lg:p-10 max-w-[1600px] mx-auto w-full h-full">
                    <MemberDetailSidebar
                        member={member as MemberProfileRow}
                        memberTier={memberTier}
                        memberStatus={memberStatus}
                        recentActivityLabel={recentActivityLabel}
                        representative={representative}
                        settlementStatusLabel={settlementCase ? caseStatusLabel[settlementCase.case_status] : undefined}
                        settlementAvailable={Boolean(settlementCase)}
                        settlementRows={settlementRows}
                        payoutRate={payoutRate}
                        paidPaymentLabel={formatKRW(paidPaymentAmount)}
                        remainingAmountLabel={formatKRW(remainingAmount)}
                        settlementCreatedAtLabel={settlementCase ? formatDate(settlementCase.created_at) : undefined}
                    />

                    <MemberDetailRightPanel memberId={id} assetRights={assetRights} />
                </div>
            </main>
        </div>
    );
}
