# Decisions

## 2026-07-28 — Calendar history is local-first; only exact canonical matches auto-import

The website parses Apple/Google `.ics` exports in the browser. Before confirmation, calendar-derived show details do not leave the device. After confirmation, selected details may be used to search Drop's published archive; only one unambiguous same-day identity match is marked attended automatically. Ambiguous and unmatched entries stay unsaved for manual review.

Calendar-file copy must distinguish the local file from the selected details used for confirmed matching. Bulk import must not create public events or silently merge ambiguous history.

## 2026-07-28 — Personal show media stays device-local; recap export does not auto-publish

History photos/videos live in user- and show-scoped IndexedDB storage, with per-file and per-show limits. Account deletion purges that user's local history media from the browser. Recap export rechecks the server's consent-scoped crew result immediately before generating the image.

Creating or downloading a recap does not insert an activity post until the backend has a relationship- and privacy-scoped publishing contract. Local export is complete without public feed publication.

## 2026-07-28 — Native iOS keeps Apple Maps; web uses an attributed dark web-map provider

The native Drop app continues to use Apple Maps through its native map implementation. The signed-in website uses CARTO dark tiles with OpenStreetMap data, separate required attribution links, price pins, and a card rail containing only events that have real map coordinates.

Do not label the website map as Apple Maps unless MapKit JS is deliberately adopted with its required Apple developer token and web integration. Map-provider differences may remain platform-native; event selection, filtering, pin membership, and Drop's Prism presentation must remain behaviorally aligned.

## 2026-07-26 — Core web parity is a product surface, not an app-download penalty

The signed-in website should provide Drop's complete core jobs instead of withholding useful features to force an app download. Artificially weakening the web experience would reduce activation, sharing, search discovery, and trust.

The native app earns preference through capabilities the browser cannot match as reliably: push notifications, verified contact discovery, local-media discovery, calendar and deep-link integration, background location, offline behavior, and faster native interaction. Website prompts to install the app must be contextual to those advantages, not generic gates.

The complete current-app feature set is designed first in Claude.ai project `Website design prompt`; the founder approved isolated implementation on 2026-07-26. Work remains under `/app/next/` until the full acceptance and explicit production-cutover gates pass.

## 2026-07-22 — Website parity is shared behavior with a website-native interface

The signed-in website must expose the mobile app's supported features through the same production Supabase accounts, data, RLS, Edge Functions, and business rules. It is not a separate account system or a desktop copy of the phone layout. Desktop stays visibly continuous with the public Prism website; mobile uses compact browser-native navigation and controls.

Each new parity slice is designed and founder-approved first in Claude.ai/design project `Website design prompt` (`5b6f000f-c206-44b6-ab8a-5981e36f2af9`). The React/Vite implementation lives at isolated preview route `/app/next/`; existing production website and `/app` routes are not replaced until the full parity checklist and cutover approval are complete.

## 2026-07-18 — Hosted legal pages are canonical; embedded SPA copies are retired

`https://trydropapp.com/privacy` and `https://trydropapp.com/terms` are the canonical Privacy Policy and Terms for the website, web app, and mobile app. The SPA must link to those documents instead of maintaining an embedded duplicate. The native app may render an aligned in-app copy for review accessibility, but its version/date and disclosures must match the hosted documents and it must expose the canonical links. The `.html` URLs remain compatibility redirects, not link targets.

## 2026-07-18 — One website, two views; "marketing page" framing retired

Founder: trydropapp.com is never to be referred to as a marketing page (or landing page). It is one website with a **signed-out view** (open browse-first discovery at trydropapp.com) and a **signed-in view** (the Prism SPA at `app.trydropapp.com` / `/app`). Docs, code comments, and test names use this framing. Same day, the "✦ The EDM show discovery app" hero badge was removed from both views' signed-out heroes.

## 2026-07-08 — Website plus static browser account shell

trydropapp.com is the public browse-first website. Browser login/account access lives on `app.trydropapp.com`, served from this static website repo through the Cloudflare Worker.

The browser account shell uses Supabase Auth against the same Drop project as the native app and reads the same RLS-protected account data. It must not serve the Expo web app.
