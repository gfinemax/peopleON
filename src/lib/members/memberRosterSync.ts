export type RosterSyncRow = {
    rowNumber: number;
    name: string;
    unitGroup: string;
    totalPaid: number;
};

export const ROSTER_REGISTERED_COUNT = 86;
export const ROSTER_TOTAL_COUNT = 116;
export const ROSTER_PAYMENT_NOTE = '[조합원명부 총납입금액 조정]';

export const MEMBER_ROLE_CODES = [
    '1차', '등기조합원', '2차', '지주조합원', '지주', '원지주',
    '예비조합원', '임시원장', '일반조합원', '권리증환불',
] as const;

export function normalizeRosterName(value: unknown) {
    return String(value ?? '').normalize('NFKC').replace(/\s+/g, '').trim();
}

export function parseRosterMoney(value: unknown) {
    if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : NaN;
    const normalized = String(value ?? '').replace(/[원₩,\s]/g, '').trim();
    if (!normalized) return NaN;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? Math.round(parsed) : NaN;
}

export function calculateRosterAdjustment(targetTotal: number, existingDetailTotal: number) {
    return Math.round(targetTotal - existingDetailTotal);
}

export function findRosterColumn(headers: string[], candidates: string[]) {
    const normalizedCandidates = candidates.map(normalizeRosterName);
    return headers.find((header) => normalizedCandidates.includes(normalizeRosterName(header))) || '';
}
