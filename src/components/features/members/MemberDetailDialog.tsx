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

    // Close button for mobile full screen
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
            <DialogContent className="w-full h-full max-w-none max-h-none h-screen sm:h-auto sm:max-h-[90vh] sm:max-w-2xl p-0 border-0 sm:border sm:border-border/50 bg-card rounded-none sm:rounded-lg shadow-none sm:shadow-2xl flex flex-col fixed inset-0 z-50 translate-x-0 translate-y-0 sm:fixed sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] gap-0">
                <DialogHeader className="p-4 sm:p-6 pb-3 border-b border-border/10 justify-center sm:justify-start">
                    <div className="flex items-center justify-between w-full">
                        <button
                            onClick={handleClose}
                            className="sm:hidden -ml-2 p-2 rounded-full hover:bg-muted/10 transition-colors"
                        >
                            <MaterialIcon name="arrow_back_ios_new" size="sm" />
                        </button>
                        <DialogTitle className="text-lg sm:text-2xl font-black text-foreground tracking-tight flex-1 text-center sm:text-left">
                            조합원 정보
                        </DialogTitle>
                        {member && (
                            <Link
                                href={`/members/${member.id}`}
                                className="flex items-center gap-2 text-xs font-bold text-primary hover:text-primary-hover transition-colors uppercase tracking-wide"
                            >
                                전체 페이지 <MaterialIcon name="open_in_new" size="xs" />
                            </Link>
                        )}
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
                        <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center animate-pulse">
                            <MaterialIcon name="refresh" className="text-primary animate-spin" size="sm" />
                        </div>
                        <p className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wide">데이터 로딩 중...</p>
                    </div>
                ) : member ? (
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {/* Profile Header (Desktop) */}
                        <div className="hidden sm:flex px-6 py-5 items-start justify-between">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2.5">
                                    <h2 className="text-2xl font-black text-foreground tracking-tight">{member.name}</h2>
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-bold text-success border border-success/30 uppercase tracking-wider badge-glow-success">
                                        <span className="size-1.5 rounded-full bg-success" />
                                        {member.status || '정상'}
                                    </span>
                                    <span className="inline-flex items-center rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-bold text-primary border border-primary/30 uppercase tracking-wider">
                                        {member.tier || '1차'}
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-muted-foreground/60 tracking-widest">
                                    권리증NO: <span className="text-foreground font-mono">{member.member_number}</span>
                                </p>
                            </div>
                            <Button
                                size="sm"
                                className="rounded-lg bg-white/5 border border-white/10 h-10 px-4 text-xs font-bold text-muted-foreground hover:bg-white/10 hover:text-foreground transition-all uppercase tracking-wide"
                                onClick={() => setIsEditing(!isEditing)}
                            >
                                {isEditing ? '취소' : '수정'}
                            </Button>
                        </div>

                        {/* Profile Header (Mobile) - Matching Design */}
                        <section className="sm:hidden flex flex-col items-center gap-6 pt-6 px-4 pb-4">
                            <div className="relative">
                                <div className="size-32 rounded-full p-1 bg-gradient-to-tr from-primary to-transparent">
                                    <div className="w-full h-full rounded-full bg-muted border-4 border-card overflow-hidden">
                                        {/* Placeholder for avatar image */}
                                        <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                                            <span className="text-4xl font-black text-muted-foreground/50">{member.name.charAt(0)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute -bottom-2 inset-x-0 flex justify-center">
                                    <span className="bg-amber-400 text-black text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-card uppercase tracking-wider shadow-sm">
                                        골드 등급
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-2 text-center w-full">
                                <h1 className="text-2xl font-bold text-foreground">{member.name}</h1>
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <span>회원번호: <span className="font-mono text-primary font-medium">#{member.member_number}</span></span>
                                    <span className="size-1 bg-muted-foreground/40 rounded-full"></span>
                                    <span>{member.unit_group || '402호'}</span>
                                </div>
                                <div className="mt-2 flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
                                    <MaterialIcon name="gavel" className="text-red-500" size="sm" />
                                    <span className="text-red-600 dark:text-red-400 font-bold text-sm uppercase tracking-wide">소송 진행 중</span>
                                </div>
                            </div>
                        </section>

                        {/* Mobile: Quick Actions & Tags (Visible on Mobile Only or Adaptive) */}
                        <div className="px-6 pb-2 sm:hidden flex flex-col gap-4">
                            {/* Quick Actions Grid */}
                            <div className="grid grid-cols-4 gap-3">
                                <QuickActionButton icon="call" label="전화" />
                                <QuickActionButton icon="chat_bubble" label="문자" />
                                <QuickActionButton icon="mail" label="이메일" />
                                <QuickActionButton icon="edit_note" label="기록" isPrimary />
                            </div>

                            {/* AI Tags Scroll */}
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
                                {(member.tags || ['#강성민원', '#납부약정', '#보수요청']).map((tag, i) => (
                                    <span key={i} className={cn(
                                        "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 border",
                                        tag.includes('강성') ? "bg-red-500/10 text-red-600 border-red-500/20" :
                                            tag.includes('약정') ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                                "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                    )}>
                                        <MaterialIcon name={tag.includes('강성') ? 'warning' : tag.includes('약정') ? 'handshake' : 'build'} size="xs" />
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="px-6 flex gap-3 border-b border-border/10">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={cn(
                                        "px-2 py-4 text-xs font-bold uppercase tracking-wider transition-all relative border-b-2 h-14",
                                        activeTab === tab.id
                                            ? "text-primary border-primary"
                                            : "text-muted-foreground/30 border-transparent hover:text-foreground"
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
                                                    <span className="text-xs font-bold text-muted-foreground/30 uppercase tracking-wide">등기여부:</span>
                                                    <span className={cn(
                                                        "px-2.5 py-1 rounded text-[10px] font-bold border tracking-wide",
                                                        member.is_registered
                                                            ? "bg-primary/10 text-primary border-primary/20"
                                                            : "bg-muted/10 text-muted-foreground/40 border-border/20"
                                                    )}>
                                                        {member.is_registered ? '등기완료' : '미등기'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-muted-foreground/30 uppercase tracking-wide">동 그룹:</span>
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
                <Label className="flex items-center gap-2 text-xs font-bold text-muted-foreground/30 uppercase tracking-wide ml-1">
                    <MaterialIcon name={icon} size="xs" /> {label}
                </Label>
                {editElement}
            </div>
        );
    }

    return (
        <div className="space-y-1 group/field">
            <h4 className="flex items-center gap-2 text-xs font-bold text-muted-foreground/30 uppercase tracking-wide ml-0.5">
                <MaterialIcon name={icon} size="xs" className="opacity-40 group-hover/field:opacity-100 transition-opacity" /> {label}
            </h4>
            <div className={cn(
                "text-sm tracking-tight pl-0.5 transition-colors",
                isSecondary ? "text-muted-foreground/40 font-medium text-xs leading-relaxed" : "text-foreground group-hover/field:text-primary",
                isMono && "font-mono"
            )}>
                {value}
            </div>
        </div>
    );
}

function QuickActionButton({ icon, label, isPrimary }: any) {
    return (
        <button className="flex flex-col items-center gap-2 group">
            <div className={cn(
                "size-12 rounded-full flex items-center justify-center transition-transform group-active:scale-95",
                isPrimary
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "bg-primary/5 text-primary hover:bg-primary/10"
            )}>
                <MaterialIcon name={icon} size="sm" />
            </div>
            <span className="text-xs font-bold text-muted-foreground">{label}</span>
        </button>
    );
}
