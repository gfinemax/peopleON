import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/app/actions/audit';

type MemberUpdatePayload = {
    id?: string;
    ids?: string[]; // Multiple IDs for merged members
    name?: string | null;
    phone?: string | null;
    secondary_phone?: string | null;
    email?: string | null;
    address_legal?: string | null;
    birth_date?: string | null;
    resident_registration_number?: string | null;
    memo?: string | null;
    role_code?: string | null;
    representative?: {
        id?: string;
        name?: string | null;
        relation?: string | null;
        phone?: string | null;
    } | null;
    representative2?: {
        id?: string;
        name?: string | null;
        relation?: string | null;
        phone?: string | null;
    } | null;
    manual_certificate_count?: number | null;
    certificate_summary_review_status?: 'pending' | 'reviewed' | 'manual_locked' | null;
    certificate_summary_note?: string | null;
    certificate_summary_owner_group?: 'registered' | 'others' | null;
    deleted_rights_ids?: string[];
    merged_rights_payload?: {
        source_ids: string[];
        target_number: string;
        integration_type: 'consolidated' | 'unified_new';
        original_owner_id?: string;
        original_owner_name?: string;
    };
};

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => null)) as MemberUpdatePayload | null;

    // Support both single id and multiple ids
    let targetIds: string[] = [];
    if (body?.ids && Array.isArray(body.ids)) {
        targetIds = body.ids.filter(Boolean);
    } else if (typeof body?.id === 'string' && body.id.trim()) {
        targetIds = [body.id.trim()];
    }

    if (targetIds.length === 0) {
        return NextResponse.json({ success: false, error: '유효한 member ID가 필요합니다.' }, { status: 400 });
    }

    const formatPhone = (val: string | null | undefined) => {
        if (!val) return null;
        const items = val.split(',').map(v => v.trim()).filter(Boolean);
        const formatted = items.map(item => {
            const cleaned = item.replace(/\D/g, '');
            if (cleaned.length === 11) {
                return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
            } else if (cleaned.length === 10) {
                return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
            }
            return item;
        });
        return formatted.join(', ');
    };

    // 1. Update basic info in account_entities
    const patch: Record<string, unknown> = {};
    if (typeof body?.name === 'string') patch.display_name = body.name.trim() || null;
    if (typeof body?.phone === 'string') patch.phone = formatPhone(body.phone);
    if (typeof body?.secondary_phone === 'string') patch.phone_secondary = formatPhone(body.secondary_phone);
    if (typeof body?.email === 'string') patch.email = body.email.trim() || null;
    if (typeof body?.address_legal === 'string') patch.address_legal = body.address_legal.trim() || null;
    if (typeof body?.birth_date === 'string') patch.birth_date = body.birth_date.trim() || null;
    if (typeof body?.memo === 'string') patch.memo = body.memo.trim() || null;

    if (patch.display_name === null && typeof body?.name === 'string') {
        return NextResponse.json({ success: false, error: '성명은 필수입니다.' }, { status: 400 });
    }

    if (Object.keys(patch).length > 0) {
        const { error: updateError } = await supabase
            .from('account_entities')
            .update(patch)
            .in('id', targetIds);

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }
    }

    // 2. Update role_code in membership_roles
    if (typeof body?.role_code === 'string') {
        const { error: roleError } = await supabase
            .from('membership_roles')
            .update({ role_code: body.role_code })
            .in('entity_id', targetIds);

        if (roleError) {
            console.error('Role update error:', roleError);
        } else {
            await Promise.all(targetIds.map(tid =>
                createAuditLog('UPDATE_MEMBER_ROLE', tid, { new_role: body.role_code })
            ));
        }
    }

    // 3. Update, Create, Delete representatives (Sync with current active agents)
    const activeAgentIds: string[] = [];

    // Process only if any representative field is provided in body
    if (body !== null && (body.representative !== undefined || body.representative2 !== undefined)) {
        const repsToProcess = [body.representative, body.representative2].filter(r => r !== undefined && r !== null);

        for (const rep of repsToProcess) {
            const repName = typeof rep.name === 'string' ? rep.name.trim() : null;
            const repPhone = typeof rep.phone === 'string' ? formatPhone(rep.phone) : null;
            const repRelation = typeof rep.relation === 'string' ? rep.relation.trim() : null;
            const hasIdentity = Boolean(repName || repPhone);
            const hasMeaningfulRelation = Boolean(repRelation && repRelation !== '대리인');

            if (!hasIdentity && !hasMeaningfulRelation) {
                continue;
            }

            if (rep.id) {
                // Update existing agent info
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
                // Create new agent
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
                    const results = await Promise.all(targetIds.map(tid =>
                        supabase
                            .from('entity_relationships')
                            .insert({
                                from_entity_id: newAgent.id,
                                to_entity_id: tid,
                                relation_type: 'agent',
                                relation_note: repRelation || '대리인'
                            })
                    ));
                    const errors = results.filter(r => r.error);
                    if (errors.length > 0) console.error('Representative map error:', errors[0].error);
                    activeAgentIds.push(newAgent.id);
                }
            }
        }

        // Delete any stale relationships
        if (activeAgentIds.length > 0) {
            const { error: deleteError } = await supabase
                .from('entity_relationships')
                .delete()
                .in('to_entity_id', targetIds)
                .eq('relation_type', 'agent')
                .not('from_entity_id', 'in', `(${activeAgentIds.join(',')})`);
            if (deleteError) console.error('Representative stale delete error:', deleteError);
        } else {
            // Delete all agent relation if no active agents
            const { error: deleteError } = await supabase
                .from('entity_relationships')
                .delete()
                .in('to_entity_id', targetIds)
                .eq('relation_type', 'agent');
            if (deleteError) console.error('Representative all delete error:', deleteError);
        }
    }

    // 4. Update resident_registration_number in entity_private_info
    if (typeof body?.resident_registration_number === 'string') {
        const ssn = body.resident_registration_number.trim();
        // Update for all associated IDs to keep them in sync
        const results = await Promise.all(targetIds.map(async (tid) => {
            const { error: upsertError } = await supabase
                .from('entity_private_info')
                .upsert({
                    entity_id: tid,
                    resident_registration_number: ssn,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'entity_id' });
            return upsertError;
        }));
        const ssnError = results.find(e => e);
        if (ssnError) console.error('SSN update error:', ssnError);
    }
    // 4-1. Soft delete certificate_registry records if requested
    if (body?.deleted_rights_ids && Array.isArray(body.deleted_rights_ids) && body.deleted_rights_ids.length > 0) {
        const { error: delError } = await supabase
            .from('certificate_registry')
            .update({ is_active: false })
            .in('id', body.deleted_rights_ids);
        
        if (delError) {
            console.error('Certificate soft delete error:', delError);
        } else {
            await createAuditLog('DELETE_ASSET_RIGHTS', targetIds[0], {
                deleted_ids: body.deleted_rights_ids
            });
        }
    }

    // 4-2. Handle Certificate Consolidation (Merge)
    if (body?.merged_rights_payload && targetIds.length === 1) {
        const { source_ids, target_number, integration_type, original_owner_id, original_owner_name } = body.merged_rights_payload;
        
        // 1) 생성될 상위(관리) 권리증 레코드 생성
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
                    integration_type: integration_type,
                    merged_at: new Date().toISOString(),
                    merged_by: user.id
                })
            })
            .select('id')
            .single();

        if (createRightError) {
            console.error('New merged certificate creation error:', createRightError);
            return NextResponse.json({ success: false, message: `통합 권리증 생성 실패: ${createRightError.message}` }, { status: 500 });
        } else if (newRight) {
            // 2) 소스 권리증들에 부모 링크 및 메타데이터 업데이트
            for (const sid of source_ids) {
                const { data: existing } = await supabase.from('certificate_registry').select('note, entity_id').eq('id', sid).single();
                let existingMeta: Record<string, any> = {};
                try {
                    if (existing?.note) {
                        if (typeof existing.note === 'object') {
                            existingMeta = existing.note;
                        } else if (typeof existing.note === 'string' && existing.note.trim().startsWith('{')) {
                            existingMeta = JSON.parse(existing.note);
                        }
                    }
                } catch(e) {}

                const updatedMeta = {
                    ...existingMeta,
                    node_type: 'raw',
                    parent_right_id: newRight.id,
                    original_owner_id: original_owner_id || existing?.entity_id,
                    original_owner_name: original_owner_name
                };

                await supabase
                    .from('certificate_registry')
                    .update({ 
                        note: JSON.stringify(updatedMeta)
                    })
                    .eq('id', sid);
            }

            await createAuditLog('MERGE_ASSET_RIGHTS', targetIds[0], {
                target_id: newRight.id,
                source_ids: source_ids,
                integration_type: integration_type
            });
        }
    }

    // 5. Update person-level certificate summary (single target only)
    const wantsSummaryUpdate =
        body?.manual_certificate_count !== undefined ||
        body?.certificate_summary_review_status !== undefined ||
        body?.certificate_summary_note !== undefined;

    if (wantsSummaryUpdate && targetIds.length === 1) {
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

            const isRegistered = ((ownerRoleRows as Array<{ is_registered?: boolean | null; role_status?: string | null }> | null) || [])
                .some((row) => row.is_registered && (row.role_status || 'active') === 'active');
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
            return NextResponse.json({ success: false, error: summaryError.message }, { status: 500 });
        }

        await createAuditLog('UPDATE_PERSON_CERTIFICATE_SUMMARY', targetIds[0], {
            manual_certificate_count: summaryPatch.manual_certificate_count ?? null,
            review_status: summaryPatch.review_status ?? null,
            summary_note: summaryPatch.summary_note ?? null,
        });
    }

    return NextResponse.json({
        success: true,
        member: {
            ids: targetIds,
            ...patch,
        },
    });
}
