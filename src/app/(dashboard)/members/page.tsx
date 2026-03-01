import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/layout/Header';
import { MaterialIcon } from '@/components/ui/icon';
import Link from 'next/link';
import { MembersTable } from '@/components/features/members/MembersTable';
import { MembersFilter } from '@/components/features/members/MembersFilter';
import { MembersKpiStrip } from '@/components/features/members/MembersKpiStrip';
import { DashboardManager } from '@/components/features/members/DashboardManager';
import { MemberActions } from '@/components/features/members/MemberActions';
import { LinkedOperationPanel } from '@/components/features/members/OperationPanel';
import React from 'react';

export const dynamic = 'force-dynamic';

type MembersSearchParams = {
    q?: string;
    sort?: string;
    order?: string;
    page?: string;
    role?: string;
    tier?: string;
    status?: string;
    tag?: string;
    rel?: string;
};

type RoleType = 'member' | 'certificate_holder' | 'related_party' | 'refund_applicant' | 'agent';

type AccountEntityRow = {
    id: string;
    entity_type: string;
    display_name: string;
    phone: string | null;
    member_number: string | null;
    address_legal: string | null;
    unit_group: string | null;
    memo: string | null;
    status: string | null;
    is_favorite: boolean;
    tags: string[] | null;
    email: string | null;
    meta: Record<string, unknown> | null;
};

type MembershipRoleRow = {
    id: string;
    entity_id: string;
    role_code: string;
    role_status: string;
    is_registered: boolean;
};

type SettlementCaseRow = {
    id: string;
    entity_id: string;
    case_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected';
    created_at: string;
};

type SettlementLineRow = {
    case_id: string;
    line_type: 'capital' | 'debt' | 'loss' | 'certificate_base_refund' | 'premium_recognition' | 'already_paid' | 'adjustment' | 'final_refund';
    amount: number | string;
};

type RefundPaymentRow = {
    case_id: string;
    paid_amount: number | string;
    payment_status: 'requested' | 'paid' | 'failed' | 'cancelled';
};

type ExceptionQueueItem = { label: string; count: number; tone: 'danger' | 'warn' | 'info' };

type UnifiedPerson = {
    id: string; // Primary ID
    entity_ids: string[]; // All IDs in group
    member_id: string | null;
    party_id: string | null;
    name: string;
    member_number: string | null;
    phone: string | null;
    tier: string | null;
    status: string | null;
    is_registered: boolean;
    unit_group: string | null;
    is_favorite?: boolean;
    tags?: string[] | null;
    relationships?: { id?: string; name: string; relation: string; phone?: string }[] | null;
    role_types: RoleType[];
    source_type: 'member' | 'party_only';
    ui_role: 'member' | 'landowner' | 'general' | 'investor' | 'agent' | 'party' | 'other';
    settlement_status: 'draft' | 'review' | 'approved' | 'paid' | 'rejected' | null;
    settlement_expected: number;
    settlement_paid: number;
    settlement_remaining: number;
    notes?: string | null;
    meta?: Record<string, unknown> | null;
    tiers?: string[];
    is_duplicate_name?: boolean;
    acts_as_agent_for?: { id?: string; name: string; relation: string; type: string; category?: string }[] | null;
    real_owner?: { id: string; name: string } | null;
    nominees?: { id: string; name: string }[] | null;
    _hasLiveCertData?: boolean;
};

const tierOrder = ['등기조합원', '1차', '2차', '3차', '일반분양', '지주', '지주조합원', '대리인', '예비조합원', '권리증보유자', '관계인', '권리증환불', '권리증번호있음', '권리증번호없음'];

const normalizeTierFilter = (raw?: string) => {
    const value = (raw || '').trim();
    if (!value || value === 'all') return 'all';
    if (value === '1차') return '등기조합원';
    if (value === '일반') return '일반분양';
    if (value === '예비') return '예비조합원';
    if (value === '3차') return '일반분양';
    if (value === '4차') return 'all';
    return value;
};

const normalizeText = (value?: string | null) => (value || '').replace(/\s+/g, '').toLowerCase();
const normalizePhone = (value?: string | null) => (value || '').replace(/\D/g, '');

const normalizeTierLabel = (rawTier?: string | null, isRegistered = false) => {
    const tierText = normalizeText(rawTier);
    if (tierText === '1차') return '등기조합원';
    if (tierText === '2차') return '2차';
    if (tierText === '일반' || tierText === '일반분양' || tierText === '3차') return '일반분양';
    if (tierText === '지주조합원') return '지주조합원';
    if (tierText === '지주') return '지주';
    if (tierText === '대리인' || tierText === '대리') return '대리인';
    if (tierText === '예비' || tierText === '예비조합원') return '예비조합원';
    if (tierText === '권리증보유자') return '권리증보유자';
    if (tierText === '관계인') return '관계인';
    if (!tierText && isRegistered) return '등기조합원';
    return rawTier?.trim() || null;
};

const getUiRoleFromTier = (tier: string | null): 'member' | 'landowner' | 'general' | 'investor' | 'agent' | 'party' | 'other' => {
    const t = normalizeText(tier);
    if (!t) return 'other';
    if (['등기조합원', '1차', '2차', '예비조합원', '예비', '지주조합원', '일반조합원', '임시원장'].includes(t)) return 'member';
    if (['지주'].includes(t)) return 'landowner';
    if (['일반분양', '일반', '3차'].includes(t)) return 'general';
    if (['권리증보유자', '권리증', '권리증환불', '비조합원권리증'].includes(t)) return 'investor';
    if (['대리인', '대리'].includes(t)) return 'agent';
    if (['관계인'].includes(t)) return 'party';
    return 'other';
};

const isProxyRelationType = (relationType?: string | null) => {
    const normalized = normalizeText(relationType);
    return normalized === 'proxy' || normalized === 'agent' || normalized === 'attorney' || normalized === '대리' || normalized === '대리인';
};

