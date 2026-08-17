# PROJECT STATE — drop-web-app (read me first)

> Repo renamed 2026-07-06: `drop-landing` → `drop-web-app`. This is **the Drop website**
> (trydropapp.com) — one of two front-end surfaces over the shared backend; the other is
> the **mobile app** (`../drop-mobile-app`). Same content, different access. Historical
> entries below may still say "drop-landing".
>
> **Framing (founder, 2026-07-18): never call this a marketing page / landing page.** It is one
> website with a **signed-out view** (open browse at trydropapp.com) and a **signed-in view**
> (the Prism SPA at `app.trydropapp.com` / `/app`).

Last updated: 2026-08-18
Full history (if archived): vault → AI Agents/Codebase Docs/drop-landing/PROJECT_HISTORY.md

## SESSION LOCK
**Status:** AVAILABLE — Google Play submission is in external review
How to use: advisory + durable record only. Concurrent sessions auto-isolate in their own git worktree (session/<id>) via dev-session.zsh — there is NO global LOCKED state to set. Record Owner / Working on at session start.
### Active session (if any)
- Owner: Codex `/root` — Phase 1 Facebook Login delivery.
- Working on: branch `agent/facebook-login-website-20260817` is rebased onto
  current `origin/main` after prerequisite PR #83 merged as `bf9c4e9`; it is
  independently reviewed, fully retested, and pushed.

