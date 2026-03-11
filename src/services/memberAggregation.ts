import { SupabaseClient } from '@supabase/supabase-js';
import {
    getCertificateDisplayText,
    getCertificateSearchTokens,
    getConfirmedCertificateNumbers,
} from '@/lib/certificates/rightNumbers';

export type RoleType = 'member' | 'certificate_holder' | 'related_party' | 'refund_applicant' | 'agent';

// Define the interface for the Unified Person
export type UnifiedPerson = {
    id: string; // Primary ID
    entity_ids: string[]; // All IDs in group
    member_id: string | null;
    party_id: string | null;
    name: string;
    certificate_display?: string | null;
    certificate_numbers?: string[];
    certificate_search_tokens?: string[];
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
    birth_date: string | null;
};

export const normalizeText = (value?: string | null) => (value || '').replace(/\s+/g, '').toLowerCase();
export const normalizePhone = (value?: string | null) => (value || '').replace(/\D/g, '');
const normalizeCertificateNumber = (value: string) => value.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/[\s]/g, '').toLowerCase();

const isLikelyPersonName = (value?: string | null) => {
    const candidate = (value || '').trim().replace(/\s+/g, '');
    if (!candidate || candidate.length < 2 || candidate.length > 10) return false;
    if (/\d/.test(candidate)) return false;
    if (!/^[가-힣A-Za-z]+$/.test(candidate)) return false;

    const blocked = new Set([
        '미입력', '정상', '탈퇴', '조합원', '권리증', '대리인', '관계인', '남편', '아내', '배우자',
        '형수', '시동생', '부', '모', '자녀', '기타', '메모', '연락처', '전화번호'
    ]);
    return !blocked.has(candidate);
};

const inferNameByPhoneFromNotes = (people: UnifiedPerson[]) => {
    const namesByPhone = new Map<string, Set<string>>();
    const addCandidate = (rawPhone: string, rawName: string) => {
        const digits = normalizePhone(rawPhone);
        const name = (rawName || '').trim().replace(/\s+/g, '');
        if (digits.length < 9 || !isLikelyPersonName(name)) return;

        const existing = namesByPhone.get(digits) || new Set<string>();
        existing.add(name);
        namesByPhone.set(digits, existing);
    };

    const patterns: RegExp[] = [
        /(\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})\s*\(([^()\n]{2,20})\)/g,
        /([^()\n]{2,20})\s*\((\d{2,3}[-\s]?\d{3,4}[-\s]?\d{4})\)/g,
    ];

    for (const person of people) {
        const notes = person.notes || '';
        if (!notes) continue;

        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(notes)) !== null) {
                if (pattern === patterns[0]) addCandidate(match[1], match[2]);
                else addCandidate(match[2], match[1]);
            }
        }
    }

    const resolved = new Map<string, string>();
    for (const [digits, names] of namesByPhone.entries()) {
        if (names.size === 1) {
            resolved.set(digits, Array.from(names)[0]);
        }
    }
    return resolved;
};

