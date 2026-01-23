'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, FileText, User, Phone } from 'lucide-react';

interface LegacyRecord {
    id: string;
    original_name: string;
    rights_count: number;
    source_file: string;
    raw_data: Record<string, unknown>;
    member_id: string | null;
    is_refunded: boolean;
    created_at: string;
}

interface LegacyRecordDetailDialogProps {
    recordId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function LegacyRecordDetailDialog({
    recordId,
    open,
    onOpenChange
}: LegacyRecordDetailDialogProps) {
    const [record, setRecord] = useState<LegacyRecord | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && recordId) {
            fetchRecord(recordId);
        }
    }, [open, recordId]);

    const fetchRecord = async (id: string) => {
        setLoading(true);
        const supabase = createClient();

        const { data, error } = await supabase
            .from('legacy_records')
            .select('*')
            .eq('id', id)
            .single();

        if (!error && data) {
            setRecord(data);
        }
        setLoading(false);
    };

    const formatRawData = (data: Record<string, unknown>): { key: string; value: string }[] => {
        return Object.entries(data).map(([key, value]) => ({
            key,
            value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? '-')
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        과거 기록 상세
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    </div>
                ) : record ? (
                    <div className="space-y-4">
                        {/* Header Section */}
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-xl font-bold">{record.original_name}</h2>
                                    {record.member_id ? (
                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">조합원 매칭됨</Badge>
                                    ) : (
                                        <Badge variant="secondary">과거/환불</Badge>
                                    )}
                                </div>
                                <p className="text-sm text-slate-500">출처: {record.source_file}</p>
                            </div>
                            <Badge variant="outline" className="text-lg bg-blue-50 text-blue-700">
                                권리증 {record.rights_count}개
                            </Badge>
                        </div>

                        <Separator />

                        {/* Raw Data Section */}
                        <div className="space-y-2" suppressHydrationWarning>
                            <h3 className="font-semibold text-sm text-slate-700 flex items-center gap-1">
                                <User className="h-4 w-4" /> 원본 데이터
                            </h3>
                            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                                {record.raw_data && formatRawData(record.raw_data).map(({ key, value }) => (
                                    <div key={key} className="flex justify-between text-sm">
                                        <span className="text-slate-500 font-medium">{key}</span>
                                        <span className="text-slate-800 text-right max-w-[60%] truncate">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Contact Info (if available in raw_data) */}
                        {record.raw_data && ('연락처' in record.raw_data || '전화번호' in record.raw_data) && (
                            <>
                                <Separator />
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-4 w-4 text-slate-500" />
                                    <span className="font-medium">연락처:</span>
                                    <span>{String(record.raw_data['연락처'] ?? record.raw_data['전화번호'] ?? '-')}</span>
                                </div>
                            </>
                        )}

                        {/* Status Info */}
                        <Separator />
                        <div className="grid grid-cols-2 gap-2 text-sm text-slate-500">
                            <div>
                                <span className="font-medium">환불 여부:</span>{' '}
                                <Badge variant={record.is_refunded ? "destructive" : "outline"} className="ml-1">
                                    {record.is_refunded ? '환불됨' : '미환불'}
                                </Badge>
                            </div>
                            <div>
                                <span className="font-medium">등록일:</span>{' '}
                                {new Date(record.created_at).toLocaleDateString('ko-KR')}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-12 text-slate-500">
                        기록을 불러올 수 없습니다.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
