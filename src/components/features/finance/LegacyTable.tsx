'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SortableHeader } from '@/components/features/members/SortableHeader';
import { LegacyRecordDetailDialog } from './LegacyRecordDetailDialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MaterialIcon } from '@/components/ui/icon';

interface LegacyRecord {
    id: string;
    original_name: string;
    rights_count: number;
    source_file: string;
    raw_data: Record<string, unknown>;
    member_id: string | null;
}

interface LegacyTableProps {
    records: LegacyRecord[];
    tableKey: string;
}

export function LegacyTable({ records, tableKey }: LegacyTableProps) {
    const router = useRouter();
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleRowClick = (recordId: string) => {
        setSelectedRecordId(recordId);
        setDialogOpen(true);
    };

    const getCertificateNumber = (data: Record<string, any>) => {
        if (!data) return '-';

        // Pattern for Certificate Number: YYYY-MM-DD or YYYY-M-Num (e.g., 2005-01-06, 2006-1-100)
        const certPattern = /^\d{4}-\d{1,2}-\d+$/;

        // 1. Search by Value Pattern (Priority)
        const findByValuePattern = (obj: any): string | null => {
            for (const key of Object.keys(obj)) {
                const value = obj[key];

                // If value matches pattern, return it
                if (typeof value === 'string' && certPattern.test(value)) {
                    return value;
                }

                // Recursively search objects
                if (typeof value === 'object' && value !== null) {
                    const found = findByValuePattern(value);
                    if (found) return found;
                }
            }
            return null;
        };

        const valueMatch = findByValuePattern(data);
        if (valueMatch) return valueMatch;

        // 2. Fallback: Search by Keys
        const searchKeys = ['필증no', '필증NO', '필증No', '필증번호', '권리증번호', '증서번호', '증번호', '채권번호', 'NO', 'No', 'no'];

        const findByKey = (obj: any): string | null => {
            for (const key of Object.keys(obj)) {
                if (searchKeys.some(k => key.includes(k))) {
                    // Ignore simple numbers if we suspect they are just indexes (like 1.0, 2.0) if we want to be strict,
                    // but for fallback let's keep it.
                    // Maybe prioritize string values that are NOT "1.0", "2.0" etc?
                    return String(obj[key]);
                }
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    const found = findByKey(obj[key]);
                    if (found) return found;
                }
            }
            return null;
        };

        const keyMatch = findByKey(data);
        if (keyMatch) return String(keyMatch);

        return '-';
    };

    return (
        <>
            <div className="overflow-x-auto">
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
                                    <span className="text-xs font-semibold cursor-default">권리증번호</span>
                                </div>
                            </th>
                            <th className="px-6 py-3.5">
                                <div className="flex justify-center">
                                    <SortableHeader label="보유 권리증" field="rights_count" className="justify-center" />
                                </div>
                            </th>
                            <th className="px-6 py-3.5">
                                <div className="flex justify-center">
                                    <SortableHeader label="상태" field="member_id" className="justify-center" />
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
                        {records.map((record, index) => (
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
                                <td className="px-6 py-2 text-center text-blue-400 font-mono text-xs font-medium">
                                    {getCertificateNumber(record.raw_data)}
                                </td>
                                <td className="px-6 py-2 text-center">
                                    <Badge variant="outline" className={cn(
                                        "font-mono",
                                        record.rights_count > 0
                                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20"
                                            : "bg-muted text-muted-foreground border-border"
                                    )}>
                                        {record.rights_count}개
                                    </Badge>
                                </td>
                                <td className="px-6 py-2 text-center flex justify-center items-center h-[50px]">
                                    {record.member_id ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                                            <span className="size-1.5 rounded-full bg-emerald-500 relative top-[0.5px]" />
                                            조합원 매칭됨
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-400 border border-slate-500/20">
                                            <span className="size-1.5 rounded-full bg-slate-500 relative top-[0.5px]" />
                                            과거/환불
                                        </span>
                                    )}
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
                        ))}
                    </tbody>
                </table>
            </div>

            <LegacyRecordDetailDialog
                recordId={selectedRecordId}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            />
        </>
    );
}
