'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
    CERTIFICATE_SUMMARY_STATUS_LABEL,
    getRightsFlowHeadline,
    type AssetRight,
} from './memberDetailDialogUtils';
import type {
    MemberDetailDialogMember,
    MemberDetailDialogSaveFeedback,
} from './memberDetailDialogTypes';

const FEEDBACK_TONE_CLASSNAME: Record<MemberDetailDialogSaveFeedback['tone'], string> = {
    success: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200',
    warn: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
    error: 'border-rose-400/20 bg-rose-500/10 text-rose-200',
};

interface MemberDetailDialogAdminToolbarProps {
    member: MemberDetailDialogMember;
    isEditing: boolean;
    saving: boolean;
    deleting: boolean;
    rightsFlowSummary: { rawCount: number; managedCount: number };
    manageableRights: AssetRight[];
    selectedRightIds: string[];
    isMerging: boolean;
    rightInput: string;
    setRightInput: Dispatch<SetStateAction<string>>;
    isAddingRight: boolean;
    saveFeedback: MemberDetailDialogSaveFeedback | null;
    onStartEditing: () => void;
    onCancelEditing: () => void;
    onSave: () => void;
    onAddRight: () => void;
    onMergeSelectedRights: () => void;
}

export function MemberDetailDialogAdminToolbar({
    member,
    isEditing,
    saving,
    deleting,
    rightsFlowSummary,
    manageableRights,
    selectedRightIds,
    isMerging,
    rightInput,
    setRightInput,
    isAddingRight,
    saveFeedback,
    onStartEditing,
    onCancelEditing,
    onSave,
    onAddRight,
    onMergeSelectedRights,
}: MemberDetailDialogAdminToolbarProps) {
    return (
        <div className="sticky top-0 z-20 -mx-6 border-b border-white/5 bg-[#1A2633]/95 px-6 py-4 backdrop-blur-md">
            <div className="space-y-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-400">권리증 작업</span>
                            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-sm font-bold text-white">
                                {getRightsFlowHeadline(rightsFlowSummary.rawCount, rightsFlowSummary.managedCount)}
                            </span>
                            <span className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] font-bold text-slate-300">
                                원천 {rightsFlowSummary.rawCount}
                            </span>
                            <span className="rounded-md border border-emerald-400/15 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-200">
                                관리 {rightsFlowSummary.managedCount}
                            </span>
                            <span className="rounded-md border border-sky-500/15 bg-sky-500/10 px-2 py-1 text-[11px] font-bold text-sky-200">
                                등록 {member.assetRights?.length || 0} row
                            </span>
                        </div>
                        <p className="text-xs text-slate-400">
                            먼저 권리증번호를 수정하고 저장한 뒤, 아래에서 원천과 관리번호 흐름을 검토합니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onStartEditing}
                            disabled={isEditing}
                            className="h-8 border-white/10 bg-white/5 text-[11px] font-bold text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-50"
                        >
                            <MaterialIcon name="edit" size="xs" className="mr-1.5" />
                            권리 수정
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onCancelEditing}
                            disabled={!isEditing}
                            className="h-8 px-3 text-[11px] text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-40"
                        >
                            취소
                        </Button>
                        <Button
                            size="sm"
                            onClick={onSave}
                            disabled={!isEditing || saving || deleting}
                            className="h-8 bg-blue-600 px-3 text-[11px] font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 disabled:opacity-50"
                        >
                            {saving ? '저장...' : '저장'}
                        </Button>
                        {manageableRights.length > 1 ? (
                            <Button
                                size="sm"
                                onClick={onMergeSelectedRights}
                                className="h-8 bg-blue-600 text-[11px] font-bold hover:bg-blue-500"
                                disabled={isMerging || selectedRightIds.length < 2}
                            >
                                {isMerging
                                    ? '통합 중...'
                                    : selectedRightIds.length >= 2
                                      ? `${selectedRightIds.length}개 선택 - 통합하기`
                                      : '선택 권리증 통합'}
                            </Button>
                        ) : null}
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="rounded-xl border border-sky-500/20 bg-[#162234] px-4 py-3">
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-sky-400">권리증 추가</p>
                        <div className="flex gap-3">
                            <Input
                                value={rightInput}
                                onChange={(event) => setRightInput(event.target.value)}
                                placeholder="권리증 번호 입력"
                                className="h-9 border-slate-700 bg-slate-900 font-mono text-sm text-sky-100"
                                onKeyDown={(event) => event.key === 'Enter' && onAddRight()}
                            />
                            <Button
                                onClick={onAddRight}
                                disabled={isAddingRight || !rightInput.trim()}
                                className="h-9 shrink-0 gap-1.5 bg-sky-600 text-white hover:bg-sky-500"
                                size="sm"
                            >
                                <MaterialIcon name="add_circle" size="xs" />
                                <span className="whitespace-nowrap text-xs font-bold">추가</span>
                            </Button>
                        </div>
                    </div>
                    <div className="flex min-w-[220px] flex-col justify-center rounded-xl border border-white/10 bg-[#162234] px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">관리 수 상태</span>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            <span className="rounded border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-200">
                                {CERTIFICATE_SUMMARY_STATUS_LABEL[member.certificate_summary_review_status || 'pending']}
                            </span>
                            <span className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 font-bold text-slate-300">
                                최종 {member.effective_certificate_count || 0}개
                            </span>
                            {(member.certificate_summary_conflict_count || 0) > 0 ? (
                                <span className="rounded border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 font-bold text-amber-200">
                                    충돌 {member.certificate_summary_conflict_count}건
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
                {isEditing ? (
                    <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100">
                        권리증번호를 우선 수정하고 저장하세요. 저장 후 목록과 상세 번호가 다시 계산됩니다.
                    </div>
                ) : null}
                {saveFeedback ? (
                    <div className={cn('rounded-xl border px-4 py-3 text-xs font-semibold', FEEDBACK_TONE_CLASSNAME[saveFeedback.tone])}>
                        {saveFeedback.message}
                    </div>
                ) : null}
                {manageableRights.length > 1 ? (
                    <div className="rounded-xl border border-blue-500/15 bg-blue-500/5 px-4 py-3 text-xs text-blue-100">
                        통합할 권리증을 체크한 뒤 `선택 권리증 통합`을 누르세요.
                    </div>
                ) : null}
            </div>
        </div>
    );
}
