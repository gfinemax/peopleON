import fs from 'node:fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const REGISTERED_COUNT = 86;
const CURRENT_SCOPE_COUNT = 116;
const apply = process.argv.includes('--apply');
const sourceRows = JSON.parse(fs.readFileSync(0, 'utf8'));

const normalize = (value) => String(value ?? '').normalize('NFKC').replace(/\s+/g, '').trim();
const normalizeMemberNumber = (value) => normalize(value).replace(/[‐‑‒–—―]/g, '-');
const normalizeUnit = (value) => {
    const raw = normalize(value);
    if (/^24평(?:형)?$/u.test(raw)) return '59';
    if (/^(?:32|34)평(?:형)?$/u.test(raw)) return '84';
    if (/^(?:59|84)(?:㎡)?$/u.test(raw)) return raw.replace('㎡', '');
    return '';
};
const chunk = (items, size = 50) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase 운영 연결 환경변수가 없어.');
}
if (!Array.isArray(sourceRows) || sourceRows.length !== REGISTERED_COUNT) {
    throw new Error(`원본 명단이 ${sourceRows?.length ?? 0}명이야. 정확히 ${REGISTERED_COUNT}명이어야 해.`);
}

const rows = sourceRows.map((row, index) => ({
    rowNumber: Number(row.rowNumber || index + 2),
    name: String(row.name || '').trim(),
    normalizedName: normalize(row.name),
    memberNumber: String(row.memberNumber || '').trim(),
    normalizedMemberNumber: normalizeMemberNumber(row.memberNumber),
    sourceUnit: String(row.unitGroup || '').trim(),
    unitGroup: normalizeUnit(row.unitGroup),
}));

const invalidRows = rows.filter((row) => !row.normalizedName || !row.normalizedMemberNumber || !row.unitGroup);
if (invalidRows.length) {
    throw new Error(`이름, 조합원번호 또는 지원 평형이 올바르지 않은 행: ${invalidRows.map((row) => row.rowNumber).join(', ')}`);
}
const duplicateNumbers = [...new Set(rows.map((row) => row.normalizedMemberNumber).filter((value, index, all) => all.indexOf(value) !== index))];
if (duplicateNumbers.length) throw new Error(`원본에 중복 조합원번호가 있어: ${duplicateNumbers.join(', ')}`);

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const { data: roleData, error: roleError } = await supabase
    .from('membership_roles')
    .select('id,entity_id,source_member_id,role_code,role_status,is_registered')
    .eq('is_registered', true);
if (roleError) throw roleError;

const roles = roleData || [];
const entityIds = [...new Set(roles.map((role) => role.entity_id))];
if (entityIds.length !== CURRENT_SCOPE_COUNT) {
    throw new Error(`현재 등기조합원 범위가 ${entityIds.length}명이야. 예상한 ${CURRENT_SCOPE_COUNT}명과 달라 중단했어.`);
}

const entities = [];
for (const ids of chunk(entityIds)) {
    const { data, error } = await supabase
        .from('account_entities')
        .select('id,display_name,status,unit_group')
        .in('id', ids);
    if (error) throw error;
    entities.push(...(data || []));
}
if (entities.length !== CURRENT_SCOPE_COUNT) throw new Error(`등기조합원 인물 정보가 ${entities.length}건만 조회됐어.`);

const rights = [];
for (const ids of chunk(entityIds)) {
    const { data, error } = await supabase
        .from('certificate_registry')
        .select('entity_id,certificate_number_normalized,certificate_number_raw')
        .eq('is_active', true)
        .in('entity_id', ids);
    if (error) throw error;
    rights.push(...(data || []));
}

const byNumber = new Map();
const byName = new Map();
for (const entity of entities) {
    const nameKey = normalize(entity.display_name);
    byName.set(nameKey, [...(byName.get(nameKey) || []), entity]);
}
for (const right of rights) {
    const numberKey = normalizeMemberNumber(right.certificate_number_normalized || right.certificate_number_raw);
    const entity = entities.find((candidate) => candidate.id === right.entity_id);
    if (!numberKey || !entity) continue;
    const current = byNumber.get(numberKey) || [];
    if (!current.some((candidate) => candidate.id === entity.id)) byNumber.set(numberKey, [...current, entity]);
}

const unmatched = [];
const ambiguous = [];
let matchedByNumber = 0;
let matchedByName = 0;
const matched = rows.flatMap((row) => {
    let candidates = byNumber.get(row.normalizedMemberNumber) || [];
    if (candidates.length === 1) {
        matchedByNumber += 1;
    } else {
        candidates = byName.get(row.normalizedName) || [];
        if (candidates.length === 1) matchedByName += 1;
    }
    if (candidates.length === 0) { unmatched.push(row); return []; }
    if (candidates.length > 1) { ambiguous.push(row); return []; }
    return [{ ...row, entity: candidates[0] }];
});

const matchedIds = new Set(matched.map((row) => row.entity.id));
if (matchedIds.size !== matched.length) throw new Error('서로 다른 원본 행이 같은 PeopleON 인물에 매칭됐어.');
const refunds = entities.filter((entity) => !matchedIds.has(entity.id));
if (unmatched.length || ambiguous.length || matched.length !== REGISTERED_COUNT || refunds.length !== 30) {
    throw new Error(JSON.stringify({
        message: '명단 대조 결과가 등기 86명 / 환불 30명과 일치하지 않아.',
        matched: matched.length,
        refunds: refunds.length,
        unmatched: unmatched.map((row) => `${row.name}(${row.memberNumber})`),
        ambiguous: ambiguous.map((row) => `${row.name}(${row.memberNumber})`),
    }, null, 2));
}

