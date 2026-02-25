import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import { createClient } from '@/lib/supabase/server';
import { LegacyFilter } from '@/components/features/finance/LegacyFilter';
import { LegacyTable } from '@/components/features/finance/LegacyTable';
import { extractCertificateNumbers, normalizeCertificateNumber } from '@/lib/legacy/certificateNumbers';
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
import { fetchCertificateCompatRows } from '@/lib/server/certificateCompat';

export const dynamic = 'force-dynamic';

type StatusFilter = 'all' | LegacyMemberSegment;

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
    owner_name: string;
    owner_type: 'member_linked' | 'certificate_holder_linked' | 'legacy_only';
}

interface PartyProfileLiteRow {
    id: string;
    member_id: string | null;
}

interface SettlementCaseLiteRow {
    id: string;
    party_id: string;
    case_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected';
    created_at: string;
}

interface SettlementLineLiteRow {
    case_id: string;
    amount: number | string;
}

interface RefundPaymentLiteRow {
    case_id: string;
    paid_amount: number | string;
    payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
}

interface CertificateOwnerRow {
    certificate_number: string;
    status: string;
    holder_party_id: string;
}

interface PartyOwnerProfileRow {
    id: string;
    display_name: string;
    member_id: string | null;
}

interface MemberOwnerRow {
    id: string;
    name: string | null;
}

const SEGMENT_ORDER: LegacyMemberSegment[] = [
    'registered_116',
    'reserve_member',
    'second_member',
    'landlord_member',
    'general_sale',
    'refunded',
];

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
        case 'owner_name':
            return record.owner_name;
        case 'source_file':
            return record.source_file;
        case 'member_segment':
            return LEGACY_MEMBER_SEGMENT_LABEL_MAP[record.member_segment];
        case 'certificate_count':
        default:
            return record.certificate_count;
    }
}

