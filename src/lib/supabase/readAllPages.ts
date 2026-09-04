/** Read complete datasets in bounded, deterministically ordered pages.
 * Use only for aggregates, exports and a selected member's related records.
 * Screen lists should request one page instead. Never cache an error/partial result.
 */
export async function readAllPages<T, E>(
    query: { range(from: number, to: number): PromiseLike<{ data: T[] | null; error: E | null }> },
    pageSize = 50,
): Promise<{ data: T[] | null; error: E | null }> {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
        throw new Error('Page size must be between 1 and 50');
    }
    const data: T[] = [];
    for (let offset = 0; ; offset += pageSize) {
        const page = await query.range(offset, offset + pageSize - 1);
        if (page.error) return { data: null, error: page.error };
        const rows = page.data || [];
        data.push(...rows);
        if (rows.length < pageSize) return { data, error: null };
    }
}
