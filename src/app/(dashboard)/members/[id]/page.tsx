import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { formatSafeDate } from '@/lib/utils';
import { InteractionLog } from '@/components/features/timeline/TimelineItem';
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

interface PartyProfileRow {
    id: string;
    display_name: string;
}

interface SettlementCaseRow {
    id: string;
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
        .select('*')
        .eq('id', id)
        .single();

    if (memberError || !member) {
        return <div className="p-20 text-center font-bold text-muted-foreground">존재하지 않는 조합원입니다.</div>;
    }

    // Parallel Fetching
    const [roleRes, logsRes, rightsRes, relsRes] = await Promise.all([
        supabase
            .from('membership_roles')
            .select('role_code, role_status, is_registered')
            .eq('entity_id', id)
            .maybeSingle(),
        supabase
            .from('interaction_logs')
            .select('*')
            .eq('entity_id', id)
            .order('created_at', { ascending: false }),
        supabase
            .from('asset_rights')
            .select('*')
            .eq('entity_id', id)
            .order('created_at', { ascending: false }),
        supabase
            .from('entity_relationships')
            .select('related_entity_id, relationship_type, is_active, related_entity:account_entities!related_entity_id(display_name, phone)')
            .eq('entity_id', id)
            .eq('is_active', true)
    ]);

    const roleData = roleRes.data;
    const logsData = logsRes.data;
    const assetRights = rightsRes.data || [];
    const relationshipsData = relsRes.data || [];

    const memberTier = roleData?.role_code || '';
    const memberStatus = roleData?.role_status === 'inactive' ? '탈퇴' : '정상';

    // Get relationships (agents, family, etc.)
    const relationships = relationshipsData.map((rel: any) => ({
        name: rel.related_entity?.display_name || 'N/A',
        relation: rel.relationship_type === 'agent' ? '대리인' :
            rel.relationship_type === 'spouse' ? '배우자' :
                rel.relationship_type === 'child' ? '자녀' : rel.relationship_type,
        phone: rel.related_entity?.phone || null
    }));

    // Representative is typically the first agent
    const representative = relationships.find(r => r.relation === '대리인') || relationships[0] || null;

    const logs = (logsData || []) as InteractionLog[];

    // Settlement Summary — directly by entity_id
    let settlementCase: SettlementCaseRow | null = null;
    let settlementLines: SettlementLineRow[] = [];
    let refundPayments: RefundPaymentRow[] = [];

    const caseRes = await supabase
        .from('settlement_cases')
        .select('id, case_status, created_at')
        .eq('entity_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!caseRes.error && caseRes.data) {
        settlementCase = caseRes.data as SettlementCaseRow;

        const [lineRes, paymentRes] = await Promise.all([
            supabase
                .from('settlement_lines')
                .select('line_type, amount')
                .eq('case_id', settlementCase.id),
            supabase
                .from('refund_payments')
                .select('paid_amount, payment_status')
                .eq('case_id', settlementCase.id),
        ]);

        if (!lineRes.error && lineRes.data) {
            settlementLines = lineRes.data as SettlementLineRow[];
        }
        if (!paymentRes.error && paymentRes.data) {
            refundPayments = paymentRes.data as RefundPaymentRow[];
        }
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

    const paidPaymentAmount = refundPayments
        .filter((payment) => payment.payment_status === 'paid')
        .reduce((sum, payment) => sum + parseMoney(payment.paid_amount), 0);

    const requestedPaymentAmount = refundPayments
        .filter((payment) => payment.payment_status === 'requested')
        .reduce((sum, payment) => sum + parseMoney(payment.paid_amount), 0);

    const remainingAmount = Math.max(normalizedFinalRefundAmount - paidPaymentAmount, 0);
    const payoutRate =
        normalizedFinalRefundAmount > 0
            ? Math.min((paidPaymentAmount / normalizedFinalRefundAmount) * 100, 100)
            : 0;

    const recentActivityLabel = logs[0]?.created_at ? `${formatSafeDate(logs[0].created_at)} (전화 상담)` : '2023-10-25 (전화 상담)';

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
                        member={member}
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

                    <MemberDetailRightPanel memberId={id} assetRights={assetRights || []} />
                </div>
            </main>
        </div>
    );
}
