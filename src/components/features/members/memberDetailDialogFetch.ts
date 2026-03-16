'use client';

import { createClient } from '@/lib/supabase/client';
import { checkAndLogAssetRightConflicts } from '@/app/actions/interaction';
import {
    getCertificateDisplayText,
    getConfirmedCertificateNumbers,
    type RightNumberStatus,
} from '@/lib/certificates/rightNumbers';
import type { MemberDetailDialogMember } from './memberDetailDialogTypes';
import {
    type AssetRight,
    type CertificateSummaryReviewStatus,
} from './memberDetailDialogUtils';

type Member = MemberDetailDialogMember;

const normalizePhone = (value: string | null | undefined) => (value || '').replace(/\D/g, '');

const normalizeTierLabel = (rawTier?: string | null, isRegistered = false) => {
    if (!rawTier) return isRegistered ? '등기조합원' : null;
    const tier = rawTier.replace(/\s+/g, '').toLowerCase();
    if (tier === '1차') return '등기조합원';
    if (tier === '2차') return '2차';
    if (tier === '일반' || tier === '일반분양' || tier === '3차') return '일반분양';
    if (tier === '지주조합원') return '지주조합원';
    if (tier === '지주') return '지주';
    if (tier === '대리인' || tier === '대리') return '대리인';
    if (tier === '예비' || tier === '예비조합원') return '예비조합원';
    if (tier === '권리증보유자') return '권리증보유자';
    if (tier === '권리증환불' || tier === '비조합원권리증') return '권리증환불';
    if (tier === '관계인') return '관계인';
    return rawTier;
};

export const isDateLikeValue = (value: string): boolean => {
    const trimmed = value.trim();
    const dotted = trimmed.match(/^(19[2-9]\d)[\.\-](\d{1,2})[\.\-](\d{1,2})$/);
    if (dotted) return +dotted[2] >= 1 && +dotted[2] <= 12 && +dotted[3] >= 1 && +dotted[3] <= 31;
    const compact = trimmed.match(/^(19[2-9]\d)(\d{2})(\d{2})$/);
    if (compact) return +compact[2] >= 1 && +compact[2] <= 12 && +compact[3] >= 1 && +compact[3] <= 31;
    return false;
};

