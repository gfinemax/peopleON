'use server';

import { revalidatePath, updateTag } from 'next/cache';

import { CACHE_TAGS } from '@/lib/server/cacheTags';
import { createClient } from '@/lib/supabase/server';

export async function refreshDashboardCertificateConflicts() {
    const supabase = await createClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        updateTag(CACHE_TAGS.unifiedMembers);
    } catch (updateError) {
        console.error('Failed to expire unified members cache immediately:', updateError);
    }

    revalidatePath('/');
    revalidatePath('/members');
    revalidatePath('/certificate-audit');

    return { success: true };
}
