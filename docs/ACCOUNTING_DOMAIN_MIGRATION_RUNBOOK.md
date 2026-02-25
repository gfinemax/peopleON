# peopleON Accounting Domain Migration Runbook

## 목적
- 인물/계정/증빙 분리 원칙에 맞춰 도메인 스키마를 정리한다.
- 기존 운영 데이터(`party_profiles`, `members`, `right_certificates`)를 신규 구조로 안전하게 이관한다.
- 앱 전환 전에 SQL 기준 GO/NO-GO 판정을 수행한다.

## 대상 신규 테이블
- `account_entities` (계정 주체)
- `membership_roles` (사업적 지위)
- `asset_rights` (권리 자산)

## 파일 구성
1. `scripts/accounting_domain_phase1_schema.sql`
2. `scripts/accounting_domain_phase2_backfill.sql`
3. `scripts/accounting_domain_phase3_constraints.sql`
4. `scripts/accounting_domain_phase4_compat_views.sql`
5. `scripts/accounting_domain_phase5_rls.sql`
6. `scripts/accounting_domain_smoke.sql`

## 실행 순서
1. **Phase 1 (Schema)**
   - 신규 타입/테이블/인덱스 생성
2. **Phase 2 (Backfill)**
   - 기존 데이터 이관
   - 표준 분류 함수(`normalize_role_code`) 생성
3. **Phase 3 (Constraints)**
   - FK/트리거/체크 제약 강화
4. **Phase 4 (Compat Views)**
   - 신규 구조 조회용 호환 View 제공
5. **Phase 5 (RLS)**
   - 운영 권한 정책 적용
6. **Smoke Test**
   - `scripts/accounting_domain_smoke.sql` 실행
   - `go_live_status = PASS` 확인

## 실행 환경
- Supabase SQL Editor
- Role: `postgres`
- 순차 실행(병렬 실행 금지)

## 사전 점검
- `members`, `party_profiles`, `right_certificates` 백업
- 운영 시간대 외 실행
- 실행 전 현재 row count 캡처

예시:
```sql
select 'members' as table_name, count(*) from members
union all
select 'party_profiles', count(*) from party_profiles
union all
select 'right_certificates', count(*) from right_certificates;
```

## 롤백 전략
- 본 마이그레이션은 기존 테이블을 삭제/변경하지 않는다.
- 실패 시:
  - 신규 테이블로의 읽기 전환을 중단
  - 기존 경로 유지
  - 실패 원인 수정 후 재실행

필요 시 신규 객체만 제거:
```sql
drop view if exists public.v_member_roles_compat;
drop view if exists public.v_right_certificates_compat;
drop view if exists public.v_party_profiles_compat;

drop table if exists public.asset_rights cascade;
drop table if exists public.membership_roles cascade;
drop table if exists public.account_entities cascade;
```

## 분류 표준값
- `등기조합원`
- `2차`
- `일반분양`
- `지주`
- `지주조합원`
- `대리인`
- `예비조합원`
- `권리증환불`
- `관계인`

## 최종 판정 기준
- Smoke 결과에서 `go_live_status = PASS`
- `asset_rights` 권리번호 중복 0건
- `membership_roles` 표준 외 코드 0건
- `account_entities` 미매핑 핵심 레코드 0건
