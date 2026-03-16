import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAuditLog } from '@/app/actions/audit';
import { revalidateUnifiedMembersTag } from '@/lib/server/cacheTags';
import {
    buildMemberPatch,
    getTargetIdsFromPayload,
    syncCertificateRights,
    syncPersonCertificateSummary,
    syncRepresentatives,
    syncResidentRegistrationNumber,
    type MemberUpdatePayload,
} from '@/lib/server/memberUpdateRouteUtils';

async function safeCreateAuditLog(actionType: string, targetEntityId?: string, details?: Record<string, unknown>) {
    try {
        await createAuditLog(actionType, targetEntityId, details);
    } catch (error) {
        console.error(`Audit log failed for ${actionType}:`, error);
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = (await request.json().catch(() => null)) as MemberUpdatePayload | null;
        const targetIds = getTargetIdsFromPayload(body);

        if (targetIds.length === 0) {
            return NextResponse.json({ success: false, error: '유효한 member ID가 필요합니다.' }, { status: 400 });
        }

        // 1. Update basic info in account_entities
        const patch = buildMemberPatch(body);

        if (patch.display_name === null && typeof body?.name === 'string') {
            return NextResponse.json({ success: false, error: '성명은 필수입니다.' }, { status: 400 });
        }

        if (Object.keys(patch).length > 0) {
            const { error: updateError } = await supabase
                .from('account_entities')
                .update(patch)
                .in('id', targetIds);

            if (updateError) {
                return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
            }
        }

        // 2. Update role_code in membership_roles
        if (typeof body?.role_code === 'string') {
            const { error: roleError } = await supabase
                .from('membership_roles')
                .update({ role_code: body.role_code })
                .in('entity_id', targetIds);

            if (roleError) {
                console.error('Role update error:', roleError);
            } else {
                await Promise.all(targetIds.map(tid =>
                    safeCreateAuditLog('UPDATE_MEMBER_ROLE', tid, { new_role: body.role_code })
                ));
            }
        }

        // 3. Update, Create, Delete representatives (Sync with current active agents)
        await syncRepresentatives({
            supabase,
            targetIds,
            body,
        });

        // 4. Update resident_registration_number in entity_private_info
        await syncResidentRegistrationNumber({
            supabase,
            targetIds,
            residentRegistrationNumber: body?.resident_registration_number,
        });

        const rightsResult = await syncCertificateRights({
            supabase,
            body,
            targetIds,
            userId: user.id,
        });

        if (!rightsResult.success) {
            return NextResponse.json(
                { success: false, error: rightsResult.error || rightsResult.message || '권리증 업데이트 실패' },
                { status: 500 },
            );
        }

        // 5. Update person-level certificate summary (single target only)
        const summaryResult = await syncPersonCertificateSummary({
            supabase,
            body,
            targetIds,
        });

        if (!summaryResult.success) {
            return NextResponse.json(
                { success: false, error: summaryResult.error || '권리증 요약 업데이트 실패' },
                { status: 500 },
            );
        }

        try {
            revalidateUnifiedMembersTag();
            revalidatePath('/members');
            revalidatePath('/payments');
            revalidatePath('/settlements');
            revalidatePath('/certificate-audit');
            targetIds.forEach((targetId) => revalidatePath(`/members/${targetId}`));
        } catch (revalidationError) {
            console.error('Members update revalidation error:', revalidationError);
        }

        return NextResponse.json({
            success: true,
            member: {
                ids: targetIds,
                ...patch,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '알 수 없는 저장 오류';
        console.error('Members update route error:', error);
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
