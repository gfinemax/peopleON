import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { SettlementActionState } from '@/lib/server/settlementActionTypes';
import { extractUserRole } from '@/lib/server/settlementActionUtils';

export async function probeSettlementAccessWithPermission({
    supabase,
    user,
}: {
    supabase: SupabaseClient;
    user: User;
}): Promise<SettlementActionState> {
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
    details.push(`INFO(config): allowed_roles=${allowedRoles.length > 0 ? allowedRoles.join(',') : '(empty)'}`);

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
    const { data: refundProbeData, error: refundProbeError } = await supabase
        .from('refund_payments')
        .insert({
            case_id: dummyCaseId,
            paid_amount: 0,
            paid_date: new Date().toISOString().slice(0, 10),
            payment_reference: probeRef,
            receiver_name: 'probe',
            payment_status: 'requested',
        })
        .select('id')
        .maybeSingle();

    if (!refundProbeError) {
        details.push('WARN(write): refund_payments - 예기치 않게 probe insert 성공 (FK 미설정 가능성)');
        warnCount += 1;
        if (refundProbeData?.id) {
            const { error: cleanupError } = await supabase.from('refund_payments').delete().eq('id', refundProbeData.id);
            if (cleanupError) {
                details.push(`WARN(cleanup): refund_payments - ${cleanupError.message}`);
                warnCount += 1;
            } else {
                details.push('PASS(cleanup): refund_payments probe row 삭제');
                passCount += 1;
            }
        }
    } else if (/foreign key|violates foreign key constraint/i.test(refundProbeError.message)) {
        details.push('PASS(write): refund_payments (FK 차단으로 롤백 확인)');
        passCount += 1;
    } else if (/row-level security|permission denied|not allowed/i.test(refundProbeError.message)) {
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
    } else if (/foreign key|violates foreign key constraint|No settlement policy found/i.test(rpcProbeError.message)) {
        details.push('PASS(exec): create_settlement_case');
        passCount += 1;
    } else if (/row-level security|permission denied|not allowed/i.test(rpcProbeError.message)) {
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
