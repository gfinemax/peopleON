import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type Severity = 'pass' | 'fail';
type LegacyRoleType = 'member' | 'certificate_holder' | 'related_party' | 'refund_applicant';
type NormalizedRoleType = 'member' | 'certificate_holder' | 'related_party';

type CheckItem = {
    key: string;
    label: string;
    legacy_count: number;
    compat_count: number;
    diff: number;
    status: Severity;
};

type CompatReadyPayload = {
    generated_at: string;
    overall: Severity;
    summary: {
        total_checks: number;
        pass_checks: number;
        fail_checks: number;
    };
    checks: CheckItem[];
    notes: string[];
    config: {
        accounting_compat_only: boolean;
        fallback_allowed: boolean;
    };
    guard: 'ok' | 'danger';
    recommendation: string;
    audit_logged?: boolean;
    audit_id?: string | null;
};

type PartyProfileRow = { id: string };
type AccountEntityRow = { id: string; source_party_id: string | null };
type LegacyRoleRow = { role_type: LegacyRoleType; role_status: string };
type CompatRoleRow = { entity_id: string; role_code: string; role_status: string };
type LegacyCertificateRow = { holder_party_id: string | null; certificate_number: string; status: string | null };
type CompatCertificateRow = { entity_id: string; certificate_number: string; status: string | null };

function parseAllowedRoles() {
    const configured = process.env.ACCOUNTING_ALLOWED_ROLES || process.env.SETTLEMENT_ALLOWED_ROLES || '';
    return configured
        .split(',')
        .map((role) => role.trim().toLowerCase())
        .filter(Boolean);
}

function extractUserRole(user: {
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
}) {
    const appRole = typeof user.app_metadata?.role === 'string' ? user.app_metadata.role : '';
    const userRole = typeof user.user_metadata?.role === 'string' ? user.user_metadata.role : '';
    return (appRole || userRole || '').trim().toLowerCase();
}

function normalizeLegacyRoleType(roleType: LegacyRoleType): NormalizedRoleType | null {
    if (roleType === 'refund_applicant') return 'certificate_holder';
    if (roleType === 'member' || roleType === 'certificate_holder' || roleType === 'related_party') return roleType;
    return null;
}

function mapCompatRoleCode(roleCode: string): NormalizedRoleType | null {
    const normalized = (roleCode || '').trim();
    if (
        normalized === '등기조합원' ||
        normalized === '2차' ||
        normalized === '일반분양' ||
        normalized === '지주' ||
        normalized === '지주조합원' ||
        normalized === '예비조합원'
    ) {
        return 'member';
    }
    if (normalized === '권리증환불') return 'certificate_holder';
    if (normalized === '관계인') return 'related_party';
    return null;
}

function isActiveCertificateStatus(status: string | null | undefined) {
    const normalized = (status || '').trim().toLowerCase();
    return normalized === 'active' || normalized === 'merged';
}

function makeCheck(key: string, label: string, legacyCount: number, compatCount: number): CheckItem {
    const diff = compatCount - legacyCount;
    return {
        key,
        label,
        legacy_count: legacyCount,
        compat_count: compatCount,
        diff,
        status: diff === 0 ? 'pass' : 'fail',
    };
}

