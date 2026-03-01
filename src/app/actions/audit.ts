'use server';

import { createClient as createAdminClient } from '@supabase/supabase-js';

// 민감한 정보 열람/수정 내역을 기록하는 보안 서버 액션
export async function createAuditLog(
    actionType: string,
    targetEntityId?: string,
    details?: any
) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error('Audit Log Error: Missing Supabase keys');
        return { error: 'Server configuration error' };
    }

    try {
        // Find current user using regular client
        const { createClient } = await import('@/lib/supabase/server');
        const supabaseUserClient = await createClient();
        const { data: { user } } = await supabaseUserClient.auth.getUser();

        const actorEmail = user?.email || 'System (Unauthenticated)';

        // Admin client to bypass RLS for writing logs
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const ipAddress = 'unknown (server action)';

        const { error } = await supabaseAdmin.from('system_audit_logs').insert({
            actor_email: actorEmail,
            action_type: actionType,
            target_entity_id: targetEntityId || null,
            details: details || {},
            ip_address: ipAddress
        });

        if (error) {
            console.error('Failed to insert audit log:', error);
            return { error: 'Audit log insert failed' };
        }

        return { success: true };
    } catch (e) {
        console.error('Failed to create audit log Exception:', e);
        return { error: 'Internal server error during audit logging' };
    }
}
