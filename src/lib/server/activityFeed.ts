import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';

import { CACHE_TAGS } from '@/lib/server/cacheTags';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatSafeDateTime } from '@/lib/utils';

export type TimelineLogType = 'CALL' | 'MEET' | 'SMS' | 'DOC' | 'REPAIR' | 'NOTE';
export type TimelineDirection = 'Inbound' | 'Outbound' | null;

type InteractionLogRow = {
    id: string;
    entity_id: string;
    type: TimelineLogType | null;
    direction: TimelineDirection;
    summary: string | null;
    staff_name: string | null;
    created_at: string;
};

const LEGACY_IMPORT_STAFF = '이전시스템기록';
const LEGACY_THRESHOLD_DATE = new Date('2026-03-10');

type AccountEntityLogTarget = {
    id: string;
    display_name: string | null;
    phone: string | null;
};

type PersonLike = {
    id: string;
    entity_ids?: string[] | null;
};

export type ActivityFeedEntry = {
    id: string;
    entityId: string;
    memberName: string;
    phone: string | null;
    type: TimelineLogType;
    direction: TimelineDirection;
    title: string;
    summary: string;
    staffName: string | null;
    createdAt: string;
    absoluteTime: string;
    relativeTime: string;
};

export type RecentActivitySummary = {
    entityId: string;
    type: TimelineLogType;
    title: string;
    summary: string;
    relativeTime: string;
    absoluteTime: string;
};

const typeLabelMap: Record<TimelineLogType, string> = {
    CALL: '전화 상담',
    MEET: '방문 상담',
    SMS: '문자 발송',
    DOC: '기록 업데이트',
    REPAIR: '수리/보수',
    NOTE: '운영 메모',
};

export const getTimelineTypeLabel = (type: TimelineLogType | null | undefined) =>
    typeLabelMap[type || 'NOTE'] || typeLabelMap.NOTE;

export const formatRelativeTime = (value: string | Date) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    const diffMs = Date.now() - date.getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) return '방금 전';
    if (diffMs < hour) return `${Math.floor(diffMs / minute)}분 전`;
    if (diffMs < day) return `${Math.floor(diffMs / hour)}시간 전`;
    if (diffMs < day * 7) return `${Math.floor(diffMs / day)}일 전`;
    return formatSafeDateTime(date);
};

const compactSummary = (summary: string, maxLength = 76) =>
    summary.length > maxLength ? `${summary.slice(0, maxLength).trimEnd()}...` : summary;

const normalizeLogType = (type: TimelineLogType | null | undefined): TimelineLogType => type || 'NOTE';
const chunk = <T,>(items: T[], size: number) => {
    const result: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        result.push(items.slice(index, index + size));
    }
    return result;
};

const cachedActivityFeedEntries = unstable_cache(
    async (limit: number): Promise<ActivityFeedEntry[]> => {
        const supabase = createAdminClient();
        return fetchActivityFeedEntries(supabase, { limit });
    },
    ['activity-feed-entries'],
    {
        tags: [CACHE_TAGS.activityFeed],
        revalidate: 120,
    },
);

const cachedRecentActivityLogs = unstable_cache(
    async (sortedEntityIds: string[]): Promise<InteractionLogRow[]> => {
        if (!sortedEntityIds.length) return [];

        const supabase = createAdminClient();
        const allLogs: InteractionLogRow[] = [];
        for (const entityIdChunk of chunk(sortedEntityIds, 80)) {
            const { data: logs, error } = await supabase
                .from('interaction_logs')
                .select('id, entity_id, type, direction, summary, staff_name, created_at')
                .in('entity_id', entityIdChunk)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Failed to load recent interactions:', error.message);
                continue;
            }

            if (logs?.length) {
                allLogs.push(...(logs as InteractionLogRow[]));
            }
        }

        allLogs.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
        return allLogs;
    },
    ['activity-recent-logs'],
    {
        tags: [CACHE_TAGS.activityFeed],
        revalidate: 120,
    },
);

