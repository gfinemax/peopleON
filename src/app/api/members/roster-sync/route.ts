import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/app/actions/audit';
import { authzErrorResponse, requireRole, ROLE_GROUPS } from '@/lib/server/authz';
import { revalidateUnifiedMembersTag } from '@/lib/server/cacheTags';
import {
    calculateRosterAdjustment,
    MEMBER_ROLE_CODES,
    normalizeRosterName,
    ROSTER_PAYMENT_NOTE,
    ROSTER_REGISTERED_COUNT,
    ROSTER_TOTAL_COUNT,
    type RosterSyncRow,
} from '@/lib/members/memberRosterSync';

type RoleRow = { id: string; entity_id: string };
type EntityRow = { id: string; display_name: string; status: string | null; unit_group: string | null };
type PaymentRow = { id: string; entity_id: string; amount_paid: number | string; receipt_note: string | null };

async function buildPreview(supabase: Awaited<ReturnType<typeof createClient>>, rows: RosterSyncRow[]) {
    const errors: string[] = [];
    const normalizedRows = rows.map((row) => ({
        ...row,
        name: String(row.name || '').trim(),
        unitGroup: String(row.unitGroup || '').trim(),
        totalPaid: Math.round(Number(row.totalPaid)),
        normalizedName: normalizeRosterName(row.name),
    }));

    if (normalizedRows.length !== ROSTER_REGISTERED_COUNT) {
        errors.push(`엑셀 유효 인원이 ${normalizedRows.length}명이야. 정확히 ${ROSTER_REGISTERED_COUNT}명이어야 해.`);
    }
    if (normalizedRows.some((row) => !row.normalizedName || !row.unitGroup || !Number.isFinite(row.totalPaid) || row.totalPaid < 0)) {
        errors.push('이름, 평형 또는 총납입금액이 비어 있거나 올바르지 않은 행이 있어.');
    }

    const sourceNameCounts = new Map<string, number>();
    normalizedRows.forEach((row) => sourceNameCounts.set(row.normalizedName, (sourceNameCounts.get(row.normalizedName) || 0) + 1));
    const duplicateSourceNames = [...sourceNameCounts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
    if (duplicateSourceNames.length) errors.push(`엑셀에 동명이인 또는 중복 이름이 있어: ${duplicateSourceNames.join(', ')}`);

    const { data: roleData, error: roleError } = await supabase
        .from('membership_roles')
        .select('id,entity_id')
        .eq('role_status', 'active')
        .in('role_code', [...MEMBER_ROLE_CODES]);
    if (roleError) throw roleError;

    const roles = (roleData || []) as RoleRow[];
    const entityIds = [...new Set(roles.map((role) => role.entity_id))];
    if (entityIds.length !== ROSTER_TOTAL_COUNT) {
        errors.push(`현재 조합원 범위가 ${entityIds.length}명이야. 예상한 ${ROSTER_TOTAL_COUNT}명과 달라서 반영을 중단해.`);
    }

    const [{ data: entityData, error: entityError }, { data: paymentData, error: paymentError }] = await Promise.all([
        supabase.from('account_entities').select('id,display_name,status,unit_group').in('id', entityIds),
        supabase.from('member_payments').select('id,entity_id,amount_paid,receipt_note').in('entity_id', entityIds),
    ]);
    if (entityError) throw entityError;
    if (paymentError) throw paymentError;

    const entities = (entityData || []) as EntityRow[];
    const payments = (paymentData || []) as PaymentRow[];
    const entitiesByName = new Map<string, EntityRow[]>();
    entities.forEach((entity) => {
        const key = normalizeRosterName(entity.display_name);
        entitiesByName.set(key, [...(entitiesByName.get(key) || []), entity]);
    });

    const paymentTotals = new Map<string, number>();
    const adjustmentLines = new Map<string, PaymentRow>();
    payments.forEach((payment) => {
        if (payment.receipt_note === ROSTER_PAYMENT_NOTE) {
            adjustmentLines.set(payment.entity_id, payment);
        } else {
            paymentTotals.set(payment.entity_id, (paymentTotals.get(payment.entity_id) || 0) + Number(payment.amount_paid || 0));
        }
    });

    const unmatched: RosterSyncRow[] = [];
    const ambiguous: RosterSyncRow[] = [];
    const matched = normalizedRows.flatMap((row) => {
        const candidates = entitiesByName.get(row.normalizedName) || [];
        if (candidates.length === 0) { unmatched.push(row); return []; }
        if (candidates.length > 1) { ambiguous.push(row); return []; }
        const entity = candidates[0];
        const existingDetailTotal = paymentTotals.get(entity.id) || 0;
        return [{
            rowNumber: row.rowNumber,
            entityId: entity.id,
            name: entity.display_name,
            beforeUnitGroup: entity.unit_group,
            unitGroup: row.unitGroup,
            beforeStatus: entity.status,
            existingDetailTotal,
            targetTotalPaid: row.totalPaid,
            adjustmentAmount: calculateRosterAdjustment(row.totalPaid, existingDetailTotal),
            adjustmentLineId: adjustmentLines.get(entity.id)?.id || null,
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

        const inserts: Record<string, unknown>[] = [];
        await applyInChunks(preview.matched, async (row) => {
            const payload = {
                entity_id: row.entityId,
                payment_type: 'other',
                amount_due: 0,
                amount_paid: row.adjustmentAmount,
                receipt_note: ROSTER_PAYMENT_NOTE,
                is_contribution: true,
                status: 'paid',
                sort_order: 90,
            };
            if (row.adjustmentLineId) {
                const { error } = await supabase.from('member_payments').update(payload).eq('id', row.adjustmentLineId);
                if (error) throw error;
            } else {
                inserts.push(payload);
            }
        });
        if (inserts.length) {
            const { error } = await supabase.from('member_payments').insert(inserts);
            if (error) throw error;
        }

        await createAuditLog('APPLY_REGISTERED_ROSTER', undefined, {
            file_name: body.fileName || null,
            registered_count: registeredIds.length,
            refund_count: refundIds.length,
            payment_basis: 'total_paid_adjustment',
        });
        revalidateUnifiedMembersTag();

        return NextResponse.json({ success: true, applied: true, registeredCount: registeredIds.length, refundCount: refundIds.length });
    } catch (error) {
        console.error('Roster sync failed:', error);
        const message = error instanceof Error ? error.message : '명부 반영 중 오류가 발생했어.';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
