import { NextResponse } from 'next/server';

import { createAuditLog } from '@/app/actions/audit';
import { hasValidApiKey } from '@/lib/server/apiKeyAuth';
import { revalidateUnifiedMembersTag } from '@/lib/server/cacheTags';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ peopleonId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
    if (!hasValidApiKey(request.headers)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { peopleonId } = await context.params;
        const body = await request.json().catch(() => null) as { supply_type?: unknown } | null;
        const supplyType = typeof body?.supply_type === 'string' ? body.supply_type.trim() : '';
        if (!supplyType || supplyType.length > 50) {
            return NextResponse.json(
                { success: false, error: '평형은 1자 이상 50자 이하로 입력해 주세요.' },
                { status: 400 },
            );
        }

        const people = await getUnifiedMembersSnapshot();
        const person = people.find((candidate) => candidate.id === peopleonId);
        if (!person) {
            return NextResponse.json({ success: false, error: '조합원을 찾을 수 없습니다.' }, { status: 404 });
        }

        const entityIds = Array.from(new Set((person.entity_ids || []).filter(Boolean)));
        if (entityIds.length === 0) {
            return NextResponse.json({ success: false, error: '수정할 조합원 엔티티가 없습니다.' }, { status: 409 });
        }

        const supabase = createAdminClient();
        const { data, error } = await supabase
            .from('account_entities')
            .update({ unit_group: supplyType })
            .in('id', entityIds)
            .select('id, unit_group');
        if (error) throw error;
        if ((data || []).length !== entityIds.length) {
            throw new Error('일부 조합원 엔티티의 평형이 갱신되지 않았습니다.');
        }

        await createAuditLog('LEDGER_UPDATE_MEMBER_UNIT_GROUP', person.id, {
            source: 'dbapt-ledger',
            peopleon_id: person.id,
            entity_ids: entityIds,
            before: person.unit_group || null,
            after: supplyType,
        });
        revalidateUnifiedMembersTag();

        return NextResponse.json(
            { success: true, peopleon_id: person.id, supply_type: supplyType, updated_entity_ids: entityIds },
            { headers: { 'Cache-Control': 'no-store' } },
        );
    } catch (error) {
        console.error('Ledger member supply type update error:', error);
        return NextResponse.json(
            { success: false, error: 'People On 평형을 수정하지 못했습니다.' },
            { status: 500 },
        );
    }
}
