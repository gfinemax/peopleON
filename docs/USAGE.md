# People On - Web Application 사용 설명서

## 1. 환경 설정 (Environment Setup)
웹 애플리케이션 실행을 위해 Supabase 연결 키 설정이 필요합니다.

1. `web/.env.local` 파일을 엽니다.
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` 값을 입력해주세요.
   - 키는 [Supabase Dashboard](https://supabase.com/dashboard) > Project Settings > API 에서 `anon` `public` 키를 복사하면 됩니다.

```bash
# web/.env.local 예시
NEXT_PUBLIC_SUPABASE_URL=https://qhmgtqihwvysfrcxelnn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb... (여기에 붙여넣기)
```

> **주의**: `service_role` 키는 보안상 절대 `NEXT_PUBLIC_` 변수에 넣지 마세요.

## 2. 실행 방법 (Run)

터미널에서 아래 명령어로 개발 서버를 실행합니다.

```bash
cd web
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속합니다.

## 3. 구현된 기능 (Features)

### 👥 조합원 관리 (CRM)
- **대시보드**: `http://localhost:3000/members`
- **조합원 검색**: 이름, 동호수, 전화번호로 실시간 검색
- **상세 페이지**: 
  - 기본 정보 (등급, 평형, 상태)
  - **타임라인**: 전화/미팅 상담 이력 기록 및 조회
  - **과거 이력**: 마이그레이션된 엑셀 데이터(`raw_data`) 원본 확인

### 💰 자금/권리 관리 (ERP)
- **대시보드**: `http://localhost:3000/finance`
- **통계**: 전체 과거 기록 수, 환불 대상자 수, 권리증 보유자 수
- **권리증 데이터**: 엑셀에서 추출한 권리증 보유 현황 및 원본 데이터 조회

## 4. 폴더 구조
- `src/app`: Next.js App Router 페이지
- `src/components`: UI 컴포넌트 (shadcn/ui) 및 기능별 컴포넌트
- `src/lib/supabase`: Supabase 클라이언트 설정
- `scripts/`: 데이터 마이그레이션 및 DB 설정용 파이썬/SQL 스크립트
