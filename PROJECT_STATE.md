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
- CUTOVER = waiting on founder go-ahead (auto-mode classifier blocked prod deploy 2026-07-06; denial final for that session). Also still waiting: GSC/Bing sitemap submission (founder site-verification).
### Exact next step
1. **Founder-approved cutover** (~15 min once approved): `cd ~/Developer/Drop/drop-landing && rm -rf dist && mkdir dist && cp <site files per 2026-07-06 session note> dist/ && CLOUDFLARE_ACCOUNT_ID=ba8c4fedf96b95e46b4d8b87789ccb69 npx wrangler pages project create drop-site --production-branch=main && npx wrangler pages deploy dist --project-name=drop-site --branch=main` → verify drop-site.pages.dev → add custom domain `app.trydropapp.com` to `drop-web`, verify → move `trydropapp.com` + `www` custom domains drop-web→drop-site (dashboard: Workers & Pages → project → Custom domains) → live-verify all 12 pages + /link + /event/:id redirect + AASA.
2. Update Drop-App web-deploy.yml comment + welcome.tsx cross-links (website ⇄ app.trydropapp.com) after cutover.
3. Submit sitemap to GSC/Bing (founder verification).

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
