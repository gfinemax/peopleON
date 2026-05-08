'use server';

import { revalidatePath } from 'next/cache';
import type { User } from '@supabase/supabase-js';
import { createAuditLog } from '@/app/actions/audit';
import { APP_ROLES, getAppRole, requireRole, ROLE_GROUPS } from '@/lib/server/authz';
import { createAdminClient } from '@/lib/supabase/admin';

const assignableRoles = [
    APP_ROLES.admin,
    APP_ROLES.financeManager,
    APP_ROLES.opsManager,
    APP_ROLES.staff,
] as const;

export type AssignableUserRole = (typeof assignableRoles)[number];

export type AdminUserListItem = {
    id: string;
    email: string;
    name: string | null;
    role: string | null;
    rawRole: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
};

export type UpdateUserRoleState = {
    success?: boolean;
    error?: string;
    userId?: string;
    role?: AssignableUserRole;
};

function isAssignableRole(value: unknown): value is AssignableUserRole {
    return typeof value === 'string' && assignableRoles.includes(value as AssignableUserRole);
}

function toAdminUserListItem(user: User): AdminUserListItem {
    return {
        id: user.id,
        email: user.email || '(email missing)',
        name:
            typeof user.user_metadata?.name === 'string'
                ? user.user_metadata.name
                : typeof user.user_metadata?.full_name === 'string'
                  ? user.user_metadata.full_name
                  : null,
        role: getAppRole(user),
        rawRole: typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : null,
        createdAt: user.created_at || null,
        lastSignInAt: user.last_sign_in_at || null,
    };
}

function countAdminCapableUsers(users: User[]) {
    const adminRoles: readonly string[] = ROLE_GROUPS.admin;
    return users.filter((user) => adminRoles.includes(getAppRole(user) || '')).length;
}

export async function listAdminUsers(): Promise<AdminUserListItem[]> {
    await requireRole(ROLE_GROUPS.admin);

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
    });

    if (error) {
        throw new Error(error.message);
    }

    return (data.users || [])
        .map(toAdminUserListItem)
        .sort((left, right) => left.email.localeCompare(right.email));
}

export async function updateUserRole(userId: string, role: AssignableUserRole): Promise<UpdateUserRoleState> {
    const { user: actor } = await requireRole(ROLE_GROUPS.admin);

    if (!userId || !isAssignableRole(role)) {
        return { error: '유효한 사용자와 권한이 필요합니다.' };
    }

    const supabaseAdmin = createAdminClient();
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
    });

    if (usersError) {
        return { error: usersError.message };
    }

    const users = usersData.users || [];
    const targetUser = users.find((candidate) => candidate.id === userId);
    if (!targetUser) {
        return { error: '사용자를 찾을 수 없습니다.' };
    }

    const previousRole = getAppRole(targetUser);
    const adminCount = countAdminCapableUsers(users);
    const adminRoles: readonly string[] = ROLE_GROUPS.admin;
    const targetWasAdmin = adminRoles.includes(previousRole || '');
    const targetWillBeAdmin = adminRoles.includes(role);

    if (targetWasAdmin && !targetWillBeAdmin && adminCount <= 1) {
        return { error: '마지막 관리자 계정은 강등할 수 없습니다.' };
    }

    if (actor.id === userId && targetWasAdmin && !targetWillBeAdmin) {
        return { error: '본인 관리자 권한은 직접 낮출 수 없습니다.' };
    }

    const nextAppMetadata = {
        ...(targetUser.app_metadata || {}),
        role,
    };

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        app_metadata: nextAppMetadata,
    });

    if (updateError) {
        return { error: updateError.message };
    }

    await createAuditLog('UPDATE_USER_ROLE', undefined, {
        target_user_id: userId,
        target_email: targetUser.email,
        previous_role: previousRole,
        new_role: role,
    });

    revalidatePath('/admin/users');
    return { success: true, userId, role };
}
