import { type SupabaseClient } from '@supabase/supabase-js';
import {
    buildRelationshipMaps,
    fetchAggregationBaseData,
    fetchSettlementAmounts,
    groupByEntityId,
} from './memberAggregationData';
import type { UnifiedPerson } from './memberAggregationTypes';
import { buildRawUnifiedPeople } from './memberAggregationBuilders';
import { enrichInheritedCertificates, mergeUnifiedPeople } from './memberAggregationMerge';

export type { UnifiedPerson } from './memberAggregationTypes';
export { normalizePhone, normalizeText, normalizeTierLabel } from './memberAggregationUtils';

export async function getUnifiedMembers(supabase: SupabaseClient): Promise<{ unifiedPeople: UnifiedPerson[], fetchError: unknown }> {
    const {
        fetchError,
        entities,
        roles,
        rights,
        settlementCases,
        relationsList,
    } = await fetchAggregationBaseData(supabase);

    if (fetchError) {
        return { unifiedPeople: [], fetchError };
    }

    const rolesByEntity = groupByEntityId(roles);
    const rightsByEntity = groupByEntityId(rights);
    const { latestCaseByEntity, finalRefundByCase, paidByCase } = await fetchSettlementAmounts(supabase, settlementCases);
    const { agentsByEntity, actsAsAgentFor, realOwnerByNominee, nomineesByOwner } = buildRelationshipMaps(relationsList);
    const rawUnifiedPeople = buildRawUnifiedPeople(entities, {
        rolesByEntity,
        rightsByEntity,
        latestCaseByEntity,
        finalRefundByCase,
        paidByCase,
        agentsByEntity,
        actsAsAgentFor,
        realOwnerByNominee,
        nomineesByOwner,
    });
    const unifiedPeople = mergeUnifiedPeople(rawUnifiedPeople);
    enrichInheritedCertificates(unifiedPeople);

    return { unifiedPeople, fetchError };
}
