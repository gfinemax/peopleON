import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import Link from 'next/link';
import { MembersTable } from '@/components/features/members/MembersTable';
import { MembersFilter } from '@/components/features/members/MembersFilter';
import { MembersKpiStrip } from '@/components/features/members/MembersKpiStrip';

export const dynamic = 'force-dynamic';

type MembersSearchParams = {
    q?: string;
    sort?: string;
    order?: string;
    page?: string;
    role?: string;
    tier?: string;
    status?: string;
    tag?: string;
};

type RoleType = 'member' | 'certificate_holder' | 'related_party' | 'refund_applicant';

type AccountEntityRow = {
    id: string;
    entity_type: string;
    display_name: string;
    phone: string | null;
    member_number: string | null;
    address_legal: string | null;
    unit_group: string | null;
    memo: string | null;
    is_favorite: boolean;
    tags: string[] | null;
    email: string | null;
    meta: Record<string, unknown> | null;
};

type MembershipRoleRow = {
    id: string;
    entity_id: string;
    role_code: string;
    role_status: string;
    is_registered: boolean;
};

type SettlementCaseRow = {
    id: string;
    entity_id: string;
    case_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected';
    created_at: string;
};

type SettlementLineRow = {
    case_id: string;
    line_type: 'capital' | 'debt' | 'loss' | 'certificate_base_refund' | 'premium_recognition' | 'already_paid' | 'adjustment' | 'final_refund';
    amount: number | string;
};

type RefundPaymentRow = {
    case_id: string;
    paid_amount: number | string;
    payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
};

type ExceptionQueueItem = { label: string; count: number; tone: 'danger' | 'warn' | 'info' };

type UnifiedPerson = {
    id: string;
    member_id: string | null;
    party_id: string | null;
    name: string;
    member_number: string | null;
    phone: string | null;
    tier: string | null;
    status: string | null;
    is_registered: boolean;
    unit_group: string | null;
    is_favorite?: boolean;
    tags?: string[] | null;
    relationships?: { name: string; relation: string; phone?: string }[] | null;
    role_types: RoleType[];
    source_type: 'member' | 'party_only';
    ui_role: 'member' | 'landowner' | 'general' | 'investor' | 'party' | 'other';
    settlement_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected' | null;
    settlement_expected: number;
    settlement_paid: number;
    settlement_remaining: number;
    notes?: string | null;
    meta?: Record<string, unknown> | null;
};

const tierOrder = ['등기조합원', '2차', '일반분양', '지주', '지주조합원', '대리인', '예비조합원', '권리증환불', '관계인'];

const normalizeTierFilter = (raw?: string) => {
    const value = (raw || '').trim();
    if (!value || value === 'all') return 'all';
    if (value === '1차') return '등기조합원';
    if (value === '일반') return '일반분양';
    if (value === '예비') return '예비조합원';
    if (value === '3차') return '일반분양';
    if (value === '4차') return 'all';
    if (value === '권리증 환불') return '권리증환불';
    if (value === '비조합원 권리증') return '권리증환불';
    return value;
};

const normalizeText = (value?: string | null) => (value || '').replace(/\s+/g, '').toLowerCase();

const normalizeTierLabel = (rawTier?: string | null, isRegistered = false) => {
    const tierText = normalizeText(rawTier);
    if (tierText === '1차') return '등기조합원';
    if (tierText === '2차') return '2차';
    if (tierText === '일반' || tierText === '일반분양' || tierText === '3차') return '일반분양';
    if (tierText === '지주조합원') return '지주조합원';
    if (tierText === '지주') return '지주';
    if (tierText === '대리인' || tierText === '대리') return '대리인';
    if (tierText === '예비' || tierText === '예비조합원') return '예비조합원';
    if (tierText === '권리증환불' || tierText === '비조합원권리증') return '권리증환불';
    if (tierText === '관계인') return '관계인';
    if (!tierText && isRegistered) return '등기조합원';
    return rawTier?.trim() || null;
};

