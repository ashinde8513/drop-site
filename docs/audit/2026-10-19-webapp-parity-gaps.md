# Web app vs native iOS 1.0.4: feature-parity gap list (2026-10-19)

Read-only audit. Plain English. Nothing was run on a device or logged in; every web claim comes from reading source.

## Sources
- Native: `/Users/aryashinde/Developer/Drop/drop-mobile-app` at `origin/main` 75f0b17ade42 (`DropApp/app/**` = 80 route files; `DropApp/app.json` version 1.0.4; `DECISIONS.md`, `FOUNDER_ACTION_QUEUE.md`, `DropApp/app/PROJECT_STATE.md`, `ops/device-qa-build29-20261017.md`). Data deps from `git grep` of `.from(` / `.rpc(` in `DropApp/src` + `DropApp/app`.
- Web: `/Users/aryashinde/Developer/Drop/drop-website-wt-webapp-20261019/app/app.js` at worktree HEAD 941a540. I confirmed `curl -s https://app.trydropapp.com/app.js` is byte-identical to this file (3,619 lines), so the audit is of the live app.
- Checklist only (NON-production React rebuild): `/Users/aryashinde/Developer/Drop/drop-web-rebuild` `docs/signed-in-route-matrix.md` (origin/main).
- 1.0.4 scope: `DECISIONS.md` 2026-10-13 and 2026-10-15; TestFlight 1.0.4 (29) is `release-train-306-d24eb60` (commit d24eb60). The five "Dad" features merged AFTER that build (Train 333) and are not on any device.

## What the web app really talks to
The live web app reads and writes only these Supabase tables: `attendance`, `artist_follows`, `venue_follows`, `artists`, `events`, `event_artists`, `profiles`, `logged_shows`, `my_set_times`, `event_set_times`, `artist_claims`. Plus RPCs `signup_compliance_status`, `complete_signup_profile`, `record_signup_referral`, `record_creator_referral`, `event_going_counts`, and edge functions `verify-phone`, `login-with-username`, `delete-account`.
Native additionally uses ~45 tables/RPCs the web never touches (friendships, crews, plans, plan_members, plan_messages, event_watches, event_comments, show_ratings, show_tags, content_reports, user_blocks, notification_prefs, ticket_offers, event_sets, recap_posts, reviews, ...). The web source says so itself: `FRIENDS`, `PLANS`, `NOTIFS`, `BLOCKED`, `SEEN_HISTORY`, `LEDGER`, `TAGGED`, `SUBMISSIONS`, `PROMO_EVENTS`, `REVIEW_QUEUE`, `REPORTS`, `COMMENTS` are hard-coded `[]` (app.js lines 1003-1050). So those screens exist but can only ever show empty states.
**Backend-ready = yes for almost every gap below**, because native already calls the same tables. Cost is mostly web wiring plus RLS checks, not new backend.

## Matrix (native route -> web class)
Classes: **Present** (real data, table/RPC verified in app.js) / **Present-demo** (screen exists, no backend or local-only) / **Partial** / **Missing** / **N/A** (web cannot or should not do it).

