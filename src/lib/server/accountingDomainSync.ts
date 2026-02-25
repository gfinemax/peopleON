import type { SupabaseClient } from '@supabase/supabase-js';

type MemberSyncInput = {
    id: string;
    name: string | null;
    phone: string | null;
    tier: string | null;
    status: string | null;
    is_registered: boolean | null;
};

type PartyProfileRef = {
    id: string;
};

type EntityRef = {
    id: string;
    meta?: Record<string, unknown> | null;
};

type MembershipRoleCode =
    | '등기조합원'
    | '2차'
    | '일반분양'
    | '지주'
    | '지주조합원'
    | '대리인'
    | '예비조합원'
    | '권리증환불'
    | '관계인';

type MembershipRoleStatus = 'active' | 'inactive';

export type AccountingSyncResult = {
    ok: boolean;
    entityId?: string;
    roleCode?: MembershipRoleCode;
    roleStatus?: MembershipRoleStatus;
    message?: string;
};

function cleanText(value: string | null | undefined) {
    return (value || '').trim();
}

function normalizeTierToRoleCode(rawTier: string | null | undefined, isRegistered: boolean): MembershipRoleCode {
    const normalized = cleanText(rawTier).toLowerCase().replace(/\s+/g, '');
    if (normalized === '1차' || normalized === '등기조합원') return '등기조합원';
    if (normalized === '2차') return '2차';
    if (normalized === '일반' || normalized === '3차' || normalized === '일반분양') return '일반분양';
    if (normalized === '지주') return '지주';
    if (normalized === '지주조합원') return '지주조합원';
    if (normalized === '대리' || normalized === '대리인') return '대리인';
    if (normalized === '예비' || normalized === '예비조합원') return '예비조합원';
    if (normalized === '비조합원권리증' || normalized === '권리증환불') return '권리증환불';
    if (normalized === '관계인') return '관계인';
    if (isRegistered) return '등기조합원';
    return '관계인';
}

function normalizeRoleStatus(memberStatus: string | null | undefined): MembershipRoleStatus {
    const status = cleanText(memberStatus);
    if (status === '탈퇴' || status === '탈퇴예정') return 'inactive';
    return 'active';
}

function isRelationMissingError(errorMessage: string) {
    return /relation .* does not exist|Could not find the table/i.test(errorMessage);
}

async function resolveEntityIdByMember(
    supabase: SupabaseClient,
    member: MemberSyncInput,
): Promise<{ entityId: string | null; warning?: string }> {
    const displayName = cleanText(member.name) || '이름미상';
    const phone = cleanText(member.phone) || null;

    const { data: party, error: partyError } = await supabase
        .from('party_profiles')
        .select('id')
        .eq('member_id', member.id)
        .maybeSingle();

    if (partyError) {
        if (isRelationMissingError(partyError.message)) {
            return { entityId: null, warning: 'party_profiles 미구성 환경' };
        }
        throw partyError;
    }

    const partyRef = (party as PartyProfileRef | null) || null;
    if (partyRef?.id) {
        const { data: entity, error: upsertError } = await supabase
            .from('account_entities')
            .upsert(
                {
                    source_party_id: partyRef.id,
                    entity_type: 'person',
                    display_name: displayName,
                    phone,
                    meta: {
                        source: 'members_action_sync',
                        source_member_id: member.id,
                    },
                },
                { onConflict: 'source_party_id' },
            )
            .select('id')
            .maybeSingle();

        if (upsertError) {
            throw upsertError;
        }

        return { entityId: (entity as { id: string } | null)?.id || null };
    }

    const { data: existingRows, error: existingError } = await supabase
        .from('account_entities')
        .select('id, meta')
        .contains('meta', { source_member_id: member.id })
        .limit(1);

    if (existingError) {
        throw existingError;
    }

    const existing = ((existingRows as EntityRef[] | null) || [])[0];
    if (existing?.id) {
        const mergedMeta = {
            ...(existing.meta || {}),
            source: 'members_action_sync',
            source_member_id: member.id,
        };
        const { error: updateError } = await supabase
            .from('account_entities')
            .update({
                display_name: displayName,
                phone,
                meta: mergedMeta,
            })
            .eq('id', existing.id);

        if (updateError) {
            throw updateError;
        }

        return { entityId: existing.id };
    }

    const { data: inserted, error: insertError } = await supabase
        .from('account_entities')
        .insert({
            entity_type: 'person',
            display_name: displayName,
            phone,
            meta: {
                source: 'members_action_sync',
                source_member_id: member.id,
            },
        })
        .select('id')
        .maybeSingle();

    if (insertError) {
        throw insertError;
    }

    return { entityId: (inserted as { id: string } | null)?.id || null };
}

export async function syncMemberToAccountingDomain(
    supabase: SupabaseClient,
    member: MemberSyncInput,
): Promise<AccountingSyncResult> {
    try {
        const roleCode = normalizeTierToRoleCode(member.tier, Boolean(member.is_registered));
        const roleStatus = normalizeRoleStatus(member.status);
        const normalizedRegistered = roleCode === '등기조합원' ? true : Boolean(member.is_registered);

        const { entityId, warning } = await resolveEntityIdByMember(supabase, member);
        if (!entityId) {
            return {
                ok: false,
                roleCode,
                roleStatus,
                message: warning || 'account_entities 매핑 실패',
            };
        }

        const { error: roleError } = await supabase
            .from('membership_roles')
            .upsert(
                {
                    entity_id: entityId,
                    source_member_id: member.id,
                    role_code: roleCode,
                    role_status: roleStatus,
                    is_registered: normalizedRegistered,
                    note: 'sync:members_action',
                },
                { onConflict: 'entity_id,role_code,role_status' },
            );

        if (roleError) {
            throw roleError;
        }

        return {
            ok: true,
            entityId,
            roleCode,
            roleStatus,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isRelationMissingError(message)) {
            return { ok: false, message: 'accounting domain 미적용 환경(스킵)' };
        }
        return { ok: false, message };
    }
}

