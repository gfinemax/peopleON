'use server';

import {
    createMissingSettlementCasesWithPermission,
    probeSettlementAccessWithPermission,
    registerRefundPaymentWithPermission,
    syncSettlementCaseStatusesWithPermission,
} from '@/lib/server/settlementOperations';
import type { SettlementActionState } from '@/lib/server/settlementActionTypes';
import {
    ensureSettlementPermission,
} from '@/lib/server/settlementActionUtils';

export type { SettlementActionState } from '@/lib/server/settlementActionTypes';

export async function registerRefundPayment(
    _prevState: SettlementActionState,
    formData: FormData,
): Promise<SettlementActionState> {
    const { supabase, user, error: permissionError } = await ensureSettlementPermission();
    if (permissionError || !user) {
        return { error: permissionError || '권한 확인에 실패했습니다.' };
    }
    return registerRefundPaymentWithPermission({ supabase, userId: user.id, formData });
}

export async function createMissingSettlementCases(
    _prevState: SettlementActionState,
    formData: FormData,
): Promise<SettlementActionState> {
    const { supabase, user, error: permissionError } = await ensureSettlementPermission();
    if (permissionError || !user) {
        return { error: permissionError || '권한 확인에 실패했습니다.' };
    }
    return createMissingSettlementCasesWithPermission({ supabase, userId: user.id, formData });
}

export async function probeSettlementAccess(
    _prevState: SettlementActionState,
    _formData: FormData,
): Promise<SettlementActionState> {
    void _prevState;
    void _formData;

    const { supabase, user, error: permissionError } = await ensureSettlementPermission();
    if (permissionError || !user) {
        return { error: permissionError || '권한 확인에 실패했습니다.' };
    }
    return probeSettlementAccessWithPermission({ supabase, user });
}

export async function syncSettlementCaseStatuses(
    _prevState: SettlementActionState,
    formData: FormData,
): Promise<SettlementActionState> {
    const { supabase, user, error: permissionError } = await ensureSettlementPermission();
    if (permissionError || !user) {
        return { error: permissionError || '권한 확인에 실패했습니다.' };
    }
    return syncSettlementCaseStatusesWithPermission({ supabase, userId: user.id, formData });
}
