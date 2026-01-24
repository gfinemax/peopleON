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
}

interface MembersTableProps {
    members: Member[];
    tableKey: string;
}

export function MembersTable({ members, tableKey }: MembersTableProps) {
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
                    <span className="inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-[11px] font-bold text-success border border-success/30 uppercase tracking-wider badge-glow-success">
                        <span className="size-1.5 rounded-full bg-success" />
                        정상
                    </span>
                );
            case '탈퇴예정':
                return (
                    <span className="inline-flex items-center gap-2 rounded-full bg-destructive/15 px-3 py-1 text-[11px] font-bold text-destructive border border-destructive/30 uppercase tracking-wider">
                        <span className="size-1.5 rounded-full bg-destructive" />
                        탈퇴
                    </span>
                );
            case '소송중':
                return (
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-bold text-amber-500 border border-amber-500/30 uppercase tracking-wider">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        소송
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center rounded-full bg-muted/20 px-3 py-1 text-[11px] font-bold text-muted-foreground border border-white/5 uppercase tracking-wider">
                        {status || '미지정'}
                    </span>
                );
        }
    };

    const renderTag = (tag: string, type: 'blue' | 'red') => (
        <span className={cn(
            "px-2 py-0.5 rounded-md text-[10px] font-bold border tracking-wide transition-all hover:scale-105 cursor-default whitespace-nowrap",
            type === 'blue'
                ? "bg-blue-400/5 text-blue-400/70 border-blue-400/20"
                : "bg-red-400/5 text-red-400/70 border-red-400/20"
        )}>
            #{tag}
        </span>
    );

    const handleSaved = () => {
        router.refresh();
    };

    return (
        <>
            <div className="overflow-x-auto">
                <table className="w-full text-left bg-card" key={tableKey}>
                    <thead className="bg-card/50 text-muted-foreground/50 border-b border-border/30">
                        <tr>
                            <th className="pl-6 pr-2 py-3 w-[50px]">
                                <input type="checkbox" className="size-4 bg-muted/20 border-border rounded cursor-pointer accent-primary" />
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/30">조합원번호 (동호수)</span>
                            </th>
                            <th className="px-2 py-3 whitespace-nowrap">
                                <span className="text-[11px] font-bold uppercase tracking-wider pl-2 text-muted-foreground/30">성명</span>
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/30">차수</span>
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/30">상태</span>
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/30">연락처</span>
                            </th>
                            <th className="px-4 py-3 whitespace-nowrap">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/30">특이사항 (태그)</span>
                            </th>
                            <th className="pl-4 pr-8 py-3 text-right">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/30">관리</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/10">
                        {members.map((member) => (
                            <tr
                                key={member.id}
                                className="group cursor-pointer hover:bg-white/[0.02] transition-all border-b border-white/[0.04]"
                                onClick={() => handleRowClick(member.id)}
                            >
                                <td className="pl-6 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                                    <input type="checkbox" className="size-4 bg-muted/20 border-border rounded cursor-pointer accent-primary" />
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-[13px] font-medium text-muted-foreground/60 tracking-tight font-mono group-hover:text-foreground transition-colors">
                                        {member.member_number}
                                    </span>
                                </td>
                                <td className="px-2 py-3">
                                    <span className="text-sm font-bold text-foreground pl-2 group-hover:text-primary transition-colors">
                                        {member.name}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs font-medium text-muted-foreground/50">
                                        {member.tier || '-'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    {getStatusBadge(member.status)}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs font-medium text-muted-foreground/50 font-mono tracking-tight group-hover:text-foreground transition-colors">
                                        {member.phone || '010-0000-0000'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex gap-2">
                                        {member.status === '정상' && renderTag('납부약정', 'blue')}
                                        {member.tier === '지주' && renderTag('부재중', 'blue')}
                                        {member.status === '탈퇴예정' && renderTag('강성', 'red')}
                                    </div>
                                </td>
                                <td className="pl-4 pr-8 py-3 text-right">
                                    <button
                                        className="text-muted-foreground hover:text-white transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/members/${member.id}`);
                                        }}
                                    >
                                        <MaterialIcon name="edit" size="sm" />
                                    </button>
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
