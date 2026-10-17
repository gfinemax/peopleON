import { NextResponse } from 'next/server';

import { createAuditLog } from '@/app/actions/audit';
import { maskBankAccountNumber, normalizeBankAccountNumber } from '@/lib/members/memberBankAccount';
import { hasValidApiKey } from '@/lib/server/apiKeyAuth';
import { revalidateUnifiedMembersTag } from '@/lib/server/cacheTags';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ peopleonId: string }> };

type RefundAccountPayload = {
    bank_name?: unknown;
    account_number?: unknown;
    account_holder?: unknown;
    expected_updated_at?: unknown;
    confirm_overwrite?: unknown;
};

export async function PATCH(request: Request, context: RouteContext) {
    if (!hasValidApiKey(request.headers)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { peopleonId } = await context.params;
        const body = await request.json().catch(() => null) as RefundAccountPayload | null;
        const bankName = typeof body?.bank_name === 'string' ? body.bank_name.trim() : '';
        const accountNumber = typeof body?.account_number === 'string'
            ? normalizeBankAccountNumber(body.account_number)
            : '';
        const accountHolder = typeof body?.account_holder === 'string' ? body.account_holder.trim() : '';
        const expectedUpdatedAt = typeof body?.expected_updated_at === 'string'
            ? body.expected_updated_at.trim()
            : '';
        const confirmOverwrite = body?.confirm_overwrite === true;
        const accountDigits = accountNumber.replace(/\D/g, '');

        if (!bankName || !accountNumber || !accountHolder) {
            return NextResponse.json(
                { success: false, error: '환불은행, 계좌번호, 예금주를 모두 입력해 주세요.' },
                { status: 400 },
            );
        }
        if (bankName.length > 100 || accountHolder.length > 100 || accountDigits.length < 6 || accountDigits.length > 30) {
            return NextResponse.json(
                { success: false, error: '환불계좌 형식을 확인해 주세요.' },
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
        const { data: existingRows, error: existingError } = await supabase
            .from('member_bank_accounts')
            .select('entity_id, bank_name, account_number, account_holder, purpose, created_by, updated_at')
            .in('entity_id', entityIds);
        if (existingError) throw existingError;
        if ((existingRows || []).length > 1) {
            return NextResponse.json(
                { success: false, error: '통합 조합원에 여러 계좌가 연결되어 있어 PeopleON에서 먼저 정리해야 합니다.' },
                { status: 409 },
            );
        }

        const existing = existingRows?.[0] || null;
        const targetEntityId = existing?.entity_id
            || (person.member_id && entityIds.includes(person.member_id) ? person.member_id : null)
            || (entityIds.includes(person.id) ? person.id : entityIds[0]);
        const unchanged = Boolean(
            existing
            && existing.bank_name === bankName
            && normalizeBankAccountNumber(existing.account_number) === accountNumber
            && existing.account_holder === accountHolder,
        );

        if (unchanged) {
            return NextResponse.json({
                success: true,
                unchanged: true,
                peopleon_id: person.id,
                account: {
                    bank_name: bankName,
                    account_number_masked: maskBankAccountNumber(accountNumber),
                    account_holder: accountHolder,
                    purpose: existing?.purpose || 'refund',
                    updated_at: existing?.updated_at || null,
                },
            }, { headers: { 'Cache-Control': 'no-store' } });
        }

        if (existing) {
            if (!expectedUpdatedAt || expectedUpdatedAt !== String(existing.updated_at || '')) {
                return NextResponse.json(
                    { success: false, error: 'PeopleON 계좌정보가 비교 후 변경됐어. 최신 값을 다시 확인해 줘.' },
                    { status: 409 },
                );
            }
            if (!confirmOverwrite) {
                return NextResponse.json(
                    { success: false, error: '기존 PeopleON 환불계좌를 덮어쓸지 확인해 줘.' },
                    { status: 409 },
                );
            }
        } else if (expectedUpdatedAt) {
            return NextResponse.json(
                { success: false, error: 'PeopleON 계좌정보 상태가 비교 후 변경됐어. 최신 값을 다시 확인해 줘.' },
                { status: 409 },
            );
        }

        const updatedAt = new Date().toISOString();
        let data: {
            bank_name: string;
            account_number: string;
            account_holder: string;
            purpose: string;
            updated_at: string;
        } | null = null;
        if (existing) {
            const result = await supabase
                .from('member_bank_accounts')
                .update({
                    bank_name: bankName,
                    account_number: accountNumber,
                    account_holder: accountHolder,
                    purpose: 'refund',
                    updated_by: 'dbapt-ledger',
                    updated_at: updatedAt,
                })
                .eq('entity_id', targetEntityId)
                .eq('updated_at', existing.updated_at)
                .select('bank_name, account_number, account_holder, purpose, updated_at')
                .maybeSingle();
            if (result.error) throw result.error;
            data = result.data;
            if (!data) {
                return NextResponse.json(
                    { success: false, error: 'PeopleON 계좌정보가 저장 직전에 변경됐어. 최신 값을 다시 확인해 줘.' },
                    { status: 409 },
                );
            }
        } else {
            const result = await supabase
                .from('member_bank_accounts')
                .insert({
                    entity_id: targetEntityId,
                    bank_name: bankName,
                    account_number: accountNumber,
                    account_holder: accountHolder,
                    purpose: 'refund',
                    created_by: 'dbapt-ledger',
                    updated_by: 'dbapt-ledger',
                    updated_at: updatedAt,
                })
                .select('bank_name, account_number, account_holder, purpose, updated_at')
                .single();
            if (result.error?.code === '23505') {
                return NextResponse.json(
                    { success: false, error: 'PeopleON 계좌정보가 저장 직전에 등록됐어. 최신 값을 다시 확인해 줘.' },
                    { status: 409 },
                );
            }
            if (result.error) throw result.error;
            data = result.data;
        }

        await createAuditLog('LEDGER_UPDATE_MEMBER_REFUND_ACCOUNT', targetEntityId, {
            source: 'dbapt-ledger',
            peopleon_id: person.id,
            bank_name_changed: existing?.bank_name !== bankName,
            account_number_changed: normalizeBankAccountNumber(existing?.account_number || '') !== accountNumber,
            account_holder_changed: existing?.account_holder !== accountHolder,
            account_number_last4: accountDigits.slice(-4),
            replaced_existing: Boolean(existing),
        });
        revalidateUnifiedMembersTag();

        return NextResponse.json({
            success: true,
            unchanged: false,
            peopleon_id: person.id,
            account: {
                bank_name: data.bank_name,
                account_number_masked: maskBankAccountNumber(data.account_number),
                account_holder: data.account_holder,
                purpose: data.purpose,
                updated_at: data.updated_at,
            },
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Ledger member refund account update error:', error);
        return NextResponse.json(
            { success: false, error: 'PeopleON 환불계좌를 수정하지 못했습니다.' },
            { status: 500 },
        );
    }
}