| # | Native screen / feature (route) | Data it depends on | Web class | Web evidence |
|---|---|---|---|---|
| 1 | Login, signup, forgot/reset password, verify email (`(auth)/*`, `verify-email`) | Supabase auth, `login-with-username` | Present | auth calls + `functions.invoke('login-with-username')` |
| 2 | Complete profile + age/legal (`complete-profile`) | `complete_signup_profile` | Present | RPC at app.js |
| 3 | Phone verification (`verify-phone`) | `verify-phone` fn | Present | 3 invokes |
| 4 | Activation wizard (`activation-wizard`) | phone, artists, friends | Partial | friend step reads `WIZ_FRIENDS = []` |
| 5 | Onboarding + pick artists (`onboarding`, `pick-artists`) | `artist_follows` | Present | 3 `artist_follows` calls |
| 6 | Discover feed, city, date chips (`(tabs)/index`) | `events`, `event_going_counts` | Present | data.js REST + RPC |
| 7 | Discover "Crew" rail / friends going | `friendships` | Present-demo | no friends source |
| 8 | Search with typeahead (`(tabs)/search`) | events/artists/venues | Present | client + edge `/search` |
| 9 | Discover map (`discover-map`) | event lat/lng | Missing | no map code in app.js |
| 10 | Event detail (`event/[id]`) | `events`, `event_artists`, `ticket_offers` | Partial | one ticket link, no multi-seller offers, comments `[]`, no weather/map/setlist/pass links |
| 11 | Going / Interested | `attendance` | Present | 6 `attendance` calls |
| 12 | Save event | `saved_events` | Present-demo | `saved[id]` is React state only (app.js 1150), lost on reload |
| 13 | Ticket click-out | `events.ticket_url` | Partial | works, one seller, no price comparison |
| 14 | Share event | public URL | Present | `shareEvent()` copies SEO URL |
| 15 | Add to calendar (.ics) | none | Present-demo | `ics:` handlers only call `flash('Added to calendar (.ics)')` (2434, 3418) with no file created |
| 16 | Watch This Event (`event_watches`) | 1.0.4 cohort | Missing | n/a, unshipped on device (see do-not-chase) |
| 17 | Setlists + track votes | `event_sets`, `event_set_track_vote*` | Missing | none |
| 18 | Artist detail (`artist/[id]`) | `artists`, `artist_follows` | Partial | follow real; reviews/bio/fan stats empty (2386-2403) |
| 19 | Artist claim / owner edit (`artist/claim`) | `artist_claims` | Present | 2 `artist_claims` calls |
| 20 | Venue detail (`venue/[key]`) | `venue_follows` | Partial | follow real; no address/map/capacity/venue intel (2408) |
| 21 | Venues directory (`venues`) | events | Present | `/venues` |
| 22 | Access Guide + Venue Intel | 1.0.4 cohort | Missing | unshipped natively |
| 23 | Festival schedule + star sets (`schedule/[id]`) | `event_set_times`, `my_set_times` | Present | real rows |
| 24 | Live mode / check-in (`live/[eventId]`) | `event_checkins` | Missing | none |
| 25 | My Shows Upcoming/Past (`(tabs)/shows`) | `attendance` | Present | attendance select join |
| 26 | Log a past show (`log-show`) | `logged_shows` | Present | insert at 1529 |
| 27 | Import shows from calendar/ICS (`import-shows`) | `icsParser` local | Missing | `bulkIcs` is a toast |
| 28 | Show detail: ratings, notes, tags (`show/[id]`, `show-tags`) | `show_ratings`, `show_tags` | Present-demo | star click stored in `ratings` React state only (2455) |
| 29 | Seen history (`seen-history`) | `get_seen_history` | Present-demo | `SEEN_HISTORY = []`, screen reachable from profile menu |
| 30 | Drop Stats (`drop-stats`) | `get_seen_counts`, fan stats | Missing | no stats screen (Wrapped only) |
| 31 | Wrapped (`wrapped`) | attendance + logged shows | Present | computed client-side; canvas PNG share; "hours" is a flat 3.5h/show estimate |
| 32 | Recap + From That Night photos (`recap/[eventId]`) | `recap_posts`, photo library | Present-demo | placeholder cells (2666); photo library is N/A on web |
| 33 | Friends tab: find, requests (`(tabs)/friends`) | `friendships`, `search_public_profiles` | Present-demo | `FRIENDS/REQUESTS/FIND_PEOPLE = []` |
| 34 | Public profile (`profile/[id]`, following, going) | `public_profile` | Missing | only own profile |
| 35 | Crews (`crews`) | `crews` | Present-demo | empty |
| 36 | Plans + plan detail + chat (`plans`, `plan/[id]`) | `plans`, `plan_members`, `plan_messages` | Present-demo | `PLANS=[]`; Crew Builder button says "Plans - coming soon" (3173) |
| 37 | Crew Builder (`crew-builder/[eventId]`) | plans | Present-demo | see 36 |
| 38 | Crew Picks, Crew activity, Festival crew | `crew_picks` | Missing | Crew Picks unshipped natively; activity missing |
| 39 | Taste match (`taste-match/[friendId]`) | `get_friend_taste_overlap` | Missing | none |
| 40 | Music taste / connect (`music-taste`, consent) | `music_connections` | Present-demo | `scConfirm` toasts "Imported 12 artists from SoundCloud" with no import (3093) |
| 41 | Notifications inbox (`notifications`) | `notifications`, `alerts` | Present-demo | `NOTIFS = []` |
| 42 | Reminders + push (`reminders`) | `push.ts`, `onsale_reminders` | N/A | web push not built; settings toggles are local state (2378), so on-sale alerts silently do nothing |
| 43 | Invite friends / invites (`invite-friends`, `invites`) | contacts, `referrals` | Present-demo | contact matching is N/A on web; copy-link is a toast (3175) |
| 44 | Own profile + edit (`(tabs)/profile`, `edit-profile`) | `profiles` | Present | update at 3487 |
| 45 | Settings (`settings`) | `notification_prefs`, `get_my_profile_settings` | Partial | account bits real, prefs local-only |
| 46 | Block / report / blocked accounts | `user_blocks`, `content_reports` | Present-demo | `BLOCKED=[]`, no report action |
| 47 | Delete account | `delete-account` fn | Present | invoke |
| 48 | Legal (`legal/*`) | static | Present | site pages |
| 49 | Submit event (`submit-event`) | `events` pending + rewards | Present-demo | `submitSuggestion` clears the form and says "Submitted for review" (3102); nothing is written |
| 50 | Drop+ / paywall | none (native also "coming soon") | Present-demo | "Start annual $59.99/yr" button toasts coming soon |
| 51 | Ticket wallet (`ticket-wallet`) | `user_tickets`, `ticketShot` | Present-demo | `LEDGER=[]`; native stores ticket screenshots, N/A on web |
| 52 | Promoter dashboard/new event/manage | `promoter_*`, `guest_list`, `discount_codes` | Present-demo | `becomePromoter` sets local flag (3082); "Presale code created" toast (3088) |
| 53 | Admin review queue / reports / analytics | RPCs `review_*`, `get_admin_*` | Present-demo | all arrays `[]` |
| 54 | City Watchlists, Promoter Channels | 1.0.4 cohort | Missing | unshipped natively |
| 55 | Referral / creator codes | `record_*_referral` | Present | RPCs |
| 56 | Deep links / link hub | static | Present | `/link`, event intents |
| 57 | Widgets, Live Activity, App Clip, haptics, contacts sync, photo library, camera, MusicKit, StoreKit | OS APIs | N/A | iOS-only; the web equivalent of contacts and photos is share links and file upload |