export const normalizeTierLabel = (rawTier?: string | null, isRegistered = false) => {
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

export const getUiRoleFromTier = (tier: string | null): 'member' | 'landowner' | 'general' | 'investor' | 'agent' | 'party' | 'other' => {
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

const sanitizeNumber = (val: string | null | undefined) => {
    if (!val) return null;
    const v = val.trim();
    if (v.startsWith('19')) return null;
    if (/^\d{4}\.\d{2}\.\d{2}$/.test(v)) return null;
    return v;
};

const parseMoney = (value: number | string | null | undefined) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

export async function getUnifiedMembers(supabase: SupabaseClient): Promise<{ unifiedPeople: UnifiedPerson[], fetchError: unknown }> {
    let fetchError: unknown = null;

    const [entitiesRes, rolesRes, rightsRes, casesRes, relsRes] = await Promise.all([
        supabase
            .from('account_entities')
            .select('id, entity_type, display_name, phone, address_legal, unit_group, memo, is_favorite, tags, email, meta, status'),
        supabase
            .from('membership_roles')
            .select('id, entity_id, role_code, role_status, is_registered'),
        supabase
            .from('certificate_registry')
            .select('id, entity_id, certificate_number_normalized, certificate_number_raw, certificate_status, source_type, note, is_active, is_confirmed_for_count')
            .eq('is_active', true),
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

    if (fetchError) {
        return { unifiedPeople: [], fetchError };
    }

    const entities = (entitiesRes.data as any[] | null) || [];
    const roles = (rolesRes.data as any[] | null) || [];
    const rightsRaw = (rightsRes.data as any[] | null) || [];
    const rights = rightsRaw.map(r => ({
        id: r.id,
        entity_id: r.entity_id,
        right_type: 'certificate',
        right_number: r.certificate_number_normalized,
        right_number_raw: r.certificate_number_raw,
        right_number_status: r.certificate_status,
        right_number_note: r.note,
        is_confirmed_for_count: r.is_confirmed_for_count
    }));
    const settlementCases = (casesRes.data as any[] | null) || [];
    const relationsList = (relsRes?.data as any[] | null) || [];

    const rolesByEntity = new Map<string, any[]>();
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

    const latestCaseByEntity = new Map<string, any>();
    for (const sc of settlementCases) {
        if (!latestCaseByEntity.has(sc.entity_id)) {
            latestCaseByEntity.set(sc.entity_id, sc);
        }
    }

    const latestCaseIds = Array.from(latestCaseByEntity.values()).map((item) => item.id);
    let settlementLines: any[] = [];
    let refundPayments: any[] = [];

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
        settlementLines = (linesRes.data as any[] | null) || [];
        refundPayments = (paymentsRes.data as any[] | null) || [];
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

        let activeTiers = Array.from(new Set(entityRoles.filter(r => r.role_status === 'active').map(r => normalizeTierLabel(r.role_code, r.is_registered)).filter(Boolean))) as string[];
        const isRegistered = entityRoles.some(r => r.is_registered);

        const hasMemberRoleCode = entityRoles.some(
            r => r.role_status === 'active' &&
                ['등기조합원', '1차'].includes(normalizeTierLabel(r.role_code, r.is_registered) || '')
        );

        if (activeTiers.length === 0 && (isRegistered || hasMemberRoleCode)) {
            activeTiers = ['등기조합원'];
        }

        let tiers = activeTiers;

        const agentConnectionsForTier = actsAsAgentFor.get(entity.id) || [];
        const bestAgentRel = agentConnectionsForTier[0]?.relation || '';

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
        const inactiveRoles = new Set(entityRoles.filter(r => r.role_status === 'inactive').map(r => r.role_code));

        for (const r of entityRoles.filter(r => r.role_status === 'active')) {
            const uiRole = getUiRoleFromTier(r.role_code);
            if (uiRole === 'member') roleTypes.add('member');
            if (uiRole === 'investor') roleTypes.add('certificate_holder');
            if (uiRole === 'agent') roleTypes.add('agent');
            if (uiRole === 'party') roleTypes.add('related_party');
        }

        const agentConnections = actsAsAgentFor.get(entity.id) || [];
        const hasAgentRole = agentConnections.some(af => classifyRel(af.relation));
        const hasRelatedPartyRole = agentConnections.some(af => !classifyRel(af.relation));

        if (isRegistered) {
            roleTypes.add('member');
        } else if (hasMemberRoleCode && !inactiveRoles.has('등기조합원') && !inactiveRoles.has('1차')) {
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
        const certificateNumbers = getConfirmedCertificateNumbers(entityRights);
        const certificateDisplay = getCertificateDisplayText(entityRights, { includeFallbackStatus: true });
        const certificateSearchTokens = getCertificateSearchTokens(entityRights);

        const isDateLike = (v: string): boolean => {
            const s = v.trim();
            const m = s.match(/^(19[2-9]\d)[\.\-](\d{2})[\.\-](\d{2})$/);
            if (m) return +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;

            const m2 = s.match(/^(19[2-9]\d)(\d{2})(\d{2})$/);
            if (m2) return +m2[2] >= 1 && +m2[2] <= 12 && +m2[3] >= 1 && +m2[3] <= 31;

            return false;
        };

        const dateLikeCertNumbers = certificateSearchTokens.filter(cn => isDateLike(cn));

        let derivedBirthDate = entity.birth_date;
        if (!derivedBirthDate && dateLikeCertNumbers.length > 0) {
            const candidate = dateLikeCertNumbers[0];
            const yearMatch = candidate.match(/^(\d{4})/);
            if (yearMatch && +yearMatch[1] <= 1999) {
                derivedBirthDate = candidate;
            }
        }

        const hasLiveCertData = entityRights.some((right: any) => right.right_type === 'certificate');
        const hasNumericCert = certificateNumbers.length > 0;
        if (roleTypes.has('certificate_holder')) {
            if (hasNumericCert) {
                tiers.push('권리증번호있음');
            } else {
                tiers.push('권리증번호없음');
            }
        }

        rawUnifiedPeople.push({
            id: entity.id,
            _hasLiveCertData: hasLiveCertData,
            entity_ids: [entity.id],
            member_id: entity.id,
            party_id: entity.id,
            name: entity.display_name,
            certificate_display: certificateDisplay,
            certificate_numbers: certificateNumbers,
            certificate_search_tokens: certificateSearchTokens,
            birth_date: derivedBirthDate,
            phone: entity.phone,
            tier,
            tiers,
            status: entity.status || (isLitigation ? '제명' : (isWithdrawn ? '탈퇴' : ((activeRole?.role_status === 'active' || hasMemberRoleCode) ? '정상' : (isAgent ? '정상' : '미정')))),
            is_registered: isRegistered || hasMemberRoleCode,

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

                const isFamilyOrGift = classifyRel(af.relation);
                const relCategory = isFamilyOrGift ? '대리인' : '관계인';

                return { id: af.owner_id, name: af.owner_name, relation: af.relation, type: ownerType, category: relCategory };
            }),
        });
    }

    const inferredNameByPhone = inferNameByPhoneFromNotes(rawUnifiedPeople);
    const peopleByName = new Map<string, UnifiedPerson[]>();
    const namelessByPhone = new Map<string, UnifiedPerson[]>();

    for (const p of rawUnifiedPeople) {
        const inferredName = !normalizeText(p.name) && p.phone ? inferredNameByPhone.get(normalizePhone(p.phone)) : null;
        const person = inferredName ? { ...p, name: inferredName } : p;
        const n = normalizeText(person.name);
        if (n) {
            const list = peopleByName.get(n) || [];
            list.push(person);
            peopleByName.set(n, list);
        } else if (person.phone) {
            const digits = normalizePhone(person.phone);
            const list = namelessByPhone.get(digits) || [];
            list.push(person);
            namelessByPhone.set(digits, list);
        } else {
            peopleByName.set(`unnamed_${person.id}`, [person]);
        }
    }

    const mergeCertificateNumbers = (left: string[] | undefined, right: string[] | undefined) => {
        const mergedCertificateNumbers = new Map<string, string>();
        for (const number of [...(left || []), ...(right || [])]) {
            const key = normalizeCertificateNumber(number);
            const previous = mergedCertificateNumbers.get(key);
            if (!previous || number.length > previous.length) mergedCertificateNumbers.set(key, number);
        }
        return Array.from(mergedCertificateNumbers.values());
    };

    const mergeCertificateTokens = (left: string[] | undefined, right: string[] | undefined) =>
        Array.from(new Set([...(left || []), ...(right || [])].filter(Boolean)));

    const mergeRelationships = (
        left: { id?: string; name: string; relation: string; phone?: string }[] | null | undefined,
        right: { id?: string; name: string; relation: string; phone?: string }[] | null | undefined,
    ) => {
        const merged = new Map<string, { id?: string; name: string; relation: string; phone?: string }>();
        for (const relation of [...(left || []), ...(right || [])]) {
            const key = `${relation.id || relation.name}|${relation.relation}`;
            if (!merged.has(key)) merged.set(key, relation);
        }
        return Array.from(merged.values());
    };

    const finalizeCertificateFields = (person: UnifiedPerson) => {
        const uniqueNumbers = mergeCertificateNumbers([], person.certificate_numbers);
        person.certificate_numbers = uniqueNumbers;

        if (uniqueNumbers.length > 1) {
            person.certificate_display = `${uniqueNumbers[0]} 외 ${uniqueNumbers.length - 1}건`;
        } else if (uniqueNumbers.length === 1) {
            person.certificate_display = uniqueNumbers[0];
        } else if (!person.certificate_display || person.certificate_display === '-') {
            person.certificate_display = '-';
        }

        person.certificate_search_tokens = mergeCertificateTokens(person.certificate_search_tokens, uniqueNumbers);
    };

    const unifiedPeople: UnifiedPerson[] = [];
    for (const group of peopleByName.values()) {
        if (group.length === 1) {
            finalizeCertificateFields(group[0]);
            unifiedPeople.push(group[0]);
            continue;
        }

        const target = { ...group[0], entity_ids: group.map(p => p.id) };

        const allPhonesNumeric = new Set<string>();
        const uniqueDisplayPhones: string[] = [];

        const processPhone = (rawPhone: string | null | undefined) => {
            if (!rawPhone) return;
            const phones = rawPhone.split(',').map(p => p.trim()).filter(Boolean);
            for (const p of phones) {
                const digits = normalizePhone(p);
                if (digits && !allPhonesNumeric.has(digits)) {
                    allPhonesNumeric.add(digits);
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

        for (let i = 1; i < group.length; i++) {
            const p = group[i];
            target.tiers = Array.from(new Set([...(target.tiers || []), ...(p.tiers || [])]));
            target.role_types = Array.from(new Set([...target.role_types, ...p.role_types]));
            target.tier = target.tiers[0];
            if ((!target.certificate_display || target.certificate_display === '-') && p.certificate_display && p.certificate_display !== '-') {
                target.certificate_display = p.certificate_display;
            }
            target.certificate_numbers = mergeCertificateNumbers(target.certificate_numbers, p.certificate_numbers);
            target.certificate_search_tokens = mergeCertificateTokens(target.certificate_search_tokens, p.certificate_search_tokens);
            target.relationships = mergeRelationships(target.relationships, p.relationships);
            if (p.is_registered) target.is_registered = true;
            if (!target.birth_date && p.birth_date) target.birth_date = p.birth_date;

            const statusPriority: Record<string, number> = {
                '제명': 6, '소송': 5, '탈퇴': 4, '비조합원': 3, '정상': 2, '미정': 1
            };
            const currentPriority = statusPriority[target.status || ''] || 0;
            const incomingPriority = statusPriority[p.status || ''] || 0;
            if (incomingPriority > currentPriority) {
                target.status = p.status;
            }

            if (p.phone) processPhone(p.phone);

            target.settlement_expected += p.settlement_expected;
            target.settlement_paid += p.settlement_paid;
            target.settlement_remaining = Math.max(target.settlement_expected - target.settlement_paid, 0);

            if (p.acts_as_agent_for && p.acts_as_agent_for.length > 0) {
                target.acts_as_agent_for = [...(target.acts_as_agent_for || []), ...p.acts_as_agent_for];
            }
        }

        if (uniqueDisplayPhones.length > 0) {
            target.phone = uniqueDisplayPhones.join(', ');
        }

        for (const digits of Array.from(allPhonesNumeric)) {
            const namelessList = namelessByPhone.get(digits);
            if (namelessList) {
                for (const np of namelessList) {
                    target.entity_ids = Array.from(new Set([...target.entity_ids, np.id]));
                    target.tiers = Array.from(new Set([...(target.tiers || []), ...(np.tiers || [])]));
                    target.role_types = Array.from(new Set([...target.role_types, ...np.role_types]));
                    target.certificate_numbers = mergeCertificateNumbers(target.certificate_numbers, np.certificate_numbers);
                    target.certificate_search_tokens = mergeCertificateTokens(target.certificate_search_tokens, np.certificate_search_tokens);
                    target.relationships = mergeRelationships(target.relationships, np.relationships);
                    if ((!target.certificate_display || target.certificate_display === '-') && np.certificate_display && np.certificate_display !== '-') {
                        target.certificate_display = np.certificate_display;
                    }
                    if (np.acts_as_agent_for) {
                        target.acts_as_agent_for = [...(target.acts_as_agent_for || []), ...np.acts_as_agent_for];
                    }
                    if (target.role_types.includes('certificate_holder') && np.tiers?.includes('권리증번호있음')) {
                        if (!target.tiers.includes('권리증번호있음')) {
                            target.tiers.push('권리증번호있음');
                            target.tiers = target.tiers.filter(t => t !== '권리증번호없음');
                        }
                    }
                    target.settlement_expected += np.settlement_expected;
                    target.settlement_paid += np.settlement_paid;
                    target.settlement_remaining = Math.max(target.settlement_expected - target.settlement_paid, 0);
                }
                namelessByPhone.delete(digits);
            }
        }

        finalizeCertificateFields(target);

        if (target.role_types.includes('certificate_holder') && target.tiers) {
            const hasFinalCertNumber = (target.certificate_numbers || []).length > 0;
            if (hasFinalCertNumber) {
                target.tiers = target.tiers.filter(t => t !== '권리증번호없음');
                if (!target.tiers.includes('권리증번호있음')) {
                    target.tiers.push('권리증번호있음');
                }
            } else {
                target.tiers = target.tiers.filter(t => t !== '권리증번호있음');
                if (!target.tiers.includes('권리증번호없음')) {
                    target.tiers.push('권리증번호없음');
                }
            }
        }

        unifiedPeople.push(target);
    }

    for (const [, list] of namelessByPhone.entries()) {
        const target = { ...list[0], entity_ids: list.map(p => p.id) };
        target.name = `(성명없음: ${list[0].phone})`;

        for (let i = 1; i < list.length; i++) {
            const p = list[i];
            target.entity_ids = Array.from(new Set([...target.entity_ids, p.id]));
            target.tiers = Array.from(new Set([...(target.tiers || []), ...(p.tiers || [])]));
            target.role_types = Array.from(new Set([...target.role_types, ...p.role_types]));
            target.certificate_numbers = mergeCertificateNumbers(target.certificate_numbers, p.certificate_numbers);
            target.certificate_search_tokens = mergeCertificateTokens(target.certificate_search_tokens, p.certificate_search_tokens);
            target.relationships = mergeRelationships(target.relationships, p.relationships);
            if ((!target.certificate_display || target.certificate_display === '-') && p.certificate_display && p.certificate_display !== '-') {
                target.certificate_display = p.certificate_display;
            }
            if (p.acts_as_agent_for) {
                target.acts_as_agent_for = [...(target.acts_as_agent_for || []), ...p.acts_as_agent_for];
            }
            target.settlement_expected += p.settlement_expected;
            target.settlement_paid += p.settlement_paid;
            target.settlement_remaining = Math.max(target.settlement_expected - target.settlement_paid, 0);
        }
        finalizeCertificateFields(target);
        unifiedPeople.push(target);
    }

    const personByEntityId = new Map<string, UnifiedPerson>();
    for (const person of unifiedPeople) {
        for (const entityId of person.entity_ids) {
            personByEntityId.set(entityId, person);
        }
    }

    const collectLinkedRegisteredPeople = (person: UnifiedPerson) => {
        const linked = new Map<string, UnifiedPerson>();
        const pushLinked = (entityId?: string | null) => {
            if (!entityId) return;
            const linkedPerson = personByEntityId.get(entityId);
            if (!linkedPerson || linkedPerson.id === person.id || !linkedPerson.is_registered) return;
            if ((linkedPerson.certificate_numbers || []).length === 0) return;
            linked.set(linkedPerson.id, linkedPerson);
        };

        for (const relation of person.relationships || []) {
            pushLinked(relation.id);
        }

        for (const owner of person.acts_as_agent_for || []) {
            pushLinked(owner.id);
        }

        pushLinked(person.real_owner?.id);
        for (const nominee of person.nominees || []) {
            pushLinked(nominee.id);
        }

        return Array.from(linked.values());
    };

    for (const person of unifiedPeople) {
        if (!person.is_registered) continue;
        if ((person.certificate_numbers || []).length > 0) continue;

        const linkedRegisteredPeople = collectLinkedRegisteredPeople(person);
        if (linkedRegisteredPeople.length === 0) continue;

        const inheritedNumbers = mergeCertificateNumbers(
            [],
            linkedRegisteredPeople.flatMap((linkedPerson) => linkedPerson.certificate_numbers || []),
        );

        if (inheritedNumbers.length === 0) continue;

        person.certificate_numbers = inheritedNumbers;
        person.certificate_search_tokens = mergeCertificateTokens(person.certificate_search_tokens, inheritedNumbers);
        person.certificate_display =
            inheritedNumbers.length > 1
                ? `${inheritedNumbers[0]} 외 ${inheritedNumbers.length - 1}건`
                : inheritedNumbers[0];

        if (person.tiers) {
            person.tiers = person.tiers.filter((tier) => tier !== '권리증번호없음');
            if (!person.tiers.includes('권리증번호있음')) {
                person.tiers.push('권리증번호있음');
            }
        }
    }

    return { unifiedPeople, fetchError };
}
