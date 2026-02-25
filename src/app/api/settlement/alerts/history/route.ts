import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Severity = 'pass' | 'warn' | 'fail';

type AlertHistoryItem = {
    id: string;
    created_at: string;
    actor: string;
    reason: string;
    overall: Severity;
    issue_count: number;
    qa_audit_id: string | null;
    deep_link: string | null;
};

type AuditRow = {
    id: string;
    created_at: string;
    actor: string;
    reason: string;
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

function parseSeverity(value: unknown): Severity {
    if (value === 'fail' || value === 'warn' || value === 'pass') return value;
    return 'warn';
}

function parseNumber(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

function parseString(value: unknown) {
    if (typeof value === 'string') return value;
    return '';
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

    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get('limit') || 20);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 20;

    const { data, error } = await supabase
        .from('audit_logs')
        .select('id, created_at, actor, reason, metadata')
        .eq('entity_type', 'settlement_alert')
        .eq('action', 'create')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items: AlertHistoryItem[] = ((data as AuditRow[] | null) || []).map((row) => ({
        id: row.id,
        created_at: row.created_at,
        actor: row.actor,
        reason: row.reason,
        overall: parseSeverity(row.metadata?.overall),
        issue_count: parseNumber(row.metadata?.issue_count),
        qa_audit_id: parseString(row.metadata?.qa_audit_id) || null,
        deep_link: parseString(row.metadata?.deep_link) || null,
    }));

    return NextResponse.json(
        {
            generated_at: new Date().toISOString(),
            items,
        },
        { headers: { 'Cache-Control': 'no-store' } },
    );
}
