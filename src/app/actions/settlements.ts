'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchCertificateCompatRows } from '@/lib/server/certificateCompat';
import { fetchPartyRolesCompat } from '@/lib/server/partyRolesCompat';

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

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function parseAmount(value: FormDataEntryValue | null) {
    if (typeof value !== 'string') return 0;
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
}

function extractUserRole(user: {
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
}) {
    const appRole = typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : '';
    const userRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : '';
    return (appRole || userRole || '').trim().toLowerCase();
}

async function ensureSettlementPermission() {
    const supabase = await createClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return { supabase, user: null, error: '인증이 필요합니다.' as string | null };
    }

    const allowedRoles = (process.env.SETTLEMENT_ALLOWED_ROLES || '')
        .split(',')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean);

    if (allowedRoles.length > 0) {
        const userRole = extractUserRole(user);
        if (!userRole || !allowedRoles.includes(userRole)) {
            return { supabase, user: null, error: '정산 작업 권한이 없습니다.' as string | null };
        }
    }

    return { supabase, user, error: null as string | null };
}

async function writeAuditLog({
    entityType,
    entityId,
    action,
    actor,
    reason,
    metadata,
}: {
    entityType: string;
    entityId: string | null;
    action: string;
    actor: string;
    reason: string;
    metadata?: Record<string, unknown>;
}) {
    const supabase = await createClient();
    await supabase.from('audit_logs').insert({
        entity_type: entityType,
        entity_id: entityId,
        action,
        actor,
        reason,
        metadata: metadata || {},
    });
}

