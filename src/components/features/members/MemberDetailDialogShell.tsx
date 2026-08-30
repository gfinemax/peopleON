'use client';

import type { Dispatch, SetStateAction } from 'react';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { ActivityTimelineTab } from './ActivityTimelineTab';
import { PaymentStatusTab } from './PaymentStatusTab';
import { MemberDetailDialogAdminTab } from './MemberDetailDialogAdmin';
import type {
    MemberDetailDialogMember,
    MemberDetailDialogSaveFeedback,
    TabType,
} from './memberDetailDialogTypes';
import type { AssetRight } from './memberDetailDialogUtils';
import {
    type MemberWorkspaceColumnId,
} from './memberWorkspacePresets';
import { MemberWorkspaceBoard } from './MemberWorkspacePage';

export const MEMBER_DETAIL_DIALOG_TABS: Array<{
    id: TabType;
    label: string;
    icon: string;
}> = [
    { id: 'info', label: '통합정보', icon: 'person' },
    { id: 'timeline', label: '상담·활동', icon: 'history' },
    { id: 'payment', label: '납부·정산', icon: 'payments' },
    { id: 'admin', label: '가입신청필증', icon: 'description' },
];

interface MemberDetailDialogTabBarProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

function MemberDetailDialogTabBar({
    activeTab,
    onTabChange,
}: MemberDetailDialogTabBarProps) {
    return (
        <div className="relative z-10 flex items-end overflow-x-auto px-2 scrollbar-thin scrollbar-thumb-white/10 sm:px-4" role="tablist" aria-label="조합원 통합정보 메뉴">
            {MEMBER_DETAIL_DIALOG_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        role="tab"
                        aria-selected={isActive}
                        className={cn(
                            'relative group flex items-center justify-center pb-3 outline-none transition-all',
                            isActive
                                ? 'min-w-[96px] px-3 pt-3.5 z-20'
                                : 'min-w-[96px] px-3 pt-4 text-gray-500 hover:text-gray-300 z-10 sm:min-w-[110px] sm:px-6',
                        )}
                    >
                        {isActive ? (
                            <>
                                <div
                                    className="absolute bottom-0 -left-4 z-10 h-4 w-4 pointer-events-none"
                                    style={{
                                        background:
                                            'radial-gradient(circle at top left, transparent 16px, #1A2633 16.5px)',
                                    }}
                                />
                                <div className="absolute inset-0 z-0 rounded-t-xl bg-[#1A2633] shadow-[-1px_-1px_0_rgba(255,255,255,0.05)]" />
                                <div className="absolute top-0 left-2 right-2 z-20 h-[2px] bg-gradient-to-r from-blue-400/0 via-blue-400 to-blue-400/0 opacity-70" />
                                <div
                                    className="absolute bottom-0 -right-4 z-10 h-4 w-4 pointer-events-none"
                                    style={{
                                        background:
                                            'radial-gradient(circle at top right, transparent 16px, #1A2633 16.5px)',
                                    }}
                                />
                                <div className="relative z-20 flex items-center gap-2">
                                    <MaterialIcon name={tab.icon} className="text-[18px] text-blue-400" />
                                    <p className="text-sm font-bold tracking-wide text-white">{tab.label}</p>
                                </div>
                            </>
                        ) : (
                            <div className="relative z-10 flex items-center gap-2">
                                <MaterialIcon name={tab.icon} className="text-[18px]" />
                                <p className="text-xs font-semibold">{tab.label}</p>
                            </div>
                        )}
                    </button>
                );
            })}
            <div className="absolute bottom-0 left-0 right-0 z-0 h-[1px] bg-[#1A2633]" />
        </div>
    );
}

interface MemberDetailDialogBodyProps {
    loading: boolean;
    memberIds: string[] | null;
    member: MemberDetailDialogMember | null;
    formData: Partial<MemberDetailDialogMember>;
    isEditing: boolean;
    setFormData: Dispatch<SetStateAction<Partial<MemberDetailDialogMember>>>;
    saveFeedback: MemberDetailDialogSaveFeedback | null;
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
    visibleWorkspaceColumns: MemberWorkspaceColumnId[];
    onTabChange: (tab: TabType) => void;
    onStartEditing: () => void;
    onCancelEditing: () => void;
    onSave: () => void;
    onAddRight: () => void;
    onMergeSelectedRights: () => void;
    onDeleteRight: (rightId: string) => void;
    onRightChange: (rightId: string, field: string, value: string) => void;
    onShowLineage: (rightId: string) => void;
    onMemberCategoryChange?: (value: string) => Promise<void>;
    workspaceEditingSection?: 'profile' | 'relations' | null;
    workspaceFocusTab?: TabType | null;
    onWorkspaceEditingSectionChange?: (section: 'profile' | 'relations' | null) => void;
    onWorkspaceFocusTabChange?: (tab: TabType | null) => void;
    onWorkspaceFieldChange?: (field: keyof MemberDetailDialogMember, value: unknown) => void;
    onWorkspaceSave?: () => Promise<boolean>;
    onWorkspaceCancel?: () => void;
}

