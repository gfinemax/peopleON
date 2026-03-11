import { createClient } from '@/lib/supabase/server';
import {
    LEGACY_MEMBER_SEGMENT_LABEL_MAP,
    type LegacyMemberSegment,
} from '@/lib/legacy/memberSegments';
import {
    buildRegisteredProxyIndex,
    isRegisteredProxyMatch,
    type RegisteredMemberProxyReference,
} from '@/lib/legacy/registeredProxyMatcher';
import { getConfirmedCertificateNumbers, normalizeCertificateNumber } from '@/lib/certificates/rightNumbers';

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

    const [rightsRes, rolesRes] = await Promise.all([
        supabase
            .from('asset_rights')
            .select(`
                id,
                right_number,
                right_number_raw,
                right_number_status,
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

    if (rightsRes.error) {
        return Response.json(
            { error: `Failed to load records: ${rightsRes.error.message}` },
            { status: 500 },
        );
    }

    const allRights = rightsRes.data || [];
    const allRoles = rolesRes.data || [];
    const rolesMap = new Map<string, any[]>();
    for (const role of allRoles) {
        const existing = rolesMap.get(role.entity_id) || [];
        existing.push(role);
        rolesMap.set(role.entity_id, existing);
    }

    const { data: registeredProxyMembers } = await supabase
        .from('account_entities')
        .select('id, display_name, member_number')
        .in('id', allRoles.filter(r => r.is_registered).map(r => r.entity_id));

    const registeredMembers = (registeredProxyMembers as RegisteredMemberRow[] | null) || [];
    const registeredProxyIndex = buildRegisteredProxyIndex(registeredMembers);

    const enrichedRecords: EnrichedLegacyRecord[] = (allRights || []).map((right) => {
        const entity = (right as any).account_entities as any;
        const meta = (right.meta || {}) as any;
        const contact = entity?.phone || meta.contact || '-';

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

        const certNumbers = getConfirmedCertificateNumbers([right as any]);

        return {
            id: right.id,
            original_name: meta.cert_name || entity?.display_name || '-',
            source_file: meta.source || '-',
            raw_data: meta,
            member_id: right.entity_id,
            member_segment: segment,
            certificate_numbers: certNumbers,
            certificate_count: certNumbers.length,
            contact,
        };
    });

    const registeredMemberNumberSet = new Set<string>();
    for (const record of enrichedRecords.filter((item) => item.member_segment === 'registered_116')) {
        for (const number of record.certificate_numbers) {
            const normalized = normalizeCertificateNumber(number);
            if (normalized) registeredMemberNumberSet.add(normalized);
        }
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
