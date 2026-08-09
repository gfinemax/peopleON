import { MemberDetailPageClient } from './MemberDetailPageClient';
import type { TabType } from '@/components/features/members/memberDetailDialogTypes';

const validTabs = new Set<TabType>(['info', 'timeline', 'payment', 'admin']);

function normalizeReturnTo(value?: string) {
    if (!value || !value.startsWith('/members') || value.startsWith('//')) return '/members';
    return value;
}

export default async function MemberDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ tab?: string; returnTo?: string }>;
}) {
    const { id } = await params;
    const query = await searchParams;
    const initialTab = validTabs.has(query.tab as TabType) ? query.tab as TabType : 'info';
    const returnTo = normalizeReturnTo(query.returnTo);

    return (
        <MemberDetailPageClient
            memberId={id}
            initialTab={initialTab}
            returnTo={returnTo}
        />
    );
}
