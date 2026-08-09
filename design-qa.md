# Design QA

- Source visual truth: user-attached four-column member overview reference in the 2026-08-09 request
- Implementation route: `http://127.0.0.1:3001/members/[id]`
- Intended viewport: desktop, 1488 x 1027 CSS px
- State: authenticated member detail, unified overview
- Implementation pixels: unavailable
- Density normalization: code-level only because browser capture was blocked

## Full-view comparison evidence

The implementation now uses the existing global sidebar plus a single `통합현황` header. The removed preset/column-selection navigation is not rendered. The member summary and workspace are fixed to four dense columns: `기본·관계인`, `권리·납부`, `상담·활동`, and `문서`.

The in-app browser could not open the local implementation because the admin-enforced browser access policy could not be verified. A browser-rendered screenshot therefore could not be captured in this run.

## Focused region comparison evidence

Code inspection confirms the following source-aligned regions:

- Member identity row with a private profile image, fallback initial, status, member number, phone, key status metrics, edit/delete/share/back actions.
- Four equal-width comparison columns with 360px readable minimum width and horizontal overflow on narrower screens.
- One-line labels, values, amounts, dates, and relationship phone numbers; memo and consultation summaries are the intentional multi-line exceptions.
- Existing edit, payment, activity, and certificate management views remain available in the management modal opened from each column.

## Findings

- [P1] Browser visual comparison unavailable
  - Location: full member overview and management modal
  - Evidence: local navigation was denied before rendering.
  - Impact: exact typography, vertical density, overflow, modal stacking, and responsive alignment cannot be visually certified.
  - Fix: repeat the local browser capture after the admin browser policy becomes available.

## Primary interactions tested

- Static wiring verified: fixed four-column rendering, edit/delete/print/back actions, per-column management tab routing, private profile-image upload/delete API, signed image retrieval, and attachment preservation.
- Production TypeScript build and focused ESLint completed successfully.
- Browser clicks for photo upload, management modal tabs, and member-list return could not execute because the browser policy check was unavailable.

## Console errors checked

- Not available because the local page could not be opened in the in-app browser.

## Comparison history

- Sidebar control iteration: moved the fixed collapse/expand control from vertical center to `calc(5mm + env(safe-area-inset-bottom, 0px))`, preserving its expanded/collapsed horizontal positions and 120px vertical form.
- Removed the prior `PeopleON 조합원 관리` preset menu and column picker from the page header.
- Replaced the workspace with the fixed four-column unified overview while preserving the detailed editing workflows in a modal.
- Added private member photo storage, square crop/resize, replace/delete controls, signed delivery, fallback initials, and audit logging.
- Increased information density without reducing body values below readable sizes; relationship phone numbers and core field/value pairs are held to one line.

## Final result

final result: blocked
