import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Severity = 'pass' | 'warn' | 'fail';

type AuditRow = {
    id: string;
    created_at: string;
    actor: string;
    metadata: Record<string, unknown> | null;
};

function extractUserRole(user: {
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
}) {
    const appRole = typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : '';
    const userRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : '';
    return (appRole || userRole || '').trim().toLowerCase();
}

function parseNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

function parseSeverity(value: unknown): Severity {
    if (value === 'pass' || value === 'warn' || value === 'fail') return value;
    return 'warn';
}

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = (process.env.SETTLEMENT_ALLOWED_ROLES || '')
        .split(',')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean);
    if (allowedRoles.length > 0) {
        const userRole = extractUserRole(user);
        if (!userRole || !allowedRoles.includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const [qaRes, syncRes, probeRes, createRes, paymentRes] = await Promise.all([
        supabase
            .from('audit_logs')
            .select('id, created_at, actor, metadata')
            .eq('entity_type', 'qa_report')
            .eq('action', 'run')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('audit_logs')
            .select('id, created_at, actor, metadata')
            .eq('entity_type', 'settlement_case_batch')
            .eq('action', 'sync_case_status')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('audit_logs')
            .select('id, created_at, actor, metadata')
            .eq('entity_type', 'permission_probe')
            .eq('action', 'probe')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('audit_logs')
            .select('id, created_at, actor, metadata')
            .eq('entity_type', 'settlement_case_batch')
            .eq('action', 'create_missing_cases')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('audit_logs')
            .select('id, created_at, actor, metadata')
            .eq('entity_type', 'refund_payment')
            .eq('action', 'create')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
    ]);

    if (qaRes.error) return NextResponse.json({ error: qaRes.error.message }, { status: 500 });
    if (syncRes.error) return NextResponse.json({ error: syncRes.error.message }, { status: 500 });
    if (probeRes.error) return NextResponse.json({ error: probeRes.error.message }, { status: 500 });
    if (createRes.error) return NextResponse.json({ error: createRes.error.message }, { status: 500 });
    if (paymentRes.error) return NextResponse.json({ error: paymentRes.error.message }, { status: 500 });

    const qa = qaRes.data as AuditRow | null;
    const sync = syncRes.data as AuditRow | null;
    const probe = probeRes.data as AuditRow | null;
    const batchCreate = createRes.data as AuditRow | null;
    const latestPayment = paymentRes.data as AuditRow | null;

    const qaSummary = (qa?.metadata?.summary as Record<string, unknown> | undefined) || {};
    const syncMeta = (sync?.metadata as Record<string, unknown> | undefined) || {};
    const createMeta = (batchCreate?.metadata as Record<string, unknown> | undefined) || {};
    const paymentMeta = (latestPayment?.metadata as Record<string, unknown> | undefined) || {};

    return NextResponse.json(
        {
            generated_at: new Date().toISOString(),
            latest_qa: qa
                ? {
                    id: qa.id,
                    created_at: qa.created_at,
                    actor: qa.actor,
                    overall: parseSeverity(qa.metadata?.overall),
                    issue_count: parseNumber(qaSummary.issue_count),
                    pass_checks: parseNumber(qaSummary.pass_checks),
                    warn_checks: parseNumber(qaSummary.warn_checks),
                    fail_checks: parseNumber(qaSummary.fail_checks),
                }
                : null,
            latest_sync: sync
                ? {
                    id: sync.id,
                    created_at: sync.created_at,
                    actor: sync.actor,
                    scanned_count: parseNumber(syncMeta.scanned_count),
                    updated_count: parseNumber(syncMeta.updated_count),
                    update_error_count: parseNumber(syncMeta.update_error_count),
                    target_paid_count: parseNumber(syncMeta.target_paid_count),
                    target_approved_count: parseNumber(syncMeta.target_approved_count),
                }
                : null,
            latest_probe: probe
                ? {
                    id: probe.id,
                    created_at: probe.created_at,
                    actor: probe.actor,
                }
                : null,
            latest_case_create: batchCreate
                ? {
                    id: batchCreate.id,
                    created_at: batchCreate.created_at,
                    actor: batchCreate.actor,
                    target_count: parseNumber(createMeta.target_count),
                    created_count: parseNumber(createMeta.created_count),
                    failed_count: parseNumber(createMeta.failed_count),
                }
                : null,
            latest_payment: latestPayment
                ? {
                    id: latestPayment.id,
                    created_at: latestPayment.created_at,
                    actor: latestPayment.actor,
                    case_id: typeof paymentMeta.case_id === 'string' ? paymentMeta.case_id : null,
                    refund_payment_id:
                        typeof paymentMeta.refund_payment_id === 'string' ? paymentMeta.refund_payment_id : null,
                    paid_amount: parseNumber(paymentMeta.paid_amount),
                }
                : null,
        },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
