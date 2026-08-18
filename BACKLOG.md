# drop-site Backlog

Prioritized follow-ups. Update when priorities/scope change (see AGENTS.md closeout rules).

## Now

- [x] Deliver Android Digital Asset Links and submit Google Play launch — complete 2026-08-18. PR #95 merged as `a66eb6d`; the apex response is HTTP 200 JSON and byte-identical to reviewed source. Production 1.0.2 (2) is in Google review as submission `1`, United States only, with managed publishing off for automatic publication after approval. Physical App Links acceptance remains device-QA flagged because no Android test device is available.
- [x] Make verified phone mandatory for standalone website accounts — reviewed 2026-08-12: explicit compatibility attestation routes every auth provider into no-skip OTP proof; recovery/sign-out/deletion remain reachable; 7 Node + 160 Playwright checks pass. Standard PR/main deploy and live provenance verification remain delivery work before backend activation approval.
- [x] Add canonical event/venue/artist pages from the real catalog — live 2026-08-02 through PRs #38/#39: stable UUID-backed readable paths, server-rendered lifecycle-aware metadata/JSON-LD, fail-closed index eligibility, a quality-filtered live entity sitemap, and full-catalog venue/artist pagination. Thin aggregates remain directly accessible with `noindex, follow`; ticket URLs never imply availability; event links retain venue UUID identity. No fabricated listings or production database writes.
- [x] Verify `trydropapp.com` in Google Search Console and submit both production sitemaps — complete 2026-08-02. Google reports `Success` for `sitemap.xml` (27 discovered pages) and `sitemap-entities.xml` (3,581 discovered pages).
- [ ] Persist signed-in show/venue reviews to `show_ratings` and render moderated public review summaries on canonical event/venue pages. The current website's rating UI is local-only and must not be presented as a working review flow.
- [x] Deploy the paired backend `events.timezone` migration/ingest, rerun the full live-backed suite, and release the website — complete 2026-07-18: 96/96 local + GitHub, PR #17 / `aa76a7a`, production run `29639887776`, and desktop/mobile live catalog/art QA green. Multi-day schedule rendering is regression-tested; production has no official festival set-time rows yet, so live-data schedule QA remains waiting rather than fabricated.
- [x] Replace generic/empty event cards with the proper event → lineup artist → Prism chain and wire real festival discovery/set times — independently reviewed and live through PR #17 on 2026-07-18; targeted regressions 10/10 and generated-dist parity clean.
- [x] Add link-hub-specific `og-image-link.png` for `/link` (link.html) — done 2026-07-02 (commit 006699c), verified 1200x630.

## Blocked / waiting

- [ ] After Google approves submission `1`, verify the signed-out public Play listing, package/version, and United States availability. Managed publishing is off, so no manual publish action should be required.
- [ ] Import the verified Google Search Console property into Bing Webmaster Tools (founder OAuth remains required).
- [ ] Obtain an official festival schedule/export source, author the reviewed v1 set-time manifest, and then live-smoke venue-timezone grouping. Production currently has zero published-festival set times.

## Next

- [ ] Richer JSON-LD: add `FAQPage` schema once an FAQ section exists. The live
  App Store URL and offer are already present in SoftwareApplication metadata.

> Design ideas to pull from: see `prism-tokens/DESIGN_RESOURCES.md` (refero / Aceternity / Componentry — reimplement natively, Prism-token, reduced-motion).
- [ ] FAQ section on homepage — common AI-search queries ("is Drop free", "what cities does Drop cover", "when does Drop launch") currently unanswered anywhere on-site, so AI answer engines have nothing to cite.
- [ ] Blog/content page (even 1-2 posts) — the site is 4 static pages with no long-form content for SEO/AI-SEO to index beyond the homepage.

## Later

- [ ] `WebSite` schema + `sitelinks searchbox` markup if/when on-site search exists.
- [ ] Per-city or per-festival SEO pages (programmatic) using the live catalog; event/venue/artist entity pages are already implemented on the entity-SEO branch.
- [ ] llms-full.txt (expanded version of llms.txt) if AI crawler traffic in analytics justifies it.
