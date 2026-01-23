'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface MemberActionState {
    success?: boolean;
    error?: string;
}

export async function updateMember(
    prevState: MemberActionState,
    formData: FormData
): Promise<MemberActionState> {
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
        const { error } = await supabase
            .from('members')
            .update({
                name,
                member_number,
                phone,
                tier,
                status,
                unit_group,
                memo,
            })
            .eq('id', id);

        if (error) {
            console.error('DB Update Error:', error);
            return { error: '저장에 실패했습니다.' };
        }

        revalidatePath(`/members/${id}`);
        revalidatePath('/members');
        return { success: true };
    } catch (e) {
        console.error('Server Action Error:', e);
        return { error: '서버 오류가 발생했습니다.' };
    }
}
