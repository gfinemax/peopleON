import { NextResponse } from 'next/server';

import { fetchRecentActivitySummariesSnapshotForPeople } from '@/lib/server/activityFeed';
import { hasValidApiKey } from '@/lib/server/apiKeyAuth';
import { authzErrorResponse, requireRole, ROLE_GROUPS } from '@/lib/server/authz';
import {
    buildMembersTablePayload,
    getMembersTablePagePeople,
    parseMembersTableQuery,
} from '@/lib/server/membersTableApi';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';
import { createAdminClient } from '@/lib/supabase/admin';

const MIN_LOG_SEARCH_QUERY_LENGTH = 2;
const LOG_SEARCH_RESULT_LIMIT = 2000;

async function findMatchedLogEntityIds(query: string) {
    if (query.length < MIN_LOG_SEARCH_QUERY_LENGTH) {
        return new Set<string>();
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('interaction_logs')
        .select('entity_id')
        .ilike('summary', `%${query}%`)
        .limit(LOG_SEARCH_RESULT_LIMIT);

    if (error) {
        console.error('Members table log search error:', error);
        return new Set<string>();
    }

    return new Set((data || []).map((row) => row.entity_id).filter(Boolean));
}

export async function GET(request: Request) {
    if (!hasValidApiKey(request.headers)) {
        try {
            await requireRole(ROLE_GROUPS.staff);
        } catch (error) {
            return authzErrorResponse(error);
        }
    }

    const url = new URL(request.url);
    const query = parseMembersTableQuery(url);

    try {
        const [unifiedPeople, matchedEntityIds] = await Promise.all([
            getUnifiedMembersSnapshot(),
            findMatchedLogEntityIds(query.query),
        ]);
        const { pageSlice } = getMembersTablePagePeople({
            unifiedPeople,
            matchedEntityIds,
            query,
        });
        const recentActivitiesByPerson = await fetchRecentActivitySummariesSnapshotForPeople(pageSlice);
        const payload = buildMembersTablePayload({
            unifiedPeople,
            matchedEntityIds,
            recentActivitiesByPerson,
            query,
        });

        return NextResponse.json(payload, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        console.error('Members table API error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : '조합원 테이블 조회에 실패했습니다.',
            },
            { status: 500 },
        );
    }
}
