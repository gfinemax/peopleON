import { NextResponse } from 'next/server';

import { hasValidApiKey } from '@/lib/server/apiKeyAuth';
import { getDisplayMemberStatus } from '@/lib/members/unifiedPersonUtils';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    if (!hasValidApiKey(request.headers)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const people = await getUnifiedMembersSnapshot();
        const members = people
            .filter((person) => person.source_type === 'member' || person.role_types.includes('member'))
            .map((person) => ({
                peopleon_id: person.id,
                member_id: person.member_id,
                name: person.name,
                phone: person.phone,
                address: person.address_legal || null,
                status: person.status,
                display_status: getDisplayMemberStatus(person),
                unit_group: person.unit_group,
                related_names: (person.relationships || []).map((relationship) => ({
                    name: relationship.name,
                    relation: relationship.relation,
                    phone: relationship.phone || null,
                })),
            }))
            .sort((left, right) => left.name.localeCompare(right.name, 'ko'));

        return NextResponse.json(
            { success: true, generated_at: new Date().toISOString(), members },
            { headers: { 'Cache-Control': 'no-store' } },
        );
    } catch (error) {
        console.error('Ledger members integration error:', error);
        return NextResponse.json(
            { success: false, error: '조합원 연동 정보를 불러오지 못했습니다.' },
            { status: 500 },
        );
    }
}
