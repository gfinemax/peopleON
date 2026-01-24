'use server';

import { createClient } from '@/lib/supabase/server';

export interface SearchResult {
    id: string;
    name: string;
    member_number: string;
    phone: string | null;
    status: string;
}

export async function searchMembers(query: string): Promise<SearchResult[]> {
    if (!query || query.trim().length < 1) return [];

    const supabase = await createClient();
    const cleanQuery = query.trim();

    // Search by name, member_number, or phone
    const { data, error } = await supabase
        .from('members')
        .select('id, name, member_number, phone, status')
        .or(`name.ilike.%${cleanQuery}%,member_number.ilike.%${cleanQuery}%,phone.ilike.%${cleanQuery}%`)
        .limit(10); // Limit results for performance

    if (error) {
        console.error('Search Members Error:', error);
        return [];
    }

    return data || [];
}
