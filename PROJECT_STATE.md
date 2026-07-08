# PROJECT STATE — drop-web-app (read me first)

> Repo renamed 2026-07-06: `drop-landing` → `drop-web-app`. This is **the Drop website**
> (trydropapp.com) — one of two front-end surfaces over the shared backend; the other is
> the **mobile app** (`../drop-mobile-app`). Same content, different access. Historical
> entries below may still say "drop-landing".

Last updated: 2026-07-08
Full history (if archived): vault → AI Agents/Codebase Docs/drop-landing/PROJECT_HISTORY.md

## SESSION LOCK
**Status:** UNLOCKED
How to use: advisory + durable record only. Concurrent sessions auto-isolate in their own git worktree (session/<id>) via dev-session.zsh — there is NO global LOCKED state to set. Record Owner / Working on at session start.
### Active session (if any)
- Owner: — · Started: — · Working on: fresh — no sessions yet

## Current status
### What works
- FULL 12-page public event-discovery website LIVE at trydropapp.com (cutover 2026-07-06, see CUTOVER RECORD): AXS-style IA, Prism tokens, live Supabase public catalog (anon key, 1.5K events), 32/32 Playwright smoke green.
- Browser login/account shell is LIVE on `app.trydropapp.com` (2026-07-08, Codex): static non-Expo `account.html` screen matches the requested split-panel Prism login design, uses Supabase Auth against the same Drop project, supports email/password, username password login through `login-with-username`, sign-up, password reset, Google/Apple/Facebook OAuth triggers, and shows signed-in profile/attendance/followed-artist/followed-venue data through existing RLS. Deployed Pages `694a445f.drop-site.pages.dev`; deployed Worker `drop-app-path` version `73d5a5c2-774f-4e18-a708-1754ed669d56`.
- Expo web proxy is retired (2026-07-08, Codex): trydropapp.com remains the standalone public website; `/app` and `/app/...` no longer serve Expo web and now redirect to `https://app.trydropapp.com/login`.
- 19-rule UI best-practices audit PASSED + fixes deployed (2026-07-06, commit 7308468, live-verified): undefined `--r-card` radius bug fixed, chip selected-state = solid cyan (gradient reserved for .btn-primary), events sort select → toggle chips, event-page nav CTA ghosted, legal numerals cyan, venue/artist card value-hierarchy, header search live-filters venues/artists grids, `.btn-primary` fill desaturated ~18% (`--grad-glow-fill`, AA contrast 5.06:1 worst stop; waveform/text/glow keep full sat).
- UI consistency cleanup is LIVE on trydropapp.com (2026-07-08, Codex; final Pages deployment `3bcc25b0.drop-site.pages.dev`): link hub now uses the same desaturated Prism CTA fill/pill geometry, time tabs and filter chips share selected-state tokens, native emoji/symbol UI was replaced with Prism-styled marks/labels, Bass/Dubstep and Clubs have distinct tints, venue/artist detail H1s use Space Grotesk, promoter section labels/wrap are cleaned up, and the download waitlist no longer emits the mailto mixed-content console warning. Verified with `npm test` 42/42, targeted Playwright screenshots in `/tmp/drop-site-fix-qa`, live CSS/HTML marker checks, and live browser pass on `/link.html`, `/download.html`, `/promoters.html`, `/events.html` with zero console/page errors.
### In progress — Active Claims
Live cross-session claims (who is working on what right now) are in the vault: `AI Agents/Operations/SESSION_CLAIMS.md` — run `python3 ~/Developer/agent-stack/scripts/session_claim.py list`. List durable in-progress items here.
### Blocked / waiting on
- Founder: Bing Webmaster import-from-GSC (OAuth grant only founder can approve; extension also lacks bing.com permission).
### Exact next step
1. Founder QA: open `https://app.trydropapp.com/login` and sign in with a real Drop account; confirm the dashboard shows your profile, shows, followed artists, and followed venues.
2. Supabase Auth redirect check: ensure `https://app.trydropapp.com/login` is in Supabase Auth redirect URLs so Google/Apple/Facebook OAuth, sign-up confirmation, and password reset round-trips land back on the browser account shell.
3. Founder QA: hard-refresh `https://trydropapp.com`, confirm header `Log in` opens `https://app.trydropapp.com/login`, and spot-check `/download.html`, `/events.html`, one artist detail, and one venue detail at 390/768/1440.
4. **Founder: Bing Webmaster Tools** — bing.com/webmasters → "Import from Google Search Console" (OAuth grant; property https://trydropapp.com verified + sitemap submitted in GSC 2026-07-06). Also grant bing.com in the Claude-in-Chrome extension if you want agents to drive it next time.
5. Check GSC sitemap status flipped from "Couldn't fetch" (submit-time placeholder; /sitemap.xml serves 200) to Success — GSC → Sitemaps for property https://trydropapp.com; if still failing after ~24h, inspect content-type served by CF Pages.

## CUTOVER RECORD (2026-07-06 — LIVE)
- trydropapp.com + www → CF Pages project **drop-site** (this repo's `dist/`; deploy = `npx wrangler pages deploy dist --project-name=drop-site --branch=main`, account ba8c4fed…, no git integration — deploy manually after changes; `npm test` first).
- `trydropapp.com/app*` and `app.trydropapp.com/*` → Worker **drop-app-path**. Apex `/app` and `/app/...` redirect to `https://app.trydropapp.com/login`; `app.trydropapp.com` serves the static browser account shell from this repo. No Expo web proxy is active on public routes.
- DNS (zone 5ac5024f…): apex+www CNAME → drop-site.pages.dev; app host remains proxied so the Worker route can catch legacy links.
- Verified live: all 12 pages 200, /link 200, /legal/* 301s, /event/<uuid> serves event page (200 rewrite + path-parsed id), AASA application/json at root, www→apex 301. Browser check: h1 renders, 24 live event cards, body scrolls (no app overflow:hidden), zero page errors. 2026-07-08 check: `/app/` and `/app/login` 302 to `https://app.trydropapp.com/login`; `app.trydropapp.com/login` and `/signup` serve the static account shell; account assets serve 200.

## Recent sessions (last 5 — older entries in PROJECT_HISTORY.md)
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
### 2026-07-06 — Claude (Fable) — 4-track parallel: AXS page-align + anon going-count + GSC + Drop-App cross-links
- **Changed:** (this repo, IN FLIGHT — subagent still editing events/artists/venues/event.html + site.css in main checkout, unverified until its npm test + commit lands). LANDED: worktree branch `feat/anon-going-count` commit bb48627 (data.js `Drop.fetchGoingCounts` batched RPC, site.js "N going" pill via `Drop.renderEvents` choke point, shown only when ≥2; site.css `.wsc__going`); drop-backend commit 488ac7c migration `migrations/0004_event_going_counts.sql` — `event_going_counts(uuid[])` aggregate RPC, APPLIED to prod Supabase, anon-safety live-verified (RPC returns counts only; raw attendance blocked for anon). GSC: URL-prefix property https://trydropapp.com created, token `google75d252b1adf86e07.html`, deploy snapshot staged in session scratchpad. Drop-App cross-links PR in flight (branch chore/split-surface-crosslinks).
- **Tested:** post-merge npm test 34/34 (incl. fixed stale h1 expectation); anon REST safety verified live; dist parity-checked vs root sources; founder deployed (7d34def3.drop-site.pages.dev → live); GSC ownership VERIFIED (HTML file; CF pretty-URL 308 harmless) + /sitemap.xml SUBMITTED; live event page 0 console errors (agent Playwright drive). ALL FOUR TRACKS LANDED: page-align 180024d + wedge merge + GSC token 6006fec pushed; drop-backend 488ac7c pushed; Drop-App cross-links PR (#136) squash-merged after agent-ci + web-smoke green (welcome.tsx 1370→230 lines).
- **Remaining:** Bing import (founder OAuth); GSC sitemap status re-check; founder QA of live pills/login.
- **Next steps (ranked):**
  1. **Founder-blocked:** approve prod deploy `npx wrangler pages deploy <scratchpad>/dist-snapshot --project-name=drop-site --branch=main` (live dist + GSC token file only) — classifier denied autonomous run; OR fold token file into the integration deploy below.
  2. Integrate: in /Users/aryashinde/Developer/Drop/drop-web-app merge agent page-align commit + branch `feat/anon-going-count` (worktree at ../drop-web-app-socialwedge, commit bb48627), add google75d252b1adf86e07.html at root, fix 2 pre-existing smoke failures (h1 copy expectation in tests/smoke.spec.ts), npm test green, rebuild dist, deploy drop-site.
  3. Post-deploy: GSC Verify → submit https://trydropapp.com/sitemap.xml → Bing webmaster import-from-GSC; merge Drop-App PR chore/split-surface-crosslinks once agent-ci green.
