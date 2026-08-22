import { NextResponse } from 'next/server';

import { authzErrorResponse, requireRole, ROLE_GROUPS } from '@/lib/server/authz';
import { fetchLedgerMemberJournalSummary } from '@/lib/server/ledgerJournalSummary';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireRole(ROLE_GROUPS.opsAdmin);
    } catch (error) {
        return authzErrorResponse(error);
    }

    const { id } = await params;
    const summary = await fetchLedgerMemberJournalSummary(id);
    return NextResponse.json(
        { success: !summary.error, ...summary },
        { status: summary.error ? 502 : 200, headers: { 'Cache-Control': 'no-store' } },
    );
}
