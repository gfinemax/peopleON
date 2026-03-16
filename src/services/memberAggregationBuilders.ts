import { getCertificateSearchTokens, getConfirmedCertificateNumbers } from '@/lib/certificates/rightNumbers';
import type {
    AccountEntityRecord,
    AggregatedRightRecord,
    MembershipRoleRecord,
    SettlementCaseRecord,
} from './memberAggregationData';
import {
    classifyAgentRelation,
    deriveCertificateAggregation,
    getUiRoleFromTier,
    normalizeTierLabel,
} from './memberAggregationUtils';
import type { RoleType, UnifiedPerson } from './memberAggregationTypes';

type AggregationMaps = {
    rolesByEntity: Map<string, MembershipRoleRecord[]>;
    rightsByEntity: Map<string, AggregatedRightRecord[]>;
    latestCaseByEntity: Map<string, SettlementCaseRecord>;
    finalRefundByCase: Map<string, number>;
    paidByCase: Map<string, number>;
    agentsByEntity: Map<string, { id?: string; name: string; relation: string; phone?: string }[]>;
    actsAsAgentFor: Map<string, { owner_id: string; owner_name: string; relation: string }[]>;
    realOwnerByNominee: Map<string, { id: string; name: string }>;
    nomineesByOwner: Map<string, { id: string; name: string }[]>;
};

