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

---

# Signed-in web parity design QA

## Evidence

- Source visual truth:
  - `/var/folders/ph/ycq201hd37v1qr0t27bgt32w0000gn/T/TemporaryItems/NSIRD_screencaptureui_B0Izmc/Screenshot 2026-07-28 at 8.27.38 AM.png`
  - `/var/folders/ph/ycq201hd37v1qr0t27bgt32w0000gn/T/TemporaryItems/NSIRD_screencaptureui_THSXvQ/Screenshot 2026-07-28 at 8.27.46 AM.png`
  - `/var/folders/ph/ycq201hd37v1qr0t27bgt32w0000gn/T/TemporaryItems/NSIRD_screencaptureui_NZhUO7/Screenshot 2026-07-28 at 8.28.10 AM.png`
  - `/var/folders/ph/ycq201hd37v1qr0t27bgt32w0000gn/T/TemporaryItems/NSIRD_screencaptureui_PFEk11/Screenshot 2026-07-28 at 8.28.37 AM.png`
- Browser-rendered implementation:
  - `/tmp/drop-parity-desktop-map.png`
  - `/tmp/drop-parity-desktop-shows.png`
  - `/tmp/drop-parity-desktop-friends.png`
  - `/tmp/drop-parity-desktop-plans.png`
  - `/tmp/drop-parity-desktop-festivals.png`
  - `/tmp/drop-parity-desktop-schedule.png`
  - `/tmp/drop-parity-desktop-live.png`
  - `/tmp/drop-parity-desktop-notifications.png`
  - `/tmp/drop-parity-mobile-shows.png`
  - `/tmp/drop-parity-mobile-friends.png`
  - `/tmp/drop-parity-mobile-festivals.png`
- Combined comparison evidence:
  - `/tmp/drop-map-comparison.png`
  - `/tmp/drop-map-focused-comparison.png`
  - `/tmp/drop-map-1440-comparison.png`

## Normalization

- Target desktop state: signed-in Map, dark theme, Map selected, Any time selected.
- Target runtime viewport: 1440 x 900 CSS px at device scale factor 1.
- The source PNG is 830 x 609 px and contains a design-board canvas. Its embedded 1440 desktop app frame was cropped at approximately 695 x 390 px and normalized to 1440 x 808 px.
- The implementation is 1440 x 900 px and was compared at the same 1440 px width with its top 808 px visible.
- Mobile captures use 390 x 844 CSS px at device scale factor 1.

## Findings and comparison history

### Iteration 1

- P2 · Map surface was a dark CSS approximation rather than a real map.
  - Fix: replaced the approximation with attributed OpenStreetMap raster tiles and positioned connected event pins over the correct Web Mercator tile coordinates.
- P2 · Map used a permanent results rail and a duplicate page heading, shrinking the primary map compared with the approved frame.
  - Fix: removed the duplicate heading and added the approved working List/Map control. Map is the default full-width state; List presents the connected event rows.
- P2 · Map date controls were incomplete.
  - Fix: added This week and a working Pick dates input alongside Any time, Today, and This weekend.
- P2 · The intermediate-width map became too narrow.
  - Fix: made the map full width below 1100 px and verified the 830 x 609 comparison.
- P2 · Mobile My Shows clipped the trailing RSVP status.
  - Fix: constrained the row copy and preserved the status pill within the 390 px viewport.

### Final comparison

- Fonts and typography: Space Grotesk/Sora hierarchy, weights, compact labels, and truncation follow the Prism system and remain readable at both target widths.
- Spacing and layout rhythm: side navigation, header, filters, map frame, cards, schedule rows, and mobile bottom navigation align with the approved shell proportions. No horizontal overflow was found.
- Colors and visual tokens: deep navy surfaces, restrained cyan/magenta emphasis, borders, and selected states match the approved Prism language.
- Image quality and assets: event art uses connected artwork, UI icons use Phosphor, and the map uses real OpenStreetMap tiles with visible attribution. No placeholder drawing remains.
- Copy and content: loading, empty, and error treatments are conditional runtime states. Ready-state screens use connected Drop entities and actions rather than design-board labels or fake state switches.
- Remaining differences are intentional: the source Map board shows an unloaded pale map canvas and example Ready/Loading/Empty/Error controls; the runtime shows the useful ready state with real tiles and does not expose design-only state controls.
- Focused regions were required for the shell, date controls, Map/List toggle, and map frame; `/tmp/drop-map-1440-comparison.png` is the final normalized evidence.

## Browser verification

- Automated interactions tested: desktop/mobile navigation; My Shows tabs and canonical history de-duplication; plan creation with creator membership; festival schedule selection; Live Mode check-in; past-show conflict resolution; public friend-profile routing; blocked-user filtering.
- Browser-inspected interactions: Map/List and date filters; Friends, Crews, Plans, Festivals, Notifications, and mobile route layouts.
- Console and page errors across the captured desktop and mobile routes: none.
- Desktop overflow at 1440 x 900: false.
- Mobile overflow at 390 x 844: false.

final result: passed
