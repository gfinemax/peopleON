export type PrintOrientation = 'portrait' | 'landscape';
export type PrintPageSize = 'A4' | 'A3' | 'Letter';

export interface PrintColumnConfig {
    id: string;
    label: string;
    enabled: boolean;
    width?: string;
}

export interface PrintConfig {
    orientation: PrintOrientation;
    pageSize: PrintPageSize;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    columns: PrintColumnConfig[];
}
