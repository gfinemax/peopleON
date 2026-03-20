'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { MaterialIcon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { ActivityTimelineTab } from './ActivityTimelineTab';
import { PaymentStatusTab } from './PaymentStatusTab';
import { MemberDetailDialogAdminTab } from './MemberDetailDialogAdmin';
import { MemberDetailDialogInfoTab } from './MemberDetailDialogInfoSections';
import type {
    MemberDetailDialogMember,
    MemberDetailDialogSaveFeedback,
    TabType,
} from './memberDetailDialogTypes';
import type { AssetRight } from './memberDetailDialogUtils';

export const MEMBER_DETAIL_DIALOG_TABS: Array<{
    id: TabType;
    label: string;
    icon: string;
}> = [
    { id: 'info', label: '기본', icon: 'person' },
    { id: 'timeline', label: '이력', icon: 'history' },
    { id: 'payment', label: '납부', icon: 'payments' },
    { id: 'admin', label: '권리증', icon: 'description' },
];

interface MemberDetailDialogEmptyStateProps {
    open: boolean;
    onOpenChange: (nextOpen: boolean) => void;
}

export function MemberDetailDialogEmptyState({
    open,
    onOpenChange,
}: MemberDetailDialogEmptyStateProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogTitle className="sr-only">정보 없음</DialogTitle>
                <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                    <MaterialIcon name="error_outline" size="xl" className="mb-2 opacity-50" />
                    <p>정보를 불러올 수 없습니다.</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}

interface MemberDetailDialogTabBarProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

function MemberDetailDialogTabBar({
    activeTab,
    onTabChange,
}: MemberDetailDialogTabBarProps) {
    return (
        <div className="relative z-10 flex items-end px-4">
            {MEMBER_DETAIL_DIALOG_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={cn(
                            'relative group flex items-center justify-center pb-3 outline-none transition-all',
                            isActive
                                ? 'min-w-[100px] px-4 pt-3.5 z-20'
                                : 'min-w-[110px] px-6 pt-4 text-gray-500 hover:text-gray-300 z-10',
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
    activeTab: TabType;
    memberIds: string[] | null;
    member: MemberDetailDialogMember | null;
    formData: Partial<MemberDetailDialogMember>;
    isEditing: boolean;
    isSsnRevealed: boolean;
    setIsSsnRevealed: (next: boolean) => void;
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
    onTabChange: (tab: TabType) => void;
    onStartEditing: () => void;
    onCancelEditing: () => void;
    onSave: () => void;
    onAddRight: () => void;
    onMergeSelectedRights: () => void;
    onDeleteRight: (rightId: string) => void;
    onRightChange: (rightId: string, field: string, value: string) => void;
    onShowLineage: (rightId: string) => void;
}

export function MemberDetailDialogBody({
    loading,
    activeTab,
    memberIds,
    member,
    formData,
    isEditing,
    isSsnRevealed,
    setIsSsnRevealed,
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
    onTabChange,
    onStartEditing,
    onCancelEditing,
    onSave,
    onAddRight,
    onMergeSelectedRights,
    onDeleteRight,
    onRightChange,
    onShowLineage,
}: MemberDetailDialogBodyProps) {
    return (
        <div className="relative flex flex-1 flex-col min-h-0 bg-[#0F151B] px-0 pb-0">
            <MemberDetailDialogTabBar activeTab={activeTab} onTabChange={onTabChange} />
            <div className="relative z-0 flex flex-1 flex-col overflow-hidden bg-[#1A2633]">
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
                    {loading ? (
                        <div className="flex h-full flex-col items-center justify-center gap-3 opacity-50">
                            <MaterialIcon name="refresh" className="animate-spin" />
                            <span className="text-xs font-bold">로딩 중...</span>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'info' && member ? (
                                <MemberDetailDialogInfoTab
                                    member={member}
                                    formData={formData}
                                    isEditing={isEditing}
                                    isSsnRevealed={isSsnRevealed}
                                    setIsSsnRevealed={setIsSsnRevealed}
                                    setFormData={setFormData}
                                    saveFeedback={saveFeedback}
                                />
                            ) : null}
                            {activeTab === 'admin' && member ? (
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
                            {activeTab === 'timeline' && memberIds ? (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <ActivityTimelineTab memberIds={memberIds} />
                                </div>
                            ) : null}
                            {activeTab === 'payment' && memberIds && member ? (
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
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
