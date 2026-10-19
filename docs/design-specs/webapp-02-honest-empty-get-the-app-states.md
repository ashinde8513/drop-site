# Spec 02: Honest empty and "Get the app" states

Status: prepared, awaiting design. Written 2026-10-19. Docs only, nothing built.

## Claude design project header
- Project: **Drop Website** (`5b6f000f-c206-44b6-ab8a-5981e36f2af9`)
- Suggested screen names: `Empty / Get the app (desktop)`, `Empty / Get the app (mobile)`, `Empty / Not yet on web (variants)`, `Get the app page (fixed QR)`
- Extends: the shared `.empty` component and these existing screens in `index.html`: CREW (Friends / Crews tabs), PLAN DETAIL, CREW BUILDER INTERSTITIAL, NOTIFICATIONS, SEEN HISTORY, TAGGED CONSENT INBOX, DROP+ WALLET, BLOCKED ACCOUNTS, INVITE FRIENDS, ADMIN, plus the GET THE APP page.

## Purpose and user value
The web has screens whose data is a hard-coded empty list (`FRIENDS`, `PLANS`, `NOTIFS`, `BLOCKED`, `SEEN_HISTORY`, `LEDGER`, `TAGGED`, `REPORTS`, `COMMENTS`, `REVIEW_QUEUE`, app.js ~1003-1050). They can only say "nothing here", which reads as broken or as the user's own failure ("No friends yet. Invite your crew."). Ranked gap list, spec stub 2. The fix is one honest pattern: say what the feature does, say it lives in the app (or is coming to web), give one primary button. It also stops the trust problem from the audit: no screen should imply something happened or exists when it does not.

## Backend contract that already exists
None needed. This is presentation only. Two inputs drive which variant shows:
- Whether the feature has a web backend wired (decided by the build lane per screen, see specs 03 and 05 for when a screen graduates to a real empty state).
- Whether the user has real data. A real empty state (nothing yet) differs from a "not on web" state.
Download targets already exist in the app: `downloadIos`, `downloadAndroid`, `downloadApp` handlers and the GET THE APP page. The page currently shows a QR code drawn with a CSS conic gradient (a pattern, not a scannable code) and the text "drop.fm/app". Design must replace it with a real QR for the real download URL or remove it; that URL is for the build lane to confirm. Unverified: whether `drop.fm/app` is a live domain.

## Two kinds of empty state (designer must keep them visually distinct)
A. **Not on web yet** (feature exists in the app only): explains the feature and sends to the app.
B. **Real empty** (feature works on web, user has no data yet): explains how to get the first item and offers the web action.
Never use the "not on web" pattern for a feature that actually works on web, and never show a real-empty state for something that cannot work.

## States
1. **Loading**: for type B only. Skeleton in the shape of the list: three rows, each avatar circle plus two text lines. Type A has no loading state because nothing loads.
2. **Type A frame (default)**: icon, title, body, primary button, optional text link.
3. **Type B frame**: icon, title, body, primary button for the web action, optional ghost "Get the app".
4. **Error** (type B): "We couldn't load this." with ghost button "Try again". Never convert an error into an empty state.
5. **Success**: not applicable; the list replaces the empty state.

## Layout, desktop (1024 and up)
- Reuse `.empty`: centered column, `gap: var(--sp-md)`, padding `var(--sp-xxxl) var(--sp-xl)`, title `.empty__title`, body `.empty__body`. Widen `.empty__body` max-width from 260px to about 420px on desktop so lines are not cramped (new modifier `.empty--wide`, the only new class).
- Icon: replace the large emoji (`.empty__ico`, 48px) with a 48px glyph from one consistent icon style (the existing emoji looks different per OS; the style consistency rule asks for one style). Designer picks the set; it must be the same for all variants.
- Below the body: ONE primary button `.btn.btn--primary`, width auto (min 220px), label per variant (copy table).
- Below the button: optional plain text link (`--accent`) for the web alternative.
- Optional "How it works" strip for the big three (Friends, Plans, Notifications): three small facts in `--fs-sm`, `--text-secondary`, no fake numbers.
- Desktop only extra: a small card on the right with the real QR, caption "Scan to install on your phone". Only if the QR is real.

