# peopleOn Egress 분석·개선 보고서

기준일: 2026-09-05. 분석 기준 커밋: `9f488aa`.

## 1. 확인된 원인과 운영 상태

- **직접 재현한 반복 호출:** `MemberWorkspaceSummary`의 `const ids = [member.id]`가 렌더마다 새 배열을 생성한다. `useWorkspaceData`가 `[memberIds]`를 효과 의존성으로 사용하고 조회 후 `setData`를 호출하므로, 상태 변경 → 새 배열 → 조회가 반복된다. production React에서도 재현된다.
- **조회 중 쓰기:** `fetchMemberDetail`이 상세 열기마다 `checkAndLogAssetRightConflicts`를 호출했다. 충돌 시 동일한 안내문을 메모에 계속 추가하고 감사 기록을 쓴다. 읽기를 순수 조회로 변경했다. 기존 메모·감사 기록은 삭제하지 않았다.
- **부가 비용:** 전체 집계, 큰 메모·JSON, 전체 이력 fallback, 배열 참조 의존성, 상세 패널의 동일 요청, 저장 후 평형·계좌까지 재조회, 탐색 메뉴 prefetch.
- **아직 입증하지 못한 사항:** 과거 24.315GB 중 각 경로의 기여율, 실제 메모 크기, 서버 캐시 저장 실패 여부, 외부 연동 호출 빈도. 캐시 압축은 방어적 개선이며 실제 2MB 제한 초과가 관측됐다는 뜻이 아니다.
- Supabase Usage UI에서 peopleOn / Free / 2026-08-09~2026-09-09 / 24.315GB / MAU 4 / DB 약 0.032GB / `Services restricted` 확인.
- peopleOn REST 읽기는 HTTP **402 `exceed_egress_quota`**. 연결된 MCP는 다른 프로젝트만 접근 가능. 다른 프로젝트의 설정·데이터는 변경하지 않았다.
- Observability 일부 DB 지표는 늦게 로드되었지만 Query Performance 메뉴는 비활성 상태. 표시된 account_entities 크기는 448KB로, 이 값만으로 메모나 HTTP 응답 크기를 추정하지 않는다.
- SQL Editor의 진단 입력이 반영되지 않아 SQL은 실행하지 않았다. 저장된 기존 스키마 스니펫을 읽기만 했다.

## 2. 요청한 20개 조사 항목

전체 조회별 표와 원문은 [egress-query-inventory.md](egress-query-inventory.md)에 있다. 초기 357은 `Array.from` 등도 포함한 원시 검색 건수다. 실제 `select`가 연결된 조회 체인은 192개이며, 이들 모두를 표에 기록했다. 운영 실행 횟수와 정적 위치 수는 다르다.

