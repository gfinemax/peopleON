# Design QA

- Source visual truth: user-attached PeopleON member workspace screenshot, original 1957 x 1598 px, showing the clipped relationship phone and partially hidden document column
- Implementation screenshot: `implementation-member-columns-1957x1598.png`
- Implementation route: `https://people-on.vercel.app/members/cfd47003-06f2-462e-a17c-f94ad9f47460`
- Requested viewport override: 1957 x 1598 px
- Browser content viewport: 1779 x 1453 CSS px
- Implementation pixels: 1957 x 1598 px browser capture
- Density normalization: browser capture and source attachment were reviewed at their original pixel dimensions; comparison focused on the four-column workspace rather than member-specific content
- State: authenticated production member detail, dark theme, default column widths

## Full-view comparison evidence

The production grid rendered all four columns inside the visible content viewport. Measured column bounds were 12-428, 436-851, 859-1378, and 1386-1767 CSS px; every right edge remained inside the 1779px viewport. The document column no longer depends on horizontal page overflow.

## Focused region comparison evidence

- The relationship row uses a flexible name region, a compact right-aligned relationship region, and a non-shrinking right-aligned telephone number. `010-9280-2829` rendered in full against the inner right edge of the first column.
- The consultation column body and metadata use flexible minimum widths, truncation, and word wrapping, so text reflows when the column boundary changes.
- Keyboard resizing at the consultation/document separator changed widths from 339/248px to 323/264px. Reset restored 339/248px.
- Existing edit, payment, consultation, document, and navigation controls remained present in the rendered DOM.

## Required fidelity surfaces

- Fonts and typography: existing Noto Sans KR hierarchy, weights, line heights, and tabular number styling are preserved. Telephone numbers remain single-line.
- Spacing and layout rhythm: existing 8px separators, card padding, borders, and four-column rhythm are preserved; only track sizing and relationship-row alignment changed.
- Colors and visual tokens: no color or theme token changes.
- Image quality and asset fidelity: no image or icon assets changed.
- Copy and content: no labels or stored member values changed.

## Findings

- No actionable P0, P1, or P2 mismatch remains for the requested relationship-phone and column-resizing scope.
- Existing console warnings are unrelated to this change: browser-extension stream warnings and a pre-existing Radix dialog description warning.

## Primary interactions tested

- Production member detail opened in the authenticated browser session.
- All four workspace columns were measured for viewport containment.
- Consultation/document separator was resized with the keyboard.
- Column-width reset restored the default proportions.

## Comparison history

- Earlier implementation: relationship phone used a fixed 130px grid track and the grid enforced a summed pixel minimum width, allowing the last column to move outside the visible area.
- Fix: relationship rows now use flexible layout with a non-shrinking right-aligned phone; grid tracks use `minmax(0, fr)`; resize minimums scale to the available viewport; default proportions were migrated to version 2.
- Post-fix evidence: all four measured column bounds are inside the viewport and the full phone number is visible.

## Final result

final result: passed
