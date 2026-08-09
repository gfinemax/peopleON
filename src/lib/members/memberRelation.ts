export function getMemberRelationLabel(relation?: string | null) {
    const value = relation?.trim() || '';
    return value === '부부' ? '배우자' : value;
}