| 항목 | 결과 |
|---|---|
| 1 클라이언트 생성 | `lib/supabase/client.ts` 브라우저, `server.ts` 쿠키, `admin.ts` 서버 서비스 계정 singleton, `proxy.ts` 세션 갱신. `actions/audit.ts`, `actions/interaction.ts`에도 SDK 직접 생성. 나머지 호출부는 이 팩토리 사용. 유지보수 스크립트 위치도 inventory에 수록. |
| 2 모든 from/select | 192개 조회 체인의 파일·줄·함수·테이블·호출 시점·범위·위험·개선안 수록. raw from 목록은 비 DB Array.from도 구분해서 읽어야 함. |
| 3 select('*') | 다수의 납부·평형·계좌·분석·감사·상세 조회와 HEAD count. HEAD는 원래 본문 전송 없음. 대부분 명시 컬럼으로 교체. 필증 상세 1곳은 아래 예외 참조. |
| 4 range/limit 없는 목록 | 전체 집계·호환성·내보내기·상세 관계 조회에 존재. 정렬 + `readAllPages`로 50개씩 완전 조회. |
| 5 전체 테이블 | memberAggregationData, dashboard/payment/settlement summaries 및 fallback, duplicates, certificate audit, exports, compatibility checks. 집계 의미를 보존하므로 전체 자료 소비 자체는 남음. |
| 6 타이머 | 운영 src에 setInterval 없음. setTimeout은 검색 debounce·인쇄·이전 이력 UI 용도이며 반복 polling 루프 아님. |
| 7 React Query/SWR | 의존성 및 사용 없음. 설정 추가 불필요. |
| 8 refetchInterval/refreshInterval | 없음. |
| 9 refresh/reload | 여러 저장·역할·등록·수입 작업의 router.refresh 존재. location.reload 없음. 필터/합계 재계산을 보존할 곳은 유지. 납부 개별 수정/삭제 재조회 제거. |
| 10 useEffect 의존성 | WorkspaceSummary의 새 배열로 무한 재조회 재현. 상세·빠른보기·타임라인·납부·workspace의 ID 배열 안정화. |
| 11 렌더 시 요청 | 직접 렌더 본문 요청보다 렌더→효과→상태변경 루프가 원인. 서버 페이지 렌더에서는 집계 조회 발생. |
| 12 입력 검색 | 회원 필터 400ms, 전역 검색 300ms가 이미 존재. 전역 검색은 10개로 제한. 닫힌 검색 중단·오래된 응답 무시·정렬 추가. |
| 13 저장 후 전체 재조회 | PaymentStatusTab의 수정/삭제 후 fetchAll 제거. 역할·관계 변경은 필터·집계가 달라지므로 재검증 보존. |
| 14 컴포넌트 중복 | workspace summary/body 등의 같은 직접 Supabase GET을 동일 헤더·URL 기준 동시 요청 통합. 완료 후 응답은 보관하지 않음. |
| 15 서버/클라이언트 중복 | 서버 회원 스냅샷과 클라이언트 상세는 일부 필드 중복. 상세는 최신 메모·개인정보·권리 관리에 필요. 동일 데이터로 단순 대체하면 권한/세부 정보 손실 가능. |
| 16 큰 컬럼/관계 | memo, note, meta, summary, attachment. 상세와 내보내기는 필요. 집계 메모에는 검색·관계 추론 의미가 있어 보존하고 캐시 압축. |
| 17 쓰기 반환 | 대부분 ID 또는 필요한 일부 컬럼만 반환. 납부 변경도 ID 하나로 실제 반영 확인 후 로컬 상태 적용. 전체 행 반환 추가 없음. |
| 18 공개 엔드포인트 | API 경로별 인증 점검 표는 아래. 외부에 URL이 보인다는 것과 익명 데이터 접근 가능은 다름. |
| 19 오류 재시도 | 무한 retry 설정 없음. 호환 view/column fallback은 존재. 페이지 조회 중 실패는 부분 결과 폐기, retry 없음. snapshot 오류를 빈 목록으로 숨기지 않음. |
| 20 Strict Mode | 개발 중 효과 중복 가능. production 모드에서도 위 루프 재현. Strict Mode 비활성화로 문제를 감추지 않았고 동시 동일 읽기 통합. |

## 3. 수정 계획과 기능상 판단

1. 반복 effect를 값 기준 ID 목록으로 안정화한다.
2. 조회 중 충돌 메모 쓰기를 없애고 실제 권리 변경 시 검사한다. 동일 안내문은 다시 추가하지 않는다. 충돌 알림 서버 액션은 staff 권한을 확인한다.
3. 컬럼을 명시하고 정렬을 보완한다. 집계·내보내기·선택 회원의 연관 자료는 50건씩 끝까지 읽는다. 기존 화면 50명 페이지네이션/전역 검색 10명 제한은 유지한다.
4. 브라우저 동시 읽기와 서버 snapshot 동시 cache fill을 통합한다. 헤더가 다른 사용자 요청은 공유하지 않는다. RLS·환경변수·키는 변경하지 않는다.
5. 큰 snapshot은 서버 내부에서 gzip/base64로 저장하고 600초 TTL과 기존 tag invalidation을 유지한다. 압축은 DB→앱 응답의 압축이 아니며 cache reuse 지원용이다.
6. 최신 상담 fallback은 회원마다 적격 이력 1건만 조회한다. 기존 이전시스템기록/날짜 제외 조건을 DB에 적용한다.
7. 납부 단건 수정/삭제는 성공한 ID를 확인한 뒤 상태만 반영한다. 실패/RLS 미반영 때 기존 화면 자료 유지.
8. 탐색 메뉴의 불필요한 prefetch를 줄인다. 클릭 후 이동 방식은 유지한다.

### 의도적으로 남긴 예외

