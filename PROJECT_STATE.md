# PROJECT STATE — drop-web-app (read me first)

> Repo renamed 2026-07-06: `drop-landing` → `drop-web-app`. This is Drop's **web app**
> (trydropapp.com) — one of two front-end surfaces over the shared backend; the other is
> the **mobile app** (`../drop-mobile-app`). Same content, different access. Historical
> entries below may still say "drop-landing".

Last updated: 2026-07-06
Full history (if archived): vault → AI Agents/Codebase Docs/drop-landing/PROJECT_HISTORY.md

## SESSION LOCK
**Status:** UNLOCKED
How to use: advisory + durable record only. Concurrent sessions auto-isolate in their own git worktree (session/<id>) via dev-session.zsh — there is NO global LOCKED state to set. Record Owner / Working on at session start.
### Active session (if any)
- Owner: — · Started: — · Working on: fresh — no sessions yet

## Current status
### What works
- FULL 12-page public event-discovery website LIVE at trydropapp.com (cutover 2026-07-06, see CUTOVER RECORD): AXS-style IA, Prism tokens, live Supabase public catalog (anon key, 1.5K events), 32/32 Playwright smoke green.
- 19-rule UI best-practices audit PASSED + fixes deployed (2026-07-06, commit 7308468, live-verified): undefined `--r-card` radius bug fixed, chip selected-state = solid cyan (gradient reserved for .btn-primary), events sort select → toggle chips, event-page nav CTA ghosted, legal numerals cyan, venue/artist card value-hierarchy, header search live-filters venues/artists grids, `.btn-primary` fill desaturated ~18% (`--grad-glow-fill`, AA contrast 5.06:1 worst stop; waveform/text/glow keep full sat).
### In progress — Active Claims
Live cross-session claims (who is working on what right now) are in the vault: `AI Agents/Operations/SESSION_CLAIMS.md` — run `python3 ~/Developer/agent-stack/scripts/session_claim.py list`. List durable in-progress items here.
### Blocked / waiting on
- GSC/Bing sitemap submission (founder site-verification).
### Exact next step
1. **DEPLOY the AXS-style homepage rebuild** (built + committed 6b2bab0, NOT deployed — needs founder
   go): `npx wrangler pages deploy dist --project-name=drop-site --branch=main`. index.html is now a
   browse-first discovery home (search+city+date bar → genre chips → Happening with Today/This
   Weekend/Next 30 Days time-tabs → genre tiles → Just dropped → venues); marketing hero/waitlist/
   feature-grid removed; wordmark → `◦ drop` (droplet + lowercase) across all 12 pages. Tested:
   npm test 32/32, 0 console errors, visual QA PASS (no blockers). After deploy: founder eyeball +
   optional social-wedge on cards (friends-going/crew — deferred; needs auth signal on the site).
2. **SINGLE-URL CUTOVER DONE + LIVE (2026-07-06 eve).** trydropapp.com = one URL: static
   discovery/SEO/login at root + the Expo app at **/app** (CF worker `drop-app-path` proxies to
   Pages `drop-web`, baseUrl='/app'); **app.trydropapp.com now 301s → trydropapp.com/app**. PR #134
   merged; worker deployed (routes trydropapp.com/app*, app.trydropapp.com/*); site deployed
   (login→/app). Supabase redirect allowlist has trydropapp.com/app + /app/**. VERIFIED live:
   /app shell boots 0 console errors, JS loads through worker, 301s fire both roots, root site 200,
   SSRF path-host-swap guard holds, login bad-creds graceful. **Login now owned by the app:** the bespoke /login.html card (email-only, plain
   layout) is RETIRED — nav "Log in" → /app/login (the app's real login: email/username + Google +
   Facebook + web split layout), and /login + /login.html 301 → /app/login. Verified live. **Founder
   QA: log in from trydropapp.com (nav → app login) happy path + one Google round-trip.**
   Follow-ups: after QA remove app.trydropapp.com from Supabase allowlist (none present — skip);
   web-push re-enable on /app (7 test users, trivial); optionally drop app.trydropapp.com DNS after
   a deprecation window (301 worker keeps old links alive meanwhile).
2. **Founder: QA the two 2026-07-06 evening deploys on the live site** — (a) log in once from
   https://trydropapp.com/login (@handle + password → should land signed-in on app.trydropapp.com
   via the fragment handoff), (b) eyeball the shell restyle (events grid = uniform 300x340 cards,
   glass price pill, cyan date kicker). Both DEPLOYED to CF Pages `drop-site`. Code: login commit
   93ec9dd + restyle commit e283474; Playwright 36/36 + DOM audit passed pre-deploy.
2. Update Drop-App cross-links for the split surface: web-deploy.yml comment ("deploys to app.trydropapp.com" not root), and point the Expo web `welcome.tsx` marketing surface at the website (or slim it — the website owns marketing now). Note: app deep links (`https://trydropapp.com/event/<id>`) intentionally still target the ROOT domain — the website serves them (/event/* rewrite) and AASA/assetlinks stay at root, so Universal Links keep working. Do NOT change deepLinks.ts hosts.
3. Submit https://trydropapp.com/sitemap.xml to GSC/Bing (founder verification).

## CUTOVER RECORD (2026-07-06 — LIVE)
- trydropapp.com + www → CF Pages project **drop-site** (this repo's `dist/`; deploy = `npx wrangler pages deploy dist --project-name=drop-site --branch=main`, account ba8c4fed…, no git integration — deploy manually after changes; `npm test` first).
- app.trydropapp.com → CF Pages project **drop-web** (Expo web app; Drop-App web-deploy.yml keeps auto-deploying it on Drop-App main pushes — unchanged).
- DNS (zone 5ac5024f…): apex+www CNAME → drop-site.pages.dev; app CNAME → drop-web-2lo.pages.dev (all proxied).
- Verified live: all 12 pages 200, /link 200, /legal/* 301s, /event/<uuid> serves event page (200 rewrite + path-parsed id), AASA application/json at root, www→apex 301, app.trydropapp.com 200. Browser check: h1 renders, 24 live event cards, body scrolls (no app overflow:hidden), zero page errors.

## Recent sessions (last 5 — older entries in PROJECT_HISTORY.md)
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
