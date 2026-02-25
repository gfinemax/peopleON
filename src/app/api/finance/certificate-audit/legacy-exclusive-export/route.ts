import { createClient } from '@/lib/supabase/server';
import { extractCertificateNumbers, normalizeCertificateNumber } from '@/lib/legacy/certificateNumbers';
import {
    LEGACY_MEMBER_SEGMENT_LABEL_MAP,
    type LegacyMemberSegment,
} from '@/lib/legacy/memberSegments';
import {
    buildRegisteredProxyIndex,
    isRegisteredProxyMatch,
    type RegisteredMemberProxyReference,
} from '@/lib/legacy/registeredProxyMatcher';

interface MemberReference {
    id: string;
    name: string | null;
    phone: string | null;
    tier: string | null;
    is_registered: boolean | null;
}

interface RegisteredMemberRow extends RegisteredMemberProxyReference {
    name: string | null;
    member_number: string | null;
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

function resolveContact(record: LegacyRawRecord, member: MemberReference | null): string {
    if (member?.phone) return member.phone;
    const foundInRaw = findPhoneFromUnknown(record.raw_data);
    return foundInRaw || '-';
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

function escapeCsvCell(value: string | number): string {
    const text = String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

export async function GET() {
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
        .select('id, display_name, member_number')
        .eq('is_registered', true);

    if (error) {
        return Response.json(
            { error: `Failed to load records: ${error.message}` },
            { status: 500 },
        );
    }

    const registeredMembers = (registeredProxyMembers as RegisteredMemberRow[] | null) || [];
    const registeredProxyIndex = buildRegisteredProxyIndex(registeredMembers);

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

    const registeredMemberNumberSet = new Set<string>();
    for (const member of registeredMembers) {
        const rawNumber = member.member_number?.trim() || '';
        if (!rawNumber) continue;
        const normalized = normalizeCertificateNumber(rawNumber);
        if (normalized) registeredMemberNumberSet.add(normalized);
    }

    const legacyBaseRecords = enrichedRecords.filter((record) => record.member_segment !== 'registered_116');
    const legacyNumberFrequency = new Map<string, number>();
    const legacyRecordByNumber = new Map<string, EnrichedLegacyRecord>();
    for (const record of legacyBaseRecords) {
        for (const number of record.certificate_numbers) {
            legacyNumberFrequency.set(number, (legacyNumberFrequency.get(number) || 0) + 1);
            if (!legacyRecordByNumber.has(number)) {
                legacyRecordByNumber.set(number, record);
            }
        }
    }

    const rows = [...legacyNumberFrequency.entries()]
        .filter(([number, count]) => count === 1 && !registeredMemberNumberSet.has(number))
        .map(([number]) => {
            const owner = legacyRecordByNumber.get(number);
            return {
                number,
                ownerName: owner?.original_name || '-',
                ownerSegment: owner ? LEGACY_MEMBER_SEGMENT_LABEL_MAP[owner.member_segment] : '-',
                contact: owner?.contact || '-',
                sourceFile: owner?.source_file || '-',
            };
        })
        .sort((a, b) => a.number.localeCompare(b.number, 'ko'));

    const header = ['권리증번호', '소유자(legacy)', '상태', '연락처', '출처 파일'];
    const lines = [
        header.map(escapeCsvCell).join(','),
        ...rows.map((row) =>
            [
                row.number,
                row.ownerName,
                row.ownerSegment,
                row.contact,
                row.sourceFile,
            ].map(escapeCsvCell).join(','),
        ),
    ];

    const csvText = `\uFEFF${lines.join('\r\n')}`;
    const dateStamp = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
    const fileName = `중복없는Legacy_등기제외_${dateStamp}.csv`;

    return new Response(csvText, {
        status: 200,
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
            'Cache-Control': 'no-store',
        },
    });
}
