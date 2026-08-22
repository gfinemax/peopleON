import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { authzErrorResponse, requireRole, ROLE_GROUPS } from '@/lib/server/authz';
import { normalizeBankAccountNumber } from '@/lib/members/memberBankAccount';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ memberId: string }> };

async function requireFinanceAccess() {
    try {
        return await requireRole(ROLE_GROUPS.financeAdmin);
    } catch (error) {
        return authzErrorResponse(error);
    }
}

export async function GET(_request: Request, context: RouteContext) {
    const access = await requireFinanceAccess();
    if (access instanceof NextResponse) return access;

    const { memberId } = await context.params;
    const { data, error } = await createAdminClient()
        .from('member_bank_accounts')
        .select('bank_name, account_number, account_holder, purpose, updated_at')
        .eq('entity_id', memberId)
        .maybeSingle();

    if (error) {
        console.error('Member bank account read failed:', error);
        return NextResponse.json({ success: false, error: '계좌정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, account: data || null }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request, context: RouteContext) {
    const access = await requireFinanceAccess();
    if (access instanceof NextResponse) return access;

    const { memberId } = await context.params;
    const body = await request.json().catch(() => null);
    const bankName = typeof body?.bank_name === 'string' ? body.bank_name.trim() : '';
    const accountNumber = typeof body?.account_number === 'string' ? normalizeBankAccountNumber(body.account_number) : '';
    const purpose = ['refund', 'payment', 'other'].includes(body?.purpose) ? body.purpose : 'refund';

    if (!bankName || !accountNumber || accountNumber.replace(/\D/g, '').length < 6) {
        return NextResponse.json(
            { success: false, error: '은행명, 올바른 계좌번호, 예금주를 모두 입력해 주세요.' },
            { status: 400 },
        );
    }

    const supabase = createAdminClient();
    const { data: entity, error: entityError } = await supabase
        .from('account_entities')
        .select('id, display_name')
        .eq('id', memberId)
        .maybeSingle();
    if (entityError || !entity) {
        return NextResponse.json({ success: false, error: '회원을 찾을 수 없습니다.' }, { status: 404 });
    }
    const accountHolder = entity.display_name?.trim();
    if (!accountHolder) {
        return NextResponse.json({ success: false, error: '회원 이름을 확인할 수 없습니다.' }, { status: 409 });
    }

    const { data: before } = await supabase
        .from('member_bank_accounts')
        .select('bank_name, account_number, account_holder, purpose, created_by')
        .eq('entity_id', memberId)
        .maybeSingle();
    const actorEmail = access.user.email || 'unknown';
    const { data, error } = await supabase
        .from('member_bank_accounts')
        .upsert({
            entity_id: memberId,
            bank_name: bankName,
            account_number: accountNumber,
            account_holder: accountHolder,
            purpose,
            created_by: before?.created_by || actorEmail,
            updated_by: actorEmail,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'entity_id' })
        .select('bank_name, account_number, account_holder, purpose, updated_at')
        .single();

    if (error) {
        console.error('Member bank account save failed:', error);
        return NextResponse.json({ success: false, error: '계좌정보를 저장하지 못했습니다.' }, { status: 500 });
    }

    await supabase.from('system_audit_logs').insert({
        actor_email: actorEmail,
        action_type: before ? 'UPDATE_MEMBER_BANK_ACCOUNT' : 'CREATE_MEMBER_BANK_ACCOUNT',
        target_entity_id: memberId,
        details: {
            bank_name_changed: before?.bank_name !== bankName,
            account_number_changed: before?.account_number !== accountNumber,
            account_holder_changed: before?.account_holder !== accountHolder,
            purpose_changed: before?.purpose !== purpose,
        },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    });

    return NextResponse.json({ success: true, account: data });
}
