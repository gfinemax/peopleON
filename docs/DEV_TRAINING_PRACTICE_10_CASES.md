# 개발단계 샘플 10건 실습

아래 10건을 반복하면 시스템 핵심 흐름을 대부분 이해할 수 있습니다.

## 실습 공통 준비

1. `/settlements`에서 `권한/RLS 점검` PASS 확인
2. 테스트 참조번호 규칙 사용: `SMOKE-YYYYMMDD-XXX`
3. 실습 후 `QA 실행`으로 이슈 확인

## 실습 시나리오

| 번호 | 상황 | 해야 할 작업 | 기대 결과 |
|---|---|---|---|
| 1 | 케이스 없는 인물 | `/members`에서 `케이스 생성` | `/settlements`에 케이스 표시 |
| 2 | 정상 지급 | `/settlements`에서 10만원 지급등록 | 지급 증가, 잔여 감소 |
| 3 | 과지급 시도 | 잔여보다 큰 금액 입력 | 등록 차단 메시지 |
| 4 | 중복 참조번호 | 같은 참조번호로 재등록 시도 | 등록 차단 메시지 |
| 5 | 지급 후 상태 | `상태 동기화` 실행 | 상태 불일치 자동 보정 |
| 6 | QA 점검 | `QA 실행` 클릭 | PASS/WARN/FAIL 집계 표시 |
| 7 | 이슈 딥링크 | QA 카드 `상세 이동` 클릭 | 해당 진단 필터로 이동 |
| 8 | 알림 확인 | Alert Center 새로고침 | WARN/FAIL 이력 확인 |
| 9 | 지급 반영 확인 | `/payments` 조회 | 지급 레코드 확인 |
| 10 | 최종 판정 | `settlement_final_go_nogo.sql` 실행 | `final_decision=GO` |

## 실습 결과 기록 템플릿

```text
1) 케이스 생성: PASS/FAIL
2) 지급등록: PASS/FAIL
3) 과지급 차단: PASS/FAIL
4) 중복참조 차단: PASS/FAIL
5) 상태 동기화: PASS/FAIL
6) QA 실행: PASS/FAIL
7) 알림센터: PASS/FAIL
8) payments 반영: PASS/FAIL
9) finance 반영: PASS/FAIL
10) final_decision: GO/NO-GO
```

## 실패 시 우선 조치 순서

1. 권한/RLS 점검 재실행
2. `scripts/settlement_rls.sql` 재적용
3. 로그아웃/재로그인 후 재시도
4. `scripts/settlement_post_smoke_verify.sql`로 DB 정합성 확인
