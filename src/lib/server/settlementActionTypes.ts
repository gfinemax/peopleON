export interface SettlementActionState {
    success?: boolean;
    error?: string;
    message?: string;
    createdCount?: number;
    failedCount?: number;
    updatedCount?: number;
    scannedCount?: number;
    details?: string[];
}
