import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    buildSettlementQaPayload,
    escapeSettlementQaCsvCell,
    extractSettlementQaUserRole,
} from '@/lib/server/settlementQaReport';

export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = (process.env.SETTLEMENT_ALLOWED_ROLES || '')
        .split(',')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean);
    if (allowedRoles.length > 0) {
        const userRole = extractSettlementQaUserRole(user);
        if (!userRole || !allowedRoles.includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    try {
        const payload = await buildSettlementQaPayload({
            supabase,
            userId: user.id,
        });

        const url = new URL(request.url);
        const format = (url.searchParams.get('format') || 'json').toLowerCase();
        if (format === 'csv') {
            const header = ['code', 'label', 'severity', 'count', 'detail', 'link'];
            const lines = [
                header.map(escapeSettlementQaCsvCell).join(','),
                ...payload.checks.map((item) =>
                    [
                        item.code,
                        item.label,
                        item.severity,
                        item.count,
                        item.detail,
                        item.link || '-',
                    ].map(escapeSettlementQaCsvCell).join(','),
                ),
            ];

            const csvText = `\uFEFF${lines.join('\r\n')}`;
            const dateStamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
            const fileName = `정산_QA_리포트_${dateStamp}.csv`;
            return new Response(csvText, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv; charset=utf-8',
                    'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
                    'Cache-Control': 'no-store',
                },
            });
        }

        return NextResponse.json(payload, {
            headers: { 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '정산 QA 리포트 생성에 실패했습니다.' },
            { status: 500 },
        );
    }
}
