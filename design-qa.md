# Event detail metadata and lineup design QA

- Source visual truth: `/tmp/codex-remote-attachments/019f7d4c-5ccc-7440-b88e-14ed07487220/8386546F-6CA0-4E67-837A-47A8F3A40C62/4-Photo-4.jpg`
- Reported lineup overflow: `/tmp/codex-remote-attachments/019f7d4c-5ccc-7440-b88e-14ed07487220/15504FD2-7F4F-4195-B3B7-BBA5F871AA7F/1-Photo-1.jpg`
- Desktop implementation: `/private/tmp/drop-event-desktop-meta-below.png`
- Mobile implementation: `/private/tmp/drop-event-mobile-lineup-contained.png`
- Focused comparison: `/private/tmp/drop-lineup-comparison.png`
- Viewports: 1280 × 800 desktop; 390 × 844 mobile
- State: real Treehouse BASS BINGO AFTERS event, signed out

## Full-view comparison evidence

Desktop keeps the supplied event art unobstructed. Genre and title follow the art, then the date/venue card. The sticky ticket panel remains in the right column. Mobile retains the same hierarchy and content gutters.

## Focused comparison evidence

The before/after lineup comparison shows the original single-line pill extending beyond the right content edge. The implementation wraps that same live lineup text inside a 351px pill whose left/right edges match the 351px date/venue and ticket cards. Document `scrollWidth` and `clientWidth` both equal 375px.

## Required fidelity surfaces

- Fonts and typography: existing Space Grotesk/Sora hierarchy, weights, and line heights retained; only long lineup text wrapping changed.
- Spacing and layout rhythm: poster-first hierarchy matches the app reference; cards and lineup share the same gutter; desktop ticket column is unchanged.
- Colors and visual tokens: existing Prism surface, border, text, and gradient tokens retained.
- Image quality and asset fidelity: live event art is unchanged and no longer carries a desktop text scrim.
- Copy and content: live event title, lineup, date, venue/city/state, ticket seller, and actions are preserved.

## Findings

No actionable P0, P1, or P2 differences remain for the requested metadata placement or lineup containment.

## Comparison history

- Earlier P1: desktop title/date/venue overlaid event art. Fixed by using the existing mobile below-art structure at every viewport and keeping date/venue in the shared facts card.
- Earlier P1: long mobile lineup pill exceeded the content boundary. Fixed with page-scoped wrapping and width containment; post-fix live geometry is 12px to 363px inside a 375px document.
- Review P2: moving the desktop caption initially dropped city from the facts card. Fixed by preserving `Venue · City, ST` in the shared venue link.

## Interaction and console checks

- Search `BASS BINGO AFTERS` → live Treehouse result appears → event detail loads.
- Browser warnings/errors: none.
- Framework error overlay: none.

final result: passed
