'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MemberQuickPreview } from './MemberQuickPreview';
import { MembersTableSections } from './MembersTableSections';
import {
    type DetailTab,
    type MembersTableMember as Member,
} from './membersTableUtils';
import { toggleFavoriteMember } from '@/app/actions/members';

interface MembersTableProps {
    members: Member[];
    tableKey: string;
    startIndex: number;
}

export function MembersTable({ members, tableKey, startIndex }: MembersTableProps) {
    const router = useRouter();
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const tableMembers = members;

    const handleInlineUpdate = async (id: string, field: 'tier' | 'status' | 'role', value: unknown, entityIds?: string[]) => {
        const res = await fetch('/api/members/inline-update', {
            method: 'POST',
            body: JSON.stringify({ id, field, value, entity_ids: entityIds }),
            headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Failed to update');
        }

        router.refresh();
    };

    const openMemberDetail = (memberId: string, initialTab: DetailTab = 'info') => {
        const returnTo = `${window.location.pathname}${window.location.search}`;
        if (initialTab !== 'info') {
            router.push(`/members/${memberId}?tab=${initialTab}&returnTo=${encodeURIComponent(returnTo)}`);
            return;
        }
        setSelectedMemberId(memberId);
        setDialogOpen(true);
    };

    const handleRowClick = (member: Member) => {
        if (!member.member_id) return;
        const returnTo = `${window.location.pathname}${window.location.search}`;
        const tab = member._matchedLog ? 'timeline' : 'info';
        router.push(`/members/${member.member_id}?tab=${tab}&returnTo=${encodeURIComponent(returnTo)}`);
    };

    const handleToggleFavorite = async (member: Member) => {
        if (!member.member_id) return;

        const success = await toggleFavoriteMember(member.member_id, !member.is_favorite);
        if (success) router.refresh();
    };

    return (
        <>
            <MembersTableSections
                members={tableMembers}
                tableKey={tableKey}
                startIndex={startIndex}
                onInlineUpdate={handleInlineUpdate}
                onOpenMemberDetail={openMemberDetail}
                onRowClick={handleRowClick}
                onToggleFavorite={handleToggleFavorite}
            />
            <MemberQuickPreview
                key={selectedMemberId || 'empty'}
                memberId={selectedMemberId}
                memberIds={tableMembers.find((member) => member.member_id === selectedMemberId)?.entity_ids || (selectedMemberId ? [selectedMemberId] : null)}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                returnTo={typeof window === 'undefined' ? '/members' : `${window.location.pathname}${window.location.search}`}
            />
        </>
    );
}
