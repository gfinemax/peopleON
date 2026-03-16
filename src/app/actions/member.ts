'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/app/actions/audit';
import { revalidateUnifiedMembersTag } from '@/lib/server/cacheTags';

export interface MemberActionState {
    success?: boolean;
    error?: string;
    syncStatus?: 'ok' | 'failed' | 'skipped';
    syncMessage?: string;
}

export interface DeleteMemberActionState {
    success?: boolean;
    error?: string;
    deletedIds?: string[];
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
    const secondary_phone = formData.get('secondary_phone') as string;
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
                phone_secondary: secondary_phone,
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
                secondary_phone,
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
        revalidatePath('/certificate-audit');
        revalidateUnifiedMembersTag();
        return { success: true, syncStatus: 'ok', syncMessage: '저장 완료' };
    } catch (e) {
        console.error('Server Action Error:', e);
        return { error: '서버 오류가 발생했습니다.' };
    }
}

export async function deleteMemberEntities(entityIds: string[]): Promise<DeleteMemberActionState> {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return { error: 'Unauthorized' };
    }

    const targetIds = Array.from(new Set(
        (entityIds || [])
            .map(id => (typeof id === 'string' ? id.trim() : ''))
            .filter(Boolean)
    ));

    if (targetIds.length === 0) {
        return { error: '삭제할 인물 ID가 없습니다.' };
    }

    const safeCountByEntity = async (table: string, column = 'entity_id') => {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .in(column, targetIds);

        if (error) {
            const message = error.message || '';
            if (
                error.code === 'PGRST205' ||
                /Could not find the table|relation .* does not exist|column .* does not exist/i.test(message)
            ) {
                return 0;
            }
            throw error;
        }

        return count || 0;
    };

    try {
        const [
            entitiesRes,
            assetRightsCount,
            settlementCasesCount,
            memberPaymentsCount,
            legacyPaymentsCount,
        ] = await Promise.all([
            supabase.from('account_entities').select('id, display_name').in('id', targetIds),
            safeCountByEntity('asset_rights'),
            safeCountByEntity('settlement_cases'),
            safeCountByEntity('member_payments'),
            safeCountByEntity('payments'),
        ]);

        if (entitiesRes.error) {
            console.error('Delete member load error:', entitiesRes.error);
            return { error: '삭제 대상 인물 정보를 불러오지 못했습니다.' };
        }

        const blockers: string[] = [];
        if (assetRightsCount > 0) blockers.push(`권리증 ${assetRightsCount}건`);
        if (settlementCasesCount > 0) blockers.push(`정산 케이스 ${settlementCasesCount}건`);
        if (memberPaymentsCount + legacyPaymentsCount > 0) blockers.push(`납부 이력 ${memberPaymentsCount + legacyPaymentsCount}건`);

        if (blockers.length > 0) {
            return {
                error: `연결된 ${blockers.join(', ')}이 있어 인물 정보를 삭제할 수 없습니다. 먼저 관련 데이터를 정리해 주세요.`
            };
        }

        const { error: deleteError } = await supabase
            .from('account_entities')
            .delete()
            .in('id', targetIds);

        if (deleteError) {
            console.error('Delete member error:', deleteError);
            if (/foreign key|violates foreign key constraint/i.test(deleteError.message || '')) {
                return { error: '연결된 데이터가 남아 있어 삭제할 수 없습니다. 권리증, 정산, 납부 정보를 먼저 정리해 주세요.' };
            }
            return { error: '인물 정보 삭제에 실패했습니다.' };
        }

        await createAuditLog('DELETE_MEMBER', targetIds[0], {
            deleted_ids: targetIds,
            deleted_names: (entitiesRes.data || []).map(entity => entity.display_name),
        });

        revalidatePath('/members');
        revalidatePath('/settlements');
        revalidatePath('/payments');
        revalidatePath('/certificate-audit');
        revalidateUnifiedMembersTag();

        return { success: true, deletedIds: targetIds };
    } catch (error) {
        console.error('Delete member action error:', error);
        return { error: '인물 정보 삭제 중 서버 오류가 발생했습니다.' };
    }
}
