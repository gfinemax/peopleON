'use client';

import { useState } from 'react';
import { SortableHeader } from '@/components/features/members/SortableHeader';
import { LegacyRecordDetailDialog } from './LegacyRecordDetailDialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
    LEGACY_MEMBER_SEGMENT_LABEL_MAP,
    type LegacyMemberSegment,
} from '@/lib/legacy/memberSegments';

interface LegacyRecord {
    id: string;
    original_name: string;
    owner_name: string;
    owner_type: 'member_linked' | 'certificate_holder_linked' | 'legacy_only';
    source_file: string;
    raw_data: Record<string, unknown>;
    member_id: string | null;
    certificate_numbers: string[];
    certificate_count: number;
    member_segment: LegacyMemberSegment;
    contact: string;
}

function ownerTypeLabel(ownerType: LegacyRecord['owner_type']) {
    if (ownerType === 'member_linked') return '회원연결';
    if (ownerType === 'certificate_holder_linked') return '권리증소유자';
    return '원장기준';
}

function ownerTypeClass(ownerType: LegacyRecord['owner_type']) {
    if (ownerType === 'member_linked') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    if (ownerType === 'certificate_holder_linked') return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
    return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
}

interface LegacyTableProps {
    records: LegacyRecord[];
    tableKey: string;
}

export function LegacyTable({ records, tableKey }: LegacyTableProps) {
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleRowClick = (recordId: string) => {
        setSelectedRecordId(recordId);
        setDialogOpen(true);
    };

    const getCertificateSummary = (record: LegacyRecord) => {
        const numbers = record.certificate_numbers || [];
        if (numbers.length === 0) return '-';
        if (numbers.length <= 2) return numbers.join(', ');
        return `${numbers[0]}, ${numbers[1]} 외 ${numbers.length - 2}`;
    };

    const getSegmentBadgeClass = (segment: LegacyMemberSegment) => {
        switch (segment) {
            case 'registered_116':
                return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'refunded':
                return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'second_member':
                return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'landlord_member':
                return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
            case 'general_sale':
                return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'reserve_member':
            default:
                return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
        }
    };

    return (
        <>
            <table className="w-full text-center bg-card mt-0 text-sm whitespace-nowrap" key={tableKey}>
                <thead className="sticky top-0 z-10 bg-[#161B22] text-gray-400 font-medium border-b border-white/[0.08]">
                    <tr>
                        <th className="px-6 py-3.5 w-[50px] text-center">
                            No.
                        </th>
                        <th className="px-6 py-3.5">
                            <div className="flex justify-center">
                                <SortableHeader label="이름" field="original_name" className="justify-center" />
                            </div>
                        </th>
                        <th className="px-6 py-3.5">
                            <div className="flex justify-center">
                                <span className="text-xs font-semibold cursor-default">소유자(정규)</span>
                            </div>
                        </th>
                        <th className="px-6 py-3.5">
                            <div className="flex justify-center">
                                <span className="text-xs font-semibold cursor-default">권리증번호</span>
                            </div>
                        </th>
                        <th className="px-6 py-3.5">
                            <div className="flex justify-center">
                                <SortableHeader label="보유 권리증(번호기준)" field="certificate_count" className="justify-center" />
                            </div>
                        </th>
                        <th className="px-6 py-3.5">
                            <div className="flex justify-center">
                                <span className="text-xs font-semibold cursor-default">연락처</span>
                            </div>
                        </th>
                        <th className="px-6 py-3.5">
                            <div className="flex justify-center">
                                <SortableHeader label="조합원 상태" field="member_segment" className="justify-center" />
                            </div>
                        </th>
                        <th className="px-6 py-3.5">
                            <div className="flex justify-center">
                                <SortableHeader label="출처 파일" field="source_file" className="justify-center" />
                            </div>
                        </th>
                        <th className="px-6 py-3.5 text-right">
                            Raw Data
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.08]">
                    {records.map((record, index) => {
                        return (
                            <tr
                                key={record.id}
                                className="group cursor-pointer hover:bg-white/[0.02] transition-colors h-[50px]"
                                onClick={() => handleRowClick(record.id)}
                            >
                            <td className="px-6 py-2 text-center text-gray-500 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                                {index + 1}
                            </td>
                            <td className="px-6 py-2 text-white font-bold text-center">
                                {record.original_name}
                            </td>
                            <td className="px-6 py-2 text-center">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-xs font-bold text-slate-100">{record.owner_name}</span>
                                    <span className={cn(
                                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                                        ownerTypeClass(record.owner_type),
                                    )}>
                                        {ownerTypeLabel(record.owner_type)}
                                    </span>
                                </div>
                            </td>
                            <td className="px-6 py-2 text-center text-blue-400 font-mono text-xs font-medium">
                                {getCertificateSummary(record)}
                            </td>
                            <td className="px-6 py-2 text-center">
                                <Badge variant="outline" className={cn(
                                    "font-mono",
                                    record.certificate_count > 0
                                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                                        : "bg-muted text-muted-foreground border-border"
                                )}>
                                    {record.certificate_count}개
                                </Badge>
                            </td>
                            <td className="px-6 py-2 text-center text-muted-foreground font-mono text-xs">
                                {record.contact}
                            </td>
                            <td className="px-6 py-2 text-center flex justify-center items-center h-[50px]">
                                <span className={cn(
                                    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border",
                                    getSegmentBadgeClass(record.member_segment)
                                )}>
                                    <span className="size-1.5 rounded-full bg-current relative top-[0.5px]" />
                                    {LEGACY_MEMBER_SEGMENT_LABEL_MAP[record.member_segment]}
                                </span>
                            </td>
                            <td className="px-6 py-2 text-gray-500 text-xs text-center">
                                {record.source_file}
                            </td>
                            <td className="px-6 py-2 text-right">
                                <span className="text-xs text-gray-600 font-mono truncate max-w-[200px] inline-block align-bottom opacity-60">
                                    {JSON.stringify(record.raw_data).substring(0, 50)}...
                                </span>
                            </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            <LegacyRecordDetailDialog
                recordId={selectedRecordId}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            />
        </>
    );
}
