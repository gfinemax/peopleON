import { NextResponse } from 'next/server';

import { hasValidApiKey } from '@/lib/server/apiKeyAuth';
import { getDisplayMemberStatus } from '@/lib/members/unifiedPersonUtils';
import { birthDateFromResidentRegistrationNumber } from '@/lib/residentRegistrationBirthDate';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    if (!hasValidApiKey(request.headers)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const people = await getUnifiedMembersSnapshot();
        const ledgerPeople = people.filter(
            (person) => person.source_type === 'member' || person.role_types.includes('member'),
        );
        const missingBirthEntityIds = Array.from(new Set(
            ledgerPeople.filter((person) => !person.birth_date).flatMap((person) => person.entity_ids),
        ));
        const birthDateByEntityId = new Map<string, string>();
        const allEntityIds = Array.from(new Set(ledgerPeople.flatMap((person) => person.entity_ids)));
        const bankAccountByEntityId = new Map<string, {
            bank_name: string;
            account_number: string;
            account_holder: string;
            purpose: string;
            updated_at: string;
        }>();

        if (allEntityIds.length > 0) {
            const { data, error } = await createAdminClient()
                .from('member_bank_accounts')
                .select('entity_id, bank_name, account_number, account_holder, purpose, updated_at')
                .in('entity_id', allEntityIds);
            if (error) throw error;
            for (const row of data || []) bankAccountByEntityId.set(row.entity_id, row);
        }

        if (missingBirthEntityIds.length > 0) {
            const { data, error } = await createAdminClient()
                .from('entity_private_info')
                .select('entity_id, resident_registration_number')
                .in('entity_id', missingBirthEntityIds);

            if (error) throw error;
            for (const row of data || []) {
                const birthDate = birthDateFromResidentRegistrationNumber(row.resident_registration_number);
                if (birthDate) birthDateByEntityId.set(row.entity_id, birthDate);
            }
        }

        const members = ledgerPeople
            .map((person) => {
                const refundAccount = person.entity_ids
                    .map((entityId) => bankAccountByEntityId.get(entityId))
                    .find(Boolean) || null;
                return ({
                peopleon_id: person.id,
                member_id: person.member_id,
                name: person.name,
                phone: person.phone,
                address: person.address_legal || null,
                status: person.status,
                display_status: getDisplayMemberStatus(person),
                unit_group: person.unit_group,
                birth_date: person.birth_date
                    || person.entity_ids.map((entityId) => birthDateByEntityId.get(entityId)).find(Boolean)
                    || null,
                joined_at: person.joined_at,
                certificate_numbers: person.certificate_numbers || [],
                certificate_display: person.certificate_display || null,
                is_registered: person.is_registered,
                tier: person.tier,
                related_names: (person.relationships || []).map((relationship) => ({
                    name: relationship.name,
                    relation: relationship.relation,
                    phone: relationship.phone || null,
                })),
                refund_account: refundAccount ? {
                    bank_name: refundAccount.bank_name,
                    account_number: refundAccount.account_number,
                    account_holder: refundAccount.account_holder,
                    purpose: refundAccount.purpose,
                    updated_at: refundAccount.updated_at,
                } : null,
            });
            })
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
