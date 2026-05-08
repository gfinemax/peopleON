import { createClient } from '@/lib/supabase/server';
import {
    LEGACY_MEMBER_SEGMENT_LABEL_MAP,
    LEGACY_MEMBER_SEGMENT_OPTIONS,
    type LegacyMemberSegment,
} from '@/lib/legacy/memberSegments';
import {
    getConfirmedCertificateNumbers,
    resolveCertificateRight,
    type AssetRightCertificateRow,
} from '@/lib/certificates/rightNumbers';

type StatusFilter = 'all' | LegacyMemberSegment;

interface EnrichedLegacyRecord {
    id: string;
    original_name: string;
    source_file: string;
    raw_data: Record<string, unknown>;
    member_id: string | null;
    member_segment: LegacyMemberSegment;
    certificate_numbers: string[];
    certificate_count: number;
    certificate_raw: string;
    certificate_status: string;
    contact: string;
}

const PHONE_PATTERN = /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/;

type RoleRow = { entity_id: string; role_code: string | null; is_registered: boolean | null };
type EntityReference = { id: string; display_name: string | null; phone: string | null };
type AssetRightRow = AssetRightCertificateRow & {
    id: string;
    principal_amount: number | string | null;
    status: string | null;
    meta: Record<string, unknown> | null;
    entity_id: string | null;
    account_entities?: EntityReference | EntityReference[] | null;
};

function isLegacySegment(value: string): value is LegacyMemberSegment {
    return LEGACY_MEMBER_SEGMENT_OPTIONS.some((option) => option.value === value);
}

function findPhoneFromUnknown(value: unknown): string | null {
    if (!value) return null;

    if (typeof value === 'string') {
        const match = value.match(PHONE_PATTERN);
        return match ? match[0].replace(/\s+/g, '') : null;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findPhoneFromUnknown(item);
            if (found) return found;
        }
        return null;
    }

    if (typeof value === 'object') {
        for (const entry of Object.values(value)) {
            const found = findPhoneFromUnknown(entry);
            if (found) return found;
        }
    }

    return null;
}

function getSortValue(record: EnrichedLegacyRecord, sortField: string): string | number {
    switch (sortField) {
        case 'original_name':
            return record.original_name;
        case 'source_file':
            return record.source_file;
        case 'member_segment':
            return LEGACY_MEMBER_SEGMENT_LABEL_MAP[record.member_segment];
        case 'certificate_count':
        default:
            return record.certificate_count;
    }
}

function escapeCsvCell(value: string | number): string {
    const text = String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';
    const statusParam = searchParams.get('status') || 'all';
    const sortFieldRaw = searchParams.get('sort') || 'certificate_count';
    const sortField = sortFieldRaw === 'rights_count' ? 'certificate_count' : sortFieldRaw;
    const sortOrder = searchParams.get('order') === 'asc' ? 'asc' : 'desc';
    const statusFilter: StatusFilter = statusParam === 'all'
        ? 'all'
        : isLegacySegment(statusParam)
            ? statusParam
            : 'all';

    const supabase = await createClient();
    const [rightsRes, rolesRes] = await Promise.all([
        supabase
            .from('asset_rights')
            .select(`
                id,
                right_number,
                right_number_raw,
                right_number_status,
                principal_amount,
                status,
                meta,
                entity_id,
                account_entities (
                    id,
                    display_name,
                    phone
                )
            `),
        supabase
            .from('membership_roles')
            .select('entity_id, role_code, is_registered')
    ]);

    const allRights = rightsRes.data || [];
    const allRoles = rolesRes.data || [];
    const rolesMap = new Map<string, RoleRow[]>();
    for (const role of allRoles) {
        const existing = rolesMap.get(role.entity_id) || [];
        existing.push(role);
        rolesMap.set(role.entity_id, existing);
    }

    if (rightsRes.error) {
        return Response.json(
            { error: `Failed to load records: ${rightsRes.error.message}` },
            { status: 500 },
        );
    }

    const enrichedRecords: EnrichedLegacyRecord[] = ((allRights as AssetRightRow[] | null) || []).map((right) => {
        const entity = Array.isArray(right.account_entities) ? right.account_entities[0] : right.account_entities;
        const meta = right.meta || {};
        const contact = entity?.phone || (typeof meta.contact === 'string' ? meta.contact : findPhoneFromUnknown(meta) || '-');
        const entityRoles = entity ? (rolesMap.get(entity.id) || []) : [];
        const isRegistered = entityRoles.some(r => r.is_registered);
        const activeRoleCode = entityRoles[0]?.role_code || '';

        // Resolve segment
        let segment: LegacyMemberSegment = 'reserve_member';
        if (isRegistered) segment = 'registered_116';
        else if (right.status === 'refunded') segment = 'refunded';
        else if (activeRoleCode.includes('2차')) segment = 'second_member';
        else if (activeRoleCode.includes('지주')) segment = 'landlord_member';
        else if (activeRoleCode.includes('일반')) segment = 'general_sale';

        const resolvedRight = resolveCertificateRight(right);
        const certNumbers = getConfirmedCertificateNumbers([right]);

        return {
            id: right.id,
            original_name: (typeof meta.cert_name === 'string' ? meta.cert_name : entity?.display_name) || '-',
            source_file: typeof meta.source === 'string' ? meta.source : '-',
            raw_data: meta,
            member_id: right.entity_id,
            member_segment: segment,
            certificate_numbers: certNumbers,
            certificate_count: certNumbers.length,
            certificate_raw: resolvedRight.rawValue || '-',
            certificate_status: resolvedRight.status,
            contact,
        };
    });

    const lowerQuery = query.toLowerCase();
    const searchScopedRecords = lowerQuery
        ? enrichedRecords.filter((record) => {
            if (record.original_name.toLowerCase().includes(lowerQuery)) return true;
            if (record.contact !== '-' && record.contact.toLowerCase().includes(lowerQuery)) return true;
            if (record.certificate_raw !== '-' && record.certificate_raw.toLowerCase().includes(lowerQuery)) return true;
            return record.certificate_numbers.some((number) => number.toLowerCase().includes(lowerQuery));
        })
        : enrichedRecords;

    const statusScopedRecords = statusFilter === 'all'
        ? searchScopedRecords
        : searchScopedRecords.filter((record) => record.member_segment === statusFilter);

    const sortedRecords = [...statusScopedRecords].sort((a, b) => {
        const left = getSortValue(a, sortField);
        const right = getSortValue(b, sortField);
        const direction = sortOrder === 'asc' ? 1 : -1;

        if (typeof left === 'number' && typeof right === 'number') {
            return (left - right) * direction;
        }
        return String(left).localeCompare(String(right), 'ko') * direction;
    });

    const header = ['No', '이름', '연락처', '권리증번호', '원문값', '상태', '보유 권리증(번호기준)', '조합원 상태', '출처 파일'];
    const lines = [
        header.map(escapeCsvCell).join(','),
        ...sortedRecords.map((record, index) =>
            [
                index + 1,
                record.original_name,
                record.contact,
                record.certificate_numbers.join(', ') || '-',
                record.certificate_raw,
                record.certificate_status,
                `${record.certificate_count}개`,
                LEGACY_MEMBER_SEGMENT_LABEL_MAP[record.member_segment],
                record.source_file,
            ].map(escapeCsvCell).join(','),
        ),
    ];

    const csvText = `\uFEFF${lines.join('\r\n')}`;
    const dateStamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
    const fileName = `권리증_상세리스트_${dateStamp}.csv`;

    return new Response(csvText, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
            'Cache-Control': 'no-store',
        },
    });
}
