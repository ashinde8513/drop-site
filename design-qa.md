# Foundation 1A web parity design QA

- Approved Claude design: `/private/tmp/drop-web-parity-design/foundation-login-desktop.png`, `foundation-shell-desktop.png`, `foundation-settings-desktop.png`, `foundation-shell-mobile.png`
- Implementation: `/private/tmp/drop-web-parity-design/implementation-login-desktop.png`, `implementation-login-mobile.png`
- Viewports: 1440 × 900 desktop; 390 × 844 mobile

## Comparison

The implementation keeps the public website's Prism header, location/search/browse language, typography, dark surfaces, restrained gradient CTA, and account entry points. The signed-in desktop shell adds a compact left rail beneath that same header; mobile replaces it with the approved compact header and bottom navigation. The login panel, input geometry, responsive gutters, focus states, and split-story layout match the approved direction without copying mobile layouts onto desktop. Facebook was added beside the approved Google and Apple controls because it is production-reachable in the mobile app.

No broken layout, cropped content, horizontal overflow, incorrect border geometry, or unresolved P0–P2 visual difference remains at the checked viewports. Demo event cards from the design stay design-only; the preview renders honest empty states until each later parity slice is approved and wired.

final result: passed

---

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
