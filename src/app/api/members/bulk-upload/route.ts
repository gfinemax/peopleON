import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const supabase = await createClient();

    const body = await request.json().catch(() => null);
    if (!body || !body.members || !Array.isArray(body.members)) {
        return NextResponse.json({ success: false, error: 'Members array is required' }, { status: 400 });
    }

    const { members } = body;

    try {
        let successCount = 0;

        // Using a simple loop for safety across two tables
        for (const m of members) {
            if (!m.name) continue;

            const { data: entity, error: entityError } = await supabase
                .from('account_entities')
                .insert({
                    display_name: m.name,
                    phone: m.phone || null,
                    member_number: m.member_number || null,
                    unit_group: m.unit_group || null,
                    address_legal: m.address_legal || null,
                    memo: m.memo || null,
                    entity_type: 'person',
                    status: '정상'
                })
                .select('id')
                .single();

            if (entityError) {
                console.error(`Error inserting ${m.name}:`, entityError);
                continue;
            }

            // Insert right if provided
            if (m.right_number) {
                const { error: rightError } = await supabase
                    .from('asset_rights')
                    .insert({
                        entity_id: entity.id,
                        right_number: m.right_number,
                        right_type: 'certificate'
                    });
                if (rightError) console.error(`Error inserting asset right for ${m.name}:`, rightError);
            }

            if (m.tier) {
                let roleCode = m.tier;
                if (m.tier === '1차') roleCode = '등기조합원';

                const { error: roleError } = await supabase
                    .from('membership_roles')
                    .insert({
                        entity_id: entity.id,
                        role_code: roleCode,
                        role_status: 'active',
                        is_registered: roleCode === '등기조합원'
                    });

                if (roleError) console.error(`Error inserting role for ${m.name}:`, roleError);
            }

            successCount++;
        }

        return NextResponse.json({ success: true, count: successCount });
    } catch (error: any) {
        console.error('Bulk upload error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
