import type { SupabaseClient } from '@supabase/supabase-js';
import { createAuditLog } from '@/app/actions/audit';
import { parseRightMeta } from './memberUpdateBasicUtils';
import type { MemberUpdatePayload } from './memberUpdateRouteTypes';

const toCertificateNotePayload = (note: string | null | undefined) => {
    const trimmed = (note || '').trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return trimmed;
        }
    }

    return trimmed;
};

const safeCreateAuditLog = async (
    actionType: string,
    targetEntityId?: string,
    details?: Record<string, unknown>,
) => {
    try {
        await createAuditLog(actionType, targetEntityId, details);
    } catch (error) {
        console.error(`Audit log failed for ${actionType}:`, error);
    }
};

export async function syncCertificateRights({
    supabase,
    body,
    targetIds,
    userId,
}: {
    supabase: SupabaseClient;
    body: MemberUpdatePayload | null;
    targetIds: string[];
    userId: string;
}) {
    if (body?.deleted_rights_ids && Array.isArray(body.deleted_rights_ids) && body.deleted_rights_ids.length > 0) {
        const { data: deletingRights, error: deletingRightsError } = await supabase
            .from('certificate_registry')
            .select('id, note')
            .in('id', body.deleted_rights_ids);

        if (deletingRightsError) {
            console.error('Certificate delete prefetch error:', deletingRightsError);
        }

        const derivativeIdsToDelete = ((deletingRights || []) as Array<{ id: string; note: unknown }>)
            .filter((right) => parseRightMeta(right.note).node_type === 'derivative')
            .map((right) => right.id);

        if (derivativeIdsToDelete.length > 0) {
            const { data: siblingRights, error: siblingRightsError } = await supabase
                .from('certificate_registry')
                .select('id, note')
                .in('entity_id', targetIds)
                .eq('is_active', true);

            if (siblingRightsError) {
                console.error('Certificate unlink prefetch error:', siblingRightsError);
            } else {
                for (const right of (siblingRights || []) as Array<{ id: string; note: unknown }>) {
                    const meta = parseRightMeta(right.note);
                    const parentRightId = typeof meta.parent_right_id === 'string' ? meta.parent_right_id : null;
                    if (!parentRightId || !derivativeIdsToDelete.includes(parentRightId)) continue;

                    delete meta.parent_right_id;
                    delete meta.integration_type;
                    delete meta.merged_at;
                    delete meta.merged_by;
                    delete meta.original_owner_id;
                    delete meta.original_owner_name;
                    if (!meta.node_type) {
                        meta.node_type = 'raw';
                    }

                    const nextNote = Object.keys(meta).length > 0 ? JSON.stringify(meta) : null;
                    const { error: unlinkError } = await supabase
                        .from('certificate_registry')
                        .update({ note: nextNote })
                        .eq('id', right.id);

                    if (unlinkError) {
                        console.error('Certificate unlink update error:', unlinkError);
                    }
                }
            }
        }

        const { error: deleteError } = await supabase
            .from('certificate_registry')
            .update({ is_active: false })
            .in('id', body.deleted_rights_ids);

        if (deleteError) {
            console.error('Certificate soft delete error:', deleteError);
        } else {
            await safeCreateAuditLog('DELETE_ASSET_RIGHTS', targetIds[0], {
                deleted_ids: body.deleted_rights_ids,
            });
        }
    }

    if (body?.merged_rights_payload && targetIds.length === 1) {
        const {
            source_ids,
            target_number,
            integration_type,
            original_owner_id,
            original_owner_name,
        } = body.merged_rights_payload;

        const { data: newRight, error: createRightError } = await supabase
            .from('certificate_registry')
            .insert({
                entity_id: targetIds[0],
                certificate_number_raw: target_number,
                certificate_number_normalized: target_number
                    .replace(/[./]/g, '-')
                    .replace(/\s+/g, '')
                    .toLowerCase(),
                certificate_status: 'confirmed',
                source_type: 'manual',
                is_confirmed_for_count: true,
                is_active: true,
                note: JSON.stringify({
                    node_type: 'derivative',
                    integration_type,
                    merged_at: new Date().toISOString(),
                    merged_by: userId,
                }),
            })
            .select('id')
            .single();

        if (createRightError) {
            console.error('New merged certificate creation error:', createRightError);
            return { success: false, message: `통합 권리증 생성 실패: ${createRightError.message}` };
        }

        if (newRight) {
            for (const sourceId of source_ids) {
                const { data: existing } = await supabase
                    .from('certificate_registry')
                    .select('note, entity_id')
                    .eq('id', sourceId)
                    .single();

                let existingMeta: Record<string, unknown> = {};
                try {
                    if (existing?.note) {
                        if (typeof existing.note === 'object') {
                            existingMeta = existing.note as Record<string, unknown>;
                        } else if (typeof existing.note === 'string' && existing.note.trim().startsWith('{')) {
                            existingMeta = JSON.parse(existing.note) as Record<string, unknown>;
                        }
                    }
                } catch {
                    existingMeta = {};
                }

                const updatedMeta = {
                    ...existingMeta,
                    node_type: 'raw',
                    parent_right_id: newRight.id,
                    original_owner_id: original_owner_id || existing?.entity_id,
                    original_owner_name,
                };

                await supabase
                    .from('certificate_registry')
                    .update({ note: JSON.stringify(updatedMeta) })
                    .eq('id', sourceId);
            }

            await safeCreateAuditLog('MERGE_ASSET_RIGHTS', targetIds[0], {
                target_id: newRight.id,
                source_ids,
                integration_type,
            });
        }
    }

    if (body?.updated_rights && Array.isArray(body.updated_rights) && body.updated_rights.length > 0) {
        for (const right of body.updated_rights) {
            const { error: rightError } = await supabase
                .from('certificate_registry')
                .update({
                    certificate_number_normalized: right.certificate_number_normalized ?? null,
                    certificate_number_raw: right.certificate_number_raw ?? null,
                    certificate_status: right.certificate_status ?? null,
                    note: toCertificateNotePayload(right.note),
                })
                .eq('id', right.id);

            if (rightError) {
                return { success: false, error: rightError.message };
            }

            if (right.old_number !== right.new_number) {
                await Promise.all(
                    targetIds.map((targetId) =>
                        safeCreateAuditLog('UPDATE_CERTIFICATE_NUMBER', targetId, {
                            old_number: right.old_number ?? null,
                            new_number: right.new_number ?? null,
                        }),
                    ),
                );
            }
        }

        await safeCreateAuditLog('UPDATE_ASSET_RIGHTS', targetIds[0], {
            rights_count: body.updated_rights.length,
            right_ids: body.updated_rights.map((right) => right.id),
        });
    }

    return { success: true };
}

