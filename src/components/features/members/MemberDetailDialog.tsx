import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    address: string | null;
    tier: string | null;
    status: string | null;
    is_registered: boolean;
    unit_group: string | null;
    notes: string | null;
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

    useEffect(() => {
        if (open && memberId) {
            fetchMember(memberId);
            setActiveTab('info');
        }
    }, [open, memberId]);

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
                address: formData.address,
                notes: formData.notes,
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
        { id: 'info' as TabType, label: '기본 정보' },
        { id: 'timeline' as TabType, label: '관리 이력' },
        { id: 'payment' as TabType, label: '납부 현황' },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 border border-border/50 bg-card rounded-xl shadow-2xl">
                <DialogHeader className="p-6 pb-3 border-b border-border/10">
                    <div className="flex items-center justify-between">
                        <DialogTitle className="text-2xl font-black text-foreground tracking-tight">
                            조합원 정보
                        </DialogTitle>
                        {member && (
                            <Link
                                href={`/members/${member.id}`}
                                className="flex items-center gap-2 text-[11px] font-black text-primary hover:underline underline-offset-4 uppercase tracking-widest transition-all"
                            >
                                전체 페이지 <MaterialIcon name="open_in_new" size="xs" />
                            </Link>
                        )}
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
                            <MaterialIcon name="refresh" className="text-primary animate-spin" size="sm" />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">데이터 로딩 중...</p>
                    </div>
                ) : member ? (
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {/* Profile Header */}
                        <div className="px-6 py-5 flex items-start justify-between">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2.5">
                                    <h2 className="text-2xl font-black text-foreground tracking-tight">{member.name}</h2>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-0.5 text-[9px] font-black text-success border border-success/20 uppercase tracking-widest">
                                        <span className="size-1.5 rounded-full bg-success animate-pulse" />
                                        {member.status || '정상'}
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[9px] font-black text-blue-400 border border-blue-500/20 uppercase tracking-widest">
                                        {member.tier || '1차'}
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-muted-foreground/60 tracking-widest">
                                    권리증NO: <span className="text-foreground font-mono">{member.member_number}</span>
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="rounded-lg bg-muted/10 border border-border h-9 px-4 text-[10px] font-black text-foreground hover:bg-muted/20 transition-all uppercase tracking-widest"
                                onClick={() => setIsEditing(!isEditing)}
                            >
                                {isEditing ? '취소' : '수정'}
                            </Button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="px-6 flex gap-3 border-b border-border/10">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "px-2 py-3 text-[11px] font-black uppercase tracking-widest transition-all relative border-b-2",
                                        activeTab === tab.id
                                            ? "text-primary border-primary"
                                            : "text-muted-foreground/40 border-transparent hover:text-foreground"
                                    )}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 py-5 scrollbar-thin scrollbar-thumb-border/20">
                            {activeTab === 'info' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                                        <InfoField
                                            icon="call"
                                            label="전화번호"
                                            isEditing={isEditing}
                                            value={member.phone || '미입력'}
                                            editElement={
                                                <Input
                                                    className="h-10 rounded-lg bg-muted/10 border-border"
                                                    value={formData.phone || ''}
                                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                    placeholder="010-0000-0000"
                                                />
                                            }
                                        />
                                        <InfoField
                                            icon="mail"
                                            label="이메일"
                                            isEditing={isEditing}
                                            value={member.email || '미입력'}
                                            editElement={
                                                <Input
                                                    className="h-10 rounded-lg bg-muted/10 border-border"
                                                    value={formData.email || ''}
                                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                    placeholder="email@example.com"
                                                />
                                            }
                                        />
                                        <div className="col-span-2">
                                            <InfoField
                                                icon="location_on"
                                                label="주소"
                                                isEditing={isEditing}
                                                value={member.address || '미입력'}
                                                editElement={
                                                    <Input
                                                        className="h-10 rounded-lg bg-muted/10 border-border"
                                                        value={formData.address || ''}
                                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                                        placeholder="주소를 입력하세요"
                                                    />
                                                }
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <InfoField
                                                icon="notes"
                                                label="비고"
                                                isEditing={isEditing}
                                                value={member.notes || '메모 없음'}
                                                isSecondary
                                                editElement={
                                                    <textarea
                                                        className="w-full h-20 rounded-lg bg-muted/10 border border-border p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all resize-none"
                                                        value={formData.notes || ''}
                                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                                        placeholder="메모를 입력하세요"
                                                    />
                                                }
                                            />
                                        </div>
                                    </div>

                                    {isEditing && (
                                        <div className="flex justify-end gap-2 pt-3 border-t border-border/10">
                                            <Button
                                                variant="ghost"
                                                className="rounded-lg font-black text-xs uppercase"
                                                onClick={() => setIsEditing(false)}
                                            >
                                                취소
                                            </Button>
                                            <Button
                                                className="rounded-lg bg-primary px-6 font-black text-xs uppercase shadow-md shadow-primary/20"
                                                onClick={handleSave}
                                                disabled={saving}
                                            >
                                                {saving ? '저장 중...' : '변경 사항 저장'}
                                            </Button>
                                        </div>
                                    )}

                                    {!isEditing && (
                                        <>
                                            <div className="h-px bg-border/20 w-full" />
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">등기여부:</span>
                                                    <span className={cn(
                                                        "px-2.5 py-1 rounded text-[9px] font-black border tracking-widest",
                                                        member.is_registered
                                                            ? "bg-primary/10 text-primary border-primary/20"
                                                            : "bg-muted/10 text-muted-foreground/40 border-border/20"
                                                    )}>
                                                        {member.is_registered ? '등기완료' : '미등기'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">동 그룹:</span>
                                                    <span className="text-sm font-bold text-foreground/80">{member.unit_group || '미지정'}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {activeTab === 'timeline' && memberId && (
                                <ActivityTimelineTab memberId={memberId} />
                            )}

                            {activeTab === 'payment' && memberId && (
                                <PaymentStatusTab memberId={memberId} memberName={member.name} />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-20 gap-4">
                        <MaterialIcon name="error_outline" size="xl" className="text-muted-foreground/20" />
                        <p className="text-sm font-bold text-muted-foreground">조합원 정보를 불러올 수 없습니다.</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function InfoField({ icon, label, value, isEditing, editElement, isSecondary = false, isMono = false }: any) {
    if (isEditing) {
        return (
            <div className="space-y-3">
                <Label className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest ml-1">
                    <MaterialIcon name={icon} size="xs" /> {label}
                </Label>
                {editElement}
            </div>
        );
    }

    return (
        <div className="space-y-1 group/field">
            <h4 className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-0.5">
                <MaterialIcon name={icon} size="xs" className="opacity-40 group-hover/field:opacity-100 transition-opacity" /> {label}
            </h4>
            <div className={cn(
                "text-sm font-black tracking-wide pl-0.5 transition-colors",
                isSecondary ? "text-muted-foreground/60 font-medium text-xs leading-relaxed" : "text-foreground group-hover/field:text-primary",
                isMono && "font-mono"
            )}>
                {value}
            </div>
        </div>
    );
}
