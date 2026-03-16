import {
    finalizeCertificateFields,
    inferNameByPhoneFromNotes,
    mergeCertificateDisplay,
    mergeCertificateNumbers,
    mergeCertificateTokens,
    mergeRelationships,
    normalizePhone,
    normalizeText,
    splitCertificateDisplay,
} from './memberAggregationUtils';
import type { UnifiedPerson } from './memberAggregationTypes';

export function mergeUnifiedPeople(rawUnifiedPeople: UnifiedPerson[]) {
    const inferredNameByPhone = inferNameByPhoneFromNotes(rawUnifiedPeople);
    const peopleByName = new Map<string, UnifiedPerson[]>();
    const namelessByPhone = new Map<string, UnifiedPerson[]>();

    for (const person of rawUnifiedPeople) {
        const inferredName =
            !normalizeText(person.name) && person.phone ? inferredNameByPhone.get(normalizePhone(person.phone)) : null;
        const normalizedPerson = inferredName ? { ...person, name: inferredName } : person;
        const normalizedName = normalizeText(normalizedPerson.name);

        if (normalizedName) {
            const list = peopleByName.get(normalizedName) || [];
            list.push(normalizedPerson);
            peopleByName.set(normalizedName, list);
        } else if (normalizedPerson.phone) {
            const digits = normalizePhone(normalizedPerson.phone);
            const list = namelessByPhone.get(digits) || [];
            list.push(normalizedPerson);
            namelessByPhone.set(digits, list);
        } else {
            peopleByName.set(`unnamed_${normalizedPerson.id}`, [normalizedPerson]);
        }
    }

    const unifiedPeople: UnifiedPerson[] = [];
    const statusPriority: Record<string, number> = {
        제명: 6,
        소송: 5,
        탈퇴: 4,
        비조합원: 3,
        정상: 2,
        미정: 1,
    };

    for (const group of peopleByName.values()) {
        if (group.length === 1) {
            finalizeCertificateFields(group[0]);
            unifiedPeople.push(group[0]);
            continue;
        }

        const target = { ...group[0], entity_ids: group.map((person) => person.id) };
        const allPhonesNumeric = new Set<string>();
        const uniqueDisplayPhones: string[] = [];

        const processPhone = (rawPhone: string | null | undefined) => {
            if (!rawPhone) return;
            const phones = rawPhone.split(',').map((phone) => phone.trim()).filter(Boolean);
            for (const phone of phones) {
                const digits = normalizePhone(phone);
                if (digits && !allPhonesNumeric.has(digits)) {
                    allPhonesNumeric.add(digits);
                    if (digits.length === 11) uniqueDisplayPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
                    else if (digits.length === 10) uniqueDisplayPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
                    else uniqueDisplayPhones.push(phone);
                }
            }
        };

        processPhone(target.phone);

        for (let index = 1; index < group.length; index++) {
            const person = group[index];
            target.tiers = Array.from(new Set([...(target.tiers || []), ...(person.tiers || [])]));
            target.role_types = Array.from(new Set([...target.role_types, ...person.role_types]));
            target.tier = target.tiers[0];
            target.certificate_display = mergeCertificateDisplay(target.certificate_display, person.certificate_display);
            target.certificate_numbers = mergeCertificateNumbers(target.certificate_numbers, person.certificate_numbers);
            target.certificate_search_tokens = mergeCertificateTokens(target.certificate_search_tokens, person.certificate_search_tokens);
            target.relationships = mergeRelationships(target.relationships, person.relationships);
            target.source_certificate_row_count += person.source_certificate_row_count;
            target.raw_certificate_count += person.raw_certificate_count;
            target.managed_certificate_count += person.managed_certificate_count;
            target.has_merged_certificates = target.has_merged_certificates || person.has_merged_certificates;
            if (person.is_registered) target.is_registered = true;
            if (!target.address_legal && person.address_legal) target.address_legal = person.address_legal;
            if (!target.birth_date && person.birth_date) target.birth_date = person.birth_date;

            const currentPriority = statusPriority[target.status || ''] || 0;
            const incomingPriority = statusPriority[person.status || ''] || 0;
            if (incomingPriority > currentPriority) {
                target.status = person.status;
            }

            if (person.phone) processPhone(person.phone);
            target.settlement_expected += person.settlement_expected;
            target.settlement_paid += person.settlement_paid;
            target.settlement_remaining = Math.max(target.settlement_expected - target.settlement_paid, 0);

            if (person.acts_as_agent_for?.length) {
                target.acts_as_agent_for = [...(target.acts_as_agent_for || []), ...person.acts_as_agent_for];
            }
        }

        if (uniqueDisplayPhones.length > 0) {
            target.phone = uniqueDisplayPhones.join(', ');
        }

        for (const digits of Array.from(allPhonesNumeric)) {
            const namelessList = namelessByPhone.get(digits);
            if (!namelessList) continue;

            for (const nameless of namelessList) {
                target.entity_ids = Array.from(new Set([...target.entity_ids, nameless.id]));
                target.tiers = Array.from(new Set([...(target.tiers || []), ...(nameless.tiers || [])]));
                target.role_types = Array.from(new Set([...target.role_types, ...nameless.role_types]));
                target.certificate_numbers = mergeCertificateNumbers(target.certificate_numbers, nameless.certificate_numbers);
                target.certificate_search_tokens = mergeCertificateTokens(target.certificate_search_tokens, nameless.certificate_search_tokens);
                target.relationships = mergeRelationships(target.relationships, nameless.relationships);
                target.certificate_display = mergeCertificateDisplay(target.certificate_display, nameless.certificate_display);
                if (nameless.acts_as_agent_for) {
                    target.acts_as_agent_for = [...(target.acts_as_agent_for || []), ...nameless.acts_as_agent_for];
                }
                if (target.role_types.includes('certificate_holder') && nameless.tiers?.includes('권리증번호있음')) {
                    if (!target.tiers.includes('권리증번호있음')) {
                        target.tiers.push('권리증번호있음');
                        target.tiers = target.tiers.filter((tier) => tier !== '권리증번호없음');
                    }
                }
                target.settlement_expected += nameless.settlement_expected;
                target.settlement_paid += nameless.settlement_paid;
                target.settlement_remaining = Math.max(target.settlement_expected - target.settlement_paid, 0);
            }

            namelessByPhone.delete(digits);
        }

        finalizeCertificateFields(target);

        if (target.role_types.includes('certificate_holder') && target.tiers) {
            const hasFinalCertNumber = (target.certificate_numbers || []).length > 0;
            if (hasFinalCertNumber) {
                target.tiers = target.tiers.filter((tier) => tier !== '권리증번호없음');
                if (!target.tiers.includes('권리증번호있음')) target.tiers.push('권리증번호있음');
            } else {
                target.tiers = target.tiers.filter((tier) => tier !== '권리증번호있음');
                if (!target.tiers.includes('권리증번호없음')) target.tiers.push('권리증번호없음');
            }
        }

        unifiedPeople.push(target);
    }

    for (const [, list] of namelessByPhone.entries()) {
        const target = { ...list[0], entity_ids: list.map((person) => person.id) };
        target.name = `(성명없음: ${list[0].phone})`;

        for (let index = 1; index < list.length; index++) {
            const person = list[index];
            target.entity_ids = Array.from(new Set([...target.entity_ids, person.id]));
            target.tiers = Array.from(new Set([...(target.tiers || []), ...(person.tiers || [])]));
            target.role_types = Array.from(new Set([...target.role_types, ...person.role_types]));
            target.certificate_numbers = mergeCertificateNumbers(target.certificate_numbers, person.certificate_numbers);
            target.certificate_search_tokens = mergeCertificateTokens(target.certificate_search_tokens, person.certificate_search_tokens);
            target.relationships = mergeRelationships(target.relationships, person.relationships);
            target.certificate_display = mergeCertificateDisplay(target.certificate_display, person.certificate_display);
            if (person.acts_as_agent_for) {
                target.acts_as_agent_for = [...(target.acts_as_agent_for || []), ...person.acts_as_agent_for];
            }
            target.settlement_expected += person.settlement_expected;
            target.settlement_paid += person.settlement_paid;
            target.settlement_remaining = Math.max(target.settlement_expected - target.settlement_paid, 0);
        }

        finalizeCertificateFields(target);
        unifiedPeople.push(target);
    }

    return unifiedPeople;
}

