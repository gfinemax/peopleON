'use client';

import type { Dispatch, SetStateAction } from 'react';
import Link from 'next/link';
import { DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type {
    MemberDetailDialogMember,
} from './memberDetailDialogTypes';
export { MemberDetailDialogInfoTab } from './MemberDetailDialogInfoTabSections';

const TIER_PRIORITY: Record<string, number> = {
    '등기조합원': 1,
    '지주조합원': 2,
    '2차': 3,
    '일반분양': 4,
    '예비조합원': 5,
    '권리증보유자': 6,
    '지주': 7,
    '대리인': 8,
    '관계인': 9,
};

function getTierDisplay(tier: string) {
    if (tier === '등기조합원') return '조합원(등기)';
    if (tier === '지주조합원') return '조합원(지주)';
    if (tier === '2차') return '조합원(2차)';
    if (tier === '일반분양') return '조합원(일반분양)';
    if (tier === '예비조합원') return '조합원(예비)';
    if (tier === '지주') return '원지주';
    if (tier === '권리증보유자') return '권리증보유';
    return tier;
}

function getMemberTiers(member: MemberDetailDialogMember) {
    const tiers = [...(member.tiers || [])];
    if (member.acts_as_agent_for?.length && !tiers.includes('대리인')) {
        tiers.push('대리인');
    }

    return tiers
        .map((tier) => ({ tier, priority: TIER_PRIORITY[tier] || 99 }))
        .sort((left, right) => left.priority - right.priority)
        .map(({ tier }) => tier);
}

interface MemberDetailDialogHeaderProps {
    member: MemberDetailDialogMember | null;
    formData: Partial<MemberDetailDialogMember>;
    isEditing: boolean;
    saving: boolean;
    deleting: boolean;
    onStartEditing: () => void;
    onCancelEditing: () => void;
    onSave: () => void;
    onDelete: () => void;
    onClose: () => void;
    setFormData: Dispatch<SetStateAction<Partial<MemberDetailDialogMember>>>;
}

export function MemberDetailDialogHeader({
    member,
    formData,
    isEditing,
    saving,
    deleting,
    onStartEditing,
    onCancelEditing,
    onSave,
    onDelete,
    onClose,
    setFormData,
}: MemberDetailDialogHeaderProps) {
    return (
        <div className="relative z-20 flex shrink-0 items-start justify-between bg-[#0F151B] px-6 pt-6 pb-1 select-none cursor-move">
            <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-3">
                    <DialogTitle className="flex items-center gap-2 text-2xl font-bold leading-tight tracking-tight text-white drop-shadow-md">
                        {isEditing ? (
                            <Input
                                className="h-9 max-w-[200px] border-emerald-500/30 bg-[#1A2633] text-xl font-bold text-white"
                                value={formData.name || ''}
                                onChange={(event) =>
                                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                                }
                                autoFocus
                            />
                        ) : (
                            member?.name || 'Loading...'
                        )}
                    </DialogTitle>
                    {member ? (
                        <span
                            className={cn(
                                'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-sm',
                                member.status === '정상'
                                    ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300'
                                    : member.status === '차명'
                                      ? 'border-sky-500/30 bg-sky-500/20 text-sky-300'
                                      : 'border-gray-500/30 bg-gray-500/20 text-gray-300',
                            )}
                        >
                            {member.status === '차명' ? '명의대여' : member.status || '미정'}
                        </span>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                        {member
                            ? getMemberTiers(member).map((tier, index) => (
                                  <span
                                      key={`${member.id}-${tier}-${index}`}
                                      className="inline-flex items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300 backdrop-blur-sm"
                                  >
                                      {getTierDisplay(tier)}
                                  </span>
                              ))
                            : null}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {isEditing ? (
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCancelEditing}
                            className="h-8 px-3 text-xs text-gray-400 hover:bg-white/5 hover:text-white"
                        >
                            취소
                        </Button>
                        <Button
                            size="sm"
                            onClick={onSave}
                            disabled={saving || deleting}
                            className="h-8 bg-blue-600 px-3 text-xs font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500"
                        >
                            {saving ? '저장...' : '저장'}
                        </Button>
                    </>
                ) : (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onDelete}
                            disabled={deleting || !member}
                            className="h-8 border-rose-500/20 bg-rose-500/10 px-3 text-xs font-bold text-rose-200 hover:bg-rose-500/20 hover:text-rose-100"
                        >
                            <MaterialIcon name="delete" size="xs" className="mr-1.5" />
                            {deleting ? '삭제 중...' : '인물 삭제'}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onStartEditing}
                            disabled={deleting}
                            className="h-8 border-white/10 bg-white/5 px-3 text-xs font-bold text-gray-300 hover:bg-white/10 hover:text-white"
                        >
                            <MaterialIcon name="edit" size="xs" className="mr-1.5" />
                            정보 수정
                        </Button>
                    </>
                )}
                <Link
                    href={`/members/${member?.id}`}
                    className="group flex items-center justify-center rounded-full p-2 transition-colors hover:bg-white/10"
                    title="전체 페이지로 이동"
                >
                    <MaterialIcon
                        name="open_in_new"
                        className="text-gray-400 transition-colors group-hover:text-white"
                        size="sm"
                    />
                </Link>
                <button
                    onClick={onClose}
                    className="group flex items-center justify-center rounded-full p-2 transition-colors hover:bg-white/10"
                >
                    <MaterialIcon
                        name="close"
                        className="text-gray-400 transition-colors group-hover:text-white"
                        size="sm"
                    />
                </button>
            </div>
        </div>
    );
}