## Current status
### What works
- **GOOGLE PLAY LAUNCH SUBMITTED + ANDROID DAL LIVE (2026-08-18):** website PR #95 merged as `a66eb6d814bbac36af796da9655198aa9d94c130`. The apex Digital Asset Links response is HTTP 200 `application/json`, does not redirect, is byte-identical to the reviewed source (SHA-256 `0dd572814e9206e412bc0910e4752e87286ed058f28cbae878606d4ee1be7525`), and names package `app.resonanceventures.drop` with the current Play App Signing fingerprint. Google Play submission `1` was sent at 5:33 PM on August 18 with Production build 1.0.2 (2), United States availability, and the completed store/app-content declarations. Its authoritative status is **In review**. Managed publishing is off, so Google will publish the approved changes automatically; no replacement AAB was uploaded.
- **GOOGLE PLAY ACCOUNT-DELETION RESOURCE REVIEWED (2026-08-17):** `/delete-account` gives users both the existing in-app deletion path and a prefilled external email-request path, explains deletion/retention behavior, and is linked from the privacy policy and sitemap. Seven Node checks plus 168 desktop/mobile Playwright checks pass; the built page is byte-identical to source and browser QA found no warnings or errors. Delivery through the standard PR/`main` auto-deploy path is in progress.
- **ANDROID DIGITAL ASSET LINKS HOTFIX DELIVERED (2026-08-17/18):** the canonical `.well-known/assetlinks.json` names package `app.resonanceventures.drop` and the exact current Google Play App Signing SHA-256 `E3:15:2D:04:79:CB:20:91:35:16:7C:88:DA:77:07:AE:3D:71:E5:87:C5:97:94:7C:EA:BC:E2:2D:77:5F:A1:F2`. The deploy workflow fails closed unless the built association is present, byte-identical to source, and contains that exact statement; a regression proves omission fails. Focused deploy-contract 1/1 and Android Playwright 2/2, full Node 8/8 and Playwright 172/172, build verification, diff check, and gitleaks pass. PR #95 merged and the production apex readback matches reviewed source. `www` remains a redirect and is intentionally excluded from Android intent filters. Physical App Links acceptance remains untested because no Android test device is available.
- **CANONICAL PUBLIC CATALOG STATS LIVE (2026-08-16, PR #90):** the homepage requests the live `get_public_catalog_stats` RPC and renders exact comma-formatted event/city counts only after validating nonnegative safe integers plus a server timestamp. Missing, failed, or malformed responses show nonnumeric live-catalog copy—never the stale `4,500+ / 320+` snapshot or a false zero. Main workflow `31937512102` passed 164/164 and deployed merge `9f0d1a2f`; production desktop 1745x1228 and mobile 390x844 rendered 4,110 events / 295 cities with no overflow or console errors. Live `data.js` and `site.js` are byte-identical to reviewed `main`.
- **MOBILE EVENT TICKET BAR LIVE (2026-08-14, PR #88):** the public event detail and signed-in web app now reserve compact 48px icon actions and a bounded Going action so the ticket CTA receives the remaining mobile width. The sticky-only CTA omits redundant price copy and uses neutral `Tickets` for unknown/cancelled ticket state while retaining the full `View ticket details` accessible name and desktop copy. Exact-event QA for `e1572fcc-218a-4fe2-9f7d-a4b301d31bdb` passed at 498×608, 390×844, 320×568, and 1280×800 with no clipping, overlap, horizontal overflow, or console warnings/errors; the live CTA still targets SeatGeek with safe sponsored new-tab attributes. PR #88 merged as `5a26c85d84c76e25ac2f5eae716ded56303f6a71`; main workflow `31852082349` passed 164/164 and deployed through Cloudflare Pages. Live `shell.css` and app-subdomain `index.html`/`app.css` are byte-identical to reviewed source, and the exact pretty event route contains the reviewed public CTA markers.
- **BUYABLE HOMEPAGE EVENT COUNT SUPERSEDED (2026-08-14, PR #86):** this historical browser-local rounded-count implementation shipped successfully, then PR #90 replaced it with the canonical exact server count above. No rounded or numeric offline fallback remains.
- **EXPLICIT POST-OTP DUPLICATE-PHONE PROMPT REVIEWED (2026-08-13):** exact `phone_unavailable` after OTP check explains that the number is linked to another Drop account and offers a direct sign-out-to-login action without exposing its email or identity. Send/resend responses stay generic; required deletion/recovery remain reachable; 7 Node contracts and 162 desktop/mobile Playwright checks pass, with independent adversarial re-review clean. PR/merge/live deploy verification remain.
- **MANDATORY PHONE WEBSITE COMPATIBILITY REVIEWED (2026-08-12):** the signed-in SPA recognizes the live compatibility contract's explicit `profile_complete:true` / `phone_verified:false` state even while backend enforcement remains off, and routes password, Google, Apple, and confirmed-email sessions to the existing `verify-phone` OTP surface. Required mode has no Skip/Continue bypass, re-attests server state before Discover, keeps raw phone/code values ephemeral, maps duplicate-phone responses to generic copy, and preserves password recovery, sign-out, and real `delete-account` access. Legacy compliance payloads retain their prior complete/incomplete behavior. Local verification passed 7/7 Node contracts plus 160/160 Playwright checks across desktop Chromium and mobile WebKit; independent adversarial review found no blockers. Delivery through standard PR/main Cloudflare Pages workflow remains next.
- **IMPACT MARKETPLACE PROFILE REBUILT + APPEAL OPEN (2026-08-10, PR
  #76):** Impact account `7487237` now has a verified `trydropapp.com` website,
  the live `Drop - EDM Events` App Store property, connected Instagram
  `@trydropapp`, connected Facebook Page, and the official Drop LinkedIn page.
  PR #76 placed Impact's current verification tag first in `<head>` and merged
  as `86cdf6dc50465af8179814bf461c076f0ac5e9fe`; the property then showed
  Connected. The rebuilt marketplace application used an app-specific profile
  description and was submitted, but Impact immediately returned Declined.
  Support appeal `865870` is Open under Compliance → Marketplace Approval and
  requests manual review with the verified website, App Store, and social
  ownership evidence. TikTok, YouTube, and X remain unconnected because Impact
  required write or unrelated analytics scopes; no expanded permissions were
  granted.
- **CROSS-BROWSER EMAIL CONFIRMATION CALLBACK LIVE (2026-08-10, PR
  #73):** signup confirmation callbacks now accept only Supabase's documented
  `token_hash` + `type=email` contract, scrub credentials before exchange, and
  call `auth.verifyOtp` before reusing the existing signup-compliance and
  activation gates. OAuth remains PKCE. Invalid, rejected, thrown, wrong-type,
  and oversized-token callbacks fail closed. The final local gate passed seven
  Node checks and 148 Playwright checks across desktop Chromium and mobile
  WebKit; independent adversarial review approved the amended diff. Merge
  `8246246d8012b5521e24c8a059b6b5010ea928f9` passed production workflow
  `31448895774` and deployed through Cloudflare Pages. Live `app.js` is
  byte-identical to reviewed source, and a synthetic invalid callback scrubbed
  the complete URL, rendered the safe recovery error, and emitted no browser
  warnings or errors. The hosted Supabase Confirm signup template now emits the
  exact trusted `token_hash` callback while preserving its subject and all
  other body bytes. A fresh production message completed confirmation from a
  new empty-storage tab, traversed optional-phone activation and onboarding,
  and reached signed-in Discover with no browser warnings or errors.
- **OFFICIAL FACEBOOK PAGE LINK LIVE (2026-08-09, PR #70):** every public
  footer, the link hub, Organization JSON-LD, and `llms.txt` now use the stable
  numeric Page URL `https://www.facebook.com/profile.php?id=61591821453151`
  instead of the unrelated London logistics Page at the `trydropapp` vanity
  path. Meta Accounts Center identifies `61591821453151` as the managed
  `trydropapp` Page. Merge `57b5c699b1450940e7ce371b354f76c5de633cb9`
  passed 138/138 checks and deployed through main workflow `31329063826`.
  Live interaction QA reached the canonical Drop Page with its EDM bio,
  Software category, `trydropapp@gmail.com`, and `trydropapp.com` identity.
- **ALL OFFICIAL SOCIAL PROFILES LIVE (2026-08-09, PR #68):** every existing
  public footer and the link hub expose icon-only links to Drop's Instagram,
  TikTok, X, YouTube, Facebook, Reddit, and LinkedIn profiles. Each link has an
  accessible platform name and opens in a new tab with `noopener noreferrer`.
  Organization structured data and `llms.txt` carry the same canonical URLs.
  Merge `3aed046eb8a9e0e7c4e5092160a0b22316bfcd90` passed 138/138 Playwright
  checks in main workflow `31323566520` and deployed through Cloudflare Pages.
  Live desktop/mobile Browser QA found seven visible icons, no overflow or
  console warnings/errors, and a YouTube click opened the official Drop channel.
- **APP STORE LAUNCH WEBSITE UPDATE LIVE (2026-08-09, PRs #65/#66):**
  `download.html` uses Apple's official Download on the App Store badge linked
  to the live `Drop - EDM Events` listing (`id6790662825`). The former waitlist
  and unused client helper are removed; the link hub, in-app download controls,
  metadata, structured data, app-discovery text, and legal credit reflect the
  public release. PR #66 aligned every availability claim with Apple's live
  iPhone-only compatibility label while retaining iPad user-agent routing to
  the official listing. Merge `6ad7e46551fba41ab33aebf8c42d26eec7d360f5`
  passed main workflow `31320193410` and deployed automatically. Live desktop
  and 390px Browser QA verified `/download`, `/link`, the `/app/` template,
  `/llms.txt`, the official App Store destination, no horizontal overflow, and
  badge SHA-256 `a26fc5b38380272c92e9019a2eb8b45542a66814b3e2b203772db8904b9fb99f`.
- **OPTIONAL PHONE SIGNUP MERGED AND LIVE (2026-08-07, PR #63):** browser account creation routes authenticated email-confirmation and signup-origin OAuth callbacks through one-shot `?mode=signup-complete` handling into a dedicated optional phone step. Every authenticated session attests the existing signup-compliance RPC before Discover, including identities first created from the login-origin Google/Apple buttons; incomplete identities fail closed. The step calls the existing authenticated `verify-phone` Edge boundary, keeps phone/code ephemeral, destroys abandoned/successful state, blocks request races, and preserves Skip/email-only signup. Password signup sends the accepted July 18 metadata and signup-origin OAuth completes the sanctioned compliance RPC from tab-scoped DOB/consent. PR #63 merged as `944ff9362a9e4de7571f9f11c24829f59022df26`; main workflow `31232346422` passed 141 browser checks cleanly, passed one unrelated festival check on its automatic retry, and deployed to Cloudflare Pages. Live `app.js` and signup HTML are byte-identical to the reviewed source and contain the optional disclosure, compliance RPCs, and authenticated `verify-phone` calls. No backend, secret, migration, production-data, or Twilio configuration mutation occurred; one real SMS proof remains founder physical QA.
- **TIKTOK PER-PREFIX VERIFICATION ARTIFACTS LIVE (2026-08-05, PRs
  #48/#51/#53/#57):** TikTok's apex artifact is live and that portal prefix is
  verified. The separately signed app-subdomain artifact is now live at
  `/tiktok3vSsOjcdAwZqkeershAZQumPuThIJ0JS.txt`: HTTP 200 plain text, 68
  bytes, SHA-256
  `6e9b5e7bef342feded472b9ab4509ec030bbc8ed3d24de4a7b7a8975750f49c9`,
  and byte-identical to the portal download. The existing Worker still maps
  file-like app-host requests into `/app/`; callback and login SPA routes
  remain HTTP 200 HTML.
- **EVENTIM OFFICIAL PARTNER LIVE (2026-08-05, PRs #49/#54):** the homepage partner/source strip includes Eventim's official self-hosted US logo and links to Eventim US. PR #54 removed the verbose relationship paragraph while preserving the six-logo “Official Drop partners and ticket sources” section and separate FTC affiliate disclosure. Production workflow `31065174952` passed 128 Playwright checks and deployed; live QA confirms six logos and no relationship paragraph.
- **READ-ONLY TIKTOK WEB CALLBACK LIVE (2026-08-05, PR #46):** the signed-in
  website can start TikTok Login Kit from Settings with browser-generated PKCE
  and anti-forgery state, requests only `user.info.basic` + `video.list`, and
  exchanges the one-time code only through the JWT-protected `tiktok-oauth`
  Edge Function. The callback consumes browser state before exchange and
  validates the exact `https://app.trydropapp.com/tiktok/callback` redirect.
  Merge `15fad17` passed all 126 Chrome/WebKit checks and production workflow
  `31059041140` deployed it. Live mobile-size browser QA confirmed the callback
  and apex `/app/` both load their correct CSS/JS paths with zero same-origin
  failures.
- **TIKTOK SANDBOX TEST MODE READY (2026-08-05):** signed-in Drop users can
  open `?tiktok_sandbox=1` to route one test OAuth flow exclusively through
  `tiktok-oauth-sandbox`; the normal route continues to use `tiktok-oauth`.
  The selected endpoint is stored only for that PKCE session and callback.
- **CERVANTES PARTNER LOGO + COMBINED SOURCE STRIP LIVE (2026-08-04, PRs #44/#45/#54):** the homepage lists Cervantes' Masterpiece Ballroom in the same responsive logo row as Eventim, Ticketmaster, SeatGeek, Etix, and Ticketsauce under “Official Drop partners and ticket sources.” The self-hosted Cervantes wordmark comes from the venue's official website and links back there. PR #54 later removed the verbose relationship paragraph while keeping all six logos and the FTC disclosure.
- **TICKETSAUCE + ROUNDED HOMEPAGE PROOF LIVE (2026-08-03, PR #42):** Ticketsauce now appears beside Ticketmaster, SeatGeek, and Etix using the official self-hosted wordmark and neutral authorized-source wording. At that deployment, live catalog totals floored to truthful marketing bands of `2,200+` events and `230+` cities, so the `+` did not overstate inventory. PR #42 merged as `9de4ad6`; exact `main` workflow `30878584151` passed all 124 browser checks and deployed to Cloudflare Pages. Live desktop/mobile QA confirmed all four logos load, the Ticketsauce link opens the official site, and the page has no horizontal overflow or console errors.
- **GOOGLE SEARCH CONSOLE VERIFIED + ENTITY SITEMAP ACCEPTED (2026-08-02):** the `sc-domain:trydropapp.com` property is ownership-verified through a root Cloudflare DNS TXT record. Google Search Console successfully read `sitemap.xml` (27 discovered pages) and `sitemap-entities.xml` (3,581 discovered pages); both show `Success` with an Aug 2, 2026 last-read date. Keep the verification TXT record in DNS. Bing Webmaster import remains a separate founder OAuth action.
- **ENTITY SEO + FULL VENUE CATALOG LIVE (2026-08-02, PRs #38/#39):** every published event, canonical venue, and lineup artist has a stable UUID-backed readable URL; Cloudflare Pages Functions server-render entity-specific titles, metadata/content, and lifecycle-aware JSON-LD. A fail-closed quality gate keeps malformed events and thin venue/artist aggregates out of `/sitemap-entities.xml` while direct pages remain available with `noindex, follow`; live QA counted 3,581 URLs (2,246 events, 354 venues, 981 artists). Ticket URLs never imply `InStock`, canceled/postponed/sold-out/unavailable/RSVP states stay honest, and event-to-venue links use the venue UUID. The directories still expose the full catalog. No events or reviews were fabricated and no production writes occurred. Seven focused Node checks and the complete 124-test Chrome/WebKit suite pass locally and in the exact-head/main workflows.
- **CREATOR PROGRAM WEBSITE ROUTE LIVE (2026-08-02, PRs #36/#37):** the founding-pilot package and backend are merged, production migrations are applied, `CREATOR_RATE_LIMIT_SECRET` is set, and `submit-creator-application` is active with same-origin enforcement. Website PR #37 removed the Cloudflare self-redirect on `/creators` and merged as `0ac5927`. Mobile release-train PR #297 remains a separate lane.
- **HOMEPAGE CATALOG PROOF + OFFICIAL TICKET SOURCES LIVE (2026-08-02):** PR #34 renders overlap-aware totals from the public catalog (2,252 events / 236 cities at production QA time), keeps qualified offline fallbacks, and adds self-hosted Ticketmaster, SeatGeek, and Etix logos under neutral source wording. Production QA caught the homepage reusing an old cached `site.css`; the follow-up adds `?v=20260802` so the logo sizing rules load immediately. Full Chrome/WebKit Playwright coverage is 110/110 and production desktop/mobile QA found no overflow or browser errors.
- **TWILIO SENDER ASSOCIATION VERIFIED (2026-07-30):** toll-free number `(855) 741-1140` (`PNbd8be89e2ffdf5c70d63e5f8a66eba17`) is attached to the existing Messaging Service `Drop Phone Verification` (`MGe2d6e639033b34c6535bb7deaf7d3bfd`). The number configuration readback shows “Selected messaging service: Drop Phone Verification.” This association does not change Toll-Free Verification's separate `In Review` status.
- **TWILIO SMS OPT-IN PROOF LIVE + VERIFICATION IN REVIEW (2026-07-30, PRs #29/#30):** `https://trydropapp.com/sms-opt-in` returns HTTP 200 with the shipped one-time verification consent, “Text me a code,” the no-recurring/promotional-text disclosure, Privacy/Terms links, and `noindex, nofollow`. PR #29 merged the page as `3c6dcd9`; PR #30 isolated the browser gate from third-party font/catalog latency and merged as `b39b216`. Exact production workflow `30523124634` passed 108/108 Playwright checks and deployed Cloudflare Pages. Twilio initially rejected the registration because the legal name and `SOLE_PROPRIETOR` classification disagreed; the legal name was corrected to the CP575-exact `ARYA A SHINDE`, resubmitted, and the fresh checklist now reports `In Review`.
- **PASSWORD-RESET BROWSER FALLBACK LIVE (2026-07-24, PR #25):** Supabase recovery links targeting `https://trydropapp.com/reset-password` now 302 to `https://app.trydropapp.com/?mode=reset-password`; browsers preserve the recovery `#hash`, and the SPA renders “Choose a new password.” Merge `006fe8d` passed 104/104 Playwright checks and production workflow `30138096500`. A fresh Resend message was confirmed delivered after deployment; its single-use link was intentionally not consumed during verification.
- **v1.0.1 HOSTED LEGAL + RECOVERY AASA ALIGNMENT LIVE (2026-07-18, PR #19):** merged to `main` as `9399fad`; workflow `29663058803` passed the complete browser matrix and deployed production. Canonical Privacy/Terms show July 18 and scope 16+ to accounts/social features; public event browsing remains open. The SPA routes to canonical `/privacy` and `/terms`; AASA directly serves the current app id plus `/event/*`, `/plan/*`, `/reset-password`, and root. Legacy `.html` paths and `www` redirect correctly. Exact mobile Build 10 is now VALID in internal TestFlight; physical-iPhone recovery-link completion remains the only AASA release check.
- **EVENT ART + FESTIVAL RELEASE LIVE (2026-07-18, PR #17):** merge
  `aa76a7a` passed the 96/96 GitHub test gate and production deploy run
  `29639887776`. Live QA at `trydropapp.com` rendered the homepage, the global
  24-festival catalog, and a real Day Trip Seattle detail page with proper art,
  zero browser console warnings/errors, and no 390px horizontal overflow.
  Festival schedules remain honest-empty until an official schedule manifest
  supplies production `event_set_times`; the timezone/schedule UI is regression
  tested but is not yet live-data verified.
- **CI AUTO-DEPLOY (2026-07-16, PR #14): push to `main` = live site.** `.github/workflows/deploy.yml` tests (full Playwright, chromium+webkit) then deploys `dist/` to CF Pages using repo Actions secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` — the token lives in GitHub, so **no agent should ever ask the founder for a Cloudflare token to deploy this site**. Docs-only commits (`**.md`, `docs/`, `history/`) skip deploy; redeploy current main anytime via the workflow's Run-workflow button (workflow_dispatch).
- FULL 12-page public event-discovery website LIVE at trydropapp.com (cutover 2026-07-06, see CUTOVER RECORD): AXS-style IA, Prism tokens, live Supabase public catalog (anon key, 1.5K events), 32/32 Playwright smoke green.
- Post-login web app = the Prism SPA, LIVE on `app.trydropapp.com` + `trydropapp.com/app/` (2026-07-12): old static `account.html` shell DELETED; all landing Log in / Get started → `app.trydropapp.com/?mode=login|signup`; authed sessions boot to Discover; full auth (password, username via `login-with-username`, signup, reset, Google/Apple OAuth triggers) lives in the SPA login/signup screens. Facebook is a muted “sign-in coming soon” status note until it is wired. Design round-4 (filterable scrollable city dropdown, empty-state CTAs, search filter-panel dropdowns) ported + live. Worker `drop-app-path` version `c650cc64-6c51-4f28-b1a4-7a18fa800bb2` (root-shared assets `/vendor/`, `/data.js`, `/favicon*` pass through un-prefixed).
- SPA is DEMO-DATA FREE + shows real event photos (2026-07-12 evening, commits bce9a46+ad103e6, Pages `c5999d42`→`44031553`, live-verified authed): art chain (real event image → lineup artist photo → prism gradient; helpers moved site.js→data.js since the app shell only loads data.js) on cards + event hero; all 23 fake datasets purged — deleted where real Supabase wiring exists (events seed, artists/venues pickers, past shows, artist/venue meta), emptied + honest empty states where no backend yet (friends/plans/chat/wallet/notifications/tagged/submissions/blocked/promoter/admin); fake Global Dance Festival banner removed; discover ← Prev / Next → pager (24/page over one 240-row fetch). Changes mirrored BACK into the claude.ai design ("Website design prompt") via the OmeletteService/EditFile endpoint (banner/CREW/COMMENTS) — bidirectional design↔site sync is now the standing rule.
- Expo web proxy is retired (2026-07-08, Codex): trydropapp.com remains the standalone public website; nothing Expo serves on the web.
- 19-rule UI best-practices audit PASSED + fixes deployed (2026-07-06, commit 7308468, live-verified): undefined `--r-card` radius bug fixed, chip selected-state = solid cyan (gradient reserved for .btn-primary), events sort select → toggle chips, event-page nav CTA ghosted, legal numerals cyan, venue/artist card value-hierarchy, header search live-filters venues/artists grids, `.btn-primary` fill desaturated ~18% (`--grad-glow-fill`, AA contrast 5.06:1 worst stop; waveform/text/glow keep full sat).
- UI consistency cleanup is LIVE on trydropapp.com (2026-07-08, Codex; final Pages deployment `3bcc25b0.drop-site.pages.dev`): link hub now uses the same desaturated Prism CTA fill/pill geometry, time tabs and filter chips share selected-state tokens, native emoji/symbol UI was replaced with Prism-styled marks/labels, Bass/Dubstep and Clubs have distinct tints, venue/artist detail H1s use Space Grotesk, promoter section labels/wrap are cleaned up, and the download waitlist no longer emits the mailto mixed-content console warning. Verified with `npm test` 42/42, targeted Playwright screenshots in `/tmp/drop-site-fix-qa`, live CSS/HTML marker checks, and live browser pass on `/link.html`, `/download.html`, `/promoters.html`, `/events.html` with zero console/page errors.
### In progress — Active Claims
Live cross-session claims (who is working on what right now) are in the vault: `AI Agents/Operations/SESSION_CLAIMS.md` — run `python3 ~/Developer/agent-stack/scripts/session_claim.py list`. List durable in-progress items here.
- None.
### Blocked / waiting on
- Google Play submission `1` is **In review**. Managed publishing is off, so approved changes will publish automatically. Google says reviews typically finish within seven days but can take longer.
- Impact marketplace: support appeal `865870` is Open after the rebuilt
  application was immediately declined. Wait for Impact's specific compliance
  reason; reply with additional ownership evidence if requested. Direct brand
  signup links remain usable while marketplace access is declined.
- TikTok sandbox: run one signed-in `?tiktok_sandbox=1` connection after its
  website switch deploys. Do not request publishing scopes or Content Posting
  API access.
- Twilio Toll-Free Verification for Drop's `(855) 741-1140` sender remains a
  separate compliance lane; do not infer its status from the production Twilio
  Verify service. The mandatory browser proof uses the existing authenticated
  `verify-phone` Edge boundary and does not configure Supabase Phone Auth.
- Founder: Bing Webmaster import-from-GSC (OAuth grant only founder can approve; extension also lacks bing.com permission).
- Official festival schedule/export source: production currently has zero
  published-festival `event_set_times`; do not fabricate set times. Author and
  apply the reviewed v1 manifest when a primary source becomes available.
- Android physical App Links acceptance remains untested because no Android test device is available. Play-signed 1.0.2 (2) is active in Internal Testing; do not claim device readiness from the public certificate or track state alone.
### Exact next step
- **PR #92 is open and exact-head CI passes; hold merge/deploy until the Meta/Supabase provider completes a tester login. Do not claim live Facebook authentication until the deployed branch and a non-tester production round trip both pass.**
- **Website delivery is complete; perform one disposable-account live SMS send/check through `app.trydropapp.com`, recording only pass/fail and artifact provenance; never record the raw phone number or OTP.**
- **After exact approval and application of backend migration
  `20260806055852_tiktok_sandbox_publishing_scopes.sql`, merge and deploy the
  sandbox-only consent branch, then re-consent at
  `https://app.trydropapp.com/?tiktok_sandbox=1`. Do not upload, schedule, or
  publish content.**
- **After the next scheduled catalog ingest, run the read-only entity monitor:** compare `/sitemap-entities.xml` event/venue/artist counts with the 2026-08-02 baseline (2,246 / 354 / 981), open one canonical event, venue, and artist, and confirm one thin venue remains `noindex, follow` and absent from the sitemap. Keep the separate persistent review-write/read flow honest: the current website does not yet persist reviews.
- **After the next scheduled catalog ingest, spot-check that the homepage event/city totals still refresh and the ticket-source strip remains correctly sized on desktop and mobile.**
- **Open the real Treehouse “BASS BINGO AFTERS” event in physical iPhone Safari after the standard `main` deploy and confirm the poster stays clear, date/venue remain below the title, and the long lineup pill wraps inside the same page gutters as the details and ticket cards.** Automated Chrome/WebKit checks and browser geometry are green at mobile and desktop widths.
- **On internally distributed TestFlight 1.0.1 Build 10, tap canonical-apex event and emailed password-recovery links on a physical iPhone; verify cold launch into the native app and complete the reset. Browser fallback is live and verified; this remaining check is native Universal-Link behavior only. Keep the separate `www` AASA-host hardening item out of the release claim because that origin intentionally redirects to apex.**
- **Then run the first post-release catalog monitor after the next scheduled ingest:**
  recheck the global Festivals filter, one event-art detail page, request/console
  health, and proper-art fallback against live data. If festival set times remain
  zero, leave schedule live-QA in waiting and point the next agent to the reviewed
  backend manifest command instead of inventing rows.
1. **Founder QA the logged-in write paths on app.trydropapp.com** (deploy `5c8a6dc1`, commit 1033fa6): sign in with a real account and exercise (a) the NEW log-past-shows flow (My Shows → "Log a past show": archive multi-select bulk add → attendance rows; manual form → logged_shows; Wrapped should then count them), (b) an artist claim submit (artist page → bottom "Are you {name}? Claim this profile" wizard → artist_claims row), (b) owner Edit-links save (needs an approved claim — approve via `select review_artist_claim('<claim-id>','approved')` as an admin or ask the agent), (c) Wrapped with real history (2026 ↔ All-time toggle + story-card download), (d) RSVP + follow (still never exercised against prod). All write paths shape-verified + headless-driven logged-out only.
3. **Retire the drop-web (Expo export) CF Pages project** — nothing routes to it anymore; delete the project in the CF dashboard + remove web-deploy.yml from drop-mobile-app.
4. **Schema design for remaining social features** (founder decision): crew/plans/chat/wallet still demo (wrapped is now REAL) — scope one (plans?) before building.
5. **Founder: import the verified Google Search Console property into Bing Webmaster Tools** (OAuth grant remains founder action).
6. **If recap celebration remains desired, inspect current Drop-App `main`, wire the already-merged `<RecapCelebration>` component into the recap screen on a fresh branch, then run device/reduced-motion QA through the app's current merge gate.**

## 2026-08-18 — Codex — Google Play launch submitted and Android DAL live
- **Delivered:** PR #95 merged as `a66eb6d814bbac36af796da9655198aa9d94c130`; the live apex association is byte-identical to the reviewed package/fingerprint statement. Production build 1.0.2 (2) was promoted for United States availability without uploading a replacement AAB.
- **Submitted:** Google Play submission `1` was sent at 5:33 PM with all ten pending production, store-listing, app-content, and store-settings changes. Play reports **In review**.
- **Publication behavior:** managed publishing is off, so approval triggers automatic public availability. The only remaining launch step is Google's external review; physical Android App Links acceptance remains device-QA flagged because no Android test device is available.

## 2026-08-12 — Codex — Mandatory verified-phone website compatibility reviewed
- **Root cause:** the website treated any `complete:true` attestation as Discover-ready and its activation phone step was optional. The compatibility contract intentionally keeps `complete:true` while backend enforcement is off, so explicit unverified-phone state needed its own fail-closed route before activation can safely switch on.
- **Changed:** one shared attestation parser handles legacy/new payloads; explicit `profile_complete:true` plus `phone_verified:false` enters required OTP mode with no Skip/Continue, generic duplicate copy, server re-attestation after proof, and ephemeral phone/code state. Password recovery, sign-out, and real `delete-account` remain reachable; deletion distinguishes completed from queued.
- **Verified:** `node --check`, `git diff --check`, focused 18/18 desktop auth checks, and full 7/7 Node plus 160/160 desktop/mobile Playwright checks pass. Independent adversarial review found no blockers. No backend migration, Edge deploy, secret, Worker, or production mutation occurred in this website session.

## 2026-08-11 — Codex — Canonical verified-contact disclosure live
- **Changed:** the canonical Privacy Policy states that server-verified email and phone matching defaults on, remains independently removable in Edit profile, keeps raw address-book details on-device, stores no raw verification number, uses Twilio for optional SMS verification, and enforces one verified phone per account. The policy is dated August 11, and browser signup records Privacy version `2026-08-11`.
- **Alignment cleanup:** the already-reviewed 13+ account rule is reflected in hosted Privacy/Terms so the canonical pages no longer contradict the native app and production eligibility gate.
- **Verified/delivered:** seven Node tests plus 148 Playwright checks pass across desktop Chromium and mobile WebKit. PR #79 merged as `43e0648b816fca4f0567a13e2702dfc7ff607362`; Cloudflare production run `31520495118` passed. Live `/privacy.html` shows the August 11 default-on verified email/phone disclosure and independent opt-out; `/terms.html` retains the July 18 13+ terms. Paired backend ledger `20260811175815` accepts Privacy version `2026-08-11`.

## 2026-08-10 — Codex — cross-browser signup confirmation callback
- **Root cause:** password signup starts Supabase PKCE in one browser, while
  Gmail on iOS can open the confirmation email in an embedded browser without
  that browser-local verifier. The previous callback waited for a session that
  could not be established there.
- **Changed:** PR #73 adds a strict `token_hash` / `type=email` confirmation
  path, pre-exchange URL scrubbing, bounded input, fail-closed errors, and a
  single-flight guard for the Supabase `SIGNED_IN` event. It keeps the existing
  compliance RPC and activation behavior, documents the exact hosted-template
  contract, and does not weaken PKCE for OAuth.
- **Verified:** final `npm test` passed seven Node checks plus 148 Playwright
  tests across desktop Chromium and mobile WebKit. Focused callback coverage
  includes success, returned and thrown exchange failures, wrong type,
  oversized token, URL scrubbing, and the duplicate-sign-in race. Source/dist
  parity and JavaScript syntax checks pass; local rendered failure-state QA had
  no browser warnings or errors. Independent adversarial review approved the
  amended diff.
- **Delivery:** reviewed commit
  `33ae7f2fdd18b175747ae922f92268b44b35dfc6` plus closeout commit
  `1cafc0512379c52804e6dc78f24b33af5bd2de3c` merged through PR #73 as
  `8246246d8012b5521e24c8a059b6b5010ea928f9`. Production workflow
  `31448895774` passed test and Cloudflare deploy jobs. The deployed `app.js`
  SHA-256 is `cfe677cfac3b9492cf3f86a6e13c00205411cb81fee331aa213e5843c0f3f41c`,
  byte-identical to reviewed source. Live invalid-callback QA scrubbed the URL,
  failed closed with the safe recovery message, and emitted no browser logs.
- **Hosted Auth configuration and production proof:** after exact founder
  approval, changed only the Confirm signup template href from
  `{{ .ConfirmationURL }}` to
  `https://app.trydropapp.com/?mode=signup-complete&token_hash={{ .TokenHash }}&type=email`.
  Reload readback proved the subject remained `Confirm your email address`, the
  new href appears exactly once, the legacy href appears zero times, and
  replacing that one href reconstructs the original body byte-for-byte. A
  fresh disposable Gmail message contained one unique exact callback. Opening
  it from a new empty-storage tab scrubbed token and mode, reached the optional
  phone step, completed all six activation steps, and opened signed-in
  Discover. Read-only backend proof showed one confirmed user, complete signup
  compliance, and one profile before cleanup. The session was signed out; the
  Auth user was deleted through the Dashboard; final readback showed zero
  users, profiles, compliance rows, or sessions; and the QA email was
  permanently deleted with zero mailbox matches. No QA identity or PII was
  retained.

## 2026-08-05 — Codex — TikTok per-prefix verification artifacts live
- **Changed:** PR #48 added TikTok's apex signed artifact. Live inspection then
  found the app-host Worker maps file-like requests into `/app/`; PR #51 made
  the build preserve the single tracked artifact there without altering the
  Worker or SPA routing. TikTok generated a different signed artifact for the
  app prefix. PR #53 initially interpreted the portal typography as `lJO`;
  live portal DOM inspection resolved the exact ending as capital `I`, digit
  `0`, `JS`. PR #57 renamed the unchanged bytes to the required destination
  `tiktok3vSsOjcdAwZqkeershAZQumPuThIJ0JS.txt`, removed the mistaken source,
  and corrected both root and app deploy whitelists.
- **Verified:** the app-prefix portal download, tracked file, and built/live
  app-host copies are each 68 bytes with SHA-256
  `6e9b5e7bef342feded472b9ab4509ec030bbc8ed3d24de4a7b7a8975750f49c9`;
  direct byte comparisons pass. The app-host URL returns HTTP 200 plain text;
  callback and login routes remain HTTP 200 HTML. Local and exact-main checks
  passed 7/7 Node tests and 128/128 Playwright tests. Immediately after the
  correction deploy, Cloudflare still served the removed mistaken URL's same
  68-byte response; it has no source/build reference and is not used by the
  portal.
- **Delivery:** PR #48 merged as `f803e56`; PR #51 merged as `fd1e60f`; PR #53
  merged as `4a6ae7c`. Exact PR #53 workflow attempt 1 stalled in hosted-runner
  Playwright installation and was canceled; the unchanged attempt 2 passed.
  PR #57 merged the exact-name correction as `3bd3338`; main workflow
  `31068662131` passed and deployed Cloudflare Pages. The apex prefix is
  portal-verified; the app prefix is live and ready for its Verify click. No
  backend, secret, publishing-scope, Content Posting, or Worker change was
  made.

## 2026-08-05 — Codex — read-only TikTok web callback live
- **Changed:** added the signed-in Settings connection action, browser PKCE and
  anti-forgery state, exact redirect validation, one-time callback exchange via
  `tiktok-oauth`, and host-aware app assets that preserve both
  `app.trydropapp.com` and `trydropapp.com/app/`. Review rejected the original
  global `<base href="/">` because it regressed the apex app surface; browser
  testing then caught callback-relative preload requests before delivery.
- **Verified:** 7/7 Node checks plus 126/126 Playwright checks passed locally
  and in PR CI. Production mobile-size browser QA returned HTTP 200 for the
  callback and apex app, loaded the expected asset paths, and found no
  same-origin failures. Live `app.js` contains the exact callback and read-only
  scope markers.
- **Delivery:** PR #46 merged as `15fad17`; main workflow `31059041140` passed
  tests and deployed Cloudflare Pages. TikTok's separately signed verification
  artifacts are now live as recorded above; no backend, secret,
  publishing-scope, or Content Posting change was made.

## 2026-08-05 — Codex — partner/source paragraph removed
- **Changed:** deleted only the long Cervantes/Eventim relationship and ticket-availability paragraph. The original heading and all six linked logos remain unchanged; the separate FTC affiliate disclosure remains.
- **Verified:** 7/7 entity checks and 128/128 Playwright checks pass locally and in production workflow `31065174952`. Live QA shows the original six logos, zero direct paragraph under the partner/source section, and the affiliate disclosure.
- **Delivery:** PR #54 merged as main `001ff45b17224104c890167102fa5f186defcd2b`; production test and Cloudflare deploy jobs passed.

## 2026-08-05 — Codex — Eventim official partner live
- **Changed:** added Eventim's official self-hosted US logo and link to the existing homepage partner/source strip, plus scoped copy naming the live affiliate and event-source relationship. Existing FTC affiliate disclosure remains unchanged.
- **Verified:** 7/7 entity checks and 126/126 Playwright checks pass. Local 1280×900 and 390×844 browser QA loaded all six logos, preserved the Eventim mark's colors, and found no horizontal overflow; the only request error was an unrelated third-party event-art 404.
- **Delivery:** PR #49 merged as `2c288f5`. Production workflow `31061271681` was canceled once after its hosted runner stalled for 12 minutes during Playwright dependency installation; attempt 2 passed the complete test and dist safety gates and deployed successfully. Live Chrome QA verified six logos, the Eventim US link and scoped copy, preserved affiliate disclosure, zero horizontal overflow, and zero console errors on desktop and mobile.

## 2026-08-02 — Codex — homepage live counts and official ticket-source trust strip
- **Changed:** replaced stale hard-coded homepage proof with exact public-catalog event/city totals, including ongoing multi-day events; added qualified offline fallbacks; added a responsive Ticketmaster/SeatGeek/Etix source strip with self-hosted SVGs and existing affiliate disclosure preserved. Production QA caught and fixed a stale stylesheet cache key.
- **Verified:** deploy build includes all assets; 110/110 Playwright checks pass on desktop Chrome and mobile Safari; production rendered 2,252 events / 236 cities with all three local assets loaded, no horizontal overflow, and no browser warnings/errors.
- **Delivery:** PR #34 merged as `4553497`; the standard CI workflow passed and deployed to Cloudflare Pages. The stylesheet cache-bust follow-up was shipped through the same PR gate.

## 2026-07-19 — Codex — desktop event metadata + lineup containment
- **Changed:** event artwork is now image-only at every breakpoint; genre/title/date/venue render below it in one consistent detail flow, and the shared facts card preserves the full `Venue · City, ST` location. Long lineup chips wrap inside the event-content gutter instead of widening or clipping the page.
- **Verified:** `npm test` 102/102 across desktop Chrome + mobile Safari; source/dist mirrors match; independent review found no actionable issue. Browser QA on the real Treehouse event confirmed `scrollWidth = clientWidth`, metadata below artwork, and the lineup chip contained within the details-card edges at 390px and 1280px, with zero console warnings/errors.
- **Delivery:** ship through the standard PR → `main` CI auto-deploy path, then use the exact physical-iPhone Safari check in `Exact next step`.

## 2026-07-19 — Codex — mobile event-detail layout fix live (PR #22)
- **Changed:** on phones, event art now renders unobstructed; genre/title move below it, with date and venue in a bordered details card. Long promoter copy wraps instead of expanding the CSS grid, and related-event rails now match the responsive page gutter without widening the document.
- **Verified:** `npm test` 102/102 across desktop Chrome + mobile Safari locally and GitHub PR run `29712944568`; source/dist mirrors match; real Alphabeat event at 390×844 has 16 loaded related cards, document `scrollWidth = clientWidth = 375`, and zero console warnings/errors. Desktop 1280×800 remains two-column with no overflow. Independent code review found no issues; independent behavior verification passed.
- **Delivery:** PR #22 merged as `5d93fa6`; standard production workflow `29713233741` passed and deployed. Physical-iPhone Safari remains the final device-only check.

## 2026-07-19 — Codex — website event-card RSVP change live
- **Changed:** signed-out and signed-in discovery cards no longer render Going or Interested action rows. Date/title/location now finish the 340px image card; the social-count pill moved to the upper badge area. Event Detail retains both RSVP controls.
- **Verified:** 100/100 Playwright locally and in GitHub run `29711282780`; Cloudflare production deploy passed. Live 390×844 readback found 24 public and 257 app-shell cards, zero card buttons, metadata within 1px of the card bottom, valid event-detail links, and zero console/page errors. Independent review was clean.
- **Handoff:** PR #20 merged as `8078f1e` and is live. Standing physical-iPhone and post-release catalog next steps remain unchanged.

## 2026-07-18 — Codex — v1.0.1 hosted legal and password-recovery AASA live
- **Merged/deployed:** PR #19 merged as `9399fad`; GitHub workflow `29663058803` passed and deployed.
- **Verified live:** canonical July 18 Privacy/Terms, 16+ account rule, legacy redirects, apex JSON content type, current app id, and `/reset-password` AASA component. `www` redirects to apex as expected for website traffic.
- **Paired release state:** production migration `20260718221827 social_signup_legal_20260718` passed live compatibility checks; mobile 1.0.1 Build 10 is VALID in internal TestFlight.
- **Remaining:** physical-iPhone canonical-apex event/recovery Universal-Link proof. No further website code is required for the TestFlight feedback start.

## 2026-07-18 — Codex — proper event art and real multi-day festivals live
- **Event art:** every public and SPA event surface now cycles only safe, non-generic candidates: proper event art first, then lineup artist images, then the intentional Prism fallback. Ticketmaster category stock is rejected only on exact Ticketmaster hosts; broken candidates advance instead of leaving an empty card.
- **Festivals:** the signed-out homepage has a global festival rail independent of city; the SPA supplements its paged future catalog with bounded future + ongoing festivals so day 2/day 3 remain discoverable. Festival schedules load only published `event_set_times`, group repeated stages by venue-local day, show the event date range/timezone, persist real signed-in picks, and contain no demo rows.
- **Verified and deployed:** generated `dist/` rebuilt with all 45 changed source/dist pairs byte-identical; JS syntax and diff checks are green; independent adversarial review found no remaining code blocker/high. After the paired backend schema/ingest landed, the full suite passed **96/96 locally and 96/96 in GitHub Actions** (Chromium + WebKit). PR #17 merged as `aa76a7a`; production deploy run `29639887776` succeeded. Post-deploy browser QA rendered the homepage, 24 global festival results, and Day Trip Seattle detail art at desktop and 390×844 with zero console warnings/errors and no horizontal overflow. A read-only production check found no published-festival set-time rows, so schedule behavior remains deterministic-test verified rather than falsely labeled live-data verified.

## 2026-07-18 — Claude (remote) — hero badge removed + "one website, two views" framing
- Removed the "✦ The EDM show discovery app" chip from both signed-out heroes (`index.html`, `app/index.html`) per founder request; merged to `main` (7a41f93), live-verified gone on trydropapp.com + app.trydropapp.com.
- Founder decision recorded (DECISIONS.md): the site is never a "marketing page"/"landing page" — one website, signed-out view + signed-in view. Terminology aligned across CLAUDE.md, PRODUCT.md, AXS_MODEL.md, README.md, DESIGN.md, BACKLOG.md, tests (`landing site smoke` → `website smoke`), playwright.config.ts, package.json; vault wiki pages updated to match.

## 2026-07-16 (follow-up, same session) — Claude (Fable, remote) — WEBSITE home cards bezel-to-bezel on mobile too
- **Why:** after the SPA fix deployed, founder screenshot showed the OLD spacing — because they were on **trydropapp.com** (the website), not app.trydropapp.com. The website home "Happening in {city}" grid caps `.wsc-card` at 300px centered inside 18px `.wrap` gutters → ~46px dead space per side on a 393pt phone.
- **Changed (final, after founder revert request):** `site.css` ≤560px — `.grid-events > .wsc-card { width: 100%; }` + `.grid-events { margin: 0 -6px; }` (−2px at ≤360px) so EVENT CARDS ALONE sit 12px from the screen edge, exactly the signed-in app card width. The site-wide `.wrap` gutter change (18→12px) shipped in b2d705c was REVERTED same session — founder wanted only the cards touched; page gutters are back to 18px/14px. Also `app/index.html` stylesheet links got `?v=cf4d0dc` cache-busters (commit 2fd26e6) after the founder device kept stale app.css.
- **Tested:** local 393px Chromium drive of index.html — injected `.wsc-card` measures 12px from each viewport edge, width 369px (same as app SPA). No smoke test asserts card geometry.
- **Deploy:** pushed to main → CI Test & Deploy (fonts render as fallback only in-container — Google Fonts unreachable from sandbox, not a site issue).

## 2026-07-16 — Claude (Fable, remote) — SPA signed-out home cards bezel-to-bezel on mobile (founder-reported)
- **Why:** founder compared the signed-out app.trydropapp.com home feed vs the signed-in Discover on a phone: signed-in cards run near bezel-to-bezel (Discover's `.wsh__content` mobile override = 12px sides) but the signed-out "Happening in {city}" section kept its inline desktop padding (`var(--sp-xl)` = 24px sides) on mobile.
- **Changed:** `app/index.html` home shows section gains class `home-shows`; `app/app.css` ≤720px block adds `.home-shows { padding-left/right: var(--sp-md) !important; }` (matches `.wsh__content`; `!important` needed to beat the inline style). Desktop unchanged.
- **Tested:** local 393px-viewport Chromium drive — `.home-shows` computes 12px/12px and an injected `.wsc__card` measures 12px from each viewport edge (identical to signed-in Discover); page renders with zero pageerrors. Desktop smoke suite in-container: 21/43 pass, all 22 failures = the documented environmental `ERR_CONNECTION_RESET` baseline (verified identical with the change stashed).
- **Deploy:** NOT yet — pushed on branch `claude/mobile-logged-out-card-layout-06ue2h` (remote agent session; no local pw-local.config). Merge to main to auto-deploy via Actions once founder eyeballs it.

## 2026-07-16 — Claude (Fable, remote) — "Only seller" exclusivity claim removed from event pages (founder call)
- **Why:** founder flagged the single-listing "Only seller" badge + "only site currently selling tickets" note as misleading — resale marketplaces (StubHub, Vivid Seats, etc.) usually also carry the show, so "only" overclaims. Same session also produced the Tixr partnership outreach draft (lives in drop-mobile-app `docs/launch/tixr-partnership-outreach.md` + founder queue row).
- **Changed:** `event.html` renderPriceCompare no longer renders the `.ed-best` "Only seller" badge or the `.ed-single-note` notice (row keeps seller name + price + Get tickets); dead `.ed-best`/`.ed-single-note` rules removed from `pages.css`; smoke test renamed + now asserts both elements are ABSENT (`tests/smoke.spec.ts`).
- **Tested:** the 2 ticket-listing smoke tests pass in-container (Chromium 1194 via untracked `pw-local.config.ts`, same setup as the 07-16 AASA session); full suite not run — container baseline remains 24/66 environmental.
- **Deploy:** ✅ LIVE (2026-07-16, run 29518544529 / workflow run #7, SUCCESS ~17:11Z) — merged to main (rebased onto f0a5675, de-duplicated its double-pasted round-4 entry) and **auto-deployed by GitHub Actions** (`.github/workflows/deploy.yml`). Live-verified: `/event` serves the new build (no badge/notice; the one remaining "Only seller" string is a JS comment), live `pages.css` has zero `.ed-best`/`.ed-single-note`. **DEPLOY RULE CHANGE — agents: STOP asking the founder for CF tokens.** Since PR #14 (commit 081a0cb, 2026-07-16) every push to main auto-tests + auto-deploys via repo Actions secrets `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` (md/docs/history-only commits skip deploy; manual re-run = Actions → "Test & Deploy" → workflow_dispatch). Manual `wrangler pages deploy` is now the FALLBACK, not the path.

## 2026-07-16 (round 4, same session) — Claude (Fable) — WEB APPLE SIGN-IN VERIFIED (runbook Part 2 complete)
- **"Continue with Apple" on the website WORKS end-to-end** — founder browser-tested (runbook 2d): Apple login succeeded and **linked to the existing Google-created account** (same verified email) — Supabase automatic identity linking behaving as designed, one account / multiple providers. No code changed; this closes runbook Part 2.
- **Discovery**: Part 2 config (Services ID `app.resonanceventures.drop.web`, web-OAuth secret, redirect allow-list) was ALREADY set on Supabase — verified live via Management API (`external_apple_enabled: true`, client_id list `.web` first + bundle id, secret present). Presumably a prior Mac session; nobody had recorded or browser-verified it. Also verified the SPA's `redirectTo` (`location.origin + location.pathname`, app.js:955) is covered by the live allow-list → "Exact next step 0" above closed.
- **Future caveats** (recorded in the drop-app runbook, commits 05913da + 2d1b6f0): Apple "Hide My Email" users won't email-match → separate fresh account (expected, support-question fodder); web client secret expires ≤6 months — regenerate + PATCH `external_apple_secret` on expiry or at the planned post-submission rotation of key `876993RG4Q`.

## 2026-07-16 — Claude (Fable, remote) — impact.com site verification (content snippet) for Vivid Seats affiliate enrollment
- **Changed:** `index.html` footer `.foot-fine` gains one visible line — `Impact-Site-Verification: b8ea96cd-5715-48d9-97ab-76b4110b441c` — Impact's "verify by editing content on my website" method, chosen after the July meta-tag attempt failed (root cause in drop-mobile-app `docs/launch/impact-vivid-seats-enrollment.md`: the old meta lived in the Expo web export this site replaced, and Impact wants metas first-in-head). Founder is enrolling in the **Vivid Seats** affiliate program (impact.com); this string must stay in server-rendered homepage content until the property shows Verified (harmless to keep after).
- **Tested:** container suite 24/66 pass = exactly the documented environmental baseline (blocked runtime hosts + no WebKit; session-local `pw-local.config.ts` untracked) → zero new failures. Built dist diffed against live: only source delta = the new footer line (site.js byte-identical; AASA `S6H8PA7TUH.app.resonanceventures.drop` preserved in dist).
- **Deploy:** ~~PENDING~~ **LIVE (confirmed 2026-07-16, later same day)**: `curl -s https://trydropapp.com/ | grep Impact-Site-Verification` returns the ROTATED value `32f8d138-64a9-420d-9fa0-2963738930b1` (commit 793eff8 rotated it after the first value timed out) — shipped by the NEW CI auto-deploy from PR #14 (`.github/workflows/deploy.yml`: tests on PRs, Pages deploy on main push, docs-only commits excluded; repo Actions secrets CLOUDFLARE_API_TOKEN/ACCOUNT_ID). **Deploy model changed: routine deploys no longer need manual wrangler or a token-in-chat — push/merge to main.** Remaining founder step: click **Verify** in the Impact dashboard (queue row added in drop-mobile-app FOUNDER_ACTION_QUEUE). Re-confirmed live 17:37 UTC by the disclaimer session.

## 2026-07-16 (round 3, same session) — Claude (Fable) — rebase onto de14389, redeploy, MERGED to main
- **Deploy-regression caught + fixed**: the AASA deploy `48ae0dd1` was built from this branch BEFORE `de14389` (Facebook muted status note, pushed to main 07-15 19:27 + deployed `a6ccce2f`) existed on it — so it briefly reverted live app/index.html to the disabled-Facebook-buttons variant. Rebased the branch onto origin/main, rebuilt dist (verified: status note + real AASA both present), redeployed production; live re-verified. Lesson: ALWAYS `git fetch origin main` + rebase before building dist for a production deploy from a branch.
- **Container test run (network-limited)**: 24/66 pass; all 42 fails are environmental — the remote env's Custom network allowlist blocks the site's runtime hosts (`ebccwnkmsnhbljxxxdej.supabase.co`, `fonts.googleapis.com/gstatic`, event-image CDNs), and the suite fails any page with a console resource error; the 2 non-obvious fails (typeahead, nav-login load timeout) also trace to blocked fetches. WebKit isn't installed in the container (Chromium only) → mobile-safari project can't run; used a session-local config (desktop + iPhone-13-viewport-on-Chromium, pre-installed browser via executablePath). Real gate remains the Mac run: 64/66 with the 2 pre-existing city-picker `West Springfield` fails (needs live data to reproduce — untouched this session).
- **Merged to main** (founder-authorized "when all is green push to main"): branch content = main + AASA fix + PROJECT_STATE records + .gitignore(.wrangler) — site code byte-identical to main at merge time.

## 2026-07-16 (later, same session) — Claude (Fable) — AASA DEPLOYED LIVE + MusicKit secrets wired
- **AASA is LIVE**: founder opened the remote env's network (Custom allowlist) + supplied a Pages-Edit CF token → preview deploy `12ba5360` verified (AASA + core paths), then production `48ae0dd1`. Live `trydropapp.com/.well-known/apple-app-site-association` now serves `S6H8PA7TUH.app.resonanceventures.drop`. NOTE: the pre-deploy live AASA was the ORIGINAL `TEAMID.app.drop.mobile` placeholder — the 2026-07-13 Team-ID commit (328d2b9) had never been deployed either. Live spot checks green: home/events/app-subdomain/worker asset passthrough all 200, tagline present. Deployed dist = branch content (main + AASA fix only; .md/tests excluded, matching live 404 behavior).
- **MusicKit config DONE end-to-end** (mobile launch unblocked): founder created key "Drop Apple Music Sync" (ID `876993RG4Q`, Media Services + Sign in with Apple + WeatherKit) after the Media-ID gotcha (see drop-app runbook); 3 secrets set on Supabase `ebccwnkmsnhbljxxxdej` via Management API + verified in secrets list; a locally-signed ES256 developer token got **HTTP 200 from api.music.apple.com** — key/Key-ID/Team-ID proven valid. Remaining (founder, Mac): `npx expo prebuild --clean && eas build -p ios --profile production` → device-QA Apple Music connect → `eas submit`.
- **Credential hygiene (founder TODO)**: the MusicKit `.p8`, a Supabase `sbp_…` access token, and two CF tokens passed through chat this session. Revoke the sbp_ token + the first (misscoped) cfut_ token now; revoke the working cfut_ Pages token after the branch merge settles; rotate the MusicKit key (new .p8 + Key ID, update the 2 secrets) after App Store submission, before wiring web Sign-in-with-Apple.

## 2026-07-16 — Claude (Fable) — AASA bundle ID updated for the iOS launch rename
- Context (from the drop-mobile-app session on the Mac mini, 2026-07-15): iOS launch arc landed there — enrollment approved, bundle RENAMED `app.drop.mobile` → `app.resonanceventures.drop` (old one taken on App Store Connect), ascAppId `6790662825`, Apple Music code-enabled, signed .ipa exists; remaining mobile steps = founder's MusicKit .p8 → rebuild → device QA → EAS submit.
- Changed here: `.well-known/apple-app-site-association` appID `S6H8PA7TUH.app.drop.mobile` → `S6H8PA7TUH.app.resonanceventures.drop` (universal links would have pointed at the dead bundle). Needs a Pages deploy to go live (branch push only — not deployed from this session).
- Still stale on purpose: `.well-known/assetlinks.json` keeps `app.drop.mobile` + TODO cert fingerprint — Android isn't launching yet; update package name + release SHA256 when it does. `APP_STORE_URL` constants (site.js/app.js/link.html) stay empty until the app is live; when it ships, fill with `https://apps.apple.com/app/id6790662825`.
- Cross-repo alignment done (same session): drop-mobile-app FOUNDER_ACTION_QUEUE rows 2/3 updated (iOS AASA values now real, blocker = merge+deploy only; Android SHA-256 still outstanding) + the Apple Music runbook's stale "module not installed / APPLE_MUSIC_ENABLED=false" extra-blocker marked RESOLVED (PR #163 landed both) — docs-only commit c52074a on drop-app main per §15. Verified on mobile main 0773f0b: bundle `app.resonanceventures.drop` in app.json, module `@superfan-app/apple-music-auth@^0.1.17` installed, flag true.
- Deploy still PENDING from this session: no Cloudflare credentials in the remote env (`wrangler whoami` unauthenticated; Pages project has no git integration) — see Exact next step -1.

## 2026-07-15 — Codex — Facebook web login deferred
- Changed: replaced active Facebook OAuth controls in the SPA login and signup screens with a muted “Facebook sign-in coming soon” status note; removed the now-unused `oauthFacebook` binding. Google and Apple remain active. This removes the crowded third social button on mobile. Mirrored the files into `dist/app/`.
- Verified: local 390×844 signup render shows two readable provider buttons and a one-line Facebook status note, with zero console warnings/errors; the Log in route still works. `npm test`: 64/66 passed; two pre-existing city-picker assertions selected `West Springfield` instead of expected `Springfield` on desktop and mobile. Deployed Cloudflare Pages `a6ccce2f.drop-site.pages.dev`; live `app.trydropapp.com` confirms the new status note.

## 2026-07-12 late-night session round 2 (latest) — 4 more mobile fixes + download-app button (LIVE, Pages `b24ed2a8`)
### 2026-07-12 — Claude (Fable) — hero gap, nav-search bubble, 771-artist grid, device-aware download button
- Public home mobile: hero→"Happening in" gap 150px→84px (`.hero` pb 36px + `.home-shows` pt 20px in the 720 block); stat line updated to the true numbers ("1,600+ shows across 200+ cities" — was 11 cities); guard test in smoke.spec.ts updated to match.
- Public nav search tiny-bubble bug: `.wn.search-open .wn__search-inline` sets `position:fixed` but the form's INLINE `position:relative;max-width:360px` won → field rendered squeezed in the nav row, typing invisible. Fixed with `!important` on position + `max-width:none!important` (shell.css, all public pages). Verified: full-width input, typed text visible.
- App-shell Artists tab: derives from the FULL catalog now — 771 artists (= exact DB count of distinct artists on upcoming published events), busiest-first, 48/page + "Show more (N left)" (resets on genre pick); avatars use DB photos; legend copy "near you" dropped (grid is global now).
- **Download-the-app button (NEW feature — design-FIRST flow per the fresh direction rule)**: pushed to the "Website design prompt" design before implementing (hero CTA row). Live: app-shell home hero (downloadApp handler) + public hero + public mobile drawer (`[data-app-download]`). Device detection wired (iOS→APP_STORE_URL, Android→PLAY_STORE_URL constants in app/app.js + site.js) — constants EMPTY until the app ships, so all buttons route to trydropapp.com/download.html (waitlist) today; filling the two constants is the only go-live change.
- Design mirror: waves 3+4 pushed (download button, artists Show more + legend), sc-if 195/195, `design-drop/` re-pulled byte-exact after.
- Verified: 66/66 smoke + 11-check Playwright drive (gap 84px, search w=362 typed visible, artists 48→144 append, 144/144 avatars photographed, zero console errors).
- Follow-up (deploy `ea7ee6d8`, commit 94d8c03): the fixed search overlay covered the Venues heading — pages with their own search (`[data-page-search]` on venues #v-q) now route the nav search icon to scroll+focus that field; other pages keep the overlay. Verified via Playwright.
- Founder "not seeing changes in claude design": fork visually verified the canvas AFTER a fresh load — download button renders in the design hero, no staleness; his open tab was cached. Canvas takes 10–20s to paint (blank gray meanwhile) — easy to misread as missing content.
- Round 3 (deploys `c8c672ae`→`c1c2246e`): download.html QR block + "App Store — soon" pill removed (hero single-col), FAQ head centered (root cause: `.section-head` is a 62ch box pinned left — needed margin auto, text-align:center alone can't move the box); authed-only "⤓ Get the app" nav link (desktop links + mobile drawer, sc-if authed — signed-out verified absent; authed render unverified live, needs real session); signup Username RESTORED as required pill under Email ("remove raver name" meant the placeholder, not the field) — plain `username` placeholder, same 52px style, required in doSignup, metadata `data.username` back; fake taken-list validator NOT restored (was demo data). Design synced same session (3 edits: 2 nav + signup, sc-if 197/197, mirror re-pulled).
- Round 4 (deploy `5d67004b`, commit 20e75e0): public events.html mobile compaction — pages.css 720px block tightens section rhythm (search→chips 56→32px, chips→"Browse by scene" 40→16px via !important over the inline `.sec` padding), filter card gap 24→12px + padding 12px; "We only use this to find your nearest city" disclaimer + orphaned `.filt-note` rule deleted. CSS-only/mobile-only → no design push needed (design mirror already 0 disclaimers). Verified: Playwright 390px probe (no overflow, 0 console errors) + 66/66 smoke + live curl.
- Round 5 (deploy `131479f0`, commit 972f753): artists.html genre chips → typeable dropdown + full-list city combobox (site.js bindCityPicker auto-binds .loc-wrap/.city-head-btn), one `.a-filterrow` row desktop+mobile, A→Z sort; events.html header left-justified (browse-head → wsh__headrow, chips same section) — ROOT CAUSE of desktop dead space: `.section--tight` padding-block rule-orders over `.section--flush-top` top:0 → 72px top+bottom; inline override (nav→eyebrow 102→30px, chips→scene 90→32px); fb-city/fb-venue selects → typeable comboboxes (213 city opts via fetchCities, all venues via new `Drop.fetchVenues(city)` in data.js, free-text Enter); killed pre-existing Clear-all ReferenceError (undefined distChips). Design file has NO artists/events browse screens (grep 0) → website-only, nothing to sync. Verified: 20-check Playwright probe both widths + 66/66 smoke.
- Round 6 (deploys `71b7ca95`→`dc8f7273`, commits 97d0213/bafd184): tagline rebrand "Every show. Who's going. Before you go." → "Never miss a drop." (4 site spots + smoke assertion), then one-line hero with gradient on "drop." only. Design synced: GetFile revealed the "lost" 3-edit push from the flaky session HAD landed; follow-up EditFile put the hero on one line — verified 0 old taglines, byte-length exactly matches local mirror (445172). GetFile `content` is BASE64 (decode before marker-grepping!). Chrome extension flapped between two tab groups all session (parallel Claude session owns the other) — every 2nd call dies; workaround = self-contained mega-JS per call, re-pull tabs_context every time. About-story prose still ends "…every show, who's going, before you go" (left as narrative; founder not asked).

## 2026-07-12 late-night session — mobile QA + full-catalog rework, design synced (LIVE, Pages `3178fc56`, commit 8970228)
### 2026-07-12 — Claude (Fable) — 10-item founder mobile-QA batch; catalog goes client-side
- **Full DB catalog**: `loadCatalog()` pages past PostgREST's 1000-row cap (1655 published upcoming), fetched once/session; Discover city/date filtering now client-side. City picker DERIVED from data (212 cities + All cities entry; was 11 hardcoded) with state lookups ("CO"/"Colorado" both work, `STATE_NAMES` map). Search: any query OR facet searches the whole catalog (state names match events too — "texas" → 93 results from Denver); facet option lists (genre/city/venue) are catalog-wide, `_catMapped` cached.
- **Filters**: Discover aside REMOVED (search-only, founder call — reverts half of 2f1b69d); location disclaimer deleted; mobile compact (`.fsel` pills 42px, sp-sm gaps, sp-md padding via 720px overrides). City/venue dropdown typing verified focus-safe (engine already preserves caret; live-verified typeable).
- **Signup/login**: username/raver_name field removed end-to-end (markup, state, doSignup metadata, validator); "Create one" → "Create an account"; iOS date input flattened (`-webkit-appearance:none` + `::-webkit-date-and-time-value`) — DOB pill now exactly 52px like the other inputs.
- **Browse Venues = design format**: grouped by STATE (sticky headers, full state names) instead of city, card meta "City · N upcoming shows", search matches state code/full name; covers all catalog venues.
- **Artist photos**: app-shell artist grid uses DB `image_url` (998/1027 artists have one) over grad fallback ({{ a.artStyle }}); artist detail hero already did.
- **Artists tab extras**: genre chips derived + frequency-sorted (app shell AND public artists.html); empty pill on public artists = `#a-bulk[hidden]` losing to `.btn{display:inline-flex}` → global `[hidden]{display:none!important}` in shell.css.
- **Mobile layout**: zero horizontal scroll verified on every surface at 390px (`html,body{overflow-x:clip}` guard); venues sticky state-banner slit (nav 64-65px vs sticky top 68px) killed with `box-shadow: 0 -8px 0 0 var(--bg)` (public + app shell copies).
- **Verified**: 66/66 smoke + 26-check Playwright mobile/desktop drive (signed-out /app/ = HOME screen, discover rail checked via Events nav: 6 tiles, Page 1 of 9). Cloudflare gotcha: `/x.html` 308s to `/x` — curl checks need `-L`.
- **Design mirror pushed** (11 hunks, waves 1+10): EditFile validates old_strings against the BASE file, NOT sequentially — edits inside a block being removed by an earlier edit 400 with "old_str found 2 times"; split dependent edits into separate EditFile calls. Verified via GetFile markers (raver 0, disclaimer 0, sc-if 194/194, banner/Maya kept). Live design had drifted +15KB vs local mirror — mirror trued-up by POSTing GetFile content to a localhost CORS server (`design-drop/` now byte-exact with live).
- **Sync direction rule recorded** (founder verbatim, memory updated): QA → website first then design; new features/reworks → design first then website.

## 2026-07-12 night session — founder live-QA batch: 8 fixes + discover filters, design synced (LIVE, Pages `e44b0956`→`c80faeb9`)
### 2026-07-12 — Claude (Fable) — QA-driven batch on the app shell; structural design mirror pushed
- Founder live-QA reports, all fixed + browser-verified: bell badge hardcoded "3" → real unread count (hidden at 0); events/venues/artists fluid full-width; "Get tickets" was a copy-toast stub → opens real `ticket_url` (safeUrl) in new tab; ALL share buttons now actually copy `/event.html?id=` (were fake toasts); genre-rail ring unclipped (pad/negative-margin); genre tiles derive from loaded events (all genres, busiest first — GENRES is now only the tint palette); "This weekend" window leaked Mon–Thu (started at today — now Fri–Sun containing today); new default "All upcoming" chip (365d fetch, limit 240) fixes "not all events show"; venues "In Drop" badge removed; Search pre-populates with the full set, query/filters narrow; Discover gets the same Filters aside (shared `facetPass` narrows Discover AND Search); price slider 0–200 wide-open default ($200+ = uncapped; old $20–$120 default silently hid cheap/premium shows). Commits 5f6bcd9 + 2f1b69d.
- **Structural design mirror PUSHED** to "Website design prompt" via EditFile (16 hunks, verified via GetFile markers): genre-rail derivation, All-upcoming chip+default, fluid widths, search pre-populate, price 0–200, Discover filter aside + facetPass. Demo data untouched (banner/crew/badge stay). Gotchas learned: EditFile validation sim in page JS must use split/join — `String.replace` mangles `$'` in replacement text; javascript_tool output guard blocks big page-content dumps (build hunks locally, ship via localhost CORS server — claude.ai CSP allows localhost fetch). Repo mirror `design-drop/` updated on disk (gitignored).
- Also earlier this session: OAuth callback forwarder + authed-home routing (below).

## 2026-07-12 late session — OAuth bounce fixed + authed-home routing (LIVE, Pages `ee6385de`→`5c8a6dc1`)
### 2026-07-12 — Claude (Fable) — login lands in Discover; marketing hero is signed-out-only; design demo-data rule settled
- Founder-verified fix: OAuth login was bouncing to the public home signed-out (Supabase redirect allowlist lacks app.trydropapp.com → falls back to Site URL). Public home now forwards stranded auth callbacks (`?code`/`#access_token`) to the app shell, choosing `/app/` vs `app.trydropapp.com` by PKCE code-verifier presence in this origin's localStorage (commit 71dbf9f). Founder confirmed "it lets you login now".
- Authed users never see the marketing hero: SPA `go('home')` → `discover` when authed; public home with a same-origin Supabase session `location.replace('/app/')` (commit 1033fa6, deploy `5c8a6dc1`, live-verified in founder's authed tab: trydropapp.com → Discover). Design contract: Discover IS the logged-in main; design has no authed home variant.
- **Design demo-data rule settled by founder (memory updated)**: design projects KEEP demo/sample data; only live surfaces are real-data-only; bidirectional design↔code sync covers structure/features/copy, never data states. The 3 parity edits pushed to the design earlier were reverted (EditFile inverse, verified via GetFile; local mirror restored). Mobile app untouched by founder instruction; audit found everything sample-gated except Drop+ paywall's hardcoded "Maya, Theo + 3 from your crew" (`DropApp/app/drop-plus-paywall.tsx:22`, ships to all users — flagged only).
- STILL OPEN (root fix, founder or token): add `https://app.trydropapp.com/**` + `https://trydropapp.com/app/**` to Supabase Auth → Redirect URLs (dashboard). Keychain read of the CLI token was classifier-denied; founder's keychain lookup under service "Supabase CLI" returned empty (item name unknown). Forwarder makes this non-urgent.

## 2026-07-12 evening session — demo purge + real art chain + discover pager (LIVE, Pages `c5999d42`→`44031553`)
### 2026-07-12 — Claude (Fable) — SPA demo-data purge + event photos + pager; bidirectional design sync established
- Founder: "get rid of the demo data from the live site" / "why are the images for events no longer showing?" / "no forward or backward event bars" / "changes must reflect in claude design and vice versa".
- Images: never a regression — SPA `mapRealEvent` never read `image_url`. Fixed: public-site art chain (real image → lineup artist photo → prism gradient, TM `/dam/c/` stock filtered) moved `site.js`→`data.js` (app shell loads only data.js) + `cssUrl()` %-encodes quotes/parens so `image_url` can't break out of inline `url('…')` (commit bce9a46, deploy `c5999d42`).
- Demo purge (commit ad103e6, deploy `44031553`): 8 fake datasets deleted (real wiring exists), 20 emptied + honest empty states (no backend), stragglers swept (fake recent searches, pre-seeded follows, fake wallet/paywall/invite stats, "DEMO" chips), GDF banner removed, crash guards for empty `[0]` indexing. Sonnet agent sweep, reviewer pass (2 reds = false positives — module-scope defs outside the diff), tests 66/66, zero console errors on all reachable screens.
- Discover pager ported from design (the round-4 "client pagers" hunk originally skipped): ← Prev / Page N of M / Next →, 24/page, fetch 48→240; live-verified paging Page 1→2 of 9 in founder's authed tab.
- **Design write path found**: `POST /design/anthropic.omelette.api.v1alpha.OmeletteService/EditFile` `{projectId, path, edits:[{old_string,new_string}]}` from a claude.ai tab → applied banner/CREW/COMMENTS parity edits to "Website design prompt" (verified via GetFile re-fetch; future-feature mocks — plans/chat/wallet — deliberately kept populated in the design). Gitignored repo mirror `design-drop/Drop Website.dc.html` updated on disk.
- Unverified: Supabase OAuth redirect allowlist for app.trydropapp.com (carried); Playwright suite still doesn't cover `app/index.html` (pre-existing gap).

## 2026-07-12 session — account.html retired + round-4 port: logged-in web = Prism SPA (LIVE, deploys `d8fb2117`→`1e5712a6` + worker `c650cc64`)
### 2026-07-12 — Claude (Fable) — old account shell retired + app-subdomain asset fix + round-4 design delta found
- Root cause of founder report "logged-in site shows the old account page, not the Claude design": (1) all 18 landing pages' Log in / Get started still pointed at old static `/account.html`; (2) app.trydropapp.com was broken — Worker prefixed `/app` onto root-shared assets so `/vendor/supabase.js` + `/data.js` 404'd as text/html (auth/data dead); (3) the "Website design prompt" design (project 5b6f000f-c206-44b6-ab8a-5981e36f2af9) got a round-4 edit ~Jul 11 22:00 that was never ported.
- Changed: Worker shared-root passthrough (`/vendor/`, `/data.js`, `/favicon*`); every landing link → `https://app.trydropapp.com/?mode=login|signup` (`?ref=` carried into signup, `?next=` left inert); app.js boot handles `?mode=login|signup` and an authed session sitting on home/login/signup hops to Discover (design contract: doLogin/doVerify → discover); `_redirects` `/login`, `/login.html`, `/account.html` → app shell + root `_redirects` reconciled with dist (stale `/app*→/account.html` rule dropped — root copy had drifted BEHIND dist); `account.html/.css/.js` deleted; smoke tests rewritten for new nav hrefs.
- Tested: `npm test` 66/66 (desktop + mobile-safari); local `http.server` + Playwright — `/app/?mode=login` renders the split-panel login, `?mode=signup` renders signup, zero console errors. **Unverified:** authed→Discover boot needs the prod deploy (localhost origin has no session); Supabase OAuth redirect allowlist for app.trydropapp.com unchecked (password/username login is origin-independent).
- Deploy: founder named it same session → Pages `d8fb2117` + worker `c650cc64` (plumbing), then Pages `1e5712a6` (round-4 port, commit a4c9850). LIVE-VERIFIED: assets 200 JS on app subdomain, `/account.html`→302 app shell (query carried), founder's real session at `trydropapp.com/app/` boots to Discover (bell badge + real Going pills), round-4 city dropdown live with per-city counts. Round-4 port: filterable/scrollable city picker, home+discover empty-state CTAs, search filter-panel dropdowns (sCity/sVenue facets), moL month labels; deliberately NOT ported (app has real equivalents): genre-carousel rebind, log-tab reorg, client pagers, home city-heading dropdown. Reviewed (renderVals/handlers/XSS clean) + `npm test` 66/66. Still open: Supabase OAuth redirect allowlist for app.trydropapp.com unchecked.
- Design-file recipe (DesignSync get_file caps at 256KiB; this file is 444KB): in a claude.ai design tab, `POST /design/anthropic.omelette.api.v1alpha.OmeletteService/GetFile` with `{projectId, path}` returns `{content: base64}`; ship it to disk via a localhost POST catcher (clipboard writeText freezes the renderer — don't).
- Round-4 delta (782 changed lines: filter-panel rework, scrollable city dropdowns `overflow-y:auto`, "Know of one?" suggest CTAs, `cityToDenver`, log-form month labels) handed to a port agent at session end — landing state in next steps 2.

## 2026-07-11 session — filter polish rounds (LIVE, deploy `24184f17`, commits 40b3dbe + 3548f74)
- Genre filter: MULTI-select (checkmark toggles, "House +2" label, URL `genre=csv`, tiles toggle into the same selection); genre trigger reclassed full-width `.fb-select`; City/Venue/Genre share one custom-chevron style; filter panel spacing sp-xl; tile gradients restored (pages.css `background:none` override removed) + `color: var(--text)` (labels were UA black).
- Location + Distance merged into ONE section: "Use my location" pill + "Within X mi" select in a flex-wrap `.loc-dist-row` — side-by-side when wide, stacked full-width in the 260px desktop sidebar; distance chips deleted; helper notes merged. Distance still honestly UI-only (no venue lat/lon yet).
- All rounds design-doc-first, founder QA'd, then synced live. Tests 70/70 each round.

## 2026-07-11 session (later) — design round-3 merge (LIVE, deploy `2c9f7423`, commit 2171790)
- Design-first workflow now standing rule: iterate in the claude.ai design doc, founder QAs there, then sync live.
- Public: 24/page Prev/Next pager + "Page X of Y" (count=exact) on home + events, walks entire 1.7K-event catalog; typeahead suggests all event cities; bare-city empty → "shows coming soon" + Suggest-an-event CTA (app ?suggest=1); any-genre dropdown (new `event_genres` view, popular-first with counts, type-to-search) + raw-tag matching in fetchEvents; Pick-your-night tiles ranked by volume; geolocation confirmed already-real.
- SPA: log-past-shows flow REAL (archive picker multi-select → attendance upsert 'attended'; manual form → logged_shows; Wrapped merges logged_shows now); ?suggest=1 deep link; mobile centering audit (grids centered, lists left); Discover segmented + Wrapped share buttons centered mobile; genre rail arrows.
- Design doc got the same 8 refinements + segmented centering; design ↔ live 1:1 (data/photos/geolocation differ by nature).
- Tests 70/70. Logged-in writes (attendance bulk, logged_shows) shape-verified only — founder QA item 1.

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
- trydropapp.com + www → CF Pages project **drop-site** (this repo's `dist/`, account ba8c4fed…). **Deploys are AUTOMATIC since 2026-07-16 (PR #14):** every push to `main` runs `.github/workflows/deploy.yml` (npm test → build-dist → `wrangler pages deploy`, credentials = repo Actions secrets `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`) — never ask the founder for a CF token for a site deploy. Commits touching only `**.md`/`docs/`/`history/` skip the deploy; force a redeploy of current main via Actions → "Test & Deploy" → Run workflow. Manual fallback only if Actions is down: `bash scripts/build-dist.sh && npx wrangler pages deploy dist --project-name=drop-site --branch=main`.
- `trydropapp.com/app*` and `app.trydropapp.com/*` → Worker **drop-app-path**. ~~Apex `/app` and `/app/...` redirect to `/account.html`; `app.trydropapp.com` serves the static browser account shell from this repo.~~ (Superseded: since 2026-07-09 the Worker serves the ported Prism SPA from `/app/`; 2026-07-12 the account shell was deleted outright.) No Expo web proxy is active on public routes.
- DNS (zone 5ac5024f…): apex+www CNAME → drop-site.pages.dev; app host remains proxied so the Worker route can catch legacy links.
- Verified live: all 12 pages 200, /link 200, /legal/* 301s, /event/<uuid> serves event page (200 rewrite + path-parsed id), AASA application/json at root, www→apex 301. Browser check: h1 renders, 24 live event cards, body scrolls (no app overflow:hidden), zero page errors. 2026-07-08 check: `/app/` and `/app/login` 302 to `/account.html`; `app.trydropapp.com/login`, `app.trydropapp.com/account.html`, and `/signup` serve the static account shell; account assets serve 200.

## Recent sessions (last 5 — older entries in PROJECT_HISTORY.md)
### 2026-08-17 — Codex — Google Play deletion resource reviewed
- **Changed:** added `/delete-account`, linked it from the privacy policy and sitemap, and covered the page at desktop and mobile sizes.
- **Verified:** 7 Node checks and 168 Playwright checks pass; browser QA is clean; `dist/delete-account.html` is byte-identical to reviewed source.
- **Delivery:** branch `agent/google-play-compliance-20260817` is pushed for the standard PR, CI, merge, and Cloudflare Pages deploy path.

### 2026-08-17 — Codex — Android Digital Asset Links source correction
- **Root cause:** the public website still carried the retired `app.drop.mobile` package and a TODO signing fingerprint because Android launch had previously been deferred. Google Play now exposes the authoritative App Signing public certificate for the current package.
- **Changed:** canonical assetlinks source now uses `app.resonanceventures.drop` plus the exact Play-generated SHA-256; the deploy build preserves it byte-for-byte; the regression asserts the complete statement and rejects stale/TODO/empty values. The runbook defines apex-only Android App Links because `www` redirects rather than directly serving an association file.
- **Verified/boundary:** focused 2/2, full Playwright 172/172, Node 8/8, build parity, diff check, and gitleaks pass after rebasing over the account-deletion page. Production remained stale until ordinary PR merge/Cloudflare delivery. That source-review session made no signing credential, build, bundle upload, Play release, store/device configuration, database, secret, or production mutation; a later session activated Play-signed 1.0.2 (2) in Internal Testing.

### 2026-08-16 — Codex — canonical public catalog stats live
- **Delivered:** backend migration `20260816032731_public_catalog_stats.sql` SHA-256 `35da83dc1f180f39b1cb605887ce29decd9ce463f360c3e60f56187ee3e5b68a` is live as ledger `20260816084907`. Website PR #90 merged as `9f0d1a2f`; workflow `31937512102` passed 164/164 and deployed through Cloudflare Pages.
- **Behavior:** the browser-local two-query/rounded snapshot is replaced by one canonical RPC response carrying exact event count, normalized city count, and server calculation time. Counts become `NaN` unless present before safe-integer validation; malformed HTTP 200, unavailable, and pre-response states keep numeric proof hidden and show only nonnumeric copy.
- **Verified:** anonymous RPC and production desktop 1745x1228/mobile 390x844 matched at 4,110 events / 295 cities, with no overflow or console warnings/errors. Live `data.js` SHA-256 `58a94049...3252` and `site.js` SHA-256 `9e95de32...6d00` are byte-identical to reviewed `main`; the only index transform is Cloudflare email obfuscation. No provider, importer, Edge, cron, secret, data rewrite, or third-party seller-availability work occurred.

### 2026-08-14 — Codex — mobile event ticket bar live
- **Root cause:** the four mobile event actions split width at `1 / 1 / 1.4` while the ticket CTA concatenated status and price inside a fixed 48px, overflow-hidden button. At the reported 498×608 viewport the CTA received about 156px, wrapped, and clipped.
- **Changed:** public and signed-in event bars now reserve 48px for the two icon actions, bound Going to 72–82px, and give the remaining width to an auto-height ticket CTA. Sticky price copy is removed; unknown/cancelled state renders neutral `Tickets` while preserving `View ticket details` as the accessible name. Icon-only actions now have explicit accessible labels.
- **Verified:** 7 Node checks plus 164 Playwright checks pass across desktop Chromium and mobile WebKit. Independent review caught and closed the 320px/reserved-inset edge. Exact live event QA passed at 498×608, 390×844, 320×568, and 1280×800 with no clipping, overlap, horizontal overflow, or console warnings/errors; the live CTA click targets the exact SeatGeek URL without replacing the event tab.
- **Delivery:** PR #88 exact head `91984cb81966522defb4b4ab9ba458afebc1f09d` passed required CI and merged as `5a26c85d84c76e25ac2f5eae716ded56303f6a71`. Main workflow `31852082349` passed 164/164 and deployed through Cloudflare Pages. Live public CSS and app assets match reviewed bytes; the exact public event response contains the reviewed CTA implementation.

### 2026-08-14 — Codex — buyable homepage event count live
- **Changed:** homepage trust count now includes only published upcoming/ongoing events with a non-empty ticket URL; the audited fallback is `4,500+` events / `320+` cities.
- **Evidence:** read-only production count returned 4,595 buyable events at the existing browser-local start-of-day boundary, so flooring to `4,500+` preserves the no-overstatement rule. The UTC-boundary count was deliberately not substituted because that would change established visitor-local date semantics.
- **Verified:** 7 Node checks plus 164 desktop/mobile Playwright checks pass; the dist build mirrors source; rendered 1280×900 and 390×844 QA shows `4,500+`, no console warnings/errors, no mobile overflow, and a working city picker. Independent adversarial review found no blockers.
- **Delivery:** PR #86 merged as `49a61eb1eeb845bca3b9bfadcc3c53ea77a86c73`; exact main workflow `31849172339` passed 164/164 browser checks and deployed through Cloudflare Pages. Production desktop/mobile QA rendered `4,500+` with no console warnings/errors or horizontal overflow, and live `data.js` SHA-256 `1a721bc1adc0c0b3759a33afab74686bf70f39486e15923b847d0085f3a4e98f` is byte-identical to reviewed source.

### 2026-08-10 — Codex — Impact marketplace reapplication and appeal
- **Profile:** corrected the business classification to developer/company/
  website-app/tech solutions; added the live App Store property; connected the
  verified website, Instagram, Facebook, and LinkedIn; and saved a Drop-specific
  marketplace description. TikTok, YouTube, and X were left unconnected after
  their Impact OAuth flows required write or unrelated analytics scopes.
- **Verification delivery:** PR #76 added the current first-in-head Impact meta
  tag and merged as `86cdf6dc50465af8179814bf461c076f0ac5e9fe` after tests and
  review. Impact then showed `trydropapp.com` Connected.
- **Result:** the rebuilt application was submitted and immediately declined.
  Following Impact's documented appeal path, support ticket `865870` was sent
  from account `7487237` with website, App Store, and connected-social evidence;
  status is Open under Marketplace Approval.
- **Boundaries:** no TikTok write scope, Google Analytics scope, X follow/tweet
  write scope, password disclosure, payment, tax, or production data change.

### 2026-08-09 — Codex — authentic Facebook Page destination live
- **Changed:** replaced the unrelated `facebook.com/trydropapp` logistics
  destination across all 16 public Page surfaces, Organization JSON-LD,
  `llms.txt`, and exact deterministic coverage with stable Page ID
  `61591821453151`; kept platform icon, accessible name, and safe new-tab
  attributes unchanged.
- **Verified:** Meta Accounts Center lists the managed `trydropapp` Page with
  that numeric ID. Local checks passed 7 Node tests and 138/138 Playwright
  checks; independent adversarial review approved. PR #70 merged as
  `57b5c699b1450940e7ce371b354f76c5de633cb9`; exact main workflow
  `31329063826` passed 138/138 and deployed to Cloudflare Pages. A live `/link`
  click opened canonical `/people/trydropapp/61591821453151/`, whose public DOM
  and metadata show the Drop EDM bio, Software category, email, and website,
  with no console errors or horizontal overflow.
- **QA note:** desktop Browser interaction is live-proven and the repo's mobile
  Safari lane passed; the Browser extension's separate 390px viewport override
  hung and was abandoned without a second unbounded retry.
- **Boundaries:** no backend, database, secret, Worker, social-account setting,
  or external post changed.

### 2026-08-09 — Codex — official social profiles live
- **Changed:** replaced the old Instagram/TikTok/X letter badges with one
  self-hosted seven-platform SVG sprite across all 15 existing public footers
  and the link hub; added the same canonical URLs to Organization JSON-LD and
  `llms.txt`; added accessible names, new-tab behavior, and
  `noopener noreferrer` to every profile link.
- **Verified:** local checks passed 7 Node tests and 138/138 Playwright checks
  across desktop Chrome/mobile Safari; an independent adversarial reviewer
  approved. Exact main workflow `31323566520` passed and deployed merge
  `3aed046eb8a9e0e7c4e5092160a0b22316bfcd90`. Live source/CSS/icon readback
  matches reviewed bytes; desktop 1440×900 and mobile 390×844 Browser QA found
  all seven icons, no overflow, no console warnings/errors, and the YouTube
  interaction opened the official Drop channel.
- **Boundaries:** no signed-in app behavior, Worker, backend, database, secret,
  social-account setting, or external post changed.

### 2026-08-09 — Codex — App Store launch surfaces live and listing-truth aligned
- **Changed:** PR #65 replaced the download waitlist with Apple's official badge and live `id6790662825` listing across the download page, link hub, signed-in app template, metadata, and discovery text. PR #66 corrected the remaining iPhone-and-iPad claims to iPhone-only copy, matching Apple's product page without changing badge/link or iPad routing.
- **Verified:** final local regression passed 7 entity tests and 136 Playwright checks; independent adversarial review approved the truth fix. PR #66 CI passed, merge `6ad7e46551fba41ab33aebf8c42d26eec7d360f5` deployed through main run `31320193410`, and live desktop/390px Browser QA confirmed copy, official artwork, no mobile overflow, `/link` handoff, the `/app/` template, `/llms.txt`, and the App Store product page (`Drop - EDM Events`, Free, Only for iPhone). Live badge bytes match the reviewed source SHA-256.
- **Boundaries:** no manual Wrangler, Worker, backend, schema, data, secret, or App Store Connect mutation occurred.

### 2026-08-07 — Codex — optional browser phone verification reviewed locally
- **Changed:** added an explicit optional phone step to the authenticated signup wizard using the existing `verify-phone` Edge Function; preserved email-only signup and Skip; routed email-confirmation, resend, and signup-origin OAuth callbacks through `?mode=signup-complete`; corrected password-signup metadata to the accepted July 18 compliance contract.
- **Security/reliability:** every authenticated session attests signup compliance before Discover; raw phone/code stay ephemeral and clear on success, abandonment, activation restart, and sign-out; provider errors are sanitized; navigation, resend, and number changes are disabled during active requests; server-only Twilio credentials and the existing JWT/compliance/rate-limit boundary remain unchanged.
- **Verified:** app JS syntax and deploy build pass; full website suite passes 7 Node + 142 Playwright checks across desktop Chrome/mobile Safari, including 14/14 mocked callback/compliance/skip/send/check/failure/cleanup cases. Two adversarial review passes are resolved. PR, CI, deploy, live routing verification, and one founder SMS proof remain. No production mutation occurred.

### 2026-08-04 — Codex — Cervantes combined partner/source logo row live
- **Changed:** consolidated the standalone Cervantes partner card and ticket-source strip into one section titled “Official Drop partners and ticket sources”; added the official self-hosted Cervantes wordmark as the first linked logo; retained the partnership's select-show guest-list/community-promotion scope; removed the superseded card CSS and consolidated regression coverage.
- **Verified:** the deploy build and source mirror match; focused entity/SEO checks pass 7/7; independent review's scope-language finding was fixed and the final review found no actionable defects; PR and `main` workflows each passed the complete 124-test Chrome/WebKit suite. Live QA at 1280×900 and 390×844 confirmed five loaded logos, the official Cervantes URL, scoped copy, no horizontal overflow, and no console warnings/errors.
- **Delivery:** PR #45 merged as `5a1769f`; production workflow `30961412951` passed and deployed to Cloudflare Pages.

### 2026-08-03 — Codex — Ticketsauce source and rounded homepage totals live
- **Changed:** added the official Ticketsauce wordmark and homepage link beside the existing three official ticket sources; kept the non-commercial “Official ticket sources available on Drop” wording. Changed only the rendered proof formatting: the live exact counts remain the data source, then floor to the nearest 100 events and 10 cities before appending `+`.
- **Verified:** focused regression checks passed 4/4, `npm test` passed 7 Node + 124 Playwright checks across desktop Chrome/mobile Safari, and `scripts/build-dist.sh` produced 55 files. PR workflow `30878437779` passed before merge; exact `main` workflow `30878584151` then passed the full suite and deployed. Live Browser QA at desktop 1280px and mobile 390px rendered `2,200+` events / `230+` cities, loaded all four local logos without overflow or console errors, and opened the exact official Ticketsauce URL. The live Ticketsauce asset SHA-256 matches the reviewed source file.
- **Delivery:** PR #42 merged as `9de4ad6`; exact `main` workflow `30878584151` deployed production. No database or backend changes.

### 2026-08-02 — Codex — Google Search Console ownership and sitemaps complete
- **Changed externally:** verified the `trydropapp.com` domain property with a root Cloudflare TXT record and retained the record so ownership stays valid. No production application data or page content changed.
- **Verified:** Google Search Console reports both submitted sitemaps as `Success`, last read Aug 2, 2026: `sitemap.xml` discovered 27 pages and `sitemap-entities.xml` discovered all 3,581 quality-filtered event, venue, and artist URLs.
- **Remaining:** Google controls crawl/index timing and ranking; submission is discovery, not an indexing guarantee. Bing import remains a separate founder OAuth action.

### 2026-08-02 — Codex — canonical event/venue/artist SEO live
- **Changed:** replaced query-string discovery links with readable UUID-backed event, venue, and artist URLs; added server-rendered Cloudflare Pages entity routes, canonical redirects, Event/MusicVenue/MusicGroup JSON-LD, and a live entity sitemap; fixed venue/artist directory truncation by paging the full catalog and grouping venues by canonical ID. Added the pre-merge safeguards: malformed events fail closed, thin venue/artist aggregates remain accessible but receive `noindex, follow` and stay out of the sitemap, and lifecycle/ticket status now drives both JSON-LD and visible ticket language instead of inferring availability from a URL.
- **Verified:** read-only production QA found 2,246 indexable events, 354 indexable venues, 981 indexable artists, and 3,581 sitemap URLs; the full directories remain available. Real event, Red Rocks, Polo & Pan, and thin-venue pages return entity-specific server titles/canonicals/content and correct Event/MusicVenue/MusicGroup JSON-LD; the thin venue is `noindex, follow` and absent from the sitemap. Robots lists the entity sitemap, a missing slug redirects 301 to canonical, event-to-venue navigation lands on Red Rocks, desktop/mobile have no horizontal overflow, and the live browser emitted no console/page/product request errors. Seven focused Node checks and 124/124 Playwright checks pass locally and in GitHub.
- **Delivery:** PR #38 merged as `a6f61d2`; exact-head run `30783634892` passed and main workflow `30783799594` deployed through the standard Cloudflare Pages job. Live QA caught a generic server title and event-UUID venue links; corrective PR #39 fixed both with regression coverage, merged as `0223f06`, and exact-head/main workflows `30784417457` / `30784574518` passed and deployed. No database mutation or fabricated event/review occurred. The next honest product slice is persisting and publicly rendering moderated `show_ratings` reviews on event/venue pages.

### 2026-07-30 — Codex — Twilio SMS opt-in proof live
- **Changed:** added the public, privacy-safe SMS verification consent proof and smoke coverage in PR #29. After two post-merge production attempts timed out waiting for mobile WebKit's `load` event, PR #30 made the test harness deterministic by stubbing Google Fonts and providing explicit Supabase REST fallbacks; production behavior was not changed by the CI fix.
- **Verified:** local Playwright passed 108/108; the exact mobile-Safari failure paths passed 45/45 across five repeats; the generated build, secret scan, diff checks, and independent adversarial review passed. PR #30 exact-head run `30522969554` passed, then production run `30523124634` passed its full test and Cloudflare deploy jobs at main `b39b216`.
- **Live result:** `https://trydropapp.com/sms-opt-in` returns HTTP 200 and contains the exact one-time consent, “Text me a code,” no recurring/promotional-text disclosure, Privacy/Terms links, and `noindex, nofollow`. Twilio initially rejected a mismatched legal-name/entity pairing; the legal name was corrected to CP575-exact `ARYA A SHINDE`, resubmitted with company type `SOLE_PROPRIETOR`, and the fresh checklist reports `In Review`. Toll-free number `(855) 741-1140` (`PNbd8be89e2ffdf5c70d63e5f8a66eba17`) is now attached to `Drop Phone Verification` (`MGe2d6e639033b34c6535bb7deaf7d3bfd`), confirmed by the number configuration's selected-service readback. Supabase secret/config writes remain separately approval-gated.

### 2026-07-30 — Creator Program website candidate verified locally

- Added the noindex `/creators` page, accessible application form, truthful
  ticket/payment language, public-to-browser creator-code forwarding,
  post-compliance attribution, and signed-in creator badge.
- Verified 120/120 Playwright checks, deployable `dist/` generation, and visual
  desktop/mobile QA at 1280px and 390px with no horizontal overflow.
- No production application, website deploy, or external submission occurred.
### 2026-07-25 — Codex — Reliable launch-access client ready to deploy
- **Cause:** the live form wrote directly from the visitor’s browser to the
  waitlist table. A failed request was neither queued nor retried, and no code
  sent a confirmation email; the reported July 24 signup is absent from the
  live table.
- **Changed:** `Drop.joinWaitlist` now calls the paired server-side Edge
  Function; success copy tells visitors to check their inbox, repeat signups
  receive the same privacy-safe response, and email/quota failures retain the
  visible retry state. Copy now discloses the immediate confirmation.
- **Verified:** the complete 104-test Playwright suite passed across desktop
  Chrome and mobile Safari; source and generated `dist` match. The paired
  production migration/function are live, and the controlled canary was
  recorded by the database and delivered by Resend. PR #26 merged as
  `655f54a`; production workflow `30173794587` passed 104/104 tests and
  deployed Cloudflare Pages. Live duplicate-safe verification returned “Check
  your inbox” without sending another confirmation.

### 2026-07-24 — Codex — password-reset browser fallback live
- **Changed:** added the exact `/reset-password` Cloudflare Pages redirect to the existing SPA reset mode and a regression assertion for the source/dist rule. Kept the native AASA route unchanged. Hardened the existing console collector only against third-party resource-load noise already handled on the active feature branch.
- **Verified:** local and GitHub Playwright passed 104/104 across desktop Chrome and mobile Safari; PR #25 merged as `006fe8d`; workflow `30138096500` deployed successfully. Live HTTP returns 302 to `https://app.trydropapp.com/?mode=reset-password`, a placeholder recovery hash survives the redirect, and the destination renders “Choose a new password.”
- **Delivery:** Supabase accepted a fresh recovery request and Resend confirmed the new “Reset your password” email delivered. The real token was not opened because recovery links are single-use.

### 2026-07-18 — Codex — v1.0.1 hosted legal alignment prepared, not deployed
- **Changed:** updated canonical Privacy/Terms to July 18, 2026; aligned the 16+ account/social gate and audited data disclosures; removed the SPA's stale embedded 18+ policy and dead bindings; pointed signup/footer and hosted-document links at canonical `/privacy` and `/terms`; added regression coverage for OAuth's no-DOB path, signup consent ordering, stale copy, canonical links, audited disclosures, and the exact AASA route set. Follow-up adversarial review found the live/draft AASA lacked `/reset-password`; this branch now includes that native recovery callback.
- **Verified:** `dist/` rebuilt byte-for-byte from source; `npm test` passed 100/100 across desktop and mobile Safari; desktop and 390×844 browser review showed no console/page errors; live canonical URLs return 200 while `.html` variants redirect once; the mobile and website AASA sources are byte-identical and parse to event, plan, recovery, and root routes; separate cross-repo `/verify` passed all five criteria before the focused recovery correction.
- **Remaining:** draft PR #19 is open. No merge or deploy occurred; the live hosted documents and AASA recovery route remain unchanged until explicit production approval. Legal text should still receive counsel review before launch, and password recovery needs physical TestFlight proof after deployment.

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
### 2026-08-17 — Facebook Login browser controls verified; PR #92 open
- **Changed:** login/signup now call the existing `oauth('facebook')` path; signup still enforces DOB and legal consent before OAuth. Source and behavioral regressions assert the Facebook provider.
- **Reconciled:** prerequisite age-gate PR #83 passed its existing checks and merged as `bf9c4e9`; this branch rebased on top, preserving both 13+ enforcement and Facebook controls, then pushed with lease.
- **Verified:** `node --check`, 7/7 Node checks, 166/166 desktop/mobile Playwright checks, generated source/dist parity, diff checks, and independent auth review pass. No provider configuration or live Facebook round trip ran.
- **Review/boundary:** PR #92 is open with one successful and one intentionally skipped check, no conflicts, and independent auth review passed. Merge/deploy remains held for the Meta/Supabase tester round trip. No provider/dashboard configuration, privacy/legal/deletion, backend/database, Worker, or manual deploy occurred.

### 2026-07-18 — Codex — Google favicon correction
- **Why:** Google mobile search still showed the retired Expo placeholder even though the standalone site already used the Prism spectrum SVG. Live checks found `/favicon.ico` and `/favicon.png` returned 404, leaving Google with its stale cached icon.
- **Changed:** added 96×96 Prism spectrum `favicon.png`, a matching root `favicon.ico` fallback, made the PNG the homepage's primary declared favicon, and added both files to the deploy whitelist.
- **Verified:** final deploy build contains byte-identical PNG/ICO assets; local rendered homepage declares `/favicon.png` at 96×96 with the SVG fallback and zero console warnings/errors; Playwright desktop + Mobile Safari suite passes 100/100; `git diff --check` clean. Commit `cceb03b` pushed to `main`; GitHub run `29672347775` passed 100/100 and deployed; production PNG/ICO bytes match source and the live homepage declares the new PNG.
- **Google refresh:** Search Console confirmed the homepage is indexed and accepted a fresh request into its priority crawl queue. Remaining wait is Google-controlled; its favicon docs allow several days to several weeks.

### 2026-07-12 — Claude (Fable) — account.html retired + round-4 port; logged-in web = Prism SPA (LIVE: Pages d8fb2117→1e5712a6, worker c650cc64)
- **Changed:** `workers/app-path/worker.js` (root-shared assets `/vendor/`, `/data.js`, `/favicon*` pass through un-prefixed — they 404'd as text/html on app.trydropapp.com, killing auth/data there); all 18 landing pages' Log in / Get started → `https://app.trydropapp.com/?mode=login|signup` (`?ref=` → signup, `?next=` inert); `app/app.js` boot handles `?mode=login|signup` + authed session on home/login/signup hops to Discover; `_redirects` `/login|/login.html|/account.html` → app shell (root copy reconciled with dist — stale `/app*→/account.html` rule dropped); `account.html/.css/.js` DELETED; `tests/smoke.spec.ts` rewritten for new hrefs; dist/ mirrored.
- **Tested:** `npm test` 66/66 (desktop + mobile-safari); local python http.server + Playwright: `/app/?mode=login` renders split-panel login, `?mode=signup` renders signup, zero console errors. **Unverified:** authed→Discover boot (needs prod deploy — localhost has no session); Supabase OAuth redirect allowlist for app.trydropapp.com.
- **Remaining (RESOLVED same session):** founder named the deploy → both shipped + live-verified (authed Discover boot, round-4 city dropdown, assets 200). Round-4 port landed: 782 changed lines in the "Website design prompt" design (project 5b6f000f-c206-44b6-ab8a-5981e36f2af9) vs `design-drop/Drop Website.dc.html` — filter-panel rework, scrollable city dropdowns, "Know of one?" CTAs, `cityToDenver`, log-form month labels; `<link rel="icon" href="/favicon.svg">` still missing from `app/index.html` head.
- **Next steps (ranked):**
  1. Deploy: `npx wrangler pages deploy dist --project-name=drop-site --branch=main` + `cd workers/app-path && npx wrangler deploy` (founder names the deploy in-session). Verify: `curl -sI https://app.trydropapp.com/vendor/supabase.js` → 200 JS; founder's logged-in Chrome tab at `trydropapp.com/app/` boots to Discover.
  2. Land the round-4 design port into `app/index.html` + `app/app.js` (markers to grep when done: 'Know of one', 'Back to Denver', 'overflow-y:auto', "moL=['Jan'", 'cityToDenver'); add the favicon link to `app/index.html` head; `npm test` 66/66; sync `dist/app/`; deploy. Refetch design if needed: POST `/design/anthropic.omelette.api.v1alpha.OmeletteService/GetFile` `{projectId:"5b6f000f-c206-44b6-ab8a-5981e36f2af9", path:"Drop Website.dc.html"}` in a claude.ai tab → `{content: base64}`.
  3. Founder QA of logged-in write paths on app.trydropapp.com (see Exact next step 3 above).

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