const caseStatusLabelMap: Record<'draft' | 'review' | 'approved' | 'paid' | 'rejected', string> = {
    draft: '작성중',
    review: '검토중',
    approved: '승인',
    paid: '지급완료',
    rejected: '반려',
};

const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) {
        return String((error as { message?: unknown }).message || 'Unknown Error');
    }
    return 'Unknown Error';
};

const parseMoney = (value: number | string | null | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

const formatAmount = (value: number) => `₩${Math.round(value).toLocaleString('ko-KR')}`;

const getRange = (page: number, size: number) => {
    const from = (page - 1) * size;
    const to = from + size - 1;
    return { from, to };
};

const sanitizeNumber = (val: string | null | undefined) => {
    if (!val) return null;
    const v = val.trim();
    if (v.startsWith('19')) return null;
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(v)) return null;
    return v;
};

function comparePeople(a: UnifiedPerson, b: UnifiedPerson, field: string, order: 'asc' | 'desc') {
    const multiplier = order === 'asc' ? 1 : -1;
    const valueOf = (person: UnifiedPerson): string | number => {
        switch (field) {
            case 'member_number':
                return person.member_number || '';
            case 'phone':
                return person.phone || '';
            case 'tier':
                return person.tier || '';
            case 'status':
                return person.status || '';
            case 'settlement_remaining':
                return person.settlement_remaining;
            case 'settlement_expected':
                return person.settlement_expected;
            case 'name':
            default:
                return person.name;
        }
    };

    const left = valueOf(a);
    const right = valueOf(b);
    if (typeof left === 'number' && typeof right === 'number') return (left - right) * multiplier;
    return String(left).localeCompare(String(right), 'ko-KR') * multiplier;
}

