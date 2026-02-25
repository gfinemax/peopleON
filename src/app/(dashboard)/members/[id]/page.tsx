import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { InteractionLog } from '@/components/features/timeline/TimelineItem';
import { MemberDetailRightPanel } from '@/components/features/members/MemberDetailRightPanel';

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
    if (!value) return '-';
    return new Date(value).toLocaleDateString('ko-KR');
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

    // Get membership role
    const { data: roleData } = await supabase
        .from('membership_roles')
        .select('role_code, role_status, is_registered')
        .eq('entity_id', id)
        .maybeSingle();

    const memberTier = roleData?.role_code || '';
    const memberStatus = roleData?.role_status === 'inactive' ? '탈퇴' : '정상';

    // Extract agent from meta
    const meta = member.meta as Record<string, unknown> | null;
    const agents = (meta?.agents as Array<{ name: string; relation: string; phone?: string }>) || [];
    const representative = agents[0] || null;

    // Fetch Interaction Logs
    const { data: logsData } = await supabase
        .from('interaction_logs')
        .select('*')
        .eq('member_id', id)
        .order('created_at', { ascending: false });

    // Fetch Legacy Records
    const { data: legacyRecords } = await supabase
        .from('legacy_records')
        .select('*')
        .eq('member_id', id)
        .order('contract_date', { ascending: false });

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

    return (
        <div className="flex-1 flex flex-col h-full bg-background overflow-hidden font-sans">
            <Header title="조합원 상세 관리" />

            <main className="flex-1 overflow-y-auto">
                <div className="flex flex-col lg:flex-row gap-8 p-8 lg:p-10 max-w-[1600px] mx-auto w-full h-full">
                    {/* --- Left Sidebar: Profile Card --- */}
                    <div className="w-full lg:w-80 flex flex-col gap-6 flex-shrink-0">
                        {/* 1. Page Breadcrumbs for Mobile/Tablet context */}
                        {/* 1. Page Breadcrumbs for Mobile/Tablet context - REPLACED with Recent Activity */}
                        <h2 className="text-xl font-extrabold tracking-tight text-foreground mb-1">활동 및 상세 정보</h2>
                        <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground/40 uppercase tracking-wide mb-2 transition-opacity hover:opacity-100 opacity-60">
                            <span>최근 활동: <span className="text-foreground">{logs[0]?.created_at ? new Date(logs[0].created_at).toLocaleDateString() : '2023-10-25'} (전화 상담)</span></span>
                        </div>

                        {/* 2. Main Profile Card */}
                        <div className="flex flex-col rounded-lg border border-border/50 bg-card p-10 relative shadow-sm group">
                            <div className="absolute top-0 right-0 p-4">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-[11px] font-bold text-success border border-success/30 uppercase tracking-wider badge-glow-success">
                                    <span className="size-1.5 rounded-full bg-success" />
                                    {memberStatus} (Active)
                                </span>
                            </div>

                            <div className="flex flex-col items-center text-center mt-4">
                                <div className="relative mb-6">
                                    <div className="size-32 rounded-full overflow-hidden border-4 border-border/30 shadow-2xl transition-transform group-hover:scale-105 duration-500">
                                        <img
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.display_name}`}
                                            alt={member.display_name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 bg-primary text-white size-8 rounded-full flex items-center justify-center shadow-lg border-4 border-card">
                                        <MaterialIcon name="verified" size="sm" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                                    {member.display_name}
                                </h2>
                                <p className="text-sm font-medium text-muted-foreground/60 mt-1">
                                    {memberTier} 조합원 | 가입일 2009년 7월 13일
                                </p>
                            </div>

                            <div className="mt-10 space-y-5">
                                <ProfileInfoItem icon="badge" label="조합원번호" value={member.member_number} />
                                <ProfileInfoItem icon="call" label="연락처" value={member.phone || "010-1234-5678"} isMono />
                                <ProfileInfoItem icon="mail" label="이메일" value={member.email || "user@example.com"} isMono />
                                <ProfileInfoItem icon="location_on" label="주소" value={member.address_legal || "서울시 강남구 테헤란로 123"} />
                            </div>

                            <div className="mt-10 pt-10 border-t border-border/30">
                                <h3 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wider mb-6 px-1">세대 구성원</h3>
                                {representative ? (
                                    <div className="flex items-center gap-4 rounded-xl bg-[#0F1115] px-5 py-6 border border-border/10 group/member hover:border-primary/30 transition-all">
                                        <div className="size-12 rounded-full overflow-hidden border border-white/10 shadow-inner">
                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${representative.name}`} alt="member" className="w-full h-full bg-white/5" />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-sm font-bold text-foreground tracking-tight">
                                                {representative.name} <span className="text-muted-foreground font-normal">({representative.relation || '관계 미지정'})</span>
                                            </p>
                                            <div className="flex items-center gap-2">
                                                {representative.phone && (
                                                    <p className="text-xs font-bold text-muted-foreground/80 font-mono tracking-tight flex items-center gap-1.5">
                                                        <MaterialIcon name="call" size="xs" className="opacity-50" />
                                                        {representative.phone}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center p-4 rounded-lg bg-muted/5 border border-dashed border-border/30 text-xs text-muted-foreground">
                                        등록된 세대 구성원이 없습니다.
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 pt-6 border-t border-border/30">
                                <h3 className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wider mb-4 px-1">특이사항</h3>
                                <div className="p-4 rounded-lg bg-card/50 border border-border/40 text-xs font-medium text-muted-foreground leading-relaxed shadow-sm">
                                    {member.memo || "🔥 VIP 조합원입니다. 특별 관리가 필요합니다."}
                                </div>
                            </div>
                        </div>

                        {/* 3. Financial Summary Card */}
                        <div className="flex flex-col rounded-lg border border-border/50 bg-card p-8 shadow-sm">
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h3 className="text-sm font-black text-foreground">정산 요약</h3>
                                    <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                                        {settlementCase ? `정산 데이터` : '정산 프로필 미연결'}
                                    </p>
                                </div>
                                {settlementCase && (
                                    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-black text-primary uppercase tracking-wider">
                                        {caseStatusLabel[settlementCase.case_status]}
                                    </span>
                                )}
                            </div>

                            {!settlementCase ? (
                                <div className="rounded-lg border border-dashed border-border/40 bg-muted/5 p-4 text-xs font-medium text-muted-foreground">
                                    생성된 정산 케이스가 없습니다.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <SettlementSummaryRow
                                        label="최종 환불 예정"
                                        value={formatKRW(normalizedFinalRefundAmount)}
                                        emphasis
                                    />
                                    <SettlementSummaryRow
                                        label="권리증 기준 환불"
                                        value={formatKRW(certBaseAmount)}
                                    />
                                    <SettlementSummaryRow
                                        label="인정 프리미엄"
                                        value={formatKRW(premiumAmount)}
                                    />
                                    <SettlementSummaryRow
                                        label="출자금 + 차입금"
                                        value={formatKRW(capitalAmount + debtAmount)}
                                    />
                                    <SettlementSummaryRow
                                        label="매몰비용 차감"
                                        value={formatKRW(Math.abs(rawLossAmount))}
                                        muted
                                    />
                                    <SettlementSummaryRow
                                        label="기지급 차감"
                                        value={formatKRW(Math.abs(rawAlreadyPaidAmount))}
                                        muted
                                    />
                                    <SettlementSummaryRow
                                        label="요청 지급액"
                                        value={formatKRW(requestedPaymentAmount)}
                                        muted
                                    />

                                    <div className="pt-3 border-t border-border/30 space-y-2">
                                        <div className="flex items-center justify-between text-[11px] font-bold">
                                            <span className="text-muted-foreground uppercase tracking-wider">지급 진행률</span>
                                            <span className="text-foreground font-mono">{payoutRate.toFixed(0)}%</span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-muted/20 overflow-hidden">
                                            <div
                                                className="h-full bg-primary shadow-[0_0_10px_rgba(59,130,246,0.3)] transition-all"
                                                style={{ width: `${payoutRate}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] font-semibold">
                                            <span className="text-muted-foreground">지급완료 {formatKRW(paidPaymentAmount)}</span>
                                            <span className="text-muted-foreground">잔여 {formatKRW(remainingAmount)}</span>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-border/30 text-[11px] text-muted-foreground font-semibold">
                                        최근 케이스 생성일: {formatDate(settlementCase.created_at)}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- Right Content Area --- */}
                    <MemberDetailRightPanel memberId={id} legacyRecords={legacyRecords || []} />
                </div>
            </main>
        </div>
    );
}

function SettlementSummaryRow({
    label,
    value,
    emphasis = false,
    muted = false,
}: {
    label: string;
    value: string;
    emphasis?: boolean;
    muted?: boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">{label}</span>
            <span
                className={cn(
                    "text-sm font-black tracking-wide font-mono text-foreground",
                    emphasis && "text-xl",
                    muted && "text-muted-foreground"
                )}
            >
                {value}
            </span>
        </div>
    );
}

function ProfileInfoItem({
    icon,
    label,
    value,
    isMono = false,
}: {
    icon: string;
    label: string;
    value: string;
    isMono?: boolean;
}) {
    return (
        <div className="flex items-center gap-4 group/item">
            <div className="text-muted-foreground/40 group-hover/item:text-primary transition-colors">
                <MaterialIcon name={icon} size="sm" />
            </div>
            <div className="flex flex-col">
                <p className="text-[11px] font-bold text-muted-foreground/30 uppercase tracking-wider">{label}</p>
                <p className={cn("text-sm font-bold text-foreground transition-colors group-hover/item:text-primary", isMono && "font-mono")}>{value}</p>
            </div>
        </div>
    );
}

