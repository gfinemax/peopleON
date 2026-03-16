import type { SupabaseClient } from '@supabase/supabase-js';
import {
    buildExpectedAmountByCase,
    buildPaidAmountByCase,
    classifySettlementStatusTargets,
} from '@/lib/server/settlementCaseMaintenance';
import type { SettlementActionState } from '@/lib/server/settlementActionTypes';
import {
    chunkArray,
    parsePositiveInt,
    revalidateSettlementPages,
    writeSettlementAuditLog,
} from '@/lib/server/settlementActionUtils';

export async function syncSettlementCaseStatusesWithPermission({
    supabase,
    userId,
    formData,
}: {
    supabase: SupabaseClient;
    userId: string;
    formData: FormData;
}): Promise<SettlementActionState> {
    const limit = parsePositiveInt(formData.get('limit'), 2000, 1, 20000);

    const { data: casesRaw, error: casesError } = await supabase
        .from('settlement_cases')
        .select('id, case_status, created_at')
        .neq('case_status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (casesError) {
        console.error('[settlements] syncSettlementCaseStatuses load cases error:', casesError);
        return { error: `케이스 조회 실패: ${casesError.message}` };
    }

    const cases =
        (casesRaw as Array<{
            id: string;
            case_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected';
            created_at: string;
        }> | null) || [];
    if (cases.length === 0) {
        return { success: true, message: '동기화 대상 케이스가 없습니다.', updatedCount: 0, scannedCount: 0 };
    }

    const caseIds = cases.map((item) => item.id);
    const [linesRes, paymentsRes] = await Promise.all([
        supabase.from('settlement_lines').select('case_id, amount').in('case_id', caseIds).eq('line_type', 'final_refund'),
        supabase.from('refund_payments').select('case_id, paid_amount, payment_status').in('case_id', caseIds),
    ]);

    if (linesRes.error) {
        console.error('[settlements] syncSettlementCaseStatuses load lines error:', linesRes.error);
        return { error: `정산선 조회 실패: ${linesRes.error.message}` };
    }
    if (paymentsRes.error) {
        console.error('[settlements] syncSettlementCaseStatuses load payments error:', paymentsRes.error);
        return { error: `지급내역 조회 실패: ${paymentsRes.error.message}` };
    }

    const expectedByCase = buildExpectedAmountByCase(
        ((linesRes.data as Array<{ case_id: string; amount: number | string }> | null) || []),
    );
    const paidByCase = buildPaidAmountByCase(
        ((paymentsRes.data as Array<{
            case_id: string;
            paid_amount: number | string;
            payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
        }> | null) || []),
    );
    const { toPaidIds, toApprovedIds } = classifySettlementStatusTargets(cases, expectedByCase, paidByCase);

    const nowIso = new Date().toISOString();
    let updateErrors = 0;
    let updatedCount = 0;

    for (const chunk of chunkArray(toPaidIds, 500)) {
        const { error } = await supabase
            .from('settlement_cases')
            .update({ case_status: 'paid', updated_at: nowIso })
            .in('id', chunk);
        if (error) {
            console.error('[settlements] syncSettlementCaseStatuses update paid error:', error);
            updateErrors += chunk.length;
        } else {
            updatedCount += chunk.length;
        }
    }

    for (const chunk of chunkArray(toApprovedIds, 500)) {
        const { error } = await supabase
            .from('settlement_cases')
            .update({ case_status: 'approved', updated_at: nowIso })
            .in('id', chunk);
        if (error) {
            console.error('[settlements] syncSettlementCaseStatuses update approved error:', error);
            updateErrors += chunk.length;
        } else {
            updatedCount += chunk.length;
        }
    }

    await writeSettlementAuditLog({
        entityType: 'settlement_case_batch',
        entityId: null,
        action: 'sync_case_status',
        actor: userId,
        reason: '정산 케이스 상태 자동 동기화',
        metadata: {
            scanned_count: cases.length,
            limit,
            target_paid_count: toPaidIds.length,
            target_approved_count: toApprovedIds.length,
            updated_count: updatedCount,
            update_error_count: updateErrors,
            sample_paid_ids: toPaidIds.slice(0, 10),
            sample_approved_ids: toApprovedIds.slice(0, 10),
        },
    });

    revalidateSettlementPages();

    if (toPaidIds.length + toApprovedIds.length === 0) {
        return {
            success: true,
            message: `상태 불일치 없음 (스캔 ${cases.length.toLocaleString()}건)`,
            updatedCount: 0,
            scannedCount: cases.length,
        };
    }

    if (updateErrors > 0) {
        return {
            success: false,
            error: `동기화 일부 실패: 성공 ${updatedCount}건 / 실패 ${updateErrors}건`,
            updatedCount,
            scannedCount: cases.length,
        };
    }

    return {
        success: true,
        message: `상태 동기화 완료: ${updatedCount.toLocaleString()}건 (paid ${toPaidIds.length} / approved ${toApprovedIds.length})`,
        updatedCount,
        scannedCount: cases.length,
    };
}
