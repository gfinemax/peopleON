'use server';

import { createClient } from '@/lib/supabase/server';
import { getCertificateDisplayText } from '@/lib/certificates/rightNumbers';

export interface SearchResult {
    id: string;
    name: string;
    member_number: string;
    certificate_display?: string;
    phone: string | null;
    status: string;
}

export async function searchMembers(query: string): Promise<SearchResult[]> {
    if (!query || query.trim().length < 1) return [];

    const supabase = await createClient();
    const cleanQuery = query.trim();

    const [entitiesRes, rightsRes] = await Promise.all([
        supabase
            .from('account_entities')
            .select('id, display_name, member_number, phone, phone_secondary')
            .or(`display_name.ilike.%${cleanQuery}%,member_number.ilike.%${cleanQuery}%,phone.ilike.%${cleanQuery}%,phone_secondary.ilike.%${cleanQuery}%`)
            .limit(10),
        supabase
            .from('asset_rights')
            .select(`
                entity_id,
                right_type,
                right_number,
                right_number_raw,
                right_number_status,
                account_entities (
                    id,
                    display_name,
                    member_number,
                    phone,
                    phone_secondary
                )
            `)
            .eq('right_type', 'certificate')
            .or(`right_number.ilike.%${cleanQuery}%,right_number_raw.ilike.%${cleanQuery}%`)
            .limit(10),
    ]);

    if (entitiesRes.error) {
        console.error('Search Members Error:', entitiesRes.error);
        return [];
    }

    if (rightsRes.error) {
        console.error('Search Rights Error:', rightsRes.error);
    }

    const resultMap = new Map<string, SearchResult & { rights: Array<Record<string, unknown>> }>();
    for (const row of ((entitiesRes.data as Array<{ id: string; display_name: string; member_number: string | null; phone: string | null; phone_secondary: string | null }> | null) || [])) {
        resultMap.set(row.id, {
            id: row.id,
            name: row.display_name,
            member_number: row.member_number || '',
            certificate_display: '',
            phone: row.phone || row.phone_secondary,
            status: '정상',
            rights: [],
        });
    }

    for (const row of ((rightsRes.data as Array<any> | null) || [])) {
        const entity = Array.isArray(row.account_entities) ? row.account_entities[0] : row.account_entities;
        if (!entity?.id) continue;

        const existing: SearchResult & { rights: Array<Record<string, unknown>> } = resultMap.get(entity.id) || {
            id: entity.id,
            name: entity.display_name,
            member_number: entity.member_number || '',
            certificate_display: '',
            phone: entity.phone || entity.phone_secondary || null,
            status: '정상',
            rights: [],
        };

        existing.rights.push(row);
        resultMap.set(entity.id, existing);
    }

    return Array.from(resultMap.values())
        .map((row) => ({
            id: row.id,
            name: row.name,
            member_number: row.member_number,
            certificate_display: getCertificateDisplayText(row.rights, { includeFallbackStatus: true }),
            phone: row.phone,
            status: row.status,
        }))
        .slice(0, 10);
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
