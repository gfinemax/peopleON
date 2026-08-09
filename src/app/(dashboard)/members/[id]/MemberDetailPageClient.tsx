'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MemberDetailDialog } from '@/components/features/members/MemberDetailDialog';
import type { TabType } from '@/components/features/members/memberDetailDialogTypes';

interface MemberDetailPageClientProps {
    memberId: string;
    initialTab: TabType;
    returnTo: string;
}

export function MemberDetailPageClient({ memberId, initialTab, returnTo }: MemberDetailPageClientProps) {
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

    return (
        <main className="flex min-h-full flex-1 flex-col overflow-y-auto bg-[#071e32] p-0">
            <div className="w-full">
                <MemberDetailDialog
                    memberId={memberId}
                    memberIds={[memberId]}
                    open
                    onOpenChange={handleOpenChange}
                    initialTab={initialTab}
                    onActiveTabChange={handleTabChange}
                    onSaved={() => router.refresh()}
                    presentation="page"
                />
            </div>
        </main>
    );
}