export function enrichInheritedCertificates(unifiedPeople: UnifiedPerson[]) {
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

        for (const relation of person.relationships || []) pushLinked(relation.id);
        for (const owner of person.acts_as_agent_for || []) pushLinked(owner.id);
        pushLinked(person.real_owner?.id);
        for (const nominee of person.nominees || []) pushLinked(nominee.id);

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
            inheritedNumbers.length > 1 ? `${inheritedNumbers[0]} 외 ${inheritedNumbers.length - 1}건` : inheritedNumbers[0];

        if (person.raw_certificate_count === 0 && person.managed_certificate_count === 0) {
            person.raw_certificate_count = inheritedNumbers.length;
            person.managed_certificate_count = inheritedNumbers.length;
            person.has_merged_certificates = inheritedNumbers.length > 1;
        }

        if (person.tiers) {
            person.tiers = person.tiers.filter((tier) => tier !== '권리증번호없음');
            if (!person.tiers.includes('권리증번호있음')) person.tiers.push('권리증번호있음');
        }
    }

    for (const person of unifiedPeople) {
        if (person.raw_certificate_count !== 0 || person.managed_certificate_count !== 0) continue;

        const visibleCount = (person.certificate_numbers || []).length || splitCertificateDisplay(person.certificate_display).length;
        if (visibleCount <= 0) continue;

        person.raw_certificate_count = visibleCount;
        person.managed_certificate_count = visibleCount;
        person.has_merged_certificates = visibleCount > 1;
    }
}
