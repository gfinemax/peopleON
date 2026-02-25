# Settlement Deploy Checklist

`/settlements` 권한/정합성 기능을 운영에 반영할 때 따라야 하는 체크리스트입니다.

- 실행용 PASS/FAIL 체크시트: `docs/SETTLEMENT_GO_LIVE_CHECK_SHEET.md`
- 원클릭 SQL 검증 스크립트: `scripts/settlement_go_live_verify.sql`
- 최종 3분 스모크 테스트: `docs/SETTLEMENT_FINAL_3MIN_SMOKE.md`
- 개발단계 교육팩: `docs/DEV_TRAINING_PACK.md`

## 1) Vercel 환경변수 설정

### Dashboard
1. Vercel Project > `Settings` > `Environment Variables`
2. 아래 변수 추가:
   - `SETTLEMENT_ALLOWED_ROLES`
   - 값: `admin,finance_manager`
3. `Production`, `Preview`, `Development` 모두 적용
4. 재배포

### CLI
```bash
vercel env add SETTLEMENT_ALLOWED_ROLES production
# 값 입력: admin,finance_manager

vercel env add SETTLEMENT_ALLOWED_ROLES preview
# 값 입력: admin,finance_manager

vercel env add SETTLEMENT_ALLOWED_ROLES development
# 값 입력: admin,finance_manager
```

## 2) 로컬 개발 환경변수

`.env.local`에 추가:
```bash
SETTLEMENT_ALLOWED_ROLES=admin,finance_manager
```

적용 후 개발서버 재시작:
```bash
npm run dev
```

## 3) Supabase 사용자 role 설정

1. Supabase SQL Editor에서 `scripts/settlement_role_bootstrap.sql` 실행
2. 실행 전 `admin@example.com`, `finance@example.com`를 실제 운영 이메일로 교체
3. 검증 쿼리 결과에서 `app_role` 반영 확인

## 4) RLS 정책 점검

1. `scripts/settlement_rls.sql`이 최신 상태인지 확인
2. `/settlements` 접속
3. `권한/RLS 점검` 버튼 실행
4. 기대 결과:
   - `PASS(read): settlement_cases`
   - `PASS(read): settlement_lines`
   - `PASS(read): refund_payments`
   - `PASS(write): audit_logs`
   - `PASS(exec): create_settlement_case`

## 5) 운영 시나리오 테스트

1. `/members`
   - 케이스 없는 인물에서 `케이스 생성` 클릭
2. `/settlements`
   - 생성된 케이스 확인
   - `지급등록` 클릭 후 모달로 금액/지급일/수령인/참조번호 입력
3. 결과 확인
   - 과지급 차단 메시지
   - 중복 참조번호 차단 메시지
   - 성공 시 토스트 표시
4. `/payments`, `/members`
   - KPI/잔여 금액 반영 확인

## 6) 운영 역할 권장

1. `admin`: 정책 변경/일괄 작업/지급 등록 가능
2. `finance_manager`: 지급 등록/점검 가능
3. 일반 사용자: 정산 쓰기 액션 차단

## 7) 트러블슈팅

1. `정산 작업 권한이 없습니다.`
   - `SETTLEMENT_ALLOWED_ROLES` 확인
   - 사용자 `app_metadata.role` 확인
2. `권한/RLS 점검 이슈 발견`
   - `settlement_rls.sql` 재적용 여부 확인
   - Supabase 로그에서 `permission denied`, `row-level security` 확인
3. 지급등록 실패
   - 과지급/중복 참조번호/케이스 상태(`rejected`) 여부 확인