export function MemberDetailDialogBody({
    loading,
    memberIds,
    member,
    formData,
    isEditing,
    setFormData,
    saveFeedback,
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
    visibleWorkspaceColumns,
    onTabChange,
    onStartEditing,
    onCancelEditing,
    onSave,
    onAddRight,
    onMergeSelectedRights,
    onDeleteRight,
    onRightChange,
    onShowLineage,
    onMemberCategoryChange,
    workspaceEditingSection,
    workspaceFocusTab,
    onWorkspaceEditingSectionChange,
    onWorkspaceFocusTabChange,
    onWorkspaceFieldChange,
    onWorkspaceSave,
    onWorkspaceCancel,
}: MemberDetailDialogBodyProps) {
    if (loading || !member || !memberIds) return <div className="flex min-h-[520px] items-center justify-center bg-[#071e32] text-xs font-bold text-slate-500">조합원 작업대를 불러오는 중...</div>;

    const handleWorkspaceTabChange = (tab: TabType) => {
        onTabChange(tab);
        if (tab === 'info') {
            onWorkspaceCancel?.();
            onCancelEditing();
            onWorkspaceFocusTabChange?.(null);
            return;
        }

        onWorkspaceFocusTabChange?.(tab);
        if (tab === 'admin') onStartEditing();
        else onCancelEditing();
    };

    if (workspaceFocusTab && workspaceFocusTab !== 'info') {
        const focusTab = MEMBER_DETAIL_DIALOG_TABS.find((tab) => tab.id === workspaceFocusTab);
        return (
                <div className="flex min-h-[620px] flex-1 flex-col bg-[#071e32]">
                    <div className="border-y border-white/[0.075] bg-[#0a2840] px-3 py-3 sm:px-5">
                        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onWorkspaceCancel?.();
                                        onCancelEditing();
                                        onWorkspaceFocusTabChange?.(null);
                                    }}
                                    className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-[#071e32] px-3 text-xs font-bold text-slate-300 transition-colors hover:border-cyan-400/30 hover:text-white"
                                >
                                    <MaterialIcon name="arrow_back" size="xs" />
                                    <span className="hidden sm:inline">통합현황으로</span>
                                    <span className="sm:hidden">뒤로</span>
                                </button>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-black text-white">{focusTab?.label}</p>
                                    <p className="truncate text-[11px] text-slate-500">{member.name} 조합원 상세 관리</p>
                                </div>
                            </div>
                            {workspaceFocusTab === 'admin' && isEditing ? (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onWorkspaceCancel?.();
                                            onCancelEditing();
                                        }}
                                        disabled={saving}
                                        className="h-9 rounded-lg border border-white/10 px-3 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-50"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onSave}
                                        disabled={saving}
                                        className="inline-flex h-9 items-center gap-1 rounded-lg bg-blue-600 px-4 text-xs font-black text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
                                    >
                                        {saving ? <MaterialIcon name="progress_activity" size="xs" className="animate-spin" /> : <MaterialIcon name="save" size="xs" />}
                                        저장
                                    </button>
                                </div>
                            ) : workspaceFocusTab === 'admin' ? (
                                <button
                                    type="button"
                                    onClick={onStartEditing}
                                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-cyan-400/20 bg-cyan-500/10 px-4 text-xs font-black text-cyan-200 transition-colors hover:bg-cyan-500/15"
                                >
                                    <MaterialIcon name="edit" size="xs" />
                                    가입신청필증 수정
                                </button>
                            ) : null}
                        </div>
                    </div>

                    <div className="border-b border-white/[0.075] bg-[#081f33]">
                        <div className="mx-auto max-w-[1400px]">
                            <MemberDetailDialogTabBar activeTab={workspaceFocusTab} onTabChange={handleWorkspaceTabChange} />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-white/10 sm:p-5 lg:p-6">
                        <div className="mx-auto max-w-[1400px]">
                            {workspaceFocusTab === 'admin' ? (
                                <MemberDetailDialogAdminTab
                                    member={member}
                                    formData={formData}
                                    isEditing={isEditing}
                                    isAdmin={isAdmin}
                                    saving={saving}
                                    deleting={deleting}
                                    canEditCertificateSummary={canEditCertificateSummary}
                                    rightsFlowSummary={rightsFlowSummary}
                                    managedCertificateNumbers={managedCertificateNumbers}
                                    sortedAssetRights={sortedAssetRights}
                                    manageableRights={manageableRights}
                                    conflictRightNumbers={conflictRightNumbers}
                                    selectedRightIds={selectedRightIds}
                                    setSelectedRightIds={setSelectedRightIds}
                                    isMerging={isMerging}
                                    rightInput={rightInput}
                                    setRightInput={setRightInput}
                                    isAddingRight={isAddingRight}
                                    saveFeedback={saveFeedback}
                                    setFormData={setFormData}
                                    onStartEditing={onStartEditing}
                                    onCancelEditing={onCancelEditing}
                                    onSave={onSave}
                                    onAddRight={onAddRight}
                                    onMergeSelectedRights={onMergeSelectedRights}
                                    onDeleteRight={onDeleteRight}
                                    onRightChange={onRightChange}
                                    onShowLineage={onShowLineage}
                                />
                            ) : null}
                            {workspaceFocusTab === 'timeline' ? (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <ActivityTimelineTab memberIds={memberIds} />
                                </div>
                            ) : null}
                            {workspaceFocusTab === 'payment' ? (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <PaymentStatusTab
                                        memberIds={memberIds}
                                        memberName={member.name ?? ''}
                                        unitGroup={member.unit_group}
                                        memberTiers={member.tiers}
                                        isRegistered={member.is_registered}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>
        );
    }

    return (
        <MemberWorkspaceBoard
                memberIds={memberIds}
                member={member}
                formData={formData}
                columns={visibleWorkspaceColumns}
                onOpenManagement={(tab) => {
                    onTabChange(tab);
                    onWorkspaceFocusTabChange?.(tab);
                    if (tab === 'admin') onStartEditing();
                    else onCancelEditing();
                }}
                onMemberCategoryChange={onMemberCategoryChange}
                editingSection={workspaceEditingSection}
                onEditingSectionChange={onWorkspaceEditingSectionChange}
                onFieldChange={onWorkspaceFieldChange}
                onSave={onWorkspaceSave}
                onCancel={onWorkspaceCancel}
                saving={saving}
                saveFeedback={saveFeedback}
        />
    );
}
