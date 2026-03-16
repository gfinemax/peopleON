'use client';

import { createClient } from '@/lib/supabase/client';
import { checkAndLogAssetRightConflicts } from '@/app/actions/interaction';
import {
    buildCertificateStorageFields,
    classifyCertificateInput,
} from '@/lib/certificates/rightNumbers';
import type {
    MemberDetailDialogMember,
    MemberDetailDialogSaveFeedback,
} from './memberDetailDialogTypes';
import {
    syncCertificateNoteNumber,
    isJsonLikeNote,
    type AssetRight,
} from './memberDetailDialogUtils';

type Member = MemberDetailDialogMember;

export async function addMemberRight(args: {
    member: Member;
    memberIds: string[] | null;
    rightInput: string;
}) {
    const { member, memberIds, rightInput } = args;
    const supabase = createClient();
    const classifiedRight = classifyCertificateInput(rightInput.trim());

    const { error } = await supabase.from('certificate_registry').insert({
        entity_id: member.id,
        certificate_number_normalized: classifiedRight.confirmedNumber,
        certificate_number_raw: classifiedRight.rawValue,
        certificate_status: classifiedRight.status,
        note: JSON.stringify({ manual_add: true }),
        is_active: true,
        source_type: 'manual',
    });

    if (error) throw error;

    if (classifiedRight.confirmedNumber) {
        const currentIds = memberIds && memberIds.length > 0 ? memberIds : member.id ? [member.id] : [];
        await checkAndLogAssetRightConflicts(currentIds, [classifiedRight.confirmedNumber]);
    }
}

export async function mergeMemberRights(args: {
    member: Member;
    selectedRightIds: string[];
    targetNumber: string;
}) {
    const response = await fetch('/api/members/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: args.member.id,
            merged_rights_payload: {
                source_ids: args.selectedRightIds,
                target_number: args.targetNumber,
                integration_type: 'consolidated',
            },
        }),
    });

    return response.json();
}

export async function unmergeMemberRight(args: {
    member: Member;
    rightId: string;
}) {
    const response = await fetch('/api/members/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: args.member.id,
            unmerge_right_id: args.rightId,
        }),
    });

    return response.json();
}

export async function saveMemberDetail(args: {
    memberId: string;
    memberIds: string[] | null;
    member: Member | null;
    formData: Partial<Member>;
    deletedRightsIds: string[];
}) {
    const { memberId, memberIds, member, formData, deletedRightsIds } = args;

    const cleanRepresentative = (representative: unknown) => {
        if (!representative || typeof representative !== 'object') return null;
        const candidate = representative as { name?: string; phone?: string };
        if (!candidate.name?.trim() && !candidate.phone?.trim()) return null;
        return representative;
    };

    const canEditCertificateReview = (memberIds?.length || 0) <= 1;
    const updatedRights =
        formData.assetRights && member?.assetRights
            ? formData.assetRights
                  .map((right) => {
                      const original = member.assetRights?.find((item) => item.id === right.id);
                      if (!original) return null;

                      const hasChanged =
                          original.right_number_raw !== right.right_number_raw ||
                          original.right_number_status !== right.right_number_status ||
                          original.right_number_note !== right.right_number_note ||
                          original.issued_at !== right.issued_at ||
                          original.principal_amount !== right.principal_amount ||
                          original.meta?.cert_name !== right.meta?.cert_name;

                      if (!hasChanged) return null;

                      return {
                          id: right.id,
                          certificate_number_normalized: right.right_number ?? null,
                          certificate_number_raw: right.right_number_raw ?? null,
                          certificate_status: right.right_number_status ?? null,
                          note: right.right_number_note ?? null,
                          issued_at: right.issued_at || null,
                          principal_amount: right.principal_amount === '' ? 0 : Number(right.principal_amount) || 0,
                          meta: right.meta || null,
                          old_number: original.right_number_raw || null,
                          new_number: right.right_number_raw || null,
                      };
                  })
                  .filter((right): right is NonNullable<typeof right> => Boolean(right))
            : [];

    const response = await fetch('/api/members/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: memberId,
            ids: memberIds,
            name: formData.name,
            phone: formData.phone,
            secondary_phone: formData.secondary_phone,
            email: formData.email,
            address_legal: formData.address_legal,
            memo: formData.memo,
            role_code: formData.role_code,
            representative: cleanRepresentative(formData.representative),
            representative2: cleanRepresentative(formData.representative2),
            birth_date: formData.birth_date,
            resident_registration_number: formData.resident_registration_number,
            manual_certificate_count: canEditCertificateReview ? formData.manual_certificate_count : undefined,
            certificate_summary_review_status: canEditCertificateReview ? formData.certificate_summary_review_status : undefined,
            certificate_summary_note: canEditCertificateReview ? formData.certificate_summary_note : undefined,
            deleted_rights_ids: deletedRightsIds.length > 0 ? deletedRightsIds : undefined,
            updated_rights: updatedRights.length > 0 ? updatedRights : undefined,
        }),
    }).catch(() => null);

    const payload = response ? await response.json().catch(() => null) : null;

    if (!response || !response.ok || !payload?.success) {
        return {
            success: false,
            feedback: {
                tone: 'error',
                message: payload?.error || (response ? `저장에 실패했습니다. (${response.status})` : '저장에 실패했습니다.'),
            } satisfies MemberDetailDialogSaveFeedback,
        };
    }

    return {
        success: true,
        feedback: {
            tone: 'success',
            message: '성공적으로 저장되었습니다.',
        } satisfies MemberDetailDialogSaveFeedback,
    };
}

export function buildEditedRight(
    field: string,
    value: string,
    right: AssetRight,
) {
    if (field === 'cert_name') {
        return { ...right, meta: { ...(right.meta || {}), cert_name: value } };
    }

    if (field === 'right_number') {
        const preservedNote = isJsonLikeNote(right.right_number_note)
            ? null
            : ((right.right_number_note || '').trim() || null);
        const storage = buildCertificateStorageFields(
            value,
            null,
            preservedNote,
        );

        return {
            ...right,
            right_number: storage.right_number,
            right_number_raw: storage.right_number_raw,
            right_number_status: storage.right_number_status,
            right_number_note: syncCertificateNoteNumber(
                right.right_number_note,
                storage.right_number_raw,
                storage.right_number_note,
            ),
        };
    }

    return { ...right, [field]: value };
}
