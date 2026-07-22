import { NextResponse } from 'next/server';

import { hasValidApiKey } from '@/lib/server/apiKeyAuth';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ peopleonId: string }> };

export async function GET(request: Request, context: RouteContext) {
    if (!hasValidApiKey(request.headers)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { peopleonId } = await context.params;
        const people = await getUnifiedMembersSnapshot();
        const person = people.find((candidate) => candidate.id === peopleonId);
        if (!person) {
            return NextResponse.json({ success: false, error: '조합원을 찾을 수 없습니다.' }, { status: 404 });
        }

        const entityIds = Array.from(new Set((person.entity_ids || []).filter(Boolean)));
        const supabase = createAdminClient();
        const [entitiesResult, logsResult] = await Promise.all([
            entityIds.length
                ? supabase.from('account_entities').select('id, memo').in('id', entityIds)
                : Promise.resolve({ data: [], error: null }),
            entityIds.length
                ? supabase
                      .from('interaction_logs')
                      .select('id, entity_id, type, direction, summary, staff_name, created_at')
                      .in('entity_id', entityIds)
                      .order('created_at', { ascending: false })
                : Promise.resolve({ data: [], error: null }),
        ]);

        if (entitiesResult.error || logsResult.error) {
            throw entitiesResult.error || logsResult.error;
        }

        const adminMemos = (entitiesResult.data || [])
            .filter((entity) => typeof entity.memo === 'string' && entity.memo.trim())
            .map((entity) => ({
                external_id: entity.id,
                content: entity.memo.trim(),
                updated_at: null,
            }));

        const interactions = (logsResult.data || []).map((log) => ({
            external_id: log.id,
            entity_id: log.entity_id,
            type: log.type || 'NOTE',
            direction: log.direction || null,
            summary: (log.summary || '').trim(),
            staff_name: log.staff_name || null,
            occurred_at: log.created_at,
            updated_at: log.created_at,
        }));

        return NextResponse.json(
            {
                success: true,
                generated_at: new Date().toISOString(),
                peopleon_id: person.id,
                entity_ids: entityIds,
                admin_memos: adminMemos,
                interactions,
            },
            { headers: { 'Cache-Control': 'no-store' } },
        );
    } catch (error) {
        console.error('Ledger member journal integration error:', error);
        return NextResponse.json(
            { success: false, error: '조합원 상담 이력과 관리자 메모를 불러오지 못했습니다.' },
            { status: 500 },
        );
    }
}
