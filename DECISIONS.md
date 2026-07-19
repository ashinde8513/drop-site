# Decisions

## 2026-07-19 — Event artwork uses a contained Prism Gallery stage

Event Cards keep one fixed outer size and separate media and metadata regions. Public and signed-in cards use a 300×360 shell with a 220px media stage; normalized genre and price stay in metadata, with no card-level actions. Artwork renders once with `contain` over the existing event-derived Prism gradient, so portrait posters, square art, and wide banners remain fully visible without cropping, distortion, or a duplicate blurred decode. This is a visual contract only: event loading, fallback selection, caching, sorting, filtering, navigation, RSVP, and analytics behavior stay unchanged.

Cards do not expose Going, Interested, or Share. All three actions are available only after the user opens Event Detail.

## 2026-07-17 — Past-show records use shared canonical events

Manual and ticket-prefilled past shows write through the backend `record_past_show` RPC. The reusable event and lineup are shared; notes stay private. Date plus normalized title selects candidates, description disambiguates when available, and venue/city are confirmation context rather than identity. A differing lineup performs no write until the fan explicitly combines or keeps the shows separate. Unknown artist names remain moderated lineup suggestions. Existing catalog duplicates are not silently rewritten by this user flow; a future admin reconciliation must repoint all dependent records safely.

## 2026-07-08 — Website plus static browser account shell

trydropapp.com is the public browse-first website. Browser login/account access lives on `app.trydropapp.com`, served from this static website repo through the Cloudflare Worker.

The browser account shell uses Supabase Auth against the same Drop project as the native app and reads the same RLS-protected account data. It must not serve the Expo web app.
