import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/app/actions/audit';
import { authzErrorResponse, requireRole, ROLE_GROUPS } from '@/lib/server/authz';
import { revalidateUnifiedMembersTag } from '@/lib/server/cacheTags';
import {
    MEMBER_ROLE_CODES,
    normalizeRosterName,
    ROSTER_REGISTERED_COUNT,
    ROSTER_TOTAL_COUNT,
    type RosterSyncRow,
} from '@/lib/members/memberRosterSync';

type RoleRow = { id: string; entity_id: string };
type EntityRow = { id: string; display_name: string; status: string | null; unit_group: string | null };

async function buildPreview(supabase: Awaited<ReturnType<typeof createClient>>, rows: RosterSyncRow[]) {
    const errors: string[] = [];
    const normalizedRows = rows.map((row) => ({
        ...row,
        name: String(row.name || '').trim(),
        unitGroup: String(row.unitGroup || '').trim(),
        normalizedName: normalizeRosterName(row.name),
    }));

    if (normalizedRows.length !== ROSTER_REGISTERED_COUNT) {
        errors.push(`엑셀 유효 인원이 ${normalizedRows.length}명이야. 정확히 ${ROSTER_REGISTERED_COUNT}명이어야 해.`);
    }
    if (normalizedRows.some((row) => !row.normalizedName || !row.unitGroup)) {
        errors.push('이름 또는 평형이 비어 있는 행이 있어.');
    }

    const sourceNameCounts = new Map<string, number>();
    normalizedRows.forEach((row) => sourceNameCounts.set(row.normalizedName, (sourceNameCounts.get(row.normalizedName) || 0) + 1));
    const duplicateSourceNames = [...sourceNameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
    if (duplicateSourceNames.length) errors.push(`엑셀에 동명이인 또는 중복 이름이 있어: ${duplicateSourceNames.join(', ')}`);

    const { data: roleData, error: roleError } = await supabase
        .from('membership_roles')
        .select('id,entity_id')
        .eq('role_status', 'active')
        .eq('is_registered', true);
    if (roleError) throw roleError;

    const roles = (roleData || []) as RoleRow[];
    const entityIds = [...new Set(roles.map((role) => role.entity_id))];
    if (entityIds.length !== ROSTER_TOTAL_COUNT) {
        errors.push(`현재 등기조합원 범위가 ${entityIds.length}명이야. 예상한 ${ROSTER_TOTAL_COUNT}명과 달라서 반영을 중단해.`);
    }

    const { data: entityData, error: entityError } = await supabase
        .from('account_entities').select('id,display_name,status,unit_group').in('id', entityIds);
    if (entityError) throw entityError;

    const entities = (entityData || []) as EntityRow[];
    const entitiesByName = new Map<string, EntityRow[]>();
    entities.forEach((entity) => {
        const key = normalizeRosterName(entity.display_name);
        entitiesByName.set(key, [...(entitiesByName.get(key) || []), entity]);
    });

    const unmatched: RosterSyncRow[] = [];
    const ambiguous: RosterSyncRow[] = [];
    const matched = normalizedRows.flatMap((row) => {
        const candidates = entitiesByName.get(row.normalizedName) || [];
        if (candidates.length === 0) { unmatched.push(row); return []; }
        if (candidates.length > 1) { ambiguous.push(row); return []; }
        const entity = candidates[0];
        return [{
            rowNumber: row.rowNumber,
            entityId: entity.id,
            name: entity.display_name,
            beforeUnitGroup: entity.unit_group,
            unitGroup: row.unitGroup,
            beforeStatus: entity.status,
        }];
    });

    if (unmatched.length) errors.push(`PeopleON에서 찾지 못한 이름: ${unmatched.map((row) => row.name).join(', ')}`);
    if (ambiguous.length) errors.push(`PeopleON에 동명이인이 있어 자동 매칭할 수 없는 이름: ${ambiguous.map((row) => row.name).join(', ')}`);

    const matchedIds = new Set(matched.map((row) => row.entityId));
    const refundCandidates = entities.filter((entity) => !matchedIds.has(entity.id));
    if (matched.length !== ROSTER_REGISTERED_COUNT || refundCandidates.length !== ROSTER_TOTAL_COUNT - ROSTER_REGISTERED_COUNT) {
        errors.push(`분류 결과가 등기 ${matched.length}명 / 환불 ${refundCandidates.length}명이야. 등기 86명 / 환불 30명과 일치해야 해.`);
    }

    return { ready: errors.length === 0, errors, matched, refundCandidates, roles };
}

async function applyInChunks<T>(items: T[], worker: (item: T) => Promise<void>, size = 10) {
    for (let index = 0; index < items.length; index += size) {
        await Promise.all(items.slice(index, index + size).map(worker));
    }
}

export async function POST(request: Request) {
    const supabase = await createClient();
    try {
        await requireRole(ROLE_GROUPS.financeAdmin, supabase);
    } catch (error) {
        return authzErrorResponse(error);
    }

    const body = await request.json().catch(() => null) as { rows?: RosterSyncRow[]; apply?: boolean; fileName?: string } | null;
    if (!body?.rows || !Array.isArray(body.rows)) {
        return NextResponse.json({ success: false, error: 'rows가 필요해.' }, { status: 400 });
    }

    try {
        const preview = await buildPreview(supabase, body.rows);
        if (!body.apply || !preview.ready) {
            return NextResponse.json({ success: true, ...preview });
        }

        const registeredIds = preview.matched.map((row) => row.entityId);
        const refundIds = preview.refundCandidates.map((row) => row.id);

        await applyInChunks(preview.matched, async (row) => {
            const { error } = await supabase.from('account_entities').update({ unit_group: row.unitGroup, status: '정상' }).eq('id', row.entityId);
            if (error) throw error;
        });
        const { error: refundEntityError } = await supabase.from('account_entities').update({ status: '환불조합원' }).in('id', refundIds);
        if (refundEntityError) throw refundEntityError;

        const { error: registeredRoleError } = await supabase.from('membership_roles').update({ role_code: '등기조합원', role_status: 'active', is_registered: true }).in('entity_id', registeredIds).in('role_code', [...MEMBER_ROLE_CODES]);
        if (registeredRoleError) throw registeredRoleError;
        const { error: refundRoleError } = await supabase.from('membership_roles').update({ role_code: '권리증환불', role_status: 'active', is_registered: false }).in('entity_id', refundIds).in('role_code', [...MEMBER_ROLE_CODES]);
        if (refundRoleError) throw refundRoleError;

        await createAuditLog('APPLY_REGISTERED_ROSTER', undefined, {
            file_name: body.fileName || null,
            registered_count: registeredIds.length,
            refund_count: refundIds.length,
            payment_data_changed: false,
        });
        revalidateUnifiedMembersTag();

        return NextResponse.json({ success: true, applied: true, registeredCount: registeredIds.length, refundCount: refundIds.length });
    } catch (error) {
        console.error('Roster sync failed:', error);
        const message = error instanceof Error ? error.message : '명부 반영 중 오류가 발생했어.';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