## Layout, mobile (430 and below)
- Same `.empty` structure, 16px side gutters.
- Primary button is `.btn--block` (full width) and pinned in the thumb zone: either sticky above the tab bar (`bottom: 84px` plus safe area) or at the end of the visible content when the screen is short. Designer picks one and uses it everywhere.
- On a phone the button label is "Open in the Drop app" if the app is detected as installable, otherwise "Get the Drop app". The web cannot know if the app is installed; default to "Get the Drop app" and keep the universal link behavior to the build lane.
- Secondary text link stays below as plain text, at least 44px tall hit area.

## Copy (every variant, no fake data)
Primary button is always one action; label says what it does.

| Screen | Type | Icon idea | Title | Body | Primary | Secondary |
|---|---|---|---|---|---|---|
| Friends (Crew tab) | A until spec 03 ships | people | Friends live in the app | See which friends are going, send requests, and plan nights out. We are bringing this to the web. | Get the Drop app | Invite someone by link (only if copy link really copies) |
| Crews | A | group | Crews live in the app | Make a crew and plan shows together in the app. | Get the Drop app | none |
| Plans / Crew Builder | A | calendar | Plans live in the app | Pick a show, invite friends, and chat about it in the app. | Get the Drop app | Browse shows |
| Notifications | A | bell | Alerts need the app | Presale and show alerts are sent to your phone. The web can't send them yet. | Get the Drop app | none |
| Seen history | A | clock | Your seen history is in the app | The app keeps your full history. On the web, add past shows one at a time. | Log a past show | Get the Drop app (text link) |
| Tagged inbox | A | tag | Tags are handled in the app | When a friend tags you in a show, you accept it in the app. | Get the Drop app | none |
| Wallet / ledger | A | wallet | Cashback shows up in the app | We track ticket cashback in the app. | Get the Drop app | none |
| Blocked accounts | B (real empty) once spec 03 ships | shield | You haven't blocked anyone | People you block can't see you or message you. | Back to settings | none |
| Real empty list, general | B | n/a | Nothing here yet | {one sentence on how the first item appears} | the web action | Get the Drop app |
| Generic error | n/a | alert | We couldn't load this | Check your connection and try again. | Try again | none |

Rules for copy: no "coming soon" unless the roadmap lane has confirmed it (the audit says Drop+ checkout is "coming soon" in the app too; do not promise dates). No claims about contact sync or "see friends going" on web until real (the web FAQ currently promises both; flag to the copy owner). No numbers, names, or avatars that are not real.

## Accessibility
- Title is a real heading at the correct level (h1 for the screen if it is the only content, else h2). Body is a paragraph.
- Icon is decorative: `aria-hidden="true"`; the title carries the meaning.
- The primary button is the first focusable element after the heading; text link is next.
- Contrast: title and body use `--text` and `--text-secondary` on `--bg`/`--surface` (above 10:1). Do not use `--text-muted` for body here; on `--surface-hi` it is 3.86:1 and fails.
- When a type B list loads and replaces an empty state, move focus to the list heading or announce via `aria-live="polite"`.
- Error variant uses `role="alert"`.

## Out of scope
- Building any of the underlying features (see spec 03).
- Deep links into the app for specific screens (universal links are a separate lane).
- Smart app banners, device detection, push permission prompts.
- Promoter and admin screens (the audit recommends a plain "use the app" message; use type A with title "{Tool} lives in the app" and body "These tools aren't on the web.").
- Fixing the site-wide FAQ copy (flagged only).

## Acceptance checklist
- [ ] One pattern, frames for type A and type B, desktop and mobile.
- [ ] Exactly one primary button per frame; all secondary actions are ghost or plain links.
- [ ] Every button label names its action ("Get the Drop app", "Log a past show"), never "OK" or "Yes".
- [ ] Mobile primary button is in the thumb zone.
- [ ] Type B has a skeleton loading frame and an error frame; type A does not fake a load.
- [ ] No fake data, names, counts, avatars, or "coming soon" dates in any frame.
- [ ] One consistent icon style across all variants.
- [ ] Get the app page uses a real QR or no QR.
- [ ] Copy table is reviewed against the real feature status before the build starts.