export default async function FinancePage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; status?: string; sort?: string; order?: string; page?: string }>;
}) {
    const params = await searchParams;
    const query = params?.q?.trim() || '';
    const sortField = (params?.sort === 'rights_count' ? 'certificate_count' : params?.sort) || 'certificate_count';
    const sortOrder = params?.order === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, Number(params?.page) || 1);
    const statusParam = params?.status || 'all';
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
        .select('id, display_name, member_number')
        .eq('is_registered', true);
    const registeredMembers = ((registeredProxyMembers as Array<{ id: string; display_name: string; member_number: string | null }> | null) || []).map(m => ({
        id: m.id,
        name: m.display_name,
        member_number: m.member_number,
        relationships: [],
    })) as RegisteredMemberRow[];
    const registeredProxyIndex = buildRegisteredProxyIndex(
        registeredMembers,
    );

    const baseRecords = (rawRecords as LegacyRawRecord[] | null || []).map((record) => {
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
            member_name: member?.name || null,
        };
    });

    const allCertificateNumbers = Array.from(
        new Set(baseRecords.flatMap((record) => record.certificate_numbers)),
    );

    const certificateOwnerMap = new Map<string, CertificateOwnerRow>();
    const statusPriority = (status: string) => {
        const normalized = (status || '').toLowerCase();
        if (normalized === 'active') return 2;
        if (normalized === 'merged') return 1;
        return 0;
    };

    if (allCertificateNumbers.length > 0) {
        const certificateOwners = (await fetchCertificateCompatRows(supabase, {
            certificateNumbers: allCertificateNumbers,
        })) as CertificateOwnerRow[];
        for (const owner of certificateOwners) {
            const existing = certificateOwnerMap.get(owner.certificate_number);
            if (!existing || statusPriority(owner.status) > statusPriority(existing.status)) {
                certificateOwnerMap.set(owner.certificate_number, owner);
            }
        }
    }

    const holderPartyIds = Array.from(
        new Set(Array.from(certificateOwnerMap.values()).map((item) => item.holder_party_id)),
    );
    const { data: ownerPartyProfilesRaw } = holderPartyIds.length > 0
        ? await supabase
            .from('party_profiles')
            .select('id, display_name, member_id')
            .in('id', holderPartyIds)
        : { data: [] as PartyOwnerProfileRow[] };
    const ownerPartyProfiles = (ownerPartyProfilesRaw as PartyOwnerProfileRow[] | null) || [];
    const ownerPartyMap = new Map(ownerPartyProfiles.map((row) => [row.id, row]));

    const memberIdsForOwner = new Set<string>();
    for (const row of baseRecords) {
        if (row.member_id) memberIdsForOwner.add(row.member_id);
    }
    for (const row of ownerPartyProfiles) {
        if (row.member_id) memberIdsForOwner.add(row.member_id);
    }

    const { data: ownerMembersRaw } = memberIdsForOwner.size > 0
        ? await supabase
            .from('account_entities')
            .select('id, display_name')
            .in('id', Array.from(memberIdsForOwner))
        : { data: [] as Array<{ id: string; display_name: string }> };
    const ownerMembers = ((ownerMembersRaw as Array<{ id: string; display_name: string }> | null) || []).map(m => ({ id: m.id, name: m.display_name }));
    const ownerMemberNameMap = new Map(ownerMembers.map((member) => [member.id, member.name || '-']));

    const enrichedRecords: EnrichedLegacyRecord[] = baseRecords.map((record) => {
        const linkedMemberName = record.member_id
            ? ownerMemberNameMap.get(record.member_id) || record.member_name || null
            : null;

        let ownerName = linkedMemberName || record.original_name;
        let ownerType: EnrichedLegacyRecord['owner_type'] = linkedMemberName ? 'member_linked' : 'legacy_only';

        for (const number of record.certificate_numbers) {
            const certOwner = certificateOwnerMap.get(number);
            if (!certOwner) continue;
            const party = ownerPartyMap.get(certOwner.holder_party_id);
            const partyMemberName = party?.member_id ? ownerMemberNameMap.get(party.member_id) : null;
            ownerName = partyMemberName || party?.display_name || ownerName;
            ownerType = partyMemberName ? 'member_linked' : 'certificate_holder_linked';
            break;
        }

        return {
            id: record.id,
            original_name: record.original_name,
            source_file: record.source_file,
            raw_data: record.raw_data,
            member_id: record.member_id,
            member_segment: record.member_segment,
            certificate_numbers: record.certificate_numbers,
            certificate_count: record.certificate_count,
            contact: record.contact,
            owner_name: ownerName,
            owner_type: ownerType,
        };
    });

    const lowerQuery = query.toLowerCase();
    const searchScopedRecords = lowerQuery
        ? enrichedRecords.filter((record) => {
            if (record.original_name.toLowerCase().includes(lowerQuery)) return true;
            if (record.owner_name.toLowerCase().includes(lowerQuery)) return true;
            if (record.contact !== '-' && record.contact.toLowerCase().includes(lowerQuery)) return true;
            return record.certificate_numbers.some((number) => number.toLowerCase().includes(lowerQuery));
        })
        : enrichedRecords;

    const segmentScopedRecords = statusFilter === 'all'
        ? searchScopedRecords
        : searchScopedRecords.filter((record) => record.member_segment === statusFilter);

    const sortedRecords = [...segmentScopedRecords].sort((a, b) => {
        const left = getSortValue(a, sortField);
        const right = getSortValue(b, sortField);
        const direction = sortOrder === 'asc' ? 1 : -1;

        if (typeof left === 'number' && typeof right === 'number') {
            return (left - right) * direction;
        }
        return String(left).localeCompare(String(right), 'ko') * direction;
    });

    const pageSize = 50;
    const totalCount = sortedRecords.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const safePage = Math.min(page, totalPages);
    const from = (safePage - 1) * pageSize;
    const to = from + pageSize;
    const pagedRecords = sortedRecords.slice(from, to);

    const numberFrequency = new Map<string, number>();
    for (const number of searchScopedRecords.flatMap((record) => record.certificate_numbers)) {
        numberFrequency.set(number, (numberFrequency.get(number) || 0) + 1);
    }
    const duplicateNumbers = [...numberFrequency.entries()]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);

    const registeredMemberNumberFrequency = new Map<string, number>();
    const registeredInvalidMemberNumbers: Array<{ name: string; value: string }> = [];
    for (const member of registeredMembers) {
        const rawNumber = member.member_number?.trim() || '';
        if (!rawNumber) continue;

        const normalized = normalizeCertificateNumber(rawNumber);
        if (!normalized) {
            registeredInvalidMemberNumbers.push({
                name: member.name || '-',
                value: rawNumber,
            });
            continue;
        }

        registeredMemberNumberFrequency.set(
            normalized,
            (registeredMemberNumberFrequency.get(normalized) || 0) + 1,
        );
    }

    const registeredMemberNumberSet = new Set(registeredMemberNumberFrequency.keys());
    const legacyBaseRecords = enrichedRecords.filter((record) => record.member_segment !== 'registered_116');
    const legacyNumberFrequency = new Map<string, number>();
    for (const number of legacyBaseRecords.flatMap((record) => record.certificate_numbers)) {
        legacyNumberFrequency.set(number, (legacyNumberFrequency.get(number) || 0) + 1);
    }
    const legacyNumberSet = new Set(legacyNumberFrequency.keys());
    const legacyDuplicateRows = [...legacyNumberFrequency.entries()]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);
    const legacyNonDuplicateCount = [...legacyNumberFrequency.values()].filter((count) => count === 1).length;
    const legacyRecordByNumber = new Map<string, EnrichedLegacyRecord>();
    for (const record of legacyBaseRecords) {
        for (const number of record.certificate_numbers) {
            if (!legacyRecordByNumber.has(number)) {
                legacyRecordByNumber.set(number, record);
            }
        }
    }
    const legacyExclusiveUniqueNumbers = [...legacyNumberFrequency.entries()]
        .filter(([number, count]) => count === 1 && !registeredMemberNumberSet.has(number))
        .map(([number]) => number)
        .sort((a, b) => a.localeCompare(b, 'ko'));
    const legacyExclusiveUniqueRows = legacyExclusiveUniqueNumbers.map((number) => {
        const owner = legacyRecordByNumber.get(number);
        return {
            number,
            ownerName: owner?.original_name || '-',
            ownerSegmentLabel: owner ? LEGACY_MEMBER_SEGMENT_LABEL_MAP[owner.member_segment] : '-',
            contact: owner?.contact || '-',
            sourceFile: owner?.source_file || '-',
        };
    });
    const mergedNumberSet = new Set([...registeredMemberNumberSet, ...legacyNumberSet]);
    const overlapNumbers = [...registeredMemberNumberSet].filter((number) => legacyNumberSet.has(number));
    const registeredOnlyNumbers = [...registeredMemberNumberSet].filter((number) => !legacyNumberSet.has(number));
    const legacyOnlyNumbers = [...legacyNumberSet].filter((number) => !registeredMemberNumberSet.has(number));

    const mergedDuplicateRows = [...mergedNumberSet]
        .map((number) => {
            const registeredCount = registeredMemberNumberFrequency.get(number) || 0;
            const legacyCount = legacyNumberFrequency.get(number) || 0;
            return {
                number,
                registeredCount,
                legacyCount,
                totalCount: registeredCount + legacyCount,
            };
        })
        .filter((row) => row.totalCount > 1)
        .sort((a, b) => b.totalCount - a.totalCount);
    const registeredDuplicateRows = [...registeredMemberNumberFrequency.entries()]
        .filter(([, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]);

    const segmentSummary = SEGMENT_ORDER.map((segment) => {
        const rows = searchScopedRecords.filter((record) => record.member_segment === segment);
        return {
            segment,
            ownerCount: rows.length,
            certificateCount: new Set(rows.flatMap((row) => row.certificate_numbers)).size,
        };
    });

    const refundedPriorityRows = searchScopedRecords
        .filter((record) => record.member_segment === 'refunded' && record.certificate_count > 0)
        .sort((a, b) => b.certificate_count - a.certificate_count)
        .slice(0, 8);

    const memberIdsFromLegacy = Array.from(
        new Set(
            segmentScopedRecords
                .map((record) => record.member_id)
                .filter((memberId): memberId is string => Boolean(memberId)),
        ),
    );

    let memberWithoutPartyCount = 0;
    let settlementCaseMissingCount = 0;
    let finalRefundMissingCount = 0;
    let settlementStatusMismatchCount = 0;
    let qualityIssueCount = 0;

    if (memberIdsFromLegacy.length > 0) {
        const { data: partyProfilesRaw } = await supabase
            .from('party_profiles')
            .select('id, member_id')
            .in('member_id', memberIdsFromLegacy);

        const partyProfiles = (partyProfilesRaw as PartyProfileLiteRow[] | null) || [];
        const partyByMember = new Map(
            partyProfiles
                .filter((party) => Boolean(party.member_id))
                .map((party) => [party.member_id as string, party.id]),
        );

        memberWithoutPartyCount = memberIdsFromLegacy.filter((memberId) => !partyByMember.get(memberId)).length;

        const memberPartyIds = memberIdsFromLegacy
            .map((memberId) => partyByMember.get(memberId))
            .filter((partyId): partyId is string => Boolean(partyId));

        if (memberPartyIds.length > 0) {
            const { data: settlementCasesRaw } = await supabase
                .from('settlement_cases')
                .select('id, party_id, case_status, created_at')
                .in('party_id', memberPartyIds)
                .order('created_at', { ascending: false });

            const settlementCases = (settlementCasesRaw as SettlementCaseLiteRow[] | null) || [];
            const latestCaseByParty = new Map<string, SettlementCaseLiteRow>();
            for (const settlementCase of settlementCases) {
                if (!latestCaseByParty.has(settlementCase.party_id)) {
                    latestCaseByParty.set(settlementCase.party_id, settlementCase);
                }
            }

            settlementCaseMissingCount = memberPartyIds.filter((partyId) => !latestCaseByParty.has(partyId)).length;

            const latestCaseIds = Array.from(latestCaseByParty.values()).map((item) => item.id);
            if (latestCaseIds.length > 0) {
                const [linesRes, paymentsRes] = await Promise.all([
                    supabase
                        .from('settlement_lines')
                        .select('case_id, amount')
                        .in('case_id', latestCaseIds)
                        .eq('line_type', 'final_refund'),
                    supabase
                        .from('refund_payments')
                        .select('case_id, paid_amount, payment_status')
                        .in('case_id', latestCaseIds),
                ]);

                const expectedByCase = new Map<string, number>();
                for (const line of ((linesRes.data as SettlementLineLiteRow[] | null) || [])) {
                    expectedByCase.set(line.case_id, (expectedByCase.get(line.case_id) || 0) + Number(line.amount || 0));
                }

                const paidByCase = new Map<string, number>();
                for (const payment of ((paymentsRes.data as RefundPaymentLiteRow[] | null) || [])) {
                    if (payment.payment_status !== 'paid') continue;
                    paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + Number(payment.paid_amount || 0));
                }

                let paidStatusMismatchCount = 0;
                let shouldBePaidCount = 0;
                for (const settlementCase of latestCaseByParty.values()) {
                    const expected = Math.max(expectedByCase.get(settlementCase.id) || 0, 0);
                    const paid = paidByCase.get(settlementCase.id) || 0;
                    const remaining = Math.max(expected - paid, 0);

                    if (expected <= 0) finalRefundMissingCount += 1;
                    if (settlementCase.case_status === 'paid' && remaining > 0) paidStatusMismatchCount += 1;
                    if (
                        settlementCase.case_status !== 'paid' &&
                        settlementCase.case_status !== 'rejected' &&
                        expected > 0 &&
                        remaining <= 0
                    ) {
                        shouldBePaidCount += 1;
                    }
                }
                settlementStatusMismatchCount = paidStatusMismatchCount + shouldBePaidCount;
            }
        } else {
            settlementCaseMissingCount = memberIdsFromLegacy.length;
        }
    }

    qualityIssueCount =
        memberWithoutPartyCount +
        settlementCaseMissingCount +
        finalRefundMissingCount +
        settlementStatusMismatchCount;

    const getQueryLink = (next: { page?: number; status?: StatusFilter }) => {
        const search = new URLSearchParams();
        if (query) search.set('q', query);
        if (next.status && next.status !== 'all') search.set('status', next.status);
        else if (statusFilter !== 'all' && !next.status) search.set('status', statusFilter);
        search.set('sort', sortField);
        search.set('order', sortOrder);
        search.set('page', String(next.page || 1));
        return `/finance?${search.toString()}`;
    };

    const renderPageNumbers = () => {
        if (totalPages <= 1) return null;
        const pages = [];
        const maxVisible = 5;
        let startPage = Math.max(1, safePage - Math.floor(maxVisible / 2));
        const endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage + 1 < maxVisible) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(
                <Link
                    key={i}
                    href={getQueryLink({ page: i })}
                    className={`size-8 flex items-center justify-center rounded border transition-all text-sm font-bold ${i === safePage
                        ? 'border-blue-500/50 bg-blue-500/10 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]'
                        : 'border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20'
                        }`}
                >
                    {i}
                </Link>
            );
        }
        return pages;
    };

    const currentStatusLabel = statusFilter === 'all'
        ? '전체 상태'
        : LEGACY_MEMBER_SEGMENT_LABEL_MAP[statusFilter];
    const exportSearchParams = new URLSearchParams();
    if (query) exportSearchParams.set('q', query);
    if (statusFilter !== 'all') exportSearchParams.set('status', statusFilter);
    exportSearchParams.set('sort', sortField);
    exportSearchParams.set('order', sortOrder);
    const exportHref = `/api/finance/rights-details/export?${exportSearchParams.toString()}`;
    const legacyExclusiveExportHref = '/api/finance/certificate-audit/legacy-exclusive-export';

    return (
        <div className="flex flex-1 flex-col h-full bg-background overflow-hidden">
            <Header title="자금흐름 / 권리증" />

            <main className="flex-1 overflow-y-auto">
                <div className="flex flex-col gap-5 px-4 py-4 lg:px-6 lg:py-6 max-w-[1600px] mx-auto w-full">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                        <div className="space-y-1">
                            <h2 className="text-xl lg:text-2xl font-extrabold tracking-tight text-foreground">
                                자금흐름 연계 권리증 집계 대시보드
                            </h2>
                            <p className="text-xs lg:text-sm text-muted-foreground">
                                권리증번호 기준 보유 현황과 중복/환불 상태를 자금흐름 관점으로 집계합니다.
                            </p>
                            {error && (
                                <p className="text-xs text-destructive font-bold">
                                    데이터 조회 오류: {error.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        <KpiCard title="통합 권리증번호(A∪B)" value={`${mergedNumberSet.size}개`} tone="blue" />
                        <KpiCard title="등기 조합번호(A)" value={`${registeredMemberNumberSet.size}개`} tone="emerald" />
                        <KpiCard title="Legacy 권리증(B, 비등기)" value={`${legacyNumberSet.size}개`} tone="amber" />
                        <KpiCard title="교집합 중복(A∩B)" value={`${overlapNumbers.length}개`} tone="red" />
                        <KpiCard title="등기만(A-B)" value={`${registeredOnlyNumbers.length}개`} tone="slate" />
                        <KpiCard title="Legacy만(B-A)" value={`${legacyOnlyNumbers.length}개`} tone="slate" />
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                        <KpiCard title="통합 중복 의심" value={`${mergedDuplicateRows.length}개`} tone="red" />
                        <KpiCard title="등기 내부 중복" value={`${registeredDuplicateRows.length}개`} tone="amber" />
                        <KpiCard title="Legacy 내부 중복" value={`${legacyDuplicateRows.length}개`} tone="amber" />
                        <KpiCard title="중복 없는 Legacy" value={`${legacyNonDuplicateCount}개`} tone="emerald" />
                        <KpiCard title="중복없는 Legacy-등기제외" value={`${legacyExclusiveUniqueRows.length}개`} tone="blue" />
                        <KpiCard title="등기 번호 형식오류" value={`${registeredInvalidMemberNumbers.length}건`} tone="red" />
                    </div>
                    <section className="rounded-xl border border-white/[0.08] bg-[#101725] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <MaterialIcon name="verified_user" size="sm" className="text-sky-300" />
                                <p className="text-sm font-extrabold text-foreground">정산 데이터 품질 경고</p>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${qualityIssueCount > 0 ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                                    {qualityIssueCount > 0 ? `이슈 ${qualityIssueCount.toLocaleString()}건` : '이슈 없음'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link href="/api/settlement/diagnostics/export?scope=issues" className="h-8 px-2.5 rounded border border-emerald-400/30 bg-emerald-500/10 text-emerald-200 text-[11px] font-bold inline-flex items-center gap-1">
                                    <MaterialIcon name="download" size="xs" />
                                    진단CSV
                                </Link>
                                <Link href="/settlements" className="h-8 px-2.5 rounded border border-white/15 bg-white/[0.04] text-slate-200 text-[11px] font-bold inline-flex items-center gap-1">
                                    <MaterialIcon name="open_in_new" size="xs" />
                                    정산페이지
                                </Link>
                            </div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                            <QualityBadge label="파티 미연결 회원" count={memberWithoutPartyCount} tone={memberWithoutPartyCount > 0 ? 'warn' : 'ok'} href="/members?status=%EC%97%B0%EA%B2%B0%ED%95%84%EC%9A%94" />
                            <QualityBadge label="정산케이스 누락" count={settlementCaseMissingCount} tone={settlementCaseMissingCount > 0 ? 'warn' : 'ok'} href="/members?status=%EC%BC%80%EC%9D%B4%EC%8A%A4%EB%88%84%EB%9D%BD" />
                            <QualityBadge label="최종환불선 미설정" count={finalRefundMissingCount} tone={finalRefundMissingCount > 0 ? 'warn' : 'ok'} href="/settlements?diag=no_final_refund" />
                            <QualityBadge label="상태 불일치" count={settlementStatusMismatchCount} tone={settlementStatusMismatchCount > 0 ? 'danger' : 'ok'} href="/settlements?diag=status_mismatch" />
                        </div>
                    </section>
                    <p className="text-[11px] text-muted-foreground px-1">
                        Legacy 내부 중복은 B(비등기 Legacy)에서 같은 권리증번호가 2건 이상인 번호 수입니다.
                    </p>

                    <LegacyFilter />

                    <section className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                            <h3 className="text-sm font-extrabold text-foreground">권리증 통합 검수 통계</h3>
                            <span className="text-[10px] font-bold uppercase text-muted-foreground">A:등기조합원 조합번호 / B:비등기 Legacy 권리증번호</span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
                            <div className="rounded-lg border border-border/60 overflow-hidden">
                                <div className="px-3 py-2 border-b border-border/60 bg-muted/20">
                                    <p className="text-xs font-bold text-foreground">중복 교집합 Top</p>
                                </div>
                                <div className="max-h-52 overflow-auto">
                                    {mergedDuplicateRows.length > 0 ? (
                                        <table className="w-full text-xs">
                                            <thead className="text-muted-foreground bg-muted/10">
                                                <tr>
                                                    <th className="text-left px-3 py-2 font-bold">번호</th>
                                                    <th className="text-right px-3 py-2 font-bold">총빈도</th>
                                                    <th className="text-right px-3 py-2 font-bold">A</th>
                                                    <th className="text-right px-3 py-2 font-bold">B</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/40">
                                                {mergedDuplicateRows.slice(0, 12).map((row) => (
                                                    <tr key={row.number}>
                                                        <td className="px-3 py-2 font-mono text-foreground">{row.number}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-red-400 font-bold">{row.totalCount}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-emerald-400">{row.registeredCount}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-blue-400">{row.legacyCount}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-xs text-muted-foreground p-4 text-center">중복 번호가 없습니다.</p>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-lg border border-border/60 overflow-hidden">
                                <div className="px-3 py-2 border-b border-border/60 bg-muted/20">
                                    <p className="text-xs font-bold text-foreground">등기 조합번호 형식 오류</p>
                                </div>
                                <div className="max-h-52 overflow-auto">
                                    {registeredInvalidMemberNumbers.length > 0 ? (
                                        <table className="w-full text-xs">
                                            <thead className="text-muted-foreground bg-muted/10">
                                                <tr>
                                                    <th className="text-left px-3 py-2 font-bold">이름</th>
                                                    <th className="text-left px-3 py-2 font-bold">원본 조합번호</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/40">
                                                {registeredInvalidMemberNumbers.slice(0, 12).map((row, index) => (
                                                    <tr key={`${row.name}-${row.value}-${index}`}>
                                                        <td className="px-3 py-2 text-foreground">{row.name}</td>
                                                        <td className="px-3 py-2 font-mono text-red-400">{row.value}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-xs text-muted-foreground p-4 text-center">형식 오류가 없습니다.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-extrabold text-foreground">중복없는 Legacy - 등기제외 리스트</h3>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    B(비등기 Legacy) 중 1회만 나온 번호에서 A(등기 조합번호)와 겹치는 번호를 제외한 목록
                                </p>
                            </div>
                            <a
                                href={legacyExclusiveExportHref}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors"
                            >
                                <MaterialIcon name="download" size="sm" />
                                엑셀 출력
                            </a>
                        </div>
                        <div className="max-h-72 overflow-auto">
                            {legacyExclusiveUniqueRows.length > 0 ? (
                                <table className="w-full text-xs">
                                    <thead className="sticky top-0 bg-[#161B22] text-muted-foreground border-b border-border/60">
                                        <tr>
                                            <th className="text-left px-4 py-2 font-bold">권리증번호</th>
                                            <th className="text-left px-4 py-2 font-bold">소유자(legacy)</th>
                                            <th className="text-left px-4 py-2 font-bold">상태</th>
                                            <th className="text-left px-4 py-2 font-bold">연락처</th>
                                            <th className="text-left px-4 py-2 font-bold">출처</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {legacyExclusiveUniqueRows.map((row) => (
                                            <tr key={row.number}>
                                                <td className="px-4 py-2 font-mono text-blue-300">{row.number}</td>
                                                <td className="px-4 py-2 text-foreground font-bold">{row.ownerName}</td>
                                                <td className="px-4 py-2 text-muted-foreground">{row.ownerSegmentLabel}</td>
                                                <td className="px-4 py-2 text-muted-foreground font-mono">{row.contact}</td>
                                                <td className="px-4 py-2 text-muted-foreground">{row.sourceFile}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-xs text-muted-foreground p-4 text-center">표시할 번호가 없습니다.</p>
                            )}
                        </div>
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <section className="lg:col-span-8 rounded-xl border border-border bg-card overflow-hidden">
                            <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
                                <h3 className="text-sm font-extrabold text-foreground">조합원 상태별 권리증번호 집계</h3>
                                <span className="text-[10px] text-muted-foreground font-bold uppercase">검색 기준</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/20 text-muted-foreground">
                                        <tr>
                                            <th className="text-left px-4 py-2 text-xs font-bold">상태</th>
                                            <th className="text-right px-4 py-2 text-xs font-bold">인원</th>
                                            <th className="text-right px-4 py-2 text-xs font-bold">권리증번호 수</th>
                                            <th className="text-right px-4 py-2 text-xs font-bold">보기</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {segmentSummary.map((row) => (
                                            <tr key={row.segment} className="hover:bg-muted/10">
                                                <td className="px-4 py-2 font-bold text-foreground">
                                                    {LEGACY_MEMBER_SEGMENT_LABEL_MAP[row.segment]}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-muted-foreground">
                                                    {row.ownerCount.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-2 text-right font-mono text-blue-400 font-bold">
                                                    {row.certificateCount.toLocaleString()}개
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <Link
                                                        href={getQueryLink({ status: row.segment, page: 1 })}
                                                        className="text-xs font-bold text-primary hover:underline"
                                                    >
                                                        상세
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>

                        <section className="lg:col-span-4 flex flex-col gap-4">
                            <div className="rounded-xl border border-border bg-card overflow-hidden">
                                <div className="px-4 py-3 border-b border-border/60">
                                    <h3 className="text-sm font-extrabold text-foreground">환불자 권리증 보유 Top</h3>
                                </div>
                                <div className="p-3 flex flex-col gap-2">
                                    {refundedPriorityRows.length > 0 ? refundedPriorityRows.map((row) => (
                                        <div key={row.id} className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-bold text-foreground">{row.original_name}</p>
                                                <span className="text-xs font-mono font-bold text-red-400">{row.certificate_count}개</span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mt-0.5">연락처: {row.contact}</p>
                                        </div>
                                    )) : (
                                        <p className="text-xs text-muted-foreground py-4 text-center">환불자 권리증 데이터가 없습니다.</p>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-xl border border-border bg-card overflow-hidden">
                                <div className="px-4 py-3 border-b border-border/60">
                                    <h3 className="text-sm font-extrabold text-foreground">중복 권리증번호 경고</h3>
                                </div>
                                <div className="p-3 flex flex-col gap-2 max-h-56 overflow-auto">
                                    {duplicateNumbers.length > 0 ? duplicateNumbers.slice(0, 8).map(([number, count]) => (
                                        <div key={number} className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 flex items-center justify-between">
                                            <span className="text-xs font-mono font-bold text-amber-300">{number}</span>
                                            <span className="text-[11px] font-bold text-amber-400">{count}건 중복</span>
                                        </div>
                                    )) : (
                                        <p className="text-xs text-muted-foreground py-4 text-center">중복 번호가 없습니다.</p>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>

                    <section className="rounded-xl border border-white/[0.08] bg-card overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm lg:text-base font-extrabold text-foreground">권리증 상세 리스트</h3>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-bold">
                                    {currentStatusLabel}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">
                                    총 <span className="font-bold text-foreground">{totalCount.toLocaleString()}건</span>
                                </p>
                                <a
                                    href={exportHref}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors"
                                >
                                    <MaterialIcon name="download" size="sm" />
                                    엑셀 출력
                                </a>
                            </div>
                        </div>

                        <div className="max-h-[520px] overflow-auto">
                            {pagedRecords.length > 0 ? (
                                <LegacyTable
                                    records={pagedRecords}
                                    tableKey={JSON.stringify({ ...params, page: safePage })}
                                />
                            ) : (
                                <div className="h-48 flex items-center justify-center text-muted-foreground">
                                    검색 결과가 없습니다.
                                </div>
                            )}
                        </div>

                        <div className="px-4 py-3 border-t border-white/[0.08] flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                {totalCount === 0
                                    ? '표시할 데이터가 없습니다.'
                                    : `${from + 1}-${Math.min(to, totalCount)} / ${totalCount.toLocaleString()}건`}
                            </p>
                            <div className="flex items-center gap-1">
                                <Link
                                    href={getQueryLink({ page: Math.max(1, safePage - 1) })}
                                    className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20 transition-all ${safePage <= 1 ? 'pointer-events-none opacity-50' : ''}`}
                                >
                                    <MaterialIcon name="chevron_left" size="sm" />
                                </Link>
                                {renderPageNumbers()}
                                <Link
                                    href={getQueryLink({ page: Math.min(totalPages, safePage + 1) })}
                                    className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 hover:text-white hover:border-white/20 transition-all ${safePage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}
                                >
                                    <MaterialIcon name="chevron_right" size="sm" />
                                </Link>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}

function KpiCard({
    title,
    value,
    tone,
}: {
    title: string;
    value: string;
    tone: 'blue' | 'emerald' | 'amber' | 'red' | 'slate';
}) {
    const toneClass =
        tone === 'blue'
            ? 'border-blue-500/20 bg-blue-500/5 text-blue-400'
            : tone === 'emerald'
                ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                : tone === 'amber'
                    ? 'border-amber-500/20 bg-amber-500/5 text-amber-400'
                    : tone === 'red'
                        ? 'border-red-500/20 bg-red-500/5 text-red-400'
                        : 'border-slate-500/20 bg-slate-500/5 text-slate-300';

    return (
        <div className={`rounded-xl border p-3 lg:p-4 ${toneClass}`}>
            <p className="text-[10px] lg:text-xs font-bold uppercase tracking-wider opacity-80">{title}</p>
            <p className="text-lg lg:text-2xl font-black mt-1 tracking-tight">{value}</p>
        </div>
    );
}

function QualityBadge({
    label,
    count,
    tone,
    href,
}: {
    label: string;
    count: number;
    tone: 'ok' | 'warn' | 'danger';
    href?: string;
}) {
    const toneClass =
        tone === 'ok'
            ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
            : tone === 'danger'
                ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                : 'border-amber-400/20 bg-amber-500/10 text-amber-200';

    const badgeClass = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`;
    const content = (
        <>
            <span>{label}</span>
            <span className="font-black">{count.toLocaleString()}건</span>
        </>
    );

    if (!href) {
        return <div className={badgeClass}>{content}</div>;
    }

    return (
        <Link href={href} className={`${badgeClass} hover:opacity-90 transition-opacity`}>
            {content}
            <MaterialIcon name="open_in_new" size="xs" />
        </Link>
    );
}
