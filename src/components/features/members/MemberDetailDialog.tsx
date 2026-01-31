'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { ActivityTimelineTab } from './ActivityTimelineTab';
import { PaymentStatusTab } from './PaymentStatusTab';

interface Member {
    id: string;
    name: string;
    member_number: string;
    phone: string | null;
    email: string | null;
    address_legal: string | null;
    tier: string | null;
    status: string | null;
    is_registered: boolean;
    unit_group: string | null;
    memo: string | null;
    tags?: string[] | null;
}

interface MemberDetailDialogProps {
    memberId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved?: () => void;
}

type TabType = 'info' | 'timeline' | 'payment';

export function MemberDetailDialog({
    memberId,
    open,
    onOpenChange,
    onSaved
}: MemberDetailDialogProps) {
    const [member, setMember] = useState<Member | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Member>>({});
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
        // Prevent drag if clicking buttons or inputs
        if ((e.target as HTMLElement).closest('button, input, textarea, a')) return;

        setIsDragging(true);
        setDragStart({
            x: e.clientX - position.x,
            y: e.clientY - position.y
        });
    };

    useEffect(() => {
        if (open && memberId) {
            setPosition({ x: 0, y: 0 });
            fetchMember(memberId);
            // Default to 'info' as typically desired, or keep 'timeline' if debugging is done.
            // Returning to 'info' for standard behavior, 'timeline' update            // Returning to default behavior
            setActiveTab('info');
        }
    }, [open, memberId]);

    const handleClose = () => {
        onOpenChange(false);
    };

    const fetchMember = async (id: string) => {
        setLoading(true);
        setIsEditing(false);
        const supabase = createClient();

        const { data, error } = await supabase
            .from('members')
            .select('*')
            .eq('id', id)
            .single();

        if (!error && data) {
            setMember(data);
            setFormData(data);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!memberId) return;

        setSaving(true);
        const supabase = createClient();

        const { error } = await supabase
            .from('members')
            .update({
                name: formData.name,
                phone: formData.phone,
                email: formData.email,
                address_legal: formData.address_legal,
                memo: formData.memo,
            })
            .eq('id', memberId);

        if (!error) {
            setMember(prev => prev ? { ...prev, ...formData } : null);
            setIsEditing(false);
            onSaved?.();
        }
        setSaving(false);
    };

    const tabs = [
        { id: 'info' as TabType, label: '기본 정보', icon: 'person' },
        { id: 'timeline' as TabType, label: '관리 이력', icon: 'history' },
        { id: 'payment' as TabType, label: '납부 현황', icon: 'payments' },
    ];

    if (!member && !loading) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogTitle className="sr-only">정보 없음</DialogTitle>
                    <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                        <MaterialIcon name="error_outline" size="xl" className="opacity-50 mb-2" />
                        <p>정보를 불러올 수 없습니다.</p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Added overflow-hidden to contain everything nicely */}
            <DialogContent
                className="w-full h-full max-w-none max-h-none h-screen sm:h-auto sm:max-h-[85vh] sm:max-w-2xl p-0 border-0 sm:border sm:border-white/[0.1] bg-[#0F151B] rounded-none sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 backdrop-blur-xl sm:top-[12vh] sm:translate-y-0"
                style={{
                    marginLeft: position.x,
                    marginTop: position.y
                }}
            >

                {/* 1. Header Area: Member Summary + Actions */}
                <div
                    className="shrink-0 px-6 pt-6 pb-5 flex items-start justify-between bg-[#0F151B] relative z-20 cursor-move select-none"
                    onPointerDown={handlePointerDown}
                >
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <DialogTitle className="text-white text-2xl font-bold leading-tight tracking-tight drop-shadow-md">
                                {member?.name || 'Loading...'}
                            </DialogTitle>
                            {member && (
                                <span className={cn(
                                    "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-sm",
                                    member.status === '정상'
                                        ? "bg-blue-500/20 border-blue-500/30 text-blue-300"
                                        : "bg-gray-500/20 border-gray-500/30 text-gray-300"
                                )}>
                                    {member.status || '미정'}
                                </span>
                            )}
                        </div>
                        <p className="text-gray-400 text-sm font-normal">
                            회원번호: <span className="text-gray-300 font-mono">{member?.member_number}</span>
                            {member?.unit_group && <span className="text-gray-500 mx-2">|</span>}
                            {member?.unit_group && <span className="text-gray-400">{member.unit_group}</span>}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {member && (
                            <Link
                                href={`/members/${member.id}`}
                                className="group p-2 rounded-full hover:bg-white/10 transition-colors flex items-center justify-center"
                                title="전체 페이지로 이동"
                            >
                                <MaterialIcon name="open_in_new" className="text-gray-400 group-hover:text-white transition-colors" size="sm" />
                            </Link>
                        )}
                        <button
                            onClick={handleClose}
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

                                            {/* LIGHTING EFFECT (Blue Gradient Line) */}
                                            <div className="absolute top-0 left-2 right-2 h-[2px] bg-gradient-to-r from-blue-400/0 via-blue-400 to-blue-400/0 opacity-70 z-20" />

                                            <div className="absolute bottom-0 -right-4 w-4 h-4 z-10 pointer-events-none"
                                                style={{ background: 'radial-gradient(circle at top right, transparent 16px, #1A2633 16.5px)' }} />

                                            {/* Active Content */}
                                            <div className="relative z-20 flex items-center gap-2">
                                                <MaterialIcon
                                                    name={tab.icon}
                                                    className="text-[18px] text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
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
                                    <MaterialIcon name="refresh" className="animate-spin" />
                                    <span className="text-xs font-bold">로딩 중...</span>
                                </div>
                            ) : (
                                <>
                                    {activeTab === 'info' && member && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {/* AI Insight Card */}
                                            <div className="mb-8 rounded-xl bg-gradient-to-br from-[#233040] to-[#1e2836] p-5 shadow-lg border border-white/5 relative overflow-hidden group">
                                                <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors"></div>
                                                <div className="flex items-center gap-2 mb-4 relative z-10">
                                                    <MaterialIcon name="smart_toy" className="text-blue-400 text-xl" />
                                                    <h3 className="text-white text-sm font-bold tracking-wide">AI 분석 인사이트</h3>
                                                </div>
                                                <div className="flex flex-wrap gap-2 relative z-10">
                                                    {(member.tags || ['#강성민원', '#납부약정']).map((tag, i) => (
                                                        <div key={i} className={cn(
                                                            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 border",
                                                            tag.includes('강성') ? "bg-red-500/10 border-red-500/20 text-red-200" :
                                                                tag.includes('납부') ? "bg-blue-500/10 border-blue-500/20 text-blue-200" :
                                                                    "bg-gray-700/50 border-gray-600/50 text-gray-300"
                                                        )}>
                                                            <MaterialIcon
                                                                name={tag.includes('강성') ? 'warning' : tag.includes('납부') ? 'thumb_up' : 'schedule'}
                                                                className={cn("text-[16px]", tag.includes('강성') ? "text-red-400" : tag.includes('납부') ? "text-blue-400" : "text-gray-400")}
                                                            />
                                                            <span className="text-xs font-bold">{tag}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Detail Info Section */}
                                            <div className="bg-[#233040] rounded-xl shadow-sm border border-white/5 p-6">
                                                <h3 className="text-white text-base font-bold mb-5 flex items-center gap-2">
                                                    <span className="w-1 h-4 bg-blue-500 rounded-full"></span>
                                                    상세 정보
                                                </h3>
                                                <div className="flex flex-col gap-0">
                                                    <InfoRow
                                                        icon="smartphone" label="휴대전화"
                                                        value={member.phone || '미입력'}
                                                        isEditing={isEditing}
                                                        editElement={<Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} />}
                                                    />
                                                    <InfoRow
                                                        icon="mail" label="이메일"
                                                        value={member.email || '미입력'}
                                                        isEditing={isEditing}
                                                        editElement={<Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} />}
                                                    />
                                                    <InfoRow
                                                        icon="home" label="현주소"
                                                        value={member.address_legal || '미입력'}
                                                        isEditing={isEditing}
                                                        editElement={<Input className="bg-[#1A2633] border-white/10 h-8 text-sm text-white" value={formData.address_legal || ''} onChange={e => setFormData({ ...formData, address_legal: e.target.value })} />}
                                                    />

                                                    <div className="flex flex-col gap-3 pt-4">
                                                        <div className="flex items-center gap-2">
                                                            <MaterialIcon name="sticky_note_2" className="text-yellow-500/70 text-[18px]" />
                                                            <p className="text-gray-400 text-xs font-medium">관리자 메모</p>
                                                        </div>
                                                        {isEditing ? (
                                                            <textarea
                                                                className="w-full h-24 rounded-lg bg-[#1A2633] border border-white/10 p-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-white resize-none"
                                                                value={formData.memo || ''}
                                                                onChange={e => setFormData({ ...formData, memo: e.target.value })}
                                                            />
                                                        ) : (
                                                            <div className="bg-yellow-900/10 border border-yellow-500/20 p-4 rounded-lg">
                                                                <p className="text-gray-200 text-sm leading-relaxed break-keep">
                                                                    {member.memo || '메모가 없습니다.'}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="shrink-0 flex items-center justify-between gap-3 pt-4">
                                                {isEditing ? (
                                                    <div className="flex gap-2 w-full justify-end">
                                                        <Button variant="ghost" onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-white">취소</Button>
                                                        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20">
                                                            {saving ? '저장 중...' : '저장 완료'}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        onClick={() => setIsEditing(true)}
                                                        className="w-full py-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 font-bold text-sm"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <MaterialIcon name="edit" size="sm" />
                                                            정보 수정
                                                        </div>
                                                    </Button>
                                                )}
                                            </div>

                                        </div>
                                    )}

                                    {activeTab === 'timeline' && memberId && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <ActivityTimelineTab memberId={memberId} />
                                        </div>
                                    )}

                                    {activeTab === 'payment' && memberId && (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <PaymentStatusTab memberId={memberId} memberName={member.name} />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function InfoRow({ icon, label, value, isEditing, editElement }: any) {
    return (
        <div className="grid grid-cols-[100px_1fr] items-center gap-4 border-b border-white/5 py-4 last:border-0">
            <div className="flex items-center gap-2">
                <MaterialIcon name={icon} className="text-gray-500 text-[18px]" />
                <p className="text-gray-400 text-xs font-medium">{label}</p>
            </div>
            {isEditing ? editElement : (
                <p className="text-gray-100 text-sm font-normal break-all">{value}</p>
            )}
        </div>
    );
}
