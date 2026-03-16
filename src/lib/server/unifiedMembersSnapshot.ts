import 'server-only';

import { unstable_cache } from 'next/cache';

import { CACHE_TAGS } from '@/lib/server/cacheTags';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUnifiedMembers, type UnifiedPerson } from '@/services/memberAggregation';

const loadUnifiedMembersSnapshot = unstable_cache(
    async (): Promise<UnifiedPerson[]> => {
        const supabase = createAdminClient();
        const { unifiedPeople, fetchError } = await getUnifiedMembers(supabase);

        if (fetchError) {
            const message =
                typeof fetchError === 'object' && fetchError && 'message' in fetchError
                    ? String((fetchError as { message?: unknown }).message || 'Unknown Error')
                    : 'Unknown Error';
            throw new Error(`Failed to build unified members snapshot: ${message}`);
        }

        return unifiedPeople;
    },
    ['unified-members-snapshot'],
    {
        tags: [CACHE_TAGS.unifiedMembers],
        revalidate: 300,
    },
);

export async function getUnifiedMembersSnapshot() {
    return loadUnifiedMembersSnapshot();
}
