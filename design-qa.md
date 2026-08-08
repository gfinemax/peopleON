# PeopleON unified member workspace design QA

- Source visual truth: `C:\Users\finemax\.codex\attachments\9502d4c0-9c42-4b09-ae8d-618fcc65baaf\image-1.png`
- Implementation route: `https://people-on.vercel.app/members/{memberId}?tab=info`
- Implementation screenshot: unavailable
- Intended viewport: desktop 1746 x 1408 CSS px, device scale factor 1
- Source pixels: 1746 x 1408
- Implementation pixels: unavailable
- State: authenticated member detail, unified-info tab
- Density normalization: not possible without an implementation capture

## Full-view comparison evidence

The source screenshot was opened and inspected. The implementation could not be opened in the available browser because the browser security policy could not be verified for either the local or deployed PeopleON URL. A valid same-viewport comparison therefore could not be produced.

## Focused-region comparison evidence

Unavailable for the same blocker. The intended focused regions are the member header/actions, tab bar, unified-info content, and compact quick-preview dialog.

## Findings

- P0: Browser-rendered implementation evidence is missing.
  - Impact: layout, interaction, responsive behavior, console errors, typography, spacing, colors, icons, and copy cannot be visually accepted.
  - Required fix: restore permitted browser access, capture the authenticated implementation, compare it with the source, and fix any P0/P1/P2 differences.

## Required fidelity surfaces

- Fonts and typography: blocked pending implementation capture.
- Spacing and layout rhythm: blocked pending implementation capture.
- Colors and visual tokens: blocked pending implementation capture.
- Image quality and asset fidelity: the source contains no new raster imagery requiring generation; implementation inspection remains blocked.
- Copy and content: code-level review completed, visual verification blocked.

## Primary interactions pending browser verification

- Member row opens `/members/{id}` and preserves the filtered return URL.
- Name opens compact quick preview.
- Rights, activity, and settlement controls open their corresponding URL tab.
- Tab selection updates the URL.
- Back control restores the prior member-list state.
- Existing edit, save, rights merge/unmerge, payment, and activity workflows remain operational.
- Browser console contains no errors.

## Comparison history

- Initial pass: blocked before implementation capture; no visual fixes can be evidence-backed yet.

final result: blocked
