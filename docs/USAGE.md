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
  - **타임라인**: 전화/미팅 상담 이력 기록 및 조회 (카드형 다크 UI 적용)
  - **새로운 활동 기록**: 상세 페이지에서 즉시 상담 내용 입력 및 저장 가능
  - **과거 이력**: 마이그레이션된 엑셀 데이터(`raw_data`) 원본 확인

### 💰 자금/권리 관리 (ERP)
- **대시보드**: `http://localhost:3000/finance`
- **통계**: 전체 과거 기록 수, 환불 대상자 수, 권리증 보유자 수
- **권리증 데이터**: 엑셀에서 추출한 권리증 보유 현황 및 원본 데이터 조회

### 📱 모바일 최적화 기능 (Adaptive UI)
- **접근 방법**: 모바일 기기로 접속 시 자동으로 전용 레이아웃으로 전환됩니다 (또는 브라우저 창 너비 축소).
- **하단 내비게이션**: 한 손 조작이 용이한 하단 고정 탭 바 (홈, 회원, 타임라인, 자금).
- **현장 특화 기능**:
  - **모바일 검색**: 대시보드 상단 검색창 터치 시, 즉시 전체 조합원 검색 팝업 실행 (이름/동호수).
  - **퀵 액션**: 회원 정보에서 즉시 전화, 문자 발송 및 상담 기록 추가 가능.
  - **풀스크린 시트**: 작은 화면에서도 정보를 명확히 볼 수 있는 전체 화면 프로필 뷰.
  - **자금 통합 뷰**: 
    - ERP 연동을 통해 전체 수납액, 미납액 통계를 실시간 그래프로 제공.
    - 회차별(1차, 2차...) 납부 상태 및 개인별 상세 미납 내역 추적 가능.

### 📱 안드로이드 앱 설치 (Native App)
- **APK 설치**: 
  1. 개발자에게 제공받은 `app-debug.apk` (또는 ZIP) 파일을 다운로드합니다.
  2. 안드로이드 폰에서 파일을 실행하여 설치합니다. (보안 설정 > '이 출처 허용' 필요)
- **특징**: 웹사이트(`people-on.vercel.app`)와 자동 동기화되며, 앱스토어 심사 없이 최신 기능을 사용할 수 있습니다.

## 4. 폴더 구조
- `src/app`: Next.js App Router 페이지
- `src/components`: UI 컴포넌트 (shadcn/ui) 및 기능별 컴포넌트
- `src/lib/supabase`: Supabase 클라이언트 설정
- `scripts/`: 데이터 마이그레이션 및 DB 설정용 파이썬/SQL 스크립트
