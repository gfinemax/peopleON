'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SortableHeader } from '@/components/features/members/SortableHeader';
import { LegacyRecordDetailDialog } from './LegacyRecordDetailDialog';

interface LegacyRecord {
    id: string;
    original_name: string;
    rights_count: number;
    source_file: string;
    raw_data: Record<string, unknown>;
    member_id: string | null;
}

interface LegacyRecordsTableProps {
    records: LegacyRecord[];
    tableKey: string;
}

export function LegacyRecordsTable({ records, tableKey }: LegacyRecordsTableProps) {
    const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleRowClick = (recordId: string) => {
        setSelectedRecordId(recordId);
        setDialogOpen(true);
    };

    return (
        <>
            <Table key={tableKey}>
                <TableHeader>
                    <TableRow>
                        <TableHead>
                            <SortableHeader label="이름 (Original Name)" field="original_name" />
                        </TableHead>
                        <TableHead>
                            <SortableHeader label="보유 권리증 수" field="rights_count" />
                        </TableHead>
                        <TableHead>
                            <SortableHeader label="상태" field="member_id" />
                        </TableHead>
                        <TableHead>
                            <SortableHeader label="출처 파일" field="source_file" />
                        </TableHead>
                        <TableHead className="text-right">Raw Data</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {records.map((record) => (
                        <TableRow
                            key={record.id}
                            className="cursor-pointer hover:bg-slate-100/50 transition-colors"
                            onClick={() => handleRowClick(record.id)}
                        >
                            <TableCell className="font-medium">{record.original_name}</TableCell>
                            <TableCell>
                                <Badge variant="outline" className={record.rights_count > 0 ? "bg-blue-50 text-blue-700 hover:bg-blue-50" : ""}>
                                    {record.rights_count}개
                                </Badge>
                            </TableCell>
                            <TableCell>
                                {record.member_id ? (
                                    <Badge variant="default" className="bg-green-600">조합원 매칭됨</Badge>
                                ) : (
                                    <Badge variant="secondary">과거/환불</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">{record.source_file}</TableCell>
                            <TableCell className="text-right">
                                <span className="text-xs text-slate-400 font-mono truncate max-w-[200px] inline-block align-bottom">
                                    {JSON.stringify(record.raw_data).substring(0, 30)}...
                                </span>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <LegacyRecordDetailDialog
                recordId={selectedRecordId}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            />
        </>
    );
}
