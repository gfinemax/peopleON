# peopleON 회계 Compat 운영 전환 체크리스트

## 0) 목적
- `legacy -> compat` 읽기 전환을 안전하게 실행하고, 이상 시 즉시 롤백하기 위한 실무 체크리스트입니다.
- 기준 플래그: `ACCOUNTING_COMPAT_ONLY`

## 1) 전환 전 준비 (필수)
1. 운영 계정으로 로그인합니다.
2. `/settlements` 페이지로 이동합니다.
3. `회계 호환 전환 준비 상태` 카드에서 `진단 실행(기록)`을 클릭합니다.
4. 아래 3가지를 확인합니다.
- `판정 PASS`
- `FAIL 0`
- `guard = ok`
5. 같은 카드에서 `최근 전환 진단 이력`이 1건 이상 생성되었는지 확인합니다.

## 2) 전환 실행
1. 배포 환경 변수에서 `ACCOUNTING_COMPAT_ONLY=true`로 설정합니다.
2. 앱을 재시작/재배포합니다.
3. 다시 `/settlements`로 이동합니다.
4. `회계 호환 전환 준비 상태` 카드에서 모드가 `COMPAT_ONLY ON`인지 확인합니다.
5. `진단 실행(기록)`을 다시 눌러 아래를 확인합니다.
- `PASS`
- `guard = ok`
- `recommendation`에 오류/롤백 권고 없음

## 3) 전환 후 스모크 테스트 (5분)
1. `/members`
- 인물 목록 조회/검색 정상
- 임의 1명 수정 저장 후 `회계동기화: 정상` 메시지 확인
2. `/settlements`
- `상태 동기화` 실행 후 성공 메시지 확인
- 임의 1건 `지급 등록` 실행 후 토스트 및 운영 카드 반영 확인
3. `/payments`
- 방금 지급한 금액/건이 반영되는지 확인
4. `/finance`
- 집계/상태 카드 로딩 및 오류 없음 확인

## 4) GO / NO-GO 판정
- `GO` 조건
  - 전환 후 compat 카드 `PASS`, `guard = ok`
  - 핵심 페이지(`/members`, `/settlements`, `/payments`, `/finance`) 오류 없음
  - 지급 등록 1건 성공
- `NO-GO` 조건
  - compat 카드 `FAIL > 0` 또는 `guard = danger`
  - 핵심 페이지에서 데이터 누락/권한 오류 발생

## 5) 롤백 기준/절차
- 즉시 롤백 트리거
  - `guard = danger`
  - 지급 등록/케이스 조회 등 핵심 기능 장애
1. 배포 환경 변수 `ACCOUNTING_COMPAT_ONLY=false`로 변경
2. 앱 재시작/재배포
3. `/settlements`에서 `진단 실행(기록)` 재실행
4. 모드가 `FALLBACK ON`인지 확인
5. 장애 시간대/증상/조치 결과를 운영 이력에 기록

## 6) 증적(필수 저장)
- `/settlements` compat 카드 화면 캡처 2장
  - 전환 직전 PASS 화면
  - 전환 직후 PASS 화면
- `CSV 내보내기` 파일 1개 저장
- 필요 시 `/api/accounting/compat-history?limit=6` 결과 캡처

