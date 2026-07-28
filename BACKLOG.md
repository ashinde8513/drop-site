# drop-site Backlog

Prioritized follow-ups. Update when priorities/scope change (see AGENTS.md closeout rules).

## Now

- [x] Build Foundation 1A of the website parity preview at `/app/next/` — approved Claude.ai/design states, shared auth/account wiring, responsive shell, profile/settings/deletion, 118/118 browser checks; isolated and not deployed (2026-07-22).
- [x] Design the complete current-app signed-in parity experience in Claude.ai/design, preserving public-site continuity on desktop, a web-native mobile layout, and honest native-only boundaries (2026-07-26).
- [x] Founder approved implementation of the complete `Website design prompt` prototype after the native-source parity clarification (2026-07-26).
- [x] Implement the first Discovery 2A runtime slice in `/app/next/`: real global catalog/search, scoped Happening, personalized For You, block-safe Crew, event detail, RSVP, canonical sharing, tickets, and honest conditional states (2026-07-26).
- [x] Finish Discovery 2A in `/app/next/`: detailed native-correct Search filters plus save/follow/calendar, cross-source ticket offers, weather/presale timing, and moderated event comments; isolated and not deployed (2026-07-27).
- [x] Finish the signed-in fidelity correction: paired Claude/local screenshots at desktop and 390px mobile, 160/160 browser checks, owner-only Sites v4 republish from exact source commit `b4f1de4`, and live asset/log verification (2026-07-28). Production remains unchanged.
- [ ] Before production cutover, add a server-enforced current-window presale-code RPC/RLS contract. The preview intentionally never requests `presale_codes` because the current authenticated-read policy exposes future codes.
- [x] Implement the approved connected core runtime in `/app/next/`: Map, My Shows/history/logging, Friends/requests/activity/public profiles, Crews, Plans/Plan Detail/chat/invites/meetups, Festivals/schedules/Live Mode, Notifications, Stats/Wrapped, Wallet/reminders, and blocked accounts; 230/230 browser checks passed (2026-07-28). Production `/app` remains unchanged.
- [x] Add the exact owner-only preview base and reset-password callbacks to Supabase Auth; Google OAuth now preserves the `/app/next/` return URL instead of falling back to production (2026-07-28).
- [ ] After founder QA, choose the next specialist parity family: taste match; imports/media/recap authoring; activation; promoter/admin; or deeper realtime/social.

- [x] Deploy the paired backend `events.timezone` migration/ingest, rerun the full live-backed suite, and release the website — complete 2026-07-18: 96/96 local + GitHub, PR #17 / `aa76a7a`, production run `29639887776`, and desktop/mobile live catalog/art QA green. Multi-day schedule rendering is regression-tested; production has no official festival set-time rows yet, so live-data schedule QA remains waiting rather than fabricated.
- [x] Replace generic/empty event cards with the proper event → lineup artist → Prism chain and wire real festival discovery/set times — independently reviewed and live through PR #17 on 2026-07-18; targeted regressions 10/10 and generated-dist parity clean.
- [x] Add link-hub-specific `og-image-link.png` for `/link` (link.html) — done 2026-07-02 (commit 006699c), verified 1200x630.

## Blocked / waiting

- [ ] Submit sitemap.xml to Google Search Console and Bing Webmaster Tools (needs site verification — founder action).
- [ ] Obtain an official festival schedule/export source, author the reviewed v1 set-time manifest, and then live-smoke venue-timezone grouping. Production currently has zero published-festival set times.

## Next

- [ ] Richer JSON-LD: add `FAQPage` schema once an FAQ section exists; add `offers`/App Store `url` to the SoftwareApplication schema once Drop is listed.

> Design ideas to pull from: see `prism-tokens/DESIGN_RESOURCES.md` (refero / Aceternity / Componentry — reimplement natively, Prism-token, reduced-motion).
- [ ] FAQ section on homepage — common AI-search queries ("is Drop free", "what cities does Drop cover", "when does Drop launch") currently unanswered anywhere on-site, so AI answer engines have nothing to cite.
- [ ] Blog/content page (even 1-2 posts) — the site is 4 static pages with no long-form content for SEO/AI-SEO to index beyond the homepage.

## Later

- [ ] Cut over `/app/next/` only after the complete parity preview passes shared-backend integration, desktop/mobile Playwright, security/access-control review, founder acceptance, and an explicit production approval.

- [ ] `WebSite` schema + `sitelinks searchbox` markup if/when on-site search exists.
- [ ] Per-city or per-festival SEO pages (programmatic) once event data is live in the app — highest-leverage AI-SEO play once there's real content to point at.
- [ ] llms-full.txt (expanded version of llms.txt) if AI crawler traffic in analytics justifies it.