function escapeCsvCell(value: string | number) {
    const text = String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

export async function GET(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = parseAllowedRoles();
    if (allowedRoles.length > 0) {
        const userRole = extractUserRole(user);
        if (!userRole || !allowedRoles.includes(userRole)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const [
        partyProfilesRes,
        accountEntitiesRes,
        legacyRolesRes,
        compatRolesRes,
        legacyCertificatesRes,
        compatCertificatesRes,
    ] = await Promise.all([
        supabase.from('party_profiles').select('id'),
        supabase.from('account_entities').select('id, source_party_id'),
        supabase.from('membership_roles').select('role_code, role_status').eq('role_status', 'active'),
        supabase.from('v_member_roles_compat').select('entity_id, role_code, role_status').eq('role_status', 'active'),
        supabase.from('asset_rights').select('entity_id, certificate_number, status'),
        supabase.from('v_right_certificates_compat').select('entity_id, certificate_number, status'),
    ]);

    if (partyProfilesRes.error) return NextResponse.json({ error: partyProfilesRes.error.message }, { status: 500 });
    if (accountEntitiesRes.error) return NextResponse.json({ error: accountEntitiesRes.error.message }, { status: 500 });
    if (legacyRolesRes.error) return NextResponse.json({ error: legacyRolesRes.error.message }, { status: 500 });
    if (compatRolesRes.error) return NextResponse.json({ error: compatRolesRes.error.message }, { status: 500 });
    if (legacyCertificatesRes.error) return NextResponse.json({ error: legacyCertificatesRes.error.message }, { status: 500 });
    if (compatCertificatesRes.error) return NextResponse.json({ error: compatCertificatesRes.error.message }, { status: 500 });

    const partyProfiles = (partyProfilesRes.data as PartyProfileRow[] | null) || [];
    const accountEntities = (accountEntitiesRes.data as AccountEntityRow[] | null) || [];
    const legacyRoles = (legacyRolesRes.data as CompatRoleRow[] | null) || [];
    const compatRoles = (compatRolesRes.data as CompatRoleRow[] | null) || [];
    const legacyCertificates = (legacyCertificatesRes.data as CompatCertificateRow[] | null) || [];
    const compatCertificates = (compatCertificatesRes.data as CompatCertificateRow[] | null) || [];

    const partyProfileIdSet = new Set(partyProfiles.map((row) => row.id));
    const entityIdToPartyId = new Map<string, string>(
        accountEntities
            .filter((row) => Boolean(row.source_party_id))
            .map((row) => [row.id, row.source_party_id as string]),
    );

    const compatMappedPartyCount = new Set(
        accountEntities
            .map((row) => row.source_party_id)
            .filter((id): id is string => Boolean(id && partyProfileIdSet.has(id))),
    ).size;

    const legacyRoleCount: Record<NormalizedRoleType, number> = {
        member: 0,
        certificate_holder: 0,
        related_party: 0,
    };
    for (const row of legacyRoles) {
        const mapped = mapCompatRoleCode(row.role_code);
        if (!mapped) continue;
        legacyRoleCount[mapped] += 1;
    }

    const compatRoleCount: Record<NormalizedRoleType, number> = {
        member: 0,
        certificate_holder: 0,
        related_party: 0,
    };
    for (const row of compatRoles) {
        const mappedType = mapCompatRoleCode(row.role_code);
        if (!mappedType) continue;
        const partyId = entityIdToPartyId.get(row.entity_id);
        if (!partyId || !partyProfileIdSet.has(partyId)) continue;
        compatRoleCount[mappedType] += 1;
    }

    const legacyRoleTotal =
        legacyRoleCount.member + legacyRoleCount.certificate_holder + legacyRoleCount.related_party;
    const compatRoleTotal =
        compatRoleCount.member + compatRoleCount.certificate_holder + compatRoleCount.related_party;

    const legacyHolderCount = new Set(
        legacyCertificates
            .map((row) => entityIdToPartyId.get(row.entity_id) || null)
            .filter((id): id is string => Boolean(id)),
    ).size;

    const compatHolderCount = new Set(
        compatCertificates
            .map((row) => entityIdToPartyId.get(row.entity_id) || null)
            .filter((id): id is string => Boolean(id)),
    ).size;

    const checks: CheckItem[] = [
        makeCheck('party_profiles_mapped', 'party_profiles 매핑 인물 수', partyProfiles.length, compatMappedPartyCount),
        makeCheck('roles_total_active', '활성 역할 총건수', legacyRoleTotal, compatRoleTotal),
        makeCheck('roles_member_active', '활성 조합원 역할', legacyRoleCount.member, compatRoleCount.member),
        makeCheck(
            'roles_certificate_holder_active',
            '활성 권리증보유 역할',
            legacyRoleCount.certificate_holder,
            compatRoleCount.certificate_holder,
        ),
        makeCheck(
            'roles_related_party_active',
            '활성 관계인 역할',
            legacyRoleCount.related_party,
            compatRoleCount.related_party,
        ),
        makeCheck('certificates_total', '권리증 총건수', legacyCertificates.length, compatCertificates.length),
        makeCheck(
            'certificates_active_like',
            '권리증 활성/병합 건수',
            legacyCertificates.filter((row) => isActiveCertificateStatus(row.status)).length,
            compatCertificates.filter((row) => isActiveCertificateStatus(row.status)).length,
        ),
        makeCheck('certificate_holders', '권리증 보유자 수', legacyHolderCount, compatHolderCount),
    ];

    const failCount = checks.filter((item) => item.status === 'fail').length;
    const passCount = checks.length - failCount;
    const overall: Severity = failCount === 0 ? 'pass' : 'fail';
    const compatOnly = process.env.ACCOUNTING_COMPAT_ONLY === 'true';
    const guard: 'ok' | 'danger' = compatOnly && overall === 'fail' ? 'danger' : 'ok';
    const recommendation = compatOnly
        ? overall === 'pass'
            ? 'compat-only 운영 상태 정상'
            : '즉시 ACCOUNTING_COMPAT_ONLY=false 롤백 권고'
        : overall === 'pass'
            ? 'ACCOUNTING_COMPAT_ONLY=true 전환 가능'
            : '불일치 해소 전에는 ACCOUNTING_COMPAT_ONLY 전환 금지';

    const payload: CompatReadyPayload = {
        generated_at: new Date().toISOString(),
        overall,
        summary: {
            total_checks: checks.length,
            pass_checks: passCount,
            fail_checks: failCount,
        },
        checks,
        notes: [
            '대리인(role_code=대리인)은 legacy party_roles 비교에서 제외됩니다.',
            '권리증 보유자 비교는 account_entities.source_party_id 기준으로 계산됩니다.',
        ],
        config: {
            accounting_compat_only: compatOnly,
            fallback_allowed: !compatOnly,
        },
        guard,
        recommendation,
    };

    const url = new URL(request.url);
    const format = (url.searchParams.get('format') || 'json').toLowerCase();
    const shouldLog = ['1', 'true', 'yes'].includes((url.searchParams.get('log') || '').toLowerCase());
    if (format === 'csv') {
        const header = ['key', 'label', 'legacy_count', 'compat_count', 'diff', 'status'];
        const lines = [
            header.map(escapeCsvCell).join(','),
            ...payload.checks.map((item) =>
                [
                    item.key,
                    item.label,
                    item.legacy_count,
                    item.compat_count,
                    item.diff,
                    item.status,
                ].map(escapeCsvCell).join(','),
            ),
            ['summary', 'overall', '', '', '', payload.overall].map(escapeCsvCell).join(','),
            ['summary', 'guard', '', '', '', payload.guard].map(escapeCsvCell).join(','),
            ['summary', 'recommendation', '', '', '', payload.recommendation].map(escapeCsvCell).join(','),
            [
                'summary',
                'config',
                '',
                '',
                '',
                `ACCOUNTING_COMPAT_ONLY=${payload.config.accounting_compat_only ? 'true' : 'false'}`,
            ].map(escapeCsvCell).join(','),
        ];

        const csvText = `\uFEFF${lines.join('\r\n')}`;
        const dateStamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
        const fileName = `회계_호환_전환검증_${dateStamp}.csv`;

        return new Response(csvText, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
                'Cache-Control': 'no-store',
            },
        });
    }

    if (shouldLog) {
        const { data: auditRow, error: auditError } = await supabase
            .from('audit_logs')
            .insert({
                entity_type: 'accounting_compat_check',
                entity_id: null,
                action: 'run',
                actor: user.id,
                reason: '회계 호환 전환 준비 점검',
                metadata: {
                    generated_at: payload.generated_at,
                    overall: payload.overall,
                    summary: payload.summary,
                    checks: payload.checks,
                    guard: payload.guard,
                    recommendation: payload.recommendation,
                    config: payload.config,
                },
            })
            .select('id')
            .maybeSingle();

        payload.audit_logged = !auditError;
        payload.audit_id = auditRow?.id || null;
    }

    return NextResponse.json(payload, { headers: { 'Cache-Control': 'no-store' } });
}
