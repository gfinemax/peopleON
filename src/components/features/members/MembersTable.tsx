'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MemberDetailDialog } from './MemberDetailDialog';
import { MembersTableSections } from './MembersTableSections';
import {
    type DetailTab,
    type MembersTableMember as Member,
} from './membersTableUtils';
import type { MemberDetailDialogMember } from './memberDetailDialogTypes';
import { toggleFavoriteMember } from '@/app/actions/members';

interface MembersTableProps {
    members: Member[];
    tableKey: string;
    startIndex: number;
}

export function MembersTable({ members, tableKey, startIndex }: MembersTableProps) {
    const router = useRouter();
    const [memberOverrides, setMemberOverrides] = useState<Record<string, Partial<Member>>>({});
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [selectedInitialTab, setSelectedInitialTab] = useState<DetailTab>('info');
    const [dialogOpen, setDialogOpen] = useState(false);

    const tableMembers = members.map((member) =>
        member.member_id && memberOverrides[member.member_id]
            ? { ...member, ...memberOverrides[member.member_id] }
            : member,
    );

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
        setSelectedMemberId(memberId);
        setSelectedInitialTab(initialTab);
        setDialogOpen(true);
    };

    const handleRowClick = (member: Member) => {
        if (!member.member_id) return;
        openMemberDetail(member.member_id, member._matchedLog ? 'timeline' : 'info');
    };

    const handleToggleFavorite = async (member: Member) => {
        if (!member.member_id) return;

        const success = await toggleFavoriteMember(member.member_id, !member.is_favorite);
        if (success) router.refresh();
    };

    const handleSaved = (savedMember: MemberDetailDialogMember | null) => {
        if (savedMember) {
            setMemberOverrides((prev) => ({
                ...prev,
                [savedMember.id]: {
                    name: savedMember.name,
                    phone: savedMember.phone,
                    status: savedMember.status,
                    tier: savedMember.tier,
                    tiers: savedMember.tiers || undefined,
                    certificate_display: savedMember.certificate_display,
                },
            }));
        }

        router.refresh();
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
            <MemberDetailDialog
                memberId={selectedMemberId}
                memberIds={tableMembers.find((member) => member.id === selectedMemberId)?.entity_ids || (selectedMemberId ? [selectedMemberId] : null)}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSaved={handleSaved}
                initialTab={selectedInitialTab}
            />
        </>
    );
}
