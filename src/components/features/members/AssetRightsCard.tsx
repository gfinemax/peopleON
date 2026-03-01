'use client';

import { MaterialIcon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface AssetRight {
    id: string;
    right_type: string;
    right_number: string;
    principal_amount: number;
    recognized_value: number;
    status: string;
    issued_at: string | null;
    land_lot_info: string | null;
    meta: Record<string, any>;
}

export function AssetRightsCard({ rights }: { rights: AssetRight[] }) {
    const [expandedRight, setExpandedRight] = useState<string | null>(null);

    const formatKRW = (val: number) => `₩${Math.round(val).toLocaleString('ko-KR')}`;

    if (!rights || rights.length === 0) return (
        <div className="flex flex-col items-center justify-center p-12 rounded-lg border border-dashed border-border/30 bg-muted/5 text-muted-foreground">
            <MaterialIcon name="inventory_2" size="lg" className="mb-2 opacity-30" />
            <p className="text-sm font-medium">등록된 권리증이나 토지권이 없습니다.</p>
        </div>
    );

    return (
        <div className="flex flex-col rounded-lg border border-border/50 bg-card/40 overflow-hidden shadow-sm mt-8">
            <div className="p-6 bg-muted/5 flex items-center justify-between border-b border-border/30">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                        <MaterialIcon name="receipt_long" size="sm" />
                    </div>
                    <h3 className="text-sm font-black text-foreground">보유 권리 현황 (Asset Rights)</h3>
                </div>
                <Badge variant="outline" className="bg-blue-500/5 text-blue-400 border-blue-500/20 font-mono">
                    {rights.length}건
                </Badge>
            </div>

            <div className="divide-y divide-border/30">
                {rights.map((right) => {
                    const isExpanded = expandedRight === right.id;
                    const isCert = right.right_type === 'certificate';

                    return (
                        <div key={right.id} className="flex flex-col group transition-colors hover:bg-muted/5">
                            <div
                                className="flex items-center justify-between p-6 cursor-pointer"
                                onClick={() => setExpandedRight(isExpanded ? null : right.id)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "size-10 rounded-full flex items-center justify-center border transition-colors",
                                        isCert ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                    )}>
                                        <MaterialIcon name={isCert ? "article" : "landscape"} size="sm" />
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-foreground">
                                                {isCert ? '권리증' : '토지권'} {right.right_number}
                                            </span>
                                            <Badge variant="outline" className={cn(
                                                "text-[10px] h-5",
                                                right.status === 'active' ? "text-success border-success/30 bg-success/5" : "text-muted-foreground border-border bg-muted/5"
                                            )}>
                                                {right.status === 'active' ? '정상' : right.status}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            원금: <span className="font-mono text-foreground font-bold">{formatKRW(right.principal_amount)}</span>
                                            {right.recognized_value > 0 && (
                                                <> | 인정가: <span className="font-mono text-primary font-bold">{formatKRW(right.recognized_value)}</span></>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <MaterialIcon name={isExpanded ? "expand_less" : "expand_more"} className="text-muted-foreground/30" size="sm" />
                            </div>

                            {isExpanded && (
                                <div className="px-6 pb-8 pl-[4.5rem] animate-in slide-in-from-top-2 fade-in duration-200">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 rounded-lg p-5 border border-border/30">
                                        <DetailRow label="필증 성명" value={right.meta.cert_name || right.meta.registered_name || '-'} />
                                        <DetailRow label="발행일" value={right.issued_at ? new Date(right.issued_at).toLocaleDateString() : '-'} />
                                        <DetailRow label="필지 정보" value={right.land_lot_info || '-'} />
                                        <DetailRow label="취득 경로" value={right.meta.source || '-'} />
                                        {Object.entries(right.meta).map(([k, v]) => {
                                            if (['cert_name', 'registered_name', 'source'].includes(k)) return null;
                                            return <DetailRow key={k} label={k} value={String(v)} />;
                                        })}
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

function DetailRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-wider truncate">
                {label}
            </span>
            <span className="text-xs font-medium text-foreground break-words font-mono bg-card/50 px-2 py-1.5 rounded border border-border/20">
                {value}
            </span>
        </div>
    );
}
