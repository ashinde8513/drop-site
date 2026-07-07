# PROJECT STATE — drop-landing (read me first)

Last updated: 2026-07-06
Full history (if archived): vault → AI Agents/Codebase Docs/drop-landing/PROJECT_HISTORY.md

## SESSION LOCK
**Status:** UNLOCKED
How to use: advisory + durable record only. Concurrent sessions auto-isolate in their own git worktree (session/<id>) via dev-session.zsh — there is NO global LOCKED state to set. Record Owner / Working on at session start.
### Active session (if any)
- Owner: — · Started: — · Working on: fresh — no sessions yet

## Current status
### What works
- FULL 12-page public event-discovery website built + committed (2026-07-06, commit 49c1db6): index/events/event/venue/artist/venues/artists/promoters/about/download + restyled privacy/terms. AXS-style IA, Prism tokens, live Supabase public catalog (anon key, 1.5K events), 32/32 Playwright smoke green, visual + code + humanizer review loops done. NOT YET DEPLOYED — trydropapp.com still serves the Expo web app (Cloudflare Pages project `drop-web`, deployed from Drop-App).
- Cutover assets ready: `dist/` build recipe (see Recent sessions), `_redirects` (app deep-link paths /event/:id /plan/:id /onboarding + /legal/*), `_headers` (AASA content-type), `.well-known/` AASA + assetlinks copied from live site.
### In progress — Active Claims
Live cross-session claims (who is working on what right now) are in the vault: `AI Agents/Operations/SESSION_CLAIMS.md` — run `python3 ~/Developer/agent-stack/scripts/session_claim.py list`. List durable in-progress items here.
### Blocked / waiting on
- GSC/Bing sitemap submission (founder site-verification).
### Exact next step
1. **Founder: rotate the Cloudflare DNS token** — the `drop-dns-agent` token (Zone:DNS:Edit, trydropapp.com) was pasted into a Claude chat 2026-07-06 (burned; transcript-synced). Dashboard → My Profile → API Tokens → roll/delete it; replacement lives in macOS Keychain as `cloudflare-dns-trydropapp` (update via `security add-generic-password -U -s cloudflare-dns-trydropapp -a arya -w <new>`).
2. Update Drop-App cross-links for the split surface: web-deploy.yml comment ("deploys to app.trydropapp.com" not root), and point the Expo web `welcome.tsx` marketing surface at the website (or slim it — the website owns marketing now). Note: app deep links (`https://trydropapp.com/event/<id>`) intentionally still target the ROOT domain — the website serves them (/event/* rewrite) and AASA/assetlinks stay at root, so Universal Links keep working. Do NOT change deepLinks.ts hosts.
3. Submit https://trydropapp.com/sitemap.xml to GSC/Bing (founder verification).

## CUTOVER RECORD (2026-07-06 — LIVE)
- trydropapp.com + www → CF Pages project **drop-site** (this repo's `dist/`; deploy = `npx wrangler pages deploy dist --project-name=drop-site --branch=main`, account ba8c4fed…, no git integration — deploy manually after changes; `npm test` first).
- app.trydropapp.com → CF Pages project **drop-web** (Expo web app; Drop-App web-deploy.yml keeps auto-deploying it on Drop-App main pushes — unchanged).
- DNS (zone 5ac5024f…): apex+www CNAME → drop-site.pages.dev; app CNAME → drop-web-2lo.pages.dev (all proxied).
- Verified live: all 12 pages 200, /link 200, /legal/* 301s, /event/<uuid> serves event page (200 rewrite + path-parsed id), AASA application/json at root, www→apex 301, app.trydropapp.com 200. Browser check: h1 renders, 24 live event cards, body scrolls (no app overflow:hidden), zero page errors.

## Recent sessions (last 5 — older entries in PROJECT_HISTORY.md)
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
