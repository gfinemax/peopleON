'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface LegacyRecord {
    id: string;
    original_name: string;
    rights_count: number;
    source_file: string;
    amount_paid: number;
    contract_date: string;
    raw_data: Record<string, unknown>;
    member_id: string | null;
    is_refunded: boolean;
    created_at: string;
    legacy_name?: string;
}

interface LegacyRecordDetailDialogProps {
    recordId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

type TabType = 'info' | 'raw';

export function LegacyRecordDetailDialog({
    recordId,
    open,
    onOpenChange
}: LegacyRecordDetailDialogProps) {
    const [record, setRecord] = useState<LegacyRecord | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('info');

    // Draggable Logic
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handlePointerMove = (e: PointerEvent) => {
            if (isDragging) {
                setPosition({
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y
                });
            }
        };
        const handlePointerUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, dragStart]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button, input, textarea, a')) return;
        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    useEffect(() => {
        if (open && recordId) {
            setPosition({ x: 0, y: 0 });
            fetchRecord(recordId);
            setActiveTab('info');
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

    const tabs = [
        { id: 'info' as TabType, label: '기본 정보', icon: 'description' },
        { id: 'raw' as TabType, label: '원본 데이터', icon: 'data_object' },
    ];

    if (!record && !loading) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="w-full h-full max-w-none max-h-none h-screen sm:h-auto sm:max-h-[85vh] sm:max-w-2xl p-0 border-0 sm:border sm:border-white/[0.1] bg-[#0F151B] rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl sm:top-[12vh] sm:translate-y-0"
                style={{
                    marginLeft: position.x,
                    marginTop: position.y
                }}
            >
                {/* 1. Header Area */}
                <div
                    className="shrink-0 px-6 pt-6 pb-5 flex items-start justify-between bg-[#0F151B] relative z-20 cursor-move select-none"
                    onPointerDown={handlePointerDown}
                >
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-white text-2xl font-bold leading-tight tracking-tight drop-shadow-md">
                                {record?.original_name || 'Loading...'}
                            </DialogTitle>
                            {record && (
                                <span className={cn(
                                    "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-sm",
                                    record.is_refunded
                                        ? "bg-red-500/20 border-red-500/30 text-red-300"
                                        : "bg-green-500/20 border-green-500/30 text-green-300"
                                )}>
                                    {record.is_refunded ? '환불됨' : '보유중'}
                                </span>
                            )}
                        </div>
                        <p className="text-gray-400 text-sm font-normal">
                            출처 파일: <span className="text-gray-300 font-mono">{record?.source_file}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end mr-2">
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">보유 권리증</span>
                            <span className="text-xl font-black text-blue-400 font-mono tracking-tight">{record?.rights_count || 0}개</span>
                        </div>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="group p-2 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
                        >
                            <MaterialIcon name="close" className="text-gray-400 group-hover:text-white transition-colors" size="sm" />
                        </button>
                    </div>
                </div>

                {/* 2. Folder Tabs & Content Container */}
                <div className="flex-1 flex flex-col min-h-0 relative px-0 pb-0 bg-[#0F151B]">
                    {/* Tabs Row */}
                    <div className="flex items-end px-4 relative z-10">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "relative group flex items-center justify-center min-w-[110px] pb-3 px-6 outline-none transition-all",
                                        isActive ? "pt-3.5 z-20" : "pt-4 text-gray-500 hover:text-gray-300 z-10"
                                    )}
                                >
                                    {isActive ? (
                                        <>
                                            {/* Active Tab Backgrounds */}
                                            <div className="absolute bottom-0 -left-4 w-4 h-4 z-10 pointer-events-none"
                                                style={{ background: 'radial-gradient(circle at top left, transparent 16px, #1A2633 16.5px)' }} />
                                            <div className="absolute inset-0 bg-[#1A2633] rounded-t-xl z-0 shadow-[-1px_-1px_0_rgba(255,255,255,0.05)]" />

                                            {/* LIGHTING EFFECT (Orange/Blue Gradient Line) */}
                                            <div className={cn(
                                                "absolute top-0 left-2 right-2 h-[2px] bg-gradient-to-r opacity-70 z-20",
                                                tab.id === 'info' ? "from-blue-400/0 via-blue-400 to-blue-400/0" : "from-orange-400/0 via-orange-400 to-orange-400/0"
                                            )} />

                                            <div className="absolute bottom-0 -right-4 w-4 h-4 z-10 pointer-events-none"
                                                style={{ background: 'radial-gradient(circle at top right, transparent 16px, #1A2633 16.5px)' }} />

                                            {/* Active Content */}
                                            <div className="relative z-20 flex items-center gap-2">
                                                <MaterialIcon
                                                    name={tab.icon}
                                                    className={cn(
                                                        "text-[18px] drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]",
                                                        tab.id === 'info' ? "text-blue-400" : "text-orange-400"
                                                    )}
                                                />
                                                <p className="text-white text-sm font-bold tracking-wide">{tab.label}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* Hover Effect */}
                                            <div className="absolute inset-x-2 top-2 bottom-0 rounded-t-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />

                                            {/* Inactive Content */}
                                            <div className="relative z-10 flex items-center gap-2">
                                                <MaterialIcon name={tab.icon} className="text-[18px]" />
                                                <p className="text-xs font-semibold">{tab.label}</p>
                                            </div>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#1A2633] z-0" />
                    </div>

                    {/* Content Box */}
                    <div className="flex-1 bg-[#1A2633] relative z-0 overflow-hidden flex flex-col">
                        <div className="flex-1 overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-white/10">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center gap-3 opacity-50">
                                    <MaterialIcon name="refresh" className="animate-spin text-white" />
                                    <span className="text-xs font-bold text-gray-400">로딩 중...</span>
                                </div>
                            ) : record ? (
                                <>
                                    {activeTab === 'info' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {/* Summary Cards */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-[#233040] p-5 rounded-xl border border-white/5 flex flex-col gap-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">기납부 총액</span>
                                                    <span className="text-2xl font-black text-white font-mono">
                                                        ₩{(record.amount_paid || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                                <div className="bg-[#233040] p-5 rounded-xl border border-white/5 flex flex-col gap-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">최초 계약일</span>
                                                    <span className="text-xl font-bold text-white font-mono">
                                                        {record.contract_date || '미상'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Detail List */}
                                            <div className="bg-[#233040] rounded-xl shadow-sm border border-white/5 p-6">
                                                <h3 className="text-white text-base font-bold mb-5 flex items-center gap-2">
                                                    <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                                                    상세 요약
                                                </h3>
                                                <div className="flex flex-col gap-0">
                                                    <InfoRow icon="person" label="원장 명부 이름" value={record.legacy_name || record.original_name} />
                                                    <InfoRow icon="link" label="조합원 매칭" value={record.member_id ? "매칭 완료 (회원 ID 연동됨)" : "매칭되지 않음 (미가입/탈퇴)"} />
                                                    <InfoRow icon="schedule" label="데이터 생성일" value={new Date(record.created_at).toLocaleString()} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'raw' && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="bg-black/30 rounded-xl border border-white/10 p-4 font-mono text-xs text-gray-300 overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <tbody>
                                                        {record.raw_data && formatRawData(record.raw_data).map(({ key, value }) => (
                                                            <tr key={key} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                                                <td className="py-2 pr-4 font-bold text-orange-400/80 whitespace-nowrap">{key}</td>
                                                                <td className="py-2 text-gray-300 break-all">{value}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-12 text-gray-500">기록을 불러올 수 없습니다.</div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function InfoRow({ icon, label, value }: any) {
    return (
        <div className="grid grid-cols-[120px_1fr] items-center gap-4 border-b border-white/5 py-3 last:border-0">
            <div className="flex items-center gap-2">
                <MaterialIcon name={icon} className="text-gray-500 text-[16px]" />
                <p className="text-gray-400 text-xs font-medium">{label}</p>
            </div>
            <p className="text-gray-200 text-sm font-normal break-all">{value}</p>
        </div>
    );
}
