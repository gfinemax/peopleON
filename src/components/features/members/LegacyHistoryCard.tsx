'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface LegacyRecord {
    id: string;
    original_name: string;
    rights_count: number;
    source_file: string;
    raw_data: Record<string, any>;
    created_at: string;
}

export function LegacyHistoryCard({ records }: { records: LegacyRecord[] }) {
    const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

    if (!records || records.length === 0) return null;

    const toggleExpand = (id: string) => {
        setExpandedRecord(expandedRecord === id ? null : id);
    };

    return (
        <div className="flex flex-col rounded-lg border border-border/50 bg-card/40 overflow-hidden shadow-sm mt-8">
            <div className="p-6 bg-muted/5 flex items-center justify-between border-b border-border/30">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                        <MaterialIcon name="history_edu" size="sm" />
                    </div>
                    <h3 className="text-sm font-black text-foreground">과거 권리증 기록 (Legacy Data)</h3>
                </div>
                <Badge variant="outline" className="bg-orange-500/5 text-orange-500 border-orange-500/20 font-mono">
                    {records.length}건 발견됨
                </Badge>
            </div>

            <div className="divide-y divide-border/30">
                {records.map((record) => {
                    const isExpanded = expandedRecord === record.id;
                    const keys = Object.keys(record.raw_data || {}).filter(k =>
                        !['id', 'No', 'no', 'NO', '순번'].includes(k) && record.raw_data[k]
                    );

                    return (
                        <div key={record.id} className="flex flex-col group transition-colors hover:bg-muted/5">
                            <div
                                className="flex items-center justify-between p-6 cursor-pointer"
                                onClick={() => toggleExpand(record.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "size-10 rounded-full flex items-center justify-center border transition-colors",
                                        isExpanded ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/20 border-border text-muted-foreground"
                                    )}>
                                        <MaterialIcon name={isExpanded ? "expand_less" : "expand_more"} size="sm" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-foreground">{record.original_name}</span>
                                            <span className="text-[10px] text-muted-foreground/50 bg-muted/10 px-1.5 py-0.5 rounded border border-border/20">
                                                {record.source_file}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            보유 권리증: <span className="font-mono text-orange-500 font-bold">{record.rights_count}개</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right hidden sm:block">
                                    <p className="text-[10px] font-mono text-muted-foreground/40">ID: {record.id.slice(0, 8)}...</p>
                                </div>
                            </div>

                            {isExpanded && (
                                <div className="px-6 pb-8 pl-[4.5rem] animate-in slide-in-from-top-2 fade-in duration-200">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 rounded-lg p-5 border border-border/30">
                                        {keys.map((key) => (
                                            <div key={key} className="flex flex-col space-y-1">
                                                <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider truncate" title={key}>
                                                    {key}
                                                </span>
                                                <span className="text-xs font-medium text-foreground break-words font-mono bg-card/50 px-2 py-1.5 rounded border border-border/20">
                                                    {String(record.raw_data[key])}
                                                </span>
                                            </div>
                                        ))}
                                        {keys.length === 0 && (
                                            <div className="col-span-full text-center py-4 text-xs text-muted-foreground">
                                                추가 상세 데이터가 없습니다.
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 flex justify-end">
                                        <button className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1">
                                            <MaterialIcon name="content_copy" size="xs" />
                                            RAW JSON 복사
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