- 필증 상세 `memberDetailDialogFetch.ts`의 `certificate_registry.select('*')` 1곳: 운영에 확장된 날짜·가격·취득처 컬럼의 현재 스키마를 REST로 검증할 수 없다. 상세화면에서 실제 표시 가능한 필드를 임의로 버리는 것보다, 선택한 회원으로 제한한 분할 조회를 유지한다. 운영 복구 후 현행 컬럼을 확인하여 명시 projection으로 교체해야 한다. **select('*') 전면 제거 완료라고 보고하지 않는다.**
- 메모 검색·관계인 이름 추론·엑셀 원문 보존 때문에 집계의 memo와 권리 note는 남아 있다. 큰 텍스트를 모두 상세에서만 읽도록 전환하려면 DB 검색/집계 또는 지연 내보내기 API 변경이 추가로 필요하다.
- 재무·권리 분석 화면의 합계/엑셀 자료는 전체 소비한다. 50행으로 잘라서 합계를 왜곡하지 않는다. 분할 조회는 총 bytes를 줄이지 않으며 작은 요청 수는 늘 수 있다.
- 회원 테이블 API의 기존 최대 pageSize 200, 피드/감사 이력의 기존 상한은 외부 소비자/화면 계약을 보존한다. 기본 회원 페이지 50명은 유지.
- 동시 서버 인스턴스 간 cache fill lock은 추가하지 않았다. 서버 cache hit/miss와 변동 데이터에서 offset pagination의 동시 변경 영향은 운영 확인 필요.

## 4. 파일별 변경

아래 파일 목록의 공통 `정렬·분할 조회`는 기존 필터와 필요한 전체 결과를 보존하며 페이지 요청을 명시한 변경이다. 타입 검사가 확인하지 못하는 실제 view 컬럼·권한은 운영 복구 후 재검증해야 한다.

| 파일 | 변경 |
|---|---|
| src/app/(dashboard)/admin/audit/page.tsx | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/(dashboard)/certificate-audit/page.tsx | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/(dashboard)/members/page.tsx | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/actions/duplicates.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/actions/financial.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/actions/interaction.ts | 충돌/시스템 기록 액션 권한 확인; 동일 메모 중복 추가 방지 |
| src/app/actions/member.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/actions/members.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/accounting/compat-history/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/accounting/compat-ready/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/admin/sync-legacy/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/certificates/analysis/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/finance/certificate-audit/legacy-exclusive-export/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/finance/rights-details/export/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/financial/migrate/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/integrations/ledger/members/[peopleonId]/journal/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/integrations/ledger/members/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/members/inline-update/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/members/roster-sync/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/members/table/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/settlement/alerts/history/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/settlement/diagnostics/export/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/api/settlement/qa/history/route.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/app/debug/page.tsx | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/components/features/finance/LegacyRecordDetailDialog.tsx | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/components/features/members/ActivityTimelineTab.tsx | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/components/features/members/MemberDetailDialog.tsx | 값 기반 ID 안정화; null fallback 보존 |
| src/components/features/members/MemberQuickPreview.tsx | 값 기반 ID 안정화 |
| src/components/features/members/MemberWorkspacePage.tsx | 반복 효과 원인 제거, 필요한 납부 컬럼, 관련 조회 분할·정렬 |
| src/components/features/members/PaymentStatusTab.tsx | ID 안정화, 명시 컬럼, 단건 변경 성공 ID 확인 후 로컬 반영 |
| src/components/features/members/memberDetailDialogFetch.ts | 조회 중 충돌 쓰기 제거, 회원 컬럼 명시, 관련 자료 분할 |
| src/components/features/search/GlobalSearch.tsx | 닫힌 검색 중단·오래된 결과 무시 |
| src/components/features/settings/DepositAccountsSection.tsx | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/components/features/settings/UnitTypesSection.tsx | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/components/layout/MobileNav.tsx | 탐색 링크 prefetch 비활성화 |
| src/components/layout/Sidebar.tsx | 탐색 링크 prefetch 비활성화 |
| src/lib/server/accountingDomainSync.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/activityFeed.ts | 전체 이력 fallback을 회원별 적격 최신 1건으로 축소 |
| src/lib/server/certificateAuditQuality.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/certificateCompat.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/dashboardOverview.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/memberUpdateBasicUtils.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/memberUpdateCertificateUtils.ts | 실제 필증 변경 시 충돌 검사; 관련 자료 분할 |
| src/lib/server/partyRolesCompat.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/paymentDashboard.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/personCertificateSummary.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/residentRegistryImport.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/settlementDashboard.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/settlementMissingCases.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/settlementQaReport.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/settlementRefundPayment.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/settlementStatusSync.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/smsDashboard.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/server/unifiedMembersSnapshot.ts | 압축 cache v6, 동시 fill 공유, 오류를 빈 목록으로 숨기지 않음 |
| src/lib/supabase/client.ts | 동일 헤더/URL의 진행 중 GET/HEAD 공유 |
| src/services/memberAggregationData.ts | 필요 컬럼 명시 또는 기존 필터를 유지한 정렬·범위/분할 조회 |
| src/lib/hooks/useStableIds.ts | 값이 같은 배열을 재사용하고 ID 순서를 보존 |
| src/lib/server/singleFlight.ts | 동시 cache fill을 하나로 공유; 성공/실패 후 해제 |
| src/lib/server/snapshotCodec.ts | gzip/base64 왕복; 원문 메모 보존 |
| src/lib/supabase/readAllPages.ts | 50행 범위 반복, 오류에서 부분 결과 폐기 |
| src/lib/supabase/deduplicateFetch.ts | 사용자 헤더별 진행 중 읽기 통합; 쓰기·완료 응답 미보관 |
| src/lib/supabase/egress.test.mjs | 페이지 완전성·오류·중복·사용자 분리·압축·cache fill 회귀 테스트 |

