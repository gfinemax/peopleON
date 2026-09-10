import { NextResponse } from 'next/server';

import { getUnreportedMembershipMeta, UNREPORTED_MEMBER_ROLE_CODE } from '@/lib/members/unreportedMembership';
import { hasValidApiKey } from '@/lib/server/apiKeyAuth';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    if (!hasValidApiKey(request.headers)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const people = await getUnifiedMembersSnapshot();
        const members = people
            .filter((person) => (person.tiers || []).includes(UNREPORTED_MEMBER_ROLE_CODE))
            .map((person) => ({
                peopleon_id: person.id,
                name: person.name,
                phone: person.phone,
                secondary_phone: person.secondary_phone || null,
                address: person.address_legal || null,
                category: UNREPORTED_MEMBER_ROLE_CODE,
                unreported_membership: getUnreportedMembershipMeta(person.meta),
            }))
            .filter((member) => member.unreported_membership)
            .sort((left, right) =>
                left.unreported_membership!.record_id.localeCompare(right.unreported_membership!.record_id),
            );

        return NextResponse.json(
            {
                success: true,
                generated_at: new Date().toISOString(),
                count: members.length,
                declared_total: members.reduce(
                    (sum, member) => sum + member.unreported_membership!.claimed_amount,
                    0,
                ),
                members,
            },
            { headers: { 'Cache-Control': 'no-store' } },
        );
    } catch (error) {
        console.error('Ledger unreported members integration error:', error);
        return NextResponse.json(
            { success: false, error: '미신고조합원 연동 정보를 불러오지 못했습니다.' },
            { status: 500 },
        );
    }
}
