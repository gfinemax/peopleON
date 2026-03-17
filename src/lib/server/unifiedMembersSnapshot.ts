import 'server-only';

import { unstable_cache } from 'next/cache';

import { CACHE_TAGS } from '@/lib/server/cacheTags';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUnifiedMembers, type UnifiedPerson } from '@/services/memberAggregation';

const loadUnifiedMembersSnapshot = unstable_cache(
    async (): Promise<UnifiedPerson[]> => {
        const supabase = createAdminClient();
        console.time('build-unified-members-snapshot');
        const { unifiedPeople, fetchError } = await getUnifiedMembers(supabase);
        console.timeEnd('build-unified-members-snapshot');

        if (fetchError) {
            const message =
                typeof fetchError === 'object' && fetchError && 'message' in fetchError
                    ? String((fetchError as { message?: unknown }).message || 'Unknown Error')
                    : 'Unknown Error';
            throw new Error(`Failed to build unified members snapshot: ${message}`);
        }

        return unifiedPeople;
    },
    ['unified-members-snapshot-v1'],
    {
        tags: [CACHE_TAGS.unifiedMembers],
        revalidate: 600,
    },
);

export async function getUnifiedMembersSnapshot() {
    try {
        return await loadUnifiedMembersSnapshot();
    } catch (error) {
        console.error('Unified members snapshot error:', error);
        return [];
    }
}
