import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type CreateSettlementCaseBody = {
    partyId?: string;
    policyCode?: string;
    policyVersion?: number;
    forceNew?: boolean;
};

function isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
    const supabase = await createClient();

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json(
            { success: false, error: 'Unauthorized' },
            { status: 401 }
        );
    }

    let body: CreateSettlementCaseBody;
    try {
        body = (await request.json()) as CreateSettlementCaseBody;
    } catch {
        return NextResponse.json(
            { success: false, error: 'Invalid JSON body' },
            { status: 400 }
        );
    }

    const partyId = body.partyId?.trim();
    const policyCode = body.policyCode?.trim() || null;
    const policyVersion = Number.isInteger(body.policyVersion) ? body.policyVersion : null;
    const forceNew = Boolean(body.forceNew);

    if (!partyId || !isUuid(partyId)) {
        return NextResponse.json(
            { success: false, error: 'partyId(uuid) is required' },
            { status: 400 }
        );
    }

    const { data, error } = await supabase.rpc('create_settlement_case', {
        p_party_id: partyId,
        p_policy_code: policyCode,
        p_policy_version: policyVersion,
        p_created_by: user.id,
        p_force_new: forceNew,
    });

    if (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 400 }
        );
    }

    const row = Array.isArray(data) ? data[0] : data;

    return NextResponse.json({
        success: true,
        result: row,
    });
}