### 외부 HTTP 엔드포인트 인증 점검

전체 API에는 proxy의 로그인 보호가 기본으로 적용된다. 아래는 각 route 자체의 추가 검사 유무다. GET에서 변경 작업을 하는 legacy migration 경로는 향후 별도 보완 필요.

| route 파일 | route 내부 인증 신호 |
|---|---|
| src/app/api/accounting/compat-history/route.ts | getUser 로그인 확인 |
| src/app/api/accounting/compat-ready/route.ts | getUser 로그인 확인 |
| src/app/api/admin/sync-legacy/route.ts | proxy/RLS/상위 helper 의존; 독립 role 확인 필요 |
| src/app/api/certificates/analysis/route.ts | getUser 로그인 확인 |
| src/app/api/finance/certificate-audit/legacy-exclusive-export/route.ts | proxy/RLS/상위 helper 의존; 독립 role 확인 필요 |
| src/app/api/finance/rights-details/export/route.ts | proxy/RLS/상위 helper 의존; 독립 role 확인 필요 |
| src/app/api/financial/migrate/route.ts | requireRole |
| src/app/api/integrations/ledger/members/[peopleonId]/journal/route.ts | API key 또는 직원 role |
| src/app/api/integrations/ledger/members/[peopleonId]/supply-type/route.ts | API key 또는 직원 role |
| src/app/api/integrations/ledger/members/route.ts | API key 또는 직원 role |
| src/app/api/members/[id]/bank-account/route.ts | requireRole |
| src/app/api/members/[id]/ledger-journal-summary/route.ts | requireRole |
| src/app/api/members/[id]/profile-image/route.ts | requireRole |
| src/app/api/members/bulk-upload/route.ts | requireRole |
| src/app/api/members/create/route.ts | requireRole |
| src/app/api/members/inline-update/route.ts | requireRole |
| src/app/api/members/resident-registry-import/route.ts | getUser 로그인 확인 |
| src/app/api/members/roster-sync/route.ts | requireRole |
| src/app/api/members/table/route.ts | API key 또는 직원 role |
| src/app/api/members/update/route.ts | requireRole |
| src/app/api/settlement/alerts/history/route.ts | getUser 로그인 확인 |
| src/app/api/settlement/cases/route.ts | getUser 로그인 확인 |
| src/app/api/settlement/diagnostics/export/route.ts | getUser 로그인 확인 |
| src/app/api/settlement/ops/status/route.ts | getUser 로그인 확인 |
| src/app/api/settlement/qa/history/route.ts | getUser 로그인 확인 |
| src/app/api/settlement/qa/report/route.ts | getUser 로그인 확인 |
| src/app/api/sms/send/route.ts | getUser 로그인 확인 |


## 5. 제거/감소한 호출과 페이지별 비교

