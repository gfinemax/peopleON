'use server';

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { createAuditLog } from '@/app/actions/audit';
import { revalidateUnifiedMembersTag } from '@/lib/server/cacheTags';

export interface DuplicateGroup {
    phone: string;
    entities: any[];
}

export interface DuplicateActionState {
    success?: boolean;
    error?: string;
    message?: string;
}

function normalizePhone(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const cleaned = String(phone).replace(/[^0-9]/g, '');
    return cleaned || null;
}

// 중복 의심 그룹 목록 가져오기
export async function getDuplicateGroups(): Promise<DuplicateGroup[]> {
    const supabase = await createClient();
    
    // 1. 모든 인물 데이터 로드 (필요한 컬럼만)
    const { data: entities, error } = await supabase
        .from('account_entities')
        .select(`
            id, display_name, phone, memo, tags,
            membership_roles(source_member_id, role_code, role_status),
            certificate_registry(id, certificate_number_normalized)
        `);

    if (error || !entities) {
        console.error('Failed to load entities:', error);
        return [];
    }

    // 2. 전화번호별 그룹화
    const byPhone: Record<string, any[]> = {};
    entities.forEach(e => {
        const np = normalizePhone(e.phone);
        if (!np) return; // 전화번호 없는 경우 제외
        
        // "병합제외" 태그가 있는 사람은 중복 검사에서 제외
        if (e.tags && Array.isArray(e.tags) && e.tags.includes('병합제외')) {
            return;
        }

        if (!byPhone[np]) byPhone[np] = [];
        byPhone[np].push(e);
    });

    // 3. 2명 이상인 그룹만 필터링
    const duplicateGroups: DuplicateGroup[] = Object.entries(byPhone)
        .filter(([, list]) => list.length > 1)
        .map(([phone, list]) => ({
            phone,
            entities: list.sort((a, b) => (b.memo?.length || 0) - (a.memo?.length || 0)) // 메모가 긴 쪽을 앞으로
        }));

    return duplicateGroups;
}

// 수동 병합 실행
export async function mergeDuplicateEntities(
    masterId: string,
    slaveIds: string[]
): Promise<DuplicateActionState> {
    if (!masterId || !slaveIds || slaveIds.length === 0) {
        return { error: '마스터 ID와 병합할 대상 ID가 필요합니다.' };
    }

    // 관리자 권한을 사용하여 제약 조건 해결 (필요시)
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        let mergedCount = 0;
        const slaveNames: string[] = [];

        for (const slaveId of slaveIds) {
            if (slaveId === masterId) continue;

            const { data: slaveEntity } = await supabaseAdmin.from('account_entities').select('display_name, memo').eq('id', slaveId).single();
            if (slaveEntity) slaveNames.push(slaveEntity.display_name);

            // 1. membership_roles
            const { data: mRoles } = await supabaseAdmin.from('membership_roles').select('*').eq('entity_id', masterId);
            const { data: sRoles } = await supabaseAdmin.from('membership_roles').select('*').eq('entity_id', slaveId);
            const masterRoleKeys = new Set((mRoles || []).map(r => `${r.role_code}_${r.role_status}`));
            
            for (const sRole of (sRoles || [])) {
                if (masterRoleKeys.has(`${sRole.role_code}_${sRole.role_status}`)) {
                    await supabaseAdmin.from('membership_roles').delete().eq('id', sRole.id);
                } else {
                    await supabaseAdmin.from('membership_roles').update({ entity_id: masterId }).eq('id', sRole.id);
                }
            }

            // 2. 다른 테이블들 (모든 외래키 종속 테이블 추가)
            const tables = [
                { name: 'certificate_registry', col: 'entity_id' },
                { name: 'settlement_cases', col: 'entity_id' },
                { name: 'interaction_logs', col: 'entity_id' },
                { name: 'interaction_logs', col: 'member_id' },
                { name: 'system_audit_logs', col: 'target_entity_id' },
                { name: 'entity_relationships', col: 'from_entity_id' },
                { name: 'entity_relationships', col: 'to_entity_id' },
                { name: 'payments', col: 'entity_id' },
                { name: 'member_payments', col: 'entity_id' }
            ];
            
            for (const t of tables) {
                const { error: tErr } = await supabaseAdmin.from(t.name).update({ [t.col]: masterId }).eq(t.col, slaveId);
                // 존재하지 않는 컬럼/테이블 에러는 무시
                if (tErr && tErr.code !== 'PGRST205' && !tErr.message.includes('not exist') && !tErr.message.includes('not found')) {
                    console.error(`Table ${t.name} update warning:`, tErr.message);
                }
            }

            // 3. 메모 합치기
            if (slaveEntity?.memo) {
                const { data: md } = await supabaseAdmin.from('account_entities').select('memo').eq('id', masterId).single();
                const newMemo = md?.memo ? `${md.memo}\n\n[병합된 데이터 메모 - ${slaveEntity.display_name}]\n${slaveEntity.memo}` : slaveEntity.memo;
                await supabaseAdmin.from('account_entities').update({ memo: newMemo }).eq('id', masterId);
            }

            // 4. 슬레이브 레코드 삭제
            await supabaseAdmin.from('account_entities').delete().eq('id', slaveId);
            mergedCount++;
        }

        await createAuditLog('MANUAL_MERGE_DUPLICATES', masterId, {
            merged_slaves: slaveIds,
            slave_names: slaveNames.join(', ')
        });

        revalidatePath('/admin/duplicates');
        revalidatePath('/members');
        revalidateUnifiedMembersTag();
        return { success: true, message: `${mergedCount}건의 레코드가 기본 레코드로 병합되었습니다.` };

    } catch (e) {
        console.error('Merge Error:', e);
        return { error: '병합 처리 중 오류가 발생했습니다.' };
    }
}

// 병합 제외 태그 마킹
export async function ignoreDuplicateGroups(entityIds: string[]): Promise<DuplicateActionState> {
    if (!entityIds || entityIds.length === 0) {
        return { error: '제외할 인물 ID가 필요합니다.' };
    }

    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        for (const id of entityIds) {
            const { data } = await supabaseAdmin.from('account_entities').select('tags').eq('id', id).single();
            const tags = Array.isArray(data?.tags) ? data.tags : [];
            if (!tags.includes('병합제외')) {
                tags.push('병합제외');
                await supabaseAdmin.from('account_entities').update({ tags }).eq('id', id);
            }
        }

        await createAuditLog('IGNORE_DUPLICATES', entityIds[0], { target_ids: entityIds });
        revalidatePath('/admin/duplicates');
        revalidateUnifiedMembersTag();
        return { success: true, message: '해당 인물들은 향후 병합 대상에서 제외됩니다.' };
    } catch (e) {
        console.error('Ignore error:', e);
        return { error: '제외 처리 중 오류가 발생했습니다.' };
    }
}