### Counts (57 rows, counted by grep)
Present 19 / Present-demo 19 / Partial 6 / Missing 11 / N/A 2.

## Ranked top-15 gaps
Value: H/M/L by core-loop frequency and conversion. Effort: S/M/L. Backend-ready: Y means native already uses the table/RPC.

| Rank | Gap | Why it ranks here | Value | Effort | Backend-ready |
|---:|---|---|---|---|---|
| 1 | **Fake-success UI** (rows 15, 40, 49, 52, 43): .ics toast, SoundCloud "imported 12", Submit event, promoter code, invite copy. Real .ics download + wire Submit event to the existing pending-event write; hide or remove the rest | Trust. A user is told something happened and it did not. Also a launch-claim risk. Cheapest fix on the list | H | S | Y (ICS is pure client; submit event Y) |
| 2 | **Save and Interested persist** (row 12): write `saved_events` / `attendance` instead of React state | Core loop "save" is lost on refresh | H | S | Y |
| 3 | **Multi-seller ticket offers + price comparison** (rows 10, 13) | Ticket click-out is the revenue conversion; web shows one seller | H | M | Y (`ticket_offers`) |
| 4 | **Friends + requests + find people** (rows 7, 33, 34) | Drop's social wedge; web FAQ promises "see friends going" (app.js 2743) but no friend data exists. Gates 5-6 | H | M | Y |
| 5 | **Plans, crews, plan chat** (rows 35-37) | The "go" step of the loop; Crew Builder deep links land on web and say coming soon | H | L | Y |
| 6 | **Notifications inbox + prefs persisted** (rows 41, 45) | Return reason; toggles currently do nothing | H | M | Y (`alerts`, `notification_prefs`) |
| 7 | **Public profile + share-to-follow** (row 34) | Shared profile links dead-end on web; growth path | M | S | Y (`public_profile`) |
| 8 | **Block / report** (row 46) | App-store UGC safety parity; web has social surfaces coming | M | S | Y |
| 9 | **Show ratings, notes, tags + seen history + Drop Stats** (rows 28-30) | Post-event half of the loop; powers Wrapped | M | M | Y |
| 10 | **Recap with real photos upload + share image** (row 32) | Recap is the viral share; web has only empty slots | M | L | Partly (`recap_posts`; storage upload path to confirm) |
| 11 | **Event detail extras**: weather, venue map link, pass links, comments, setlists (rows 10, 17) | Reasons to open the page, not conversion | M | M | Y |
| 12 | **Discover map** (row 9) | Browse alt; native has it | M | L | Y (lat/lng on events) |
| 13 | **Venue/Artist detail depth**: address, capacity, fan stats, reviews (rows 18, 20) | Browse depth; much already covered by public SEO pages | L | M | Y |
| 14 | **Taste match + music connect** (rows 39, 40) | Delight, needs friends first | L | L | Y but Apple Music is N/A; do Spotify/SoundCloud only if real | 
| 15 | **Live mode + check-in** (row 24) | Used at the venue, phone-first; native wins there | L | L | Y |