| 화면·작업 | 이전 | 이후 | 근거/한계 |
|---|---|---|---|
| 통합정보 상단 요약, 1.5초 idle | 58 HTTP 읽기 | 2 HTTP 읽기 | 같은 React 훅·30ms mock 응답으로 브라우저 실측; **96.6% 감소** |
| 같은 회원 요약의 상태 렌더 | 납부+상담 2개 재호출 반복 | ID 변경 전 재조회 0 | effect 값 안정화 |
| 빠른보기/상세 읽기 | 기본 관련 조회 + 충돌 검사 및 메모 읽기/쓰기 | 기본 관련 조회만 | 관련 행 >50이면 분할 요청 추가 |
| 동일 URL·동일 사용자 동시 조회 2개 | 2 | 1 | fetch 단위 테스트; 완료 후 재요청은 새 읽기 |
| 납부 단건 수정 | 쓰기 1 + fetchAll 최소 3 reads | ID 반환 쓰기 1 | 로컬 해당 행 반영; 자동 fee 보완 상황은 별도 |
| 납부 단건 삭제 | 쓰기 1 + fetchAll 최소 3 reads | ID 반환 쓰기 1 | 로컬 해당 행 제거 |
| 전역 검색 | 입력 정지 300ms마다 2 queries, 결과 최대 10 | 동일; 닫힌 상태 호출 0 | 검색 결과 범위 유지 |
| 회원 목록 cache hit | snapshot SQL 없음 + 최근 활동/rollup 등 | 동일 | 화면 pagination만으로 모든 DB 전송 제거는 아님 |
| 전체 집계 cache miss | 테이블별 무범위 읽기 | 테이블별 ceil(N/50), 정확히 배수면 빈 마지막 페이지 추가 | 요청 수 증가 가능; 결과 누락 방지가 목적 |
| 최신 상담 fallback | 회원 묶음의 전체 이력 | 각 회원 적격 최신 1건 | 요청 수 증가 가능, 반환 행 감소; 캐시 120초 |

[브라우저 재현 소스와 결과](egress-browser-reproduction.md).

## 6. 예상 Egress 절감률

**측정된 것은 특정 반복 경로의 HTTP 요청 96.6% 감소이며 월간 전체 Egress 절감률은 아직 미측정이다.**

- 이전 월간 24.315GB를 기준으로 90% 감소는 2.4315GB이므로, 월 2GB 목표에는 약 **91.8%**, 월 1GB에는 약 **95.9%** 감소가 필요하다.
- 단순 가정상 모든 전송이 재현한 루프에 비례했다면 `24.315 × 2/58 ≈ 0.84GB`. 이는 **실측 예측이나 보장값이 아닌 조건부 계산**이다.
- 실제 결과는 loop 비중, 응답 크기, 외부 연동, cache miss, 내보내기, 운영 스크립트 사용량에 좌우된다. `신규 일 Egress × 30`으로 운영 복구 후 추정해야 한다.
- 서비스 제한으로 요청이 실패해서 사용량이 0인 기간은 최적화 성과로 집계하면 안 된다.

## 7. 검증과 남은 위험

- 수정 전: 타입 검사 통과, lint 오류 0 / 기존 ActivityTimelineTab `any` 경고 5.
- 수정 후: 타입/lint/production build/전체 Node 테스트 결과는 최종 실행 기록으로 아래에 기재.
- 타입 검사 중 공통 fetch의 Bun ambient type 호환 오류를 발견·수정했다. 이번 변경에서 발생했던 오류이며 최종 타입 검사로 확인한다.
- 브라우저에서 `/members` 비로그인 접근이 `/login?redirect=%2Fmembers`로 이동하고 기존 로그인 UI가 렌더됨을 확인.
- 가짜 데이터의 pagination은 1,107건 누락 없음, 오류 시 부분 결과 미반환, 동일 요청 합치기, 사용자 헤더 분리, 실패 재시도 없음, 큰 한글 메모 압축 원문 복원 검사.
- **실제 로그인 성공/직원별 RLS/등록·수정·삭제/실데이터 검색·페이지 이동/실 Supabase bytes 전후 비교는 402 때문에 완료하지 못함.**
- 기존 `authz.ts`가 user_metadata role fallback을 허용하는 점, `api/admin/sync-legacy`의 GET 기반 변경 작업은 별도의 권한 감사 대상. 이번 변경은 RLS를 해제하거나 이 경로의 권한을 완화하지 않았다.
- 자동 fee 생성, 역할/관계 저장, 외부 연동, view schema 호환성은 복구 후 focused smoke 확인 필요.

