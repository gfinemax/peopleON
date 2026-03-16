import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createAuditLog } from '@/app/actions/audit';
import { getUnifiedMembers, normalizeText } from '@/services/memberAggregation';

const DEFAULT_SOURCE_PATH = 'C:\\Users\\finemax\\Downloads\\주민등록번호.xlsx';

type ResidentExcelRow = {
    rowNumber: number;
    sourceName: string;
    normalizedName: string;
    residentRegistrationNumber: string;
};

type PreviewStatus = 'matched' | 'duplicate_member_name' | 'duplicate_source_name' | 'member_not_found';

type PreviewRow = {
    rowNumber: number;
    sourceName: string;
    maskedResidentRegistrationNumber: string;
    status: PreviewStatus;
    matchedMemberName: string | null;
    targetEntityIds: string[];
    hasExistingResidentNumber: boolean;
};

type MissingMemberRow = {
    id: string;
    name: string;
    entityIds: string[];
    hasExistingResidentNumber: boolean;
};

export type PreviewResult = {
    filePath: string;
    fileName: string;
    registeredMemberCount: number;
    sourceRowCount: number;
    matchedCount: number;
    duplicateMemberNameCount: number;
    duplicateSourceNameCount: number;
    memberNotFoundCount: number;
    missingRegisteredCount: number;
    existingResidentCount: number;
    previewRows: PreviewRow[];
    missingMembers: MissingMemberRow[];
};

function formatResidentRegistrationNumber(value: unknown) {
    const raw = String(value || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 13) {
        return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    }
    return raw;
}

function maskResidentRegistrationNumber(value: string) {
    const normalized = formatResidentRegistrationNumber(value);
    if (!normalized) return '';
    if (normalized.length >= 8) return `${normalized.slice(0, 8)}******`;
    return normalized;
}

function resolveSourcePath() {
    return process.env.RESIDENT_REGISTRY_IMPORT_PATH || DEFAULT_SOURCE_PATH;
}

export function createSupabaseAdmin() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase service role is not configured.');
    }

    return createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
    );
}

function loadResidentExcelRows(filePath: string): ResidentExcelRow[] {
    if (!fs.existsSync(filePath)) {
        throw new Error(`주민등록번호 파일을 찾을 수 없습니다: ${filePath}`);
    }

    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    return rows
        .map((row, index) => {
            const sourceName = String(row['성명'] || row['이름'] || '').trim();
            const residentRegistrationNumber = formatResidentRegistrationNumber(row['주민등록번호']);
            return {
                rowNumber: index + 2,
                sourceName,
                normalizedName: normalizeText(sourceName),
                residentRegistrationNumber,
            };
        })
        .filter((row) => row.sourceName && row.residentRegistrationNumber);
}

