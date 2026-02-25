import { createClient } from '@/lib/supabase/server';
import { extractCertificateNumbers } from '@/lib/legacy/certificateNumbers';
import {
    LEGACY_MEMBER_SEGMENT_LABEL_MAP,
    LEGACY_MEMBER_SEGMENT_OPTIONS,
    type LegacyMemberSegment,
} from '@/lib/legacy/memberSegments';
import {
    buildRegisteredProxyIndex,
    isRegisteredProxyMatch,
    type RegisteredMemberProxyReference,
} from '@/lib/legacy/registeredProxyMatcher';

type StatusFilter = 'all' | LegacyMemberSegment;

interface MemberReference {
    id: string;
    name: string | null;
    phone: string | null;
    tier: string | null;
    is_registered: boolean | null;
}

interface LegacyRawRecord {
    id: string;
    original_name: string;
    source_file: string | null;
    raw_data: Record<string, unknown> | null;
    certificates: unknown;
    member_id: string | null;
    is_refunded: boolean | null;
    members: MemberReference | MemberReference[] | null;
}

interface EnrichedLegacyRecord {
    id: string;
    original_name: string;
    source_file: string;
    raw_data: Record<string, unknown>;
    member_id: string | null;
    member_segment: LegacyMemberSegment;
    certificate_numbers: string[];
    certificate_count: number;
    contact: string;
}

const PHONE_PATTERN = /01[016789][-\s]?\d{3,4}[-\s]?\d{4}/;

function isLegacySegment(value: string): value is LegacyMemberSegment {
    return LEGACY_MEMBER_SEGMENT_OPTIONS.some((option) => option.value === value);
}

function normalizeMemberRef(member: MemberReference | MemberReference[] | null): MemberReference | null {
    if (!member) return null;
    if (Array.isArray(member)) return member[0] ?? null;
    return member;
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

function resolveSegment(
    record: LegacyRawRecord,
    member: MemberReference | null,
    isRegisteredProxy: boolean,
): LegacyMemberSegment {
    if (member?.is_registered || isRegisteredProxy) return 'registered_116';
    if (record.is_refunded) return 'refunded';

    const tier = member?.tier || '';
    if (tier.includes('2차')) return 'second_member';
    if (tier.includes('지주')) return 'landlord_member';
    if (tier.includes('일반')) return 'general_sale';

    return 'reserve_member';
}

function resolveContact(record: LegacyRawRecord, member: MemberReference | null): string {
    if (member?.phone) return member.phone;
    const foundInRaw = findPhoneFromUnknown(record.raw_data);
    return foundInRaw || '-';
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
    const { data: rawRecords, error } = await supabase
        .from('legacy_records')
        .select(`
            id,
            original_name,
            source_file,
            raw_data,
            certificates,
            member_id,
            is_refunded,
            members (
                id,
                name,
                phone,
                tier,
                is_registered
            )
        `);
    const { data: registeredProxyMembers } = await supabase
        .from('account_entities')
        .select('id')
        .eq('is_registered', true);
    const registeredProxyIndex = buildRegisteredProxyIndex(
        ((registeredProxyMembers as Array<{ id: string }> | null) || []).map(m => ({ id: m.id, relationships: [] })) as RegisteredMemberProxyReference[],
    );

    if (error) {
        return Response.json(
            { error: `Failed to load records: ${error.message}` },
            { status: 500 },
        );
    }

    const enrichedRecords: EnrichedLegacyRecord[] = (rawRecords as LegacyRawRecord[] | null || []).map((record) => {
        const member = normalizeMemberRef(record.members);
        const contact = resolveContact(record, member);
        const certificateNumbers = extractCertificateNumbers(record.raw_data || {}, record.certificates);
        const segment = resolveSegment(
            record,
            member,
            isRegisteredProxyMatch(record.original_name, contact, registeredProxyIndex),
        );

        return {
            id: record.id,
            original_name: record.original_name || '-',
            source_file: record.source_file || '-',
            raw_data: record.raw_data || {},
            member_id: record.member_id,
            member_segment: segment,
            certificate_numbers: certificateNumbers,
            certificate_count: certificateNumbers.length,
            contact,
        };
    });

    const lowerQuery = query.toLowerCase();
    const searchScopedRecords = lowerQuery
        ? enrichedRecords.filter((record) => {
            if (record.original_name.toLowerCase().includes(lowerQuery)) return true;
            if (record.contact !== '-' && record.contact.toLowerCase().includes(lowerQuery)) return true;
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

    const header = ['No', '이름', '연락처', '권리증번호', '보유 권리증(번호기준)', '조합원 상태', '출처 파일'];
    const lines = [
        header.map(escapeCsvCell).join(','),
        ...sortedRecords.map((record, index) =>
            [
                index + 1,
                record.original_name,
                record.contact,
                record.certificate_numbers.join(', ') || '-',
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
