'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MemberDetailDialog } from '@/components/features/members/MemberDetailDialog';
import type { TabType } from '@/components/features/members/memberDetailDialogTypes';
import type {
    MemberWorkspaceColumnId,
    MemberWorkspacePresetId,
} from '@/components/features/members/memberWorkspacePresets';

interface MemberDetailPageClientProps {
    memberId: string;
    initialTab: TabType;
    initialWorkspacePreset: MemberWorkspacePresetId;
    initialWorkspaceColumns: MemberWorkspaceColumnId[];
    returnTo: string;
}

export function MemberDetailPageClient({ memberId, initialTab, initialWorkspacePreset, initialWorkspaceColumns, returnTo }: MemberDetailPageClientProps) {
    const router = useRouter();

    const handleOpenChange = useCallback((open: boolean) => {
        if (!open) router.push(returnTo);
    }, [returnTo, router]);

    const handleTabChange = useCallback((tab: TabType) => {
        const next = new URL(window.location.href);
        next.searchParams.set('tab', tab);
        if (returnTo !== '/members') next.searchParams.set('returnTo', returnTo);
        window.history.replaceState(window.history.state, '', `${next.pathname}${next.search}`);
    }, [returnTo]);

    const handleWorkspaceChange = useCallback((preset: MemberWorkspacePresetId, columns: MemberWorkspaceColumnId[]) => {
        const next = new URL(window.location.href);
        next.searchParams.delete('tab');
        next.searchParams.set('view', preset);
        if (preset === 'custom') next.searchParams.set('columns', columns.join(','));
        else next.searchParams.delete('columns');
        if (returnTo !== '/members') next.searchParams.set('returnTo', returnTo);
        window.history.replaceState(window.history.state, '', `${next.pathname}${next.search}`);
    }, [returnTo]);

    return (
        <main className="flex min-h-full flex-1 flex-col overflow-y-auto bg-[#071e32] p-0">
            <div className="w-full">
                <MemberDetailDialog
                    memberId={memberId}
                    memberIds={[memberId]}
                    open
                    onOpenChange={handleOpenChange}
                    initialTab={initialTab}
                    initialWorkspacePreset={initialWorkspacePreset}
                    initialWorkspaceColumns={initialWorkspaceColumns}
                    onActiveTabChange={handleTabChange}
                    onWorkspaceChange={handleWorkspaceChange}
                    onSaved={() => router.refresh()}
                    presentation="page"
                />
            </div>
        </main>
    );
}
