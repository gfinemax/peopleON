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

    // Search by display_name, member_number, or phone
    const { data, error } = await supabase
        .from('account_entities')
        .select('id, display_name, member_number, phone')
        .or(`display_name.ilike.%${cleanQuery}%,member_number.ilike.%${cleanQuery}%,phone.ilike.%${cleanQuery}%`)
        .limit(10);

    if (error) {
        console.error('Search Members Error:', error);
        return [];
    }

    return (data || []).map((row: { id: string; display_name: string; member_number: string | null; phone: string | null }) => ({
        id: row.id,
        name: row.display_name,
        member_number: row.member_number || '',
        phone: row.phone,
        status: '정상',
    }));
}

export async function toggleFavoriteMember(memberId: string, isFavorite: boolean): Promise<boolean> {
    const supabase = await createClient();

    const { error } = await supabase
        .from('account_entities')
        .update({ is_favorite: isFavorite })
        .eq('id', memberId);

    if (error) {
        console.error('Toggle Favorite Error:', error);
        return false;
    }

    return true;
}
