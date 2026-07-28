# Drop website feature-parity plan

Status: Foundation 1A and Discovery 2A are implemented and verified on `codex/web-parity-react`; the complete current-app experience is designed and QA-verified in Claude.ai; no production cutover.

## Product contract

- `trydropapp.com` is one website with signed-out and signed-in views. The signed-in desktop view keeps the public website's Prism header, typography, spacing, and visual language.
- Web and mobile use the same production Supabase project, accounts, RLS-protected data, Edge Functions, and business rules. Web gets browser-native layouts and controls, not a stretched phone UI.
- New or reworked slices are designed and approved first in Claude.ai/design project `Website design prompt` (`5b6f000f-c206-44b6-ab8a-5981e36f2af9`).
- Browser limitations get explicit adapters or honest handoffs; the web UI must not claim an integration exists before it is wired.
- `/app/next/` is the isolated React/Vite preview. Existing production website and `/app` routes remain unchanged until the parity build is approved and verified.

## Delivery slices

1. **Foundation 1A — complete:** shared auth/session, login/signup/recovery/OAuth, compliance gate, responsive website-native shell, profile/avatar, privacy, notification preferences, music connection status, logout, and account deletion.
2. **Discovery 2A — complete:** the isolated preview has real global catalog/search, grouped suggestions, profile/GPS location, the native launch-city radius dataset, price/genre/city filters, location-scoped Happening, follow-based For You, block-safe Crew attendance, lifecycle-aware Event Detail, Going/Interested, save/follow/calendar/share, cross-source ticket comparison, weather/presale timing, moderated comments, and honest conditional data states. Presale code payloads require a server-enforced current-window contract before cutover. Map remains deferred to Discovery 2B; do not ship a placeholder.
3. **Catalog and identity:** artists, venues, taste profile, wallet, and rewards.
4. **Social/Plans — design complete, implementation next:** approved desktop/mobile states cover friends, requests, browser search/invite, honest native-only contact matching, activity, reactions, taste match, blocks/safety, crews, plans, realtime chat, and event comments.
5. **Festival/live:** personal schedules, picks, clash detection, check-ins, and meetups.
6. **Show history:** archive/manual/calendar/ticket imports, full lineups, local media, recaps, seen history, stats, Wrapped, and tags.
7. **Notifications:** shared preferences plus browser push/reminders only after the web subscription infrastructure exists.
8. **Owner/admin:** promoter and artist-owner tools, community submission, moderation, and admin surfaces.

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
