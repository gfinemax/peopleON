import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let adminClient: ReturnType<typeof createSupabaseClient> | null = null;
let warnedAboutAdminFallback = false;

export function createAdminClient() {
    if (adminClient) {
        return adminClient;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const activeKey = serviceRoleKey || anonKey;

    if (!url || !activeKey) {
        throw new Error('Missing Supabase configuration');
    }

    if (!serviceRoleKey && !warnedAboutAdminFallback) {
        warnedAboutAdminFallback = true;
        console.warn('SUPABASE_SERVICE_ROLE_KEY is missing. Falling back to anon client for server reads.');
    }

    adminClient = createSupabaseClient(
        url,
        activeKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        },
    );

    return adminClient;
}
