# drop-site Backlog

Prioritized follow-ups. Update when priorities/scope change (see AGENTS.md closeout rules).

## Now

- [x] Deploy the paired backend `events.timezone` migration/ingest, rerun the full live-backed suite, and release the website — complete 2026-07-18: 96/96 local + GitHub, PR #17 / `aa76a7a`, production run `29639887776`, and desktop/mobile live catalog/art QA green. Multi-day schedule rendering is regression-tested; production has no official festival set-time rows yet, so live-data schedule QA remains waiting rather than fabricated.
- [x] Replace generic/empty event cards with the proper event → lineup artist → Prism chain and wire real festival discovery/set times — independently reviewed and live through PR #17 on 2026-07-18; targeted regressions 10/10 and generated-dist parity clean.
- [x] Add link-hub-specific `og-image-link.png` for `/link` (link.html) — done 2026-07-02 (commit 006699c), verified 1200x630.

## Blocked / waiting

- [ ] Submit sitemap.xml to Google Search Console and Bing Webmaster Tools (needs site verification — founder action).
- [ ] Obtain an official festival schedule/export source, author the reviewed v1 set-time manifest, and then live-smoke venue-timezone grouping. Production currently has zero published-festival set times.

## Next

- [ ] After the ticket-paste MVP is live-validated, add a first-run "Build your history" entry and evaluate optional one-time Gmail/Outlook import with least-privilege scopes, explicit review, and no raw-email retention.
- [ ] Richer JSON-LD: add `FAQPage` schema once an FAQ section exists; add `offers`/App Store `url` to the SoftwareApplication schema once Drop is listed.

> Design ideas to pull from: see `prism-tokens/DESIGN_RESOURCES.md` (refero / Aceternity / Componentry — reimplement natively, Prism-token, reduced-motion).
- [ ] FAQ section on homepage — common AI-search queries ("is Drop free", "what cities does Drop cover", "when does Drop launch") currently unanswered anywhere on-site, so AI answer engines have nothing to cite.
- [ ] Blog/content page (even 1-2 posts) — the site is 4 static pages with no long-form content for SEO/AI-SEO to index beyond the homepage.

## Later

- [ ] `WebSite` schema + `sitelinks searchbox` markup if/when on-site search exists.
- [ ] Per-city or per-festival SEO pages (programmatic) once event data is live in the app — highest-leverage AI-SEO play once there's real content to point at.
- [ ] llms-full.txt (expanded version of llms.txt) if AI crawler traffic in analytics justifies it.
