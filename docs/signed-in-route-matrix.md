# Signed-in website route matrix

Source audit: Drop mobile `origin/main` at `62ba25546b1180969b46f423cc7f2240b9cc8140`, fetched and inspected read-only on 2026-07-29. The website routes below preserve the mobile outcome while using the existing responsive website shell.

| Area | Mobile source | Trigger | Mobile destination/result | Signed-in website route/result |
| --- | --- | --- | --- | --- |
| Shared event cards | `src/components/EventCard.tsx` | Select an event card | `/event/{event.id}` | `/event/:eventId`; website-native detail, never a poster-card enlargement |
| Discover | `app/(tabs)/index.tsx` | Map, notifications | `/discover-map`, `/notifications` | `/map`, `/notifications` |
| Discover | `app/(tabs)/index.tsx`, `app/submit-event.tsx` | Submit event | `/submit-event`; validated event form, pending-review write, real submission/reward status | Not yet implemented in the React preview; tracked below rather than linked to a fake action |
| Discover | `app/(tabs)/index.tsx` | Crew member, invite | `/profile/{id}`, `/invite-friends` | `/profile/:profileId`, Friends invite controls |
| Discover | `app/(tabs)/index.tsx` | Genre, artist, venue, festival, event | Search query, entity detail, `/schedule/{id}`, event detail | `/search?q=…`, `/artist/:artistId`, `/venue/:venueKey`, `/schedule/:eventId`, `/event/:eventId` |
| Location | `app/(tabs)/index.tsx`, `app/discover-map.tsx` | Type/select city, current location, everywhere | Updates the active city/filter and reloads results | Shared searchable profile picker covers supported cities; “Use another city” accepts an arbitrary profile city; Search can use browser location or all cities. Direct Discover/Map “Near me” and “Everywhere” modes remain the audited gap below |
| Search | `app/(tabs)/search.tsx` | Artist, venue, event suggestion/result | `/artist/{id}`, `/venue/[key]`, `/event/{id}` | `/artist/:artistId`, `/venue/:venueKey`, `/event/:eventId` |
| Search | `app/(tabs)/search.tsx` | City or genre suggestion | Applies a search filter; no entity route | Shared searchable city/genre filters update `/search` query state |
| Map | `app/discover-map.tsx` | Marker, selected card, result row | Selects the event, then `/event/{id}` | Working browser map marker/card opens `/event/:eventId` |
| Event detail | `app/event/[id].tsx` | Going, Interested, Save | Persists attendance/saved state | Same persisted actions on `/event/:eventId` |
| Event detail | `app/event/[id].tsx` | Existing plan, build crew | `/plan/{id}`, `/crew-builder/[eventId]` | Existing plan opens `/plan/:planId`; event-specific crew builder is not yet implemented in the React preview |
| Event detail | `app/event/[id].tsx` | Venue, lineup artist | `/venue/[key]`, `/artist/{id}` | `/venue/:venueKey`, `/artist/:artistId` |
| Event detail | `app/event/[id].tsx` | Live, schedule, recap, review/history | `/live/{id}`, `/schedule/{id}`, `/recap/{id}`, `/show/{id}?kind=event` | `/live/:eventId`, `/schedule/:eventId`, `/recap/:eventId`, event or linked show detail |
| Event detail | `app/event/[id].tsx` | Ticket offer | Opens the sanitized wrapped external seller URL | Opens the sanitized external seller URL in a new tab with safe rel attributes |
| Artist | `app/artist/[id].tsx` | Upcoming event | Event detail | `/event/:eventId` |
| Artist seen history | `app/artist/[id].tsx`, `app/seen-history.tsx` | History / artist row | `/seen-history?artistId=…`; shows that artist’s attended/logged nights | `/history/artist/:artistId`; real history only, each show opens its event/show detail |
| Venue | `app/venue/[key].tsx` | Venue profile, upcoming show | Venue detail; show opens event | `/venue/:venueKey`; profile, follow state, upcoming events |
| Venue seen history | `app/venue/[key].tsx`, `app/seen-history.tsx` | See all visits / visit row | `/seen-history?venueName=…`; visit opens event/show detail | `/history/venue/:venueKey`; real visits only, each row opens event/show detail |
| Seen history | `app/seen-history.tsx` | Show row | `/show/{loggedId}?kind=logged` or `/show/{eventId}?kind=event` | `/show/:showId` when a linked memory exists, otherwise `/event/:eventId` |
| My Shows | `app/(tabs)/shows.tsx` | Plans, Wrapped, Stats, log/import | `/plans`, `/wrapped`, `/drop-stats`, `/log-show`, `/import-shows` | `/plans`, `/wrapped`, `/stats`, `/log-show`, `/import-shows` |
| My Shows | `app/(tabs)/shows.tsx` | Past logged/attended show | Show detail with logged/event kind | Linked `/show/:showId` or `/event/:eventId` |
| Drop Stats | `app/drop-stats.tsx` | Shows tile or show row | Ranked/list sheet; `show.href` opens its event/show | `/history` and linked event/show rows |
| Drop Stats | `app/drop-stats.tsx` | Artists tile, top artist, artist row | Artist ranking; `/seen-history?artistId=…` | `/history/artist/:artistId`, not generic artist marketing |
| Drop Stats | `app/drop-stats.tsx` | Top venue | `/venue/[key]`, whose visits open seen history | Direct `/history/venue/:venueKey` per the website parity correction |
| Drop Stats | `app/drop-stats.tsx` | Genres, crews, Wrapped | Filtered show list, `/crews`, `/wrapped` | Interactive filtered history, `/crews`, `/wrapped` |
| City history | `app/drop-stats.tsx`, `app/seen-history.tsx` | No current native city ranking/history route | The current app has no city-history mode | `/history/city/:cityKey` is the requested website extension; it filters the same real attended/logged history and does not redirect to future events |
| Friends | `app/(tabs)/friends.tsx` | Plans, crews, activity, person | `/plans`, `/crews`, `/crew-activity`, `/profile/{id}` | `/plans`, `/crews`, connected activity, `/profile/:profileId`; friend/request actions remain inline |
| Friends | `app/(tabs)/friends.tsx` | Tagged shows, taste match, dedicated invite | `/show-tags`, `/taste-match/{id}`, `/invite-friends` | Not yet implemented as equivalent React routes; tracked below rather than redirected to unrelated screens |
| Public profile | `app/profile/[id].tsx` | Going/past event, taste match | Event detail, `/taste-match/{id}` | Event rows open `/event/:eventId`; Taste Match remains an audited gap |
| Plans | `app/plans.tsx`, `app/plan/[id].tsx` | Plan card, event card | `/plan/{id}`, `/event/{id}` | `/plan/:planId`, `/event/:eventId` |
| Plan detail | `app/plan/[id].tsx` | Status, meet spot, chat, invite, share, leave | Mutates the active plan or invokes share | Same real plan mutations in `/plan/:planId` |
| Crews | `app/crews.tsx` | Create/edit/delete/invite crew | Inline crew management; Drop+ gate where applicable | Same real crew controls in `/crews` |
| Festivals | `app/(tabs)/index.tsx`, `app/schedule/[eventId].tsx` | Festival banner/day/tab/star set | `/schedule/{id}`; schedule filtering and star state | `/schedule/:eventId`; day tabs and schedule state |
| Live mode | `app/live/[eventId].tsx` | Check in, star set | Mutates live/check-in state | `/live/:eventId`; real conditional state |
| Notifications | `app/notifications.tsx` | Plan notification; event/comment/friend-going notification | `/plan/{planId}` or `/event/{eventId}` | `/plan/:planId` or `/event/:eventId` |
| Profile | `app/(tabs)/profile.tsx` | Shows, artists, friends, going, Wrapped, Stats | Past My Shows, following, Friends, going, `/wrapped`, `/drop-stats` | `/shows`, artist/friend/profile destinations, `/wrapped`, `/stats` |
| Profile/settings | `app/(tabs)/profile.tsx`, `app/settings.tsx` | Edit, notifications, reminders, wallet, blocked, delete, legal | Corresponding settings/utility flow | `/profile`, `/settings`, `/notifications`, `/reminders`, `/wallet`, `/blocked`; existing account deletion/legal links |

## Audited gaps after this correction slice

The matrix is intentionally explicit where a current native destination still lacks an equivalent React route. The remaining gaps are Submit Event, the event-specific crew builder, tagged-show history, dedicated invites, Taste Match, direct Discover/Map “Near me” and “Everywhere” location modes, and the already-backlogged activation/promoter/admin/deeper-social specialist work. None is represented by a demo route or an unrelated redirect.

## Browser map boundary

The current iOS app uses `react-native-maps` with Apple Maps; Android intentionally shows an iOS-only fallback, and React Native web cannot render that native provider. The website’s existing CARTO raster map is a working browser path with OpenStreetMap/CARTO attribution. Apple MapKit JS would require an approved token/service decision, so the preview keeps the working map and does not display a fake Apple or blank OpenStreetMap placeholder.
