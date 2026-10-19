# Web app audit (app.trydropapp.com SPA) - 2026-10-19

Scope: `app/app.js` (3,619 lines), `app/index.html` (3,242), `app/app.css`, `app/tokens.css`, `workers/app-path/*`, `_headers`, `data.js`, tests. Base: origin/main 941a540. Read-only; no live sign-in; no credentials used. Facts for Supabase come from the coordinator's live queries 2026-10-19 (grants file + follow-up SQL), cited as "live query 2026-10-19".

## Summary
- Profile writes are S1-safe: the SPA only ever sends `display_name, username, bio, city, state` (app.js:3487) and never reads or spreads `is_admin/is_plus/is_plus_until`. S1 will not break the SPA.
- Biggest real risk is client-side: any transient `signup_compliance_status` failure on boot makes the SPA call `supabase.auth.signOut()` whose vendored default scope is **global**, revoking the user's sessions on every device including the mobile app.
- Perf is dominated by the full-catalog boot fetch (all upcoming events, paged 1000, plus festivals) and a 295 KB no-store shell; a11y is clean except `/terms` link style and an unlabeled date field on the demo "Suggest" screen.

Severity key: 🔴 fix first, 🟡 should fix, 🔵 nice to have.

---

## 1. Auth flows

Where tokens live: Supabase default `localStorage` key `sb-ebccwnkmsnhbljxxxdej-auth-token` (access + refresh token, plus `...-code-verifier` for PKCE) - app.js:414-418. Non-secret extras: `localStorage drop.creatorCode`, `drop.pendingReferral` (24 h TTL); `sessionStorage drop.signup.oauth-compliance` (holds the user's **date of birth** during the OAuth redirect, removed on take), `drop.eventIntent`, `drop.tiktok.oauth` (state + PKCE verifier). No plaintext password/token is copied into SPA state: login/signup/reset passwords are read once via `fieldVal()` from the uncontrolled DOM input (app.js:3340-3345, 3136) - verified by reading; `auth-input-preservation.spec.ts` covers DOM preservation only.

| # | Sev | file:line | Evidence | Proposed code-only fix | Test | Blast radius |
|---|-----|-----------|----------|------------------------|------|--------------|
| A1 | 🔴 | app.js:1756-1768 (also 1721, 1915, 1920, 1963) | `afterLogin()` runs on every boot. If `signup_compliance_status` errors (network blip, 5xx, RLS) `compliance` becomes `'unavailable'`, which is `!== 'complete'`, so it calls `supa.auth.signOut()` and shows "Could not confirm the account requirements". Vendored SDK default `signOut()` scope is `global` (vendor/supabase.js, `scope:\`global\``): this revokes refresh tokens on all devices, mobile app included. Same call used by explicit Log out (1915/1920) and the SIGNED_OUT path. | (a) On `status.error`/`unavailable` do NOT sign out; show retry banner and keep session. (b) Use `signOut({scope:'local'})` for compliance rejections and for Log out unless a "sign out everywhere" control is added. | Playwright with fake client: rpc returns `{error}` on boot, assert `signOut` not called and session still set; second test asserts `signOut` called with `{scope:'local'}` on Log out. | auth.js only; all logged-in web users. Low regression risk. |
| A2 | 🟡 | app.js:483 vs 3384 | OAuth signup completes with `SIGNUP_PRIVACY_VERSION='2026-07-18'`, password signup sends `privacy_version:'2026-08-11'` (privacy.html says "Last updated: August 11, 2026"). Either OAuth records stale consent, or `complete_signup_profile` rejects it ("current terms/privacy", surfaced at app.js:1700-1703 as "Accept Drop's current Terms...") - unverified which. Terms constant `2026-07-18` is repeated as a literal at 3382. | One `LEGAL_VERSIONS` constant used by both paths and by `pendingOAuthCompliance()`; confirm the current accepted values with the security lane. | Node/Playwright: password and OAuth paths send identical versions; smoke test greps for a single definition. | signup only. If the server pins 2026-08-11, OAuth signup is currently broken: check first. |
| A3 | 🟡 | app.js:3591-3604 | `SIGNED_OUT` handler resets only `authed,userId,userEmail,profile,stars,rsvp,followingVenue,...` - not `following`, `myShowsRows`, `loggedShows`, `realShowsCount`, `realArtistsCount`, `claimStatus`, `activeArtistRow`. The explicit `logout()` (1910) resets a different, larger set. Expired session or cross-tab sign-out then log in as another user on a shared browser: previous user's My Shows / logged shows stay in memory until the new load succeeds (and if it errors, they persist, since loaders only `console.error`). Also `doLogout` does `go('home')` (3500) but the async SIGNED_OUT event then forces `screen:'login'`. | Single `SESSION_RESET` object used by `logout`, `switchPhoneAccount`, and the SIGNED_OUT handler. | Fake client: user A has myShows rows, fire SIGNED_OUT, assert DOM/state empty; Log out lands on home. | app.js only. |
| A4 | 🟡 | app.js:555-563, 3568, 1783 | Creator code is stored in localStorage with **no TTL** (referral has 24 h). `maybeRecordCreatorReferral()` fires for every login, not only new signups. Stale code on a shared browser could attribute a later account (server has `already_attributed`/`self_referral` results, so impact depends on server rules). | Store `{code, capturedAt}` with 24 h TTL, only record when `user.created_at > capturedAt` (as the referral path already does at 1403-1407); clear on logout. | Unit-style Playwright: expired code not sent; code older than account not sent. | creator program attribution only. |
| A5 | 🔵 | app.js:3135-3146 | After `updateUser({password})` the recovery session stays live and the user is sent to the login screen with "log in" copy; no compliance check, no sign-out. `?mode=reset-password` remains in the URL, so reload returns to the reset screen. | After success `signOut({scope:'local'})`, scrub `mode`, then navigate to login. | Spec: after reset, `signOut` called and URL has no `mode`. | reset flow. |
| A6 | 🔵 | app.js:1825-1845 | `resumeTikTokCallback` only runs from `afterLogin` when a session exists; a signed-out return from TikTok leaves `?tiktok_callback=1&code=...&state=...` in the URL (index.html:8-19 only rewrites the path). `sessionStorage.getItem` at 1827 is unguarded (private mode). | Scrub query on boot whenever `tiktok_callback=1`, wrap storage in try/catch. | Spec: load `/tiktok/callback?code=x&state=y` signed-out, URL scrubbed. | TikTok connect. |
| A7 | 🔵 | app.js:3392 | `signUp` metadata sends `birthdate` (DOB) into Supabase `user_metadata` (readable by the client and in JWT). Compliance is also re-asserted via RPC. If metadata is not needed once `complete_signup_profile` exists, drop it; otherwise route to security lane (PII in JWT). | Confirm with security lane before removing. | Spec asserts payload keys. | signup. |

Checked and fine (no finding): `returnTo` is an open-redirect-proof allow-list (`/event/<uuid>?action&expires` only, app.js:581-598, tested in event-intent.spec.ts); OAuth `redirectTo` is built from `location.origin + location.pathname`, never from input (app.js:520-533, 3386); `detectSessionInUrl` + PKCE and `scrubSignupCompletionUrl` remove `code/token_hash/access_token/...` from query **and** fragment (app.js:524-535); token-hash confirm accepts only `type=email`, length <= 512 (1661-1664, tested); apex forwarder in index.html:13-19 forwards to fixed origins only; `login-with-username` result is passed to `setSession` only when both tokens present (3351). Redirect allow-list in Supabase Auth (app.trydropapp.com/**) was an open item in PROJECT_STATE: **unverified** here (dashboard/security lane).

Signup-compliance gate behaviour when `current_user_signup_complete()` is false: web never keeps such a session, so the "empty-with-403 vs empty-with-no-rows" confusion is mostly avoided: `phone-required` keeps the user on the activation screen with loaders not started (`afterLogin` returns before `loadUserData`, app.js:1759-1763); everything else is signed out (A1). Remaining gap: if the gate flips while already signed in (e.g. phone enforcement turned on), every `supa.from(...)` load returns empty/403 and **all loaders only `console.error`** (app.js:1427-1472, 1385) so the UI shows empty My Shows with no message (see R5).

---

## 2. RLS / GRANT dependence vs S1

"Today" = works against live grants (live query 2026-10-19). "S1" = after profiles INSERT/UPDATE are column-granted excluding `is_admin,is_plus,is_plus_until` and the two protect triggers land.

| Call (app.js line) | Relies on | Today | After S1 | Leak/notes |
|---|---|---|---|---|
| `profiles.select('id,username,display_name,city,state,bio,profile_image,creator_status,creator_code').eq(id,uid)` 1384 | column-level SELECT grant + `can_view_profile(id)` (owner or public, minus blocks) | works (live app) | unchanged (SELECT not revoked) | Own row only. Verify `creator_status,creator_code` are in the column SELECT grant (not listed in facts). |
| `profiles.update({display_name,username,bio,city,state})` 3487 | UPDATE own policy | works | works (all 5 columns stay granted) | No spread of a profile object anywhere; `is_*` never referenced (grep: zero hits in app.js). **S1-safe.** Gap: `.eq('id',uid)` only; no empty-username guard beyond `\|\|null`. |
| `rpc complete_signup_profile` 1693 | SECURITY DEFINER | works | works | creates profile server-side, not via table grant. |
| `rpc signup_compliance_status` 1390,1411,1611,1707,1756 | SECDEF | works | works | 5 call sites; boot + phone-check re-call it (see P4). |
| `rpc record_creator_referral(p_code)` 1392 | SECDEF | works | works | called on every login (A4). |
| `rpc record_signup_referral` 1413 | **not** SECDEF; validates kind/source, self-referral, `referral_signup_eligible()`, inserts `public.referrals(referred_id=caller) on conflict do nothing` (live query 2026-10-19) | works if INSERT policy on `referrals` exists for caller (live app uses it per coordinator) | independent of profiles grants | **But the SPA gate `SIGNUP_REFERRAL_RPC_ENABLED` defaults false** (app.js:566, 1410) so this call is dead in production until a page sets `window.__DROP_SIGNUP_REFERRAL_RPC_ENABLED__ = true`; nothing in the repo sets it outside tests. |
| `review_artist_claim` | SECDEF, starts with `if not is_admin(auth.uid()) raise 'not authorized'` (live query 2026-10-19) | **not called by the SPA at all** (grep zero hits) | n/a | Admin screen (`goAdmin` 3090) is a static demo: `REVIEW_QUEUE/REPORTS/ADMIN_* = []` (app.js:1040-1044). No client-side authorization exists; "Admin (staff)" footer link (index.html:3170) is visible to everybody and just shows empty states (see R2). |
| `attendance` upsert/delete/select 1128-1129, 1426, 1442, 1455, 1506 | own-write policy; read policy | works | unchanged | `loadMyShows` joins `events(...,event_artists(artists(...)))` with `.limit(100)`; fine. Bulk add uses `ignoreDuplicates` (does not overwrite going->attended; by design?). |
| `artist_follows` insert/delete/select 3213-3214, 1431 | own write; read `can_view_profile` | works | unchanged | select joins `artists(name)` only. Follow keyed by **artist name** in state (1431-1434) - two artists with same name collide. |
| `venue_follows` 1241, 3281-3282, 1436 | own ALL | works | unchanged | anon also holds table grants (security lane note below). Errors on insert/delete only `console.error` (3283). |
| `logged_shows` insert 1529, select 1469 | own ALL | works | unchanged | `notes` field from DOM; select columns minimal. |
| `my_set_times` upsert/delete/select 1340, 1369-1370 | own ALL | works | unchanged | fine. |
| `event_set_times.select('*')` 1343 | public read | works | unchanged | 🟡 selects all columns and **filters `status==='published'` client-side** (1349): if RLS does not already hide drafts, unpublished set times are delivered to every visitor. Fix: `.eq('status','published')` + explicit columns. Verify policy live. |
| `events.select('id,title,date,venue_name,city')` 1485 | public read | works | unchanged | search term strips only `, ( )` before `or()` (1495); `%`/`*` pass through, harmless wildcard widening. |
| `artists.select(...)` 1869, 1896; `artists.update({merch_url,website_url})` 3265 | column-level UPDATE grant on exactly `merch_url, website_url` for authenticated + policy `claimed_by = auth.uid()` (live query 2026-10-19) | works | unchanged | Exactly the two columns the SPA sends. Client does not validate the URL scheme on save (3262-3265); display side uses `Drop.safeUrl` (http/https only, data.js:447; used at app.js:2394-2395) so `javascript:` is not rendered as a link. Add the same check on save + server CHECK (security lane). |
| `artist_claims.insert` 3243, select 1878 | insert own; read own or admin | works | unchanged | Row sent has no `status`; relies on column default. Verify default is `pending` and a CHECK blocks client-chosen status (security lane). |
| `functions.invoke`: `verify-phone`, `login-with-username`, `delete-account`, `tiktok-oauth(-sandbox)` | edge functions | not auditable here | - | `login-with-username` is a username-enumeration/brute-force surface: rate limits live server side (**unverified**). |

Data.js public reads (`Drop.fetch*`, data.js:96-102) use the anon key as `Authorization` even when the user is signed in, so the catalog is never affected by the signup_complete guard (restrictive policies target role `authenticated`).

Route to security lane (not code-only): `anon` holds INSERT/UPDATE/DELETE table grants on `logged_shows, venue_follows, artist_claims, events` and INSERT/DELETE on `artists` (facts file) - safe only while RLS has no matching anon policy; recommend revoke. `artist_claims` admin-update policy is on role `public` (works only because `is_admin(auth.uid())` is null for anon). Confirm `review_artist_claim` body (stated safe by coordinator), `referrals` INSERT policy, `creator_*` SELECT grants, `artist_claims.status` default/check.

**S1 verdict: the SPA is unaffected by S1; it writes only five non-privileged profile columns and never touches `is_admin/is_plus/is_plus_until`.**

---

## 3. Performance

Measured live 2026-10-19 (anonymous GET, `curl --http1.1`):

| Asset | Raw | Brotli (wire) | Cache-Control |
|---|---|---|---|
| `/` shell (index.html, template inline) | 295,436 B | 45,139 B | `no-store, no-cache, max-age=0` (Worker) |
| `app.js` | 213,122 | 60,228 | `no-cache` (etag, 304) |
| `app.css` | 45,604 | 11,052 | `no-cache` |
| `tokens.css` | 4,074 | 1,762 | `no-cache` |
| `vendor/supabase.js` | 203,477 | 51,703 | `no-cache` |
| `data.js` | 25,305 | 9,006 | `no-cache` |
| `trydropapp.com/consent.js` (cross-origin, defer) | 4,456 | 1,723 | `no-cache` |

First-visit wire total is about 181 KB JS/CSS/HTML (br) plus Google Fonts and the catalog JSON. Already fixed (do not redo): wave 5/6 and the 2026-10-17/18 audit: Discover offscreen art deferred (#127, live requests 241 -> 36), lazy art observer (app.js:249-300, `app-lazy-art.spec.ts`), homepage/CWV work targets the public site, not this SPA.

| # | Sev | file:line | Evidence | Proposed code-only fix | Test | Blast radius |
|---|-----|-----------|----------|------------------------|------|--------------|
| P1 | 🔴 | app.js:1263-1285 `loadCatalog` | Boot fetches the **entire** upcoming catalog: `Drop.fetchEvents({limit:1000})` paged until a short page, with `event_artists(artists(...))` embed (data.js:98-100 EVENT_SELECT, 22 columns incl. `description`, `venue_address`), plus `fetchFestivals({limit:1000})`, before the first Discover paint (city, venues, search are all derived client-side). Payload size not measured (would need Supabase REST calls: **unverified**; estimate 1-3 MB raw for ~1,000+ rows). Second page request is sequential, not parallel. | Phase 1: fetch only the selected city/date window for first paint (server filter via `fetchEvents({city, from, to, limit:48})`), derive city list from a lightweight `fetchCities`/count RPC (data.js already has `Drop.fetchCities`, unused by the SPA), load the full catalog lazily on Search/Venues. Drop `description` from the list select. | Playwright route spy: Discover first paint issues <= 3 REST requests and none with `limit=1000` ; Search screen triggers the full fetch. | Core Discover/Search/Venues screens; largest win; moderate risk (client-side filtering assumptions at 1286+). |
| P2 | 🟡 | worker.js:31-33, index.html (295 KB) | HTML shell is `no-store` and carries the entire 49-screen template inline (about 295 KB raw / 45 KB br) on every navigation, so every visit re-downloads it. | Move the `<template>` markup to a hashed static file (`app-template.html`, `no-cache` + etag) or keep inline but serve HTML with `no-cache` + etag (304) instead of `no-store`. Worker change needs approval (route elsewhere). | Contract test in deploy-contract.test.mjs for new asset; Playwright check no extra request on re-nav. | Worker + build-dist; medium. |
| P3 | 🟡 | index.html:12-25, 3235 | Both CSS files are injected by inline JS after parse and `app.js` is injected at the end of body (lines 21-24, 3235-3240): no preload scanner discovery, so CSS and JS requests start late; `data.js` and `supabase.js` are synchronous blocking scripts (3229-3230). | Static `<link rel="stylesheet">` / `<script defer>` with a tiny inline host-based `<base>` alternative, or `<link rel=preload>` hints for `/app.css`, `/app.js` (path differs by host: emit hints from the same inline script). Smoke test at smoke.spec.ts:918 pins asset requests - update. | Existing smoke asset-request test + Lighthouse on /app/. | index.html only. |
| P4 | 🔵 | app.js:1390, 1411, 1756 | `signup_compliance_status` is called up to 3 times per boot/login (afterLogin, creator-referral, signup-referral). | Cache the result from `afterLogin` for the session and pass it in. | Spy asserts <= 1 rpc per login. | small. |
| P5 | 🔵 | app.js:1424-1450 | `loadUserData` issues 5 parallel reads plus 2 head-counts (`realShowsCount`, `realArtistsCount`) that can be derived from `rsvp` / `following` already loaded. Fine, parallel; no N+1 found. Limits exist on `my shows` (100), `logged_shows` (200), archive (30). `select('*')` only on `event_set_times`. | Derive counts locally; drop 2 requests. | Spy count test. | trivial. |
| P6 | 🔵 | index.html:26-28 | Google Fonts CSS from `fonts.googleapis.com` (render-blocking cross-origin request, two families) while tokens already define font stacks. | Self-host two woff2 files or `font-display:swap` + preload. Design project decision if families change. | Network assertion: no third-party font request. | visual risk -> design lane. |
| P7 | 🔵 | `_headers`, worker | No `Content-Security-Policy` (confirmed absent on live headers) and no HSTS on the app host; tokens sit in localStorage (impact amplifier for any XSS). Tracked as W1/W2 in the 2026-10-17 report. | CSP in report-only first (needs `unsafe-inline` for the inline template/styles until P2 is done). | deploy-contract test for header presence. | security lane / approvals W1-W2. |

---

## 4. Accessibility

Tools: axe-core (from the local npx cache, not installed into the repo) run via the repo's Playwright Chromium, LOCAL build served by `python3 -m http.server` at `/app/index.html`, Supabase stubbed (as `tests/helpers/fakeSupabase.ts`, signed-out). Tags: wcag2a, wcag2aa, wcag21a/aa, wcag22aa, best-practice. Viewports 1280x800 and iPhone 13 (390x844). Screens covered: home, login, signup, reset, suggest (`?suggest=1`), footer-navigated About, Venues, Artists, Drop+. Footer links for promoter/admin/verify/error/404 were not reachable from those pages in the script (**not scanned**). Authenticated screens not scanned.

| Rule | Sev | Count (desktop+mobile) | Where | One fix |
|---|---|---|---|---|
| `label` (critical) | 🔴 | 4 nodes (2 per viewport) | `?suggest=1` screen, `input[type="date"]` fields | Add `<label for>` / `aria-label` to the two date inputs in the Suggest form (index.html Suggest section). Note this is a demo screen whose submit does nothing (app.js:3103), see R1. |
| `link-in-text-block` (serious) | 🟡 | 6 nodes (3 per viewport) | signup consent line, `a[href$="terms"]`, privacy | Add underline (`text-decoration:underline`) to links inside the consent paragraph. Same rule PROJECT_STATE records as design D2 on /privacy. |
| `color-contrast` (serious) | 🟡 | 3 nodes | Drop+ paywall plan cards (`button:nth-child(n) > div > div:nth-child(1)`) | Raise label token on the plan-card caption (tokens.css `--text-muted` on `--surface-hi`) to >= 4.5:1; confirm exact pair in browser before editing. Visual change: design lane. |

Clean (0 violations): home, login, signup (apart from the link), reset, About, Venues, Artists at both viewports. Existing tests cover labels, focus rings, reduced motion, Tab trap for the gate (`app-accessibility.spec.ts`, `a11y-wave5.spec.ts`). Manual not performed: screen-reader pass, authenticated screens, focus order on the 5-step activation wizard.

---

## 5. Dead code

Scans (python scripts, results reproducible): method/function/const definitions in `app.js` vs all references in `app.js` + `index.html`; handler keys returned by `renderVals()` vs `{{ }}` bindings; CSS class names in `app.css` vs `app.js` + `index.html`; `Drop.*` members in `data.js` vs SPA usage.

| # | Sev | Location | Evidence | Fix | Test | Blast radius |
|---|-----|----------|----------|-----|------|--------------|
| D1 | 🟡 | app.js:3052, 3059, 3060, 3200, 3201 | Handlers `goWrapped, goTagged, goWallet, goArtist, goVenue` are returned from `renderVals` but bound nowhere in the template and referenced nowhere else. | Delete the five handlers (and, if screens are unreachable, their templates). | `npm test` + a grep contract in smoke. | trivial. |
| D2 | 🟡 | app.css | 65 class names have no reference in `app.js`/`index.html`: `appbar, appbar__right, avmini, btn--danger, combo*, droplet, ec__*` (note: `ec__` hits come from html, so only unreferenced ones listed), `frow*, is-active-legal, is-down, is-filled, is-loading, is-mask, is-social, is-up, legal-grid, legal-nav, m-ctabar, metric__delta, modal__actions, otp__cell, range__*, rd__*, rg__legend, sheet__*, skel--avatar/card/text/title, statuschip*, sw__label, tab__ico, tabbar, tf__input, toast--error/info, toast__close, tokenwrap, w3, wordmark, wsc__skeleton`. Dynamic class construction (string concat) was only partially excluded: `statuschip--`, `skel--`, `toast--` prefixes have zero JS hits so look genuinely dead. | Remove the unreferenced rules; re-run `app-*.spec.ts` + screenshot sweep. | A script test that fails if an `app.css` class is unreferenced (allow-list for `is-*`). | CSS only; visual regressions possible: design lane screenshot check. |
| D3 | 🟡 | app.js:984-1056, index.html | Per PROJECT_STATE wrapped became real. Current state: `CITIES, COMMENTS, FRIENDS, REQUESTS, FIND_PEOPLE, PLANS, LEDGER, TAGGED, SUBMISSIONS, PROMO_EVENTS, GUESTS, CODES, REVIEW_QUEUE, REPORTS, ADMIN_*, SEEN_HISTORY, NOTIFS, BLOCKED` are **all empty arrays** (the old seeded fake data is gone, "honest empty states"). So crew/plans/chat/wallet/promoter/admin screens are live-reachable but render empty or "coming soon" (`flash(... coming soon)` at 2065, 3075, 3134, 3173, 3462). Their templates are most of the 295 KB shell. | Decide per screen: wire to a real table or remove the screen, route and template (also shrinks P2). | Existing honest-copy spec + per-screen reachability test. | product decision, then medium. |
| D4 | 🔵 | data.js | 28 of 40 `Drop.*` members are never used by the SPA (`ALL_CITIES, CITIES, artistPath, city, eventArt, eventAvailabilityText, eventPath, fetchAllEvents, fetchArtist, fetchCities, fetchGenres, fetchGoingCounts, fetchPublishedEventCount, fetchVenue, fetchVenueById, fetchVenues, genreClass, genreCls, hasRealArt, mapsUrl, schemaEventStatus, schemaOfferAvailability, searchArtists, setCity, slugify, submitCreatorApplication, ticketActionLabel, venuePath`). data.js is shared with the public pages, so these are not dead repo-wide; check each against `*.html` before touching. | Leave unless splitting data.js per surface. | - | - |
| D5 | 🔵 | app.js:1056-1100 vs `EVENT_GRADS` 686 | Two near-identical gradient palettes (`ARTIST_GRADS`, `EVENT_GRADS`) and a local `hashStr/gradFor`. | Reuse one list. | - | trivial. |
| D6 | 🔵 | app.js:1031-1100, 2065 | Footer exposes prototype links to everyone: "Admin (staff)", "Promoter dashboard", "Error state", "404", "Verify email" (index.html:3168-3173). Not an authz hole (all screens are static/empty) but looks unfinished and "Admin (staff)" is a trust smell. | Remove from footer or gate on real data. | honest-copy spec adds assertion. | trivial. |

No unreferenced top-level functions/vars or class methods found in `app.js` (scan result empty), no duplicate helper copy found for the auth/RPC logic between `app.js` and public JS; `looksLikeEmail`/`cleanUsername` live only in app.js. Not scanned: duplicates between app.js formatters and `site.js` (manual diff not done).

---

## 6. Test coverage

Existing: `signup-phone.spec.ts` (27 tests: age gate, token-hash confirm, OAuth compliance, phone gate, referral, delete account), `event-intent.spec.ts` (14: returnTo allow-list, RSVP, failure, sign-out race), `app-accessibility.spec.ts` (5), `app-honest-copy.spec.ts` (3), `app-lazy-art.spec.ts`, `app-store-links.spec.ts`, `auth-input-preservation.spec.ts`, smoke (festival schedule, TikTok redirect contract, asset requests). Fake Supabase clients are copy-pasted into 3 specs (`tests/helpers/fakeSupabase.ts` is the lightweight one).

Not covered: A1-A7, R1-R5; `profiles.update` payload; `artists.update` payload; signed-out boot; logout state reset; no test asserts `signOut` scope.

Three highest-value missing tests:
1. **No global sign-out on transient failure** (A1): fake client with a session, `rpc('signup_compliance_status')` returns `{error}`; assert `signOut` not called and `{scope:'local'}` is used on explicit Log out.
2. **Profile write payload allow-list** (S1 guard): drive Edit profile with a fake client recording `from('profiles').update(payload)`; assert keys are exactly `display_name, username, bio, city, state` and that no call anywhere carries `is_admin|is_plus|is_plus_until`; same for `artists.update` keys `merch_url, website_url`.
3. **Session reset completeness** (A3): sign in as user A with rows, fire `SIGNED_OUT`, then sign in as user B whose loaders fail; assert A's data is gone.

---

## Resilience / honesty findings (cross-cutting)

| # | Sev | file:line | Evidence | Fix | Test |
|---|-----|-----------|----------|-----|------|
| R1 | 🟡 | app.js:3103 | "Suggest an event" shows "Submitted for review - thanks, scout!" and discards the data; no write exists. | Wire to a real endpoint or label "coming soon". | honest-copy spec. |
| R2 | 🟡 | index.html:3170 | see D6. | | |
| R3 | 🟡 | app.js:3206-3215, 3274-3284 | `artFollow`/`venFollow` flash "Following X" and flip state optimistically; on write error only `console.error`, no rollback or message (RSVP and festival writes do roll back, 1127-1150, 1369-1378). Follow state can show followed while DB says no. | Mirror `writeRsvp` rollback + flash on error. | fake client returns error -> state restored, flash shown. |
| R4 | 🔵 | app.js:3258-3270 | `saveEditLinks` stores unvalidated URL text, then updates local state with the raw (not `safeUrl`) value. | Validate `^https?://` before save. | spec. |
| R5 | 🟡 | app.js:1385, 1427-1472 | Loader failures (including RLS/403 after the compliance gate flips) are `console.error` only; UI shows empty lists indistinguishable from "no data". | Set an `userDataError` state and show a retry row. | rpc/select returns error -> banner visible. |

---

## Code-only fix batches (3 PR-sized)

### Batch 1 - Session safety and state hygiene (A1, A3, A4, A5, A6, R3, R5, A2 constant)
- Files: `app/app.js`, `tests/auth-session-safety.spec.ts` (new), reuse `tests/helpers/fakeSupabase.ts` (extend with `rpcError`, `calls[]`, `signOut` recorder).
- LOC: about +140 / -40.
- Tests to add (Playwright, run with `npx playwright test tests/auth-session-safety.spec.ts`): (1) compliance rpc error on boot -> session kept, retry banner, no `signOut`; (2) Log out and compliance rejection call `signOut({scope:'local'})`; (3) SIGNED_OUT clears `myShowsRows/loggedShows/following`; (4) creator code older than account is not recorded; (5) follow write error rolls back and flashes; (6) loader error shows retry row; (7) single legal-version constant (node test grep in `deploy-contract.test.mjs`).
- Pre-step: confirm A2 current legal versions with the security lane.
- Live verification (Claude-in-Chrome after deploy, test account only, not a real user): open `https://app.trydropapp.com/?mode=login`, sign in, confirm network shows `POST /auth/v1/token`, `POST /rest/v1/rpc/signup_compliance_status` then Discover loads. Use DevTools offline for the rpc request or block `rpc/signup_compliance_status`, reload: expect no `POST /auth/v1/logout`, session intact, retry banner. Click Log out: expect `POST /auth/v1/logout?scope=local`.

### Batch 2 - Data minimization and perf (P1, P3, P4, P5, R4, event_set_times)
- Files: `app/app.js`, `app/index.html`, `data.js` (only if a lighter city source is added), `tests/app-perf-boot.spec.ts` (new), `tests/smoke.spec.ts` (asset-request expectation at :918).
- LOC: about +120 / -60.
- Tests: route spy asserts first Discover paint makes <= 3 `rest/v1` calls, none with `limit=1000`; Search screen triggers the full catalog; `event_set_times` request carries `status=eq.published` and explicit columns; no `rpc/signup_compliance_status` more than once per login; `^https?://` validation on Edit links.
- Live verification: `https://app.trydropapp.com/?mode=login` signed out: DevTools Network filtered `rest/v1`: expect `events?...limit=<=48` and no `limit=1000`, then open Search and see the full fetch; open `https://app.trydropapp.com/?festival=1`: expect `event_set_times?...status=eq.published`.

### Batch 3 - Cleanup and honesty (D1, D2, D6, R1, a11y fixes for label/link-in-text-block)
- Files: `app/app.js`, `app/index.html`, `app/app.css`, `tests/app-honest-copy.spec.ts`, `tests/app-accessibility.spec.ts`.
- LOC: about -250 / +40 (CSS and dead handlers).
- Tests: footer has no Admin/Error/404 links; `?suggest=1` date inputs have accessible names; axe run on signup shows 0 violations; a script test fails on unreferenced `app.css` classes.
- Live verification: `https://app.trydropapp.com/?mode=signup` shows underlined Terms/Privacy links (no network change); home footer has no "Admin (staff)"; `?suggest=1` no console errors.

---

## Not code-only / route elsewhere
- **Security lane (DB):** S1 migration landing; revoke `anon` INSERT/UPDATE/DELETE on `logged_shows, venue_follows, artist_claims, events` and INSERT/DELETE on `artists`; move `artist_claims` admin-update policy off role `public`; confirm `artist_claims.status` default and check; `referrals` INSERT policy for `record_signup_referral`; `creator_status/creator_code` column SELECT grants; `event_set_times` policy hides drafts; URL CHECK on `artists.merch_url/website_url`; `login-with-username` rate limiting; DOB in `user_metadata` (A7); Supabase Auth redirect allow-list for `https://app.trydropapp.com/**`; CSP/HSTS (W1/W2).
- **Worker (needs approval, not covered by deploy.yml):** HTML `no-store` -> etag caching (P2).
- **Design project specs:** footer information architecture, Drop+ caption contrast pair, font self-hosting, removal of dead screens (D3 product decision).

## Unverified
- Catalog payload size (needs Supabase REST calls; not made).
- Which privacy/terms version `complete_signup_profile` currently accepts (A2).
- Whether `event_set_times` RLS already hides drafts; `creator_*` SELECT grants.
- Supabase Auth redirect allow-list; edge-function rate limits.
- Authenticated screens (a11y, behaviour): never signed in. Footer prototype screens not axe-scanned.
- CSS "dead" list: static scan, dynamic class concatenation only partly excluded; confirm with screenshots before deleting.
- No full `npm test` run was performed in this audit (only `npm ci` and the axe script).

## Tools that ran
`npm ci` (worktree); Playwright Chromium + axe-core (local cache) on a local `http.server`; `curl` anonymous GETs/HEADs of app.trydropapp.com, trydropapp.com/consent.js; python scans for dead code; code reading of app.js sections. Repo test fixtures define no test account (fake Supabase clients only; user id `11111111-1111-4111-8111-111111111111` is a stub, not a real account). No live sign-in.