export async function registerRefundPayment(
    _prevState: SettlementActionState,
    formData: FormData,
): Promise<SettlementActionState> {
    const { supabase, user, error: permissionError } = await ensureSettlementPermission();
    if (permissionError || !user) {
        return { error: permissionError || '권한 확인에 실패했습니다.' };
    }

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
        supabase
            .from('settlement_lines')
            .select('amount')
            .eq('case_id', caseId)
            .eq('line_type', 'final_refund'),
        supabase
            .from('refund_payments')
            .select('paid_amount')
            .eq('case_id', caseId)
            .eq('payment_status', 'paid'),
    ]);

    const finalAmount = ((finalLineRes.data as Array<{ amount: number | string }> | null) || [])
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const paidBefore = ((paidSumRes.data as Array<{ paid_amount: number | string }> | null) || [])
        .reduce((sum, row) => sum + Number(row.paid_amount || 0), 0);

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

    await writeAuditLog({
        entityType: 'refund_payment',
        entityId: caseId,
        action: 'create',
        actor: user.id,
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

    revalidatePath('/settlements');
    revalidatePath('/payments');
    revalidatePath('/members');

    return {
        success: true,
        message: `지급 등록 완료 (${Math.round(paidAmount).toLocaleString()}원). 잔여 ${Math.round(remainingAfter).toLocaleString()}원`,
    };
}

export async function createMissingSettlementCases(
    _prevState: SettlementActionState,
    formData: FormData,
): Promise<SettlementActionState> {
    const { supabase, user, error: permissionError } = await ensureSettlementPermission();
    if (permissionError || !user) {
        return { error: permissionError || '권한 확인에 실패했습니다.' };
    }

    const limitRaw = formData.get('limit');
    const limit =
        typeof limitRaw === 'string' && Number.isFinite(Number(limitRaw))
            ? Math.max(1, Math.min(Number(limitRaw), 200))
            : 30;

    const [partyRes, partyRoles, certificateRows, casesRes] = await Promise.all([
        supabase
            .from('party_profiles')
            .select('id, member_id'),
        fetchPartyRolesCompat(supabase),
        fetchCertificateCompatRows(supabase),
        supabase
            .from('settlement_cases')
            .select('party_id'),
    ]);

    const candidatePartyIds = new Set<string>();
    for (const party of (partyRes.data as Array<{ id: string; member_id: string | null }> | null) || []) {
        if (party.member_id) candidatePartyIds.add(party.id);
    }
    for (const role of partyRoles) {
        if (role.role_type === 'member' || role.role_type === 'certificate_holder') {
            candidatePartyIds.add(role.party_id);
        }
    }
    for (const certificate of certificateRows) {
        candidatePartyIds.add(certificate.holder_party_id);
    }

    const existingCasePartyIds = new Set(
        ((casesRes.data as Array<{ party_id: string }> | null) || []).map((row) => row.party_id),
    );

    const targetPartyIds = Array.from(candidatePartyIds)
        .filter((partyId) => !existingCasePartyIds.has(partyId))
        .slice(0, limit);

    if (targetPartyIds.length === 0) {
        return { success: true, message: '생성할 미생성 케이스가 없습니다.', createdCount: 0, failedCount: 0 };
    }

    let createdCount = 0;
    let failedCount = 0;
    for (const partyId of targetPartyIds) {
        const { error } = await supabase.rpc('create_settlement_case', {
            p_party_id: partyId,
            p_policy_code: null,
            p_policy_version: null,
            p_created_by: user.id,
            p_force_new: false,
        });
        if (error) {
            console.error('[settlements] createMissingSettlementCases rpc error:', error);
            failedCount += 1;
        } else {
            createdCount += 1;
        }
    }

    await writeAuditLog({
        entityType: 'settlement_case_batch',
        entityId: null,
        action: 'create_missing_cases',
        actor: user.id,
        reason: '미생성 정산 케이스 일괄 생성',
        metadata: {
            limit,
            target_count: targetPartyIds.length,
            created_count: createdCount,
            failed_count: failedCount,
        },
    });

    revalidatePath('/settlements');
    revalidatePath('/members');
    revalidatePath('/payments');

    return {
        success: createdCount > 0,
        message: `일괄 생성 완료: 성공 ${createdCount}건 / 실패 ${failedCount}건`,
        createdCount,
        failedCount,
    };
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

    const details: string[] = [];
    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;

    const userRole = extractUserRole(user) || '(none)';
    const allowedRoles = (process.env.SETTLEMENT_ALLOWED_ROLES || '')
        .split(',')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean);

    details.push(`INFO(auth): user_id=${user.id}`);
    details.push(`INFO(auth): role=${userRole}`);
    details.push(
        `INFO(config): allowed_roles=${allowedRoles.length > 0 ? allowedRoles.join(',') : '(empty)'}`,
    );

    if (allowedRoles.length === 0) {
        details.push('WARN(config): SETTLEMENT_ALLOWED_ROLES 미설정 (모든 인증 사용자 허용 상태)');
        warnCount += 1;
    }

    const readChecks: Array<{ table: string }> = [
        { table: 'party_profiles' },
        { table: 'settlement_cases' },
        { table: 'settlement_lines' },
        { table: 'refund_payments' },
        { table: 'audit_logs' },
    ];

    for (const check of readChecks) {
        const { error } = await supabase.from(check.table).select('id', { head: true, count: 'exact' });
        if (error) {
            details.push(`FAIL(read): ${check.table} - ${error.message}`);
            failCount += 1;
        } else {
            details.push(`PASS(read): ${check.table}`);
            passCount += 1;
        }
    }

    const { error: auditProbeError } = await supabase.from('audit_logs').insert({
        entity_type: 'permission_probe',
        entity_id: null,
        action: 'probe',
        actor: user.id,
        reason: '정산 권한 점검',
        metadata: {
            source: 'settlements_ui',
            checked_at: new Date().toISOString(),
        },
    });
    if (auditProbeError) {
        details.push(`FAIL(write): audit_logs - ${auditProbeError.message}`);
        failCount += 1;
    } else {
        details.push('PASS(write): audit_logs');
        passCount += 1;
    }

    const dummyCaseId = '00000000-0000-0000-0000-000000000000';
    const probeRef = `PROBE-${globalThis.crypto.randomUUID()}`;
    const { data: refundProbeData, error: refundProbeError } = await supabase.from('refund_payments').insert({
        case_id: dummyCaseId,
        paid_amount: 0,
        paid_date: new Date().toISOString().slice(0, 10),
        payment_reference: probeRef,
        receiver_name: 'probe',
        payment_status: 'requested',
    }).select('id').maybeSingle();

    if (!refundProbeError) {
        details.push('WARN(write): refund_payments - 예기치 않게 probe insert 성공 (FK 미설정 가능성)');
        warnCount += 1;
        if (refundProbeData?.id) {
            const { error: cleanupError } = await supabase
                .from('refund_payments')
                .delete()
                .eq('id', refundProbeData.id);
            if (cleanupError) {
                details.push(`WARN(cleanup): refund_payments - ${cleanupError.message}`);
                warnCount += 1;
            } else {
                details.push('PASS(cleanup): refund_payments probe row 삭제');
                passCount += 1;
            }
        }
    } else if (
        /foreign key|violates foreign key constraint/i.test(refundProbeError.message)
    ) {
        details.push('PASS(write): refund_payments (FK 차단으로 롤백 확인)');
        passCount += 1;
    } else if (
        /row-level security|permission denied|not allowed/i.test(refundProbeError.message)
    ) {
        details.push(`FAIL(write): refund_payments - ${refundProbeError.message}`);
        failCount += 1;
    } else {
        details.push(`WARN(write): refund_payments - ${refundProbeError.message}`);
        warnCount += 1;
    }

    const { error: rpcProbeError } = await supabase.rpc('create_settlement_case', {
        p_party_id: dummyCaseId,
        p_policy_code: null,
        p_policy_version: null,
        p_created_by: user.id,
        p_force_new: false,
    });

    if (!rpcProbeError) {
        details.push('WARN(exec): create_settlement_case - 예기치 않게 probe call 성공');
        warnCount += 1;
    } else if (
        /foreign key|violates foreign key constraint|No settlement policy found/i.test(rpcProbeError.message)
    ) {
        details.push('PASS(exec): create_settlement_case');
        passCount += 1;
    } else if (
        /row-level security|permission denied|not allowed/i.test(rpcProbeError.message)
    ) {
        details.push(`FAIL(exec): create_settlement_case - ${rpcProbeError.message}`);
        failCount += 1;
    } else {
        details.push(`WARN(exec): create_settlement_case - ${rpcProbeError.message}`);
        warnCount += 1;
    }

    const success = failCount === 0;
    return {
        success,
        message: success
            ? `권한/RLS 점검 완료 (PASS ${passCount} / WARN ${warnCount})`
            : `권한/RLS 점검 이슈 발견 (FAIL ${failCount} / WARN ${warnCount})`,
        details,
    };
}

