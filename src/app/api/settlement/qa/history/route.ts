import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Severity = 'pass' | 'warn' | 'fail';

type QaHistoryItem = {
    id: string;
    created_at: string;
    actor: string;
    overall: Severity;
    issue_count: number;
    pass_checks: number;
    warn_checks: number;
    fail_checks: number;
    generated_at: string | null;
    checks: Array<{
        code: string;
        label: string;
        severity: Severity;
        count: number;
        detail: string;
        link: string | null;
    }>;
};

type AuditRow = {
    id: string;
    actor: string;
    created_at: string;
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

function getSummary(metadata: Record<string, unknown> | null) {
    const summary = (metadata?.summary as Record<string, unknown> | undefined) || {};
    return {
        issue_count: parseNumber(summary.issue_count),
        pass_checks: parseNumber(summary.pass_checks),
        warn_checks: parseNumber(summary.warn_checks),
        fail_checks: parseNumber(summary.fail_checks),
    };
}

function parseString(value: unknown) {
    if (typeof value === 'string') return value;
    return '';
}

function parseChecks(metadata: Record<string, unknown> | null) {
    const rawChecks = metadata?.checks;
    if (!Array.isArray(rawChecks)) return [] as QaHistoryItem['checks'];

    return rawChecks
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const row = item as Record<string, unknown>;
            return {
                code: parseString(row.code) || 'unknown',
                label: parseString(row.label) || '점검항목',
                severity: parseSeverity(row.severity),
                count: parseNumber(row.count),
                detail: parseString(row.detail) || '-',
                link: parseString(row.link) || null,
            };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
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
    const rawLimit = Number(url.searchParams.get('limit') || 8);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 8;

    const { data, error } = await supabase
        .from('audit_logs')
        .select('id, actor, created_at, metadata')
        .eq('entity_type', 'qa_report')
        .eq('action', 'run')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const items: QaHistoryItem[] = ((data as AuditRow[] | null) || []).map((row) => {
        const summary = getSummary(row.metadata);
        return {
            id: row.id,
            created_at: row.created_at,
            actor: row.actor,
            overall: parseSeverity(row.metadata?.overall),
            issue_count: summary.issue_count,
            pass_checks: summary.pass_checks,
            warn_checks: summary.warn_checks,
            fail_checks: summary.fail_checks,
            generated_at: parseString(row.metadata?.generated_at) || null,
            checks: parseChecks(row.metadata),
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
