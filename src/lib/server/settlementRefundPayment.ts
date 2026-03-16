import type { SupabaseClient } from '@supabase/supabase-js';
import type { SettlementActionState } from '@/lib/server/settlementActionTypes';
import {
    isUuid,
    parseAmount,
    revalidateSettlementPages,
    writeSettlementAuditLog,
} from '@/lib/server/settlementActionUtils';

export async function registerRefundPaymentWithPermission({
    supabase,
    userId,
    formData,
}: {
    supabase: SupabaseClient;
    userId: string;
    formData: FormData;
}): Promise<SettlementActionState> {
    const caseIdRaw = formData.get('case_id');
    const paidAmount = parseAmount(formData.get('paid_amount'));
    const paymentReferenceRaw = formData.get('payment_reference');
    const receiverNameRaw = formData.get('receiver_name');
    const paidDateRaw = formData.get('paid_date');

    const caseId = typeof caseIdRaw === 'string' ? caseIdRaw.trim() : '';
    const paymentReference = typeof paymentReferenceRaw === 'string' ? paymentReferenceRaw.trim() : '';
    const receiverName = typeof receiverNameRaw === 'string' ? receiverNameRaw.trim() : '';
    const paidDate =
        typeof paidDateRaw === 'string' && paidDateRaw.trim()
            ? paidDateRaw.trim()
            : new Date().toISOString().slice(0, 10);

    if (!caseId || !isUuid(caseId)) {
        return { error: '유효하지 않은 케이스 ID입니다.' };
    }
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
        return { error: '지급 금액은 0보다 커야 합니다.' };
    }

    const { data: caseData, error: caseError } = await supabase
        .from('settlement_cases')
        .select('id, case_status')
        .eq('id', caseId)
        .maybeSingle();

    if (caseError || !caseData) {
        return { error: '정산 케이스를 찾을 수 없습니다.' };
    }
    if (caseData.case_status === 'rejected') {
        return { error: '반려된 케이스에는 지급 등록할 수 없습니다.' };
    }

    if (paymentReference) {
        const { count: duplicateCount } = await supabase
            .from('refund_payments')
            .select('id', { count: 'exact', head: true })
            .eq('case_id', caseId)
            .eq('payment_reference', paymentReference)
            .eq('payment_status', 'paid');

        if ((duplicateCount || 0) > 0) {
            return { error: '동일 지급참조번호가 이미 등록되어 있습니다.' };
        }
    }

    const [finalLineRes, paidSumRes] = await Promise.all([
        supabase.from('settlement_lines').select('amount').eq('case_id', caseId).eq('line_type', 'final_refund'),
        supabase.from('refund_payments').select('paid_amount').eq('case_id', caseId).eq('payment_status', 'paid'),
    ]);

    const finalAmount = ((finalLineRes.data as Array<{ amount: number | string }> | null) || []).reduce(
        (sum, row) => sum + Number(row.amount || 0),
        0,
    );
    const paidBefore = ((paidSumRes.data as Array<{ paid_amount: number | string }> | null) || []).reduce(
        (sum, row) => sum + Number(row.paid_amount || 0),
        0,
    );

    if (finalAmount <= 0) {
        return { error: '최종 환불 예정 금액이 없는 케이스입니다.' };
    }

    const remainingBefore = Math.max(finalAmount - paidBefore, 0);
    if (paidAmount > remainingBefore) {
        return { error: `과지급입니다. 현재 등록 가능 금액은 ${Math.round(remainingBefore).toLocaleString()}원 이하입니다.` };
    }

    const { data: paymentRow, error: insertError } = await supabase
        .from('refund_payments')
        .insert({
            case_id: caseId,
            paid_amount: paidAmount,
            paid_date: paidDate,
            payment_reference: paymentReference || null,
            receiver_name: receiverName || null,
            payment_status: 'paid',
        })
        .select('id')
        .maybeSingle();

    if (insertError) {
        console.error('[settlements] registerRefundPayment insert error:', insertError);
        return { error: '지급 등록에 실패했습니다.' };
    }

    const paidTotal = paidBefore + paidAmount;
    const remainingAfter = Math.max(finalAmount - paidTotal, 0);

    if (remainingAfter <= 0) {
        const { error: updateError } = await supabase
            .from('settlement_cases')
            .update({
                case_status: 'paid',
                updated_at: new Date().toISOString(),
            })
            .eq('id', caseId);

        if (updateError) {
            console.error('[settlements] registerRefundPayment update case status error:', updateError);
        }
    }

    await writeSettlementAuditLog({
        entityType: 'refund_payment',
        entityId: caseId,
        action: 'create',
        actor: userId,
        reason: '정산 지급 등록',
        metadata: {
            case_id: caseId,
            refund_payment_id: paymentRow?.id || null,
            paid_amount: paidAmount,
            paid_date: paidDate,
            payment_reference: paymentReference || null,
            receiver_name: receiverName || null,
            remaining_after: remainingAfter,
        },
    });

    revalidateSettlementPages();

    return {
        success: true,
        message: `지급 등록 완료 (${Math.round(paidAmount).toLocaleString()}원). 잔여 ${Math.round(remainingAfter).toLocaleString()}원`,
    };
}
