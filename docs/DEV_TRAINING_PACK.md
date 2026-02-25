# peopleON 개발단계 교육팩

회계 확정 전, 개발/검증 단계에서 필요한 최소 이해를 맞추기 위한 교육 자료 모음입니다.

## 목적

- 회계 전문용어 없이도 `인물-돈-환불` 흐름을 설명할 수 있게 만들기
- 기능 테스트 시 무엇이 정상/이상인지 빠르게 판정하기
- 정책 변경이 생겨도 데이터 재분류를 안전하게 수행하기

## 이 자료로 보는 순서

1. `docs/DEV_TRAINING_GLOSSARY_1PAGE.md`
2. `docs/DEV_TRAINING_DECISION_TREE.md`
3. `docs/DEV_TRAINING_PRACTICE_10_CASES.md`
4. `docs/DEV_TRAINING_CHECKLIST.md`

## 권장 교육 진행 (3회)

1. 1회차(40분): 용어집 + 분류 결정 트리
2. 2회차(60분): 샘플 10건 실습 (화면 조작)
3. 3회차(30분): 릴리즈 전 체크리스트 실전 적용

## 실습 화면 경로

- 인물 관리: `/members`
- 정산/환불: `/settlements`
- 지급/납부: `/payments`
- 자금흐름/분류: `/finance`

## 실습용 검증 스크립트

- 초기 GO 확인: `scripts/settlement_go_live_verify.sql`
- 지급등록 후 정합성: `scripts/settlement_post_smoke_verify.sql`
- 최종 판정: `scripts/settlement_final_go_nogo.sql`
