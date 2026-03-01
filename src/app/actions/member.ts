'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/app/actions/audit';

export interface MemberActionState {
    success?: boolean;
    error?: string;
    syncStatus?: 'ok' | 'failed' | 'skipped';
    syncMessage?: string;
}

export async function updateMember(
    prevState: MemberActionState,
    formData: FormData
): Promise<MemberActionState> {
    void prevState;

    const supabase = await createClient();

    const id = formData.get('id') as string;
    const name = formData.get('name') as string;
    const member_number = formData.get('member_number') as string;
    const phone = formData.get('phone') as string;
    const tier = formData.get('tier') as string;
    const status = formData.get('status') as string;
    const unit_group = formData.get('unit_group') as string;
    const memo = formData.get('memo') as string;

    if (!id || !name) {
        return { error: '필수 항목이 누락되었습니다.' };
    }

    try {
        // Update account_entities
        const { error: entityError } = await supabase
            .from('account_entities')
            .update({
                display_name: name,
                member_number,
                phone,
                unit_group,
                memo,
            })
            .eq('id', id);

        if (entityError) {
            console.error('DB Update Error:', entityError);
            return { error: '저장에 실패했습니다.' };
        }

        // Update membership_roles if tier/status changed
        if (tier || status) {
            const roleUpdate: Record<string, unknown> = {};
            if (tier) roleUpdate.role_code = tier;
            if (status === '탈퇴') roleUpdate.role_status = 'inactive';
            else if (status) roleUpdate.role_status = 'active';

            await supabase
                .from('membership_roles')
                .update(roleUpdate)
                .eq('entity_id', id);
        }

        // Add Audit Log
        await createAuditLog(
            'MEMBER_UPDATE',
            id,
            {
                name,
                member_number,
                phone,
                tier,
                status,
                unit_group,
                memo
            }
        );

        revalidatePath(`/members/${id}`);
        revalidatePath('/members');
        revalidatePath('/settlements');
        revalidatePath('/payments');
        revalidatePath('/finance');
        return { success: true, syncStatus: 'ok', syncMessage: '저장 완료' };
    } catch (e) {
        console.error('Server Action Error:', e);
        return { error: '서버 오류가 발생했습니다.' };
    }
}