export default async function MembersPage({
    searchParams,
}: {
    searchParams: Promise<MembersSearchParams>;
}) {
    const params = (await searchParams) || {};
    const query = params.q?.trim() || '';
    const sortField = params.sort || 'name';
    const sortOrder = (params.order as 'asc' | 'desc') || 'asc';
    const page = Math.max(1, Number(params.page) || 1);
    const roleFilter = params.role || 'all';
    const tierFilter = normalizeTierFilter(params.tier);
    const statusFilter = params.status || 'all';
    const relFilter = params.rel || 'all';
    const tagFilter = params.tag?.trim() || '';
    const pageSize = 50;

    const supabase = await createClient();

    let fetchError: unknown = null;

    const [entitiesRes, rolesRes, rightsRes, casesRes, relsRes] = await Promise.all([
        supabase
            .from('account_entities')
            .select('id, entity_type, display_name, phone, member_number, address_legal, unit_group, memo, is_favorite, tags, email, meta, status'),
        supabase
            .from('membership_roles')
            .select('id, entity_id, role_code, role_status, is_registered'),
        supabase
            .from('asset_rights')
            .select('id, entity_id, right_type, right_number'),
        supabase
            .from('settlement_cases')
            .select('id, entity_id, case_status, created_at')
            .order('created_at', { ascending: false }),
        supabase
            .from('entity_relationships')
            .select('to_entity_id, from_entity_id, relation_type, relation_note, agent_entity:account_entities!from_entity_id(display_name), owner_entity:account_entities!to_entity_id(display_name)')
            .in('relation_type', ['agent', 'nominee_owner']),
    ]);

    if (entitiesRes.error) fetchError = entitiesRes.error;
    if (rolesRes.error && !fetchError) fetchError = rolesRes.error;
    if (rightsRes.error && !fetchError) fetchError = rightsRes.error;
    if (casesRes.error && !fetchError) fetchError = casesRes.error;
    if (relsRes.error && !fetchError) fetchError = relsRes.error;

    const entities = (entitiesRes.data as AccountEntityRow[] | null) || [];
    const roles = (rolesRes.data as MembershipRoleRow[] | null) || [];
    const rights = (rightsRes.data as any[] | null) || [];
    const settlementCases = (casesRes.data as SettlementCaseRow[] | null) || [];
    const relationsList = (relsRes?.data as any[] | null) || [];

    const rolesByEntity = new Map<string, MembershipRoleRow[]>();
    for (const role of roles) {
        const existing = rolesByEntity.get(role.entity_id) || [];
        existing.push(role);
        rolesByEntity.set(role.entity_id, existing);
    }

    const rightsByEntity = new Map<string, any[]>();
    for (const right of rights) {
        const existing = rightsByEntity.get(right.entity_id) || [];
        existing.push(right);
        rightsByEntity.set(right.entity_id, existing);
    }

    const latestCaseByEntity = new Map<string, SettlementCaseRow>();
    for (const sc of settlementCases) {
        if (!latestCaseByEntity.has(sc.entity_id)) {
            latestCaseByEntity.set(sc.entity_id, sc);
        }
    }

    const latestCaseIds = Array.from(latestCaseByEntity.values()).map((item) => item.id);
    let settlementLines: SettlementLineRow[] = [];
    let refundPayments: RefundPaymentRow[] = [];

    if (latestCaseIds.length > 0) {
        const [linesRes, paymentsRes] = await Promise.all([
            supabase
                .from('settlement_lines')
                .select('case_id, line_type, amount')
                .in('case_id', latestCaseIds),
            supabase
                .from('refund_payments')
                .select('case_id, paid_amount, payment_status')
                .in('case_id', latestCaseIds),
        ]);
        settlementLines = (linesRes.data as SettlementLineRow[] | null) || [];
        refundPayments = (paymentsRes.data as RefundPaymentRow[] | null) || [];
    }

    const finalRefundByCase = new Map<string, number>();
    for (const line of settlementLines) {
        if (line.line_type !== 'final_refund') continue;
        finalRefundByCase.set(line.case_id, (finalRefundByCase.get(line.case_id) || 0) + parseMoney(line.amount));
    }

    const paidByCase = new Map<string, number>();
    for (const payment of refundPayments) {
        if (payment.payment_status !== 'paid') continue;
        paidByCase.set(payment.case_id, (paidByCase.get(payment.case_id) || 0) + parseMoney(payment.paid_amount));
    }

    const agentsByEntity = new Map<string, { id?: string; name: string; relation: string; phone?: string }[]>();
    const actsAsAgentFor = new Map<string, { owner_id: string; owner_name: string; relation: string }[]>();
    const realOwnerByNominee = new Map<string, { id: string; name: string }>();
    const nomineesByOwner = new Map<string, { id: string; name: string }[]>();

    for (const rel of relationsList) {
        if (rel.relation_type === 'agent') {
            const existingAgents = agentsByEntity.get(rel.to_entity_id) || [];
            existingAgents.push({
                id: rel.from_entity_id,
                name: (rel.agent_entity as any)?.display_name || '알 수 없음',
                relation: rel.relation_note || '대리인',
            });
            agentsByEntity.set(rel.to_entity_id, existingAgents);

            const existingOwners = actsAsAgentFor.get(rel.from_entity_id) || [];
            existingOwners.push({
                owner_id: rel.to_entity_id,
                owner_name: (rel.owner_entity as any)?.display_name || '알 수 없음',
                relation: rel.relation_note || '대리인'
            });
            actsAsAgentFor.set(rel.from_entity_id, existingOwners);
        } else if (rel.relation_type === 'nominee_owner') {
            realOwnerByNominee.set(rel.from_entity_id, {
                id: rel.to_entity_id,
                name: (rel.owner_entity as any)?.display_name || '알 수 없음'
            });

            const existingNominees = nomineesByOwner.get(rel.to_entity_id) || [];
            existingNominees.push({
                id: rel.from_entity_id,
                name: (rel.agent_entity as any)?.display_name || '알 수 없음'
            });
            nomineesByOwner.set(rel.to_entity_id, existingNominees);
        }
    }

    const rawUnifiedPeople: UnifiedPerson[] = [];
    for (const entity of entities) {
        const entityRoles = rolesByEntity.get(entity.id) || [];
        const isAgent = actsAsAgentFor.has(entity.id);
        // Get active roles first. If none are active but history exists, still assign their registered role for UI tab matching
        let activeTiers = Array.from(new Set(entityRoles.filter(r => r.role_status === 'active').map(r => normalizeTierLabel(r.role_code, r.is_registered)).filter(Boolean))) as string[];

        const isRegistered = entityRoles.some(r => r.is_registered);

        // Treat '1차' or '등기조합원' role_code as registered even if is_registered flag is missing in DB
        // Scope is intentionally narrow: only true registration-tier codes. Do NOT include 예비조합원/2차 etc.
        const hasMemberRoleCode = entityRoles.some(
            r => r.role_status === 'active' &&
                ['등기조합원', '1차'].includes(normalizeTierLabel(r.role_code, r.is_registered) || '')
        );

        if (activeTiers.length === 0 && (isRegistered || hasMemberRoleCode)) {
            activeTiers = ['등기조합원'];
        }

        let tiers = activeTiers;

        // Agent category determination for tier label
        const agentConnectionsForTier = actsAsAgentFor.get(entity.id) || [];
        const bestAgentRel = agentConnectionsForTier[0]?.relation || '';

        // Strict classification logic
        const classifyRel = (relStr: string) => {
            const rel = relStr || '';
            const isSeller = rel.includes('판매') || rel.includes('매수') || rel.includes('소유');
            const isFamilyOrGift = rel.match(/증여|부|모|자녀|처|남편|부인|아내|배우자|사위|며느리|형|누나|오빠|언니|제|매|동생|가족|친인척|삼촌|고모|이모|조카|손주|손녀|손자|모친|부친|장인|장모|시부|시모/) || rel.trim() === '자' || rel.includes('대리');
            return isFamilyOrGift && !isSeller;
        };

        const isFamilyOrGiftForTier = classifyRel(bestAgentRel);
        const derivedTier = isFamilyOrGiftForTier ? '대리인' : '관계인';

        if (isAgent && tiers.length === 0) tiers = [derivedTier];

        const activeRole = entityRoles.find(r => r.role_status === 'active');
        const tier = tiers[0] || null;
        const isWithdrawn = entityRoles.length > 0 && entityRoles.every(r => r.role_status === 'inactive');
        const isLitigation = (entity.memo || '').includes('소송');

        const latestCase = latestCaseByEntity.get(entity.id);
        const expected = latestCase ? Math.max(finalRefundByCase.get(latestCase.id) || 0, 0) : 0;
        const paid = latestCase ? paidByCase.get(latestCase.id) || 0 : 0;

        const roleTypes = new Set<RoleType>();
        // Use raw role_code only - normalizing would cause '1차' inactive history to falsely block '등기조합원' active roles
        const inactiveRoles = new Set(entityRoles.filter(r => r.role_status === 'inactive').map(r => r.role_code));

        for (const r of entityRoles.filter(r => r.role_status === 'active')) {
            const uiRole = getUiRoleFromTier(r.role_code);
            if (uiRole === 'member') roleTypes.add('member');
            if (uiRole === 'investor') roleTypes.add('certificate_holder');
            if (uiRole === 'agent') roleTypes.add('agent');
            if (uiRole === 'party') roleTypes.add('related_party');
        }

        // Logic for auto-classifying based on the "acts_as_agent_for" connections
        const agentConnections = actsAsAgentFor.get(entity.id) || [];
        const hasAgentRole = agentConnections.some(af => classifyRel(af.relation));
        const hasRelatedPartyRole = agentConnections.some(af => !classifyRel(af.relation));

        // is_registered=true is the definitive signal of membership (set from official registration data).
        // It must ALWAYS take priority — even if role_status is 'inactive' (UI toggle history).
        // The inactive override only applies to non-registered people (e.g., manually-added roles removed via UI).
        if (isRegistered) {
            // Registered members always get 'member' role type, regardless of any inactive override
            roleTypes.add('member');
        } else if (hasMemberRoleCode && !inactiveRoles.has('등기조합원') && !inactiveRoles.has('1차')) {
            // Non-registered but has explicit 등기 role code: add 'member' unless manually overridden via UI
            roleTypes.add('member');
        }

        if (rightsByEntity.has(entity.id) && !inactiveRoles.has('권리증보유자')) {
            roleTypes.add('certificate_holder');
        }

        if (hasAgentRole && !inactiveRoles.has('대리인')) {
            roleTypes.add('agent');
        }

        if (hasRelatedPartyRole && !inactiveRoles.has('관계인')) {
            roleTypes.add('related_party');
        }


        const entityRights = rightsByEntity.get(entity.id) || [];
        const certNumbers = entityRights
            .filter(r => r.right_type === 'certificate')
            .map(r => r.right_number?.trim())
            .filter(Boolean) as string[];

        // Add certificate number tier for investors
        // A valid certificate number usually contains digits. 
        // Exclude dummy data matching "YYYY.MM.DD" exclusively or standalone "19..." strings.
        const hasNumericCert = certNumbers.some(cn => {
            const trimmed = cn.trim();
            if (!/\d/.test(trimmed)) return false; // Must have at least one numeric digit
            if (/^\d{4}\.\d{2}\.\d{2}$/.test(trimmed)) return false; // Exclude pure date placeholders like 1900.01.01
            if (/^19\d{2,}$/.test(trimmed)) return false; // Exclude pure "19..." strings that are likely placeholder birth years
            return true;
        });

        if (roleTypes.has('certificate_holder')) {
            if (hasNumericCert) {
                tiers.push('권리증번호있음');
            } else {
                tiers.push('권리증번호없음');
            }
        }

        // Collect all unique base numbers for this record into a simple comma-separated list for aggregation
        // Normalize: strip dashes, spaces, and leading zeros for dedup so "2006-특-63" and "2006-특63" are treated as the same
        const normalizeNumForDedup = (s: string) => s.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/[-\s]/g, '').toLowerCase();
        const numsByNormKey = new Map<string, string>(); // normalized -> display (keep longest form)
        const addNum = (raw: string) => {
            let clean = raw.replace(/\s?외\s?\d+건/, '').trim();
            if (!clean || clean === '-') return;
            const key = normalizeNumForDedup(clean);
            const existing = numsByNormKey.get(key);
            if (!existing || clean.length > existing.length) {
                numsByNormKey.set(key, clean); // keep the more detailed (longer) form
            }
        };
        // Only use entity.member_number as fallback when there are NO live certificate rights.
        // When asset_rights exist, they are the authoritative source; entity.member_number may be stale.
        if (certNumbers.length > 0) {
            certNumbers.forEach(cn => addNum(cn));
        } else {
            const mainNum = sanitizeNumber(entity.member_number);
            if (mainNum) addNum(mainNum);
        }
        const displayMemberNumber = numsByNormKey.size > 0 ? Array.from(numsByNormKey.values()).join(', ') : '-';
        const hasLiveCertData = certNumbers.length > 0;

        rawUnifiedPeople.push({
            id: entity.id,
            _hasLiveCertData: hasLiveCertData,
            entity_ids: [entity.id], // Initialize entity_ids for each raw record
            member_id: entity.id,
            party_id: entity.id,
            name: entity.display_name,
            member_number: displayMemberNumber,
            phone: entity.phone,
            tier,
            tiers,
            status: entity.status || (isLitigation ? '제명' : (isWithdrawn ? '탈퇴' : ((activeRole?.role_status === 'active' || hasMemberRoleCode) ? '정상' : (isAgent ? '정상' : '미정')))),
            is_registered: isRegistered || hasMemberRoleCode, // hasMemberRoleCode is safe here: scoped to '1차'/'등기조합원' only

            unit_group: entity.unit_group,
            is_favorite: entity.is_favorite,
            tags: entity.tags || [],
            relationships: agentsByEntity.get(entity.id) || [],
            role_types: Array.from(roleTypes),
            source_type: 'member',
            ui_role: roleTypes.has('member') ? 'member' : getUiRoleFromTier(tier),
            settlement_status: latestCase?.case_status || null,
            settlement_expected: expected,
            settlement_paid: paid,
            settlement_remaining: Math.max(expected - paid, 0),
            notes: entity.memo,
            meta: entity.meta as any,
            real_owner: realOwnerByNominee.get(entity.id) || null,
            nominees: nomineesByOwner.get(entity.id) || null,
            acts_as_agent_for: (actsAsAgentFor.get(entity.id) || []).map(af => {
                const ownerRoles = rolesByEntity.get(af.owner_id) || [];
                const ownerRights = rightsByEntity.get(af.owner_id) || [];
                const isMember = ownerRoles.some(r => ['등기조합원', '지주조합원', '원지주', '2차', '일반분양', '3차', '예비조합원'].includes(normalizeTierLabel(r.role_code, r.is_registered) || ''));
                const isInvestor = ownerRights.length > 0 || ownerRoles.some(r => ['권리증보유자', '비조합원권리증', '권리증환불'].includes(normalizeTierLabel(r.role_code, r.is_registered) || ''));

                let ownerType = '';
                if (isMember) ownerType = '조합원';
                else if (isInvestor) ownerType = '권리증';

                // Categorize as '대리인' only for gift (증여) or family relations.
                // Otherwise, it's a general connection ('관계인').
                const isFamilyOrGift = classifyRel(af.relation);
                const relCategory = isFamilyOrGift ? '대리인' : '관계인';

                return { id: af.owner_id, name: af.owner_name, relation: af.relation, type: ownerType, category: relCategory };
            }),
        });
    }

    const peopleByName = new Map<string, UnifiedPerson[]>();
    const namelessByPhone = new Map<string, UnifiedPerson[]>();

    for (const p of rawUnifiedPeople) {
        const n = normalizeText(p.name);
        if (n) {
            const list = peopleByName.get(n) || [];
            list.push(p);
            peopleByName.set(n, list);
        } else if (p.phone) {
            const digits = normalizePhone(p.phone);
            const list = namelessByPhone.get(digits) || [];
            list.push(p);
            namelessByPhone.set(digits, list);
        } else {
            // No name, no phone - use id as unique group
            peopleByName.set(`unnamed_${p.id}`, [p]);
        }
    }

    const unifiedPeople: UnifiedPerson[] = [];
    for (const group of peopleByName.values()) {
        if (group.length === 1) {
            unifiedPeople.push(group[0]);
            continue;
        }

        // Merge ALL same-name records into one
        const target = { ...group[0], entity_ids: group.map(p => p.id) };

        const allPhonesNumeric = new Set<string>();
        const uniqueDisplayPhones: string[] = [];

        const processPhone = (rawPhone: string | null | undefined) => {
            if (!rawPhone) return;
            // Split comma-separated phone values and deduplicate each individually
            const phones = rawPhone.split(',').map(p => p.trim()).filter(Boolean);
            for (const p of phones) {
                const digits = normalizePhone(p);
                if (digits && !allPhonesNumeric.has(digits)) {
                    allPhonesNumeric.add(digits);
                    // Standardize to hyphenated format
                    if (digits.length === 11) {
                        uniqueDisplayPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
                    } else if (digits.length === 10) {
                        uniqueDisplayPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
                    } else {
                        uniqueDisplayPhones.push(p);
                    }
                }
            }
        };

        processPhone(target.phone);

        // Check if ANY entity in the group has live certificate data
        const groupHasLiveCertData = group.some((g: any) => g._hasLiveCertData);

        // If the target entity itself has stale data (no live certs) but 
        // another entity in the group has live certs, clear the target's stale member_number
        if (groupHasLiveCertData && !target._hasLiveCertData) {
            target.member_number = '-';
        }

        for (let i = 1; i < group.length; i++) {
            const p = group[i];
            target.tiers = Array.from(new Set([...(target.tiers || []), ...(p.tiers || [])]));
            target.role_types = Array.from(new Set([...target.role_types, ...p.role_types]));
            target.tier = target.tiers[0];

            // Skip stale member_number from entities without live cert data
            // when the group already has live cert data from another entity
            if (groupHasLiveCertData && !(p as any)._hasLiveCertData) {
                // Don't merge stale member_number
            } else if (p.member_number && p.member_number !== '-') {
                // Normalize-dedup: treat "2006-특-63" and "2006-특63" as the same number
                const normKey = (s: string) => s.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/[-\s]/g, '').replace(/\s?외\s?\d+건/, '').toLowerCase();
                const existingParts = (target.member_number === '-' ? '' : (target.member_number || ''))
                    .split(',').map(s => s.replace(/\s?외\s?\d+건/, '').trim()).filter(Boolean);
                const incomingParts = p.member_number
                    .split(',').map(s => s.replace(/\s?외\s?\d+건/, '').trim()).filter(Boolean);

                const merged = new Map<string, string>();
                for (const part of [...existingParts, ...incomingParts]) {
                    const key = normKey(part);
                    const prev = merged.get(key);
                    if (!prev || part.length > prev.length) merged.set(key, part);
                }
                target.member_number = merged.size > 0 ? Array.from(merged.values()).join(', ') : '-';

                // If any merged record has a valid certificate number, mark the target group as having one
                if (incomingParts.some(cn => {
                    const t = cn.trim();
                    if (!/\d/.test(t)) return false;
                    if (/^\d{4}\.\d{2}\.\d{2}$/.test(t)) return false;
                    if (/^19\d{2,}$/.test(t)) return false;
                    return true;
                })) {
                    if (target.role_types.includes('certificate_holder')) {
                        if (!target.tiers.includes('권리증번호있음')) {
                            target.tiers.push('권리증번호있음');
                            target.tiers = target.tiers.filter(t => t !== '권리증번호없음');
                        }
                    }
                }
            }
            if (p.is_registered) target.is_registered = true;

            // Merge status: highest-severity status wins
            const statusPriority: Record<string, number> = {
                '제명': 6, '소송': 5, '탈퇴': 4, '비조합원': 3, '정상': 2, '미정': 1
            };
            const currentPriority = statusPriority[target.status || ''] || 0;
            const incomingPriority = statusPriority[p.status || ''] || 0;
            if (incomingPriority > currentPriority) {
                target.status = p.status;
            }

            // Collect unique phones
            if (p.phone) processPhone(p.phone);

            // Sum up settlement amounts
            target.settlement_expected += p.settlement_expected;
            target.settlement_paid += p.settlement_paid;
            target.settlement_remaining = Math.max(target.settlement_expected - target.settlement_paid, 0);

            // Merge acts_as_agent_for
            if (p.acts_as_agent_for && p.acts_as_agent_for.length > 0) {
                target.acts_as_agent_for = [...(target.acts_as_agent_for || []), ...p.acts_as_agent_for];
            }
        }

        // Reconstruct phone string
        if (uniqueDisplayPhones.length > 0) {
            target.phone = uniqueDisplayPhones.join(', ');
        }

        // --- NEW: Merge nameless records that share any phone with this target ---
        for (const digits of Array.from(allPhonesNumeric)) {
            const namelessList = namelessByPhone.get(digits);
            if (namelessList) {
                for (const np of namelessList) {
                    target.entity_ids = Array.from(new Set([...target.entity_ids, np.id]));
                    target.tiers = Array.from(new Set([...(target.tiers || []), ...(np.tiers || [])]));
                    target.role_types = Array.from(new Set([...target.role_types, ...np.role_types]));
                    if (np.acts_as_agent_for) {
                        target.acts_as_agent_for = [...(target.acts_as_agent_for || []), ...np.acts_as_agent_for];
                    }
                    if (target.role_types.includes('certificate_holder') && np.tiers?.includes('권리증번호있음')) {
                        if (!target.tiers.includes('권리증번호있음')) {
                            target.tiers.push('권리증번호있음');
                            target.tiers = target.tiers.filter(t => t !== '권리증번호없음');
                        }
                    }
                    // Sum up settlement amounts
                    target.settlement_expected += np.settlement_expected;
                    target.settlement_paid += np.settlement_paid;
                    target.settlement_remaining = Math.max(target.settlement_expected - target.settlement_paid, 0);
                }
                namelessByPhone.delete(digits);
            }
        }

        // Final pass: Format member_number to "first 외 N건" if multiple exist
        if (target.member_number && target.member_number !== '-') {
            const normKey = (s: string) => s.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/[-\s]/g, '').toLowerCase();
            const nums = target.member_number.split(',')
                .map(s => {
                    let text = s.trim();
                    const sufIdx = text.indexOf(' 외 ');
                    if (sufIdx > -1) text = text.substring(0, sufIdx).trim();
                    return text;
                })
                .filter(Boolean);

            // Deduplicate using normalized keys (strip dashes)
            const deduped = new Map<string, string>();
            for (const n of nums) {
                const key = normKey(n);
                const prev = deduped.get(key);
                if (!prev || n.length > prev.length) deduped.set(key, n);
            }
            const uniqueNums = Array.from(deduped.values());
            if (uniqueNums.length > 1) {
                target.member_number = `${uniqueNums[0]} 외 ${uniqueNums.length - 1}건`;
            } else if (uniqueNums.length === 1) {
                target.member_number = uniqueNums[0];
            } else {
                target.member_number = '-';
            }
        }

        unifiedPeople.push(target);
    }

    // Also handle solitary records to ensure they are also formatted if they have multiple internal notes
    for (const p of unifiedPeople) {
        if (p.member_number && p.member_number !== '-' && p.member_number.includes(',')) {
            const normKey = (s: string) => s.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/[-\s]/g, '').toLowerCase();
            const nums = p.member_number.split(',')
                .map(s => {
                    let text = s.trim();
                    const sufIdx = text.indexOf(' 외 ');
                    if (sufIdx > -1) text = text.substring(0, sufIdx).trim();
                    return text;
                })
                .filter(Boolean);

            const deduped = new Map<string, string>();
            for (const n of nums) {
                const key = normKey(n);
                const prev = deduped.get(key);
                if (!prev || n.length > prev.length) deduped.set(key, n);
            }
            const uniqueNums = Array.from(deduped.values());
            if (uniqueNums.length > 1) {
                p.member_number = `${uniqueNums[0]} 외 ${uniqueNums.length - 1}건`;
            } else if (uniqueNums.length === 1) {
                p.member_number = uniqueNums[0];
            } else {
                p.member_number = '-';
            }
        }
    }

    // Flush any remaining nameless records as their own rows
    for (const [digits, list] of namelessByPhone.entries()) {
        const target = { ...list[0], entity_ids: list.map(p => p.id) };
        target.name = `(성명없음: ${list[0].phone})`;

        for (let i = 1; i < list.length; i++) {
            const p = list[i];
            target.entity_ids = Array.from(new Set([...target.entity_ids, p.id]));
            target.tiers = Array.from(new Set([...(target.tiers || []), ...(p.tiers || [])]));
            target.role_types = Array.from(new Set([...target.role_types, ...p.role_types]));
            if (p.acts_as_agent_for) {
                target.acts_as_agent_for = [...(target.acts_as_agent_for || []), ...p.acts_as_agent_for];
            }
            target.settlement_expected += p.settlement_expected;
            target.settlement_paid += p.settlement_paid;
            target.settlement_remaining = Math.max(target.settlement_expected - target.settlement_paid, 0);
        }
        unifiedPeople.push(target);
    }

    const isTierMatch = (person: UnifiedPerson, targetTier: string) => {
        const tierLabels = (person.tiers || []).map(t => normalizeText(t));
        const tierText = normalizeText(person.tier);
        const statusText = normalizeText(person.status);

        switch (targetTier) {
            case '등기조합원': return person.is_registered || tierLabels.includes('등기조합원');
            case '2차': return tierLabels.includes('2차');
            case '일반분양': return tierLabels.includes('일반분양') || tierLabels.includes('3차');
            case '지주': return tierLabels.some(t => t.includes('지주'));
            case '지주조합원': return tierLabels.includes('지주조합원') || (tierLabels.some(t => t.includes('지주')) && person.is_registered);
            case '대리인': return tierLabels.includes('대리인') || tierLabels.includes('대리');
            case '예비조합원': return statusText === '예비조합원' || statusText === '예비' || tierLabels.includes('예비조합원');
            case '권리증보유자': return person.role_types.includes('certificate_holder');
            case '권리증환불': return tierLabels.includes('권리증환불');
            case '권리증번호있음': return tierLabels.includes('권리증번호있음');
            case '권리증번호없음': return tierLabels.includes('권리증번호없음');
            default: return tierText === normalizeText(targetTier);
        }
    };

    const isRoleMatch = (person: UnifiedPerson, targetRole: string) => {
        if (targetRole === 'all') return true;
        if (targetRole === 'member' && person.role_types.includes('member')) return true;
        if (targetRole === 'investor' && person.role_types.includes('certificate_holder')) return true;
        if (targetRole === 'party' && person.role_types.includes('related_party')) return true;
        if (!['member', 'investor', 'party'].includes(targetRole) && person.ui_role === targetRole) return true;
        return false;
    };

    const peopleInCurrentRole = unifiedPeople.filter(p => isRoleMatch(p, roleFilter));

    const tierCounts: Record<string, number> = { all: peopleInCurrentRole.length };
    for (const tier of tierOrder) tierCounts[tier] = peopleInCurrentRole.filter((p) => isTierMatch(p, tier)).length;

    const roleCounts: Record<string, number> = { all: unifiedPeople.length, member: 0, landowner: 0, general: 0, investor: 0, party: 0, other: 0 };
    for (const p of unifiedPeople) {
        if (p.role_types.includes('member')) roleCounts.member++;
        if (p.ui_role === 'landowner') roleCounts.landowner++;
        if (p.ui_role === 'general') roleCounts.general++;
        if (p.role_types.includes('certificate_holder')) roleCounts.investor++;
        if (p.role_types.includes('related_party')) roleCounts.party++;
    }

    const filteredPeople = peopleInCurrentRole.filter(p => {
        if (query && !`${p.name} ${p.member_number} ${p.phone}`.toLowerCase().includes(query.toLowerCase())) return false;
        if (tierFilter !== 'all' && !isTierMatch(p, tierFilter)) return false;
        if (statusFilter !== 'all') {
            if (statusFilter === '정산대기' && p.settlement_remaining <= 0) return false;
            if (statusFilter === '지급완료' && (p.settlement_expected <= 0 || p.settlement_remaining > 0)) return false;
            if (statusFilter === '연결필요' && (p.source_type !== 'party_only' || p.member_id)) return false;
            if (statusFilter === '케이스누락' && (!p.party_id || !p.role_types.some(rt => rt === 'member' || rt === 'certificate_holder') || p.settlement_status)) return false;
            if (!['정산대기', '지급완료', '연결필요', '케이스누락'].includes(statusFilter) && p.status !== statusFilter) return false;
        }
        if (tagFilter && !(p.tags || []).includes(tagFilter)) return false;
        if (relFilter !== 'all' && !(p.relationships || []).some(r => r.relation === relFilter)) return false;
        return true;
    });

    const sortedPeople = [...filteredPeople].sort((a, b) => comparePeople(a, b, sortField, sortOrder));
    const totalCount = sortedPeople.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const normalizedPage = Math.min(page, totalPages);
    const { from, to } = getRange(normalizedPage, pageSize);
    const displayedMembers = sortedPeople.slice(from, to + 1);

    const relationNames = Array.from(new Set(relationsList.map(r => r.relation_note).filter(Boolean))).sort();
    const relCounts: Record<string, number> = { all: unifiedPeople.length };
    for (const relName of relationNames) relCounts[relName] = unifiedPeople.filter(p => (p.relationships || []).some(r => r.relation === relName)).length;

    const totalExpectedRefund = unifiedPeople.reduce((sum, p) => sum + p.settlement_expected, 0);
    const totalPaidRefund = unifiedPeople.reduce((sum, p) => sum + p.settlement_paid, 0);
    const totalRemainingRefund = unifiedPeople.reduce((sum, p) => sum + p.settlement_remaining, 0);
    const registeredCount = unifiedPeople.filter(p => p.is_registered).length;
    const certificateHolderCount = unifiedPeople.filter(p => p.role_types.includes('certificate_holder')).length;
    const relatedPartyCount = unifiedPeople.filter(p => p.role_types.includes('related_party')).length;

    const statusCounts: Record<string, number> = {};
    for (const p of unifiedPeople) {
        let s = p.status || '기타';
        // Special calculated statuses
        if (p.settlement_remaining > 0) {
            statusCounts['정산대기'] = (statusCounts['정산대기'] || 0) + 1;
        }
        if (p.settlement_expected > 0 && p.settlement_remaining <= 0) {
            statusCounts['지급완료'] = (statusCounts['지급완료'] || 0) + 1;
        }
        if (p.source_type === 'party_only' && !p.member_id) {
            statusCounts['연결필요'] = (statusCounts['연결필요'] || 0) + 1;
        }
        if (p.party_id && (p.role_types.some(rt => rt === 'member' || rt === 'certificate_holder')) && !p.settlement_status) {
            statusCounts['케이스누락'] = (statusCounts['케이스누락'] || 0) + 1;
        }

        statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    const qualityIssueCount = unifiedPeople.filter(p =>
        (p.source_type === 'party_only' && !p.member_id) ||
        (p.party_id && (p.role_types.includes('member') || p.role_types.includes('certificate_holder')) && !p.settlement_status) ||
        (p.settlement_status === 'paid' && p.settlement_remaining > 0)
    ).length;

    const exceptionItems: ExceptionQueueItem[] = [
        { label: '미확정 분류', count: 0, tone: 'warn' },
        { label: '증빙 확인 대기', count: 0, tone: 'info' },
        { label: '연결 필요 인물', count: unifiedPeople.filter(p => p.source_type === 'party_only' && !p.member_id).length, tone: 'danger' },
    ];

    const topRemaining = [...unifiedPeople].filter(p => p.settlement_remaining > 0).sort((a, b) => b.settlement_remaining - a.settlement_remaining).slice(0, 5);

    const getPageLink = (targetPage: number) => {
        const s = new URLSearchParams();
        if (query) s.set('q', query);
        if (sortField) s.set('sort', sortField);
        if (sortOrder) s.set('order', sortOrder);
        if (roleFilter !== 'all') s.set('role', roleFilter);
        if (tierFilter !== 'all') s.set('tier', tierFilter);
        if (statusFilter !== 'all') s.set('status', statusFilter);
        if (tagFilter) s.set('tag', tagFilter);
        s.set('page', String(targetPage));
        return `/members?${s.toString()}`;
    };

    // Assuming MemberDetailDialog is imported and used here,
    // and `selectedMemberId` and `isDetailOpen` are managed by state in a parent component or within this page.
    // For the purpose of this edit, we'll assume a placeholder for these state variables.
    // const [selectedMemberId, setSelectedMemberId] = React.useState<string | null>(null);
    // const [isDetailOpen, setIsDetailOpen] = React.useState(false);
    // const selectedMember = displayedMembers.find(m => m.id === selectedMemberId);

    return (
        <div className="flex-1 flex flex-col bg-background">
            <Header
                title="조합원 관리"
                iconName="person"
                leftContent={(
                    <div className="flex items-center gap-2 whitespace-nowrap">
                        <MaterialIcon name="groups" size="md" className="text-muted-foreground mr-[-2px]" />
                        <span className="text-[19px] font-bold text-foreground">전체 인물 {unifiedPeople.length.toLocaleString()}</span>
                        <span className="text-[10px] font-bold text-muted-foreground">· 조회 <span className="text-primary">{totalCount.toLocaleString()}</span></span>
                    </div>
                )}
                rightContent={<MemberActions data={unifiedPeople} />}
            />

            <DashboardManager
                kpiSection={(
                    <MembersKpiStrip
                        items={[
                            { label: '등기 조합원', value: `${registeredCount.toLocaleString()}명`, icon: 'badge', tone: 'default', hint: 'is_registered=true' },
                            { label: '권리증 보유', value: `${certificateHolderCount.toLocaleString()}명`, icon: 'folder', tone: 'default', hint: '중복 병합 완료' },
                            { label: '관계인', value: `${relatedPartyCount.toLocaleString()}명`, icon: 'groups_2', tone: 'default', hint: '대리인 포함' },
                            { label: '환불 예정', value: formatAmount(totalExpectedRefund), icon: 'account_balance_wallet', tone: 'warn', hint: '세입자 제외' },
                            { label: '지급 완료', value: formatAmount(totalPaidRefund), icon: 'paid', tone: 'positive', hint: '누적 현황' },
                            { label: '잔여 환불', value: formatAmount(totalRemainingRefund), icon: 'receipt_long', tone: totalRemainingRefund > 0 ? 'danger' : 'positive', hint: '예정 - 지급' },
                        ]}
                    />
                )}
                qualitySection={(
                    <section className="rounded-xl border border-white/[0.08] bg-[#101725] px-3 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <MaterialIcon name="verified_user" size="sm" className="text-sky-300" />
                                <p className="text-sm font-extrabold text-foreground">데이터 품질 경고</p>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${qualityIssueCount > 0 ? 'border-amber-400/30 bg-amber-500/10 text-amber-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                                    {qualityIssueCount > 0 ? `이슈 인물 ${qualityIssueCount.toLocaleString()}명` : '이슈 없음'}
                                </span>
                            </div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-2">
                            <QualityBadge label="회원 미연결" count={unifiedPeople.filter(p => p.source_type === 'party_only' && !p.member_id).length} tone="warn" href="/members?status=연결필요" />
                            <QualityBadge label="케이스 누락" count={unifiedPeople.filter(p => p.party_id && (p.role_types.includes('member') || p.role_types.includes('certificate_holder')) && !p.settlement_status).length} tone="warn" href="/members?status=케이스누락" />
                        </div>
                    </section>
                )}
                filterData={{
                    roleCounts,
                    tierCounts,
                    statusCounts,
                    relCounts,
                    relationNames,
                    absoluteTotalCount: unifiedPeople.length,
                    filteredCount: totalCount,
                }}
            >
                <div className="flex flex-col lg:rounded-xl lg:border lg:border-white/[0.08] lg:bg-card lg:shadow-sm mb-4 lg:mb-6">
                    <div className="p-2 lg:p-3">
                        <div className="flex gap-3">
                            <div className="min-w-0 flex-1 rounded-lg border border-white/[0.06] bg-[#0f1725] overflow-hidden max-h-[68vh]">
                                {displayedMembers.length > 0 ? (
                                    <MembersTable
                                        members={displayedMembers}
                                        tableKey={JSON.stringify(params)}
                                        startIndex={from}
                                    />
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-4 py-12">
                                        <MaterialIcon name="search_off" size="xl" className="opacity-20" />
                                        <p className="font-bold">검색 결과가 없습니다.</p>
                                    </div>
                                )}
                            </div>

                            <LinkedOperationPanel
                                totalRemainingRefund={totalRemainingRefund}
                                totalExpectedRefund={totalExpectedRefund}
                                totalPaidRefund={totalPaidRefund}
                                topRemaining={topRemaining}
                            />
                        </div>
                    </div>

                    <div className="shrink-0 z-20 lg:bg-[#161B22] lg:border-t lg:border-white/[0.08] bg-transparent">
                        <div className="px-6 py-3 flex items-center justify-between">
                            <p className="text-xs text-gray-400">
                                총 <span className="font-bold text-white">{totalCount.toLocaleString()}명</span> 중 <span className="text-white">{Math.min(from + 1, totalCount)}-{Math.min(to + 1, totalCount)}</span> 표시
                            </p>
                            <div className="flex items-center gap-1">
                                <Link href={getPageLink(Math.max(1, normalizedPage - 1))} className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 ${normalizedPage <= 1 ? 'pointer-events-none opacity-50' : ''}`}>
                                    <MaterialIcon name="chevron_left" size="sm" />
                                </Link>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    const p = Math.max(1, Math.min(totalPages - 4, normalizedPage - 2)) + i;
                                    if (p < 1 || p > totalPages) return null;
                                    return (
                                        <Link key={p} href={getPageLink(p)} className={`size-7 flex items-center justify-center rounded border text-xs font-bold ${p === normalizedPage ? 'border-primary bg-primary/10 text-primary' : 'border-white/[0.08] bg-[#161B22] text-gray-400'}`}>
                                            {p}
                                        </Link>
                                    );
                                })}
                                <Link href={getPageLink(Math.min(totalPages, normalizedPage + 1))} className={`size-7 flex items-center justify-center rounded border border-white/[0.08] bg-[#161B22] text-gray-400 ${normalizedPage >= totalPages ? 'pointer-events-none opacity-50' : ''}`}>
                                    <MaterialIcon name="chevron_right" size="sm" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardManager>
        </div>
    );
}

function QualityBadge({ label, count, tone, href }: { label: string; count: number; tone: 'ok' | 'warn' | 'danger'; href?: string }) {
    const toneClass = tone === 'ok' ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200' : tone === 'danger' ? 'border-rose-400/20 bg-rose-500/10 text-rose-200' : 'border-amber-400/20 bg-amber-500/10 text-amber-200';
    const badgeClass = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`;
    if (!href) return <div className={badgeClass}><span>{label}</span><span className="font-black">{count.toLocaleString()}건</span></div>;
    return <Link href={href} className={badgeClass}><span>{label}</span><span className="font-black">{count.toLocaleString()}건</span><MaterialIcon name="open_in_new" size="xs" /></Link>;
}
