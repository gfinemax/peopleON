import type { TabType } from './memberDetailDialogTypes';

export type MemberWorkspaceColumnId = 'profile' | 'relations' | 'rights' | 'payment' | 'timeline';
export type MemberWorkspacePresetId = 'consultation' | 'payment' | 'contract' | 'compare' | 'custom';

export const MEMBER_WORKSPACE_COLUMNS: Array<{
    id: MemberWorkspaceColumnId;
    label: string;
    icon: string;
}> = [
    { id: 'profile', label: '기본정보', icon: 'person' },
    { id: 'relations', label: '관계인', icon: 'group' },
    { id: 'rights', label: '권리증·계약', icon: 'description' },
    { id: 'payment', label: '납부·정산', icon: 'payments' },
    { id: 'timeline', label: '상담·활동', icon: 'history' },
];

export const MEMBER_WORKSPACE_PRESETS: Array<{
    id: Exclude<MemberWorkspacePresetId, 'custom'>;
    label: string;
    columns: MemberWorkspaceColumnId[];
}> = [
    { id: 'consultation', label: '상담 업무', columns: ['profile', 'timeline', 'relations'] },
    { id: 'payment', label: '납부 점검', columns: ['profile', 'payment', 'rights'] },
    { id: 'contract', label: '계약 검토', columns: ['profile', 'relations', 'rights', 'timeline'] },
    { id: 'compare', label: '전체 비교', columns: ['profile', 'relations', 'rights', 'payment', 'timeline'] },
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
