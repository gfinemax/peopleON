export function normalizeMemberWorkspaceReturnTo(value?: string) {
    if (!value || value.startsWith('//')) return '/members';
    const path = value.split('?')[0];
    if (path !== '/members' && !path.startsWith('/members/') && path !== '/payments') return '/members';
    return value;
}

export function normalizeMemberWorkspaceIds(value: string | undefined, primaryId: string) {
    const candidates = [primaryId, ...(value || '').split(',')]
        .map((item) => item.trim())
        .filter((item) => /^[a-zA-Z0-9-]{1,64}$/.test(item));
    return [...new Set(candidates)].slice(0, 50);
}
