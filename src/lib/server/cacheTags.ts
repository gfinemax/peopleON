import { revalidateTag } from 'next/cache';

export const CACHE_TAGS = {
    unifiedMembers: 'unified-members',
    activityFeed: 'activity-feed',
    finance: 'finance',
} as const;

export function revalidateUnifiedMembersTag() {
    revalidateTag(CACHE_TAGS.unifiedMembers, 'max');
}

export function revalidateActivityFeedTag() {
    revalidateTag(CACHE_TAGS.activityFeed, 'max');
}

export function revalidateFinanceTag() {
    revalidateTag(CACHE_TAGS.finance, 'max');
}
