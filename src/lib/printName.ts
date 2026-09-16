const CORPORATE_NAME_MARKER = /[（(]\s*(?:주|유|사|재|합|주식회사|유한회사|사단법인|재단법인)\s*[)）]|주식회사|유한회사|유한책임회사|합자회사|합명회사|사단법인|재단법인/;
const TRAILING_NAME_NOTE = /\s*(?:\([^()（）]*\)|（[^()（）]*）)\s*$/;

/** Format names only at the print boundary; keep stored names and identity intact. */
export function formatNameForPrint(name: string): string {
    const original = name.trim();
    // Corporate parentheses can be part of the legal name, including suffixes.
    if (CORPORATE_NAME_MARKER.test(original)) return original;

    let result = original;
    while (TRAILING_NAME_NOTE.test(result)) {
        result = result.replace(TRAILING_NAME_NOTE, '').trim();
    }
    // Never turn a parenthesized-only name into an empty cell.
    return result || original;
}

export function formatNameListForPrint(names: string): string {
    // Owner lists use commas; commas inside a name's note are not separators.
    return names.split(/,\s*(?![^()（）]*[)）])/).map(formatNameForPrint).join(', ');
}
