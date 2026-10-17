import { NextResponse } from 'next/server';

import { createAuditLog } from '@/app/actions/audit';
import { normalizeCertificateNumber } from '@/lib/certificates/rightNumbers';
import { hasValidApiKey } from '@/lib/server/apiKeyAuth';
import { revalidateUnifiedMembersTag } from '@/lib/server/cacheTags';
import { getUnifiedMembersSnapshot } from '@/lib/server/unifiedMembersSnapshot';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ peopleonId: string }> };

const PROFILE_FIELDS = ['phone', 'postal_code', 'address', 'birth_date'] as const;
const MEMBERSHIP_FIELDS = ['joined_at', 'certificate_no'] as const;
const ALLOWED_FIELDS = new Set<string>([...PROFILE_FIELDS, ...MEMBERSHIP_FIELDS]);

type ProfileField = typeof PROFILE_FIELDS[number];
type MembershipField = typeof MEMBERSHIP_FIELDS[number];
type LedgerProfilePayload = {
    fields?: unknown;
    values?: unknown;
    certificate_no_context?: unknown;
};

const isIsoDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const cleanString = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export async function PATCH(request: Request, context: RouteContext) {
    if (!hasValidApiKey(request.headers)) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { peopleonId } = await context.params;
        const body = await request.json().catch(() => null) as LedgerProfilePayload | null;
        const requestedFields = Array.isArray(body?.fields) ? body.fields : [];
        if (
            requestedFields.length === 0
            || requestedFields.some((field) => typeof field !== 'string' || !ALLOWED_FIELDS.has(field))
        ) {
            return NextResponse.json(
                { success: false, error: 'PeopleON에 등록할 회계 항목을 확인해 주세요.' },
                { status: 400 },
            );
        }
        const fields = Array.from(new Set(requestedFields)) as Array<ProfileField | MembershipField>;
        const rawValues = body?.values && typeof body.values === 'object' && !Array.isArray(body.values)
            ? body.values as Record<string, unknown>
            : {};
        const values = Object.fromEntries(fields.map((field) => [field, cleanString(rawValues[field])])) as Record<string, string>;
        if (fields.some((field) => !values[field])) {
            return NextResponse.json(
                { success: false, error: '선택한 회계 항목에 등록할 값이 없습니다.' },
                { status: 400 },
            );
        }

        if (values.phone && values.phone.length > 100) {
            return NextResponse.json({ success: false, error: '연락처가 너무 깁니다.' }, { status: 400 });
        }
        if (values.postal_code && !/^\d{5}$/.test(values.postal_code)) {
            return NextResponse.json({ success: false, error: '우편번호는 5자리 숫자로 입력해 주세요.' }, { status: 400 });
        }
        if (values.address && values.address.length > 500) {
            return NextResponse.json({ success: false, error: '주소가 너무 깁니다.' }, { status: 400 });
        }
        if (values.birth_date && !isIsoDate(values.birth_date)) {
            return NextResponse.json({ success: false, error: '생년월일 형식을 확인해 주세요.' }, { status: 400 });
        }
        if (values.joined_at && !isIsoDate(values.joined_at)) {
            return NextResponse.json({ success: false, error: '가입일 형식을 확인해 주세요.' }, { status: 400 });
        }
        if (values.certificate_no && values.certificate_no.length > 100) {
            return NextResponse.json({ success: false, error: '필증번호가 너무 깁니다.' }, { status: 400 });
        }

        const people = await getUnifiedMembersSnapshot();
        const person = people.find((candidate) => candidate.id === peopleonId);
        if (!person) {
            return NextResponse.json({ success: false, error: '조합원을 찾을 수 없습니다.' }, { status: 404 });
        }
        const entityIds = Array.from(new Set((person.entity_ids || []).filter(Boolean)));
        if (entityIds.length === 0) {
            return NextResponse.json({ success: false, error: '수정할 조합원 엔티티가 없습니다.' }, { status: 409 });
        }
        const targetEntityId = person.member_id && entityIds.includes(person.member_id)
            ? person.member_id
            : entityIds.includes(person.id) ? person.id : entityIds[0];
        const supabase = createAdminClient();
        const selectedProfileFields = fields.filter((field): field is ProfileField =>
            (PROFILE_FIELDS as readonly string[]).includes(field));
        const selectedMembershipFields = fields.filter((field): field is MembershipField =>
            (MEMBERSHIP_FIELDS as readonly string[]).includes(field));

        const { data: currentEntities, error: entityError } = await supabase
            .from('account_entities')
            .select('id, phone, postal_code, address_legal, birth_date')
            .in('id', entityIds);
        if (entityError) throw entityError;
        const currentEntity = (currentEntities || []).find((entity) => entity.id === targetEntityId);
        if (!currentEntity) {
            return NextResponse.json({ success: false, error: '수정할 조합원 엔티티를 찾을 수 없습니다.' }, { status: 409 });
        }

        const columnByField: Record<ProfileField, 'phone' | 'postal_code' | 'address_legal' | 'birth_date'> = {
            phone: 'phone',
            postal_code: 'postal_code',
            address: 'address_legal',
            birth_date: 'birth_date',
        };
        for (const field of selectedProfileFields) {
            const column = columnByField[field];
            if ((currentEntities || []).some((entity) => cleanString(entity[column]))) {
                return NextResponse.json(
                    { success: false, error: `PeopleON ${field} 값이 이미 있어 덮어쓰지 않았습니다.` },
                    { status: 409 },
                );
            }
        }

        type CertificateRow = {
            id: string;
            entity_id: string;
            certificate_number_normalized: string | null;
            certificate_number_raw: string | null;
            certificate_status: string | null;
            issued_at?: string | null;
            cert_date?: string | null;
        };
        let certificateRows: CertificateRow[] = [];
        let dateColumn: 'issued_at' | 'cert_date' = 'issued_at';
        if (selectedMembershipFields.length > 0) {
            const currentSchema = await supabase
                .from('certificate_registry')
                .select('id, entity_id, certificate_number_normalized, certificate_number_raw, certificate_status, issued_at')
                .in('entity_id', entityIds)
                .eq('is_active', true);
            if (!currentSchema.error || currentSchema.error.code !== '42703') {
                if (currentSchema.error) throw currentSchema.error;
                certificateRows = (currentSchema.data || []) as CertificateRow[];
            } else {
                dateColumn = 'cert_date';
                const legacySchema = await supabase
                    .from('certificate_registry')
                    .select('id, entity_id, certificate_number_normalized, certificate_number_raw, certificate_status, cert_date')
                    .in('entity_id', entityIds)
                    .eq('is_active', true);
                if (legacySchema.error) throw legacySchema.error;
                certificateRows = (legacySchema.data || []) as CertificateRow[];
            }
        }

        const confirmedNumbers = certificateRows
            .filter((row) => row.certificate_status === 'confirmed')
            .map((row) => normalizeCertificateNumber(row.certificate_number_normalized || row.certificate_number_raw))
            .filter(Boolean);
        if (fields.includes('certificate_no') && confirmedNumbers.length > 0) {
            return NextResponse.json(
                { success: false, error: 'PeopleON 필증번호가 이미 있어 덮어쓰지 않았습니다.' },
                { status: 409 },
            );
        }
        const existingJoinDate = certificateRows
            .map((row) => cleanString(row[dateColumn]))
            .find(Boolean);
        if (fields.includes('joined_at') && existingJoinDate) {
            return NextResponse.json(
                { success: false, error: 'PeopleON 가입일이 이미 있어 덮어쓰지 않았습니다.' },
                { status: 409 },
            );
        }

        const certificateContext = normalizeCertificateNumber(
            cleanString(body?.certificate_no_context) || values.certificate_no,
        );
        const matchingCertificateRows = certificateContext
            ? certificateRows.filter((row) => normalizeCertificateNumber(
                row.certificate_number_normalized || row.certificate_number_raw,
            ) === certificateContext)
            : [];
        let targetCertificate = matchingCertificateRows.length === 1
            ? matchingCertificateRows[0]
            : !certificateContext && certificateRows.length === 1 ? certificateRows[0] : null;

        if (fields.includes('joined_at') && !fields.includes('certificate_no') && !targetCertificate) {
            return NextResponse.json(
                { success: false, error: '가입일을 연결할 PeopleON 필증을 하나로 확인할 수 없습니다.' },
                { status: 409 },
            );
        }

        const profilePatch: Record<string, string> = {};
        for (const field of selectedProfileFields) profilePatch[columnByField[field]] = values[field];
        if (Object.keys(profilePatch).length > 0) {
            let updateQuery = supabase.from('account_entities').update(profilePatch).eq('id', targetEntityId);
            for (const field of selectedProfileFields) {
                const column = columnByField[field];
                updateQuery = currentEntity[column] === null
                    ? updateQuery.is(column, null)
                    : updateQuery.eq(column, currentEntity[column]);
            }
            const result = await updateQuery.select('id').maybeSingle();
            if (result.error) throw result.error;
            if (!result.data) {
                return NextResponse.json(
                    { success: false, error: 'PeopleON 정보가 저장 직전에 변경됐습니다. 최신 값을 다시 확인해 주세요.' },
                    { status: 409 },
                );
            }
        }

        if (fields.includes('certificate_no')) {
            if (targetCertificate) {
                const rightPatch: Record<string, string | boolean> = {
                    certificate_number_raw: values.certificate_no,
                    certificate_number_normalized: normalizeCertificateNumber(values.certificate_no),
                    certificate_status: 'confirmed',
                    source_type: 'dbapt-ledger',
                    is_confirmed_for_count: true,
                };
                if (fields.includes('joined_at')) rightPatch[dateColumn] = values.joined_at;
                const result = await supabase.from('certificate_registry')
                    .update(rightPatch)
                    .eq('id', targetCertificate.id)
                    .select('id')
                    .maybeSingle();
                if (result.error) throw result.error;
                if (!result.data) throw new Error('필증정보를 갱신하지 못했습니다.');
            } else {
                const insertPayload: Record<string, string | boolean> = {
                    entity_id: targetEntityId,
                    certificate_number_raw: values.certificate_no,
                    certificate_number_normalized: normalizeCertificateNumber(values.certificate_no),
                    certificate_status: 'confirmed',
                    source_type: 'dbapt-ledger',
                    is_confirmed_for_count: true,
                    is_active: true,
                };
                if (fields.includes('joined_at')) insertPayload[dateColumn] = values.joined_at;
                const result = await supabase.from('certificate_registry').insert(insertPayload).select('id').single();
                if (result.error) throw result.error;
                targetCertificate = { ...insertPayload, id: result.data.id } as CertificateRow;
            }
        } else if (fields.includes('joined_at') && targetCertificate) {
            let updateQuery = supabase.from('certificate_registry')
                .update({ [dateColumn]: values.joined_at })
                .eq('id', targetCertificate.id);
            updateQuery = targetCertificate[dateColumn] === null
                ? updateQuery.is(dateColumn, null)
                : updateQuery.eq(dateColumn, targetCertificate[dateColumn] || '');
            const result = await updateQuery.select('id').maybeSingle();
            if (result.error) throw result.error;
            if (!result.data) {
                return NextResponse.json(
                    { success: false, error: 'PeopleON 가입일이 저장 직전에 변경됐습니다. 최신 값을 다시 확인해 주세요.' },
                    { status: 409 },
                );
            }
        }

        await createAuditLog('LEDGER_REGISTER_EMPTY_MEMBER_FIELDS', targetEntityId, {
            source: 'dbapt-ledger',
            peopleon_id: person.id,
            entity_id: targetEntityId,
            fields,
            only_empty_fields: true,
        });
        revalidateUnifiedMembersTag();

        return NextResponse.json({
            success: true,
            peopleon_id: person.id,
            updated_fields: fields,
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        console.error('Ledger member empty profile registration error:', error);
        return NextResponse.json(
            { success: false, error: '회계 정보를 PeopleON에 등록하지 못했습니다.' },
            { status: 500 },
        );
    }
}
