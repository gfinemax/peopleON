import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { revalidateUnifiedMembersTag } from '@/lib/server/cacheTags';

export function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseAmount(value: FormDataEntryValue | null) {
    if (typeof value !== 'string') return 0;
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : 0;
}

export function parsePositiveInt(value: FormDataEntryValue | null, fallback: number, min = 1, max = 5000) {
    if (typeof value !== 'string') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.floor(parsed), min), max);
}

export function chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

export function extractUserRole(user: {
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
}) {
    const appRole = typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : '';
    const userRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : '';
    return (appRole || userRole || '').trim().toLowerCase();
}

export async function ensureSettlementPermission() {
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

export async function writeSettlementAuditLog({
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

export function revalidateSettlementPages() {
    revalidatePath('/settlements');
    revalidatePath('/payments');
    revalidatePath('/members');
    revalidateUnifiedMembersTag();
}
