import { SupabaseClient } from '@supabase/supabase-js';

export type RoleType = 'member' | 'certificate_holder' | 'related_party' | 'refund_applicant' | 'agent';

// Define the interface for the Unified Person
export type UnifiedPerson = {
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
    birth_date: string | null;
};

export const normalizeText = (value?: string | null) => (value || '').replace(/\s+/g, '').toLowerCase();
export const normalizePhone = (value?: string | null) => (value || '').replace(/\D/g, '');

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

    if (fetchError) {
        return { unifiedPeople: [], fetchError };
    }

    const entities = (entitiesRes.data as any[] | null) || [];
    const roles = (rolesRes.data as any[] | null) || [];
    const rights = (rightsRes.data as any[] | null) || [];
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
        const certNumbers = entityRights
            .filter(r => r.right_type === 'certificate')
            .map(r => r.right_number?.trim())
            .filter(Boolean) as string[];

        const normalizeNumForDedup = (s: string) => s.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/[\s]/g, '').toLowerCase();
        const numsByNormKey = new Map<string, string>();
        const addNum = (raw: string) => {
            let clean = raw.replace(/\s?외\s?\d+건/, '').trim();
            if (!clean || clean === '-') return;
            const key = normalizeNumForDedup(clean);
            const existing = numsByNormKey.get(key);
            if (!existing || clean.length > existing.length) {
                numsByNormKey.set(key, clean);
            }
        };

        const isDateLike = (v: string): boolean => {
            const s = v.trim();
            const m = s.match(/^(19[2-9]\d|20[0-1]\d)[\.\-](\d{1,2})[\.\-](\d{1,2})$/);
            if (m) return +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31;
            const m2 = s.match(/^(19[2-9]\d|20[0-1]\d)(\d{2})(\d{2})$/);
            if (m2) return +m2[2] >= 1 && +m2[2] <= 12 && +m2[3] >= 1 && +m2[3] <= 31;
            return false;
        };

        const realCertNumbers = certNumbers.filter(cn => !isDateLike(cn));
        const dateLikeCertNumbers = certNumbers.filter(cn => isDateLike(cn));

        if (realCertNumbers.length > 0) {
            realCertNumbers.forEach(cn => addNum(cn));
        } else {
            const mainNum = sanitizeNumber(entity.member_number);
            if (mainNum) addNum(mainNum);
        }

        let derivedBirthDate = entity.birth_date;
        if (!derivedBirthDate && dateLikeCertNumbers.length > 0) {
            const candidate = dateLikeCertNumbers[0];
            const yearMatch = candidate.match(/^(\d{4})/);
            if (yearMatch && +yearMatch[1] <= 1999) {
                derivedBirthDate = candidate;
            }
        }

        const displayMemberNumber = numsByNormKey.size > 0 ? Array.from(numsByNormKey.values()).join(', ') : '-';
        const hasLiveCertData = certNumbers.length > 0;

        const hasNumericCert = displayMemberNumber !== '-' && displayMemberNumber !== '';
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
            member_number: displayMemberNumber,
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
            peopleByName.set(`unnamed_${p.id}`, [p]);
        }
    }

    const unifiedPeople: UnifiedPerson[] = [];
    for (const group of peopleByName.values()) {
        if (group.length === 1) {
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

        const groupHasLiveCertData = group.some((g: any) => g._hasLiveCertData);

        if (groupHasLiveCertData && !target._hasLiveCertData) {
            target.member_number = '-';
        }

        for (let i = 1; i < group.length; i++) {
            const p = group[i];
            target.tiers = Array.from(new Set([...(target.tiers || []), ...(p.tiers || [])]));
            target.role_types = Array.from(new Set([...target.role_types, ...p.role_types]));
            target.tier = target.tiers[0];

            if (groupHasLiveCertData && !(p as any)._hasLiveCertData) {
                // Don't merge stale member_number
            } else if (p.member_number && p.member_number !== '-') {
                const normKey = (s: string) => s.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/[\s]/g, '').replace(/\s?외\s?\d+건/, '').toLowerCase();
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

        if (target.member_number && target.member_number !== '-') {
            const normKey = (s: string) => s.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/[\s]/g, '').toLowerCase();
            const nums = target.member_number.split(',')
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
                target.member_number = `${uniqueNums[0]} 외 ${uniqueNums.length - 1}건`;
            } else if (uniqueNums.length === 1) {
                target.member_number = uniqueNums[0];
            } else {
                target.member_number = '-';
            }
        }

        if (target.role_types.includes('certificate_holder') && target.tiers) {
            const hasFinalCertNumber = target.member_number && target.member_number !== '-' && target.member_number !== '';
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

    for (const p of unifiedPeople) {
        if (p.member_number && p.member_number !== '-' && p.member_number.includes(',')) {
            const normKey = (s: string) => s.replace(/(^|[^0-9])0+(?=\d)/g, '$1').replace(/[\s]/g, '').toLowerCase();
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

    return { unifiedPeople, fetchError };
}
