'use client';

export const SETTLEMENT_OPS_EVENT = 'settlement:action-complete';

export type SettlementOpsEventDetail = {
    action:
        | 'create_missing_cases'
        | 'status_sync'
        | 'payment_register'
        | 'permission_probe'
        | 'qa_run';
    ok: boolean;
    message?: string;
    at: string;
};

export function emitSettlementOpsEvent(detail: SettlementOpsEventDetail) {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
        new CustomEvent<SettlementOpsEventDetail>(SETTLEMENT_OPS_EVENT, {
            detail,
        }),
    );
}