export async function fetchMemberDetail(ids: string[]) {
    if (ids.length === 0) return null;

    const supabase = createClient();
    const { data: entities, error: entitiesError } = await supabase
        .from('account_entities')
        .select('*')
        .in('id', ids);

    if (entitiesError || !entities || entities.length === 0) {
        return null;
    }

    const entity = entities[0];

    const [roleRes, relRes, revRelRes, rightsRes, privateInfoRes] = await Promise.all([
        supabase.from('membership_roles').select('role_code, is_registered').in('entity_id', ids),
        supabase
            .from('entity_relationships')
            .select('from_entity_id, to_entity_id, relation_type, relation_note, agent_entity:account_entities!from_entity_id(display_name, phone)')
            .in('to_entity_id', ids)
            .eq('relation_type', 'agent'),
        supabase
            .from('entity_relationships')
            .select('from_entity_id, to_entity_id, relation_type, relation_note, owner_entity:account_entities!to_entity_id(display_name, phone)')
            .in('from_entity_id', ids)
            .eq('relation_type', 'agent'),
        supabase.from('certificate_registry').select('*').in('entity_id', ids).eq('is_active', true),
        supabase.from('entity_private_info').select('entity_id, resident_registration_number').in('entity_id', ids),
    ]);

    const uniqueRelations = relRes.data
        ? Array.from(new Map(relRes.data.map((relation) => [relation.from_entity_id, relation])).values())
        : [];

    const assetRights = ((rightsRes.data || []) as AssetRight[]).map((right) => ({
        ...right,
        right_number: right.certificate_number_normalized || right.certificate_number_raw,
        right_number_raw: right.certificate_number_raw,
        right_number_status: (right.certificate_status || 'review_required') as RightNumberStatus,
        right_number_note:
            typeof right.note === 'object' && right.note !== null
                ? JSON.stringify(right.note)
                : typeof right.note === 'string'
                  ? right.note
                  : '',
    }));

    const rolesData = roleRes.data || [];
    const tiers = Array.from(
        new Set(
            rolesData
                .map((role) => normalizeTierLabel(role.role_code, role.is_registered))
                .filter(Boolean),
        ),
    ) as string[];

    const certNumbers = getConfirmedCertificateNumbers(assetRights);
    const certificateDisplay = getCertificateDisplayText(assetRights, { includeFallbackStatus: true });

    const allPhonesNumeric = new Set<string>();
    const uniqueDisplayPhones: string[] = [];
    entities.forEach((entry) => {
        if (!entry.phone) return;
        const phones = entry.phone.split(',').map((phone: string) => phone.trim()).filter(Boolean);
        for (const phone of phones) {
            const digits = normalizePhone(phone);
            if (!digits || allPhonesNumeric.has(digits)) continue;
            allPhonesNumeric.add(digits);
            if (digits.length === 11) uniqueDisplayPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
            else if (digits.length === 10) uniqueDisplayPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
            else uniqueDisplayPhones.push(phone);
        }
    });

    let derivedBirthDate = entity.birth_date || null;
    if (!derivedBirthDate) {
        const dateLikeValue = certNumbers.filter(Boolean).find((number) => isDateLikeValue(number));
        if (dateLikeValue) derivedBirthDate = dateLikeValue;
    }

    const residentNumberMap = new Map<string, string>();
    for (const row of ((privateInfoRes.data || []) as Array<{ entity_id: string; resident_registration_number: string | null }>)) {
        if (row.resident_registration_number) {
            residentNumberMap.set(row.entity_id, row.resident_registration_number);
        }
    }

    const residentRegistrationNumber =
        ids.map((id) => residentNumberMap.get(id)).find((value): value is string => Boolean(value)) || null;

    const uniqueSecondaryPhones: string[] = [];
    const secondaryPhoneDigits = new Set<string>();
    entities.forEach((entry) => {
        if (!entry.phone_secondary) return;
        const phones = entry.phone_secondary.split(',').map((phone: string) => phone.trim()).filter(Boolean);
        for (const phone of phones) {
            const digits = normalizePhone(phone);
            if (!digits || secondaryPhoneDigits.has(digits)) continue;
            secondaryPhoneDigits.add(digits);
            if (digits.length === 11) uniqueSecondaryPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`);
            else if (digits.length === 10) uniqueSecondaryPhones.push(`${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`);
            else uniqueSecondaryPhones.push(phone);
        }
    });

    const combinedData: Member = {
        ...entity,
        name: entity.display_name,
        phone: uniqueDisplayPhones.join(', '),
        secondary_phone: uniqueSecondaryPhones.join(', ') || null,
        member_number: entity.member_number || '-',
        certificate_display: certificateDisplay,
        certificate_numbers: certNumbers,
        tiers,
        role_code: rolesData[0]?.role_code || null,
        representative:
            uniqueRelations.length > 0
                ? {
                      id: uniqueRelations[0].from_entity_id,
                      name: (uniqueRelations[0].agent_entity as { display_name?: string } | null)?.display_name || 'N/A',
                      relation: uniqueRelations[0].relation_note || '대리인',
                      phone: (uniqueRelations[0].agent_entity as { phone?: string | null } | null)?.phone || null,
                  }
                : null,
        representative2:
            uniqueRelations.length > 1
                ? {
                      id: uniqueRelations[1].from_entity_id,
                      name: (uniqueRelations[1].agent_entity as { display_name?: string } | null)?.display_name || 'N/A',
                      relation: uniqueRelations[1].relation_note || '대리인',
                      phone: (uniqueRelations[1].agent_entity as { phone?: string | null } | null)?.phone || null,
                  }
                : null,
        acts_as_agent_for: revRelRes.data
            ? revRelRes.data.map((relation) => ({
                  id: relation.to_entity_id,
                  name: (relation.owner_entity as { display_name?: string } | null)?.display_name || 'N/A',
                  relation: relation.relation_note || '대리인',
              }))
            : null,
        assetRights,
        birth_date: derivedBirthDate,
        resident_registration_number: residentRegistrationNumber,
        owner_group: rolesData.some((role) => role.is_registered) ? 'registered' : 'others',
        provisional_certificate_count: certNumbers.length,
        manual_certificate_count: null,
        effective_certificate_count: certNumbers.length,
        certificate_summary_review_status: 'reviewed' as CertificateSummaryReviewStatus,
        certificate_summary_note: null,
        certificate_summary_conflict_count: 0,
        certificate_summary_is_grouped: ids.length > 1,
    };

    if (certNumbers.length > 0) {
        await checkAndLogAssetRightConflicts(ids, certNumbers);
    }

    return combinedData;
}
