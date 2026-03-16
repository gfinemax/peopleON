import type { SupabaseClient } from '@supabase/supabase-js';
import type {
    MemberUpdatePayload,
    RepresentativePayload,
} from './memberUpdateRouteTypes';

export function getTargetIdsFromPayload(body: MemberUpdatePayload | null) {
    if (body?.ids && Array.isArray(body.ids)) {
        return body.ids.filter(Boolean);
    }
    if (typeof body?.id === 'string' && body.id.trim()) {
        return [body.id.trim()];
    }
    return [];
}

export function formatMemberPhone(value: string | null | undefined) {
    if (!value) return null;
    const items = value.split(',').map((item) => item.trim()).filter(Boolean);
    const formatted = items.map((item) => {
        const cleaned = item.replace(/\D/g, '');
        if (cleaned.length === 11) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
        }
        if (cleaned.length === 10) {
            return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        }
        return item;
    });
    return formatted.join(', ');
}

export function parseRightMeta(note: unknown): Record<string, unknown> {
    if (!note) return {};
    if (typeof note === 'object' && !Array.isArray(note)) return note as Record<string, unknown>;
    if (typeof note === 'string' && note.trim().startsWith('{')) {
        try {
            return JSON.parse(note) as Record<string, unknown>;
        } catch {
            return {};
        }
    }
    return {};
}

export function buildMemberPatch(body: MemberUpdatePayload | null) {
    const patch: Record<string, unknown> = {};
    if (typeof body?.name === 'string') patch.display_name = body.name.trim() || null;
    if (typeof body?.phone === 'string') patch.phone = formatMemberPhone(body.phone);
    if (typeof body?.secondary_phone === 'string') patch.phone_secondary = formatMemberPhone(body.secondary_phone);
    if (typeof body?.email === 'string') patch.email = body.email.trim() || null;
    if (typeof body?.address_legal === 'string') patch.address_legal = body.address_legal.trim() || null;
    if (typeof body?.birth_date === 'string') patch.birth_date = body.birth_date.trim() || null;
    if (typeof body?.memo === 'string') patch.memo = body.memo.trim() || null;
    return patch;
}

export async function syncRepresentatives({
    supabase,
    targetIds,
    body,
}: {
    supabase: SupabaseClient;
    targetIds: string[];
    body: MemberUpdatePayload | null;
}) {
    const activeAgentIds: string[] = [];

    if (body === null || (body.representative === undefined && body.representative2 === undefined)) {
        return;
    }

    const repsToProcess = [body.representative, body.representative2].filter(
        (rep): rep is RepresentativePayload => rep !== undefined && rep !== null,
    );

    for (const rep of repsToProcess) {
        const repName = typeof rep.name === 'string' ? rep.name.trim() : null;
        const repPhone = typeof rep.phone === 'string' ? formatMemberPhone(rep.phone) : null;
        const repRelation = typeof rep.relation === 'string' ? rep.relation.trim() : null;
        const hasIdentity = Boolean(repName || repPhone);
        const hasMeaningfulRelation = Boolean(repRelation && repRelation !== '대리인');

        if (!hasIdentity && !hasMeaningfulRelation) continue;

        if (rep.id) {
            const repPatch: Record<string, string | null> = {};
            if (repName !== null) repPatch.display_name = repName;
            if (repPhone !== null) repPatch.phone = repPhone;

            if (Object.keys(repPatch).length > 0) {
                const { error: relError } = await supabase
                    .from('account_entities')
                    .update(repPatch)
                    .eq('id', rep.id);
                if (relError) console.error('Representative info update error:', relError);
            }

            if (repRelation !== null) {
                const { error: relationError } = await supabase
                    .from('entity_relationships')
                    .update({ relation_note: repRelation })
                    .eq('from_entity_id', rep.id)
                    .in('to_entity_id', targetIds)
                    .eq('relation_type', 'agent');
                if (relationError) console.error('Representative relation update error:', relationError);
            }
            activeAgentIds.push(rep.id);
        } else if (repName || repPhone) {
            const { data: newAgent, error: createError } = await supabase
                .from('account_entities')
                .insert({
                    entity_type: 'person',
                    display_name: repName || '새 대리인',
                    phone: repPhone,
                })
                .select('id')
                .single();

            if (createError || !newAgent) {
                console.error('Representative create error:', createError);
            } else {
                const results = await Promise.all(
                    targetIds.map((targetId) =>
                        supabase.from('entity_relationships').insert({
                            from_entity_id: newAgent.id,
                            to_entity_id: targetId,
                            relation_type: 'agent',
                            relation_note: repRelation || '대리인',
                        }),
                    ),
                );
                const errors = results.filter((result) => result.error);
                if (errors.length > 0) console.error('Representative map error:', errors[0].error);
                activeAgentIds.push(newAgent.id);
            }
        }
    }

    if (activeAgentIds.length > 0) {
        const { error: deleteError } = await supabase
            .from('entity_relationships')
            .delete()
            .in('to_entity_id', targetIds)
            .eq('relation_type', 'agent')
            .not('from_entity_id', 'in', `(${activeAgentIds.join(',')})`);
        if (deleteError) console.error('Representative stale delete error:', deleteError);
    } else {
        const { error: deleteError } = await supabase
            .from('entity_relationships')
            .delete()
            .in('to_entity_id', targetIds)
            .eq('relation_type', 'agent');
        if (deleteError) console.error('Representative all delete error:', deleteError);
    }
}

export async function syncResidentRegistrationNumber({
    supabase,
    targetIds,
    residentRegistrationNumber,
}: {
    supabase: SupabaseClient;
    targetIds: string[];
    residentRegistrationNumber: string | null | undefined;
}) {
    if (typeof residentRegistrationNumber !== 'string') return;

    const ssn = residentRegistrationNumber.trim();
    const results = await Promise.all(
        targetIds.map(async (targetId) => {
            const { error: upsertError } = await supabase
                .from('entity_private_info')
                .upsert(
                    {
                        entity_id: targetId,
                        resident_registration_number: ssn,
                        updated_at: new Date().toISOString(),
                    },
                    { onConflict: 'entity_id' },
                );
            return upsertError;
        }),
    );

    const ssnError = results.find((error) => error);
    if (ssnError) console.error('SSN update error:', ssnError);
}
