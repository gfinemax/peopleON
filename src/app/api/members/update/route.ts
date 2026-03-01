import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/app/actions/audit';

type MemberUpdatePayload = {
    id?: string;
    ids?: string[]; // Multiple IDs for merged members
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address_legal?: string | null;
    memo?: string | null;
    role_code?: string | null;
    representative?: {
        id?: string;
        name?: string | null;
        relation?: string | null;
        phone?: string | null;
    } | null;
};

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as MemberUpdatePayload | null;

    // Support both single id and multiple ids
    let targetIds: string[] = [];
    if (body?.ids && Array.isArray(body.ids)) {
        targetIds = body.ids.filter(Boolean);
    } else if (typeof body?.id === 'string' && body.id.trim()) {
        targetIds = [body.id.trim()];
    }

    if (targetIds.length === 0) {
        return NextResponse.json({ success: false, error: '유효한 member ID가 필요합니다.' }, { status: 400 });
    }

    const formatPhone = (val: string | null | undefined) => {
        if (!val) return null;
        const items = val.split(',').map(v => v.trim()).filter(Boolean);
        const formatted = items.map(item => {
            const cleaned = item.replace(/\D/g, '');
            if (cleaned.length === 11) {
                return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
            } else if (cleaned.length === 10) {
                return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
            }
            return item;
        });
        return formatted.join(', ');
    };

    // 1. Update basic info in account_entities
    const patch: Record<string, unknown> = {};
    if (typeof body?.name === 'string') patch.display_name = body.name.trim() || null;
    if (typeof body?.phone === 'string') patch.phone = formatPhone(body.phone);
    if (typeof body?.email === 'string') patch.email = body.email.trim() || null;
    if (typeof body?.address_legal === 'string') patch.address_legal = body.address_legal.trim() || null;
    if (typeof body?.memo === 'string') patch.memo = body.memo.trim() || null;

    if (patch.display_name === null && typeof body?.name === 'string') {
        return NextResponse.json({ success: false, error: '성명은 필수입니다.' }, { status: 400 });
    }

    if (Object.keys(patch).length > 0) {
        const { error: updateError } = await supabase
            .from('account_entities')
            .update(patch)
            .in('id', targetIds);

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }
    }

    // 2. Update role_code in membership_roles
    if (typeof body?.role_code === 'string') {
        const { error: roleError } = await supabase
            .from('membership_roles')
            .update({ role_code: body.role_code })
            .in('entity_id', targetIds);

        if (roleError) console.error('Role update error:', roleError);
    }

    // 3. Update or Create or Delete representative
    if (body && body.representative !== undefined) {
        const rep = body.representative;
        if (rep === null) {
            // Delete the relationship
            const { error: deleteError } = await supabase
                .from('entity_relationships')
                .delete()
                .in('to_entity_id', targetIds)
                .eq('relation_type', 'agent');

            if (deleteError) console.error('Representative delete error:', deleteError);
        } else {
            const repName = typeof rep.name === 'string' ? rep.name.trim() : null;
            const repPhone = typeof rep.phone === 'string' ? formatPhone(rep.phone) : null;
            const repRelation = typeof rep.relation === 'string' ? rep.relation.trim() : null;

            if (rep.id) {
                // Update existing agent
                const repPatch: Record<string, string | null> = {};
                if (repName !== null) repPatch.display_name = repName;
                if (repPhone !== null) repPatch.phone = repPhone;

                if (Object.keys(repPatch).length > 0) {
                    const { error: relError } = await supabase
                        .from('account_entities')
                        .update(repPatch)
                        .eq('id', rep.id);
                    if (relError) console.error('Representative info update error:', relError);
                }

                if (repRelation !== null) {
                    const { error: relationError } = await supabase
                        .from('entity_relationships')
                        .update({ relation_note: repRelation })
                        .eq('from_entity_id', rep.id)
                        .in('to_entity_id', targetIds)
                        .eq('relation_type', 'agent');
                    if (relationError) console.error('Representative relation update error:', relationError);
                }
            } else if (repName || repPhone) {
                // Create new agent
                const { data: newAgent, error: createError } = await supabase
                    .from('account_entities')
                    .insert({
                        entity_type: 'person',
                        display_name: repName || '새 대리인',
                        phone: repPhone,
                    })
                    .select('id')
                    .single();

                if (createError || !newAgent) {
                    console.error('Representative create error:', createError);
                } else {
                    const results = await Promise.all(targetIds.map(tid =>
                        supabase
                            .from('entity_relationships')
                            .insert({
                                from_entity_id: newAgent.id,
                                to_entity_id: tid,
                                relation_type: 'agent',
                                relation_note: repRelation || '대리인'
                            })
                    ));
                    const errors = results.filter(r => r.error);
                    if (errors.length > 0) console.error('Representative map error:', errors[0].error);
                }
            }
        }
    }

    return NextResponse.json({
        success: true,
        member: {
            ids: targetIds,
            ...patch,
        },
    });
}