const getUiRoleFromTier = (tier: string | null): 'member' | 'landowner' | 'general' | 'investor' | 'party' | 'other' => {
    const t = normalizeText(tier);
    if (!t) return 'other';
    if (['등기조합원', '1차', '2차', '예비조합원', '예비', '지주조합원'].includes(t)) return 'member';
    if (['지주'].includes(t)) return 'landowner';
    if (['일반분양', '일반', '3차'].includes(t)) return 'general';
    if (['권리증환불', '비조합원권리증'].includes(t)) return 'investor';
    if (['대리인', '대리', '관계인'].includes(t)) return 'party';
    return 'other';
};

const isProxyRelationType = (relationType?: string | null) => {
    const normalized = normalizeText(relationType);
    return normalized === 'proxy' || normalized === 'agent' || normalized === 'attorney' || normalized === '대리' || normalized === '대리인';
};

const caseStatusLabelMap: Record<'draft' | 'review' | 'approved' | 'paid' | 'rejected', string> = {
    draft: '작성중',
    review: '검토중',
    approved: '승인',
    paid: '지급완료',
    rejected: '반려',
};

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message?: unknown }).message || 'Unknown Error');
    }
    return 'Unknown Error';
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

const getRange = (page: number, size: number) => {
    const from = (page - 1) * size;
    const to = from + size - 1;
    return { from, to };
};

function comparePeople(a: UnifiedPerson, b: UnifiedPerson, field: string, order: 'asc' | 'desc') {
    const multiplier = order === 'asc' ? 1 : -1;
    const valueOf = (person: UnifiedPerson): string | number => {
        switch (field) {
            case 'member_number':
                return person.member_number || '';
            case 'phone':
                return person.phone || '';
            case 'tier':
                return person.tier || '';
            case 'status':
                return person.status || '';
            case 'settlement_remaining':
                return person.settlement_remaining;
            case 'settlement_expected':
                return person.settlement_expected;
            case 'name':
            default:
                return person.name;
        }
    };

    const left = valueOf(a);
    const right = valueOf(b);
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * multiplier;
    return String(left).localeCompare(String(right), 'ko-KR') * multiplier;
}

