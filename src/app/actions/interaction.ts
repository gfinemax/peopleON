'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/app/actions/audit';
import { normalizeCertificateNumber } from '@/lib/certificates/rightNumbers';
import { revalidateActivityFeedTag } from '@/lib/server/cacheTags';

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
    const supabase = await createServerClient();

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
            entity_id: memberId,
            type,
            direction,
            summary,
            staff_name: staffName,
        });

        if (error) {
            console.error('DB Insert Error:', error);
            return { error: '저장에 실패했습니다.' };
        }

        // Add Audit Log
        await createAuditLog('ADD_INTERACTION_LOG', memberId, { type, direction, summary });

        revalidatePath(`/members/${memberId}`);
        revalidateActivityFeedTag();
        return { success: true };
    } catch (e) {
        console.error('Server Action Error:', e);
        return { error: '서버 오류가 발생했습니다.' };
    }
}

export async function logSystemInteraction(memberId: string, summary: string) {
    if (!memberId || !summary) return { error: '필수 항목 누락' };

    try {
        const supabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { error } = await supabase.from('interaction_logs').insert({
            entity_id: memberId,
            type: 'DOC',
            direction: 'Inbound',
            summary,
            staff_name: 'System',
        });

        if (error) {
            console.error('System Log Insert Error:', error);
            return { error: '저장 실패' };
        }

        // Add Audit Log
        await createAuditLog('SYSTEM_INTERACTION_LOG', memberId, { summary });

        revalidatePath(`/members/${memberId}`);
        revalidateActivityFeedTag();
        return { success: true };
    } catch (e) {
        console.error('System Log Server Error:', e);
        return { error: '서버 오류' };
    }
}

export async function checkAndLogAssetRightConflicts(
    currentIds: string[],
    newlyChangedRightNumbers: string[]
) {
    if (!currentIds || currentIds.length === 0 || !newlyChangedRightNumbers || newlyChangedRightNumbers.length === 0) {
        return { success: false, error: '잘못된 인자값입니다.' };
    }

    try {
        const supabase = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        ); // Admin client bypasses client RLS

        const normalizedChangedNumbers = Array.from(
            new Set(
                newlyChangedRightNumbers
                    .map((value) => normalizeCertificateNumber(value))
                    .filter(Boolean),
            ),
        );

        if (normalizedChangedNumbers.length === 0) {
            return { success: false, error: '유효한 권리증 번호가 없습니다.' };
        }

        const { data: allSameRights, error } = await supabase
            .from('certificate_registry')
            .select('entity_id, certificate_number_raw, certificate_number_normalized')
            .eq('is_active', true)
            .in('certificate_number_normalized', normalizedChangedNumbers);

        if (error || !allSameRights) {
            console.error('System Log Check Error:', error);
            return { error: '조회 실패' };
        }

        const entityIds = Array.from(new Set(allSameRights.map((row) => row.entity_id).filter(Boolean)));
        const { data: entities, error: entityError } = await supabase
            .from('account_entities')
            .select('id, display_name')
            .in('id', entityIds);

        if (entityError) {
            console.error('Entity lookup error:', entityError);
            return { error: '이름 조회 실패' };
        }

        const conflictingRights = allSameRights.filter(c => !currentIds.includes(c.entity_id));
        const uniqueConflictingNumbers = Array.from(
            new Set(conflictingRights.map((c) => c.certificate_number_normalized || '').filter(Boolean)),
        );

        // Build a map of entity_id -> display_name for easy lookup
        const nameMap: Record<string, string> = {};
        (entities || []).forEach((entity) => {
            nameMap[entity.id] = entity.display_name || '알 수 없음';
        });

        // Resolve current and other names for the logs
        const currentNames = currentIds.map(id => nameMap[id] || '알 수 없음').join(', ');

        for (const conflictNum of uniqueConflictingNumbers) {
            const matchingRows = conflictingRights.filter(
                (c) => (c.certificate_number_normalized || '') === conflictNum,
            );
            const displayNumber =
                matchingRows.find((row) => row.certificate_number_raw)?.certificate_number_raw || conflictNum;
            const otherEntityIds = Array.from(new Set(matchingRows.map(c => c.entity_id)));
            const otherNames = otherEntityIds.map(id => nameMap[id] || '알 수 없음').join(', ');

            // Log for current user(s)
            for (const currentId of currentIds) {
                const summaryMsg = `[시스템 알림] 다른 회원(${otherNames})과 동일한 권리증 번호(${displayNumber})가 등록(저장)되었습니다. 권리자 확인 바랍니다.`;
                const appendText = `\n\n${summaryMsg}`;

                const { data: ent } = await supabase.from('account_entities').select('memo').eq('id', currentId).single();
                const currentMemo = ent?.memo || '';
                const newMemo = currentMemo ? currentMemo + appendText : summaryMsg;

                const { error: upd1 } = await supabase.from('account_entities').update({ memo: newMemo }).eq('id', currentId);

                if (upd1) {
                    console.error('Update currentId memo error:', upd1);
                } else {
                    await createAuditLog('CONFLICT_ALERT', currentId, { summary: summaryMsg, conflictNum: displayNumber, otherNames });
                }
            }

            // Log for conflicting others
            for (const otherId of otherEntityIds) {
                const summaryMsg = `[시스템 알림] 다른 회원(${currentNames})과 동일한 권리증 번호(${displayNumber})가 등록(저장)되었습니다. 권리자 확인 바랍니다.`;
                const appendText = `\n\n${summaryMsg}`;

                const { data: ent } = await supabase.from('account_entities').select('memo').eq('id', otherId).single();
                const currentMemo = ent?.memo || '';
                const newMemo = currentMemo ? currentMemo + appendText : summaryMsg;

                const { error: upd2 } = await supabase.from('account_entities').update({ memo: newMemo }).eq('id', otherId);

                if (upd2) {
                    console.error('Update otherId memo error:', upd2);
                } else {
                    await createAuditLog('CONFLICT_ALERT', otherId, { summary: summaryMsg, conflictNum: displayNumber, otherNames: currentNames });
                }
            }
        }

        return { success: true, count: uniqueConflictingNumbers.length };
    } catch (e) {
        console.error('System Log Conflict Server Error:', e);
        return { error: '서버 측 오류' };
    }
}
