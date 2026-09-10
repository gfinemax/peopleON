import { readAllPages } from '@/lib/supabase/readAllPages';
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/app/actions/audit';
import { revalidateUnifiedMembersTag } from '@/lib/server/cacheTags';
import { authzErrorResponse, requireRole, ROLE_GROUPS } from '@/lib/server/authz';

const MEMBER_CATEGORY_CODES = [
    '1차', '등기조합원', '2차', '지주조합원', '지주', '원지주',
    '예비조합원', '예비', '임시원장', '일반조합원', '일반분양', '일반', '3차',
    '권리증환불', '탈퇴예정', '미신고조합원',
];

const MEMBER_CATEGORY_VALUES: Record<string, { roleCode: string; isRegistered: boolean }> = {
    등기조합원: { roleCode: '등기조합원', isRegistered: true },
    지주조합원: { roleCode: '지주조합원', isRegistered: false },
    '2차': { roleCode: '2차', isRegistered: false },
    일반분양: { roleCode: '일반분양', isRegistered: false },
    예비조합원: { roleCode: '예비조합원', isRegistered: false },
    탈퇴예정: { roleCode: '탈퇴예정', isRegistered: false },
    권리증환불: { roleCode: '권리증환불', isRegistered: false },
    미신고조합원: { roleCode: '미신고조합원', isRegistered: false },
};

export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        await requireRole(ROLE_GROUPS.opsAdmin, supabase);
    } catch (error) {
        return authzErrorResponse(error);
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.id || !body.field) {
        return NextResponse.json({ success: false, error: 'id and field required' }, { status: 400 });
    }

    const { id, field, value, entity_ids } = body;
    // For role operations, use all entity_ids if provided (for merged members)
    const roleEntityIds: string[] = (entity_ids && entity_ids.length > 0) ? entity_ids : [id];

    try {
        if (field === 'member_category') {
            const nextCategory = MEMBER_CATEGORY_VALUES[String(value || '')];
            if (!nextCategory) {
                return NextResponse.json({ success: false, error: 'Invalid member category' }, { status: 400 });
            }

            const { error: deactivateError } = await supabase
                .from('membership_roles')
                .update({ role_status: 'inactive' })
                .in('entity_id', roleEntityIds)
                .in('role_code', MEMBER_CATEGORY_CODES);
            if (deactivateError) throw deactivateError;

            for (const entityId of roleEntityIds) {
                const { data: existingRows, error: existingError } = await readAllPages(supabase
                    .from('membership_roles')
                    .select('id')
                    .eq('entity_id', entityId)
                    .eq('role_code', nextCategory.roleCode).order('id', { ascending: true }));
                if (existingError) throw existingError;

                if (existingRows && existingRows.length > 0) {
                    const { error: activateError } = await supabase
                        .from('membership_roles')
                        .update({ role_status: 'active', is_registered: nextCategory.isRegistered })
                        .in('id', existingRows.map((row) => row.id));
                    if (activateError) throw activateError;
                } else {
                    const { error: insertError } = await supabase.from('membership_roles').insert({
                        entity_id: entityId,
                        role_code: nextCategory.roleCode,
                        role_status: 'active',
                        is_registered: nextCategory.isRegistered,
                    });
                    if (insertError) throw insertError;
                }
            }

            await Promise.all(roleEntityIds.map((entityId) => createAuditLog('UPDATE_MEMBER_ROLE', entityId, {
                new_role: nextCategory.roleCode,
                source: 'member_workspace',
            })));
        } else if (field === 'tier') {
            // Update role_code in membership_roles
            const { error } = await supabase
                .from('membership_roles')
                .update({ role_code: value })
                .eq('entity_id', id);

            if (error) throw error;

            await createAuditLog('UPDATE_MEMBER_ROLE', id, { new_role: value });

            // Optional: If value changes to '대리인' or something specific, we could handle it here.
        } else if (field === 'status') {
            const targetIds = (entity_ids && entity_ids.length > 0) ? entity_ids : [id];
            const { error: entityError } = await supabase
                .from('account_entities')
                .update({ status: value })
                .in('id', targetIds);

            if (entityError) throw entityError;

            await Promise.all(targetIds.map((eid: string) => createAuditLog('UPDATE_MEMBER_STATUS', eid, { new_status: value })));
        } else if (field === 'role') {
            // Not a direct table field but modifying membership_roles structure
            // e.g. toggle role
            const { action, role_code } = value; // value = { action: 'add'|'remove', role_code: '...' }

            // Map UI labels back to possible DB codes
            let dbCodes: string[] = [role_code];
            let insertCode = role_code;

            if (role_code === '등기조합원') {
                dbCodes = ['1차', '등기조합원', '2차', '지주조합원', '지주', '원지주', '예비조합원', '탈퇴예정', '임시원장', '일반조합원'];
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
            } else if (role_code === '미신고조합원') {
                dbCodes = ['미신고조합원'];
                insertCode = '미신고조합원';
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
                        .insert(roleEntityIds.map((eid: string) => ({
                            entity_id: eid,
                            role_code: insertCode,
                            role_status: 'inactive',
                            is_registered: insertCode === '1차' || insertCode === '등기조합원'
                        })));
                }

                await Promise.all(roleEntityIds.map((eid: string) => createAuditLog('UPDATE_MEMBER_ROLE', eid, { role_removed: role_code, target_code: insertCode })));
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
                        .insert(roleEntityIds.map((eid: string) => ({
                            entity_id: eid,
                            role_code: insertCode,
                            role_status: 'active',
                            is_registered: insertCode === '1차' || insertCode === '등기조합원'
                        })));
                }

                await Promise.all(roleEntityIds.map((eid: string) => createAuditLog('UPDATE_MEMBER_ROLE', eid, { role_added: role_code, insert_code: insertCode })));
            }
        } else {
            return NextResponse.json({ success: false, error: 'Invalid field' }, { status: 400 });
        }

        revalidatePath('/members');
        revalidateUnifiedMembersTag();
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Inline update failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