export default async function MembersPage({
    searchParams,
}: {
    searchParams: Promise<MembersSearchParams>;
}) {
    const params = (await searchParams) || {};
    const query = params.q?.trim() || '';
    const sortField = params.sort || 'name';
    const sortOrder = params.order === 'desc' ? 'desc' : 'asc';
    const page = Math.max(1, Number(params.page) || 1);
    const roleFilter = params.role || 'all';
    const tierFilter = normalizeTierFilter(params.tier);
    const statusFilter = params.status;
    const tagFilter = params.tag?.trim() || '';
    const pageSize = 50;

    const supabase = await createClient();

    let fetchError: unknown = null;

    // ── account_entities + membership_roles 기반 조회 ──
    const [entitiesRes, rolesRes, casesRes] = await Promise.all([
        supabase
            .from('account_entities')
            .select('id, entity_type, display_name, phone, member_number, address_legal, unit_group, memo, is_favorite, tags, email, meta'),
        supabase
            .from('membership_roles')
            .select('id, entity_id, role_code, role_status, is_registered'),
        supabase
            .from('settlement_cases')
            .select('id, entity_id, case_status, created_at')
            .order('created_at', { ascending: false }),
    ]);

    if (entitiesRes.error) fetchError = entitiesRes.error;
    if (rolesRes.error && !fetchError) fetchError = rolesRes.error;
    if (casesRes.error && !fetchError) fetchError = casesRes.error;

    const entities = (entitiesRes.data as AccountEntityRow[] | null) || [];
    const roles = (rolesRes.data as MembershipRoleRow[] | null) || [];
    const settlementCases = (casesRes.data as SettlementCaseRow[] | null) || [];
    const suspenseCount = 0;
    const pendingDocumentCount = 0;

    // 역할 매핑: entity_id → 역할 목록
    const rolesByEntity = new Map<string, MembershipRoleRow[]>();
    for (const role of roles) {
        const existing = rolesByEntity.get(role.entity_id) || [];
        existing.push(role);
        rolesByEntity.set(role.entity_id, existing);
    }

    // 정산 케이스 매핑: entity_id → 최신 케이스
    const latestCaseByEntity = new Map<string, SettlementCaseRow>();
    for (const sc of settlementCases) {
        if (!latestCaseByEntity.has(sc.entity_id)) {
            latestCaseByEntity.set(sc.entity_id, sc);
        }
    }

    const latestCaseIds = Array.from(latestCaseByEntity.values()).map((item) => item.id);
    let settlementLines: SettlementLineRow[] = [];
    let refundPayments: RefundPaymentRow[] = [];

    if (latestCaseIds.length > 0) {
        const [linesRes, paymentsRes] = await Promise.all([
            supabase
                .from('settlement_lines')
                .select('case_id, line_type, amount')
                .in('case_id', latestCaseIds),
            supabase
                .from('refund_payments')
                .select('case_id, paid_amount, payment_status')
                .in('case_id', latestCaseIds),
        ]);

        if (linesRes.error && !fetchError) fetchError = linesRes.error;
        if (paymentsRes.error && !fetchError) fetchError = paymentsRes.error;

        settlementLines = (linesRes.data as SettlementLineRow[] | null) || [];
        refundPayments = (paymentsRes.data as RefundPaymentRow[] | null) || [];
    }

    const finalRefundByCase = new Map<string, number>();
    for (const line of settlementLines) {
        if (line.line_type !== 'final_refund') continue;
        finalRefundByCase.set(line.case_id, (finalRefundByCase.get(line.case_id) || 0) + parseMoney(line.amount));
    }

    const paidByCase = new Map<string, number>();
    for (const payment of refundPayments) {
        if (payment.payment_status !== 'paid') continue;
        paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + parseMoney(payment.paid_amount));
    }

    // ── account_entities → UnifiedPerson 변환 ──
    const unifiedPeople: UnifiedPerson[] = [];

    for (const entity of entities) {
        const entityRoles = rolesByEntity.get(entity.id) || [];
        const activeRole = entityRoles.find(r => r.role_status === 'active') || entityRoles[0];
        const tier = activeRole ? normalizeTierLabel(activeRole.role_code, activeRole.is_registered) : null;
        const isRegistered = entityRoles.some(r => r.is_registered);
        const isWithdrawn = entityRoles.length > 0 && entityRoles.every(r => r.role_status === 'inactive');

        // 대리인 정보를 meta에서 추출
        const meta = entity.meta as Record<string, unknown> | null;
        const agents = (meta?.agents as Array<{ name: string; relation: string; phone?: string }>) || [];

        const latestCase = latestCaseByEntity.get(entity.id);
        const expected = latestCase ? Math.max(finalRefundByCase.get(latestCase.id) || 0, 0) : 0;
        const paid = latestCase ? paidByCase.get(latestCase.id) || 0 : 0;
        const remaining = Math.max(expected - paid, 0);

        unifiedPeople.push({
            id: entity.id,
            member_id: entity.id,
            party_id: entity.id,
            name: entity.display_name,
            member_number: entity.member_number,
            phone: entity.phone,
            tier,
            status: isWithdrawn ? '탈퇴' : (activeRole?.role_status === 'active' ? '정상' : null),
            is_registered: isRegistered,
            unit_group: entity.unit_group,
            is_favorite: entity.is_favorite,
            tags: entity.tags || [],
            relationships: agents,
            role_types: ['member'],
            source_type: 'member',
            ui_role: getUiRoleFromTier(tier),
            settlement_status: latestCase?.case_status || null,
            settlement_expected: expected,
            settlement_paid: paid,
            settlement_remaining: remaining,
            notes: entity.memo,
            meta,
        });
    }

    const isTierMatch = (person: UnifiedPerson, targetTier: string) => {
        const tierText = normalizeText(person.tier);
        const statusText = normalizeText(person.status);

        switch (targetTier) {
            case '등기조합원':
                return person.is_registered;
            case '2차':
                return tierText === '2차';
            case '일반분양':
                return tierText === '일반분양' || tierText === '3차';
            case '지주':
                return tierText.includes('지주');
            case '지주조합원':
                return tierText === '지주조합원' || (tierText.includes('지주') && person.is_registered);
            case '대리인':
                return tierText === '대리인' || tierText === '대리';
            case '예비조합원':
                return statusText === '예비조합원' || statusText === '예비' || tierText === '예비조합원';
            case '권리증환불':
                return tierText === '권리증환불' || tierText === '비조합원권리증';
            case '관계인':
                return tierText === '관계인';
            default:
                return tierText === normalizeText(targetTier);
        }
    };

    const tierCounts: Record<string, number> = { all: unifiedPeople.length };
    for (const tier of tierOrder) tierCounts[tier] = unifiedPeople.filter((person) => isTierMatch(person, tier)).length;

    const roleCounts: Record<string, number> = {
        all: unifiedPeople.length,
        member: 0,
        landowner: 0,
        general: 0,
        investor: 0,
        party: 0,
        other: 0,
    };
    for (const person of unifiedPeople) {
        if (roleCounts[person.ui_role] !== undefined) roleCounts[person.ui_role]++;
    }

    const filteredPeople = unifiedPeople
        .filter((person) => {
            if (!query) return true;
            const target = `${person.name} ${person.member_number || ''} ${person.phone || ''}`.toLowerCase();
            return target.includes(query.toLowerCase());
        })
        .filter((person) => {
            if (!roleFilter || roleFilter === 'all') return true;
            return person.ui_role === roleFilter;
        })
        .filter((person) => {
            if (!tierFilter || tierFilter === 'all') return true;
            return isTierMatch(person, tierFilter);
        })
        .filter((person) => {
            if (!statusFilter) return true;
            if (statusFilter === '정산대기') return person.settlement_remaining > 0;
            if (statusFilter === '지급완료') return person.settlement_expected > 0 && person.settlement_remaining <= 0;
            if (statusFilter === '연결필요') return person.source_type === 'party_only' && !person.member_id;
            if (statusFilter === '케이스누락') {
                return Boolean(person.party_id)
                    && (person.role_types.includes('member') || person.role_types.includes('certificate_holder'))
                    && !person.settlement_status;
            }
            return person.status === statusFilter;
        })
        .filter((person) => {
            if (!tagFilter) return true;
            return (person.tags || []).includes(tagFilter);
        });

    const sortedPeople = [...filteredPeople].sort((a, b) => comparePeople(a, b, sortField, sortOrder));
    const totalCount = sortedPeople.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const normalizedPage = Math.min(page, totalPages);
    const { from, to } = getRange(normalizedPage, pageSize);
    const members = sortedPeople.slice(from, to + 1);

    const startRange = totalCount > 0 ? from + 1 : 0;
    const endRange = totalCount > 0 ? Math.min(to + 1, totalCount) : 0;

    const totalExpectedRefund = unifiedPeople.reduce((sum, person) => sum + person.settlement_expected, 0);
    const totalPaidRefund = unifiedPeople.reduce((sum, person) => sum + person.settlement_paid, 0);
    const totalRemainingRefund = unifiedPeople.reduce((sum, person) => sum + person.settlement_remaining, 0);
    const registeredCount = unifiedPeople.filter((person) => person.is_registered).length;
    const certificateHolderCount = unifiedPeople.filter((person) => person.role_types.includes('certificate_holder')).length;
    const relatedPartyCount = unifiedPeople.filter((person) => person.role_types.includes('related_party')).length;
    const settlementPendingCount = unifiedPeople.filter((person) => person.settlement_remaining > 0).length;
    const unlinkedPeopleCount = unifiedPeople.filter((person) => person.source_type === 'party_only' && !person.member_id).length;
    const settlementTargetNoCaseCount = unifiedPeople.filter(
        (person) =>
            Boolean(person.party_id) &&
            (person.role_types.includes('member') || person.role_types.includes('certificate_holder')) &&
            !person.settlement_status,
    ).length;
    const finalRefundMissingCount = unifiedPeople.filter(
        (person) => Boolean(person.settlement_status) && person.settlement_expected <= 0,
    ).length;
    const paidStatusMismatchCount = unifiedPeople.filter(
        (person) => person.settlement_status === 'paid' && person.settlement_remaining > 0,
    ).length;
    const shouldBePaidCount = unifiedPeople.filter(
        (person) =>
            Boolean(person.settlement_status) &&
            person.settlement_status !== 'paid' &&
            person.settlement_status !== 'rejected' &&
            person.settlement_expected > 0 &&
            person.settlement_remaining <= 0,
    ).length;

    const qualityIssuePersonIds = new Set<string>();
    for (const person of unifiedPeople) {
        if (person.source_type === 'party_only' && !person.member_id) qualityIssuePersonIds.add(person.id);
        if (
            person.party_id &&
            (person.role_types.includes('member') || person.role_types.includes('certificate_holder')) &&
            !person.settlement_status
        ) {
            qualityIssuePersonIds.add(person.id);
        }
        if (person.settlement_status && person.settlement_expected <= 0) qualityIssuePersonIds.add(person.id);
        if (person.settlement_status === 'paid' && person.settlement_remaining > 0) qualityIssuePersonIds.add(person.id);
        if (
            person.settlement_status &&
            person.settlement_status !== 'paid' &&
            person.settlement_status !== 'rejected' &&
            person.settlement_expected > 0 &&
            person.settlement_remaining <= 0
        ) {
            qualityIssuePersonIds.add(person.id);
        }
    }
    const qualityIssueCount = qualityIssuePersonIds.size;

    const exceptionItems: ExceptionQueueItem[] = [
        { label: '미확정 분류', count: suspenseCount, tone: 'warn' },
        { label: '증빙 확인 대기', count: pendingDocumentCount, tone: 'info' },
        {
            label: '연결 필요 인물',
            count: unifiedPeople.filter((person) => person.source_type === 'party_only' && person.settlement_expected === 0).length,
            tone: 'danger',
        },
    ];

    const topRemaining = [...unifiedPeople]
        .filter((person) => person.settlement_remaining > 0)
        .sort((a, b) => b.settlement_remaining - a.settlement_remaining)
        .slice(0, 5);

    const getPageLink = (targetPage: number) => {
        const search = new URLSearchParams();
        if (query) search.set('q', query);
        if (sortField) search.set('sort', sortField);
        if (sortOrder) search.set('order', sortOrder);
        if (roleFilter && roleFilter !== 'all') search.set('role', roleFilter);
        if (tierFilter && tierFilter !== 'all') search.set('tier', tierFilter);
        if (statusFilter) search.set('status', statusFilter);
        if (tagFilter) search.set('tag', tagFilter);
        search.set('page', String(targetPage));
        return `/members?${search.toString()}`;
    };

    const renderPageNumbers = () => {
        const pages: React.ReactNode[] = [];
        const maxVisible = 5;
        let startPage = Math.max(1, normalizedPage - Math.floor(maxVisible / 2));
        const endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage + 1 < maxVisible) startPage = Math.max(1, endPage - maxVisible + 1);

        for (let currentPage = startPage; currentPage <= endPage; currentPage++) {
            pages.push(
                <Link
                    key={currentPage}
                    href={getPageLink(currentPage)}
                    className={`size-8 flex items-center justify-center rounded border transition-all text-sm font-bold ${currentPage === normalizedPage
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                        : 'border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20'
                        }`}
                >
                    {currentPage}
                </Link>,
            );
        }
        return pages;
    };

    return (
        <div className="flex-1 flex flex-col bg-background">
            <Header
                title="조합원 관리"
                iconName="person"
                leftContent={(
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <MaterialIcon name="groups" size="md" className="text-muted-foreground mr-[-2px]" />
                        <span className="text-[19px] font-bold text-foreground">전체 인물 {unifiedPeople.length.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">· 조회 <span className="text-primary">{totalCount.toLocaleString()}</span></span>
                    </div>
                )}
            />

            <div className="flex flex-col shrink-0 gap-2 px-3 lg:px-6 pt-0.5 lg:pt-4 pb-0 max-w-[1600px] mx-auto w-full">
                <MembersKpiStrip
                    items={[
                        { label: '등기 조합원', value: `${registeredCount.toLocaleString()}명`, icon: 'badge', tone: 'default', hint: 'is_registered=true' },
                        { label: '권리증 보유', value: `${certificateHolderCount.toLocaleString()}명`, icon: 'folder', tone: 'default', hint: 'member + 비조합원 포함' },
                        { label: '관계인', value: `${relatedPartyCount.toLocaleString()}명`, icon: 'groups_2', tone: 'default', hint: 'party_roles.related_party' },
                        { label: '환불 예정', value: formatAmount(totalExpectedRefund), icon: 'account_balance_wallet', tone: 'warn', hint: `${settlementPendingCount.toLocaleString()}건 진행중` },
                        { label: '지급 완료', value: formatAmount(totalPaidRefund), icon: 'paid', tone: 'positive', hint: 'refund_payments.paid' },
                        { label: '잔여 환불', value: formatAmount(totalRemainingRefund), icon: 'receipt_long', tone: totalRemainingRefund > 0 ? 'danger' : 'positive', hint: '예정 - 지급' },
                    ]}
                />

                <section className="rounded-xl border border-white/[0.08] bg-[#101725] px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <MaterialIcon name="verified_user" size="sm" className="text-sky-300" />
                            <p className="text-sm font-extrabold text-foreground">데이터 품질 경고</p>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${qualityIssueCount > 0 ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                                {qualityIssueCount > 0 ? `이슈 인물 ${qualityIssueCount.toLocaleString()}명` : '이슈 없음'}
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
                        <QualityBadge label="회원 미연결" count={unlinkedPeopleCount} tone={unlinkedPeopleCount > 0 ? 'warn' : 'ok'} href="/members?status=%EC%97%B0%EA%B2%B0%ED%95%84%EC%9A%94" />
                        <QualityBadge label="정산 케이스 누락" count={settlementTargetNoCaseCount} tone={settlementTargetNoCaseCount > 0 ? 'warn' : 'ok'} href="/members?status=%EC%BC%80%EC%9D%B4%EC%8A%A4%EB%88%84%EB%9D%BD" />
                        <QualityBadge label="최종환불선 미설정" count={finalRefundMissingCount} tone={finalRefundMissingCount > 0 ? 'warn' : 'ok'} href="/settlements?diag=no_final_refund" />
                        <QualityBadge label="상태 불일치" count={paidStatusMismatchCount + shouldBePaidCount} tone={paidStatusMismatchCount + shouldBePaidCount > 0 ? 'danger' : 'ok'} href="/settlements?diag=status_mismatch" />
                    </div>
                </section>

                <MembersFilter
                    roleCounts={roleCounts}
                    tierCounts={tierCounts}
                    absoluteTotalCount={unifiedPeople.length}
                    filteredCount={totalCount}
                />
            </div>

            <div className="flex flex-col lg:rounded-xl lg:border lg:border-white/[0.08] lg:bg-card lg:shadow-sm lg:mx-6 mb-4 lg:mb-6">
                <div className="p-2 lg:p-3">
                    <div className="flex gap-3">
                        <div className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-[#0f1725] overflow-hidden max-h-[68vh]">
                            {members.length > 0 ? (
                                <MembersTable
                                    members={members}
                                    tableKey={JSON.stringify(params)}
                                    startIndex={from}
                                />
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 py-12">
                                    {fetchError ? (
                                        <div className="text-center p-4 bg-red-500/10 border border-red-500/20 rounded-lg max-w-lg text-left">
                                            <p className="text-red-500 font-bold mb-2">데이터 로딩 오류</p>
                                            <div className="text-xs text-red-300 font-mono whitespace-pre-wrap break-all bg-black/50 p-4 rounded">
                                                <div className="mb-2 text-white font-bold">Error Message:</div>
                                                {getErrorMessage(fetchError)}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <MaterialIcon name="search_off" size="xl" className="opacity-20" />
                                            <p className="font-bold">검색 결과가 없습니다.</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <aside className="hidden xl:flex xl:w-[310px] shrink-0 flex-col gap-3">
                            <div className="rounded-xl border border-white/[0.08] bg-[#101725] p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-extrabold text-foreground">운영 패널</h3>
                                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Live</span>
                                </div>
                                <div className="space-y-2.5">
                                    <div className="rounded-lg border border-[#28466c] bg-[#10233b] px-3 py-2">
                                        <p className="text-[10px] text-slate-300 uppercase tracking-wider">정산 상태</p>
                                        <p className="mt-1 text-sm font-bold text-white">{settlementPendingCount.toLocaleString()}건 진행중</p>
                                    </div>
                                    <div className="rounded-lg border border-[#3f5a32] bg-[#1a2a16] px-3 py-2">
                                        <p className="text-[10px] text-emerald-200 uppercase tracking-wider">지급 완료율</p>
                                        <p className="mt-1 text-sm font-bold text-emerald-100">
                                            {totalExpectedRefund > 0 ? `${Math.round((totalPaidRefund / totalExpectedRefund) * 100)}%` : '0%'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.08] bg-[#101725] p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-extrabold text-foreground">잔여 환불 상위</h3>
                                    <Link href="/settlements" className="text-[11px] font-bold text-sky-300 hover:text-sky-200">이동</Link>
                                </div>
                                <div className="space-y-2">
                                    {topRemaining.length > 0 ? topRemaining.map((person) => (
                                        <div key={person.id} className="rounded-lg border border-white/[0.06] bg-[#0b1220] px-3 py-2">
                                            <p className="text-xs font-bold text-white truncate">{person.name}</p>
                                            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
                                                <span>{person.tier || '미분류'}</span>
                                                <span className="font-mono">{formatAmount(person.settlement_remaining)}</span>
                                            </div>
                                            {person.settlement_status && (
                                                <p className="mt-1 text-[10px] text-slate-400">상태: {caseStatusLabelMap[person.settlement_status]}</p>
                                            )}
                                        </div>
                                    )) : (
                                        <div className="rounded-lg border border-dashed border-white/[0.08] bg-[#0b1220] px-3 py-4 text-[12px] text-slate-400">
                                            잔여 환불 데이터가 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/[0.08] bg-[#101725] p-4">
                                <h3 className="text-sm font-extrabold text-foreground mb-3">예외 처리 큐</h3>
                                <div className="space-y-2">
                                    {exceptionItems.map((item) => (
                                        <div key={item.label} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#0b1220] px-3 py-2">
                                            <p className="text-[11px] font-semibold text-slate-200">{item.label}</p>
                                            <span className={`text-[11px] font-black ${item.tone === 'danger' ? 'text-rose-300' : item.tone === 'warn' ? 'text-amber-300' : 'text-sky-300'}`}>
                                                {item.count.toLocaleString()}건
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>

                <div className="shrink-0 z-20 lg:bg-[#161B22] lg:border-t lg:border-white/[0.08] bg-transparent">
                    <div className="px-6 py-3 flex items-center justify-between">
                        <p className="text-xs text-gray-400">
                            총 <span className="font-bold text-white">{totalCount.toLocaleString()}명</span> 중 <span className="text-white">{startRange}-{endRange}</span> 표시
                        </p>
                        <div className="flex items-center gap-1">
                            <Link
                                href={getPageLink(Math.max(1, normalizedPage - 1))}
                                className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20 transition-all ${normalizedPage <= 1 ? 'pointer-events-none opacity-50' : ''}`}
                            >
                                <MaterialIcon name="chevron_left" size="sm" />
                            </Link>

                            {renderPageNumbers()}

                            <Link
                                href={getPageLink(Math.min(totalPages, normalizedPage + 1))}
                                className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20 transition-all ${normalizedPage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
                            >
                                <MaterialIcon name="chevron_right" size="sm" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-3 lg:px-6 pb-4 lg:pb-6">
                <div className="rounded-xl border border-white/[0.08] bg-[#101725] p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-extrabold text-foreground">예외 처리 큐</h3>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Action Required</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                        {exceptionItems.map((item) => (
                            <div key={`bottom-${item.label}`} className="rounded-lg border border-white/[0.06] bg-[#0b1220] px-3 py-3">
                                <p className="text-[11px] font-semibold text-slate-300">{item.label}</p>
                                <p className={`mt-1 text-lg font-black ${item.tone === 'danger' ? 'text-rose-300' : item.tone === 'warn' ? 'text-amber-300' : 'text-sky-300'}`}>
                                    {item.count.toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                    <p className="mt-3 text-[11px] text-slate-400">
                        비정상/미확정 건은 <span className="font-semibold text-slate-200">자금흐름</span>에서 일괄 재분류 후 반영됩니다.
                    </p>
                </div>
            </div>
        </div>
    );
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
