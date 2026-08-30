import { MemberDetailPageClient } from './MemberDetailPageClient';
import type { TabType } from '@/components/features/members/memberDetailDialogTypes';
import {
    normalizeMemberWorkspaceIds,
    normalizeMemberWorkspaceReturnTo,
} from '@/lib/members/memberWorkspaceRouting';

const validTabs = new Set<TabType>(['info', 'timeline', 'payment', 'admin']);

export default async function MemberDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ tab?: string; returnTo?: string; ids?: string }>;
}) {
    const { id } = await params;
    const query = await searchParams;
    const initialTab = validTabs.has(query.tab as TabType) ? query.tab as TabType : 'info';
    const returnTo = normalizeMemberWorkspaceReturnTo(query.returnTo);
    const memberIds = normalizeMemberWorkspaceIds(query.ids, id);

    return (
        <MemberDetailPageClient
            memberId={id}
            memberIds={memberIds}
            initialTab={initialTab}
            returnTo={returnTo}
        />
    );
}
