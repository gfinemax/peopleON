'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type InteractionType = 'CALL' | 'MEET' | 'SMS' | 'DOC';
export type Direction = 'Inbound' | 'Outbound';

interface LogInteractionState {
    success?: boolean;
    error?: string;
}

export async function logInteraction(
    prevState: LogInteractionState,
    formData: FormData
): Promise<LogInteractionState> {
    const supabase = await createClient();

    const memberId = formData.get('memberId') as string;
    const type = formData.get('type') as InteractionType;
    const direction = formData.get('direction') as Direction;
    const summary = formData.get('summary') as string;

    // TODO: Get actual logged-in user name
    const staffName = '관리자';

    if (!memberId || !type || !summary) {
        return { error: '필수 항목이 누락되었습니다.' };
    }

    try {
        const { error } = await supabase.from('interaction_logs').insert({
            member_id: memberId,
            type,
            direction,
            summary,
            staff_name: staffName,
        });

        if (error) {
            console.error('DB Insert Error:', error);
            return { error: '저장에 실패했습니다.' };
        }

        revalidatePath(`/members/${memberId}`);
        return { success: true };
    } catch (e) {
        console.error('Server Action Error:', e);
        return { error: '서버 오류가 발생했습니다.' };
    }
}