function parsePositiveInt(value: FormDataEntryValue | null, fallback: number, min = 1, max = 5000) {
    if (typeof value !== 'string') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.floor(parsed), min), max);
}

function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

export async function syncSettlementCaseStatuses(
    _prevState: SettlementActionState,
    formData: FormData,
): Promise<SettlementActionState> {
    const { supabase, user, error: permissionError } = await ensureSettlementPermission();
    if (permissionError || !user) {
        return { error: permissionError || '권한 확인에 실패했습니다.' };
    }

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

    const cases = (casesRaw as Array<{ id: string; case_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected'; created_at: string }> | null) || [];
    if (cases.length === 0) {
        return { success: true, message: '동기화 대상 케이스가 없습니다.', updatedCount: 0, scannedCount: 0 };
    }

    const caseIds = cases.map((item) => item.id);
    const [linesRes, paymentsRes] = await Promise.all([
        supabase
            .from('settlement_lines')
            .select('case_id, amount')
            .in('case_id', caseIds)
            .eq('line_type', 'final_refund'),
        supabase
            .from('refund_payments')
            .select('case_id, paid_amount, payment_status')
            .in('case_id', caseIds),
    ]);

    if (linesRes.error) {
        console.error('[settlements] syncSettlementCaseStatuses load lines error:', linesRes.error);
        return { error: `정산선 조회 실패: ${linesRes.error.message}` };
    }
    if (paymentsRes.error) {
        console.error('[settlements] syncSettlementCaseStatuses load payments error:', paymentsRes.error);
        return { error: `지급내역 조회 실패: ${paymentsRes.error.message}` };
    }

    const expectedByCase = new Map<string, number>();
    for (const line of ((linesRes.data as Array<{ case_id: string; amount: number | string }> | null) || [])) {
        expectedByCase.set(line.case_id, (expectedByCase.get(line.case_id) || 0) + Number(line.amount || 0));
    }

    const paidByCase = new Map<string, number>();
    for (const payment of ((paymentsRes.data as Array<{ case_id: string; paid_amount: number | string; payment_status: 'requested' | 'paid' | 'failed' | 'cancelled' }> | null) || [])) {
        if (payment.payment_status !== 'paid') continue;
        paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + Number(payment.paid_amount || 0));
    }

    const toPaidIds: string[] = [];
    const toApprovedIds: string[] = [];
    for (const settlementCase of cases) {
        const expected = Math.max(expectedByCase.get(settlementCase.id) || 0, 0);
        const paid = paidByCase.get(settlementCase.id) || 0;
        const remaining = Math.max(expected - paid, 0);

        const shouldBePaid =
            expected > 0 &&
            remaining <= 0 &&
            settlementCase.case_status !== 'paid' &&
            settlementCase.case_status !== 'rejected';

        const shouldBeApproved =
            settlementCase.case_status === 'paid' &&
            remaining > 0;

        if (shouldBePaid) toPaidIds.push(settlementCase.id);
        if (shouldBeApproved) toApprovedIds.push(settlementCase.id);
    }

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

    await writeAuditLog({
        entityType: 'settlement_case_batch',
        entityId: null,
        action: 'sync_case_status',
        actor: user.id,
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

    revalidatePath('/settlements');
    revalidatePath('/members');
    revalidatePath('/payments');

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
