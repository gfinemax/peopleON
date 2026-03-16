import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    buildResidentRegistryPreview,
    executeResidentRegistryImport,
} from '@/lib/server/residentRegistryImport';

async function authenticateUser() {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return { supabase, user: null };
    }

    return { supabase, user };
}

export async function GET() {
    const { supabase, user } = await authenticateUser();

    if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const preview = await buildResidentRegistryPreview(supabase);
        return NextResponse.json({ success: true, preview });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '주민번호 미리보기에 실패했습니다.',
        }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const { supabase, user } = await authenticateUser();

    if (!user) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as { forceOverwrite?: boolean } | null;
    const forceOverwrite = Boolean(body?.forceOverwrite);

    try {
        const result = await executeResidentRegistryImport({
            forceOverwrite,
            supabase,
            userEmail: user.email || null,
        });

        return NextResponse.json({
            success: true,
            result,
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : '주민번호 일괄 반영에 실패했습니다.',
        }, { status: 500 });
    }
}
