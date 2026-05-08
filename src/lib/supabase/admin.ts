import 'server-only';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
    if (adminClient) {
        return adminClient;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error('Missing Supabase configuration');
    }

    adminClient = createSupabaseClient(
        url,
        serviceRoleKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        },
    );

    return adminClient;
}
