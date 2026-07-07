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
- Founder approval: prod deploy of GSC verification snapshot (classifier-denied autonomous wrangler deploy; command in Next steps of today's session entry).
- 2 in-flight subagent tracks (page-align in this checkout; Drop-App cross-links PR).
### Exact next step
1. **Founder: approve GSC-verification prod deploy** — `npx wrangler pages deploy <session-scratchpad>/dist-snapshot --project-name=drop-site --branch=main` (live dist + `google75d252b1adf86e07.html` only; classifier denied autonomous run). Alternatively skip and fold token file into step 2's integration deploy.
2. Integrate 2026-07-06 parallel tracks: in this repo merge the page-align commit (subagent, main checkout) + branch `feat/anon-going-count` (worktree ../drop-web-app-socialwedge, commit bb48627); add `google75d252b1adf86e07.html` at root; fix 2 pre-existing smoke failures (h1 copy expectation in tests/smoke.spec.ts); `npm test` green → rebuild dist → deploy drop-site → GSC Verify → submit /sitemap.xml → Bing import-from-GSC. Then `git worktree remove ../drop-web-app-socialwedge`.
3. Merge the Drop-App cross-links PR (branch chore/split-surface-crosslinks) once agent-ci green. (Deep links intentionally stay on root domain — do NOT change deepLinks.ts hosts.)
4. Founder QA (standing): hard-refresh trydropapp.com eyeball + one Google login round-trip nav → /app/login; then web-push re-enable on /app; optional app.trydropapp.com DNS retirement after deprecation window.

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
### 2026-07-06 — Claude (Fable) — 4-track parallel: AXS page-align + anon going-count + GSC + Drop-App cross-links
- **Changed:** (this repo, IN FLIGHT — subagent still editing events/artists/venues/event.html + site.css in main checkout, unverified until its npm test + commit lands). LANDED: worktree branch `feat/anon-going-count` commit bb48627 (data.js `Drop.fetchGoingCounts` batched RPC, site.js "N going" pill via `Drop.renderEvents` choke point, shown only when ≥2; site.css `.wsc__going`); drop-backend commit 488ac7c migration `migrations/0004_event_going_counts.sql` — `event_going_counts(uuid[])` aggregate RPC, APPLIED to prod Supabase, anon-safety live-verified (RPC returns counts only; raw attendance blocked for anon). GSC: URL-prefix property https://trydropapp.com created, token `google75d252b1adf86e07.html`, deploy snapshot staged in session scratchpad. Drop-App cross-links PR in flight (branch chore/split-surface-crosslinks).
- **Tested:** wedge branch npm test 32 pass + 2 PRE-EXISTING failures (h1 copy mismatch, fails identically on unmodified branch — needs fix); anon REST verification ran live. Page-align + cross-links tracks: unverified (agents running).
- **Remaining:** merge page-align commit + `feat/anon-going-count` into main, fix the 2 pre-existing smoke failures, assemble dist (+ commit google75d252b1adf86e07.html at root), npm test, deploy `drop-site`; GSC Verify click + sitemap.xml submit + Bing import after deploy; merge Drop-App cross-links PR when CI green; remove worktree drop-web-app-socialwedge after merge.
- **Next steps (ranked):**
  1. **Founder-blocked:** approve prod deploy `npx wrangler pages deploy <scratchpad>/dist-snapshot --project-name=drop-site --branch=main` (live dist + GSC token file only) — classifier denied autonomous run; OR fold token file into the integration deploy below.
  2. Integrate: in /Users/aryashinde/Developer/Drop/drop-web-app merge agent page-align commit + branch `feat/anon-going-count` (worktree at ../drop-web-app-socialwedge, commit bb48627), add google75d252b1adf86e07.html at root, fix 2 pre-existing smoke failures (h1 copy expectation in tests/smoke.spec.ts), npm test green, rebuild dist, deploy drop-site.
  3. Post-deploy: GSC Verify → submit https://trydropapp.com/sitemap.xml → Bing webmaster import-from-GSC; merge Drop-App PR chore/split-surface-crosslinks once agent-ci green.

