'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SortableHeader } from './SortableHeader';
import { MemberDetailDialog } from './MemberDetailDialog';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/icon';

interface Member {
    id: string;
    name: string;
    member_number: string;
    phone: string | null;
    tier: string | null;
    status: string | null;
    is_registered: boolean;
    unit_group: string | null;
    relationships?: { name: string; relation: string }[] | null;
}

interface MembersTableProps {
    members: Member[];
    tableKey: string;
    startIndex: number;
}

export function MembersTable({ members, tableKey, startIndex }: MembersTableProps) {
    const router = useRouter();
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleRowClick = (memberId: string) => {
        setSelectedMemberId(memberId);
        setDialogOpen(true);
    };

    const getStatusBadge = (status: string | null) => {
        switch (status) {
            case '정상':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500 relative top-[0.5px]" />
                        정상
                    </span>
                );
            case '탈퇴예정':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-500 border border-rose-500/20">
                        <span className="size-1.5 rounded-full bg-rose-500 relative top-[0.5px]" />
                        탈퇴
                    </span>
                );
            case '소송중':
                return (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-500 border border-orange-500/20">
                        <span className="size-1.5 rounded-full bg-orange-500 relative top-[0.5px]" />
                        소송
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground border border-border">
                        {status || '미지정'}
                    </span>
                );
        }
    };

    const renderTag = (tag: string, type: 'blue' | 'red') => (
        <span className={cn(
            "px-2.5 py-1 rounded-[6px] text-[11px] font-medium transition-all hover:opacity-80 cursor-default whitespace-nowrap",
            type === 'blue'
                ? "bg-[#2D3342] text-[#93C5FD]"
                : "bg-[#382329] text-[#FCA5A5]"
        )}>
            #{tag}
        </span>
    );

    const handleSaved = () => {
        router.refresh();
    };

    const getRepresentativeDisplay = (relationships?: { name: string; relation: string }[] | null) => {
        if (!relationships || relationships.length === 0) return '-';
        const rel = relationships[0];
        return rel.relation ? `${rel.name} (${rel.relation})` : rel.name;
    };

    return (
        <>
            <div className="w-full h-full overflow-auto scrollbar-thin scrollbar-thumb-border/30">
                <table className="w-full text-center bg-card mt-0 text-sm whitespace-nowrap" key={tableKey}>
                    <thead className="sticky top-0 z-10 bg-[#161B22] text-gray-400 font-medium border-b border-white/[0.08]">
                        <tr>
                            <th className="px-6 py-3.5 w-[50px] text-center">
                                No.
                            </th>
                            <th className="px-6 py-3.5 flex justify-center">
                                <SortableHeader label="조합원번호" field="member_number" className="justify-center" />
                            </th>
                            <th className="px-6 py-3.5">
                                <div className="flex justify-center">
                                    <SortableHeader label="성명" field="name" className="justify-center" />
                                </div>
                            </th>
                            <th className="px-6 py-3.5">
                                <div className="flex justify-center">
                                    <SortableHeader label="대리인" field="representative" className="justify-center" />
                                </div>
                            </th>
                            <th className="px-6 py-3.5">
                                <div className="flex justify-center">
                                    <SortableHeader label="차수" field="tier" className="justify-center" />
                                </div>
                            </th>
                            <th className="px-6 py-3.5">
                                <div className="flex justify-center">
                                    <SortableHeader label="상태" field="status" className="justify-center" />
                                </div>
                            </th>
                            <th className="px-6 py-3.5">
                                <div className="flex justify-center">
                                    <SortableHeader label="연락처" field="phone" className="justify-center" />
                                </div>
                            </th>
                            <th className="px-6 py-3.5">
                                <div className="flex justify-center">
                                    <SortableHeader label="특이사항 (태그)" field="tags" className="justify-center" />
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.08]">
                        {members.map((member, index) => (
                            <tr
                                key={member.id}
                                className="group cursor-pointer hover:bg-white/[0.02] transition-colors h-[50px]"
                                onClick={() => handleRowClick(member.id)}
                            >
                                <td className="px-6 py-2 text-center text-gray-500 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                                    {startIndex + index + 1}
                                </td>
                                <td className="px-6 py-2 font-medium text-gray-200 text-center">
                                    {member.member_number}
                                </td>
                                <td className="px-6 py-2 text-white font-bold text-center">
                                    {member.name}
                                </td>
                                <td className="px-6 py-2 text-gray-400 text-center">
                                    {getRepresentativeDisplay(member.relationships)}
                                </td>
                                <td className="px-6 py-2 text-center">
                                    <span className="text-gray-400">
                                        {member.tier || '-'}
                                    </span>
                                </td>
                                <td className="px-6 py-2 text-center flex justify-center items-center h-[50px]">
                                    {getStatusBadge(member.status)}
                                </td>
                                <td className="px-6 py-2 text-gray-400 font-mono tracking-tight text-center">
                                    {member.phone || '010-0000-0000'}
                                </td>
                                <td className="px-6 py-2 text-center">
                                    <div className="flex gap-2 justify-center">
                                        {member.status === '정상' && renderTag('납부약정', 'blue')}
                                        {member.tier === '지주' && renderTag('부재중', 'blue')}
                                        {member.status === '탈퇴예정' && renderTag('강성', 'red')}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <MemberDetailDialog
                memberId={selectedMemberId}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSaved={handleSaved}
            />
        </>
    );
}
