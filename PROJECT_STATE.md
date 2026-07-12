# PROJECT STATE — drop-web-app (read me first)

> Repo renamed 2026-07-06: `drop-landing` → `drop-web-app`. This is **the Drop website**
> (trydropapp.com) — one of two front-end surfaces over the shared backend; the other is
> the **mobile app** (`../drop-mobile-app`). Same content, different access. Historical
> entries below may still say "drop-landing".

Last updated: 2026-07-11
Full history (if archived): vault → AI Agents/Codebase Docs/drop-landing/PROJECT_HISTORY.md

## SESSION LOCK
**Status:** UNLOCKED
How to use: advisory + durable record only. Concurrent sessions auto-isolate in their own git worktree (session/<id>) via dev-session.zsh — there is NO global LOCKED state to set. Record Owner / Working on at session start.
### Active session (if any)
- Owner: — · Started: — · Working on: fresh — no sessions yet

## Current status
### What works
- FULL 12-page public event-discovery website LIVE at trydropapp.com (cutover 2026-07-06, see CUTOVER RECORD): AXS-style IA, Prism tokens, live Supabase public catalog (anon key, 1.5K events), 32/32 Playwright smoke green.
- Browser login/account shell is LIVE on `app.trydropapp.com` (2026-07-08, Codex): static non-Expo `account.html` screen matches the requested compact split-panel Prism login design, uses Supabase Auth against the same Drop project, supports email/password, username password login through `login-with-username`, sign-up, password reset, Google/Apple/Facebook OAuth triggers, and shows signed-in profile/attendance/followed-artist/followed-venue data through existing RLS. Latest Pages deploy `c3a6e0e4.drop-site.pages.dev`; Worker `drop-app-path` version `73d5a5c2-774f-4e18-a708-1754ed669d56`.
- Expo web proxy is retired (2026-07-08, Codex): trydropapp.com remains the standalone public website; `/app` and `/app/...` no longer serve Expo web and now redirect to `/account.html` on the public site.
- 19-rule UI best-practices audit PASSED + fixes deployed (2026-07-06, commit 7308468, live-verified): undefined `--r-card` radius bug fixed, chip selected-state = solid cyan (gradient reserved for .btn-primary), events sort select → toggle chips, event-page nav CTA ghosted, legal numerals cyan, venue/artist card value-hierarchy, header search live-filters venues/artists grids, `.btn-primary` fill desaturated ~18% (`--grad-glow-fill`, AA contrast 5.06:1 worst stop; waveform/text/glow keep full sat).
- UI consistency cleanup is LIVE on trydropapp.com (2026-07-08, Codex; final Pages deployment `3bcc25b0.drop-site.pages.dev`): link hub now uses the same desaturated Prism CTA fill/pill geometry, time tabs and filter chips share selected-state tokens, native emoji/symbol UI was replaced with Prism-styled marks/labels, Bass/Dubstep and Clubs have distinct tints, venue/artist detail H1s use Space Grotesk, promoter section labels/wrap are cleaned up, and the download waitlist no longer emits the mailto mixed-content console warning. Verified with `npm test` 42/42, targeted Playwright screenshots in `/tmp/drop-site-fix-qa`, live CSS/HTML marker checks, and live browser pass on `/link.html`, `/download.html`, `/promoters.html`, `/events.html` with zero console/page errors.
### In progress — Active Claims
Live cross-session claims (who is working on what right now) are in the vault: `AI Agents/Operations/SESSION_CLAIMS.md` — run `python3 ~/Developer/agent-stack/scripts/session_claim.py list`. List durable in-progress items here.
### Blocked / waiting on
- Founder: Bing Webmaster import-from-GSC (OAuth grant only founder can approve; extension also lacks bing.com permission).
### Exact next step
1. **Founder QA the logged-in write paths on app.trydropapp.com** (deploy `f9320e87`, commit 86c4261): sign in with a real account and exercise (a) an artist claim submit (artist page → bottom "Are you {name}? Claim this profile" wizard → artist_claims row), (b) owner Edit-links save (needs an approved claim — approve via `select review_artist_claim('<claim-id>','approved')` as an admin or ask the agent), (c) Wrapped with real history (2026 ↔ All-time toggle + story-card download), (d) RSVP + follow (still never exercised against prod). All write paths shape-verified + headless-driven logged-out only.
2. **Review/merge the artist-claims app PR** — Drop-App "Wrapped all-time mode + artist merch links + artist claim flow" (#150): tsc/lint/304 unit tests green; needs device QA per app merge gate (wrapped toggle, claim wizard, admin Artist-claims tab).
3. **Retire the drop-web (Expo export) CF Pages project** — nothing routes to it anymore; delete the project in the CF dashboard + remove web-deploy.yml from drop-mobile-app.
4. **Schema design for remaining social features** (founder decision): crew/plans/chat/wallet still demo (wrapped is now REAL) — scope one (plans?) before building.
5. **Resubmit sitemap in GSC** (27 URLs) + standing Bing Webmaster import (founder OAuth).
6. **Drop-App PR #146** (`feat/recap-celebration`): wire `<RecapCelebration trigger={revealed} />` into the recap screen root, device-QA, merge per app gate.

## 2026-07-11 session — 6 UX fixes (LIVE, deploy `f9320e87`, commit 86c4261)
- Venues: per-row "In Drop" badge removed (every listed venue is in Drop — badge said nothing); AXS badge kept.
- Mobile: home search field full-width, 16px input (kills iOS focus-zoom), taller tap target.
- City picker (nav pill + heading, shared bindCityPicker): live list of every city with upcoming events via new `event_cities` view (security_invoker, anon-readable) + type-to-filter + free-text Enter accepts any city. Filter input is type=text — type=search collides with the global typeahead binding.
- Art chain (Drop.ecard + event.html hero): real event image → first lineup-artist photo (Drop.artistArt; 97% of artists have image_url) → prism block. SPA artist hero renders artists.image_url (safeUrl-passed) instead of the gradient circle.
- SPA artist screen: claim-profile link moved from top to bottom (matches public page).
- Home: "More upcoming shows" pagination, 8/page offset, per-batch art-first sort (no reshuffle on append).
- Tests 70/70 (added city-filter + load-more smoke). Also: claude.ai/design project "Drop Mobile App Redesign" (a4dd41e0-…) created + seeded from drop-design/APP_DESIGN_PROMPT.md, handed to a separate agent.

## 2026-07-10 session — design iteration round 2 (LIVE, deploy `76b661c5`)
- Landing: honest proof line ("Tracking 1,500+ shows across 11 cities") replaces invented 40k count; hero→section gradient seam + spacing; centered event grid all breakpoints; inline city dropdown in "Happening in {city}" synced with nav pill.
- Artist public page: verified badge, Merch/Website pills (new artists.merch_url/website_url/verified columns), claim handoff link → app.trydropapp.com/?claim={id}. DOM-built, no innerHTML interpolation.
- SPA: Wrapped rebuilt on REAL attendance history (2026/All-time modes, canvas story-card PNG download, honest empty state; demo WRAPPED mock deleted); artist claim 3-step wizard → artist_claims insert (dup→pending), owner Edit-links modal (RLS-scoped), ?claim= deep link.
- Supabase migrations applied: artists +merch_url/website_url/claimed_by/verified, artist_claims table + RLS, admin RPC review_artist_claim (security definer; approval sets verified/claimed_by, creates artist from proposed_name).
- 68/68 Playwright green (5 new tests). Design doc "Website design prompt" holds the same features (verified end-to-end in preview) + all six landing fixes.

## CUTOVER RECORD (2026-07-06 — LIVE)
- trydropapp.com + www → CF Pages project **drop-site** (this repo's `dist/`; deploy = `npx wrangler pages deploy dist --project-name=drop-site --branch=main`, account ba8c4fed…, no git integration — deploy manually after changes; `npm test` first).
- `trydropapp.com/app*` and `app.trydropapp.com/*` → Worker **drop-app-path**. Apex `/app` and `/app/...` redirect to `/account.html`; `app.trydropapp.com` serves the static browser account shell from this repo. No Expo web proxy is active on public routes.
- DNS (zone 5ac5024f…): apex+www CNAME → drop-site.pages.dev; app host remains proxied so the Worker route can catch legacy links.
- Verified live: all 12 pages 200, /link 200, /legal/* 301s, /event/<uuid> serves event page (200 rewrite + path-parsed id), AASA application/json at root, www→apex 301. Browser check: h1 renders, 24 live event cards, body scrolls (no app overflow:hidden), zero page errors. 2026-07-08 check: `/app/` and `/app/login` 302 to `/account.html`; `app.trydropapp.com/login`, `app.trydropapp.com/account.html`, and `/signup` serve the static account shell; account assets serve 200.

## Recent sessions (last 5 — older entries in PROJECT_HISTORY.md)
### 2026-07-08 — Codex — Browser login visual fidelity fix deployed
- Changed: corrected `account.css` to use the website's actual Prism text/border tokens (`--text`, `--border`, etc.) instead of undefined/dark aliases, reduced the desktop auth form to the target compact 244px layout, lowered the split-layout breakpoint to 720px so 770px desktop captures match the supplied reference, hid the desktop wordmark/Account eyebrow, tightened input/button/social geometry, and kept the wider mobile form.
- Tested: local Playwright screenshot QA at 770x618 and 390x844 with zero console/page errors; final live Playwright QA on `https://app.trydropapp.com/login` at 770x618 with hero x/y and form x/y/width matching the reference; `npm test` 46/46 passed; `rsync -ani --checksum ... dist/` clean; deployed Pages `c3a6e0e4.drop-site.pages.dev`; live CSS marker check confirmed the 244px form and 720px breakpoint on `app.trydropapp.com`.
- Remaining: Supabase Auth redirect allowlist cannot be changed from this session without a Supabase Management API access token or a write-capable Supabase Dashboard/MCP tool.
- Next: see Exact next step above.
### 2026-07-08 — Codex — Static browser account shell deployed
- Changed: added `account.html`, `account.css`, `account.js`, and vendored Supabase JS; re-added `Log in` links across the public website pointing to `https://app.trydropapp.com/login`; changed root `/login` redirects to the account subdomain; changed the Worker so `app.trydropapp.com/login|signup|account` serve the static account shell and `/app/...` redirects there.
- Account flow: email/password login, username/password login through `login-with-username`, sign-up with username metadata, password reset, OAuth triggers for Google/Apple/Facebook, sign out, signed-in dashboard reading `profiles`, `attendance`, `artist_follows`, and `venue_follows` through existing RLS.
- Tested: `npm test` 46/46 (desktop + mobile-safari); local desktop/mobile screenshot QA saved `/tmp/drop-account-desktop.png` and `/tmp/drop-account-mobile.png` with no console/page errors; Worker route simulation green; deployed Pages `694a445f.drop-site.pages.dev`; deployed Worker version `73d5a5c2-774f-4e18-a708-1754ed669d56`; live curl checks confirmed `app.trydropapp.com/login` and `/signup` 200, account assets 200, `/app/login` 302 to the account subdomain; live Playwright desktop/mobile QA on `https://app.trydropapp.com/login` green; invalid email/password attempt surfaced "Invalid login credentials" on-page.
- Remaining: real-account login QA and Supabase Auth redirect allowlist verification for OAuth/email-confirm/reset callbacks.
- Next: see Exact next step above.
### 2026-07-08 — Codex — Website/app separation deployed
- Changed: removed every public-site `/app/login` nav link; replaced the `/app*` Worker proxy with a fixed redirect to `https://trydropapp.com/download.html`; changed `/login` and `/login.html` redirects to `download.html`; deleted the obsolete `/app` cutover runbook; added `DECISIONS.md` for the standalone-website decision; updated product/design docs and smoke tests.
- Tested: `npm test` 42/42 (desktop + mobile-safari); `git diff --check`; live curl checks confirmed `/app/`, `/app/login`, `app.trydropapp.com/`, and `/login` redirect away from Expo web; live Playwright mobile viewport check on `https://trydropapp.com/` showed `appLinks: 0`, both header CTAs as `Get the app`, and zero console/page errors. Screenshot: `/tmp/drop-website-only-live.png`.
- Remaining: founder visual QA of the live website-only separation; standing Bing/GSC founder-gated items.
- Next: see Exact next step above.
### 2026-07-08 — Codex — Prism UI consistency cleanup (deployed + live-verified)
- Changed: fixed the drop-related website UI inconsistencies from the audit: unified selected states, moved `/link` off the saturated CTA treatment and onto `--grad-glow-fill`, replaced native emoji/symbol UI with Prism marks/labels, split Bass/Dubstep and Clubs into distinct tints, restored Space Grotesk on artist/venue detail headings, made artist CTA fit content on desktop, replaced promoter numbering with semantic labels, and removed the download waitlist mailto form-action warning while preserving the JS mailto fallback.
- Tested: `npm test` 42/42 (desktop + mobile-safari); targeted Playwright render QA saved screenshots to `/tmp/drop-site-fix-qa` with zero console/page errors; `rsync -ani --checksum ... dist/` returned no output after syncing; deployed via `npx wrangler pages deploy dist --project-name=drop-site --branch=main` (final deployment `3bcc25b0.drop-site.pages.dev`); live browser pass on `/link.html`, `/download.html`, `/promoters.html`, `/events.html` returned zero console/page errors.
- Remaining: founder visual QA on the live site, plus standing Bing/GSC founder-gated items.
- Next: see Exact next step above.
### 2026-07-07 (later) — Claude (Fable) — Pre/post-login parity drop (PR #10 open) + login-loop fix
- Login loop root-caused + fixed: /app→/app/ worker 301 dropped ?code= (PKCE) → worker keeps url.search, deployed live via wrangler (PR #9 open for the record); founder confirmed login works.
- Parity build (founder-approved spec, subagent-driven): this repo PR #10 (For Promoters → footer only; card/nav CSS aligned to app WebShowCard/WebNav: genre-pill 12px/700/0.1em body-font, wordmark 24px, nav v-padding; smoke 42/42) + Drop-App PR #138 (WebNav Events/Venues/Artists + location pill + search, card genre pill + TM /dam/c/ stock filter, web Discover = site browse layout, WebFooter; all gates green incl. signed-in e2e).
- Next: see Exact next step above.
### 2026-07-07 — Claude (Fable) — Parity drop MERGED + DEPLOYED (live-verified)
- Merged (founder-authorized): nav+card parity PR #10, login-worker PR #9, Drop-App web-parity PR #138 (rebased over Codex's Maestro PR #139 first; tsc+CI re-green). Founder ran wrangler deploy; /app auto-deployed via web-deploy.
- Live checks green: /app/login corner link, About/Promoters out of header, typeahead + hasRealArt in shipped site.js/css, trydropapp.com/app 200 on new build.
### 2026-07-07 — Claude (Fable) — Founder UI-issue fix pass (PR #8 MERGED + DEPLOYED, live-verified)
- Merged #8 (founder-authorized in-session) + wrangler deploy; live checks on trydropapp.com all green: typeahead opens (3 rows for "house"), loc-city labels sync ("Seattle" everywhere), no hero City select/chip row, About footer-only, zero /dam/c/ stock imgs (14 prism cards), genre pills now varied (House/Techno/Live music), zero page errors + subagent screenshot review clean. Drop-App #137 also merged; web-deploy run green (app.trydropapp.com).
- Changed (branch `fix/ui-parity-typeahead`): site.js (typeahead module + doc-wide .loc-city update + `hasRealArt` TM /dam/c/ stock-photo filter), data.js (`searchArtists`, genre bucketing scans all artists' genres w/ specific-before-generic keys), site.css (.ta-pop), index.html (hero City select + chip row removed; sorts use hasRealArt), all 12 pages (About out of header/drawer, footer keeps it), tests/smoke.spec.ts (+3 tests), dist rebuilt (includes google75d252b1adf86e07.html → deploy closes GSC item).
- Tested: npm test 40/40 (desktop + mobile-safari); typeahead exercised headless (8 suggestion rows for "house").
- Companion: Drop-App PR #137 (signed-in /welcome redirect — post-login no longer lands on marketing hero), CI green, awaiting merge.
- Next: see Exact next step above.
### 2026-07-06 — Claude (Fable) — 19-rule UI audit + Prism polish, deployed
- Changed: commit 7308468 (site.css, site.js, events/event/venues/artists.html) — full audit vs `~/.claude/design/ui-best-practices/UI-BEST-PRACTICES.md` (27 screenshots desktop+mobile, 3 vision reviewers + code sweep). 14 rules already passing, 3 N/A; 8 findings fixed (see What works). Founder-approved Prism adjustment: primary-button gradient desaturated for dark-mode (rule 9), brand full-sat kept for waveform/text/glow.
- Tested: npm test 32/32 both before and after; WCAG AA contrast on new fill; deployed via wrangler + live-verified (new CSS + sort chips confirmed on trydropapp.com, pages 200).
- Remaining: none for the audit. Gradient decision recorded — `--grad-glow-fill` is the large-fill variant; don't reuse raw `--grad-glow` for big fills.
- Next: see Exact next step above
### 2026-07-06 — Claude (Fable) — Full website rebuild (AXS-style discovery site)
- Changed: replaced single-page landing with 12-page site (commit 49c1db6 + follow-up cutover-assets commit); shared site.css (Prism tokens verbatim from drop-design) + data.js (Supabase REST anon catalog) + site.js; live rails/filters/detail pages; skeleton/empty/error states; a11y floor (skip link, focus-visible, aria-pressed chips, reduced-motion); SEO (per-page meta/JSON-LD incl. WebSite SearchAction + injected Event/MusicGroup); smoke suite → 32 tests; .gitleaks.toml allowlists sb_publishable_* only. dist/ = html+css+js+favicon/og+robots/sitemap/llms+_redirects+_headers+.well-known.
- Tested: npm test 32/32 (desktop+mobile-safari); full-page screenshot review desktop+mobile all pages; adversarial code review (XSS→Drop.safeUrl, festival genre bucketing) fixed+re-tested; live Supabase data exercised.
- Remaining: deploy cutover (blocked on founder approval), post-cutover cross-link updates in Drop-App.
- Next: see Exact next step above
### 2026-07-01 — Claude — Event preview page added then removed; AI-SEO basics shipped
- Changed: Added a public event preview page at trydropapp.com/event (#5), then removed it as orphaned (#6); shipped real PNG og-image + composition cleanup (#4); added Command Center closeout rule to AGENTS.md; added AI-SEO basics — llms.txt, JSON-LD structured data, robots.txt/sitemap.xml, plus a BACKLOG.md rewrite
- Tested: N/A (docs/content closeout only)
- Remaining: BACKLOG.md now tracks GSC/Bing sitemap submission, `/link` OG image, FAQPage schema, on-site FAQ section, and blog/content page
- Next: see Exact next step above

### 2026-06-25 — Claude — Instantiate handoff-protocol files (W10 rollout)
- Changed: Added PROJECT_STATE.md and AGENTS.md
- Tested: N/A
- Remaining: Fill in session history as work resumes
- Next: Resume landing site work per backlog

## Recent Sessions
<!-- SESSIONS:newest-first -->
### 2026-07-09 — Claude — Full Prism web-shell redesign ingest (IN PROGRESS, branch `redesign/prism-web-shell`)
- **Changed:** Whole-site replacement per founder directive ("literally everything") from the finished claude.ai design (design-drop/"Drop Website.dc.html", 49 screens, desktop+mobile). Committed so far: `design-drop/INGEST_PLAN.md` (scope/entity-split: website standalone on Supabase, Expo mobile-only), `shell.css` (web-shell component layer, token-pure, aa490da), legal/link/404/tests (6e93492). IN FLIGHT via 4 parallel subagents: `app/` (post-login web app ported from the design SPA — index/app.js/app.css/tokens.css, mock state), core browse (index/events/event), artist+venue pages, auth+acquisition (account states, city/genre SEO templates, share-plan/recap/wrapped, download/about/promoters). account.html keeps the Codex Supabase shell wiring (login/dashboard via RLS).
- **Tested:** shell.css verified token-pure (0 hexes, 0 undefined vars); track-4 pages Playwright-checked on a scratch server (7/7, console-clean); full `npm test` NOT yet run (pages in flux) — everything in flight is **unverified** until tracks land.
- **Remaining:** collect + commit the 4 in-flight tracks; run `npm test` (fix reds); design-auditor pass; open PR "Prism web-shell redesign"; Arya review → deploy (manual `dist/` mirror + wrangler, founder-gated) → repoint app.trydropapp.com Worker at `/app/` and retire the Expo web export; follow-on: wire `app/` to Supabase (replace mock state).
- **Next steps (ranked):**
  1. On branch `redesign/prism-web-shell`: collect the 4 subagent tracks (files listed above), commit per track, then `npm test` in /Users/aryashinde/Developer/Drop/drop-website and fix failures.
  2. Refresh `dist/` mirror (`cp` changed files; rm removed ones), open PR "Prism web-shell redesign", get Arya review + explicit deploy go.
  3. After deploy: repoint the drop-app-path Worker so app.trydropapp.com serves `/app/`; retire drop-web (Expo export) CF Pages project; then Supabase wiring for `app/` mock state.

### 2026-07-08 — Claude (Opus) — Native hero effects BUILT + spec (not yet deployed)
- **Changed:** spec `docs/superpowers/specs/2026-07-08-drop-native-effects-design.md` (29efed8); then implemented (commit 2b8dbc1): **A1** hero flip-words — new `flipwords.js` cycles the h1 word (shows/sets/drops), reserves widest-word width so copy doesn't reflow, static under reduced-motion; hero h1 in `index.html` wraps the word in `<span class="flip" data-flip>`; `.flip` iridescent gradient text in `site.css`. **A2** aurora — `.aurora` CSS glow (Prism cyan/magenta radial gradients, `aurora-drift` keyframes) behind `.discover-head`, `<div class="aurora">` added, static under reduced-motion. `playwright.config.ts` → `reducedMotion:'reduce'` for deterministic hero. `BACKLOG.md` points at `prism-tokens/DESIGN_RESOURCES.md`.
- **Context:** reviewed 3 UI-inspiration sites (refero.design, Aceternity, Componentry) — neither imports (site = vanilla HTML, app = RN), so effects reimplemented natively + Prism-tokened + reduced-motion guarded, zero deps. Cross-repo (this session): `prism-tokens/DESIGN_RESOURCES.md` created (d4fbff2); resonance BACKLOG pointer (5a61a44); app `<RecapCelebration />` confetti component → Drop-App PR #146 (unwired, tsc-green). Backlogged: site moving-cards (needs real logos). Cut: app always-on animated hero.
- **Tested:** `npm test` 46/46 (desktop + mobile-safari, zero console errors, h1 intact, flipwords.js loads). **DEPLOYED** to trydropapp.com (`npx wrangler pages deploy dist`, CF account `ba8c4fed…`, deployment `a367ae37.drop-site.pages.dev`); live browser verify on trydropapp.com: `.aurora` present + `aurora-drift` animating + gradient; `.flip` cycling (sets→shows), 100px reserved, no reflow; zero console errors.
- **Remaining:** App PR #146 needs wiring into the recap screen + device QA (separate follow-up).
- **Next steps (ranked):**
  1. Deploy hero effects to trydropapp.com (Exact next step #1) + live-verify.
  2. Drop-App PR #146: wire `<RecapCelebration>` into the recap screen root View, device-QA burst + reduce-motion skip, then merge.

### 2026-07-08 — Codex — Login route cleanup + auth redirect normalization
- **Changed:** switched website auth links to `/account.html`; updated `workers/app-path/worker.js` so `/`, `/app*`, `/login`, and `/account.html` on `app.trydropapp.com` all serve the static account shell from `/account.html` with no-cache response handling.
- **Changed:** normalized `account.js` auth callbacks from `/login` to `/account.html` for `AUTH_REDIRECT`, including password-reset return paths.
- **Tested:** `npm test` (46/46 pass, desktop + mobile-safari) in this environment.
- **Remaining:** deploy with `CLOUDFLARE_API_TOKEN` and founder-level QA of live auth callback return flow.
- **Next:** see Exact next step above.
