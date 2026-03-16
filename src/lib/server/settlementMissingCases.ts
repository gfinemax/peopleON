import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchCertificateCompatRows } from '@/lib/server/certificateCompat';
import { fetchPartyRolesCompat } from '@/lib/server/partyRolesCompat';
import { selectTargetPartyIdsForMissingCases } from '@/lib/server/settlementCaseMaintenance';
import type { SettlementActionState } from '@/lib/server/settlementActionTypes';
import { revalidateSettlementPages, writeSettlementAuditLog } from '@/lib/server/settlementActionUtils';

export async function createMissingSettlementCasesWithPermission({
    supabase,
    userId,
    formData,
}: {
    supabase: SupabaseClient;
    userId: string;
    formData: FormData;
}): Promise<SettlementActionState> {
    const limitRaw = formData.get('limit');
    const limit =
        typeof limitRaw === 'string' && Number.isFinite(Number(limitRaw))
            ? Math.max(1, Math.min(Number(limitRaw), 200))
            : 30;

    const [partyRes, partyRoles, certificateRows, casesRes] = await Promise.all([
        supabase.from('party_profiles').select('id, member_id'),
        fetchPartyRolesCompat(supabase),
        fetchCertificateCompatRows(supabase),
        supabase.from('settlement_cases').select('party_id'),
    ]);

    const targetPartyIds = selectTargetPartyIdsForMissingCases({
        partyProfiles: ((partyRes.data as Array<{ id: string; member_id: string | null }> | null) || []),
        partyRoles,
        certificateRows,
        existingCases: ((casesRes.data as Array<{ party_id: string }> | null) || []),
        limit,
    });

    if (targetPartyIds.length === 0) {
        return { success: true, message: '시작할 정산 대상이 없습니다.', createdCount: 0, failedCount: 0 };
    }

    let createdCount = 0;
    let failedCount = 0;
    for (const partyId of targetPartyIds) {
        const { error } = await supabase.rpc('create_settlement_case', {
            p_party_id: partyId,
            p_policy_code: null,
            p_policy_version: null,
            p_created_by: userId,
            p_force_new: false,
        });
        if (error) {
            console.error('[settlements] createMissingSettlementCases rpc error:', error);
            failedCount += 1;
        } else {
            createdCount += 1;
        }
    }

    await writeSettlementAuditLog({
        entityType: 'settlement_case_batch',
        entityId: null,
        action: 'create_missing_cases',
        actor: userId,
        reason: '정산대상 일괄 시작',
        metadata: {
            limit,
            target_count: targetPartyIds.length,
            created_count: createdCount,
            failed_count: failedCount,
        },
    });

    revalidateSettlementPages();

    return {
        success: createdCount > 0,
        message: `정산 시작 완료: 성공 ${createdCount}건 / 실패 ${failedCount}건`,
        createdCount,
        failedCount,
    };
}
