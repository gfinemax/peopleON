import { createClient } from '@/lib/supabase/server';
import {
    LEGACY_MEMBER_SEGMENT_LABEL_MAP,
    type LegacyMemberSegment,
} from '@/lib/legacy/memberSegments';
import type { AssetRightCertificateRow } from '@/lib/certificates/rightNumbers';
import { getConfirmedCertificateNumbers, normalizeCertificateNumber } from '@/lib/certificates/rightNumbers';

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

type RoleRow = { entity_id: string; role_code: string | null; is_registered: boolean | null };
type EntityReference = { id: string; display_name: string | null; phone: string | null };
type AssetRightRow = AssetRightCertificateRow & {
    id: string;
    status: string | null;
    meta: Record<string, unknown> | null;
    entity_id: string | null;
    account_entities?: EntityReference | EntityReference[] | null;
};

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
    const rolesMap = new Map<string, RoleRow[]>();
    for (const role of allRoles) {
        const existing = rolesMap.get(role.entity_id) || [];
        existing.push(role);
        rolesMap.set(role.entity_id, existing);
    }

    const enrichedRecords: EnrichedLegacyRecord[] = ((allRights as AssetRightRow[] | null) || []).map((right) => {
        const entity = Array.isArray(right.account_entities) ? right.account_entities[0] : right.account_entities;
        const meta = right.meta || {};
        const contact = entity?.phone || (typeof meta.contact === 'string' ? meta.contact : '-');

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
