import { type UnifiedPerson, normalizeText } from '@/services/memberAggregation';
import {
    getDisplayMemberStatus,
    hiddenMemberStatusValues,
    isSettlementTarget,
} from '@/lib/members/unifiedPersonUtils';

export type MembersSearchParams = {
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

export const tierOrder = [
    '등기조합원',
    '1차',
    '2차',
    '3차',
    '일반분양',
    '지주',
    '지주조합원',
    '대리인',
    '예비조합원',
    '권리증보유자',
    '관계인',
    '권리증환불',
    '권리증번호있음',
    '권리증번호없음',
];

export function normalizeTierFilter(raw?: string) {
    const value = (raw || '').trim();
    if (!value || value === 'all') return 'all';
    if (value === '1차') return '등기조합원';
    if (value === '일반') return '일반분양';
    if (value === '예비') return '예비조합원';
    if (value === '3차') return '일반분양';
    if (value === '4차') return 'all';
    return value;
}

export function getPageRange(page: number, size: number) {
    const from = (page - 1) * size;
    const to = from + size - 1;
    return { from, to };
}

export function comparePeople(a: UnifiedPerson, b: UnifiedPerson, field: string, order: 'asc' | 'desc') {
    const multiplier = order === 'asc' ? 1 : -1;
    const valueOf = (person: UnifiedPerson): string | number => {
        switch (field) {
            case 'member_number':
                return person.certificate_display || '';
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

export function isTierMatch(person: UnifiedPerson, targetTier: string) {
    const tierLabels = (person.tiers || []).map((tier) => normalizeText(tier));
    const tierText = normalizeText(person.tier);
    const statusText = normalizeText(person.status);

    switch (targetTier) {
        case '등기조합원':
            return person.is_registered || tierLabels.includes('등기조합원');
        case '2차':
            return tierLabels.includes('2차');
        case '일반분양':
            return tierLabels.includes('일반분양') || tierLabels.includes('3차');
        case '지주':
            return tierLabels.some((tier) => tier.includes('지주'));
        case '지주조합원':
            return tierLabels.includes('지주조합원') || (tierLabels.some((tier) => tier.includes('지주')) && person.is_registered);
        case '대리인':
            return tierLabels.includes('대리인') || tierLabels.includes('대리');
        case '예비조합원':
            return statusText === '예비조합원' || statusText === '예비' || tierLabels.includes('예비조합원');
        case '권리증보유자':
            return person.role_types.includes('certificate_holder');
        case '권리증환불':
            return tierLabels.includes('권리증환불');
        case '권리증번호있음':
            return tierLabels.includes('권리증번호있음');
        case '권리증번호없음':
            return tierLabels.includes('권리증번호없음');
        default:
            return tierText === normalizeText(targetTier);
    }
}

export function isRoleMatch(person: UnifiedPerson, targetRole: string) {
    if (targetRole === 'all') return true;
    if (targetRole === 'member' && person.role_types.includes('member')) return true;
    if (targetRole === 'investor' && person.role_types.includes('certificate_holder')) return true;
    if (targetRole === 'party' && person.role_types.includes('related_party')) return true;
    if (!['member', 'investor', 'party'].includes(targetRole) && person.ui_role === targetRole) return true;
    return false;
}

export function getTierCounts(peopleInCurrentRole: UnifiedPerson[]) {
    const tierCounts: Record<string, number> = { all: peopleInCurrentRole.length };
    for (const tier of tierOrder) {
        tierCounts[tier] = peopleInCurrentRole.filter((person) => isTierMatch(person, tier)).length;
    }
    return tierCounts;
}

export function getRoleCounts(unifiedPeople: UnifiedPerson[]) {
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
        if (person.role_types.includes('member')) roleCounts.member++;
        if (person.ui_role === 'landowner') roleCounts.landowner++;
        if (person.ui_role === 'general') roleCounts.general++;
        if (person.role_types.includes('certificate_holder')) roleCounts.investor++;
        if (person.role_types.includes('related_party')) roleCounts.party++;
    }

    return roleCounts;
}

export function filterMembers({
    peopleInCurrentRole,
    query,
    tierFilter,
    statusFilter,
    relFilter,
    tagFilter,
    matchedEntityIds,
}: {
    peopleInCurrentRole: UnifiedPerson[];
    query: string;
    tierFilter: string;
    statusFilter: string;
    relFilter: string;
    tagFilter: string;
    matchedEntityIds: Set<string>;
}) {
    return peopleInCurrentRole.filter((person) => {
        if (query) {
            const queryLower = query.toLowerCase();
            const certificateText = `${person.certificate_display || ''} ${(person.certificate_search_tokens || []).join(' ')}`;
            const relatedNames = [
                ...(person.relationships || []).flatMap((relationship) => [
                    relationship.name || '',
                    relationship.relation || '',
                ]),
                ...(person.acts_as_agent_for || []).flatMap((owner) => [
                    owner.name || '',
                    owner.relation || '',
                    owner.type || '',
                    owner.category || '',
                ]),
                person.real_owner?.name || '',
                ...(person.nominees || []).map((nominee) => nominee.name || ''),
            ].join(' ');
            const isTextMatch = `${person.name} ${certificateText} ${person.phone} ${person.notes || ''} ${relatedNames}`
                .toLowerCase()
                .includes(queryLower);
            const isLogMatch = Array.isArray(person.entity_ids) && person.entity_ids.some((id) => matchedEntityIds.has(id));
            if (!isTextMatch && !isLogMatch) return false;
        }
        if (tierFilter !== 'all' && !isTierMatch(person, tierFilter)) return false;
        if (statusFilter !== 'all') {
            const displayStatus = getDisplayMemberStatus(person);
            if (statusFilter === '정산대기' && (!isSettlementTarget(person) || person.settlement_remaining <= 0)) return false;
            if (statusFilter === '지급완료' && (!isSettlementTarget(person) || person.settlement_expected <= 0 || person.settlement_remaining > 0)) return false;
            if (statusFilter === '연결필요' && (person.source_type !== 'party_only' || person.member_id)) return false;
            if (statusFilter === '케이스누락' && (!isSettlementTarget(person) || !person.party_id || person.settlement_status)) return false;
            if (!['정산대기', '지급완료', '연결필요', '케이스누락'].includes(statusFilter) && displayStatus !== statusFilter) return false;
        }
        if (tagFilter && !(person.tags || []).includes(tagFilter)) return false;
        if (relFilter !== 'all' && !(person.relationships || []).some((relationship) => relationship.relation === relFilter)) return false;
        return true;
    });
}

export function getRelationFilterData(unifiedPeople: UnifiedPerson[]) {
    const allRelations = unifiedPeople.flatMap((person) => person.relationships || []).map((relationship) => relationship.relation);
    const relationNames = Array.from(new Set(allRelations.filter(Boolean) as string[])).sort();
    const relCounts: Record<string, number> = { all: unifiedPeople.length };

    for (const relationName of relationNames) {
        relCounts[relationName] = unifiedPeople.filter((person) => (
            person.relationships || []
        ).some((relationship) => relationship.relation === relationName)).length;
    }

    return { relationNames, relCounts };
}

export function getStatusCounts(unifiedPeople: UnifiedPerson[]) {
    const statusCounts: Record<string, number> = {};

    for (const person of unifiedPeople) {
        const status = getDisplayMemberStatus(person);
        const settlementEligible = isSettlementTarget(person);

        if (settlementEligible && person.settlement_remaining > 0) {
            statusCounts['정산대기'] = (statusCounts['정산대기'] || 0) + 1;
        }
        if (settlementEligible && person.settlement_expected > 0 && person.settlement_remaining <= 0) {
            statusCounts['지급완료'] = (statusCounts['지급완료'] || 0) + 1;
        }
        if (person.source_type === 'party_only' && !person.member_id) {
            statusCounts['연결필요'] = (statusCounts['연결필요'] || 0) + 1;
        }
        if (settlementEligible && person.party_id && !person.settlement_status) {
            statusCounts['케이스누락'] = (statusCounts['케이스누락'] || 0) + 1;
        }

        if (!hiddenMemberStatusValues.has(status)) {
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        }
    }

    return statusCounts;
}

export function buildMembersPageLink({
    query,
    sortField,
    sortOrder,
    roleFilter,
    tierFilter,
    statusFilter,
    relFilter,
    tagFilter,
    targetPage,
}: {
    query: string;
    sortField: string;
    sortOrder: 'asc' | 'desc';
    roleFilter: string;
    tierFilter: string;
    statusFilter: string;
    relFilter: string;
    tagFilter: string;
    targetPage: number;
}) {
    const searchParams = new URLSearchParams();
    if (query) searchParams.set('q', query);
    if (sortField) searchParams.set('sort', sortField);
    if (sortOrder) searchParams.set('order', sortOrder);
    if (roleFilter !== 'all') searchParams.set('role', roleFilter);
    if (tierFilter !== 'all') searchParams.set('tier', tierFilter);
    if (statusFilter !== 'all') searchParams.set('status', statusFilter);
    if (relFilter !== 'all') searchParams.set('rel', relFilter);
    if (tagFilter) searchParams.set('tag', tagFilter);
    searchParams.set('page', String(targetPage));
    return `/members?${searchParams.toString()}`;
}
