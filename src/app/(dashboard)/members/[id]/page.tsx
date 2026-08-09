import { MemberDetailPageClient } from './MemberDetailPageClient';
import type { TabType } from '@/components/features/members/memberDetailDialogTypes';
import {
    getWorkspacePresetFromTab,
    parseWorkspaceColumns,
    type MemberWorkspacePresetId,
} from '@/components/features/members/memberWorkspacePresets';

const validTabs = new Set<TabType>(['info', 'timeline', 'payment', 'admin']);
const validWorkspacePresets = new Set<MemberWorkspacePresetId>(['consultation', 'payment', 'contract', 'compare', 'custom']);

function normalizeReturnTo(value?: string) {
    if (!value || !value.startsWith('/members') || value.startsWith('//')) return '/members';
    return value;
}

export default async function MemberDetailPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ tab?: string; view?: string; columns?: string; returnTo?: string }>;
}) {
    const { id } = await params;
    const query = await searchParams;
    const initialTab = validTabs.has(query.tab as TabType) ? query.tab as TabType : 'info';
    const initialWorkspacePreset = validWorkspacePresets.has(query.view as MemberWorkspacePresetId)
        ? query.view as MemberWorkspacePresetId
        : getWorkspacePresetFromTab(initialTab);
    const initialWorkspaceColumns = initialWorkspacePreset === 'custom' ? parseWorkspaceColumns(query.columns) : [];
    const returnTo = normalizeReturnTo(query.returnTo);

    return (
        <MemberDetailPageClient
            memberId={id}
            initialTab={initialTab}
            initialWorkspacePreset={initialWorkspacePreset}
            initialWorkspaceColumns={initialWorkspaceColumns}
            returnTo={returnTo}
        />
    );
}
