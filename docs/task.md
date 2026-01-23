# 📋 People On Web Application - 개발 태스크 목록

## 🎉 구현 완료 현황

### ✅ Phase 1: 인증 시스템 (100%)
| Task | 파일 |
|------|------|
| 로그인 (다크/라이트) | `(auth)/login/page.tsx` |
| 회원가입 | `(auth)/signup/page.tsx` |
| 비밀번호 재설정 | `(auth)/forgot-password/page.tsx` |

### ✅ Phase 2: 대시보드 (100%)
| Task | 파일 |
|------|------|
| PC 대시보드 + KPI | `(dashboard)/page.tsx` |
| 모바일 | 반응형 적용 |

### ✅ Phase 3: CRM 조합원 관리 (100%)
| Task | 파일 |
|------|------|
| 조합원 명부 | `(dashboard)/members/page.tsx` (디자인 고도화 완료) ✨ |
| 상세 팝업 - 기본정보 | `MemberDetailDialog.tsx` |
| 상세 팝업 - 관리이력 | `ActivityTimelineTab.tsx` |
| 상세 팝업 - 납부현황 | `PaymentStatusTab.tsx` |
| 상세 페이지 | `members/[id]/page.tsx` |

### ✅ Phase 4: ERP 자금관리 (100%)
| Task | 파일 |
|------|------|
| 분담금 수납/미납 | `(dashboard)/payments/page.tsx` ✨신규 |
| 권리/환불 관리 | `(dashboard)/finance/page.tsx` |

### ✅ Phase 5: 행정 자동화 (80%)
| Task | 파일 |
|------|------|
| 대량 문자 발송 | `(dashboard)/sms/page.tsx` ✨신규 |
| 주소 라벨 PDF | ⏳ 추후 (jspdf) |

### ✅ Phase 7: DB 연동 (100%)
- `interaction_logs` 테이블 연동 완료
- `payments` 테이블 연동 완료

### ✅ Phase 8: UI/UX (100%)
- 다크/라이트 테마 토글 (`next-themes`)
- 반응형 레이아웃 (Tailwind)
- 설정 페이지 (`(dashboard)/settings/page.tsx`)
- **디자인 고도화**: 대시보드 UI 첨부 이미지와 100% 일치하도록 리팩토링 ✨신규

---

## 📁 신규 생성 파일 (이번 세션)

```
src/app/(dashboard)/
├── payments/page.tsx      # 분담금 관리
├── sms/page.tsx           # 대량 문자 발송
├── timeline/page.tsx      # 활동 타임라인
└── settings/page.tsx      # 설정

src/components/features/members/
├── ActivityTimelineTab.tsx  # 관리 이력 탭
└── PaymentStatusTab.tsx     # 납부 현황 탭
```

---

## 🔧 추가 구현 필요 (선택)
- [ ] PDF 라벨 생성 (jspdf 라이브러리)
- [ ] SMS API 연동 (외부 서비스)
- [ ] AI 태그 자동화 (OpenAI API)