Promoter and Admin screens (rows 52, 53) are deliberately not ranked: they serve few users and are better as a "use the app" message than half-built web. See next section.

## Do not chase
- **Five 1.0.4 cohort features** (Watch This Event, Crew Picks, Promoter Channels, City Watchlists, Access Guide): merged to native `main` as Train 333 after TestFlight build 29; migrations awaiting approval; no device has them (`ops/device-qa-build29-20261017.md`, `DECISIONS.md` 2026-10-13/15). Venue Intel also.
- **Drop+ checkout**: native shows "Drop+ coming soon" too (`drop-plus.tsx`). No parity to chase; remove the web "$59.99/yr" button copy instead.
- **Admin tools**: native admin screens are unverified; ticket analytics tabs show unavailable until migrations apply (`state.d/2026-10-16-train-313.md`).
- **Ticket analytics / Partnerize**, **Facebook login**, **email change (PR #984 draft)**, **Android App Links**: all gated on approvals or device checks, none on the web roadmap.
- **Gated-by-device-QA natively** (unverified on a phone, so don't treat as the reference behavior): recap photos "From that night", share PNG EXIF, activation wizard empty-state buttons, deep-link invite privacy, calendar edit sheet (all block A-I in the build-29 QA doc).
- **N/A on web**: push notifications, widgets, Live Activity, App Clip, haptics, contacts sync, photo library, camera capture, MusicKit, StoreKit, ticket-screenshot wallet. Web substitutes: share links, email, file upload.

## Design-spec stubs (visual gaps; send to the Claude design project before building)
1. **Multi-seller ticket sheet**: event detail card listing sellers with price, cheapest tag, "fees included" note, single primary button; unknown price shows "See price", never a made-up number. Mobile-first, thumb-zone CTA, reuse native Prism rows.
2. **Honest empty and "get the app" states**: replace dead Plans/Crews/Notifications/Seen screens with one pattern: what this does, a single primary button (Open in app / Download), and a secondary web action if it exists. One primary button per screen.
3. **Social surfaces on web**: Friends (find, requests), public profile, plan detail + chat as responsive two-column desktop / single column mobile, matching native density; block/report sheet. Needs a desktop layout the native app does not have.
4. **Discover map view**: map with price/date chips and selected-event card; list/map toggle, desktop split view.
5. **Recap composer + share card**: photo grid with VIDEO badge parity (video is N/A to render in canvas; spec a still-frame fallback), 9:16 share card, download and native share buttons.

## Surprises
- The web FAQ (app.js 2743) tells visitors Drop will "sync your contacts" and show "which friends are going", but no friends or contacts backend is wired and contact sync is N/A on web.
- Five toast-only "success" handlers fake an outcome (rows 15, 40, 43, 49, 52). `becomePromoter` flips a local flag so a user sees the promoter dashboard with no account change.

## Unverified
- Nothing was executed against Supabase or driven in a browser; "Present" means the table/RPC appears in app.js, not that RLS or UI works for a real user. 
- Native class is from route names, data-dependency grep and PROJECT_STATE, not from running the app. Whether the web `/event`, `/venue`, `/artist` public pages (events.html etc.) cover more than the SPA (e.g. venue address, setlists) was not checked page by page.
