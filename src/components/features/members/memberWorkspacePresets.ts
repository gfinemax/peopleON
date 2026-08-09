import type { TabType } from './memberDetailDialogTypes';

export type MemberWorkspaceColumnId = 'profile' | 'relations' | 'finance' | 'timeline' | 'documents';
export type MemberWorkspacePresetId = 'consultation' | 'payment' | 'contract' | 'compare' | 'custom';

export const MEMBER_WORKSPACE_COLUMNS: Array<{
    id: MemberWorkspaceColumnId;
    label: string;
    icon: string;
}> = [
    { id: 'profile', label: '기본·관계인', icon: 'person' },
    { id: 'relations', label: '관계인', icon: 'group' },
    { id: 'finance', label: '권리·납부', icon: 'payments' },
    { id: 'timeline', label: '상담·활동', icon: 'history' },
    { id: 'documents', label: '문서', icon: 'description' },
];

export const MEMBER_WORKSPACE_PRESETS: Array<{
    id: Exclude<MemberWorkspacePresetId, 'custom'>;
    label: string;
    columns: MemberWorkspaceColumnId[];
}> = [
    { id: 'consultation', label: '상담 업무', columns: ['profile', 'timeline', 'relations'] },
    { id: 'payment', label: '납부 점검', columns: ['profile', 'finance', 'documents'] },
    { id: 'contract', label: '계약 검토', columns: ['profile', 'relations', 'finance', 'documents'] },
    { id: 'compare', label: '전체 비교', columns: ['profile', 'relations', 'finance', 'timeline', 'documents'] },
];

export function getMemberWorkspacePreset(id: MemberWorkspacePresetId) {
    return MEMBER_WORKSPACE_PRESETS.find((preset) => preset.id === id);
}

export function getWorkspacePresetFromTab(tab?: TabType): Exclude<MemberWorkspacePresetId, 'custom'> {
    if (tab === 'payment') return 'payment';
    if (tab === 'admin') return 'contract';
    return 'consultation';
}

export function parseWorkspaceColumns(value?: string): MemberWorkspaceColumnId[] {
    if (!value) return [];
    const valid = new Set(MEMBER_WORKSPACE_COLUMNS.map((column) => column.id));
    return Array.from(new Set(value.split(',').filter((column): column is MemberWorkspaceColumnId => valid.has(column as MemberWorkspaceColumnId))));
}