## 8. Supabase 확인 지표

1. **Organization → Usage → peopleOn → Egress**: PostgREST 일별 증가량, 합계, 타 프로젝트 포함 조직 전체 5GB 한도 확인. 사용량 갱신 지연 고려.
2. **Advisors → Query Performance → Most frequently called**: `member_payments`, `interaction_logs`, `account_entities`, `certificate_registry` calls와 rows/call 확인. 현재 UI에는 **Observability → Query Performance** 경로도 존재.
3. **Logs Explorer → Edge Logs → Top paths**: `/rest/v1/member_payments`, `/rest/v1/interaction_logs` 호출이 상세 idle에서 계속 늘지 않는지, 외부 요청의 비중, 402/401/403/5xx 확인.
4. 앱 브라우저 Network와 서버 로그를 분리: 브라우저에서는 서버→Supabase 요청이 안 보인다. snapshot rebuild 로그·Vercel cache 오류도 함께 확인.

공식 근거: [Supabase Egress 안내](https://supabase.com/docs/guides/platform/manage-your-usage/egress). 이미 사용된 이번 주기 24.315GB는 소급 차감되지 않는다. Free 5GB는 조직 기준이다. Edge Logs Top paths만으로 response bytes를 직접 계산할 수 있다고 가정하지 않는다.

## 9. 배포 후 7일 확인

| 시점 | 확인 |
|---|---|
| 복구/배포 당일 | 4명 계정의 로그인·각 역할·목록 총수·필터·내보내기·상세 납부/상담; 원래 DB 수와 비교 |
| 1일차 | 상세를 5분 열어 두고 초기 요청 이후 반복 GET 없는지. 빠른보기 열기만으로 메모 길이/감사 기록이 늘지 않는지 |
| 2일차 | 회원 1/2/마지막 페이지, 빈 결과, 이름·전화·메모 검색. 업무용 자료의 등록/수정/삭제 후 화면·합계 일치 |
| 3일차 | 탭 이동/복귀, 창 포커스, 동시 로그인과 다른 권한 사용자 자료 혼합 없음 |
| 4일차 | ledger 연동·엑셀·필증/정산 합계·모든 데이터 50행 넘는 경계 확인 |
| 5일차 | cache hit/miss·재빌드 수·쿼리 calls 증가량·오류 로그 확인 |
| 6일차 | 실사용 일 Egress 평균과 최댓값 계산. 1GB 목표 약 33MB/일, 2GB 약 67MB/일 |
| 7일차 | 서비스 정상일만으로 30일 환산. 2GB 초과 예상이면 상위 path부터 추가 최적화; 5GB 한계 약 167MB/일에 근접하기 전 대응 |

실패 요청만 있는 날이나 휴무일만으로 90% 달성을 판단하지 않는다. 이 작업에서 자동 7일 모니터링 작업을 등록한 것은 아니다.

## 10. 되돌리기

이번 변경은 앱 코드와 문서뿐이며 DB migration/data cleanup/RLS 변경은 없다. 배포 플랫폼에서 이전 `9f488aa` 배포로 되돌리거나 이 최적화 커밋을 `git revert <commit>` 후 push한다. 압축 cache key는 v6로 분리되어 이전 v5 cache를 잘못 해석하지 않는다. 이전 코드로 돌아가면 반복 호출도 돌아오므로 상세 화면 idle을 최소화하고 원인 패치를 다시 적용해야 한다.

## 최종 로컬 실행 기록

- npx tsc --noEmit: exit 0
- npm run lint: exit 0, 오류 0 / 기존 any 경고 5
- npm run build: exit 0, production build 성공
- node --experimental-strip-types --test (src 전체 .test.mjs): 29 passed, 0 failed
- git diff --check: 통과
- 중간 lint 실패는 생성한 임시 fixture 번들이 검사 대상에 포함된 결과였다. fixture 파일 정리 후 기존 경고 5개로 복귀했다.
- 브라우저: localhost production 로그인 redirect/UI 확인, 별도 mock React 재현 58→2 요청. 실제 CRUD/로그인 성공/RLS는 미검증.
- 스키마·데이터·RLS·요금제 변경 없음.

