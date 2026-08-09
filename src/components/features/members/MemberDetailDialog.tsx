'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MaterialIcon } from '@/components/ui/icon';
import {
    MemberDetailDialogBody,
    MemberDetailDialogEmptyState,
    MemberDetailDialogHeader,
} from './MemberDetailDialogSections';
import { MemberDetailDialogLineageDialog } from './MemberDetailDialogAdmin';
import { MemberWorkspaceSummary } from './MemberWorkspacePage';
import { Header } from '@/components/layout/Header';
import type { MemberWorkspaceColumnId } from './memberWorkspacePresets';
import {
    getManagedCertificateNumbers,
    getRightsFlowSummary,
    parseCertificateMeta,
} from './memberDetailDialogUtils';
import { deleteMemberEntities } from '@/app/actions/member';
import type {
    MemberDetailDialogMember,
    MemberDetailDialogSaveFeedback,
    TabType,
} from './memberDetailDialogTypes';
import {
    addMemberRight,
    buildEditedRight,
    fetchMemberDetail,
    isDateLikeValue,
    mergeMemberRights,
    saveMemberDetail,
    unmergeMemberRight,
} from './memberDetailDialogOperations';

interface MemberDetailDialogProps {
    memberId: string | null;
    memberIds: string[] | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved?: (member: Member | null) => void;
    initialTab?: TabType;
    presentation?: 'dialog' | 'page';
    onActiveTabChange?: (tab: TabType) => void;
}

type Member = MemberDetailDialogMember;

