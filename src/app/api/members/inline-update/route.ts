import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.id || !body.field) {
        return NextResponse.json({ success: false, error: 'id and field required' }, { status: 400 });
    }

    const { id, field, value, entity_ids } = body;
    // For role operations, use all entity_ids if provided (for merged members)
    const roleEntityIds: string[] = (entity_ids && entity_ids.length > 0) ? entity_ids : [id];

    try {
        if (field === 'tier') {
            // Update role_code in membership_roles
            const { error } = await supabase
                .from('membership_roles')
                .update({ role_code: value })
                .eq('entity_id', id);

            if (error) throw error;

            // Optional: If value changes to '대리인' or something specific, we could handle it here.
        } else if (field === 'status') {
            // Update status in account_entities
            const { error: entityError } = await supabase
                .from('account_entities')
                .update({ status: value })
                .eq('id', id);

            if (entityError) throw entityError;
        } else if (field === 'role') {
            // Not a direct table field but modifying membership_roles structure
            // e.g. toggle role
            const { action, role_code } = value; // value = { action: 'add'|'remove', role_code: '...' }

            // Map UI labels back to possible DB codes
            let dbCodes: string[] = [role_code];
            let insertCode = role_code;

            if (role_code === '등기조합원') {
                dbCodes = ['1차', '등기조합원', '2차', '지주조합원', '지주', '원지주', '예비조합원', '임시원장', '일반조합원'];
                insertCode = '1차';
            } else if (role_code === '일반분양') {
                dbCodes = ['일반분양', '일반', '3차'];
                insertCode = '일반분양';
            } else if (role_code === '원지주' || role_code === '지주' || role_code === '지주조합원') {
                dbCodes = ['원지주', '지주', '지주조합원'];
                insertCode = '지주조합원';
            } else if (role_code === '대리인') {
                dbCodes = ['대리인', '대리'];
                insertCode = '대리인';
            } else if (role_code === '예비조합원') {
                dbCodes = ['예비조합원', '예비'];
                insertCode = '예비조합원';
            } else if (role_code === '권리증보유자') {
                dbCodes = ['권리증보유자', '권리증', '권리증환불', '비조합원권리증'];
                insertCode = '권리증보유자';
            } else if (role_code === '2차') {
                dbCodes = ['2차'];
                insertCode = '2차';
            } else if (role_code === '관계인') {
                dbCodes = ['관계인'];
                insertCode = '관계인';
            }

            if (action === 'remove') {
                const { data: updated } = await supabase
                    .from('membership_roles')
                    .update({ role_status: 'inactive' })
                    .in('entity_id', roleEntityIds)
                    .in('role_code', dbCodes)
                    .select('id');

                // If nothing was updated, we insert an inactive record to act as an override for derived roles
                if (!updated || updated.length === 0) {
                    await supabase
                        .from('membership_roles')
                        .insert(roleEntityIds.map(eid => ({
                            entity_id: eid,
                            role_code: insertCode,
                            role_status: 'inactive',
                            is_registered: insertCode === '1차' || insertCode === '등기조합원'
                        })));
                }
            } else if (action === 'add') {
                const { data: updated } = await supabase
                    .from('membership_roles')
                    .update({ role_status: 'active' })
                    .in('entity_id', roleEntityIds)
                    .in('role_code', dbCodes)
                    .select('id');

                if (!updated || updated.length === 0) {
                    await supabase
                        .from('membership_roles')
                        .insert(roleEntityIds.map(eid => ({
                            entity_id: eid,
                            role_code: insertCode,
                            role_status: 'active',
                            is_registered: insertCode === '1차' || insertCode === '등기조합원'
                        })));
                }
            }
        } else {
            return NextResponse.json({ success: false, error: 'Invalid field' }, { status: 400 });
        }

        revalidatePath('/members');
        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('Inline update failed:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
