# Settlement Final 3-Min Smoke Test

`go_live_status = PASS` 이후, 운영 전환 직전에 수행하는 최종 UI 점검 절차입니다.

## 1) `/settlements` (약 1분)

1. `/settlements` 접속
2. 상단 액션에서 `권한/RLS 점검` 클릭
3. `QA 실행` 클릭
4. `상태 동기화` 클릭 (기본 limit 그대로)

기대 결과:

- `권한/RLS 점검` 결과에 `FAIL` 없음
- QA 카드에 최신 실행 이력 1건 이상 표시
- 상태 동기화 결과 토스트/요약에 오류 없이 처리 건수 표시

실패 시:

- 권한 실패: `scripts/settlement_rls.sql` 재실행
- QA fail/warn: `/settlements?diag=...` 또는 Alert Center로 이슈 레코드 확인 후 정리

## 2) `/members` -> `/settlements` 시나리오 (약 1분)

1. `/members` 이동
2. 케이스 미생성 대상 1건에서 `케이스 생성`
3. `/settlements` 이동 후 해당 인물 케이스 확인
4. `지급등록` 실행 (샘플 금액/참조번호 입력)

기대 결과:

- 케이스 생성 직후 목록 반영
- 지급등록 성공 토스트 표시
- 과지급/중복 참조번호는 차단 메시지 정상 노출

## 3) 반영 확인 (약 1분)

1. `/members` 재접속 후 정산 관련 컬럼/KPI 확인
2. `/payments` 재접속 후 지급 반영 확인
3. `/finance` 재접속 후 합계/상태 반영 확인

기대 결과:

- 정산 예정/지급/잔여 금액 수치가 연동 반영
- 진단 배지/딥링크 정상 이동

## 최종 판정

- 위 1~3단계 모두 이상 없으면 운영 전환 `GO`
- 하나라도 실패하면 `NO-GO` 후 원인 수정/재점검

## SQL 사후 검증 (선택, 권장)

- `scripts/settlement_post_smoke_verify.sql` 실행
- 스크립트 상단의 `SMOKE-REPLACE-REF`를 방금 사용한 `지급참조번호`로 변경
- 첫 결과의 `integrity_status=PASS` 확인

## 최종 GO/NO-GO 자동 판정 (권장)

- `scripts/settlement_final_go_nogo.sql` 실행
- 스크립트 상단의 `SMOKE-REPLACE-REF`를 방금 사용한 `지급참조번호`로 변경
- 마지막 결과의 `final_decision` 확인
  - `GO`: 운영 전환 가능
  - `NO-GO`: 체크 결과에서 FAIL 항목 먼저 조치
