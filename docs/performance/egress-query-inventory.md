# peopleOn PostgREST Egress 분석 (수정 전: 9f488aa)

2026-09-05. 운영 REST는 402 exceed_egress_quota로 차단되어 사용량/실제 반환 크기는 측정 불가. 아래는 정적 분석이며 호출 횟수와 위험도는 실행 경로로 확인해야 한다.

192개 select 체인 및 전체 from 체인 357개를 조사했다. from에는 Array.from 등 비 DB 호출도 포함되므로 원문으로 구분한다.

| 파일 | 함수·컴포넌트 | 테이블 | 호출 시점 | 반환 범위 | 반복 위험 | Egress 위험도 | 개선안 |
|---|---|---|---|---|---|---|---|
| src/app/(dashboard)/admin/audit/page.tsx:29 | AuditLogsPage | 'system_audit_logs' | 서버 페이지 렌더 | supabase .from('system_audit_logs') .select( *, account_entities(display_name) ) .order('created_at', { ascending: false }) .limit(100) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/(dashboard)/certificate-audit/page.tsx:56 | FinancePage | 'certificate_registry' | 서버 페이지 렌더 | supabase .from('certificate_registry') .select( id, entity_id, certificate_number_normalized, certificate_number_raw, certificate_status, source_type, note, is_active, account_entities ( id, display_name, phone ) ) .eq('is_active', true) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/(dashboard)/certificate-audit/page.tsx:74 | FinancePage | 'membership_roles' | 서버 페이지 렌더 | supabase .from('membership_roles') .select('entity_id, role_code, role_status, is_registered') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/(dashboard)/certificate-audit/page.tsx:77 | FinancePage | 'account_entities' | 서버 페이지 렌더 | supabase .from('account_entities') .select('id, display_name, member_number, phone') .eq('entity_type', 'person') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/(dashboard)/members/page.tsx:88 | MembersPage | 'interaction_logs' | 서버 페이지 렌더 | supabase .from('interaction_logs') .select('entity_id') .ilike('summary', %${query}%) .limit(LOG_SEARCH_RESULT_LIMIT) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/actions/duplicates.ts:50 | getDuplicateGroups | 'account_entities' | 서버 액션 | supabase .from('account_entities') .select( id, display_name, phone, memo, tags, membership_roles(source_member_id, role_code, role_status), certificate_registry(id, certificate_number_normalized) ) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/duplicates.ts:108 | mergeDuplicateEntities | 'account_entities' | 서버 액션 | supabaseAdmin.from('account_entities').select('display_name, memo').eq('id', slaveId).single() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/actions/duplicates.ts:112 | mergeDuplicateEntities | 'membership_roles' | 서버 액션 | supabaseAdmin.from('membership_roles').select('*').eq('entity_id', masterId) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/duplicates.ts:113 | mergeDuplicateEntities | 'membership_roles' | 서버 액션 | supabaseAdmin.from('membership_roles').select('*').eq('entity_id', slaveId) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/duplicates.ts:150 | mergeDuplicateEntities | 'account_entities' | 서버 액션 | supabaseAdmin.from('account_entities').select('memo').eq('id', masterId).single() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/actions/duplicates.ts:187 | ignoreDuplicateGroups | 'account_entities' | 서버 액션 | supabaseAdmin.from('account_entities').select('tags').eq('id', id).single() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/actions/financial.ts:27 | getUnitTypes | 'unit_types' | 서버 액션 | supabase .from('unit_types') .select('*') .eq('is_active', true) .order('area_sqm', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/financial.ts:91 | getDepositAccounts | 'deposit_accounts' | 서버 액션 | supabase .from('deposit_accounts') .select('*') .eq('is_active', true) .order('account_type', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/financial.ts:154 | getMemberPayments | 'member_payments' | 서버 액션 | supabase .from('member_payments') .select('*') .in('entity_id', entityIds) .order('sort_order', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/financial.ts:211 | assignUnitTypeToMember | 'unit_types' | 서버 액션 | supabase .from('unit_types') .select('*') .eq('id', unitTypeId) .single() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/actions/financial.ts:302 | getPaymentStatistics | 'member_payments' | 서버 액션 | supabase .from('member_payments') .select('payment_type, amount_due, amount_paid, is_contribution, unit_type_id, deposit_account_id') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/financial.ts:306 | getPaymentStatistics | 'unit_types' | 서버 액션 | supabase.from('unit_types').select('id, name').eq('is_active', true) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/financial.ts:307 | getPaymentStatistics | 'deposit_accounts' | 서버 액션 | supabase.from('deposit_accounts').select('id, account_name').eq('is_active', true) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/interaction.ts:121 | checkAndLogAssetRightConflicts | 'certificate_registry' | 서버 액션 | supabase .from('certificate_registry') .select('entity_id, certificate_number_raw, certificate_number_normalized') .eq('is_active', true) .in('certificate_number_normalized', normalizedChangedNumbers) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/interaction.ts:133 | checkAndLogAssetRightConflicts | 'account_entities' | 서버 액션 | supabase .from('account_entities') .select('id, display_name') .in('id', entityIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/interaction.ts:171 | checkAndLogAssetRightConflicts | 'account_entities' | 서버 액션 | supabase.from('account_entities').select('memo').eq('id', currentId).single() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/actions/interaction.ts:189 | checkAndLogAssetRightConflicts | 'account_entities' | 서버 액션 | supabase.from('account_entities').select('memo').eq('id', otherId).single() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/actions/member.ts:127 | safeCountByEntity | table | 서버 액션 | supabase .from(table) .select('*', { count: 'exact', head: true }) .in(column, targetIds) | 본문 없음 | 낮음 | ID HEAD 유지 |
| src/app/actions/member.ts:154 | deleteMemberEntities | 'account_entities' | 서버 액션 | supabase.from('account_entities').select('id, display_name').in('id', targetIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/actions/members.ts:36 | searchMembers | 'account_entities' | 서버 액션 | supabase .from('account_entities') .select('id, display_name, address_legal, phone, phone_secondary') .or(display_name.ilike.%${cleanQuery}%,address_legal.ilike.%${cleanQuery}%,phone.ilike.%${cleanQuery}%,phone_secondary.ilike.%${cleanQuery}%) .limit(10) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/actions/members.ts:41 | searchMembers | 'asset_rights' | 서버 액션 | supabase .from('asset_rights') .select( entity_id, right_type, right_number, right_number_raw, right_number_status, account_entities ( id, display_name, address_legal, phone, phone_secondary ) ) .eq('right_type', 'certificate') .or(right_number.ilike.%${cleanQuery}%,right_number_raw.ilike.%${cleanQuery}%) .limit(10) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/api/accounting/compat-history/route.ts:67 | GET | 'audit_logs' | HTTP 요청 | supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'accounting_compat_check') .eq('action', 'run') .order('created_at', { ascending: false }) .limit(limit) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/api/accounting/compat-ready/route.ts:127 | GET | 'party_profiles' | HTTP 요청 | supabase.from('party_profiles').select('id') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/accounting/compat-ready/route.ts:128 | GET | 'account_entities' | HTTP 요청 | supabase.from('account_entities').select('id, source_party_id') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/accounting/compat-ready/route.ts:129 | GET | 'membership_roles' | HTTP 요청 | supabase.from('membership_roles').select('role_code, role_status').eq('role_status', 'active') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/accounting/compat-ready/route.ts:130 | GET | 'v_member_roles_compat' | HTTP 요청 | supabase.from('v_member_roles_compat').select('entity_id, role_code, role_status').eq('role_status', 'active') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/accounting/compat-ready/route.ts:131 | GET | 'asset_rights' | HTTP 요청 | supabase.from('asset_rights').select('entity_id, certificate_number, status') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/accounting/compat-ready/route.ts:132 | GET | 'v_right_certificates_compat' | HTTP 요청 | supabase.from('v_right_certificates_compat').select('entity_id, certificate_number, status') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/accounting/compat-ready/route.ts:308 | GET | 'audit_logs' | HTTP 요청 | supabase .from('audit_logs') .insert({ entity_type: 'accounting_compat_check', entity_id: null, action: 'run', actor: user.id, reason: '회계 호환 전환 준비 점검', metadata: { generated_at: payload.generated_at, overall: payload.overall, summary: payload.summary, checks: payload.checks, guard: payload.guard, recommendation: payload.recommendation, config: payload.config, }, }) .select('id') .maybeSingle() | 단건 | 낮음 | 필요한 반환 컬럼 유지 |
| src/app/api/admin/sync-legacy/route.ts:43 | GET | 'asset_rights' | HTTP 요청 | supabase .from('asset_rights') .select('id, entity_id, meta') .not('entity_id', 'is', null) .order('id', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/admin/sync-legacy/route.ts:137 | GET | 'account_entities' | HTTP 요청 | supabase .from('account_entities') .select('id, display_name, phone') .in('id', memberIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/certificates/analysis/route.ts:17 | GET | 'vw_certificate_grand_stats' | HTTP 요청 | supabase .from('vw_certificate_grand_stats') .select('*') .maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/api/certificates/analysis/route.ts:39 | GET | 'vw_certificate_registered_detail' | HTTP 요청 | supabase .from('vw_certificate_registered_detail') .select('*') .order('certificate_count', { ascending: false }) .order('display_name', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/certificates/analysis/route.ts:50 | GET | 'vw_certificate_others_detail' | HTTP 요청 | supabase .from('vw_certificate_others_detail') .select('*') .order('certificate_count', { ascending: false }) .order('display_name', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/certificates/analysis/route.ts:61 | GET | 'vw_certificate_shared_holders' | HTTP 요청 | supabase .from('vw_certificate_shared_holders') .select('*') .order('holder_count', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/finance/certificate-audit/legacy-exclusive-export/route.ts:43 | GET | 'asset_rights' | HTTP 요청 | supabase .from('asset_rights') .select( id, right_number, right_number_raw, right_number_status, status, meta, entity_id, account_entities ( id, display_name, phone ) ) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/finance/certificate-audit/legacy-exclusive-export/route.ts:59 | GET | 'membership_roles' | HTTP 요청 | supabase .from('membership_roles') .select('entity_id, role_code, is_registered') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/finance/rights-details/export/route.ts:109 | GET | 'asset_rights' | HTTP 요청 | supabase .from('asset_rights') .select( id, right_number, right_number_raw, right_number_status, principal_amount, status, meta, entity_id, account_entities ( id, display_name, phone ) ) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/finance/rights-details/export/route.ts:126 | GET | 'membership_roles' | HTTP 요청 | supabase .from('membership_roles') .select('entity_id, role_code, is_registered') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/financial/migrate/route.ts:31 | POST | 'unit_types' | HTTP 요청 | supabase.from('unit_types').select('id').limit(1) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/api/financial/migrate/route.ts:38 | POST | 'unit_types' | HTTP 요청 | supabase.from('unit_types').select('id').limit(1) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/api/financial/migrate/route.ts:53 | POST | 'deposit_accounts' | HTTP 요청 | supabase.from('deposit_accounts').select('id').limit(1) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/api/financial/migrate/route.ts:59 | POST | 'deposit_accounts' | HTTP 요청 | supabase.from('deposit_accounts').select('id').limit(1) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/api/financial/migrate/route.ts:76 | POST | 'member_payments' | HTTP 요청 | supabase.from('member_payments').select('id').limit(1) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/api/integrations/ledger/members/route.ts:35 | GET | 'member_bank_accounts' | HTTP 요청 | createAdminClient() .from('member_bank_accounts') .select('entity_id, bank_name, account_number, account_holder, purpose, updated_at') .in('entity_id', allEntityIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/integrations/ledger/members/route.ts:44 | GET | 'entity_private_info' | HTTP 요청 | createAdminClient() .from('entity_private_info') .select('entity_id, resident_registration_number') .in('entity_id', missingBirthEntityIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/integrations/ledger/members/[peopleonId]/journal/route.ts:28 | GET | 'account_entities' | HTTP 요청 | supabase.from('account_entities').select('id, memo').in('id', entityIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/integrations/ledger/members/[peopleonId]/journal/route.ts:31 | GET | 'interaction_logs' | HTTP 요청 | supabase .from('interaction_logs') .select('id, entity_id, type, direction, summary, staff_name, created_at') .in('entity_id', entityIds) .order('created_at', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/integrations/ledger/members/[peopleonId]/supply-type/route.ts:41 | PATCH | 'account_entities' | HTTP 요청 | supabase .from('account_entities') .update({ unit_group: supplyType }) .in('id', entityIds) .select('id, unit_group') | 명시 범위 없음; 상위 반복 확인 | 낮음 | 필요한 반환 컬럼 유지 |
| src/app/api/members/bulk-upload/route.ts:29 | POST | 'account_entities' | HTTP 요청 | supabase .from('account_entities') .insert({ display_name: m.name, phone: m.phone &#124;&#124; null, member_number: m.member_number &#124;&#124; null, unit_group: m.unit_group &#124;&#124; null, address_legal: m.address_legal &#124;&#124; null, memo: m.memo &#124;&#124; null, entity_type: 'person', status: '정상' }) .select('id') .single() | 단건 | 낮음 | 필요한 반환 컬럼 유지 |
| src/app/api/members/create/route.ts:36 | POST | 'account_entities' | HTTP 요청 | supabase .from('account_entities') .insert({ display_name: name, phone: formatPhone(phone), phone_secondary: formatPhone(secondary_phone), member_number: member_number &#124;&#124; null, unit_group: unit_group &#124;&#124; null, address_legal: address_legal &#124;&#124; null, memo: memo &#124;&#124; null, birth_date: birth_date &#124;&#124; null, entity_type: 'person', status: '정상' }) .select('id') .single() | 단건 | 낮음 | 필요한 반환 컬럼 유지 |
| src/app/api/members/inline-update/route.ts:56 | POST | 'membership_roles' | HTTP 요청 | supabase .from('membership_roles') .select('id') .eq('entity_id', entityId) .eq('role_code', nextCategory.roleCode) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/members/inline-update/route.ts:142 | POST | 'membership_roles' | HTTP 요청 | supabase .from('membership_roles') .update({ role_status: 'inactive' }) .in('entity_id', roleEntityIds) .in('role_code', dbCodes) .select('id') | 명시 범위 없음; 상위 반복 확인 | 낮음 | 필요한 반환 컬럼 유지 |
| src/app/api/members/inline-update/route.ts:163 | POST | 'membership_roles' | HTTP 요청 | supabase .from('membership_roles') .update({ role_status: 'active' }) .in('entity_id', roleEntityIds) .in('role_code', dbCodes) .select('id') | 명시 범위 없음; 상위 반복 확인 | 낮음 | 필요한 반환 컬럼 유지 |
| src/app/api/members/roster-sync/route.ts:38 | buildPreview | 'membership_roles' | HTTP 요청 | supabase .from('membership_roles') .select('id,entity_id') .eq('is_registered', true) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/members/roster-sync/route.ts:50 | buildPreview | 'account_entities' | HTTP 요청 | supabase .from('account_entities').select('id,display_name,status,unit_group').in('id', entityIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/members/table/route.ts:23 | findMatchedLogEntityIds | 'interaction_logs' | HTTP 요청 | supabase .from('interaction_logs') .select('entity_id') .ilike('summary', %${query}%) .limit(LOG_SEARCH_RESULT_LIMIT) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/api/members/[id]/bank-account/route.ts:24 | GET | 'member_bank_accounts' | HTTP 요청 | createAdminClient() .from('member_bank_accounts') .select('bank_name, account_number, account_holder, purpose, updated_at') .eq('entity_id', memberId) .maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/api/members/[id]/bank-account/route.ts:56 | PUT | 'account_entities' | HTTP 요청 | supabase .from('account_entities') .select('id, display_name') .eq('id', memberId) .maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/api/members/[id]/bank-account/route.ts:69 | PUT | 'member_bank_accounts' | HTTP 요청 | supabase .from('member_bank_accounts') .select('bank_name, account_number, account_holder, purpose, created_by') .eq('entity_id', memberId) .maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/api/members/[id]/bank-account/route.ts:75 | PUT | 'member_bank_accounts' | HTTP 요청 | supabase .from('member_bank_accounts') .upsert({ entity_id: memberId, bank_name: bankName, account_number: accountNumber, account_holder: accountHolder, purpose, created_by: before?.created_by &#124;&#124; actorEmail, updated_by: actorEmail, updated_at: new Date().toISOString(), }, { onConflict: 'entity_id' }) .select('bank_name, account_number, account_holder, purpose, updated_at') .single() | 단건 | 낮음 | 필요한 반환 컬럼 유지 |
| src/app/api/members/[id]/profile-image/route.ts:24 | getEntityMeta | 'account_entities' | HTTP 요청 | admin.from('account_entities').select('meta').eq('id', id).maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/api/settlement/alerts/history/route.ts:79 | GET | 'audit_logs' | HTTP 요청 | supabase .from('audit_logs') .select('id, created_at, actor, reason, metadata') .eq('entity_type', 'settlement_alert') .eq('action', 'create') .order('created_at', { ascending: false }) .limit(limit) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/api/settlement/diagnostics/export/route.ts:87 | GET | 'settlement_cases' | HTTP 요청 | supabase .from('settlement_cases') .select('id, party_id, case_status, created_at') .order('created_at', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/settlement/diagnostics/export/route.ts:102 | GET | 'party_profiles' | HTTP 요청 | supabase .from('party_profiles') .select('id, display_name, member_id') .in('id', partyIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/settlement/diagnostics/export/route.ts:114 | GET | 'settlement_lines' | HTTP 요청 | supabase .from('settlement_lines') .select('case_id, amount') .in('case_id', caseIds) .eq('line_type', 'final_refund') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/settlement/diagnostics/export/route.ts:121 | GET | 'refund_payments' | HTTP 요청 | supabase .from('refund_payments') .select('case_id, paid_amount, payment_status') .in('case_id', caseIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/settlement/diagnostics/export/route.ts:141 | GET | 'account_entities' | HTTP 요청 | supabase .from('account_entities') .select('id, display_name') .in('id', memberIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/app/api/settlement/ops/status/route.ts:59 | GET | 'audit_logs' | HTTP 요청 | supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'qa_report') .eq('action', 'run') .order('created_at', { ascending: false }) .limit(1) .maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/api/settlement/ops/status/route.ts:67 | GET | 'audit_logs' | HTTP 요청 | supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'settlement_case_batch') .eq('action', 'sync_case_status') .order('created_at', { ascending: false }) .limit(1) .maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/api/settlement/ops/status/route.ts:75 | GET | 'audit_logs' | HTTP 요청 | supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'permission_probe') .eq('action', 'probe') .order('created_at', { ascending: false }) .limit(1) .maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/api/settlement/ops/status/route.ts:83 | GET | 'audit_logs' | HTTP 요청 | supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'settlement_case_batch') .eq('action', 'create_missing_cases') .order('created_at', { ascending: false }) .limit(1) .maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/api/settlement/ops/status/route.ts:91 | GET | 'audit_logs' | HTTP 요청 | supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'refund_payment') .eq('action', 'create') .order('created_at', { ascending: false }) .limit(1) .maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/app/api/settlement/qa/history/route.ts:117 | GET | 'audit_logs' | HTTP 요청 | supabase .from('audit_logs') .select('id, actor, created_at, metadata') .eq('entity_type', 'qa_report') .eq('action', 'run') .order('created_at', { ascending: false }) .limit(limit) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/app/debug/page.tsx:19 | DebugPage | 'account_entities' | 서버 페이지 렌더 | supabase.from('account_entities').select('*', { count: 'exact', head: true }) | 본문 없음 | 낮음 | ID HEAD 유지 |
| src/components/features/finance/LegacyRecordDetailDialog.tsx:67 | loadRecord | 'asset_rights' | 효과/사용자 작업 | supabase .from('asset_rights') .select('*') .eq('id', id) .single() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/components/features/members/ActivityTimelineTab.tsx:70 | ActivityTimelineTab | 'interaction_logs' | 효과/사용자 작업 | supabase .from('interaction_logs') .select('*', { count: 'exact', head: true }) .in('entity_id', memberIds) | 본문 없음 | 낮음 | ID HEAD 유지 |
| src/components/features/members/ActivityTimelineTab.tsx:84 | ActivityTimelineTab | 'interaction_logs' | 효과/사용자 작업 | supabase .from('interaction_logs') .select('*') .in('entity_id', memberIds) .order('created_at', { ascending: false }) .range(from, to) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/components/features/members/memberDetailDialogFetch.ts:50 | fetchMemberDetail | 'account_entities' | 효과/사용자 작업 | supabase .from('account_entities') .select('*') .in('id', ids) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/members/memberDetailDialogFetch.ts:62 | fetchMemberDetail | 'membership_roles' | 효과/사용자 작업 | supabase.from('membership_roles').select('role_code, role_status, is_registered').in('entity_id', ids) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/members/memberDetailDialogFetch.ts:63 | fetchMemberDetail | 'entity_relationships' | 효과/사용자 작업 | supabase .from('entity_relationships') .select('from_entity_id, to_entity_id, relation_type, relation_note, agent_entity:account_entities!from_entity_id(display_name, phone)') .in('to_entity_id', ids) .eq('relation_type', 'agent') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/members/memberDetailDialogFetch.ts:68 | fetchMemberDetail | 'entity_relationships' | 효과/사용자 작업 | supabase .from('entity_relationships') .select('from_entity_id, to_entity_id, relation_type, relation_note, owner_entity:account_entities!to_entity_id(display_name, phone)') .in('from_entity_id', ids) .eq('relation_type', 'agent') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/members/memberDetailDialogFetch.ts:73 | fetchMemberDetail | 'certificate_registry' | 효과/사용자 작업 | supabase .from('certificate_registry') .select('*') .in('entity_id', ids) .eq('is_active', true) .order('created_at', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/members/memberDetailDialogFetch.ts:79 | fetchMemberDetail | 'entity_private_info' | 효과/사용자 작업 | supabase.from('entity_private_info').select('entity_id, resident_registration_number').in('entity_id', ids) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/members/MemberWorkspacePage.tsx:142 | load | 'member_payments' | 효과/사용자 작업 | supabase.from('member_payments').select('*').in('entity_id', memberIds).order('sort_order') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/members/MemberWorkspacePage.tsx:143 | load | 'interaction_logs' | 효과/사용자 작업 | supabase.from('interaction_logs').select('id,type,summary,staff_name,attachment,created_at').in('entity_id', memberIds).order('created_at', { ascending: false }).limit(30) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/components/features/members/PaymentStatusTab.tsx:66 | PaymentStatusTab | 'member_payments' | 효과/사용자 작업 | supabase.from('member_payments').select('*').in('entity_id', memberIds).order('sort_order', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/members/PaymentStatusTab.tsx:67 | PaymentStatusTab | 'unit_types' | 효과/사용자 작업 | supabase.from('unit_types').select('*').eq('is_active', true).order('area_sqm', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/members/PaymentStatusTab.tsx:68 | PaymentStatusTab | 'deposit_accounts' | 효과/사용자 작업 | supabase.from('deposit_accounts').select('*').eq('is_active', true).order('account_type', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/members/PaymentStatusTab.tsx:77 | PaymentStatusTab | 'member_payments' | 효과/사용자 작업 | supabase .from('member_payments') .select('*') .in('entity_id', memberIds) .order('sort_order', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/settings/DepositAccountsSection.tsx:35 | DepositAccountsSection | 'deposit_accounts' | 효과/사용자 작업 | supabase.from('deposit_accounts').select('*').eq('is_active', true).order('account_type') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/components/features/settings/UnitTypesSection.tsx:34 | UnitTypesSection | 'unit_types' | 효과/사용자 작업 | supabase.from('unit_types').select('*').eq('is_active', true).order('area_sqm') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/accountingDomainSync.ts:78 | resolveEntityIdByMember | 'party_profiles' | 상위 호출/집계 | supabase .from('party_profiles') .select('id') .eq('member_id', member.id) .maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/lib/server/accountingDomainSync.ts:93 | resolveEntityIdByMember | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .upsert( { source_party_id: partyRef.id, entity_type: 'person', display_name: displayName, phone, meta: { source: 'members_action_sync', source_member_id: member.id, }, }, { onConflict: 'source_party_id' }, ) .select('id') .maybeSingle() | 단건 | 낮음 | 필요한 반환 컬럼 유지 |
| src/lib/server/accountingDomainSync.ts:118 | resolveEntityIdByMember | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, meta') .contains('meta', { source_member_id: member.id }) .limit(1) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/lib/server/accountingDomainSync.ts:151 | resolveEntityIdByMember | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .insert({ entity_type: 'person', display_name: displayName, phone, meta: { source: 'members_action_sync', source_member_id: member.id, }, }) .select('id') .maybeSingle() | 단건 | 낮음 | 필요한 반환 컬럼 유지 |
| src/lib/server/activityFeed.ts:122 | (callback/module) | 'interaction_logs' | 상위 호출/집계 | supabase .from('interaction_logs') .select('id, entity_id, type, direction, summary, staff_name, created_at') .in('entity_id', entityIdChunk) .order('created_at', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/activityFeed.ts:156 | (callback/module) | 'vw_latest_interaction_log_by_entity' | 상위 호출/집계 | supabase .from('vw_latest_interaction_log_by_entity') .select('id, entity_id, type, direction, summary, staff_name, created_at') .in('entity_id', entityIdChunk) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/activityFeed.ts:186 | fetchActivityFeedEntries | 'interaction_logs' | 상위 호출/집계 | supabase .from('interaction_logs') .select('id, entity_id, type, direction, summary, staff_name, created_at') .order('created_at', { ascending: false }) .limit(limit) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/lib/server/activityFeed.ts:201 | fetchActivityFeedEntries | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, display_name, phone') .in('id', entityIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/activityFeed.ts:260 | fetchRecentActivitySummariesForPeople | 'interaction_logs' | 상위 호출/집계 | supabase .from('interaction_logs') .select('id, entity_id, type, direction, summary, staff_name, created_at') .in('entity_id', entityIdChunk) .order('created_at', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/certificateAuditQuality.ts:45 | fetchCertificateAuditQualityMetrics | 'party_profiles' | 상위 호출/집계 | supabase .from('party_profiles') .select('id, member_id') .in('member_id', memberIdsFromLegacy) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/certificateAuditQuality.ts:78 | fetchCertificateAuditQualityMetrics | 'settlement_cases' | 상위 호출/집계 | supabase .from('settlement_cases') .select('id, party_id, case_status, created_at') .in('party_id', memberPartyIds) .order('created_at', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/certificateAuditQuality.ts:97 | fetchCertificateAuditQualityMetrics | 'settlement_lines' | 상위 호출/집계 | supabase .from('settlement_lines') .select('case_id, amount') .in('case_id', latestCaseIds) .eq('line_type', 'final_refund') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/certificateAuditQuality.ts:102 | fetchCertificateAuditQualityMetrics | 'refund_payments' | 상위 호출/집계 | supabase .from('refund_payments') .select('case_id, paid_amount, payment_status') .in('case_id', latestCaseIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/certificateCompat.ts:42 | fetchCertificateCompatRows | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, source_party_id') .in('source_party_id', holderPartyIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/certificateCompat.ts:53 | fetchCertificateCompatRows | 'v_right_certificates_compat' | 상위 호출/집계 | supabase .from('v_right_certificates_compat') .select('certificate_number, status, entity_id') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/certificateCompat.ts:71 | fetchCertificateCompatRows | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, source_party_id') .in('id', entityIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/certificateCompat.ts:102 | fetchCertificateCompatRows | 'asset_rights' | 상위 호출/집계 | supabase .from('asset_rights') .select('right_number, status, entity_id') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/certificateCompat.ts:122 | fetchCertificateCompatRows | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, source_party_id') .in('id', entityIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/dashboardOverview.ts:203 | fetchPaymentOverviewSummary | 'vw_dashboard_payment_total_summary' | 상위 호출/집계 | supabase .from('vw_dashboard_payment_total_summary') .select('total_due, total_paid') .single() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/lib/server/dashboardOverview.ts:207 | fetchPaymentOverviewSummary | 'vw_dashboard_payment_step_summary' | 상위 호출/집계 | supabase .from('vw_dashboard_payment_step_summary') .select('bucket, due, paid') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/dashboardOverview.ts:222 | fetchFinancialStatsSummary | 'vw_member_payment_financial_total_summary' | 상위 호출/집계 | supabase .from('vw_member_payment_financial_total_summary') .select('payment_count, contribution_due, contribution_paid, certificate_paid, premium_recognized_paid') .single() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/lib/server/dashboardOverview.ts:226 | fetchFinancialStatsSummary | 'vw_member_payment_type_summary' | 상위 호출/집계 | supabase .from('vw_member_payment_type_summary') .select('payment_type, due, paid') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/dashboardOverview.ts:229 | fetchFinancialStatsSummary | 'vw_member_payment_unit_type_summary' | 상위 호출/집계 | supabase .from('vw_member_payment_unit_type_summary') .select('unit_type_name, due, paid, count') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/dashboardOverview.ts:232 | fetchFinancialStatsSummary | 'vw_member_payment_account_summary' | 상위 호출/집계 | supabase .from('vw_member_payment_account_summary') .select('account_name, account_type, total') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/dashboardOverview.ts:248 | fetchPaymentOverviewFallback | 'payments' | 상위 호출/집계 | supabase.from('payments').select('amount_due, amount_paid, step') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/dashboardOverview.ts:263 | fetchFinancialStatsFallback | 'member_payments' | 상위 호출/집계 | supabase .from('member_payments') .select('payment_type, amount_due, amount_paid, is_contribution, unit_type_id, deposit_account_id') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/dashboardOverview.ts:266 | fetchFinancialStatsFallback | 'unit_types' | 상위 호출/집계 | supabase.from('unit_types').select('id, name').eq('is_active', true) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/dashboardOverview.ts:267 | fetchFinancialStatsFallback | 'deposit_accounts' | 상위 호출/집계 | supabase.from('deposit_accounts').select('id, account_name, account_type').eq('is_active', true) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/dashboardOverview.ts:309 | fetchDashboardOverviewData | 'membership_roles' | 상위 호출/집계 | supabase .from('membership_roles') .select('entity_id') .eq('is_registered', true) .gte('created_at', thirtyDaysAgo.toISOString()) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/dashboardOverview.ts:316 | fetchDashboardOverviewData | 'payments' | 상위 호출/집계 | supabase .from('payments') .select('id, paid_date, step_name, step, amount_paid, account_entities(display_name)') .not('paid_date', 'is', null) .order('paid_date', { ascending: false }) .limit(3) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/lib/server/dashboardOverview.ts:322 | fetchDashboardOverviewData | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, display_name, created_at, unit_group') .order('created_at', { ascending: false }) .limit(3) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/lib/server/dashboardOverview.ts:327 | fetchDashboardOverviewData | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, display_name, member_number, tier, status, is_favorite') .eq('is_favorite', true) .order('display_name', { ascending: true }) .limit(10) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/lib/server/memberUpdateBasicUtils.ts:70 | syncPreferredUnitType | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, meta') .in('id', targetIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/memberUpdateBasicUtils.ts:140 | syncRepresentatives | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .insert({ entity_type: 'person', display_name: repName &#124;&#124; '새 대리인', phone: repPhone, }) .select('id') .single() | 단건 | 낮음 | 필요한 반환 컬럼 유지 |
| src/lib/server/memberUpdateCertificateUtils.ts:45 | syncCertificateRights | 'certificate_registry' | 상위 호출/집계 | supabase .from('certificate_registry') .select('id, note') .in('id', body.deleted_rights_ids) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/memberUpdateCertificateUtils.ts:59 | syncCertificateRights | 'certificate_registry' | 상위 호출/집계 | supabase .from('certificate_registry') .select('id, note') .in('entity_id', targetIds) .eq('is_active', true) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/memberUpdateCertificateUtils.ts:119 | syncCertificateRights | 'certificate_registry' | 상위 호출/집계 | supabase .from('certificate_registry') .insert({ entity_id: targetIds[0], certificate_number_raw: target_number, certificate_number_normalized: target_number .replace(/[./]/g, '-') .replace(/\s+/g, '') .toLowerCase(), certificate_status: 'confirmed', source_type: 'manual', is_confirmed_for_count: true, is_active: true, note: JSON.stringify({ node_type: 'derivative', integration_type, merged_at: new Date().toISOString(), merged_by: userId, }), }) .select('id') .single() | 단건 | 낮음 | 필요한 반환 컬럼 유지 |
| src/lib/server/memberUpdateCertificateUtils.ts:149 | syncCertificateRights | 'certificate_registry' | 상위 호출/집계 | supabase .from('certificate_registry') .select('note, entity_id') .eq('id', sourceId) .single() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/lib/server/memberUpdateCertificateUtils.ts:253 | syncPersonCertificateSummary | 'membership_roles' | 상위 호출/집계 | supabase .from('membership_roles') .select('is_registered, role_status') .eq('entity_id', targetIds[0]) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/partyRolesCompat.ts:62 | fetchPartyRolesCompat | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, source_party_id') .in('source_party_id', partyIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/partyRolesCompat.ts:72 | fetchPartyRolesCompat | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, source_party_id') .not('source_party_id', 'is', null) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/partyRolesCompat.ts:90 | fetchPartyRolesCompat | 'v_member_roles_compat' | 상위 호출/집계 | supabase .from('v_member_roles_compat') .select('entity_id, role_code, role_status') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/partyRolesCompat.ts:129 | fetchPartyRolesCompat | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, source_party_id') .in('source_party_id', partyIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/partyRolesCompat.ts:135 | fetchPartyRolesCompat | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, source_party_id') .not('source_party_id', 'is', null) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/partyRolesCompat.ts:151 | fetchPartyRolesCompat | 'membership_roles' | 상위 호출/집계 | supabase .from('membership_roles') .select('entity_id, role_code, role_status') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/paymentDashboard.ts:187 | fetchPaymentEntitySummaries | 'vw_member_payment_entity_summary' | 상위 호출/집계 | supabase .from('vw_member_payment_entity_summary') .select( 'entity_id, payment_count, contribution_due_base, contribution_paid_base, certificate_paid, premium_recognized_paid, union_fee_actual_paid, union_fee_count, structured_count, latest_paid_date, unit_type_names, account_names', ) .in('entity_id', entityIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/paymentDashboard.ts:440 | fetchPaymentDashboardData | 'member_payments' | 상위 호출/집계 | supabase .from('member_payments') .select('id, entity_id, unit_type_id, payment_type, amount_due, amount_paid, deposit_account_id, paid_date, receipt_note, is_contribution, status, sort_order') .in('entity_id', allEntityIds) .order('sort_order', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/paymentDashboard.ts:446 | fetchPaymentDashboardData | 'unit_types' | 상위 호출/집계 | supabase .from('unit_types') .select('id, name, area_sqm') .eq('is_active', true) .order('area_sqm', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/paymentDashboard.ts:451 | fetchPaymentDashboardData | 'deposit_accounts' | 상위 호출/집계 | supabase .from('deposit_accounts') .select('id, account_name, account_type') .eq('is_active', true) .order('account_type', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/personCertificateSummary.ts:81 | fetchPersonCertificateSummarySnapshot | 'vw_person_certificate_summary_current' | 상위 호출/집계 | supabase .from('vw_person_certificate_summary_current') .select('*') .order('owner_group', { ascending: false }) .order('display_name', { ascending: true }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/personCertificateSummary.ts:86 | fetchPersonCertificateSummarySnapshot | 'vw_person_certificate_rollup' | 상위 호출/집계 | supabase .from('vw_person_certificate_rollup') .select('*') .order('owner_group', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/personCertificateSummary.ts:116 | fetchPersonCertificateRollupsSnapshot | 'vw_person_certificate_rollup' | 상위 호출/집계 | supabase .from('vw_person_certificate_rollup') .select( 'owner_group, owner_count, owner_with_certificate_count, provisional_certificate_count, effective_certificate_count, conflict_certificate_count, manual_locked_count, pending_review_count', ) .order('owner_group', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/residentRegistryImport.ts:122 | buildResidentRegistryPreview | 'entity_private_info' | 상위 호출/집계 | supabase .from('entity_private_info') .select('entity_id, resident_registration_number') .in('entity_id', allEntityIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/residentRegistryImport.ts:206 | ensureResidentRegistryTablesExist | 'secure_resident_registry' | 상위 호출/집계 | supabaseAdmin .from('secure_resident_registry') .select('id') .limit(1) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/lib/server/residentRegistryImport.ts:237 | executeResidentRegistryImport | 'entity_private_info' | 상위 호출/집계 | supabaseAdmin .from('entity_private_info') .select('entity_id, resident_registration_number') .in('entity_id', matchedEntityIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementAccessProbe.ts:41 | probeSettlementAccessWithPermission | check.table | 상위 호출/집계 | supabase.from(check.table).select('id', { head: true, count: 'exact' }) | 본문 없음 | 낮음 | ID HEAD 유지 |
| src/lib/server/settlementAccessProbe.ts:72 | probeSettlementAccessWithPermission | 'refund_payments' | 상위 호출/집계 | supabase .from('refund_payments') .insert({ case_id: dummyCaseId, paid_amount: 0, paid_date: new Date().toISOString().slice(0, 10), payment_reference: probeRef, receiver_name: 'probe', payment_status: 'requested', }) .select('id') .maybeSingle() | 단건 | 낮음 | 필요한 반환 컬럼 유지 |
| src/lib/server/settlementDashboard.ts:41 | fetchSettlementCases | 'settlement_cases' | 상위 호출/집계 | supabase .from('settlement_cases') .select('id, party_id, case_status, created_at') .order('created_at', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementDashboard.ts:69 | fetchOwnershipMaps | 'party_profiles' | 상위 호출/집계 | supabase .from('party_profiles') .select('id, display_name, member_id') .in('id', partyIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementDashboard.ts:95 | fetchOwnershipMaps | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, display_name') .in('id', memberIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementDashboard.ts:132 | fetchSettlementAmounts | 'vw_settlement_case_amount_summary' | 상위 호출/집계 | supabase .from('vw_settlement_case_amount_summary') .select('case_id, expected, paid') .in('case_id', caseIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementDashboard.ts:147 | fetchSettlementAmounts | 'settlement_lines' | 상위 호출/집계 | supabase .from('settlement_lines') .select('case_id, line_type, amount') .in('case_id', caseIds) .eq('line_type', 'final_refund') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementDashboard.ts:152 | fetchSettlementAmounts | 'refund_payments' | 상위 호출/집계 | supabase .from('refund_payments') .select('case_id, paid_amount, payment_status') .in('case_id', caseIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementDashboard.ts:204 | fetchSettlementDashboardData | 'party_profiles' | 상위 호출/집계 | supabase .from('party_profiles') .select('id') .ilike('display_name', %${query}%) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementMissingCases.ts:24 | createMissingSettlementCasesWithPermission | 'party_profiles' | 상위 호출/집계 | supabase.from('party_profiles').select('id, member_id') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementMissingCases.ts:27 | createMissingSettlementCasesWithPermission | 'settlement_cases' | 상위 호출/집계 | supabase.from('settlement_cases').select('party_id') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementQaReport.ts:98 | buildSettlementQaPayload | 'settlement_cases' | 상위 호출/집계 | supabase .from('settlement_cases') .select('id, party_id, case_status, created_at') .order('created_at', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementQaReport.ts:114 | buildSettlementQaPayload | 'party_profiles' | 상위 호출/집계 | supabase .from('party_profiles') .select('id, display_name, member_id') .in('id', partyIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementQaReport.ts:126 | buildSettlementQaPayload | 'settlement_lines' | 상위 호출/집계 | supabase .from('settlement_lines') .select('case_id, line_type, amount') .in('case_id', caseIds) .eq('line_type', 'final_refund') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementQaReport.ts:132 | buildSettlementQaPayload | 'refund_payments' | 상위 호출/집계 | supabase .from('refund_payments') .select('id, case_id, paid_amount, payment_status, payment_reference') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementQaReport.ts:150 | buildSettlementQaPayload | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, display_name') .in('id', memberIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementQaReport.ts:281 | buildSettlementQaPayload | 'audit_logs' | 상위 호출/집계 | supabase .from('audit_logs') .insert({ entity_type: 'qa_report', entity_id: null, action: 'run', actor: userId, reason: '정산 QA 자동 점검 실행', metadata: { generated_at: payload.generated_at, overall: payload.overall, summary: payload.summary, checks: payload.checks, }, }) .select('id') .maybeSingle() | 단건 | 낮음 | 필요한 반환 컬럼 유지 |
| src/lib/server/settlementRefundPayment.ts:40 | registerRefundPaymentWithPermission | 'settlement_cases' | 상위 호출/집계 | supabase .from('settlement_cases') .select('id, case_status') .eq('id', caseId) .maybeSingle() | 단건 | 낮음 | 필요 컬럼 명시 |
| src/lib/server/settlementRefundPayment.ts:54 | registerRefundPaymentWithPermission | 'refund_payments' | 상위 호출/집계 | supabase .from('refund_payments') .select('id', { count: 'exact', head: true }) .eq('case_id', caseId) .eq('payment_reference', paymentReference) .eq('payment_status', 'paid') | 본문 없음 | 낮음 | ID HEAD 유지 |
| src/lib/server/settlementRefundPayment.ts:67 | registerRefundPaymentWithPermission | 'settlement_lines' | 상위 호출/집계 | supabase.from('settlement_lines').select('amount').eq('case_id', caseId).eq('line_type', 'final_refund') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementRefundPayment.ts:68 | registerRefundPaymentWithPermission | 'refund_payments' | 상위 호출/집계 | supabase.from('refund_payments').select('paid_amount').eq('case_id', caseId).eq('payment_status', 'paid') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementRefundPayment.ts:89 | registerRefundPaymentWithPermission | 'refund_payments' | 상위 호출/집계 | supabase .from('refund_payments') .insert({ case_id: caseId, paid_amount: paidAmount, paid_date: paidDate, payment_reference: paymentReference &#124;&#124; null, receiver_name: receiverName &#124;&#124; null, payment_status: 'paid', }) .select('id') .maybeSingle() | 단건 | 낮음 | 필요한 반환 컬럼 유지 |
| src/lib/server/settlementStatusSync.ts:26 | syncSettlementCaseStatusesWithPermission | 'settlement_cases' | 상위 호출/집계 | supabase .from('settlement_cases') .select('id, case_status, created_at') .neq('case_status', 'rejected') .order('created_at', { ascending: false }) .limit(limit) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/lib/server/settlementStatusSync.ts:50 | syncSettlementCaseStatusesWithPermission | 'settlement_lines' | 상위 호출/집계 | supabase.from('settlement_lines').select('case_id, amount').in('case_id', caseIds).eq('line_type', 'final_refund') | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/settlementStatusSync.ts:51 | syncSettlementCaseStatusesWithPermission | 'refund_payments' | 상위 호출/집계 | supabase.from('refund_payments').select('case_id, paid_amount, payment_status').in('case_id', caseIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/smsDashboard.ts:174 | fetchPaymentTotalsByEntity | 'vw_member_payment_entity_summary' | 상위 호출/집계 | supabase .from('vw_member_payment_entity_summary') .select('entity_id, total_due, total_paid') .in('entity_id', chunk) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/smsDashboard.ts:204 | fetchPaymentTotalsByEntity | 'member_payments' | 상위 호출/집계 | supabase .from('member_payments') .select('entity_id, amount_due, amount_paid') .in('entity_id', chunk) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/lib/server/smsDashboard.ts:236 | fetchSmsDashboardData | 'interaction_logs' | 상위 호출/집계 | supabase .from('interaction_logs') .select('id, entity_id, summary, staff_name, created_at') .eq('type', 'SMS') .order('created_at', { ascending: false }) .limit(60) | 호출 빈도 확인 | 중간 | 정렬/중복 요청 확인 |
| src/services/memberAggregationData.ts:125 | fetchLatestSettlementCases | 'vw_latest_settlement_case_by_entity' | 상위 호출/집계 | supabase .from('vw_latest_settlement_case_by_entity') .select('id, entity_id, case_status, created_at') .order('created_at', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/services/memberAggregationData.ts:134 | fetchLatestSettlementCases | 'settlement_cases' | 상위 호출/집계 | supabase .from('settlement_cases') .select('id, entity_id, case_status, created_at') .order('created_at', { ascending: false }) | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/services/memberAggregationData.ts:142 | fetchCertificateRegistry | 'certificate_registry' | 상위 호출/집계 | supabase .from('certificate_registry') .select('id, entity_id, certificate_number_normalized, certificate_number_raw, certificate_status, source_type, note, is_active, is_confirmed_for_count, issued_at') .eq('is_active', true) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/services/memberAggregationData.ts:151 | fetchCertificateRegistry | 'certificate_registry' | 상위 호출/집계 | supabase .from('certificate_registry') .select('id, entity_id, certificate_number_normalized, certificate_number_raw, certificate_status, source_type, note, is_active, is_confirmed_for_count, cert_date') .eq('is_active', true) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/services/memberAggregationData.ts:158 | fetchAggregationBaseData | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, entity_type, display_name, phone, address_legal, unit_group, memo, is_favorite, tags, status, birth_date') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/services/memberAggregationData.ts:161 | fetchAggregationBaseData | 'membership_roles' | 상위 호출/집계 | supabase .from('membership_roles') .select('id, entity_id, role_code, role_status, is_registered') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/services/memberAggregationData.ts:166 | fetchAggregationBaseData | 'entity_relationships' | 상위 호출/집계 | supabase .from('entity_relationships') .select('to_entity_id, from_entity_id, relation_type, relation_note, agent_entity:account_entities!from_entity_id(display_name), owner_entity:account_entities!to_entity_id(display_name, phone)') .in('relation_type', ['agent', 'nominee_owner']) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/services/memberAggregationData.ts:203 | fetchAggregationIdentityData | 'account_entities' | 상위 호출/집계 | supabase .from('account_entities') .select('id, entity_type, display_name, phone, address_legal, unit_group, memo, is_favorite, tags, status, birth_date') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/services/memberAggregationData.ts:206 | fetchAggregationIdentityData | 'membership_roles' | 상위 호출/집계 | supabase .from('membership_roles') .select('id, entity_id, role_code, role_status, is_registered') | 명시 범위 없음; 상위 반복 확인 | 높음 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/services/memberAggregationData.ts:248 | fetchSettlementAmounts | 'vw_settlement_case_amount_summary' | 상위 호출/집계 | supabase .from('vw_settlement_case_amount_summary') .select('case_id, expected, paid') .in('case_id', latestCaseIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/services/memberAggregationData.ts:266 | fetchSettlementAmounts | 'settlement_lines' | 상위 호출/집계 | supabase .from('settlement_lines') .select('case_id, line_type, amount') .in('case_id', latestCaseIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |
| src/services/memberAggregationData.ts:270 | fetchSettlementAmounts | 'refund_payments' | 상위 호출/집계 | supabase .from('refund_payments') .select('case_id, paid_amount, payment_status') .in('case_id', latestCaseIds) | 명시 범위 없음; 상위 반복 확인 | 중간 | 명시 정렬 + 분할 조회; 집계/내보내기 완전성 유지 |

## 원문 from 호출 목록

```text
src/app/(dashboard)/admin/audit/page.tsx:29 supabase .from('system_audit_logs') .select(` *, account_entities(display_name) `) .order('created_at', { ascending: false }) .limit(100)
src/app/(dashboard)/certificate-audit/page.tsx:56 supabase .from('certificate_registry') .select(` id, entity_id, certificate_number_normalized, certificate_number_raw, certificate_status, source_type, note, is_active, account_entities ( id, display_name, phone ) `) .eq('is_active', true)
src/app/(dashboard)/certificate-audit/page.tsx:74 supabase .from('membership_roles') .select('entity_id, role_code, role_status, is_registered')
src/app/(dashboard)/certificate-audit/page.tsx:77 supabase .from('account_entities') .select('id, display_name, member_number, phone') .eq('entity_type', 'person')
src/app/(dashboard)/members/page.tsx:88 supabase .from('interaction_logs') .select('entity_id') .ilike('summary', `%${query}%`) .limit(LOG_SEARCH_RESULT_LIMIT)
src/app/actions/audit.ts:32 supabaseAdmin.from('system_audit_logs').insert({ actor_email: actorEmail, action_type: actionType, target_entity_id: targetEntityId || null, details: details || {}, ip_address: ipAddress })
src/app/actions/duplicates.ts:50 supabase .from('account_entities') .select(` id, display_name, phone, memo, tags, membership_roles(source_member_id, role_code, role_status), certificate_registry(id, certificate_number_normalized) `)
src/app/actions/duplicates.ts:108 supabaseAdmin.from('account_entities').select('display_name, memo').eq('id', slaveId).single()
src/app/actions/duplicates.ts:112 supabaseAdmin.from('membership_roles').select('*').eq('entity_id', masterId)
src/app/actions/duplicates.ts:113 supabaseAdmin.from('membership_roles').select('*').eq('entity_id', slaveId)
src/app/actions/duplicates.ts:121 supabaseAdmin.from('membership_roles').delete().eq('id', sRole.id)
src/app/actions/duplicates.ts:123 supabaseAdmin.from('membership_roles').update({ entity_id: masterId }).eq('id', sRole.id)
src/app/actions/duplicates.ts:141 supabaseAdmin.from(t.name).update({ [t.col]: masterId }).eq(t.col, slaveId)
src/app/actions/duplicates.ts:150 supabaseAdmin.from('account_entities').select('memo').eq('id', masterId).single()
src/app/actions/duplicates.ts:152 supabaseAdmin.from('account_entities').update({ memo: newMemo }).eq('id', masterId)
src/app/actions/duplicates.ts:156 supabaseAdmin.from('account_entities').delete().eq('id', slaveId)
src/app/actions/duplicates.ts:187 supabaseAdmin.from('account_entities').select('tags').eq('id', id).single()
src/app/actions/duplicates.ts:191 supabaseAdmin.from('account_entities').update({ tags }).eq('id', id)
src/app/actions/financial.ts:27 supabase .from('unit_types') .select('*') .eq('is_active', true) .order('area_sqm', { ascending: true })
src/app/actions/financial.ts:60 supabase.from('unit_types').update(payload).eq('id', unitType.id)
src/app/actions/financial.ts:63 supabase.from('unit_types').insert(payload)
src/app/actions/financial.ts:72 supabase.from('unit_types').update({ is_active: false }).eq('id', id)
src/app/actions/financial.ts:91 supabase .from('deposit_accounts') .select('*') .eq('is_active', true) .order('account_type', { ascending: true })
src/app/actions/financial.ts:118 supabase.from('deposit_accounts').update(payload).eq('id', account.id)
src/app/actions/financial.ts:121 supabase.from('deposit_accounts').insert(payload)
src/app/actions/financial.ts:130 supabase.from('deposit_accounts').update({ is_active: false }).eq('id', id)
src/app/actions/financial.ts:154 supabase .from('member_payments') .select('*') .in('entity_id', entityIds) .order('sort_order', { ascending: true })
src/app/actions/financial.ts:186 supabase.from('member_payments').update(payload).eq('id', payment.id)
src/app/actions/financial.ts:189 supabase.from('member_payments').insert(payload)
src/app/actions/financial.ts:198 supabase.from('member_payments').delete().eq('id', id)
src/app/actions/financial.ts:211 supabase .from('unit_types') .select('*') .eq('id', unitTypeId) .single()
src/app/actions/financial.ts:220 supabase .from('member_payments') .delete() .eq('entity_id', entityId) .in('payment_type', ['certificate', 'contract', 'installment_1', 'installment_2', 'balance'])
src/app/actions/financial.ts:280 supabase.from('member_payments').insert(paymentLines)
src/app/actions/financial.ts:302 supabase .from('member_payments') .select('payment_type, amount_due, amount_paid, is_contribution, unit_type_id, deposit_account_id')
src/app/actions/financial.ts:306 supabase.from('unit_types').select('id, name').eq('is_active', true)
src/app/actions/financial.ts:307 supabase.from('deposit_accounts').select('id, account_name').eq('is_active', true)
src/app/actions/interaction.ts:37 supabase.from('interaction_logs').insert({ entity_id: memberId, type, direction, summary, staff_name: staffName, })
src/app/actions/interaction.ts:70 supabase.from('interaction_logs').insert({ entity_id: memberId, type: 'DOC', direction: 'Inbound', summary, staff_name: 'System', })
src/app/actions/interaction.ts:109 Array.from( new Set( newlyChangedRightNumbers .map((value) => normalizeCertificateNumber(value)) .filter(Boolean), ), )
src/app/actions/interaction.ts:121 supabase .from('certificate_registry') .select('entity_id, certificate_number_raw, certificate_number_normalized') .eq('is_active', true) .in('certificate_number_normalized', normalizedChangedNumbers)
src/app/actions/interaction.ts:132 Array.from(new Set(allSameRights.map((row) => row.entity_id).filter(Boolean)))
src/app/actions/interaction.ts:133 supabase .from('account_entities') .select('id, display_name') .in('id', entityIds)
src/app/actions/interaction.ts:144 Array.from( new Set(conflictingRights.map((c) => c.certificate_number_normalized || '').filter(Boolean)), )
src/app/actions/interaction.ts:163 Array.from(new Set(matchingRows.map(c => c.entity_id)))
src/app/actions/interaction.ts:171 supabase.from('account_entities').select('memo').eq('id', currentId).single()
src/app/actions/interaction.ts:175 supabase.from('account_entities').update({ memo: newMemo }).eq('id', currentId)
src/app/actions/interaction.ts:189 supabase.from('account_entities').select('memo').eq('id', otherId).single()
src/app/actions/interaction.ts:193 supabase.from('account_entities').update({ memo: newMemo }).eq('id', otherId)
src/app/actions/member.ts:45 supabase .from('account_entities') .update({ display_name: name, member_number, phone, phone_secondary: secondary_phone, unit_group, memo, }) .eq('id', id)
src/app/actions/member.ts:69 supabase .from('membership_roles') .update(roleUpdate) .eq('entity_id', id)
src/app/actions/member.ts:116 Array.from(new Set( (entityIds || []) .map(id => (typeof id === 'string' ? id.trim() : '')) .filter(Boolean) ))
src/app/actions/member.ts:127 supabase .from(table) .select('*', { count: 'exact', head: true }) .in(column, targetIds)
src/app/actions/member.ts:154 supabase.from('account_entities').select('id, display_name').in('id', targetIds)
src/app/actions/member.ts:177 supabase .from('account_entities') .delete() .in('id', targetIds)
src/app/actions/members.ts:36 supabase .from('account_entities') .select('id, display_name, address_legal, phone, phone_secondary') .or(`display_name.ilike.%${cleanQuery}%,address_legal.ilike.%${cleanQuery}%,phone.ilike.%${cleanQuery}%,phone_secondary.ilike.%${cleanQuery}%`) .limit(10)
src/app/actions/members.ts:41 supabase .from('asset_rights') .select(` entity_id, right_type, right_number, right_number_raw, right_number_status, account_entities ( id, display_name, address_legal, phone, phone_secondary ) `) .eq('right_type', 'certificate') .or(`right_number.ilike.%${cleanQuery}%,right_number_raw.ilike.%${cleanQuery}%`) .limit(10)
src/app/actions/members.ts:104 Array.from(resultMap.values()) .map((row) => ({ id: row.id, name: row.name, member_number: row.member_number, certificate_display: getCertificateDisplayText(row.rights, { includeFallbackStatus: true }), phone: row.phone, status: row.status, address: row.address, })) .slice(0, 10)
src/app/actions/members.ts:120 supabase .from('account_entities') .update({ is_favorite: isFavorite }) .eq('id', memberId)
src/app/api/accounting/compat-history/route.ts:67 supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'accounting_compat_check') .eq('action', 'run') .order('created_at', { ascending: false }) .limit(limit)
src/app/api/accounting/compat-ready/route.ts:127 supabase.from('party_profiles').select('id')
src/app/api/accounting/compat-ready/route.ts:128 supabase.from('account_entities').select('id, source_party_id')
src/app/api/accounting/compat-ready/route.ts:129 supabase.from('membership_roles').select('role_code, role_status').eq('role_status', 'active')
src/app/api/accounting/compat-ready/route.ts:130 supabase.from('v_member_roles_compat').select('entity_id, role_code, role_status').eq('role_status', 'active')
src/app/api/accounting/compat-ready/route.ts:131 supabase.from('asset_rights').select('entity_id, certificate_number, status')
src/app/api/accounting/compat-ready/route.ts:132 supabase.from('v_right_certificates_compat').select('entity_id, certificate_number, status')
src/app/api/accounting/compat-ready/route.ts:308 supabase .from('audit_logs') .insert({ entity_type: 'accounting_compat_check', entity_id: null, action: 'run', actor: user.id, reason: '회계 호환 전환 준비 점검', metadata: { generated_at: payload.generated_at, overall: payload.overall, summary: payload.summary, checks: payload.checks, guard: payload.guard, recommendation: payload.recommendation, config: payload.config, }, }) .select('id') .maybeSingle()
src/app/api/admin/sync-legacy/route.ts:43 supabase .from('asset_rights') .select('id, entity_id, meta') .not('entity_id', 'is', null) .order('id', { ascending: true })
src/app/api/admin/sync-legacy/route.ts:118 updates.push( supabase.from('account_entities').update(payload).eq('id', memberId) )
src/app/api/admin/sync-legacy/route.ts:136 Array.from(new Set(logs.map((item) => item.memberId)))
src/app/api/admin/sync-legacy/route.ts:137 supabase .from('account_entities') .select('id, display_name, phone') .in('id', memberIds)
src/app/api/certificates/analysis/route.ts:17 supabase .from('vw_certificate_grand_stats') .select('*') .maybeSingle()
src/app/api/certificates/analysis/route.ts:39 supabase .from('vw_certificate_registered_detail') .select('*') .order('certificate_count', { ascending: false }) .order('display_name', { ascending: true })
src/app/api/certificates/analysis/route.ts:50 supabase .from('vw_certificate_others_detail') .select('*') .order('certificate_count', { ascending: false }) .order('display_name', { ascending: true })
src/app/api/certificates/analysis/route.ts:61 supabase .from('vw_certificate_shared_holders') .select('*') .order('holder_count', { ascending: false })
src/app/api/finance/certificate-audit/legacy-exclusive-export/route.ts:43 supabase .from('asset_rights') .select(` id, right_number, right_number_raw, right_number_status, status, meta, entity_id, account_entities ( id, display_name, phone ) `)
src/app/api/finance/certificate-audit/legacy-exclusive-export/route.ts:59 supabase .from('membership_roles') .select('entity_id, role_code, is_registered')
src/app/api/finance/rights-details/export/route.ts:109 supabase .from('asset_rights') .select(` id, right_number, right_number_raw, right_number_status, principal_amount, status, meta, entity_id, account_entities ( id, display_name, phone ) `)
src/app/api/finance/rights-details/export/route.ts:126 supabase .from('membership_roles') .select('entity_id, role_code, is_registered')
src/app/api/financial/migrate/route.ts:31 supabase.from('unit_types').select('id').limit(1)
src/app/api/financial/migrate/route.ts:38 supabase.from('unit_types').select('id').limit(1)
src/app/api/financial/migrate/route.ts:41 supabase.from('unit_types').insert([ { name: '59 Type', area_sqm: 59, total_contribution: 750000000, first_sale_price: 750000000, second_sale_price: 1000000000, general_sale_price: 1100000000, certificate_amount: 30000000, contract_amount: 20000000, installment_1_amount: 50000000, installment_2_amount: 60000000, balance_amount: 0 }, { name: '73 Type', area_sqm: 73, total_contribution: 925000000, first_sale_price: 925000000, second_sale_price: 1325000000, general_sale_price: 1475000000, certificate_amount: 30000000, contract_amount: 20000000, installment_1_amount: 50000000, installment_2_amount: 60000000, balance_amount: 20000000 }, { name: '84 Type', area_sqm: 84, total_contribution: 999000000, first_sale_price: 999000000, second_sale_price: 1399000000, general_sale_price: 1549000000, certificate_amount: 30000000, contract_amount: 20000000, installment_1_amount: 50000000, installment_2_amount: 60000000, balance_amount: 40000000 }, ])
src/app/api/financial/migrate/route.ts:53 supabase.from('deposit_accounts').select('id').limit(1)
src/app/api/financial/migrate/route.ts:59 supabase.from('deposit_accounts').select('id').limit(1)
src/app/api/financial/migrate/route.ts:61 supabase.from('deposit_accounts').insert([ { account_name: '조합 주거래계좌', bank_name: '국민은행', account_type: 'union', is_official: true }, { account_name: '신탁계좌 1', bank_name: '한국토지신탁', account_type: 'trust', is_official: true }, { account_name: '신탁계좌 2', bank_name: '코리아신탁', account_type: 'trust', is_official: true }, { account_name: '전 조합장 계좌', bank_name: '우리은행', account_type: 'external', is_official: false }, { account_name: '기타 인정 계좌 1', bank_name: '신한은행', account_type: 'recognized', is_official: false }, { account_name: '기타 인정 계좌 2', bank_name: '하나은행', account_type: 'recognized', is_official: false }, ])
src/app/api/financial/migrate/route.ts:76 supabase.from('member_payments').select('id').limit(1)
src/app/api/integrations/ledger/members/route.ts:21 Array.from(new Set( ledgerPeople.filter((person) => !person.birth_date).flatMap((person) => person.entity_ids), ))
src/app/api/integrations/ledger/members/route.ts:25 Array.from(new Set(ledgerPeople.flatMap((person) => person.entity_ids)))
src/app/api/integrations/ledger/members/route.ts:35 createAdminClient() .from('member_bank_accounts') .select('entity_id, bank_name, account_number, account_holder, purpose, updated_at') .in('entity_id', allEntityIds)
src/app/api/integrations/ledger/members/route.ts:44 createAdminClient() .from('entity_private_info') .select('entity_id, resident_registration_number') .in('entity_id', missingBirthEntityIds)
src/app/api/integrations/ledger/members/[peopleonId]/journal/route.ts:24 Array.from(new Set((person.entity_ids || []).filter(Boolean)))
src/app/api/integrations/ledger/members/[peopleonId]/journal/route.ts:28 supabase.from('account_entities').select('id, memo').in('id', entityIds)
src/app/api/integrations/ledger/members/[peopleonId]/journal/route.ts:31 supabase .from('interaction_logs') .select('id, entity_id, type, direction, summary, staff_name, created_at') .in('entity_id', entityIds) .order('created_at', { ascending: false })
src/app/api/integrations/ledger/members/[peopleonId]/supply-type/route.ts:35 Array.from(new Set((person.entity_ids || []).filter(Boolean)))
src/app/api/integrations/ledger/members/[peopleonId]/supply-type/route.ts:41 supabase .from('account_entities') .update({ unit_group: supplyType }) .in('id', entityIds) .select('id, unit_group')
src/app/api/members/bulk-upload/route.ts:29 supabase .from('account_entities') .insert({ display_name: m.name, phone: m.phone || null, member_number: m.member_number || null, unit_group: m.unit_group || null, address_legal: m.address_legal || null, memo: m.memo || null, entity_type: 'person', status: '정상' }) .select('id') .single()
src/app/api/members/bulk-upload/route.ts:52 supabase .from('asset_rights') .insert({ entity_id: entity.id, right_number: classifiedRight.confirmedNumber, right_number_raw: classifiedRight.rawValue, right_number_status: classifiedRight.status, right_number_note: classifiedRight.note, classification_source: 'auto', classified_at: new Date().toISOString(), right_type: 'certificate' })
src/app/api/members/bulk-upload/route.ts:71 supabase .from('membership_roles') .insert({ entity_id: entity.id, role_code: roleCode, role_status: 'active', is_registered: roleCode === '등기조합원' })
src/app/api/members/create/route.ts:36 supabase .from('account_entities') .insert({ display_name: name, phone: formatPhone(phone), phone_secondary: formatPhone(secondary_phone), member_number: member_number || null, unit_group: unit_group || null, address_legal: address_legal || null, memo: memo || null, birth_date: birth_date || null, entity_type: 'person', status: '정상' }) .select('id') .single()
src/app/api/members/create/route.ts:58 supabase .from('asset_rights') .insert({ entity_id: entity.id, right_number: classifiedRight.confirmedNumber, right_number_raw: classifiedRight.rawValue, right_number_status: classifiedRight.status, right_number_note: classifiedRight.note, classification_source: 'auto', classified_at: new Date().toISOString(), right_type: 'certificate' })
src/app/api/members/create/route.ts:80 supabase .from('membership_roles') .insert({ entity_id: entity.id, role_code: roleCode, role_status: 'active', is_registered: roleCode === '등기조합원' })
src/app/api/members/create/route.ts:94 supabase .from('entity_private_info') .insert({ entity_id: entity.id, resident_registration_number: body.resident_registration_number.trim() })
src/app/api/members/inline-update/route.ts:48 supabase .from('membership_roles') .update({ role_status: 'inactive' }) .in('entity_id', roleEntityIds) .in('role_code', MEMBER_CATEGORY_CODES)
src/app/api/members/inline-update/route.ts:56 supabase .from('membership_roles') .select('id') .eq('entity_id', entityId) .eq('role_code', nextCategory.roleCode)
src/app/api/members/inline-update/route.ts:64 supabase .from('membership_roles') .update({ role_status: 'active', is_registered: nextCategory.isRegistered }) .in('id', existingRows.map((row) => row.id))
src/app/api/members/inline-update/route.ts:70 supabase.from('membership_roles').insert({ entity_id: entityId, role_code: nextCategory.roleCode, role_status: 'active', is_registered: nextCategory.isRegistered, })
src/app/api/members/inline-update/route.ts:86 supabase .from('membership_roles') .update({ role_code: value }) .eq('entity_id', id)
src/app/api/members/inline-update/route.ts:98 supabase .from('account_entities') .update({ status: value }) .in('id', targetIds)
src/app/api/members/inline-update/route.ts:142 supabase .from('membership_roles') .update({ role_status: 'inactive' }) .in('entity_id', roleEntityIds) .in('role_code', dbCodes) .select('id')
src/app/api/members/inline-update/route.ts:151 supabase .from('membership_roles') .insert(roleEntityIds.map((eid: string) => ({ entity_id: eid, role_code: insertCode, role_status: 'inactive', is_registered: insertCode === '1차' || insertCode === '등기조합원' })))
src/app/api/members/inline-update/route.ts:163 supabase .from('membership_roles') .update({ role_status: 'active' }) .in('entity_id', roleEntityIds) .in('role_code', dbCodes) .select('id')
src/app/api/members/inline-update/route.ts:171 supabase .from('membership_roles') .insert(roleEntityIds.map((eid: string) => ({ entity_id: eid, role_code: insertCode, role_status: 'active', is_registered: insertCode === '1차' || insertCode === '등기조합원' })))
src/app/api/members/roster-sync/route.ts:38 supabase .from('membership_roles') .select('id,entity_id') .eq('is_registered', true)
src/app/api/members/roster-sync/route.ts:50 supabase .from('account_entities').select('id,display_name,status,unit_group').in('id', entityIds)
src/app/api/members/roster-sync/route.ts:119 supabase.from('account_entities').update({ unit_group: row.unitGroup, status: '정상' }).eq('id', row.entityId)
src/app/api/members/roster-sync/route.ts:122 supabase.from('account_entities').update({ status: '환불조합원' }).in('id', refundIds)
src/app/api/members/roster-sync/route.ts:125 supabase.from('membership_roles').update({ role_code: '등기조합원', role_status: 'active', is_registered: true }).in('entity_id', registeredIds).in('role_code', [...MEMBER_ROLE_CODES])
src/app/api/members/roster-sync/route.ts:127 supabase.from('membership_roles').update({ role_code: '권리증환불', role_status: 'active', is_registered: false }).in('entity_id', refundIds).in('role_code', [...MEMBER_ROLE_CODES])
src/app/api/members/table/route.ts:23 supabase .from('interaction_logs') .select('entity_id') .ilike('summary', `%${query}%`) .limit(LOG_SEARCH_RESULT_LIMIT)
src/app/api/members/update/route.ts:46 supabase .from('account_entities') .update(patch) .in('id', targetIds)
src/app/api/members/update/route.ts:58 supabase .from('membership_roles') .update({ role_code: body.role_code }) .in('entity_id', targetIds)
src/app/api/members/[id]/bank-account/route.ts:24 createAdminClient() .from('member_bank_accounts') .select('bank_name, account_number, account_holder, purpose, updated_at') .eq('entity_id', memberId) .maybeSingle()
src/app/api/members/[id]/bank-account/route.ts:56 supabase .from('account_entities') .select('id, display_name') .eq('id', memberId) .maybeSingle()
src/app/api/members/[id]/bank-account/route.ts:69 supabase .from('member_bank_accounts') .select('bank_name, account_number, account_holder, purpose, created_by') .eq('entity_id', memberId) .maybeSingle()
src/app/api/members/[id]/bank-account/route.ts:75 supabase .from('member_bank_accounts') .upsert({ entity_id: memberId, bank_name: bankName, account_number: accountNumber, account_holder: accountHolder, purpose, created_by: before?.created_by || actorEmail, updated_by: actorEmail, updated_at: new Date().toISOString(), }, { onConflict: 'entity_id' }) .select('bank_name, account_number, account_holder, purpose, updated_at') .single()
src/app/api/members/[id]/bank-account/route.ts:95 supabase.from('system_audit_logs').insert({ actor_email: actorEmail, action_type: before ? 'UPDATE_MEMBER_BANK_ACCOUNT' : 'CREATE_MEMBER_BANK_ACCOUNT', target_entity_id: memberId, details: { bank_name_changed: before?.bank_name !== bankName, account_number_changed: before?.account_number !== accountNumber, account_holder_changed: before?.account_holder !== accountHolder, purpose_changed: before?.purpose !== purpose, }, ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown', })
src/app/api/members/[id]/profile-image/route.ts:24 admin.from('account_entities').select('meta').eq('id', id).maybeSingle()
src/app/api/members/[id]/profile-image/route.ts:36 createAdminClient().storage.from(BUCKET).createSignedUrl(path, 60 * 60)
src/app/api/members/[id]/profile-image/route.ts:67 admin.storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: '3600' })
src/app/api/members/[id]/profile-image/route.ts:71 admin.from('account_entities').update({ meta: { ...previousMeta, profile_image_path: path, profile_image_updated_at: updatedAt, profile_image_updated_by: auth.user.id }, }).eq('id', id)
src/app/api/members/[id]/profile-image/route.ts:75 admin.storage.from(BUCKET).remove([path])
src/app/api/members/[id]/profile-image/route.ts:78 admin.storage.from(BUCKET).remove([previousPath])
src/app/api/members/[id]/profile-image/route.ts:81 admin.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
src/app/api/members/[id]/profile-image/route.ts:97 admin.from('account_entities').update({ meta: nextMeta }).eq('id', id)
src/app/api/members/[id]/profile-image/route.ts:99 admin.storage.from(BUCKET).remove([path])
src/app/api/settlement/alerts/history/route.ts:79 supabase .from('audit_logs') .select('id, created_at, actor, reason, metadata') .eq('entity_type', 'settlement_alert') .eq('action', 'create') .order('created_at', { ascending: false }) .limit(limit)
src/app/api/settlement/diagnostics/export/route.ts:87 supabase .from('settlement_cases') .select('id, party_id, case_status, created_at') .order('created_at', { ascending: false })
src/app/api/settlement/diagnostics/export/route.ts:98 Array.from(new Set(settlementCases.map((item) => item.party_id)))
src/app/api/settlement/diagnostics/export/route.ts:102 supabase .from('party_profiles') .select('id, display_name, member_id') .in('id', partyIds)
src/app/api/settlement/diagnostics/export/route.ts:114 supabase .from('settlement_lines') .select('case_id, amount') .in('case_id', caseIds) .eq('line_type', 'final_refund')
src/app/api/settlement/diagnostics/export/route.ts:121 supabase .from('refund_payments') .select('case_id, paid_amount, payment_status') .in('case_id', caseIds)
src/app/api/settlement/diagnostics/export/route.ts:133 Array.from( new Set( parties .map((party) => party.member_id) .filter((memberId): memberId is string => Boolean(memberId)), ), )
src/app/api/settlement/diagnostics/export/route.ts:141 supabase .from('account_entities') .select('id, display_name') .in('id', memberIds)
src/app/api/settlement/ops/status/route.ts:59 supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'qa_report') .eq('action', 'run') .order('created_at', { ascending: false }) .limit(1) .maybeSingle()
src/app/api/settlement/ops/status/route.ts:67 supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'settlement_case_batch') .eq('action', 'sync_case_status') .order('created_at', { ascending: false }) .limit(1) .maybeSingle()
src/app/api/settlement/ops/status/route.ts:75 supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'permission_probe') .eq('action', 'probe') .order('created_at', { ascending: false }) .limit(1) .maybeSingle()
src/app/api/settlement/ops/status/route.ts:83 supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'settlement_case_batch') .eq('action', 'create_missing_cases') .order('created_at', { ascending: false }) .limit(1) .maybeSingle()
src/app/api/settlement/ops/status/route.ts:91 supabase .from('audit_logs') .select('id, created_at, actor, metadata') .eq('entity_type', 'refund_payment') .eq('action', 'create') .order('created_at', { ascending: false }) .limit(1) .maybeSingle()
src/app/api/settlement/qa/history/route.ts:117 supabase .from('audit_logs') .select('id, actor, created_at, metadata') .eq('entity_type', 'qa_report') .eq('action', 'run') .order('created_at', { ascending: false }) .limit(limit)
src/app/api/sms/send/route.ts:90 supabase.from('interaction_logs').insert(rows)
src/app/debug/page.tsx:19 supabase.from('account_entities').select('*', { count: 'exact', head: true })
src/components/features/finance/LegacyRecordDetailDialog.tsx:67 supabase .from('asset_rights') .select('*') .eq('id', id) .single()
src/components/features/members/ActivityTimelineTab.tsx:70 supabase .from('interaction_logs') .select('*', { count: 'exact', head: true }) .in('entity_id', memberIds)
src/components/features/members/ActivityTimelineTab.tsx:84 supabase .from('interaction_logs') .select('*') .in('entity_id', memberIds) .order('created_at', { ascending: false }) .range(from, to)
src/components/features/members/memberDetailDialogFetch.ts:50 supabase .from('account_entities') .select('*') .in('id', ids)
src/components/features/members/memberDetailDialogFetch.ts:62 supabase.from('membership_roles').select('role_code, role_status, is_registered').in('entity_id', ids)
src/components/features/members/memberDetailDialogFetch.ts:63 supabase .from('entity_relationships') .select('from_entity_id, to_entity_id, relation_type, relation_note, agent_entity:account_entities!from_entity_id(display_name, phone)') .in('to_entity_id', ids) .eq('relation_type', 'agent')
src/components/features/members/memberDetailDialogFetch.ts:68 supabase .from('entity_relationships') .select('from_entity_id, to_entity_id, relation_type, relation_note, owner_entity:account_entities!to_entity_id(display_name, phone)') .in('from_entity_id', ids) .eq('relation_type', 'agent')
src/components/features/members/memberDetailDialogFetch.ts:73 supabase .from('certificate_registry') .select('*') .in('entity_id', ids) .eq('is_active', true) .order('created_at', { ascending: true })
src/components/features/members/memberDetailDialogFetch.ts:79 supabase.from('entity_private_info').select('entity_id, resident_registration_number').in('entity_id', ids)
src/components/features/members/memberDetailDialogFetch.ts:83 Array.from(new Map(relRes.data.map((relation) => [relation.from_entity_id, relation])).values())
src/components/features/members/memberDetailDialogFetch.ts:100 Array.from( new Set( rolesData .map((role) => normalizeTierLabel(role.role_code, role.is_registered)) .filter(Boolean), ), )
src/components/features/members/memberDetailDialogMutations.ts:30 supabase.from('certificate_registry').insert({ entity_id: member.id, certificate_number_normalized: classifiedRight.confirmedNumber, certificate_number_raw: classifiedRight.rawValue, certificate_status: classifiedRight.status, note: JSON.stringify({ manual_add: true }), is_active: true, source_type: 'manual', })
src/components/features/members/memberDetailDialogUtils.ts:156 Array.from(managedNumbers.values())
src/components/features/members/MemberExportExcel.ts:65 Array.from(new Set(labels)).join(', ')
src/components/features/members/MemberExportExcel.ts:90 Array.from(new Set(items)).join(', ')
src/components/features/members/MembersCertificateAnalysisCard.tsx:122 Array.from(grouped.values()).sort((left, right) => left.number.localeCompare(right.number, 'ko-KR'))
src/components/features/members/MembersPageSections.tsx:113 Array.from({ length: Math.min(5, totalPages) }, (_, index) => { const targetPage = Math.max(1, Math.min(totalPages - 4, normalizedPage - 2)) + index; if (targetPage < 1 || targetPage > totalPages) return null; return ( <Link key={targetPage} href={getPageLink(targetPage)} className={`flex size-7 items-center justify-center rounded border text-xs font-bold ${targetPage === normalizedPage ? 'border-primary bg-primary/10 text-primary' : 'border-white/[0.08] bg-[#161B22] text-gray-400'}`}> {targetPage} </Link> ); })
src/components/features/members/MembersTableSectionHelpers.tsx:56 Array.from(new Set([...roles, rawStatus].filter((value): value is string => Boolean(value))))
src/components/features/members/MemberWorkspacePage.tsx:142 supabase.from('member_payments').select('*').in('entity_id', memberIds).order('sort_order')
src/components/features/members/MemberWorkspacePage.tsx:143 supabase.from('interaction_logs').select('id,type,summary,staff_name,attachment,created_at').in('entity_id', memberIds).order('created_at', { ascending: false }).limit(30)
src/components/features/members/memberWorkspacePresets.ts:42 Array.from(new Set(value.split(',').filter((column): column is MemberWorkspaceColumnId => valid.has(column as MemberWorkspaceColumnId))))
src/components/features/members/PaymentStatusTab.tsx:66 supabase.from('member_payments').select('*').in('entity_id', memberIds).order('sort_order', { ascending: true })
src/components/features/members/PaymentStatusTab.tsx:67 supabase.from('unit_types').select('*').eq('is_active', true).order('area_sqm', { ascending: true })
src/components/features/members/PaymentStatusTab.tsx:68 supabase.from('deposit_accounts').select('*').eq('is_active', true).order('account_type', { ascending: true })
src/components/features/members/PaymentStatusTab.tsx:75 supabase.from('member_payments').insert(missingUnionFeeLines)
src/components/features/members/PaymentStatusTab.tsx:77 supabase .from('member_payments') .select('*') .in('entity_id', memberIds) .order('sort_order', { ascending: true })
src/components/features/members/PaymentStatusTab.tsx:138 supabase .from('member_payments') .delete() .in('entity_id', memberIds) .in('payment_type', ['certificate', 'contract', 'installment_1', 'installment_2', 'balance'])
src/components/features/members/PaymentStatusTab.tsx:144 supabase .from('member_payments') .delete() .in('entity_id', memberIds) .eq('payment_type', 'other') .eq('receipt_note', SYSTEM_UNION_FEE_NOTE)
src/components/features/members/PaymentStatusTab.tsx:152 supabase.from('member_payments').insert(lines)
src/components/features/members/PaymentStatusTab.tsx:164 supabase.from('member_payments').insert(lines)
src/components/features/members/PaymentStatusTab.tsx:189 supabase.from('member_payments').update({ amount_paid: amountPaid, deposit_account_id: editForm.deposit_account_id || null, paid_date: editForm.paid_date || null, receipt_note: editForm.receipt_note || null, status, }).eq('id', editingId)
src/components/features/members/PaymentStatusTab.tsx:211 supabase.from('member_payments').delete().eq('id', id)
src/components/features/settings/DepositAccountsSection.tsx:35 supabase.from('deposit_accounts').select('*').eq('is_active', true).order('account_type')
src/components/features/settings/DepositAccountsSection.tsx:71 supabase.from('deposit_accounts').insert(payload)
src/components/features/settings/DepositAccountsSection.tsx:73 supabase.from('deposit_accounts').update(payload).eq('id', editingId)
src/components/features/settings/DepositAccountsSection.tsx:84 supabase.from('deposit_accounts').update({ is_active: false }).eq('id', id)
src/components/features/settings/UnitTypesSection.tsx:34 supabase.from('unit_types').select('*').eq('is_active', true).order('area_sqm')
src/components/features/settings/UnitTypesSection.tsx:70 supabase.from('unit_types').insert(payload)
src/components/features/settings/UnitTypesSection.tsx:72 supabase.from('unit_types').update(payload).eq('id', editingId)
src/components/features/settings/UnitTypesSection.tsx:83 supabase.from('unit_types').update({ is_active: false }).eq('id', id)
src/components/features/sms/bulkSmsWorkspaceUtils.ts:56 Array.from(new Set(recipients.map((item) => item.tier).filter(Boolean) as string[]))
src/components/features/sms/bulkSmsWorkspaceUtils.ts:57 Array.from(new Set(recipients.map((item) => item.status).filter(Boolean) as string[]))
src/lib/certificates/rightNumbersSelectors.ts:5 Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))))
src/lib/certificates/rightNumbersSelectors.ts:24 Array.from(deduped.values())
src/lib/members/membersPageUtils.ts:231 Array.from(new Set(allRelations.filter(Boolean) as string[])).sort()
src/lib/payments/systemUnionFee.ts:61 Array.from(structuredTargets.entries())
src/lib/server/accountingDomainSync.ts:78 supabase .from('party_profiles') .select('id') .eq('member_id', member.id) .maybeSingle()
src/lib/server/accountingDomainSync.ts:93 supabase .from('account_entities') .upsert( { source_party_id: partyRef.id, entity_type: 'person', display_name: displayName, phone, meta: { source: 'members_action_sync', source_member_id: member.id, }, }, { onConflict: 'source_party_id' }, ) .select('id') .maybeSingle()
src/lib/server/accountingDomainSync.ts:118 supabase .from('account_entities') .select('id, meta') .contains('meta', { source_member_id: member.id }) .limit(1)
src/lib/server/accountingDomainSync.ts:135 supabase .from('account_entities') .update({ display_name: displayName, phone, meta: mergedMeta, }) .eq('id', existing.id)
src/lib/server/accountingDomainSync.ts:151 supabase .from('account_entities') .insert({ entity_type: 'person', display_name: displayName, phone, meta: { source: 'members_action_sync', source_member_id: member.id, }, }) .select('id') .maybeSingle()
src/lib/server/accountingDomainSync.ts:191 supabase .from('membership_roles') .upsert( { entity_id: entityId, source_member_id: member.id, role_code: roleCode, role_status: roleStatus, is_registered: normalizedRegistered, note: 'sync:members_action', }, { onConflict: 'entity_id,role_code,role_status' }, )
src/lib/server/activityFeed.ts:122 supabase .from('interaction_logs') .select('id, entity_id, type, direction, summary, staff_name, created_at') .in('entity_id', entityIdChunk) .order('created_at', { ascending: false })
src/lib/server/activityFeed.ts:156 supabase .from('vw_latest_interaction_log_by_entity') .select('id, entity_id, type, direction, summary, staff_name, created_at') .in('entity_id', entityIdChunk)
src/lib/server/activityFeed.ts:186 supabase .from('interaction_logs') .select('id, entity_id, type, direction, summary, staff_name, created_at') .order('created_at', { ascending: false }) .limit(limit)
src/lib/server/activityFeed.ts:197 Array.from(new Set(logs.map((log) => log.entity_id).filter(Boolean)))
src/lib/server/activityFeed.ts:201 supabase .from('account_entities') .select('id, display_name, phone') .in('id', entityIds)
src/lib/server/activityFeed.ts:246 Array.from(entityToPersonIds.keys())
src/lib/server/activityFeed.ts:260 supabase .from('interaction_logs') .select('id, entity_id, type, direction, summary, staff_name, created_at') .in('entity_id', entityIdChunk) .order('created_at', { ascending: false })
src/lib/server/apiKeyAuth.ts:36 Buffer.from(left)
src/lib/server/apiKeyAuth.ts:37 Buffer.from(right)
src/lib/server/certificateAuditDerivedMetrics.ts:149 Array.from( new Set( segmentScopedRecords .map((record) => record.member_id) .filter((memberId): memberId is string => Boolean(memberId)), ), )
src/lib/server/certificateAuditQuality.ts:45 supabase .from('party_profiles') .select('id, member_id') .in('member_id', memberIdsFromLegacy)
src/lib/server/certificateAuditQuality.ts:78 supabase .from('settlement_cases') .select('id, party_id, case_status, created_at') .in('party_id', memberPartyIds) .order('created_at', { ascending: false })
src/lib/server/certificateAuditQuality.ts:94 Array.from(latestCaseByParty.values()).map((item) => item.id)
src/lib/server/certificateAuditQuality.ts:97 supabase .from('settlement_lines') .select('case_id, amount') .in('case_id', latestCaseIds) .eq('line_type', 'final_refund')
src/lib/server/certificateAuditQuality.ts:102 supabase .from('refund_payments') .select('case_id, paid_amount, payment_status') .in('case_id', latestCaseIds)
src/lib/server/certificateCompat.ts:21 Array.from(new Set((values || []).filter((value): value is string => Boolean(value && value.trim()))))
src/lib/server/certificateCompat.ts:42 supabase .from('account_entities') .select('id, source_party_id') .in('source_party_id', holderPartyIds)
src/lib/server/certificateCompat.ts:53 supabase .from('v_right_certificates_compat') .select('certificate_number, status, entity_id')
src/lib/server/certificateCompat.ts:71 supabase .from('account_entities') .select('id, source_party_id') .in('id', entityIds)
src/lib/server/certificateCompat.ts:102 supabase .from('asset_rights') .select('right_number, status, entity_id')
src/lib/server/certificateCompat.ts:122 supabase .from('account_entities') .select('id, source_party_id') .in('id', entityIds)
src/lib/server/dashboardOverview.ts:203 supabase .from('vw_dashboard_payment_total_summary') .select('total_due, total_paid') .single()
src/lib/server/dashboardOverview.ts:207 supabase .from('vw_dashboard_payment_step_summary') .select('bucket, due, paid')
src/lib/server/dashboardOverview.ts:222 supabase .from('vw_member_payment_financial_total_summary') .select('payment_count, contribution_due, contribution_paid, certificate_paid, premium_recognized_paid') .single()
src/lib/server/dashboardOverview.ts:226 supabase .from('vw_member_payment_type_summary') .select('payment_type, due, paid')
src/lib/server/dashboardOverview.ts:229 supabase .from('vw_member_payment_unit_type_summary') .select('unit_type_name, due, paid, count')
src/lib/server/dashboardOverview.ts:232 supabase .from('vw_member_payment_account_summary') .select('account_name, account_type, total')
src/lib/server/dashboardOverview.ts:248 supabase.from('payments').select('amount_due, amount_paid, step')
src/lib/server/dashboardOverview.ts:263 supabase .from('member_payments') .select('payment_type, amount_due, amount_paid, is_contribution, unit_type_id, deposit_account_id')
src/lib/server/dashboardOverview.ts:266 supabase.from('unit_types').select('id, name').eq('is_active', true)
src/lib/server/dashboardOverview.ts:267 supabase.from('deposit_accounts').select('id, account_name, account_type').eq('is_active', true)
src/lib/server/dashboardOverview.ts:309 supabase .from('membership_roles') .select('entity_id') .eq('is_registered', true) .gte('created_at', thirtyDaysAgo.toISOString())
src/lib/server/dashboardOverview.ts:316 supabase .from('payments') .select('id, paid_date, step_name, step, amount_paid, account_entities(display_name)') .not('paid_date', 'is', null) .order('paid_date', { ascending: false }) .limit(3)
src/lib/server/dashboardOverview.ts:322 supabase .from('account_entities') .select('id, display_name, created_at, unit_group') .order('created_at', { ascending: false }) .limit(3)
src/lib/server/dashboardOverview.ts:327 supabase .from('account_entities') .select('id, display_name, member_number, tier, status, is_favorite') .eq('is_favorite', true) .order('display_name', { ascending: true }) .limit(10)
src/lib/server/memberUpdateBasicUtils.ts:70 supabase .from('account_entities') .select('id, meta') .in('id', targetIds)
src/lib/server/memberUpdateBasicUtils.ts:79 supabase .from('account_entities') .update({ meta: { ...currentMeta, preferred_unit_type: normalizedValue } }) .eq('id', entity.id)
src/lib/server/memberUpdateBasicUtils.ts:122 supabase .from('account_entities') .update(repPatch) .eq('id', rep.id)
src/lib/server/memberUpdateBasicUtils.ts:130 supabase .from('entity_relationships') .update({ relation_note: repRelation }) .eq('from_entity_id', rep.id) .in('to_entity_id', targetIds) .eq('relation_type', 'agent')
src/lib/server/memberUpdateBasicUtils.ts:140 supabase .from('account_entities') .insert({ entity_type: 'person', display_name: repName || '새 대리인', phone: repPhone, }) .select('id') .single()
src/lib/server/memberUpdateBasicUtils.ts:155 supabase.from('entity_relationships').insert({ from_entity_id: newAgent.id, to_entity_id: targetId, relation_type: 'agent', relation_note: repRelation || '대리인', })
src/lib/server/memberUpdateBasicUtils.ts:171 supabase .from('entity_relationships') .delete() .in('to_entity_id', targetIds) .eq('relation_type', 'agent') .not('from_entity_id', 'in', `(${activeAgentIds.join(',')})`)
src/lib/server/memberUpdateBasicUtils.ts:179 supabase .from('entity_relationships') .delete() .in('to_entity_id', targetIds) .eq('relation_type', 'agent')
src/lib/server/memberUpdateBasicUtils.ts:202 supabase .from('entity_private_info') .upsert( { entity_id: targetId, resident_registration_number: ssn, updated_at: new Date().toISOString(), }, { onConflict: 'entity_id' }, )
src/lib/server/memberUpdateCertificateUtils.ts:45 supabase .from('certificate_registry') .select('id, note') .in('id', body.deleted_rights_ids)
src/lib/server/memberUpdateCertificateUtils.ts:59 supabase .from('certificate_registry') .select('id, note') .in('entity_id', targetIds) .eq('is_active', true)
src/lib/server/memberUpdateCertificateUtils.ts:84 supabase .from('certificate_registry') .update({ note: nextNote }) .eq('id', right.id)
src/lib/server/memberUpdateCertificateUtils.ts:96 supabase .from('certificate_registry') .update({ is_active: false }) .in('id', body.deleted_rights_ids)
src/lib/server/memberUpdateCertificateUtils.ts:119 supabase .from('certificate_registry') .insert({ entity_id: targetIds[0], certificate_number_raw: target_number, certificate_number_normalized: target_number .replace(/[./]/g, '-') .replace(/\s+/g, '') .toLowerCase(), certificate_status: 'confirmed', source_type: 'manual', is_confirmed_for_count: true, is_active: true, note: JSON.stringify({ node_type: 'derivative', integration_type, merged_at: new Date().toISOString(), merged_by: userId, }), }) .select('id') .single()
src/lib/server/memberUpdateCertificateUtils.ts:149 supabase .from('certificate_registry') .select('note, entity_id') .eq('id', sourceId) .single()
src/lib/server/memberUpdateCertificateUtils.ts:176 supabase .from('certificate_registry') .update({ note: JSON.stringify(updatedMeta) }) .eq('id', sourceId)
src/lib/server/memberUpdateCertificateUtils.ts:192 supabase .from('certificate_registry') .update({ certificate_number_normalized: right.certificate_number_normalized ?? null, certificate_number_raw: right.certificate_number_raw ?? null, certificate_status: right.certificate_status ?? null, note: toCertificateNotePayload(right.note), }) .eq('id', right.id)
src/lib/server/memberUpdateCertificateUtils.ts:253 supabase .from('membership_roles') .select('is_registered, role_status') .eq('entity_id', targetIds[0])
src/lib/server/memberUpdateCertificateUtils.ts:282 supabase .from('person_certificate_summaries') .upsert(summaryPatch, { onConflict: 'entity_id' })
src/lib/server/partyRolesCompat.ts:23 Array.from(new Set((values || []).filter((value): value is string => Boolean(value && value.trim()))))
src/lib/server/partyRolesCompat.ts:62 supabase .from('account_entities') .select('id, source_party_id') .in('source_party_id', partyIds)
src/lib/server/partyRolesCompat.ts:72 supabase .from('account_entities') .select('id, source_party_id') .not('source_party_id', 'is', null)
src/lib/server/partyRolesCompat.ts:90 supabase .from('v_member_roles_compat') .select('entity_id, role_code, role_status')
src/lib/server/partyRolesCompat.ts:129 supabase .from('account_entities') .select('id, source_party_id') .in('source_party_id', partyIds)
src/lib/server/partyRolesCompat.ts:135 supabase .from('account_entities') .select('id, source_party_id') .not('source_party_id', 'is', null)
src/lib/server/partyRolesCompat.ts:151 supabase .from('membership_roles') .select('entity_id, role_code, role_status')
src/lib/server/paymentDashboard.ts:187 supabase .from('vw_member_payment_entity_summary') .select( 'entity_id, payment_count, contribution_due_base, contribution_paid_base, certificate_paid, premium_recognized_paid, union_fee_actual_paid, union_fee_count, structured_count, latest_paid_date, unit_type_names, account_names', ) .in('entity_id', entityIds)
src/lib/server/paymentDashboard.ts:259 Array.from(unitTypeNameSet)
src/lib/server/paymentDashboard.ts:260 Array.from(accountNameSet)
src/lib/server/paymentDashboard.ts:372 Array.from(unitTypeNameSet)
src/lib/server/paymentDashboard.ts:373 Array.from(accountNameSet)
src/lib/server/paymentDashboard.ts:429 Array.from(new Set(unifiedPeople.flatMap((person) => person.entity_ids)))
src/lib/server/paymentDashboard.ts:440 supabase .from('member_payments') .select('id, entity_id, unit_type_id, payment_type, amount_due, amount_paid, deposit_account_id, paid_date, receipt_note, is_contribution, status, sort_order') .in('entity_id', allEntityIds) .order('sort_order', { ascending: true })
src/lib/server/paymentDashboard.ts:446 supabase .from('unit_types') .select('id, name, area_sqm') .eq('is_active', true) .order('area_sqm', { ascending: true })
src/lib/server/paymentDashboard.ts:451 supabase .from('deposit_accounts') .select('id, account_name, account_type') .eq('is_active', true) .order('account_type', { ascending: true })
src/lib/server/paymentDashboard.ts:465 Array.from( new Set(paymentSummaries.map((row) => row.tier).filter((tier): tier is string => Boolean(tier))), ).sort((left, right) => left.localeCompare(right, 'ko-KR'))
src/lib/server/personCertificateSummary.ts:81 supabase .from('vw_person_certificate_summary_current') .select('*') .order('owner_group', { ascending: false }) .order('display_name', { ascending: true })
src/lib/server/personCertificateSummary.ts:86 supabase .from('vw_person_certificate_rollup') .select('*') .order('owner_group', { ascending: false })
src/lib/server/personCertificateSummary.ts:116 supabase .from('vw_person_certificate_rollup') .select( 'owner_group, owner_count, owner_with_certificate_count, provisional_certificate_count, effective_certificate_count, conflict_certificate_count, manual_locked_count, pending_review_count', ) .order('owner_group', { ascending: false })
src/lib/server/residentRegistryImport.ts:120 Array.from(new Set(registeredMembers.flatMap((person) => person.entity_ids)))
src/lib/server/residentRegistryImport.ts:122 supabase .from('entity_private_info') .select('entity_id, resident_registration_number') .in('entity_id', allEntityIds)
src/lib/server/residentRegistryImport.ts:206 supabaseAdmin .from('secure_resident_registry') .select('id') .limit(1)
src/lib/server/residentRegistryImport.ts:236 Array.from(new Set(matchedPreviewRows.flatMap((row) => row.targetEntityIds)))
src/lib/server/residentRegistryImport.ts:237 supabaseAdmin .from('entity_private_info') .select('entity_id, resident_registration_number') .in('entity_id', matchedEntityIds)
src/lib/server/residentRegistryImport.ts:325 supabaseAdmin .from('secure_resident_registry_history') .insert(historyRows)
src/lib/server/residentRegistryImport.ts:332 supabaseAdmin .from('secure_resident_registry') .upsert(secureStoreRows, { onConflict: 'entity_id' })
src/lib/server/residentRegistryImport.ts:339 supabaseAdmin .from('entity_private_info') .upsert(privateUpserts, { onConflict: 'entity_id' })
src/lib/server/settlementAccessProbe.ts:41 supabase.from(check.table).select('id', { head: true, count: 'exact' })
src/lib/server/settlementAccessProbe.ts:51 supabase.from('audit_logs').insert({ entity_type: 'permission_probe', entity_id: null, action: 'probe', actor: user.id, reason: '정산 권한 점검', metadata: { source: 'settlements_ui', checked_at: new Date().toISOString(), }, })
src/lib/server/settlementAccessProbe.ts:72 supabase .from('refund_payments') .insert({ case_id: dummyCaseId, paid_amount: 0, paid_date: new Date().toISOString().slice(0, 10), payment_reference: probeRef, receiver_name: 'probe', payment_status: 'requested', }) .select('id') .maybeSingle()
src/lib/server/settlementAccessProbe.ts:89 supabase.from('refund_payments').delete().eq('id', refundProbeData.id)
src/lib/server/settlementActionUtils.ts:81 supabase.from('audit_logs').insert({ entity_type: entityType, entity_id: entityId, action, actor, reason, metadata: metadata || {}, })
src/lib/server/settlementCaseMaintenance.ts:62 Array.from(candidatePartyIds) .filter((partyId) => !existingCasePartyIds.has(partyId)) .slice(0, limit)
src/lib/server/settlementDashboard.ts:41 supabase .from('settlement_cases') .select('id, party_id, case_status, created_at') .order('created_at', { ascending: false })
src/lib/server/settlementDashboard.ts:69 supabase .from('party_profiles') .select('id, display_name, member_id') .in('id', partyIds)
src/lib/server/settlementDashboard.ts:86 Array.from( new Set( partiesData .map((party) => party.member_id) .filter((memberId): memberId is string => Boolean(memberId)), ), )
src/lib/server/settlementDashboard.ts:95 supabase .from('account_entities') .select('id, display_name') .in('id', memberIds)
src/lib/server/settlementDashboard.ts:112 Array.from(ownershipMap.values()).map((item) => [ item.party_id, { owner_name: item.owner_name, owner_type: item.owner_type }, ])
src/lib/server/settlementDashboard.ts:132 supabase .from('vw_settlement_case_amount_summary') .select('case_id, expected, paid') .in('case_id', caseIds)
src/lib/server/settlementDashboard.ts:147 supabase .from('settlement_lines') .select('case_id, line_type, amount') .in('case_id', caseIds) .eq('line_type', 'final_refund')
src/lib/server/settlementDashboard.ts:152 supabase .from('refund_payments') .select('case_id, paid_amount, payment_status') .in('case_id', caseIds)
src/lib/server/settlementDashboard.ts:204 supabase .from('party_profiles') .select('id') .ilike('display_name', `%${query}%`)
src/lib/server/settlementDashboard.ts:219 Array.from(new Set(matchedCases.map((item) => item.party_id)))
src/lib/server/settlementMissingCases.ts:24 supabase.from('party_profiles').select('id, member_id')
src/lib/server/settlementMissingCases.ts:27 supabase.from('settlement_cases').select('party_id')
src/lib/server/settlementQaReport.ts:98 supabase .from('settlement_cases') .select('id, party_id, case_status, created_at') .order('created_at', { ascending: false })
src/lib/server/settlementQaReport.ts:109 Array.from(new Set(settlementCases.map((item) => item.party_id)))
src/lib/server/settlementQaReport.ts:114 supabase .from('party_profiles') .select('id, display_name, member_id') .in('id', partyIds)
src/lib/server/settlementQaReport.ts:126 supabase .from('settlement_lines') .select('case_id, line_type, amount') .in('case_id', caseIds) .eq('line_type', 'final_refund')
src/lib/server/settlementQaReport.ts:132 supabase .from('refund_payments') .select('id, case_id, paid_amount, payment_status, payment_reference')
src/lib/server/settlementQaReport.ts:142 Array.from( new Set( parties .map((party) => party.member_id) .filter((memberId): memberId is string => Boolean(memberId)), ), )
src/lib/server/settlementQaReport.ts:150 supabase .from('account_entities') .select('id, display_name') .in('id', memberIds)
src/lib/server/settlementQaReport.ts:211 Array.from(refCountMap.values()).filter((count) => count > 1).length
src/lib/server/settlementQaReport.ts:281 supabase .from('audit_logs') .insert({ entity_type: 'qa_report', entity_id: null, action: 'run', actor: userId, reason: '정산 QA 자동 점검 실행', metadata: { generated_at: payload.generated_at, overall: payload.overall, summary: payload.summary, checks: payload.checks, }, }) .select('id') .maybeSingle()
src/lib/server/settlementQaReport.ts:306 supabase .from('audit_logs') .insert({ entity_type: 'settlement_alert', entity_id: payload.audit_id || null, action: 'create', actor: userId, reason: `정산 QA ${payload.overall.toUpperCase()} 감지`, metadata: { qa_audit_id: payload.audit_id || null, overall: payload.overall, issue_count: payload.summary.issue_count, generated_at: payload.generated_at, deep_link: deepLink, summary: payload.summary, }, })
src/lib/server/settlementRefundPayment.ts:40 supabase .from('settlement_cases') .select('id, case_status') .eq('id', caseId) .maybeSingle()
src/lib/server/settlementRefundPayment.ts:54 supabase .from('refund_payments') .select('id', { count: 'exact', head: true }) .eq('case_id', caseId) .eq('payment_reference', paymentReference) .eq('payment_status', 'paid')
src/lib/server/settlementRefundPayment.ts:67 supabase.from('settlement_lines').select('amount').eq('case_id', caseId).eq('line_type', 'final_refund')
src/lib/server/settlementRefundPayment.ts:68 supabase.from('refund_payments').select('paid_amount').eq('case_id', caseId).eq('payment_status', 'paid')
src/lib/server/settlementRefundPayment.ts:89 supabase .from('refund_payments') .insert({ case_id: caseId, paid_amount: paidAmount, paid_date: paidDate, payment_reference: paymentReference || null, receiver_name: receiverName || null, payment_status: 'paid', }) .select('id') .maybeSingle()
src/lib/server/settlementRefundPayment.ts:111 supabase .from('settlement_cases') .update({ case_status: 'paid', updated_at: new Date().toISOString(), }) .eq('id', caseId)
src/lib/server/settlementStatusSync.ts:26 supabase .from('settlement_cases') .select('id, case_status, created_at') .neq('case_status', 'rejected') .order('created_at', { ascending: false }) .limit(limit)
src/lib/server/settlementStatusSync.ts:50 supabase.from('settlement_lines').select('case_id, amount').in('case_id', caseIds).eq('line_type', 'final_refund')
src/lib/server/settlementStatusSync.ts:51 supabase.from('refund_payments').select('case_id, paid_amount, payment_status').in('case_id', caseIds)
src/lib/server/settlementStatusSync.ts:80 supabase .from('settlement_cases') .update({ case_status: 'paid', updated_at: nowIso }) .in('id', chunk)
src/lib/server/settlementStatusSync.ts:93 supabase .from('settlement_cases') .update({ case_status: 'approved', updated_at: nowIso }) .in('id', chunk)
src/lib/server/smsDashboard.ts:174 supabase .from('vw_member_payment_entity_summary') .select('entity_id, total_due, total_paid') .in('entity_id', chunk)
src/lib/server/smsDashboard.ts:204 supabase .from('member_payments') .select('entity_id, amount_due, amount_paid') .in('entity_id', chunk)
src/lib/server/smsDashboard.ts:233 Array.from(new Set(unifiedPeople.flatMap((person) => person.entity_ids)))
src/lib/server/smsDashboard.ts:236 supabase .from('interaction_logs') .select('id, entity_id, summary, staff_name, created_at') .eq('type', 'SMS') .order('created_at', { ascending: false }) .limit(60)
src/services/memberAggregationBuilders.ts:49 Array.from( new Set( entityRoles .filter((role) => role.role_status === 'active') .map((role) => normalizeTierLabel(role.role_code, role.is_registered)) .filter(Boolean), ), )
src/services/memberAggregationBuilders.ts:212 Array.from(roleTypes)
src/services/memberAggregationData.ts:125 supabase .from('vw_latest_settlement_case_by_entity') .select('id, entity_id, case_status, created_at') .order('created_at', { ascending: false })
src/services/memberAggregationData.ts:134 supabase .from('settlement_cases') .select('id, entity_id, case_status, created_at') .order('created_at', { ascending: false })
src/services/memberAggregationData.ts:142 supabase .from('certificate_registry') .select('id, entity_id, certificate_number_normalized, certificate_number_raw, certificate_status, source_type, note, is_active, is_confirmed_for_count, issued_at') .eq('is_active', true)
src/services/memberAggregationData.ts:151 supabase .from('certificate_registry') .select('id, entity_id, certificate_number_normalized, certificate_number_raw, certificate_status, source_type, note, is_active, is_confirmed_for_count, cert_date') .eq('is_active', true)
src/services/memberAggregationData.ts:158 supabase .from('account_entities') .select('id, entity_type, display_name, phone, address_legal, unit_group, memo, is_favorite, tags, status, birth_date')
src/services/memberAggregationData.ts:161 supabase .from('membership_roles') .select('id, entity_id, role_code, role_status, is_registered')
src/services/memberAggregationData.ts:166 supabase .from('entity_relationships') .select('to_entity_id, from_entity_id, relation_type, relation_note, agent_entity:account_entities!from_entity_id(display_name), owner_entity:account_entities!to_entity_id(display_name, phone)') .in('relation_type', ['agent', 'nominee_owner'])
src/services/memberAggregationData.ts:203 supabase .from('account_entities') .select('id, entity_type, display_name, phone, address_legal, unit_group, memo, is_favorite, tags, status, birth_date')
src/services/memberAggregationData.ts:206 supabase .from('membership_roles') .select('id, entity_id, role_code, role_status, is_registered')
src/services/memberAggregationData.ts:239 Array.from(latestCaseByEntity.values()).map((item) => item.id)
src/services/memberAggregationData.ts:248 supabase .from('vw_settlement_case_amount_summary') .select('case_id, expected, paid') .in('case_id', latestCaseIds)
src/services/memberAggregationData.ts:266 supabase .from('settlement_lines') .select('case_id, line_type, amount') .in('case_id', latestCaseIds)
src/services/memberAggregationData.ts:270 supabase .from('refund_payments') .select('case_id, paid_amount, payment_status') .in('case_id', latestCaseIds)
src/services/memberAggregationMerge.ts:79 Array.from(new Set([...(target.tiers || []), ...(person.tiers || [])]))
src/services/memberAggregationMerge.ts:80 Array.from(new Set([...target.role_types, ...person.role_types]))
src/services/memberAggregationMerge.ts:117 Array.from(allPhonesNumeric)
src/services/memberAggregationMerge.ts:122 Array.from(new Set([...target.entity_ids, nameless.id]))
src/services/memberAggregationMerge.ts:123 Array.from(new Set([...(target.tiers || []), ...(nameless.tiers || [])]))
src/services/memberAggregationMerge.ts:124 Array.from(new Set([...target.role_types, ...nameless.role_types]))
src/services/memberAggregationMerge.ts:168 Array.from(new Set([...target.entity_ids, person.id]))
src/services/memberAggregationMerge.ts:169 Array.from(new Set([...(target.tiers || []), ...(person.tiers || [])]))
src/services/memberAggregationMerge.ts:170 Array.from(new Set([...target.role_types, ...person.role_types]))
src/services/memberAggregationMerge.ts:213 Array.from(linked.values())
src/services/memberAggregationUtils.ts:68 Array.from(names)
src/services/memberAggregationUtils.ts:196 Array.from(mergedCertificateNumbers.values())
src/services/memberAggregationUtils.ts:200 Array.from(new Set([...(left || []), ...(right || [])].filter(Boolean)))
src/services/memberAggregationUtils.ts:203 Array.from(new Set([...splitCertificateDisplay(left), ...splitCertificateDisplay(right)])).join(', ')
src/services/memberAggregationUtils.ts:214 Array.from(merged.values())
```

## 운영 코드 밖의 유지보수 스크립트

다음 위치의 조회는 수동 실행 시 전송량을 유발한다. 자동 실행 연결 여부는 별도 운영 스케줄러 확인이 필요하다. 원문에 자격증명이나 개인정보가 섞일 수 있으므로 파일·줄 번호만 기록한다. 스크립트를 실행하지 않았다.

| 파일 | 조회·클라이언트 생성·반복 위치(줄) |
|---|---|
| check_overlap.js | 1 |
| cleanup_ohhakdong.js | 11, 16, 17, 43, 57 |
| count_debug.ts | 8, 11, 14 |
| final_sync_ohhakdong.js | 11, 15, 23, 37 |
| fix_ohhakdong.js | 11, 17, 33, 42 |
| scripts/add_column.js | 8 |
| scripts/analyze_rights_stats.py | 14, 22, 23 |
| scripts/apply_registered_roster.mjs | 21, 47, 52, 53, 66, 67, 77, 78, 132, 133, 146, 173, 176, 182, 186, 190, 194, 203, 207, 211, 216, 228 |
| scripts/backfill_asset_rights_right_numbers.js | 12, 134, 135, 176 |
| scripts/check_all_audit.py | 9, 12 |
| scripts/check_asset_rights.py | 9, 14 |
| scripts/check_audit.py | 9, 14 |
| scripts/check_birthdates.js | 8, 15, 16, 36, 37 |
| scripts/check_cert_status.js | 14, 18 |
| scripts/check_logs_distribution.js | 8, 12, 13, 28, 29, 35, 36 |
| scripts/check_member_no.py | 9, 14 |
| scripts/check_registered_rights.js | 5, 11, 12, 20, 25, 26, 43, 44 |
| scripts/check_schema.py | 7, 18, 25, 34 |
| scripts/check_status.ts | 6, 10, 11 |
| scripts/check_system_audit.py | 9, 14 |
| scripts/check_tables.py | 9, 15 |
| scripts/check_view.py | 9, 22, 27 |
| scripts/cleanup_kim_sun_jin.ts | 5, 24, 40, 58, 70 |
| scripts/debug_cert_classification.js | 4, 11, 12, 19, 20 |
| scripts/debug_cert_v2.js | 4, 12, 13, 20, 21 |
| scripts/debug_db_columns.js | 8, 13, 14, 28, 29 |
| scripts/debug_db_constraints.js | 8, 14, 20, 31, 32, 38, 39 |
| scripts/debug_db_schema.js | 8, 13, 14 |
| scripts/debug_db_schema_2.js | 8, 13, 14, 25, 26 |
| scripts/debug_kim.py | 9, 14, 21, 28 |
| scripts/debug_kim_v2.py | 10, 16, 21, 26 |
| scripts/debug_logs.js | 5, 12, 13 |
| scripts/debug_missing_history.js | 8, 39, 40, 50, 51, 61, 62 |
| scripts/debug_spark.js | 8, 38, 39, 53, 54, 70 |
| scripts/deep_search.py | 9, 26, 28 |
| scripts/deep_search_v2.py | 9, 15, 24 |
| scripts/diag_roles.js | 7, 12, 13, 28, 29, 39, 40 |
| scripts/diag_roles_v2.js | 7, 12, 13, 25, 26, 46 |
| scripts/export_refunded_rights.py | 16, 22, 23 |
| scripts/find_birthdates.js | 8, 14, 24, 32 |
| scripts/find_kim_by_phone.py | 9, 15 |
| scripts/find_misaligned_rights.js | 7, 13, 14 |
| scripts/find_owner.py | 9, 15 |
| scripts/find_person.py | 9, 15, 21, 30 |
| scripts/find_sync_results.js | 7, 14, 15, 31, 32 |
| scripts/fix_enum.js | 7 |
| scripts/fix_registered_members.js | 9, 33, 34, 47, 48, 60, 66, 81 |
| scripts/get_all_columns.py | 10, 16 |
| scripts/import_excel_data.js | 15, 113, 114, 115, 116, 117, 138, 157, 169, 178, 195, 217 |
| scripts/import_excel_history.js | 8, 50, 51, 60, 61, 77 |
| scripts/inspect_rights_meta.js | 7, 13, 14 |
| scripts/inspect_schema.py | 9, 14 |
| scripts/investigate_kim_sun_jin.ts | 4, 12, 13 |
| scripts/list_kim_certs.py | 9, 14 |
| scripts/list_tables.py | 9, 23 |
| scripts/merge_duplicate_entities.js | 8, 23, 70, 71, 78, 81, 88, 101, 105, 107, 109, 112 |
| scripts/merge_hoejin.js | 7, 17, 18, 41, 61, 62, 67, 69, 76, 87, 89, 93 |
| scripts/merge_hyeongjo.js | 7, 17, 18, 55, 56, 61, 63, 69, 79, 81, 85 |
| scripts/merge_samename_v4.js | 8, 37, 103, 104, 108, 110, 124, 128, 130, 132, 136 |
| scripts/merge_specific_v3.js | 7, 33, 78, 94, 95, 101, 103, 118, 122, 124, 126, 130 |
| scripts/migrate_all_data.js | 24, 75, 214, 231, 242, 256, 264, 273 |
| scripts/migrate_birthdates.js | 4, 34, 35, 89, 94, 100, 104 |
| scripts/migrate_certificate_prices.ts | 15, 96, 97, 138, 175, 186, 201, 202 |
| scripts/migrate_master_excel.js | 9, 40, 50, 93, 102, 114, 142, 152, 164 |
| scripts/migrate_relationships.js | 9, 29, 39, 63, 77, 81, 89, 104, 108, 116 |
| scripts/migrate_rights_data.py | 32, 159, 211 |
| scripts/move_warnings_to_memo.js | 7, 14, 15, 36, 37, 56, 68 |
| scripts/quick_check_counts.js | 7, 12, 13, 17, 27 |
| scripts/recalculate_rights_count_from_cert_numbers.py | 109, 110, 143, 183 |
| scripts/retry_import_history.js | 8, 47, 48, 59, 60, 71, 72, 88, 89, 102 |
| scripts/run_classification.js | 13, 21, 24, 41, 42, 56 |
| scripts/search_string.py | 9, 17, 24 |
| scripts/setup_schema.js | 4 |
| scripts/setup_schema_v2_placeholder.py | 8 |
| scripts/step1_db_cleanup.js | 12, 77, 88, 89 |
| scripts/step1_main.py | 12, 85, 90, 94, 118 |
| scripts/sync_certificates.js | 9, 63, 64, 77, 78, 87, 101, 107, 121, 135, 143 |
| scripts/sync_latest_address_book.py | 69, 395, 398, 413, 416, 477, 533, 557, 564, 590, 621 |
| scripts/sync_member_number_to_legacy_cert.py | 52, 140, 141, 213 |
| scripts/update_registry_schema.js | 7 |
| scripts/verify_activity_filter.js | 8, 19, 20, 33, 34, 67, 74, 84, 85, 104 |
| scripts/verify_activity_filter.ts | 10, 11, 37, 44, 63 |
| scripts/verify_schema.js | 8, 12, 13 |
| scripts/verify_schema_v2.js | 8, 12, 17 |
| scripts/view_05_record.py | 9, 14 |
| temp_check_overlap.js | 12, 15, 34 |
| temp_check_overlap2.js | 1 |
| temp_check_overlap3.js | 1 |
| temp_check_overlap4.js | 1 |
| tmp_check_db.js | 11, 16, 17 |
| tmp_detailed_check.js | 11, 16, 17 |
| tmp_query_test.ts | 5, 10, 11 |
| tmp_query_test2.ts | 5, 9, 13, 17 |
| tmp_query_test3.ts | 5, 11, 12, 22 |
