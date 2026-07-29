# Drop website feature-parity plan

Status: Foundation, Discovery, and the broad visible-core parity runtime are implemented and verified on `codex/web-parity-react`; the complete current-app experience is designed and QA-verified in Claude.ai; no production cutover.

## Product contract

- `trydropapp.com` is one website with signed-out and signed-in views. The signed-in desktop view keeps the public website's Prism header, typography, spacing, and visual language.
- Web and mobile use the same production Supabase project, accounts, RLS-protected data, Edge Functions, and business rules. Web gets browser-native layouts and controls, not a stretched phone UI.
- New or reworked slices are designed and approved first in Claude.ai/design project `Website design prompt` (`5b6f000f-c206-44b6-ab8a-5981e36f2af9`).
- Browser limitations get explicit adapters or honest handoffs; the web UI must not claim an integration exists before it is wired.
- `/app/next/` is the isolated React/Vite preview. Existing production website and `/app` routes remain unchanged until the parity build is approved and verified.

## Delivery slices

1. **Foundation 1A — complete:** shared auth/session, login/signup/recovery/OAuth, compliance gate, responsive website-native shell, profile/avatar, privacy, notification preferences, music connection status, logout, and account deletion.
2. **Discovery — complete:** the isolated preview has real global catalog/search, grouped suggestions, profile/GPS location, the native launch-city radius dataset, price/genre/city filters, location-scoped Happening, follow-based For You, block-safe Crew attendance, lifecycle-aware Event Detail, Going/Interested, save/follow/calendar/share, cross-source ticket comparison, weather/presale timing, moderated comments, a connected coordinate-backed Map, and honest conditional data states. Presale code payloads require a server-enforced current-window contract before cutover.
3. **Catalog and identity:** artists, venues, taste profile, wallet, and rewards.
4. **Social/Plans core — complete:** friends, requests, privacy-safe browser search, activity, blocks/safety, crews, plans, chat, RSVP, meetup spots, and creator-scoped invites are connected. Taste match, richer reactions, contacts, and deeper realtime behavior remain specialist slices.
5. **Festival/live core — complete:** personal schedules, picks, check-ins, presence, and Live Mode are connected. Richer clash handling and offline festival behavior remain native/specialist work.
6. **Show history — complete for the current browser contract:** canonical attendance, manual history, local `.ics` review/import, logged-show detail/editing, friend tags, user/show-scoped IndexedDB media, attended-only recap authoring, Seen history, Stats drill-downs, and Wrapped are connected. Mailbox or ticket-account imports remain separate credentialed product decisions.
7. **Notifications core — complete:** shared alert history, current synthesized alerts, reminders, preferences, and retryable states are connected. Browser push waits for web subscription infrastructure.
8. **Owner/admin:** promoter and artist-owner tools, community submission, moderation, and admin surfaces.

## Current preview boundary

The source-backed trigger matrix is canonical at `docs/signed-in-route-matrix.md`; the audited story/defect inventory is canonical at `docs/qa/feature-matrix.csv`. Remaining route families are Submit Event, event-specific crew building, Tagged Shows, dedicated invites, direct Discover/Map Near me and Everywhere modes, Taste Match, activation, promoter/admin, and deeper realtime/social. These stay queued until product/security owners approve their exact contracts.

## Browser adapters

- Apple Music and SoundCloud: show shared connection state now; add browser authorization only when the provider flow is supported.
- Contacts: require the same verified-phone and hashed-contact contract as mobile; never upload a raw address book.
- Calendar: use downloadable calendar files or supported browser APIs.
- Local media: use explicit file selection and browser storage/upload rules.

## Verification gate per slice

- Approved Claude.ai/design state and paired reference/implementation screenshot review.
- Typecheck, production build, desktop Chrome and mobile Safari behavior tests.
- Independent adversarial review, accessibility basics, no fabricated data, and no horizontal overflow.
- No production route replacement until the signed-in parity checklist is complete and the founder approves cutover.