const conflictingEntityIds = [];
for (const ids of chunk(entityIds)) {
    const { data, error } = await supabase
        .from('membership_roles')
        .select('id,entity_id,role_code')
        .in('entity_id', ids)
        .eq('role_status', 'active')
        .in('role_code', ['등기조합원', '권리증환불']);
    if (error) throw error;
    for (const targetRole of data || []) {
        const registeredRoleIds = new Set(roles.filter((role) => role.entity_id === targetRole.entity_id).map((role) => role.id));
        if (!registeredRoleIds.has(targetRole.id)) conflictingEntityIds.push(targetRole.entity_id);
    }
}
if (conflictingEntityIds.length) throw new Error(`대상 역할과 충돌하는 기존 활성 역할이 ${new Set(conflictingEntityIds).size}명에게 있어.`);

const { count: paymentCountBefore, error: paymentCountError } = await supabase
    .from('member_payments').select('*', { count: 'exact', head: true });
if (paymentCountError) throw paymentCountError;

const summary = {
    mode: apply ? 'apply' : 'dry-run',
    sourceCount: rows.length,
    currentRegisteredScope: entityIds.length,
    registeredCount: matched.length,
    refundCount: refunds.length,
    matchedByNumber,
    matchedByUniqueName: matchedByName,
    unitCounts: matched.reduce((acc, row) => ({ ...acc, [row.unitGroup]: (acc[row.unitGroup] || 0) + 1 }), {}),
    paymentCountBefore,
};

if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
}

const originalRoles = roles.map((role) => ({ ...role }));
const registeredRoleIds = roles.filter((role) => matchedIds.has(role.entity_id)).map((role) => role.id);
const refundIds = refunds.map((entity) => entity.id);
const refundRoleIds = roles.filter((role) => refundIds.includes(role.entity_id)).map((role) => role.id);

const restore = async () => {
    for (const entity of entities) {
        await supabase.from('account_entities').update({ status: entity.status, unit_group: entity.unit_group }).eq('id', entity.id);
    }
    for (const role of originalRoles) {
        await supabase.from('membership_roles').update({ role_code: role.role_code, role_status: role.role_status, is_registered: role.is_registered }).eq('id', role.id);
    }
};

try {
    for (const row of matched) {
        const { error } = await supabase.from('account_entities').update({ status: '정상', unit_group: row.unitGroup }).eq('id', row.entity.id);
        if (error) throw error;
    }
    for (const ids of chunk(refundIds)) {
        const { error } = await supabase.from('account_entities').update({ status: '환불조합원' }).in('id', ids);
        if (error) throw error;
    }
    for (const ids of chunk(registeredRoleIds)) {
        const { error } = await supabase.from('membership_roles').update({ role_code: '등기조합원', role_status: 'active', is_registered: true }).in('id', ids);
        if (error) throw error;
    }
    for (const ids of chunk(refundRoleIds)) {
        const { error } = await supabase.from('membership_roles').update({ role_code: '권리증환불', role_status: 'active', is_registered: false }).in('id', ids);
        if (error) throw error;
    }
} catch (error) {
    await restore();
    throw new Error(`반영 중 오류가 발생해 원래 값으로 복구했어: ${error instanceof Error ? error.message : String(error)}`);
}

const { count: registeredAfter, error: registeredError } = await supabase
    .from('membership_roles').select('*', { count: 'exact', head: true })
    .eq('role_status', 'active').eq('is_registered', true);
if (registeredError) throw registeredError;
const { count: refundAfter, error: refundError } = await supabase
    .from('membership_roles').select('*', { count: 'exact', head: true })
    .eq('role_status', 'active').eq('role_code', '권리증환불').in('entity_id', refundIds);
if (refundError) throw refundError;
const { count: paymentCountAfter, error: paymentAfterError } = await supabase
    .from('member_payments').select('*', { count: 'exact', head: true });
if (paymentAfterError) throw paymentAfterError;

const verifiedEntities = [];
for (const ids of chunk([...matchedIds])) {
    const { data, error } = await supabase.from('account_entities').select('id,unit_group,status').in('id', ids);
    if (error) throw error;
    verifiedEntities.push(...(data || []));
}
const expectedUnits = new Map(matched.map((row) => [row.entity.id, row.unitGroup]));
const unitMismatch = verifiedEntities.filter((entity) => entity.status !== '정상' || entity.unit_group !== expectedUnits.get(entity.id));

if (registeredAfter !== 86 || refundAfter !== 30 || paymentCountAfter !== paymentCountBefore || unitMismatch.length) {
    await restore();
    throw new Error(`사후 검증 실패로 원래 값으로 복구했어: 등기 ${registeredAfter}, 환불 ${refundAfter}, 납부건수 ${paymentCountBefore}→${paymentCountAfter}, 평형불일치 ${unitMismatch.length}`);
}

const { error: auditError } = await supabase.from('system_audit_logs').insert({
    actor_email: 'gfinemax@gmail.com',
    action_type: 'APPLY_REGISTERED_ROSTER_DIRECT',
    target_entity_id: null,
    details: {
        source: 'Google Sheets 1-RoFWMx0Na0nuD70LU9udmfyDibkeF_t8yuplyg0xZk',
        registered_count: 86,
        refund_count: 30,
        unit_counts: summary.unitCounts,
        payment_data_changed: false,
    },
    ip_address: 'local codex operation',
});
if (auditError) console.warn(`감사 로그 기록 실패: ${auditError.message}`);

console.log(JSON.stringify({
    ...summary,
    registeredAfter,
    refundAfter,
    paymentCountAfter,
    unitMismatch: unitMismatch.length,
    auditLogged: !auditError,
}, null, 2));
