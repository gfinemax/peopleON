import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type MemberUpdatePayload = {
    id?: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address_legal?: string | null;
    memo?: string | null;
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
    const memberId = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!memberId) {
        return NextResponse.json({ success: false, error: '유효한 member id가 필요합니다.' }, { status: 400 });
    }

    const patch: Record<string, unknown> = {};
    if (typeof body?.name === 'string') patch.display_name = body.name.trim() || null;
    if (typeof body?.phone === 'string') patch.phone = body.phone.trim() || null;
    if (typeof body?.email === 'string') patch.email = body.email.trim() || null;
    if (typeof body?.address_legal === 'string') patch.address_legal = body.address_legal.trim() || null;
    if (typeof body?.memo === 'string') patch.memo = body.memo.trim() || null;

    if (patch.display_name === null && typeof body?.name === 'string') {
        return NextResponse.json({ success: false, error: '성명은 필수입니다.' }, { status: 400 });
    }

    const { data: updatedRows, error: updateError } = await supabase
        .from('account_entities')
        .update(patch)
        .eq('id', memberId)
        .select('id, display_name');

    if (updateError) {
        return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
    }

    const updatedMember = ((updatedRows as Array<{ id: string; display_name: string }> | null) || [])[0];
    if (!updatedMember) {
        return NextResponse.json({ success: false, error: '업데이트 대상이 없습니다.' }, { status: 404 });
    }

    return NextResponse.json({
        success: true,
        member: {
            id: updatedMember.id,
            name: updatedMember.display_name,
            ...patch,
        },
    });
}