export async function fetchActivityFeedEntries(
    supabase: SupabaseClient,
    options?: { limit?: number },
): Promise<ActivityFeedEntry[]> {
    const limit = options?.limit ?? 120;

    const { data: logs, error } = await supabase
        .from('interaction_logs')
        .select('id, entity_id, type, direction, summary, staff_name, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error || !logs?.length) {
        if (error) console.error('Failed to load interaction feed:', error.message);
        return [];
    }

    const entityIds = Array.from(new Set(logs.map((log) => log.entity_id).filter(Boolean)));

    let targetsById = new Map<string, AccountEntityLogTarget>();
    if (entityIds.length > 0) {
        const { data: targets } = await supabase
            .from('account_entities')
            .select('id, display_name, phone')
            .in('id', entityIds);

        targetsById = new Map((targets || []).map((target) => [target.id, target]));
    }

    return (logs as InteractionLogRow[]).map((log) => {
        const type = normalizeLogType(log.type);
        const target = targetsById.get(log.entity_id);
        const summary = (log.summary || '').trim() || '요약이 없는 활동 기록입니다.';

        return {
            id: log.id,
            entityId: log.entity_id,
            memberName: target?.display_name || '이름 미확인',
            phone: target?.phone || null,
            type,
            direction: log.direction,
            title: getTimelineTypeLabel(type),
            summary,
            staffName: log.staff_name,
            createdAt: log.created_at,
            absoluteTime: formatSafeDateTime(log.created_at),
            relativeTime: formatRelativeTime(log.created_at),
        };
    });
}

export async function fetchRecentActivitySummariesForPeople<T extends PersonLike>(
    supabase: SupabaseClient,
    people: T[],
): Promise<Map<string, RecentActivitySummary>> {
    const entityToPersonIds = new Map<string, string[]>();

    for (const person of people) {
        const entityIds = (person.entity_ids || []).filter(Boolean);
        for (const entityId of entityIds) {
            const list = entityToPersonIds.get(entityId) || [];
            list.push(person.id);
            entityToPersonIds.set(entityId, list);
        }
    }

    const entityIds = Array.from(entityToPersonIds.keys());
    if (entityIds.length === 0) return new Map();

    const sortedEntityIds = [...entityIds].sort();
    const allLogs =
        supabase === createAdminClient()
            ? await cachedRecentActivityLogs(sortedEntityIds)
            : await (async () => {
                  const logs: InteractionLogRow[] = [];
                  for (const entityIdChunk of chunk(sortedEntityIds, 80)) {
                      const { data, error } = await supabase
                          .from('interaction_logs')
                          .select('id, entity_id, type, direction, summary, staff_name, created_at')
                          .in('entity_id', entityIdChunk)
                          .order('created_at', { ascending: false });

                      if (error) {
                          console.error('Failed to load recent interactions:', error.message);
                          continue;
                      }

                      if (data?.length) {
                          logs.push(...(data as InteractionLogRow[]));
                      }
                  }

                  logs.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
                  return logs;
              })();

    if (!allLogs.length) {
        return new Map();
    }

    const recentByPersonId = new Map<string, RecentActivitySummary>();

    allLogs.sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());

    for (const log of allLogs) {
        const linkedPeople = entityToPersonIds.get(log.entity_id) || [];
        const type = normalizeLogType(log.type);
        const summary = (log.summary || '').trim();

        // Filter out legacy imported records for the summary view
        const isLegacy = log.staff_name === LEGACY_IMPORT_STAFF || new Date(log.created_at) < LEGACY_THRESHOLD_DATE;
        if (isLegacy) continue;

        for (const personId of linkedPeople) {
            if (recentByPersonId.has(personId)) continue;

            recentByPersonId.set(personId, {
                entityId: log.entity_id,
                type,
                title: getTimelineTypeLabel(type),
                summary: compactSummary(summary || '요약이 없는 활동 기록입니다.', 52),
                relativeTime: formatRelativeTime(log.created_at),
                absoluteTime: formatSafeDateTime(log.created_at),
            });
        }
    }

    return recentByPersonId;
}

export async function fetchActivityFeedEntriesSnapshot(options?: { limit?: number }) {
    const limit = options?.limit ?? 120;
    return cachedActivityFeedEntries(limit);
}

export async function fetchRecentActivitySummariesSnapshotForPeople<T extends PersonLike>(people: T[]) {
    return fetchRecentActivitySummariesForPeople(createAdminClient(), people);
}
