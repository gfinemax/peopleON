export function birthDateFromResidentRegistrationNumber(value: string | null | undefined) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length !== 13) return null;

    const centuryByClassifier: Record<string, string> = {
        '9': '18', '0': '18',
        '1': '19', '2': '19', '5': '19', '6': '19',
        '3': '20', '4': '20', '7': '20', '8': '20',
    };
    const century = centuryByClassifier[digits[6]];
    if (!century) return null;

    const year = Number(`${century}${digits.slice(0, 2)}`);
    const month = Number(digits.slice(2, 4));
    const day = Number(digits.slice(4, 6));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        return null;
    }

    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}