export async function syncPersonCertificateSummary({
    supabase,
    body,
    targetIds,
}: {
    supabase: SupabaseClient;
    body: MemberUpdatePayload | null;
    targetIds: string[];
}) {
    const wantsSummaryUpdate =
        body?.manual_certificate_count !== undefined ||
        body?.certificate_summary_review_status !== undefined ||
        body?.certificate_summary_note !== undefined;

    if (!wantsSummaryUpdate || targetIds.length !== 1) {
        return { success: true };
    }

    const summaryPatch: Record<string, unknown> = {
        entity_id: targetIds[0],
        updated_at: new Date().toISOString(),
    };

    if (body.certificate_summary_owner_group === 'registered' || body.certificate_summary_owner_group === 'others') {
        summaryPatch.owner_group = body.certificate_summary_owner_group;
    } else {
        const { data: ownerRoleRows } = await supabase
            .from('membership_roles')
            .select('is_registered, role_status')
            .eq('entity_id', targetIds[0]);

        const isRegistered = (
            ((ownerRoleRows as Array<{ is_registered?: boolean | null; role_status?: string | null }> | null) || [])
        ).some((row) => row.is_registered && (row.role_status || 'active') === 'active');
        summaryPatch.owner_group = isRegistered ? 'registered' : 'others';
    }

    if (body.manual_certificate_count === null) {
        summaryPatch.manual_certificate_count = null;
    } else if (body.manual_certificate_count !== undefined) {
        summaryPatch.manual_certificate_count = Math.max(0, Number(body.manual_certificate_count) || 0);
    }

    if (
        body.certificate_summary_review_status === 'pending' ||
        body.certificate_summary_review_status === 'reviewed' ||
        body.certificate_summary_review_status === 'manual_locked'
    ) {
        summaryPatch.review_status = body.certificate_summary_review_status;
    }

    if (typeof body.certificate_summary_note === 'string') {
        summaryPatch.summary_note = body.certificate_summary_note.trim() || null;
    }

    const { error: summaryError } = await supabase
        .from('person_certificate_summaries')
        .upsert(summaryPatch, { onConflict: 'entity_id' });

    if (summaryError) {
        const missingSummaryTable =
            summaryError.message.includes("Could not find the table 'public.person_certificate_summaries'") ||
            summaryError.message.includes('person_certificate_summaries');

        if (missingSummaryTable) {
            console.warn('Skipping person_certificate_summaries upsert because the table is unavailable.');
            return { success: true };
        }

        return { success: false, error: summaryError.message };
    }

    await safeCreateAuditLog('UPDATE_PERSON_CERTIFICATE_SUMMARY', targetIds[0], {
        manual_certificate_count: summaryPatch.manual_certificate_count ?? null,
        review_status: summaryPatch.review_status ?? null,
        summary_note: summaryPatch.summary_note ?? null,
    });

    return { success: true };
}
