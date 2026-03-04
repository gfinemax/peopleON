import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import Link from 'next/link';
import { MembersTable } from '@/components/features/members/MembersTable';
import { MembersFilter } from '@/components/features/members/MembersFilter';
import { MembersKpiStrip } from '@/components/features/members/MembersKpiStrip';
import { DashboardManager } from '@/components/features/members/DashboardManager';
import { MemberActions } from '@/components/features/members/MemberActions';
import { LinkedOperationPanel } from '@/components/features/members/OperationPanel';
import React from 'react';
import { getUnifiedMembers, UnifiedPerson, normalizeText } from '@/services/memberAggregation';

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
    rel?: string;
};

type RoleType = 'member' | 'certificate_holder' | 'related_party' | 'refund_applicant' | 'agent';

type AccountEntityRow = {
    id: string;
    entity_type: string;
    display_name: string;
    phone: string | null;
    member_number: string | null;
    address_legal: string | null;
    unit_group: string | null;
    memo: string | null;
    status: string | null;
    is_favorite: boolean;
    tags: string[] | null;
    email: string | null;
    meta: Record<string, unknown> | null;
    birth_date: string | null;
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



const tierOrder = ['등기조합원', '1차', '2차', '3차', '일반분양', '지주', '지주조합원', '대리인', '예비조합원', '권리증보유자', '관계인', '권리증환불', '권리증번호있음', '권리증번호없음'];

const normalizeTierFilter = (raw?: string) => {
    const value = (raw || '').trim();
    if (!value || value === 'all') return 'all';
    if (value === '1차') return '등기조합원';
    if (value === '일반') return '일반분양';
    if (value === '예비') return '예비조합원';
    if (value === '3차') return '일반분양';
    if (value === '4차') return 'all';
    return value;
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

const sanitizeNumber = (val: string | null | undefined) => {
    if (!val) return null;
    const v = val.trim();
    if (v.startsWith('19')) return null;
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(v)) return null;
    return v;
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
    const sortOrder = (params.order as 'asc' | 'desc') || 'asc';
    const page = Math.max(1, Number(params.page) || 1);
    const roleFilter = params.role || 'all';
    const tierFilter = normalizeTierFilter(params.tier);
    const statusFilter = params.status || 'all';
    const relFilter = params.rel || 'all';
    const tagFilter = params.tag?.trim() || '';
    const pageSize = 50;

    const supabase = await createClient();


    const { unifiedPeople, fetchError: fetchErr } = await getUnifiedMembers(supabase);
    let fetchError: unknown = fetchErr;

    // --- Search History Integration ---
    const matchedEntityIds = new Set<string>();
    if (query) {
        const { data, error } = await supabase
            .from('interaction_logs')
            .select('entity_id')
            .ilike('summary', `%${query}%`);

        if (error) console.error("Search history error:", error);
        if (data) data.forEach(log => matchedEntityIds.add(log.entity_id));
    }
    // -----------------------------------

    const isTierMatch = (person: UnifiedPerson, targetTier: string) => {
        const tierLabels = (person.tiers || []).map(t => normalizeText(t));
        const tierText = normalizeText(person.tier);
        const statusText = normalizeText(person.status);

        switch (targetTier) {
            case '등기조합원': return person.is_registered || tierLabels.includes('등기조합원');
            case '2차': return tierLabels.includes('2차');
            case '일반분양': return tierLabels.includes('일반분양') || tierLabels.includes('3차');
            case '지주': return tierLabels.some(t => t.includes('지주'));
            case '지주조합원': return tierLabels.includes('지주조합원') || (tierLabels.some(t => t.includes('지주')) && person.is_registered);
            case '대리인': return tierLabels.includes('대리인') || tierLabels.includes('대리');
            case '예비조합원': return statusText === '예비조합원' || statusText === '예비' || tierLabels.includes('예비조합원');
            case '권리증보유자': return person.role_types.includes('certificate_holder');
            case '권리증환불': return tierLabels.includes('권리증환불');
            case '권리증번호있음': return tierLabels.includes('권리증번호있음');
            case '권리증번호없음': return tierLabels.includes('권리증번호없음');
            default: return tierText === normalizeText(targetTier);
        }
    };

    const isRoleMatch = (person: UnifiedPerson, targetRole: string) => {
        if (targetRole === 'all') return true;
        if (targetRole === 'member' && person.role_types.includes('member')) return true;
        if (targetRole === 'investor' && person.role_types.includes('certificate_holder')) return true;
        if (targetRole === 'party' && person.role_types.includes('related_party')) return true;
        if (!['member', 'investor', 'party'].includes(targetRole) && person.ui_role === targetRole) return true;
        return false;
    };

    const peopleInCurrentRole = unifiedPeople.filter(p => isRoleMatch(p, roleFilter));

    const tierCounts: Record<string, number> = { all: peopleInCurrentRole.length };
    for (const tier of tierOrder) tierCounts[tier] = peopleInCurrentRole.filter((p) => isTierMatch(p, tier)).length;

    const roleCounts: Record<string, number> = { all: unifiedPeople.length, member: 0, landowner: 0, general: 0, investor: 0, party: 0, other: 0 };
    for (const p of unifiedPeople) {
        if (p.role_types.includes('member')) roleCounts.member++;
        if (p.ui_role === 'landowner') roleCounts.landowner++;
        if (p.ui_role === 'general') roleCounts.general++;
        if (p.role_types.includes('certificate_holder')) roleCounts.investor++;
        if (p.role_types.includes('related_party')) roleCounts.party++;
    }

    const filteredPeople = peopleInCurrentRole.filter(p => {
        if (query) {
            const queryLower = query.toLowerCase();
            const isTextMatch = `${p.name} ${p.member_number} ${p.phone} ${p.notes || ''}`
                .toLowerCase()
                .includes(queryLower);
            const isLogMatch = Array.isArray(p.entity_ids) && p.entity_ids.some(id => matchedEntityIds.has(id));
            if (!isTextMatch && !isLogMatch) return false;
        }
        if (tierFilter !== 'all' && !isTierMatch(p, tierFilter)) return false;
        if (statusFilter !== 'all') {
            if (statusFilter === '정산대기' && p.settlement_remaining <= 0) return false;
            if (statusFilter === '지급완료' && (p.settlement_expected <= 0 || p.settlement_remaining > 0)) return false;
            if (statusFilter === '연결필요' && (p.source_type !== 'party_only' || p.member_id)) return false;
            if (statusFilter === '케이스누락' && (!p.party_id || !p.role_types.some(rt => rt === 'member' || rt === 'certificate_holder') || p.settlement_status)) return false;
            if (!['정산대기', '지급완료', '연결필요', '케이스누락'].includes(statusFilter) && p.status !== statusFilter) return false;
        }
        if (tagFilter && !(p.tags || []).includes(tagFilter)) return false;
        if (relFilter !== 'all' && !(p.relationships || []).some(r => r.relation === relFilter)) return false;
        return true;
    });

    const sortedPeople = [...filteredPeople].sort((a, b) => comparePeople(a, b, sortField, sortOrder));
    const totalCount = sortedPeople.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const normalizedPage = Math.min(page, totalPages);
    const { from, to } = getRange(normalizedPage, pageSize);
    const displayedMembers = sortedPeople.slice(from, to + 1).map(p => ({
        ...p,
        _matchedLog: !!(query && Array.isArray(p.entity_ids) && p.entity_ids.some(id => matchedEntityIds.has(id)))
    }));

    const allRelations = unifiedPeople.flatMap(p => p.relationships || []).map(r => r.relation);
    const relationNames = Array.from(new Set(allRelations.filter(Boolean) as string[])).sort();
    const relCounts: Record<string, number> = { all: unifiedPeople.length };
    for (const relName of relationNames) relCounts[relName] = unifiedPeople.filter(p => (p.relationships || []).some(r => r.relation === relName)).length;

    const totalExpectedRefund = unifiedPeople.reduce((sum, p) => sum + p.settlement_expected, 0);
    const totalPaidRefund = unifiedPeople.reduce((sum, p) => sum + p.settlement_paid, 0);
    const totalRemainingRefund = unifiedPeople.reduce((sum, p) => sum + p.settlement_remaining, 0);
    const registeredCount = unifiedPeople.filter(p => p.is_registered).length;
    const certificateHolderCount = unifiedPeople.filter(p => p.role_types.includes('certificate_holder')).length;
    const relatedPartyCount = unifiedPeople.filter(p => p.role_types.includes('related_party')).length;

    const statusCounts: Record<string, number> = {};
    for (const p of unifiedPeople) {
        let s = p.status || '기타';
        // Special calculated statuses
        if (p.settlement_remaining > 0) {
            statusCounts['정산대기'] = (statusCounts['정산대기'] || 0) + 1;
        }
        if (p.settlement_expected > 0 && p.settlement_remaining <= 0) {
            statusCounts['지급완료'] = (statusCounts['지급완료'] || 0) + 1;
        }
        if (p.source_type === 'party_only' && !p.member_id) {
            statusCounts['연결필요'] = (statusCounts['연결필요'] || 0) + 1;
        }
        if (p.party_id && (p.role_types.some(rt => rt === 'member' || rt === 'certificate_holder')) && !p.settlement_status) {
            statusCounts['케이스누락'] = (statusCounts['케이스누락'] || 0) + 1;
        }

        statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    const qualityIssueCount = unifiedPeople.filter(p =>
        (p.source_type === 'party_only' && !p.member_id) ||
        (p.party_id && (p.role_types.includes('member') || p.role_types.includes('certificate_holder')) && !p.settlement_status) ||
        (p.settlement_status === 'paid' && p.settlement_remaining > 0)
    ).length;

    const exceptionItems: ExceptionQueueItem[] = [
        { label: '미확정 분류', count: 0, tone: 'warn' },
        { label: '증빙 확인 대기', count: 0, tone: 'info' },
        { label: '연결 필요 인물', count: unifiedPeople.filter(p => p.source_type === 'party_only' && !p.member_id).length, tone: 'danger' },
    ];

    const topRemaining = [...unifiedPeople].filter(p => p.settlement_remaining > 0).sort((a, b) => b.settlement_remaining - a.settlement_remaining).slice(0, 5);

    const getPageLink = (targetPage: number) => {
        const s = new URLSearchParams();
        if (query) s.set('q', query);
        if (sortField) s.set('sort', sortField);
        if (sortOrder) s.set('order', sortOrder);
        if (roleFilter !== 'all') s.set('role', roleFilter);
        if (tierFilter !== 'all') s.set('tier', tierFilter);
        if (statusFilter !== 'all') s.set('status', statusFilter);
        if (tagFilter) s.set('tag', tagFilter);
        s.set('page', String(targetPage));
        return `/members?${s.toString()}`;
    };

    // Assuming MemberDetailDialog is imported and used here,
    // and `selectedMemberId` and `isDetailOpen` are managed by state in a parent component or within this page.
    // For the purpose of this edit, we'll assume a placeholder for these state variables.
    // const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
    // const [isDetailOpen, setIsDetailOpen] = React.useState(false);
    // const selectedMember = displayedMembers.find(m => m.id === selectedMemberId);

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
                rightContent={<MemberActions data={unifiedPeople} />}
            />

            <DashboardManager
                kpiSection={(
                    <MembersKpiStrip
                        items={[
                            { label: '등기 조합원', value: `${registeredCount.toLocaleString()}명`, icon: 'badge', tone: 'default', hint: 'is_registered=true' },
                            { label: '권리증 보유', value: `${certificateHolderCount.toLocaleString()}명`, icon: 'folder', tone: 'default', hint: '중복 병합 완료' },
                            { label: '관계인', value: `${relatedPartyCount.toLocaleString()}명`, icon: 'groups_2', tone: 'default', hint: '대리인 포함' },
                            { label: '환불 예정', value: formatAmount(totalExpectedRefund), icon: 'account_balance_wallet', tone: 'warn', hint: '세입자 제외' },
                            { label: '지급 완료', value: formatAmount(totalPaidRefund), icon: 'paid', tone: 'positive', hint: '누적 현황' },
                            { label: '잔여 환불', value: formatAmount(totalRemainingRefund), icon: 'receipt_long', tone: totalRemainingRefund > 0 ? 'danger' : 'positive', hint: '예정 - 지급' },
                        ]}
                    />
                )}
                qualitySection={(
                    <section className="rounded-xl border border-white/[0.08] bg-[#101725] px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <MaterialIcon name="verified_user" size="sm" className="text-sky-300" />
                                <p className="text-sm font-extrabold text-foreground">데이터 품질 경고</p>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${qualityIssueCount > 0 ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                                    {qualityIssueCount > 0 ? `이슈 인물 ${qualityIssueCount.toLocaleString()}명` : '이슈 없음'}
                                </span>
                            </div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                            <QualityBadge label="회원 미연결" count={unifiedPeople.filter(p => p.source_type === 'party_only' && !p.member_id).length} tone="warn" href="/members?status=연결필요" />
                            <QualityBadge label="케이스 누락" count={unifiedPeople.filter(p => p.party_id && (p.role_types.includes('member') || p.role_types.includes('certificate_holder')) && !p.settlement_status).length} tone="warn" href="/members?status=케이스누락" />
                        </div>
                    </section>
                )}
                filterData={{
                    roleCounts,
                    tierCounts,
                    statusCounts,
                    relCounts,
                    relationNames,
                    absoluteTotalCount: unifiedPeople.length,
                    filteredCount: totalCount,
                }}
            >
                <div className="flex flex-col lg:rounded-xl lg:border lg:border-white/[0.08] lg:bg-card lg:shadow-sm mb-4 lg:mb-6">
                    <div className="p-2 lg:p-3">
                        <div className="flex gap-3">
                            <div className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-[#0f1725] overflow-hidden max-h-[68vh]">
                                {displayedMembers.length > 0 ? (
                                    <MembersTable
                                        members={displayedMembers}
                                        tableKey={JSON.stringify(params)}
                                        startIndex={from}
                                    />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 py-12">
                                        <MaterialIcon name="search_off" size="xl" className="opacity-20" />
                                        <p className="font-bold">검색 결과가 없습니다.</p>
                                    </div>
                                )}
                            </div>

                            <LinkedOperationPanel
                                totalRemainingRefund={totalRemainingRefund}
                                totalExpectedRefund={totalExpectedRefund}
                                totalPaidRefund={totalPaidRefund}
                                topRemaining={topRemaining}
                            />
                        </div>
                    </div>

                    <div className="shrink-0 z-20 lg:bg-[#161B22] lg:border-t lg:border-white/[0.08] bg-transparent">
                        <div className="px-6 py-3 flex items-center justify-between">
                            <p className="text-xs text-gray-400">
                                총 <span className="font-bold text-white">{totalCount.toLocaleString()}명</span> 중 <span className="text-white">{Math.min(from + 1, totalCount)}-{Math.min(to + 1, totalCount)}</span> 표시
                            </p>
                            <div className="flex items-center gap-1">
                                <Link href={getPageLink(Math.max(1, normalizedPage - 1))} className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 ${normalizedPage <= 1 ? 'pointer-events-none opacity-50' : ''}`}>
                                    <MaterialIcon name="chevron_left" size="sm" />
                                </Link>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const p = Math.max(1, Math.min(totalPages - 4, normalizedPage - 2)) + i;
                                    if (p < 1 || p > totalPages) return null;
                                    return (
                                        <Link key={p} href={getPageLink(p)} className={`size-7 flex items-center justify-center rounded border text-xs font-bold ${p === normalizedPage ? 'border-primary bg-primary/10 text-primary' : 'border-white/[0.08] bg-[#161B22] text-gray-400'}`}>
                                            {p}
                                        </Link>
                                    );
                                })}
                                <Link href={getPageLink(Math.min(totalPages, normalizedPage + 1))} className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 ${normalizedPage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}>
                                    <MaterialIcon name="chevron_right" size="sm" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardManager>
        </div>
    );
}

function QualityBadge({ label, count, tone, href }: { label: string; count: number; tone: 'ok' | 'warn' | 'danger'; href?: string }) {
    const toneClass = tone === 'ok' ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200' : tone === 'danger' ? 'border-rose-400/20 bg-rose-500/10 text-rose-200' : 'border-amber-400/20 bg-amber-500/10 text-amber-200';
    const badgeClass = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`;
    if (!href) return <div className={badgeClass}><span>{label}</span><span className="font-black">{count.toLocaleString()}건</span></div>;
    return <Link href={href} className={badgeClass}><span>{label}</span><span className="font-black">{count.toLocaleString()}건</span><MaterialIcon name="open_in_new" size="xs" /></Link>;
}
