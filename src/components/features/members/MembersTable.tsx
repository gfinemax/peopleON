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
    relationships?: { name: string; relation: string; phone?: string }[] | null;
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
            {/* Desktop Table View */}
            <div className="hidden md:block w-full h-full overflow-auto scrollbar-thin scrollbar-thumb-border/30">
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

            {/* Mobile Card View */}
            <div className="block md:hidden w-full h-full overflow-y-auto overflow-x-hidden px-0 py-2 space-y-3 pb-24 scrollbar-hide">
                {members.map((member, index) => {
                    // Determine status color
                    let statusBorderClass = 'border-l-muted'; // Default
                    if (member.status === '정상') statusBorderClass = 'border-l-emerald-500';
                    else if (member.status === '탈퇴예정') statusBorderClass = 'border-l-rose-500';
                    else if (member.status === '소송중') statusBorderClass = 'border-l-orange-500';
                    else if (member.status) statusBorderClass = 'border-l-blue-500'; // Other status

                    return (
                        <div
                            key={member.id}
                            onClick={() => handleRowClick(member.id)}
                            className={`flex flex-col gap-2 p-3 mx-3 rounded-xl border border-white/[0.08] bg-[#161B22]/50 hover:bg-[#161B22] active:scale-[0.98] transition-all shadow-sm relative overflow-hidden pr-4`}
                        >
                            {/* Vertical Status Bar */}
                            <div className={`absolute right-0 top-0 bottom-0 w-1 ${statusBorderClass.replace('border-l-', 'bg-')}`} />

                            <div className="flex justify-between items-start">
                                <div className="flex gap-3 items-center">
                                    <span className="flex items-center justify-center size-8 rounded-full bg-primary/10 text-primary font-bold text-[13px] ring-1 ring-primary/20">
                                        {startIndex + index + 1}
                                    </span>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[15px] font-bold text-white">{member.name}</span>
                                            <span className="text-[11px] text-muted-foreground/60 font-mono">{member.member_number}</span>
                                        </div>
                                        <div className="text-[13px] text-muted-foreground">
                                            {member.tier || '차수미정'} / {member.unit_group || '동호수미정'}
                                            {member.relationships && member.relationships.length > 0 && (
                                                <span className="ml-2 text-orange-400 font-bold">
                                                    {member.relationships[0].name} ({member.relationships[0].relation})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {getStatusBadge(member.status)}
                            </div>

                            <div className="h-px w-full bg-white/[0.04]" />

                            <div className="flex justify-between items-center px-1">
                                <div className="flex items-center gap-4">
                                    <a
                                        href={member.phone ? `tel:${member.phone}` : undefined}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!member.phone) {
                                                e.preventDefault();
                                                alert('전화번호가 없습니다.');
                                            }
                                        }}
                                        className={`flex items-center gap-2 text-[14px] py-1 px-2 rounded -ml-2 transition-colors ${member.phone ? 'text-blue-400 hover:bg-blue-500/10 active:bg-blue-500/20' : 'text-gray-600 cursor-not-allowed'}`}
                                    >
                                        <MaterialIcon name="call" size="xs" className={`${member.phone ? "text-blue-400" : "opacity-30"} text-[13px]`} />
                                        <span className="font-mono tracking-tight font-bold">{member.phone || '전화번호 없음'}</span>
                                    </a>

                                    {/* Representative Info */}
                                    {member.relationships && member.relationships.length > 0 && member.relationships[0].phone && (
                                        <a
                                            href={`tel:${member.relationships[0].phone}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex items-center gap-1.5 text-[14px] py-1 px-2 rounded hover:bg-orange-500/10 active:bg-orange-500/20 transition-colors text-orange-400"
                                        >
                                            <MaterialIcon name="supervisor_account" size="xs" className="text-[13px]" />
                                            <span className="font-mono tracking-tight font-bold">{member.relationships[0].phone}</span>
                                        </a>
                                    )}
                                </div>
                                {/* Simple Tag Summary if needed */}
                                <div className="flex gap-1.5">
                                    {member.status === '탈퇴예정' && <span className="size-1.5 rounded-full bg-red-500" />}
                                    {member.tier === '지주' && <span className="size-1.5 rounded-full bg-blue-500" />}
                                </div>
                            </div>
                        </div>
                    );
                })}
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
