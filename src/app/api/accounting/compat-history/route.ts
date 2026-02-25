import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Severity = 'pass' | 'fail';

type AuditRow = {
    id: string;
    created_at: string;
    actor: string;
    metadata: Record<string, unknown> | null;
};

function parseAllowedRoles() {
    const configured = process.env.ACCOUNTING_ALLOWED_ROLES || process.env.SETTLEMENT_ALLOWED_ROLES || '';
    return configured
        .split(',')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean);
}

function extractUserRole(user: {
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
}) {
    const appRole = typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : '';
    const userRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : '';
    return (appRole || userRole || '').trim().toLowerCase();
}

function parseSeverity(value: unknown): Severity {
    if (value === 'pass' || value === 'fail') return value;
    return 'fail';
}

function parseNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = parseAllowedRoles();
    if (allowedRoles.length > 0) {
        const userRole = extractUserRole(user);
        if (!userRole || !allowedRoles.includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get('limit') || 8);
    const limit = Math.min(Math.max(Math.floor(limitRaw) || 8, 1), 30);

    const { data, error } = await supabase
        .from('audit_logs')
        .select('id, created_at, actor, metadata')
        .eq('entity_type', 'accounting_compat_check')
        .eq('action', 'run')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data as AuditRow[] | null) || [];
    const items = rows.map((row) => {
        const metadata = row.metadata || {};
        const summary = (metadata.summary as Record<string, unknown> | undefined) || {};
        return {
            id: row.id,
            created_at: row.created_at,
            actor: row.actor,
            overall: parseSeverity(metadata.overall),
            pass_checks: parseNumber(summary.pass_checks),
            fail_checks: parseNumber(summary.fail_checks),
            total_checks: parseNumber(summary.total_checks),
            guard: typeof metadata.guard === 'string' ? metadata.guard : null,
            recommendation:
                typeof metadata.recommendation === 'string' ? metadata.recommendation : null,
        };
    });

    return NextResponse.json(
        {
            generated_at: new Date().toISOString(),
            items,
        },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}

