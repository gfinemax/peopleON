import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { classifyCertificateInput } from '@/lib/certificates/rightNumbers';
import { revalidateUnifiedMembersTag } from '@/lib/server/cacheTags';

export async function POST(request: Request) {
    const supabase = await createClient();

    const body = await request.json().catch(() => null);
    if (!body || !body.name) {
        return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });
    }

    const formatPhone = (val: string | null | undefined) => {
        if (!val) return null;
        const items = val.split(',').map((v: string) => v.trim()).filter(Boolean);
        const formatted = items.map((item: string) => {
            const cleaned = item.replace(/\D/g, '');
            if (cleaned.length === 11) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
            if (cleaned.length === 10) return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
            return item;
        });
        return formatted.join(', ');
    };

    const { name, phone, secondary_phone, member_number, right_number, tier, unit_group, address_legal, memo, birth_date } = body;

    try {
        // 1. Create account_entity
        const { data: entity, error: entityError } = await supabase
            .from('account_entities')
            .insert({
                display_name: name,
                phone: formatPhone(phone),
                phone_secondary: formatPhone(secondary_phone),
                member_number: member_number || null,
                unit_group: unit_group || null,
                address_legal: address_legal || null,
                memo: memo || null,
                birth_date: birth_date || null,
                entity_type: 'person',
                status: '정상'
            })
            .select('id')
            .single();

        if (entityError) throw entityError;

        // 2. Create asset_right if right_number is provided
        if (right_number) {
            const classifiedRight = classifyCertificateInput(right_number);
            const { error: rightError } = await supabase
                .from('asset_rights')
                .insert({
                    entity_id: entity.id,
                    right_number: classifiedRight.confirmedNumber,
                    right_number_raw: classifiedRight.rawValue,
                    right_number_status: classifiedRight.status,
                    right_number_note: classifiedRight.note,
                    classification_source: 'auto',
                    classified_at: new Date().toISOString(),
                    right_type: 'certificate'
                });

            if (rightError) console.error('Error creating asset right:', rightError);
        }

        // 3. Create membership_role if tier is provided
        if (tier) {
            // Map common aliases to canonical codes if needed (though UI should send clean values)
            let roleCode = tier;
            if (tier === '1차') roleCode = '등기조합원';

            const { error: roleError } = await supabase
                .from('membership_roles')
                .insert({
                    entity_id: entity.id,
                    role_code: roleCode,
                    role_status: 'active',
                    is_registered: roleCode === '등기조합원'
                });

            if (roleError) throw roleError;
        }

        // 4. Create entity_private_info if resident_registration_number is provided
        if (body.resident_registration_number) {
            const { error: privateError } = await supabase
                .from('entity_private_info')
                .insert({
                    entity_id: entity.id,
                    resident_registration_number: body.resident_registration_number.trim()
                });

            if (privateError) console.error('Error creating private info:', privateError);
        }

        revalidateUnifiedMembersTag();
        return NextResponse.json({ success: true, id: entity.id });
    } catch (error: unknown) {
        console.error('Error creating member:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
