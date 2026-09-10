import 'server-only';

import { unstable_cache } from 'next/cache';
import { decodeSnapshot, encodeSnapshot } from './snapshotCodec';
import { singleFlight } from './singleFlight';

import { CACHE_TAGS } from '@/lib/server/cacheTags';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUnifiedMembers, getUnifiedMembersLite, type UnifiedPerson } from '@/services/memberAggregation';

const loadUnifiedMembersSnapshot = unstable_cache(
    async (): Promise<string> => {
        const supabase = createAdminClient();
        console.time('build-unified-members-snapshot');
        try {
            const { unifiedPeople, fetchError } = await getUnifiedMembers(supabase);

            if (fetchError) {
                const message =
                    typeof fetchError === 'object' && fetchError && 'message' in fetchError
                        ? String((fetchError as { message?: unknown }).message || 'Unknown Error')
                        : 'Unknown Error';
                throw new Error(`Failed to build unified members snapshot: ${message}`);
            }

            return encodeSnapshot(unifiedPeople);
        } finally {
            console.timeEnd('build-unified-members-snapshot');
        }
    },
    ['unified-members-snapshot-v7-unreported-members'],
    {
        tags: [CACHE_TAGS.unifiedMembers],
        revalidate: 600,
    },
);

const loadUnifiedMembersLiteSnapshot = unstable_cache(
    async (): Promise<string> => {
        const supabase = createAdminClient();
        console.time('build-unified-members-lite-snapshot');
        try {
            const { unifiedPeople, fetchError } = await getUnifiedMembersLite(supabase);

            if (fetchError) {
                const message =
                    typeof fetchError === 'object' && fetchError && 'message' in fetchError
                        ? String((fetchError as { message?: unknown }).message || 'Unknown Error')
                        : 'Unknown Error';
                throw new Error(`Failed to build unified members lite snapshot: ${message}`);
            }

            return encodeSnapshot(unifiedPeople);
        } finally {
            console.timeEnd('build-unified-members-lite-snapshot');
        }
    },
    ['unified-members-lite-snapshot-v7-unreported-members'],
    {
        tags: [CACHE_TAGS.unifiedMembers],
        revalidate: 600,
    },
);

const readUnifiedSnapshot = singleFlight(loadUnifiedMembersSnapshot);
const readLiteSnapshot = singleFlight(loadUnifiedMembersLiteSnapshot);

export async function getUnifiedMembersSnapshot() {
    try {
        return decodeSnapshot<UnifiedPerson[]>(await readUnifiedSnapshot());
    } catch (error) {
        console.error('Unified members snapshot error:', error);
        throw error;
    }
}

// Use only for identity/contact workflows. Certificate, settlement, and relationship-derived fields are intentionally light.
export async function getUnifiedMembersLiteSnapshot() {
    try {
        return decodeSnapshot<UnifiedPerson[]>(await readLiteSnapshot());
    } catch (error) {
        console.error('Unified members lite snapshot error:', error);
        throw error;
    }
}
