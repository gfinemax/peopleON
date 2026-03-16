'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MaterialIcon } from '@/components/ui/icon';
import {
    parseCertificateMeta,
    type AssetRight,
} from './memberDetailDialogUtils';
import type {
    MemberDetailDialogMember,
    MemberDetailDialogSaveFeedback,
} from './memberDetailDialogTypes';
import {
    MemberDetailDialogAdminEmptyState,
    MemberDetailDialogAdminSummary,
    MemberDetailDialogAdminToolbar,
    MemberDetailDialogCertificateReview,
    MemberDetailDialogRightsList,
} from './MemberDetailDialogAdminSections';

interface MemberDetailDialogAdminTabProps {
    member: MemberDetailDialogMember;
    formData: Partial<MemberDetailDialogMember>;
    isEditing: boolean;
    isAdmin: boolean;
    saving: boolean;
    deleting: boolean;
    canEditCertificateSummary: boolean;
    rightsFlowSummary: { rawCount: number; managedCount: number };
    managedCertificateNumbers: string[];
    sortedAssetRights: AssetRight[];
    manageableRights: AssetRight[];
    conflictRightNumbers: string[];
    selectedRightIds: string[];
    setSelectedRightIds: Dispatch<SetStateAction<string[]>>;
    isMerging: boolean;
    rightInput: string;
    setRightInput: Dispatch<SetStateAction<string>>;
    isAddingRight: boolean;
    saveFeedback: MemberDetailDialogSaveFeedback | null;
    setFormData: Dispatch<SetStateAction<Partial<MemberDetailDialogMember>>>;
    onStartEditing: () => void;
    onCancelEditing: () => void;
    onSave: () => void;
    onAddRight: () => void;
    onMergeSelectedRights: () => void;
    onDeleteRight: (rightId: string) => void;
    onRightChange: (rightId: string, field: string, value: string) => void;
    onShowLineage: (rightId: string) => void;
}

export function MemberDetailDialogAdminTab({
    member,
    formData,
    isEditing,
    isAdmin,
    saving,
    deleting,
    canEditCertificateSummary,
    rightsFlowSummary,
    managedCertificateNumbers,
    sortedAssetRights,
    manageableRights,
    conflictRightNumbers,
    selectedRightIds,
    setSelectedRightIds,
    isMerging,
    rightInput,
    setRightInput,
    isAddingRight,
    saveFeedback,
    setFormData,
    onStartEditing,
    onCancelEditing,
    onSave,
    onAddRight,
    onMergeSelectedRights,
    onDeleteRight,
    onRightChange,
    onShowLineage,
}: MemberDetailDialogAdminTabProps) {
    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
            <MemberDetailDialogAdminToolbar
                member={member}
                isEditing={isEditing}
                saving={saving}
                deleting={deleting}
                rightsFlowSummary={rightsFlowSummary}
                manageableRights={manageableRights}
                selectedRightIds={selectedRightIds}
                isMerging={isMerging}
                rightInput={rightInput}
                setRightInput={setRightInput}
                isAddingRight={isAddingRight}
                saveFeedback={saveFeedback}
                onStartEditing={onStartEditing}
                onCancelEditing={onCancelEditing}
                onSave={onSave}
                onAddRight={onAddRight}
                onMergeSelectedRights={onMergeSelectedRights}
            />

            <MemberDetailDialogAdminSummary
                rightsFlowSummary={rightsFlowSummary}
                managedCertificateNumbers={managedCertificateNumbers}
                sortedAssetRights={sortedAssetRights}
            />
            {member.assetRights && member.assetRights.length > 0 ? (
                <div className="space-y-6">
                    <MemberDetailDialogRightsList
                        member={member}
                        sortedAssetRights={sortedAssetRights}
                        manageableRights={manageableRights}
                        conflictRightNumbers={conflictRightNumbers}
                        selectedRightIds={selectedRightIds}
                        setSelectedRightIds={setSelectedRightIds}
                        isEditing={isEditing}
                        isAdmin={isAdmin}
                        onDeleteRight={onDeleteRight}
                        onRightChange={onRightChange}
                        onShowLineage={onShowLineage}
                    />
                    <MemberDetailDialogCertificateReview
                        member={member}
                        formData={formData}
                        isEditing={isEditing}
                        canEditCertificateSummary={canEditCertificateSummary}
                        setFormData={setFormData}
                    />
                </div>
            ) : (
                <MemberDetailDialogAdminEmptyState />
            )}
        </div>
    );
}

