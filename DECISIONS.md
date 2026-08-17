# Decisions

## 2026-08-17 — Browser share attribution is bounded and private by default

Canonical redirects and public-to-account handoffs preserve only UUID referrer/target, route-derived event/plan/signup kind, and the fixed source catalog shared with mobile and the database. Browser pending state is first-touch, expires after 24 hours, and may survive sanctioned signup callbacks only in the same browser through local storage; a fresh-browser email confirmation deliberately fails closed without referral credit. Eligible same-browser state records only after compliance through an authenticated RPC that derives the signed-in account.

Referral credit also requires the account creation timestamp to follow the captured link open. Existing accounts and malformed timestamps fail closed, and Auth user metadata does not duplicate referral or private plan targets because bounded pending state plus the RPC/table are authoritative.

Plan fallbacks retain the plan UUID for authenticated continuation but render no roster, meetup, friend, venue, event, or date values from public query parameters. Android association uses only apex `trydropapp.com` and the exact current Google Play App Signing fingerprint for `app.resonanceventures.drop`; debug, guessed, placeholder, or upload-key fingerprints are prohibited. This public-certificate contract does not authorize credential creation, a build, or a Play release.

## 2026-08-12 — Explicit phone attestation, not compatibility `complete`, gates browser accounts

The standalone website treats authenticated `signup_compliance_status` with
`profile_complete:true` and `phone_verified:false` as phone-required even while
the compatibility migration leaves `complete:true` and server enforcement off.
This lets clients ship first without stranding older website builds. Legacy
payloads without the new fields keep their previous complete/incomplete routing.

Required mode has no skip path and unlocks Discover only after a fresh server
attestation following successful OTP proof. Password recovery, sign-out, and
account deletion remain explicit exceptions. Raw phone/code values stay
browser-memory-only and are cleared on success, change, or logout; duplicate
numbers use generic unavailable copy.

## 2026-08-09 — App Store claims follow the listing compatibility label

User-facing availability copy must match Apple's current product-page
compatibility label. Drop is therefore described as available for iPhone while
the listing says “Only for iPhone.” iPad user-agent routing may still open the
same official App Store destination; routing a device to the listing is not an
iPad compatibility claim. Use Apple's official unmodified badge and the exact
product URL rather than recreating badge artwork or maintaining a waitlist.

## 2026-08-02 — Ordinary authorized website changes finish through live QA

An ordinary website code/content request authorizes the complete guarded release lane by default: implementation, verification, commit/push, PR, exact-head CI, merge, the existing `main` Test & Deploy workflow, live QA, and honest repo closeout. Stop earlier only when the user explicitly asks for a draft, local-only work, a pause, or narrower delivery.

This does not broaden authority for production database mutations, secrets, destructive actions, external outreach/submissions, manual or break-glass deploys, Worker deploys, or new scope. Those keep their separate approval gates. Routine production delivery remains the repository's automatic GitHub Actions path and must not use a manually supplied Cloudflare token.

## 2026-08-02 — Public entity URLs use stable IDs plus readable slugs

Canonical public discovery URLs are `/event/<uuid>/<slug>`, `/venue/<uuid>/<slug>`, and `/artist/<uuid>/<slug>`. The UUID is identity; the slug is readable and may change, so mismatched or missing slugs redirect permanently to the current canonical path. Pages and sitemaps are generated only from real published catalog rows. Traffic work must never create fake events, reviews, attendance, or social proof. Legacy query-string detail URLs remain compatibility entry points while internal links and shares use canonical paths.

Index eligibility fails closed. Events require a valid UUID, title, start date, canonical venue UUID/name, and either a street address or city plus state. Venues need that identity/location plus two valid upcoming events. Artists need a valid identity plus two valid upcoming events, or one valid event and real profile material (genre, image, or website). Thin venue/artist pages remain useful direct destinations but receive `noindex, follow` and stay out of the sitemap.

Structured ticket claims come only from catalog status fields. `scheduled`, `cancelled`, and `postponed` map to their matching Schema.org event states; `available`, `sold_out`, and `unavailable` map to `InStock`, `SoldOut`, and `OutOfStock`. `unknown` and `rsvp` intentionally omit Offer availability. A ticket URL alone is never evidence that inventory is available, and visible status/CTA language must match the structured data.

## 2026-07-18 — Hosted legal pages are canonical; embedded SPA copies are retired

`https://trydropapp.com/privacy` and `https://trydropapp.com/terms` are the canonical Privacy Policy and Terms for the website, web app, and mobile app. The SPA must link to those documents instead of maintaining an embedded duplicate. The native app may render an aligned in-app copy for review accessibility, but its version/date and disclosures must match the hosted documents and it must expose the canonical links. The `.html` URLs remain compatibility redirects, not link targets.

## 2026-07-18 — One website, two views; "marketing page" framing retired

Founder: trydropapp.com is never to be referred to as a marketing page (or landing page). It is one website with a **signed-out view** (open browse-first discovery at trydropapp.com) and a **signed-in view** (the Prism SPA at `app.trydropapp.com` / `/app`). Docs, code comments, and test names use this framing. Same day, the "✦ The EDM show discovery app" hero badge was removed from both views' signed-out heroes.

## 2026-07-08 — Website plus static browser account shell

trydropapp.com is the public browse-first website. Browser login/account access lives on `app.trydropapp.com`, served from this static website repo through the Cloudflare Worker.

The browser account shell uses Supabase Auth against the same Drop project as the native app and reads the same RLS-protected account data. It must not serve the Expo web app.
