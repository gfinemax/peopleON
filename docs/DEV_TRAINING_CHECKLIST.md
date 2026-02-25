# 개발단계 체크리스트 (릴리즈 전 10분)

운영 전 단계에서 매일이 아니라 “변경 배포 전”에 수행하는 체크리스트입니다.

## A. 코드 변경 직후 (3분)

1. 변경 화면 수동 확인
- `/members`
- `/settlements`
- `/payments`
- `/finance`

2. 기본 동작 확인
- 페이지 진입 오류 없음
- 주요 버튼 클릭 오류 없음
- 콘솔 치명 에러 없음

## B. 정산 기능 핵심 점검 (4분)

1. `/settlements`에서 `권한/RLS 점검`
- FAIL 0이어야 통과

2. `QA 실행`
- 결과 카드/히스토리 갱신 확인

3. `상태 동기화`
- 실행 메시지 정상 표시

## C. 스모크 테스트 (3분)

1. 지급등록 1건
- 금액: 100000
- 참조번호: `SMOKE-YYYYMMDD-001`

2. 결과 확인
- `/payments`에 지급 레코드 생성
- `/members`, `/finance` 수치 반영

3. SQL 판정
- `scripts/settlement_final_go_nogo.sql` 실행
- `final_decision=GO` 확인

## 완료 판정

1. A/B/C 모두 PASS면 개발 배포 진행
2. 하나라도 FAIL이면 배포 보류 후 원인 수정

## 메모 템플릿

```text
릴리즈 버전:
점검자:
권한/RLS:
QA 실행:
상태 동기화:
지급등록:
final_decision:
비고:
```