interface MemberDetailDialogLineageDialogProps {
    member: MemberDetailDialogMember | null;
    showLineageId: string | null;
    isMerging: boolean;
    onClose: () => void;
    onUnmerge: () => Promise<void>;
}

export function MemberDetailDialogLineageDialog({
    member,
    showLineageId,
    isMerging,
    onClose,
    onUnmerge,
}: MemberDetailDialogLineageDialogProps) {
    if (!member || !showLineageId) return null;

    const targetRight = member.assetRights?.find((right) => right.id === showLineageId);
    const meta = parseCertificateMeta(targetRight?.right_number_note);
    const sources = member.assetRights?.filter((right) => {
        const sourceMeta = parseCertificateMeta(right.right_number_note);
        return sourceMeta.parent_right_id === showLineageId;
    }) || [];

    return (
        <Dialog open={Boolean(showLineageId)} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-[#1A2633] border-white/10 text-white p-6 shadow-2xl rounded-2xl z-[100]">
                <DialogTitle className="text-xl font-bold flex items-center gap-2 mb-4">
                    <MaterialIcon name="account_tree" className="text-purple-400" />
                    권리 흐름
                </DialogTitle>
                <div className="space-y-4">
                    <div className="bg-slate-900/50 rounded-xl p-4 border border-white/5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[40px] rounded-full pointer-events-none"></div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">통합 관리번호</p>
                        <p className="text-xl font-mono font-black text-purple-400 drop-shadow-md">
                            {targetRight?.right_number || targetRight?.right_number_raw}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/80">
                                {sources.length}원천 → 1관리번호
                            </span>
                            <span className="rounded border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                                원천 {sources.length}개
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2 font-medium">
                            통합일시: {typeof meta.merged_at === 'string' ? new Date(meta.merged_at).toLocaleString() : '정보 없음'}
                        </p>
                    </div>
                    <div className="space-y-2 relative">
                        <div className="absolute left-4 top-[-10px] bottom-4 w-px bg-white/10 pointer-events-none"></div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-2 pl-2">
                            <MaterialIcon name="subdirectory_arrow_right" size="xs" className="text-gray-600" />
                            원천 권리증 목록
                        </p>
                        {sources.length > 0 ? sources.map((source) => {
                            const sourceMeta = parseCertificateMeta(source.right_number_note);
                            return (
                                <div key={source.id} className="bg-white/5 rounded-lg p-3 flex items-center justify-between border border-white/5 relative ml-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-mono font-bold text-gray-200">{source.right_number || source.right_number_raw}</span>
                                        {typeof sourceMeta.original_owner_name === 'string' ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300 font-bold bg-emerald-500/10 px-2 py-1 rounded w-fit border border-emerald-500/20">
                                                <MaterialIcon name="person" size="xs" />
                                                기존 소유자 {sourceMeta.original_owner_name}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[9px] px-1.5 py-0.5 bg-sky-500/10 text-sky-300 rounded border border-sky-500/20 font-bold inline-block">
                                            원천 보존
                                        </span>
                                    </div>
                                </div>
                            );
                        }) : (
                            <p className="text-xs text-gray-500 py-4 text-center ml-4 border border-dashed border-white/10 rounded-lg">
                                원천 정보(자식 노드)를 찾을 수 없습니다.
                            </p>
                        )}
                    </div>
                </div>
                <div className="mt-6 flex justify-between items-center gap-3 pt-4 border-t border-white/10">
                    <div className="text-[11px] text-gray-400 font-medium">
                        {sources.length > 0 ? `통합 해제 시 원천 권리증 ${sources.length}개가 다시 분리됩니다.` : '통합 해제 시 원천 권리증이 다시 분리됩니다.'}
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onUnmerge}
                        className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs h-8"
                        disabled={isMerging}
                    >
                        <MaterialIcon name="link_off" size="xs" className="mr-1" />
                        통합 해제
                    </Button>
                    <Button size="sm" onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold h-8 px-5">
                        닫기
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
