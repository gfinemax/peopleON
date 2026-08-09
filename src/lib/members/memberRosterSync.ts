export type RosterSyncRow = {
    rowNumber: number;
    name: string;
    unitGroup: string;
};

export const ROSTER_REGISTERED_COUNT = 86;
export const ROSTER_TOTAL_COUNT = 116;

export const MEMBER_ROLE_CODES = [
    '1차', '등기조합원', '2차', '지주조합원', '지주', '원지주',
    '예비조합원', '임시원장', '일반조합원', '권리증환불',
] as const;

export function normalizeRosterName(value: unknown) {
    return String(value ?? '').normalize('NFKC').replace(/\s+/g, '').trim();
}

export function findRosterColumn(headers: string[], candidates: string[]) {
    const normalizedCandidates = candidates.map(normalizeRosterName);
    return headers.find((header) => normalizedCandidates.includes(normalizeRosterName(header))) || '';
}
