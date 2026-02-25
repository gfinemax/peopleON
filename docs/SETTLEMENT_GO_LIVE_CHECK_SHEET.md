# Settlement Go-Live Check Sheet

운영 반영 시 아래를 위에서 아래 순서로 체크하세요.  
판정은 `PASS / FAIL / N/A` 중 하나로 기록합니다.

## 0) 사전 정보

- 점검일시: `__________`
- 점검자: `__________`
- 배포 환경: `Production / Preview / Development`
- 앱 버전(커밋): `__________`

## 1) 환경변수 (Vercel)

- [ ] `SETTLEMENT_ALLOWED_ROLES=admin,finance_manager` 설정 완료
- [ ] Production 반영 완료
- [ ] Preview 반영 완료
- [ ] Development 반영 완료
- [ ] 재배포 완료

판정: `PASS / FAIL / N/A`  
메모: `________________________________________`

## 2) Supabase SQL 실행 순서

아래 파일을 **Supabase SQL Editor**에서 순서대로 실행:

1. `scripts/settlement_core_phase1.sql`
2. `scripts/settlement_core_phase2.sql`
3. `scripts/settlement_rls.sql`
4. `scripts/settlement_role_bootstrap.sql` (운영 이메일로 교체 후 실행)
5. `scripts/seed_settlement_policy.sql`
6. `scripts/settlement_case_function.sql`

실행 체크:

- [ ] phase1 실행 성공
- [ ] phase2 실행 성공
- [ ] rls 실행 성공
- [ ] role bootstrap 실행 성공
- [ ] policy seed 실행 성공
- [ ] function 실행 성공

판정: `PASS / FAIL / N/A`  
메모: `________________________________________`

## 3) Supabase 검증 쿼리 (복붙 실행)

빠른 검증(권장): `scripts/settlement_go_live_verify.sql` 전체 실행  
결과에서 `go_live_status = PASS`면 SQL 기준 합격입니다.

```sql
-- A. 핵심 오브젝트 존재 확인
select
  to_regclass('public.settlement_cases') as settlement_cases,
  to_regclass('public.settlement_lines') as settlement_lines,
  to_regclass('public.refund_payments') as refund_payments,
  to_regclass('public.audit_logs') as audit_logs;

-- B. 기본 정책 확인
select policy_code, version, is_default, effective_from
from settlement_policy_versions
where policy_code = 'REFUND_2026_BASELINE'
order by version desc;

-- C. 함수 존재 확인
select n.nspname as schema, p.proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname = 'create_settlement_case';

-- D. RLS 활성화 확인
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'settlement_cases',
    'settlement_lines',
    'refund_payments',
    'audit_logs',
    'settlement_policy_versions'
  );
```

합격 기준:

- [ ] A: 모든 컬럼이 `null`이 아님
- [ ] B: `REFUND_2026_BASELINE` 행 존재 + `is_default=true` 1건
- [ ] C: `create_settlement_case` 1건 이상
- [ ] D: 대상 테이블 `rowsecurity=true`

판정: `PASS / FAIL / N/A`  
메모: `________________________________________`

## 4) 앱 기능 점검 (운영 계정 로그인)

빠른 클릭 순서가 필요하면 `docs/SETTLEMENT_FINAL_3MIN_SMOKE.md`를 먼저 수행하세요.

### 4-1. `/settlements`

- [ ] `권한/RLS 점검` 실행 후 FAIL 없음
- [ ] `QA 실행` 실행 가능, 결과 카드/히스토리 표시
- [ ] `상태 동기화` 실행 가능, 처리 건수 표시
- [ ] `Alert Center` 카드에서 경고 내역 확인 가능
- [ ] `Ops Checklist` 상태 저장/복원 동작

판정: `PASS / FAIL / N/A`  
메모: `________________________________________`

### 4-2. 업무 시나리오

- [ ] `/members`에서 대상 1건 케이스 생성
- [ ] `/settlements`에서 해당 케이스 확인
- [ ] `지급등록` 정상 처리
- [ ] 과지급 차단 메시지 확인
- [ ] 중복 참조번호 차단 메시지 확인

판정: `PASS / FAIL / N/A`  
메모: `________________________________________`

### 4-3. 연동 반영

- [ ] `/members` KPI/상태 반영 확인
- [ ] `/payments` 반영 확인
- [ ] `/finance` 반영 확인
- [ ] 진단 배지 딥링크 동작 확인

판정: `PASS / FAIL / N/A`  
메모: `________________________________________`

## 5) 최종 승인

- 운영 반영 승인: `YES / NO`
- 승인자: `__________`
- 승인일시: `__________`
- 이슈/리스크: `________________________________________`

## 6) FAIL 발생 시 즉시 조치

1. SQL 실행 실패: 실패한 파일부터 재실행(선행 객체 존재 여부 확인)
2. 권한/RLS FAIL: `scripts/settlement_rls.sql` 재적용 후 `/settlements` 재점검
3. 정책 누락: `scripts/seed_settlement_policy.sql` 재실행
4. 함수 오류: `scripts/settlement_case_function.sql` 재실행
5. 앱 미반영: Vercel env 재확인 후 재배포