export function buildRawUnifiedPeople(
    entities: AccountEntityRecord[],
    {
        rolesByEntity,
        rightsByEntity,
        latestCaseByEntity,
        finalRefundByCase,
        paidByCase,
        agentsByEntity,
        actsAsAgentFor,
        realOwnerByNominee,
        nomineesByOwner,
    }: AggregationMaps,
) {
    const rawUnifiedPeople: UnifiedPerson[] = [];

    for (const entity of entities) {
        const entityRoles = rolesByEntity.get(entity.id) || [];
        const isAgent = actsAsAgentFor.has(entity.id);

        let activeTiers = Array.from(
            new Set(
                entityRoles
                    .filter((role) => role.role_status === 'active')
                    .map((role) => normalizeTierLabel(role.role_code, role.is_registered))
                    .filter(Boolean),
            ),
        ) as string[];
        const isRegistered = entityRoles.some((role) => role.is_registered);
        const hasMemberRoleCode = entityRoles.some(
            (role) =>
                role.role_status === 'active' &&
                ['등기조합원', '1차'].includes(normalizeTierLabel(role.role_code, role.is_registered) || ''),
        );

        if (activeTiers.length === 0 && (isRegistered || hasMemberRoleCode)) {
            activeTiers = ['등기조합원'];
        }

        let tiers = activeTiers;
        const agentConnectionsForTier = actsAsAgentFor.get(entity.id) || [];
        const bestAgentRel = agentConnectionsForTier[0]?.relation || '';
        const derivedTier = classifyAgentRelation(bestAgentRel) ? '대리인' : '관계인';
        if (isAgent && tiers.length === 0) tiers = [derivedTier];

        const activeRole = entityRoles.find((role) => role.role_status === 'active');
        const tier = tiers[0] || null;
        const isWithdrawn = entityRoles.length > 0 && entityRoles.every((role) => role.role_status === 'inactive');
        const isLitigation = (entity.memo || '').includes('소송');

        const latestCase = latestCaseByEntity.get(entity.id);
        const expected = latestCase ? Math.max(finalRefundByCase.get(latestCase.id) || 0, 0) : 0;
        const paid = latestCase ? paidByCase.get(latestCase.id) || 0 : 0;

        const roleTypes = new Set<RoleType>();
        const inactiveRoles = new Set(entityRoles.filter((role) => role.role_status === 'inactive').map((role) => role.role_code));

        for (const role of entityRoles.filter((candidate) => candidate.role_status === 'active')) {
            const uiRole = getUiRoleFromTier(role.role_code);
            if (uiRole === 'member') roleTypes.add('member');
            if (uiRole === 'investor') roleTypes.add('certificate_holder');
            if (uiRole === 'agent') roleTypes.add('agent');
            if (uiRole === 'party') roleTypes.add('related_party');
        }

        const agentConnections = actsAsAgentFor.get(entity.id) || [];
        const hasAgentRole = agentConnections.some((agent) => classifyAgentRelation(agent.relation));
        const hasRelatedPartyRole = agentConnections.some((agent) => !classifyAgentRelation(agent.relation));

        if (isRegistered) {
            roleTypes.add('member');
        } else if (hasMemberRoleCode && !inactiveRoles.has('등기조합원') && !inactiveRoles.has('1차')) {
            roleTypes.add('member');
        }

        if (rightsByEntity.has(entity.id) && !inactiveRoles.has('권리증보유자')) {
            roleTypes.add('certificate_holder');
        }

        if (hasAgentRole && !inactiveRoles.has('대리인')) {
            roleTypes.add('agent');
        }

        if (hasRelatedPartyRole && !inactiveRoles.has('관계인')) {
            roleTypes.add('related_party');
        }

        const entityRights = rightsByEntity.get(entity.id) || [];
        const myAgents = agentsByEntity.get(entity.id) || [];
        const agentRights: AggregatedRightRecord[] = [];

        for (const agent of myAgents) {
            if (!agent.id) continue;

            const agentRoles = rolesByEntity.get(agent.id) || [];
            const hasIndependentRole = agentRoles.some(
                (role) =>
                    role.role_status === 'active' &&
                    (role.role_code.includes('조합원') || role.role_code.includes('차') || role.role_code.includes('권리증')),
            );

            if (!hasIndependentRole) {
                const inheritedRights = rightsByEntity.get(agent.id) || [];
                agentRights.push(...inheritedRights);
            }
        }

        const combinedRights = agentRights.length > 0 ? [...entityRights, ...agentRights] : entityRights;
        const { rawCount, managedCount, hasMerged, activeManagedRights, allActiveCerts, displayItems } =
            deriveCertificateAggregation(combinedRights);

        const certificateNumbers = getConfirmedCertificateNumbers(activeManagedRights);
        const certificateDisplay = displayItems.length > 0 ? displayItems.join(', ') : '-';
        const certificateSearchTokens = getCertificateSearchTokens(allActiveCerts);

        const dateLikeCertNumbers = certificateSearchTokens.filter((candidate) => {
            const value = candidate.trim();
            const dotted = value.match(/^(19[2-9]\d)[\.\-](\d{2})[\.\-](\d{2})$/);
            if (dotted) return +dotted[2] >= 1 && +dotted[2] <= 12 && +dotted[3] >= 1 && +dotted[3] <= 31;

            const compact = value.match(/^(19[2-9]\d)(\d{2})(\d{2})$/);
            if (compact) return +compact[2] >= 1 && +compact[2] <= 12 && +compact[3] >= 1 && +compact[3] <= 31;

            return false;
        });

        let derivedBirthDate = entity.birth_date;
        if (!derivedBirthDate && dateLikeCertNumbers.length > 0) {
            const candidate = dateLikeCertNumbers[0];
            const yearMatch = candidate.match(/^(\d{4})/);
            if (yearMatch && +yearMatch[1] <= 1999) {
                derivedBirthDate = candidate;
            }
        }

        const hasLiveCertData = entityRights.some((right) => right.right_type === 'certificate');
        const hasNumericCert = certificateNumbers.length > 0;
        if (roleTypes.has('certificate_holder')) {
            tiers.push(hasNumericCert ? '권리증번호있음' : '권리증번호없음');
        }

        rawUnifiedPeople.push({
            id: entity.id,
            _hasLiveCertData: hasLiveCertData,
            entity_ids: [entity.id],
            member_id: entity.id,
            party_id: entity.id,
            name: entity.display_name,
            certificate_display: certificateDisplay,
            certificate_numbers: certificateNumbers,
            certificate_search_tokens: certificateSearchTokens,
            birth_date: derivedBirthDate,
            phone: entity.phone,
            address_legal: entity.address_legal,
            tier,
            tiers,
            status:
                entity.status ||
                (isLitigation
                    ? '제명'
                    : isWithdrawn
                      ? '탈퇴'
                      : activeRole?.role_status === 'active' || hasMemberRoleCode
                        ? '정상'
                        : isAgent
                          ? '정상'
                          : '미정'),
            is_registered: isRegistered || hasMemberRoleCode,
            unit_group: entity.unit_group,
            is_favorite: entity.is_favorite,
            tags: entity.tags || [],
            relationships: agentsByEntity.get(entity.id) || [],
            role_types: Array.from(roleTypes),
            source_type: 'member',
            ui_role: roleTypes.has('member') ? 'member' : getUiRoleFromTier(tier),
            settlement_status: latestCase?.case_status || null,
            settlement_expected: expected,
            settlement_paid: paid,
            settlement_remaining: Math.max(expected - paid, 0),
            notes: entity.memo,
            meta: (entity.meta || null) as Record<string, unknown> | null,
            real_owner: realOwnerByNominee.get(entity.id) || null,
            source_certificate_row_count: rawCount,
            raw_certificate_count: rawCount,
            managed_certificate_count: managedCount,
            has_merged_certificates: hasMerged,
            nominees: nomineesByOwner.get(entity.id) || null,
            acts_as_agent_for: (actsAsAgentFor.get(entity.id) || []).map((agentFor) => {
                const ownerRoles = rolesByEntity.get(agentFor.owner_id) || [];
                const ownerRights = rightsByEntity.get(agentFor.owner_id) || [];
                const isMemberOwner = ownerRoles.some((role) =>
                    ['등기조합원', '지주조합원', '원지주', '2차', '일반분양', '3차', '예비조합원'].includes(
                        normalizeTierLabel(role.role_code, role.is_registered) || '',
                    ),
                );
                const isInvestorOwner =
                    ownerRights.length > 0 ||
                    ownerRoles.some((role) =>
                        ['권리증보유자', '비조합원권리증', '권리증환불'].includes(
                            normalizeTierLabel(role.role_code, role.is_registered) || '',
                        ),
                    );

                const ownerType = isMemberOwner ? '조합원' : isInvestorOwner ? '권리증' : '';
                return {
                    id: agentFor.owner_id,
                    name: agentFor.owner_name,
                    relation: agentFor.relation,
                    type: ownerType,
                    category: classifyAgentRelation(agentFor.relation) ? '대리인' : '관계인',
                };
            }),
        });
    }

    return rawUnifiedPeople;
}
