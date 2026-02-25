import { createClient } from '@/lib/supabase/server';
import {
    buildSettlementPartyOwnershipMap,
    type MemberLite,
    type PartyProfileLite,
    type PartyRoleLite,
    type RightCertificateLite,
} from '@/lib/settlement/partyOwnership';
import { fetchCertificateCompatRows } from '@/lib/server/certificateCompat';
import { fetchPartyRolesCompat } from '@/lib/server/partyRolesCompat';

type CaseStatus = 'draft' | 'review' | 'approved' | 'paid' | 'rejected';

type SettlementCaseRow = {
    id: string;
    party_id: string;
    case_status: CaseStatus;
    created_at: string;
};

type PartyProfileRow = PartyProfileLite;
type MemberRow = MemberLite;
type PartyRoleRow = PartyRoleLite;
type RightCertificateRow = RightCertificateLite;

type SettlementLineRow = {
    case_id: string;
    amount: number | string;
};

type RefundPaymentRow = {
    case_id: string;
    paid_amount: number | string;
    payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
};

function parseMoney(value: number | string | null | undefined) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function escapeCsvCell(value: string | number): string {
    const text = String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function extractUserRole(user: {
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
}) {
    const appRole = typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : '';
    const userRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : '';
    return (appRole || userRole || '').trim().toLowerCase();
}

export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = (process.env.SETTLEMENT_ALLOWED_ROLES || '')
        .split(',')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean);
    if (allowedRoles.length > 0) {
        const userRole = extractUserRole(user);
        if (!userRole || !allowedRoles.includes(userRole)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const url = new URL(request.url);
    const scope = (url.searchParams.get('scope') || 'issues').toLowerCase();
    const issuesOnly = scope !== 'all';

    const { data: casesRaw, error: casesError } = await supabase
        .from('settlement_cases')
        .select('id, party_id, case_status, created_at')
        .order('created_at', { ascending: false });

    if (casesError) {
        return Response.json({ error: casesError.message }, { status: 500 });
    }

    const settlementCases = (casesRaw as SettlementCaseRow[] | null) || [];
    const caseIds = settlementCases.map((item) => item.id);
    const partyIds = Array.from(new Set(settlementCases.map((item) => item.party_id)));

    const [partiesRes, partyRoles, certRows, linesRes, paymentsRes] = await Promise.all([
        partyIds.length > 0
            ? supabase
                .from('party_profiles')
                .select('id, display_name, member_id')
                .in('id', partyIds)
            : Promise.resolve({ data: [], error: null }),
        partyIds.length > 0
            ? fetchPartyRolesCompat(supabase, { partyIds })
            : Promise.resolve([]),
        partyIds.length > 0
            ? fetchCertificateCompatRows(supabase, { holderPartyIds: partyIds })
            : Promise.resolve([]),
        caseIds.length > 0
            ? supabase
                .from('settlement_lines')
                .select('case_id, amount')
                .in('case_id', caseIds)
                .eq('line_type', 'final_refund')
            : Promise.resolve({ data: [], error: null }),
        caseIds.length > 0
            ? supabase
                .from('refund_payments')
                .select('case_id, paid_amount, payment_status')
                .in('case_id', caseIds)
            : Promise.resolve({ data: [], error: null }),
    ]);

    if (partiesRes.error) return Response.json({ error: partiesRes.error.message }, { status: 500 });
    if (linesRes.error) return Response.json({ error: linesRes.error.message }, { status: 500 });
    if (paymentsRes.error) return Response.json({ error: paymentsRes.error.message }, { status: 500 });

    const parties = (partiesRes.data as PartyProfileRow[] | null) || [];
    const memberIds = Array.from(
        new Set(
            parties
                .map((party) => party.member_id)
                .filter((memberId): memberId is string => Boolean(memberId)),
        ),
    );
    const { data: membersData } = memberIds.length > 0
        ? await supabase
            .from('account_entities')
            .select('id, display_name')
            .in('id', memberIds)
        : { data: [] as Array<{ id: string; display_name: string }> };

    const ownershipMap = buildSettlementPartyOwnershipMap({
        parties,
        members: ((membersData as Array<{ id: string; display_name: string }> | null) || []).map(m => ({ id: m.id, name: m.display_name })),
        partyRoles: partyRoles as PartyRoleRow[],
        rightCertificates: certRows.map((row) => ({
            holder_party_id: row.holder_party_id,
            status: row.status,
        })) as RightCertificateRow[],
    });

    const finalLineByCase = new Map<string, number>();
    for (const line of ((linesRes.data as SettlementLineRow[] | null) || [])) {
        finalLineByCase.set(line.case_id, (finalLineByCase.get(line.case_id) || 0) + parseMoney(line.amount));
    }

    const paidByCase = new Map<string, number>();
    for (const payment of ((paymentsRes.data as RefundPaymentRow[] | null) || [])) {
        if (payment.payment_status !== 'paid') continue;
        paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + parseMoney(payment.paid_amount));
    }

    const header = [
        '케이스ID',
        '인물ID',
        '명의',
        '소유유형',
        'member_id',
        '케이스상태',
        '정산예정',
        '지급',
        '잔여',
        '진단결과',
        '생성일',
    ];

    const bodyRows: string[] = [];
    for (const settlementCase of settlementCases) {
        const ownership = ownershipMap.get(settlementCase.party_id);
        const expected = Math.max(finalLineByCase.get(settlementCase.id) || 0, 0);
        const paid = paidByCase.get(settlementCase.id) || 0;
        const remaining = Math.max(expected - paid, 0);

        const issues: string[] = [];
        if (!ownership || ownership.owner_type === 'unlinked') issues.push('owner_link_missing');
        if (expected <= 0) issues.push('final_refund_missing');
        if (settlementCase.case_status === 'paid' && remaining > 0) issues.push('status_paid_but_remaining');
        if (
            expected > 0 &&
            remaining <= 0 &&
            settlementCase.case_status !== 'paid' &&
            settlementCase.case_status !== 'rejected'
        ) {
            issues.push('status_not_paid_but_zero_remaining');
        }
        if (settlementCase.case_status === 'rejected' && expected > 0) issues.push('rejected_with_expected_amount');

        if (issuesOnly && issues.length === 0) continue;

        bodyRows.push(
            [
                settlementCase.id,
                settlementCase.party_id,
                ownership?.owner_name || '-',
                ownership?.owner_type || 'unlinked',
                ownership?.member_id || '-',
                settlementCase.case_status,
                Math.round(expected),
                Math.round(paid),
                Math.round(remaining),
                issues.length > 0 ? issues.join('|') : 'ok',
                settlementCase.created_at,
            ].map(escapeCsvCell).join(','),
        );
    }

    const lines = [header.map(escapeCsvCell).join(','), ...bodyRows];
    const csvText = `\uFEFF${lines.join('\r\n')}`;
    const dateStamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
    const suffix = issuesOnly ? 'issues' : 'all';
    const fileName = `정산_진단_${suffix}_${dateStamp}.csv`;

    return new Response(csvText, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
            'Cache-Control': 'no-store',
        },
    });
}