export function MemberDetailDialog({
    memberId,
    memberIds,
    open,
    onOpenChange,
    onSaved,
    initialTab,
    presentation = 'dialog',
    onActiveTabChange,
}: MemberDetailDialogProps) {
    const [member, setMember] = useState<Member | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadAttempted, setLoadAttempted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<Member>>({});
    const [isAdmin, setIsAdmin] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>();
    const [currentUserName, setCurrentUserName] = useState<string | undefined>();
    const [saveFeedback, setSaveFeedback] = useState<MemberDetailDialogSaveFeedback | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('info');
    const visibleWorkspaceColumns: MemberWorkspaceColumnId[] = ['profile', 'finance', 'timeline', 'documents'];
    const [rightInput, setRightInput] = useState('');
    const [isAddingRight, setIsAddingRight] = useState(false);
    const [conflictRightNumbers] = useState<string[]>([]);
    const [deletedRightsIds, setDeletedRightsIds] = useState<string[]>([]);
    const [isSsnRevealed, setIsSsnRevealed] = useState(false);
    const [selectedRightIds, setSelectedRightIds] = useState<string[]>([]);
    const [isMerging, setIsMerging] = useState(false);
    const [showLineageId, setShowLineageId] = useState<string | null>(null);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const canEditCertificateSummary = (memberIds?.length || 0) <= 1;
    const rightsFlowSummary = getRightsFlowSummary(formData.assetRights);
    const managedCertificateNumbers = getManagedCertificateNumbers(formData.assetRights);
    const sortedAssetRights = [...(formData.assetRights || [])].sort((left, right) => {
        const leftMeta = parseCertificateMeta(left.right_number_note);
        const rightMeta = parseCertificateMeta(right.right_number_note);
        const leftPriority = leftMeta.node_type === 'derivative' ? 0 : 1;
        const rightPriority = rightMeta.node_type === 'derivative' ? 0 : 1;
        return leftPriority - rightPriority;
    });
    const manageableRights = (formData.assetRights || []).filter((right) => {
        if (right.right_type && right.right_type !== 'certificate') return false;
        const meta = parseCertificateMeta(right.right_number_note);
        return typeof meta.parent_right_id !== 'string';
    });

    const refreshMember = async (ids: string[]) => {
        if (ids.length === 0) return;
        setLoading(true);
        setLoadAttempted(false);
        setMember(null);
        setFormData({});
        setIsEditing(false);
        setSaveFeedback(null);
        setDeletedRightsIds([]);
        const data = await fetchMemberDetail(ids);
        if (data) {
            setMember(data);
            setFormData(data);
        }
        setLoadAttempted(true);
        setLoading(false);
        return data;
    };

    useEffect(() => {
        if (open) {
            setActiveTab(initialTab || 'info');
        }
    }, [open, initialTab]);

    useEffect(() => {
        const checkAdmin = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUserEmail(user?.email);
            setCurrentUserName(typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : undefined);
            if (user?.email === 'gfinemax@gmail.com') {
                setIsAdmin(true);
            }
        };
        void checkAdmin();
    }, []);

    useEffect(() => {
        setSelectedRightIds((prev) => {
            const next = prev.filter((id) => manageableRights.some((right) => right.id === id));
            if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
                return prev;
            }
            return next;
        });
    }, [formData.assetRights, manageableRights]);

    useEffect(() => {
        const handlePointerMove = (event: PointerEvent) => {
            if (!isDragging) return;
            setPosition({
                x: event.clientX - dragStart.x,
                y: event.clientY - dragStart.y,
            });
        };

        const handlePointerUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [dragStart, isDragging]);

    useEffect(() => {
        if (open && memberIds && memberIds.length > 0) {
            void refreshMember(memberIds);
        }
    }, [open, memberIds]);

    const handlePointerDown = (event: React.PointerEvent) => {
        if ((event.target as HTMLElement).closest('button, input, textarea, a')) return;
        setIsDragging(true);
        setDragStart({
            x: event.clientX - position.x,
            y: event.clientY - position.y,
        });
    };

    const handleDialogOpenChange = (nextOpen: boolean) => {
        onOpenChange(nextOpen);
        if (nextOpen) {
            setPosition({ x: 0, y: 0 });
            setActiveTab('info');
            setSaveFeedback(null);
        }
    };

    const handleClose = () => handleDialogOpenChange(false);
    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        onActiveTabChange?.(tab);
    };
    const handleMergeSelectedRights = async () => {
        if (!member || selectedRightIds.length < 2) return;
        const targetNumber = prompt('선택한 권리증을 묶을 통합 관리번호를 입력하세요:');
        if (!targetNumber) return;

        setIsMerging(true);
        try {
            const result = await mergeMemberRights({ member, selectedRightIds, targetNumber });
            if (result.success) {
                alert('선택한 권리증이 하나의 통합 관리번호로 묶였습니다.');
                setSelectedRightIds([]);
                await refreshMember(memberIds || [member.id]);
            } else {
                alert(`통합 관리번호 생성 중 오류가 발생했습니다: ${result.message || '알 수 없는 오류'}`);
            }
        } catch {
            alert('통합 관리번호 생성 중 오류가 발생했습니다.');
        } finally {
            setIsMerging(false);
        }
    };

    const handleAddRight = async () => {
        if (!rightInput.trim() || !member) return;
        if (isDateLikeValue(rightInput)) {
            alert('이 입력값은 생년월일 형식입니다. 권리증 번호가 확실한지 확인하시거나, 생년월일 칸에 입력해 주세요.');
            return;
        }

        setIsAddingRight(true);
        try {
            await addMemberRight({ member, memberIds, rightInput });
            setRightInput('');
            const refreshedMember = await refreshMember(memberIds && memberIds.length > 0 ? memberIds : [member.id]);
            if (onSaved) onSaved(refreshedMember || member);
        } catch (error) {
            alert('권리증 추가 중 오류가 발생했습니다: ' + (error as Error).message);
        } finally {
            setIsAddingRight(false);
        }
    };

    const handleRightChange = (rightId: string, field: string, value: string) => {
        setFormData((prev) => {
            if (!prev.assetRights) return prev;
            return {
                ...prev,
                assetRights: prev.assetRights.map((right) => (right.id === rightId ? buildEditedRight(field, value, right) : right)),
            };
        });
    };

    const handleDeleteRight = (rightId: string) => {
        if (!confirm('해당 권리증을 목록에서 제외하시겠습니까?\n(우측 상단의 [저장] 버튼을 누르셔야 실제 DB에서 삭제됩니다.)')) return;

        setFormData((prev) => {
            if (!prev.assetRights) return prev;
            return {
                ...prev,
                assetRights: prev.assetRights.filter((right) => right.id !== rightId),
            };
        });

        if (!rightId.startsWith('new-')) {
            setDeletedRightsIds((prev) => [...prev, rightId]);
        }
    };

    const handleDeleteMember = async () => {
        if (!member) return;
        const targetIds = memberIds && memberIds.length > 0 ? memberIds : [member.id];
        const label = targetIds.length > 1 ? `${member.name || '선택한 인물'} 포함 ${targetIds.length}건` : member.name || '선택한 인물';
        const confirmed = confirm(`${label} 정보를 삭제하시겠습니까?\n권리증, 정산, 납부 이력이 있으면 삭제가 차단됩니다.`);
        if (!confirmed) return;

        setDeleting(true);
        setSaveFeedback(null);
        const result = await deleteMemberEntities(targetIds);

        if (!result.success) {
            setSaveFeedback({
                tone: 'error',
                message: result.error || '인물 정보 삭제에 실패했습니다.',
            });
            setDeleting(false);
            return;
        }

        setDeleting(false);
        handleDialogOpenChange(false);
        if (onSaved) onSaved(member);
    };

    const handleSave = async () => {
        if (!memberId) return;
        setSaving(true);
        setSaveFeedback(null);

        const result = await saveMemberDetail({
            memberId,
            memberIds,
            member,
            formData,
            deletedRightsIds,
        });

        if (!result.success) {
            setSaveFeedback(result.feedback);
            setSaving(false);
            return;
        }

        setIsEditing(false);
        const refreshedMember = await refreshMember(memberIds && memberIds.length > 0 ? memberIds : memberId ? [memberId] : []);
        if (onSaved) onSaved(refreshedMember || member);
        setSaveFeedback(result.feedback);
        setSaving(false);
    };

    const handleUnmerge = async () => {
        const sourceCount = (member?.assetRights || []).filter((right) => {
            const meta = parseCertificateMeta(right.right_number_note);
            return meta.parent_right_id === showLineageId;
        }).length;

        if (!member || !showLineageId) return;
        if (!confirm(`정말 이 통합 관리번호를 해제하시겠습니까?\n원천 권리증 ${sourceCount || 0}개가 다시 독립적으로 분리됩니다.`)) return;

        try {
            setIsMerging(true);
            const result = await unmergeMemberRight({ member, rightId: showLineageId });
            if (result.success) {
                alert('통합 관리번호 해제가 완료되었습니다.');
                setShowLineageId(null);
                await refreshMember(memberIds || [member.id]);
            } else {
                alert(`통합 해제 중 오류가 발생했습니다: ${result.message || '알 수 없는 오류'}`);
            }
        } catch {
            alert('통합 해제 중 서버 오류가 발생했습니다.');
        } finally {
            setIsMerging(false);
        }
    };

    const hasTargetMember = Boolean(memberIds?.length);
    const isInitialLoading = open && hasTargetMember && !member && !loadAttempted;

    if (!member && !loading && (!hasTargetMember || loadAttempted) && presentation === 'dialog') {
        return <MemberDetailDialogEmptyState open={open} onOpenChange={handleDialogOpenChange} />;
    }

    if (!member && !loading && (!hasTargetMember || loadAttempted)) {
        return <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#0F151B] text-slate-400"><span className="text-sm font-bold">조합원 정보를 불러올 수 없습니다.</span><button onClick={handleClose} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold text-white">목록으로 돌아가기</button></div>;
    }

    const workspace = (
        <>
            {presentation === 'page' ? <Header title="통합현황" userEmail={currentUserEmail} userName={currentUserName || (isAdmin ? '관리자' : undefined)} rightContent={<button type="button" title="도움말" aria-label="도움말" className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-secondary/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground"><MaterialIcon name="help_outline" size="sm" /></button>} /> : null}
            {presentation === 'page' && member ? (
                <MemberWorkspaceSummary member={{ ...member, ...formData }} onEdit={() => setIsEditing(true)} onDelete={() => void handleDeleteMember()} onPrint={() => window.print()} onBack={handleClose} onPhotoChanged={() => void refreshMember(memberIds || [member.id])} />
            ) : (
                <div onPointerDown={handlePointerDown}>
                    <MemberDetailDialogHeader
                        member={member}
                        formData={formData}
                        isEditing={isEditing}
                        saving={saving}
                        deleting={deleting}
                        onStartEditing={() => setIsEditing(true)}
                        onCancelEditing={() => setIsEditing(false)}
                        onSave={handleSave}
                        onDelete={handleDeleteMember}
                        onClose={handleClose}
                        setFormData={setFormData}
                        presentation={presentation}
                        onPrint={() => window.print()}
                    />
                </div>
            )}
            <MemberDetailDialogBody
                loading={loading || isInitialLoading}
                activeTab={activeTab}
                memberIds={memberIds}
                member={member}
                formData={formData}
                isEditing={isEditing}
                isSsnRevealed={isSsnRevealed}
                setIsSsnRevealed={setIsSsnRevealed}
                setFormData={setFormData}
                saveFeedback={saveFeedback}
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
                presentation={presentation}
                visibleWorkspaceColumns={visibleWorkspaceColumns}
                onTabChange={handleTabChange}
                onStartEditing={() => setIsEditing(true)}
                onCancelEditing={() => setIsEditing(false)}
                onSave={handleSave}
                onAddRight={handleAddRight}
                onMergeSelectedRights={handleMergeSelectedRights}
                onDeleteRight={handleDeleteRight}
                onRightChange={handleRightChange}
                onShowLineage={setShowLineageId}
            />
        </>
    );

    const managementDialog = presentation === 'page' ? (
        <Dialog open={isEditing} onOpenChange={(next) => setIsEditing(next)}>
            <DialogContent className="h-[88vh] max-w-[1180px] overflow-hidden border-white/10 bg-[#0F151B] p-0 shadow-2xl">
                <MemberDetailDialogHeader
                    member={member}
                    formData={formData}
                    isEditing
                    saving={saving}
                    deleting={deleting}
                    onStartEditing={() => setIsEditing(true)}
                    onCancelEditing={() => setIsEditing(false)}
                    onSave={handleSave}
                    onDelete={handleDeleteMember}
                    onClose={() => setIsEditing(false)}
                    setFormData={setFormData}
                    presentation="dialog"
                    onPrint={() => window.print()}
                />
                <MemberDetailDialogBody
                    loading={loading || isInitialLoading}
                    activeTab={activeTab}
                    memberIds={memberIds}
                    member={member}
                    formData={formData}
                    isEditing
                    isSsnRevealed={isSsnRevealed}
                    setIsSsnRevealed={setIsSsnRevealed}
                    setFormData={setFormData}
                    saveFeedback={saveFeedback}
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
                    presentation="dialog"
                    visibleWorkspaceColumns={visibleWorkspaceColumns}
                    onTabChange={handleTabChange}
                    onStartEditing={() => setIsEditing(true)}
                    onCancelEditing={() => setIsEditing(false)}
                    onSave={handleSave}
                    onAddRight={handleAddRight}
                    onMergeSelectedRights={handleMergeSelectedRights}
                    onDeleteRight={handleDeleteRight}
                    onRightChange={handleRightChange}
                    onShowLineage={setShowLineageId}
                />
            </DialogContent>
        </Dialog>
    ) : null;

    if (presentation === 'page') {
        return (
            <>
                <section className="flex min-h-[calc(100vh-5rem)] flex-col overflow-hidden bg-[#071e32] shadow-2xl">{workspace}</section>
                {managementDialog}
                <MemberDetailDialogLineageDialog member={member} showLineageId={showLineageId} isMerging={isMerging} onClose={() => setShowLineageId(null)} onUnmerge={handleUnmerge} />
            </>
        );
    }

    return (
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
            <DialogContent
                className="h-full max-h-none max-w-none w-full rounded-none border-0 bg-[#0F151B] p-0 shadow-2xl backdrop-blur-xl sm:top-[12vh] sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:translate-y-0 sm:rounded-2xl sm:border sm:border-white/[0.1]"
                style={{ marginLeft: position.x, marginTop: position.y }}
            >
                {workspace}
            </DialogContent>
            <MemberDetailDialogLineageDialog
                member={member}
                showLineageId={showLineageId}
                isMerging={isMerging}
                onClose={() => setShowLineageId(null)}
                onUnmerge={handleUnmerge}
            />
        </Dialog>
    );
}