export async function buildResidentRegistryPreview(
    supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
): Promise<PreviewResult> {
    const filePath = resolveSourcePath();
    const excelRows = loadResidentExcelRows(filePath);
    const { unifiedPeople, fetchError } = await getUnifiedMembers(supabase);
    if (fetchError) {
        throw fetchError instanceof Error ? fetchError : new Error('조합원 명단을 불러오지 못했습니다.');
    }

    const registeredMembers = unifiedPeople.filter((person) => person.is_registered);
    const allEntityIds = Array.from(new Set(registeredMembers.flatMap((person) => person.entity_ids)));

    const { data: privateRows, error: privateError } = await supabase
        .from('entity_private_info')
        .select('entity_id, resident_registration_number')
        .in('entity_id', allEntityIds);

    if (privateError) {
        throw new Error(privateError.message);
    }

    const privateInfoByEntityId = new Map<string, string>();
    for (const row of (privateRows as Array<{ entity_id: string; resident_registration_number: string | null }> | null) || []) {
        if (row.resident_registration_number) {
            privateInfoByEntityId.set(row.entity_id, row.resident_registration_number);
        }
    }

    const memberNameMap = new Map<string, typeof registeredMembers>();
    for (const person of registeredMembers) {
        const key = normalizeText(person.name);
        const bucket = memberNameMap.get(key) || [];
        bucket.push(person);
        memberNameMap.set(key, bucket);
    }

    const sourceNameCounts = new Map<string, number>();
    for (const row of excelRows) {
        sourceNameCounts.set(row.normalizedName, (sourceNameCounts.get(row.normalizedName) || 0) + 1);
    }

    const matchedMemberIds = new Set<string>();
    const previewRows: PreviewRow[] = excelRows.map((row) => {
        const candidates = memberNameMap.get(row.normalizedName) || [];
        const sourceNameCount = sourceNameCounts.get(row.normalizedName) || 0;
        const hasExistingResidentNumber = candidates.some((candidate) =>
            candidate.entity_ids.some((entityId) => privateInfoByEntityId.has(entityId))
        );

        let status: PreviewStatus = 'matched';
        if (sourceNameCount > 1) status = 'duplicate_source_name';
        else if (candidates.length > 1) status = 'duplicate_member_name';
        else if (candidates.length === 0) status = 'member_not_found';

        const matchedMemberName = status === 'matched' ? candidates[0].name : null;
        const targetEntityIds = status === 'matched' ? candidates[0].entity_ids : [];
        if (status === 'matched') matchedMemberIds.add(candidates[0].id);

        return {
            rowNumber: row.rowNumber,
            sourceName: row.sourceName,
            maskedResidentRegistrationNumber: maskResidentRegistrationNumber(row.residentRegistrationNumber),
            status,
            matchedMemberName,
            targetEntityIds,
            hasExistingResidentNumber,
        };
    });

    const missingMembers = registeredMembers
        .filter((person) => !matchedMemberIds.has(person.id))
        .map((person) => ({
            id: person.id,
            name: person.name,
            entityIds: person.entity_ids,
            hasExistingResidentNumber: person.entity_ids.some((entityId) => privateInfoByEntityId.has(entityId)),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'ko-KR'));

    return {
        filePath,
        fileName: path.basename(filePath),
        registeredMemberCount: registeredMembers.length,
        sourceRowCount: previewRows.length,
        matchedCount: previewRows.filter((row) => row.status === 'matched').length,
        duplicateMemberNameCount: previewRows.filter((row) => row.status === 'duplicate_member_name').length,
        duplicateSourceNameCount: previewRows.filter((row) => row.status === 'duplicate_source_name').length,
        memberNotFoundCount: previewRows.filter((row) => row.status === 'member_not_found').length,
        missingRegisteredCount: missingMembers.length,
        existingResidentCount: previewRows.filter((row) => row.hasExistingResidentNumber).length,
        previewRows,
        missingMembers,
    };
}

export async function ensureResidentRegistryTablesExist(supabaseAdmin: ReturnType<typeof createSupabaseAdmin>) {
    const { error } = await supabaseAdmin
        .from('secure_resident_registry')
        .select('id')
        .limit(1);

    if (error) {
        throw new Error(`secure_resident_registry 테이블이 없습니다. supabase_resident_registry_setup.sql 을 먼저 실행하세요. (${error.message})`);
    }
}

export async function executeResidentRegistryImport({
    forceOverwrite,
    supabase,
    userEmail,
}: {
    forceOverwrite: boolean;
    supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>;
    userEmail: string | null;
}) {
    const preview = await buildResidentRegistryPreview(supabase);
    const supabaseAdmin = createSupabaseAdmin();
    await ensureResidentRegistryTablesExist(supabaseAdmin);

    const filePath = resolveSourcePath();
    const excelRows = loadResidentExcelRows(filePath);
    const matchedPreviewRows = preview.previewRows.filter((row) => row.status === 'matched');
    const matchedByName = new Map(matchedPreviewRows.map((row) => [normalizeText(row.sourceName), row]));
    const batchId = crypto.randomUUID();
    const importedAt = new Date().toISOString();

    const matchedEntityIds = Array.from(new Set(matchedPreviewRows.flatMap((row) => row.targetEntityIds)));
    const { data: privateRows, error: privateError } = await supabaseAdmin
        .from('entity_private_info')
        .select('entity_id, resident_registration_number')
        .in('entity_id', matchedEntityIds);

    if (privateError) {
        throw new Error(privateError.message);
    }

    const existingPrivateMap = new Map<string, string>();
    for (const row of (privateRows as Array<{ entity_id: string; resident_registration_number: string | null }> | null) || []) {
        if (row.resident_registration_number) existingPrivateMap.set(row.entity_id, row.resident_registration_number);
    }

    const secureStoreRows: Record<string, unknown>[] = [];
    const historyRows: Record<string, unknown>[] = [];
    const privateUpserts: Record<string, unknown>[] = [];
    let syncedCount = 0;
    let skippedExistingCount = 0;

    for (const excelRow of excelRows) {
        const normalizedName = excelRow.normalizedName;
        const matchedRow = matchedByName.get(normalizedName);
        const baseHistory = {
            batch_id: batchId,
            source_name: excelRow.sourceName,
            normalized_name: normalizedName,
            resident_registration_number: excelRow.residentRegistrationNumber,
            source_file_name: path.basename(filePath),
            source_row_number: excelRow.rowNumber,
            imported_by_email: userEmail,
        };

        if (!matchedRow) {
            historyRows.push({
                ...baseHistory,
                entity_id: null,
                matched_entity_name: null,
                match_status: preview.previewRows.find((row) => row.rowNumber === excelRow.rowNumber)?.status || 'member_not_found',
                note: { target_entity_ids: [] },
            });
            continue;
        }

        for (const entityId of matchedRow.targetEntityIds) {
            secureStoreRows.push({
                entity_id: entityId,
                resident_registration_number: excelRow.residentRegistrationNumber,
                source_name: excelRow.sourceName,
                source_file_name: path.basename(filePath),
                source_row_number: excelRow.rowNumber,
                batch_id: batchId,
                imported_by_email: userEmail,
                imported_at: importedAt,
                synced_to_private_info_at:
                    forceOverwrite || !existingPrivateMap.get(entityId) || existingPrivateMap.get(entityId) === excelRow.residentRegistrationNumber
                        ? importedAt
                        : null,
                last_verified_at: importedAt,
                note: { source_path: filePath, unified_name: matchedRow.matchedMemberName },
            });

            const existing = existingPrivateMap.get(entityId);
            if (forceOverwrite || !existing || existing === excelRow.residentRegistrationNumber) {
                privateUpserts.push({
                    entity_id: entityId,
                    resident_registration_number: excelRow.residentRegistrationNumber,
                    updated_at: importedAt,
                });
                syncedCount += 1;
            } else {
                skippedExistingCount += 1;
            }

            historyRows.push({
                ...baseHistory,
                entity_id: entityId,
                matched_entity_name: matchedRow.matchedMemberName,
                match_status: 'matched',
                note: {
                    target_entity_ids: matchedRow.targetEntityIds,
                    skipped_existing: Boolean(existing && existing !== excelRow.residentRegistrationNumber && !forceOverwrite),
                },
            });
        }
    }

    if (historyRows.length > 0) {
        const { error: historyError } = await supabaseAdmin
            .from('secure_resident_registry_history')
            .insert(historyRows);
        if (historyError) throw new Error(historyError.message);
    }

    if (secureStoreRows.length > 0) {
        const { error: storeError } = await supabaseAdmin
            .from('secure_resident_registry')
            .upsert(secureStoreRows, { onConflict: 'entity_id' });
        if (storeError) throw new Error(storeError.message);
    }

    if (privateUpserts.length > 0) {
        const { error: upsertError } = await supabaseAdmin
            .from('entity_private_info')
            .upsert(privateUpserts, { onConflict: 'entity_id' });
        if (upsertError) throw new Error(upsertError.message);
    }

    await createAuditLog('BULK_IMPORT_RESIDENT_REGISTRY', undefined, {
        batch_id: batchId,
        file_name: path.basename(filePath),
        matched_rows: preview.matchedCount,
        synced_rows: syncedCount,
        skipped_existing_rows: skippedExistingCount,
        duplicate_member_rows: preview.duplicateMemberNameCount,
        duplicate_source_rows: preview.duplicateSourceNameCount,
        member_not_found_rows: preview.memberNotFoundCount,
        missing_registered_members: preview.missingRegisteredCount,
        force_overwrite: forceOverwrite,
    });

    return {
        batchId,
        matchedCount: preview.matchedCount,
        syncedCount,
        skippedExistingCount,
        duplicateMemberNameCount: preview.duplicateMemberNameCount,
        duplicateSourceNameCount: preview.duplicateSourceNameCount,
        memberNotFoundCount: preview.memberNotFoundCount,
        missingRegisteredCount: preview.missingRegisteredCount,
    };
}
