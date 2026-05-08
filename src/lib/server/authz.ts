import 'server-only';

import type { SupabaseClient, User } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const APP_ROLES = {
    superAdmin: 'super_admin',
    admin: 'admin',
    financeManager: 'finance_manager',
    opsManager: 'ops_manager',
    staff: 'staff',
} as const;

export const ROLE_GROUPS = {
    admin: [APP_ROLES.superAdmin, APP_ROLES.admin],
    financeAdmin: [APP_ROLES.superAdmin, APP_ROLES.admin, APP_ROLES.financeManager],
    opsAdmin: [APP_ROLES.superAdmin, APP_ROLES.admin, APP_ROLES.financeManager, APP_ROLES.opsManager],
    staff: [APP_ROLES.superAdmin, APP_ROLES.admin, APP_ROLES.financeManager, APP_ROLES.opsManager, APP_ROLES.staff],
} as const;

export type AppRole = string;

export class AuthorizationError extends Error {
    status: 401 | 403;

    constructor(status: 401 | 403, message: string) {
        super(message);
        this.name = 'AuthorizationError';
        this.status = status;
    }
}

const normalizeRole = (value: unknown): AppRole | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase().replace(/-/g, '_');
    return normalized || null;
};

const getAdminEmailFallbacks = () =>
    new Set(
        [
            'gfinemax@gmail.com',
            ...(process.env.ADMIN_EMAILS || '')
                .split(',')
                .map((email) => email.trim().toLowerCase())
                .filter(Boolean),
        ],
    );

export function getAppRole(user: User | null | undefined): AppRole | null {
    if (!user) return null;

    const metadataRole = (
        normalizeRole(user.app_metadata?.role) ||
        normalizeRole(user.user_metadata?.role) ||
        normalizeRole((user as unknown as { role?: unknown }).role)
    );

    if (metadataRole) return metadataRole;

    if (user.email && getAdminEmailFallbacks().has(user.email.toLowerCase())) {
        return APP_ROLES.superAdmin;
    }

    return null;
}

export function isAllowedRole(role: AppRole | null, allowedRoles: readonly string[]) {
    return Boolean(role && allowedRoles.includes(role));
}

export async function requireRole(
    allowedRoles: readonly string[],
    supabase?: SupabaseClient,
) {
    const activeClient = supabase || await createClient();
    const {
        data: { user },
        error,
    } = await activeClient.auth.getUser();

    if (error || !user) {
        throw new AuthorizationError(401, 'Unauthorized');
    }

    const role = getAppRole(user);
    if (!isAllowedRole(role, allowedRoles)) {
        throw new AuthorizationError(403, 'Forbidden');
    }

    return { supabase: activeClient, user, role };
}

export async function requirePageRole(allowedRoles: readonly string[], forbiddenRedirect = '/') {
    try {
        return await requireRole(allowedRoles);
    } catch (error) {
        if (error instanceof AuthorizationError && error.status === 401) {
            redirect('/login');
        }
        redirect(forbiddenRedirect);
    }
}

export function authzErrorResponse(error: unknown) {
    if (error instanceof AuthorizationError) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: error.status },
        );
    }

    throw error;
}
