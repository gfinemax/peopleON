'use client';

import { useMemo } from 'react';

/** Preserve order (the first ID can be the primary member), ignore array identity. */
export function useStableIds(ids: readonly string[] | null | undefined): string[] {
    const key = JSON.stringify(ids || []);
    return useMemo(() => JSON.parse(key) as string[], [key]);
}
