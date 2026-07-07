# The AXS model — how trydropapp.com must behave

**Decision (2026-07-06, founder):** trydropapp.com is **NOT a marketing page**. It is Drop's
**pre-login browse-first discovery site**, modeled on how **axs.com** behaves before and after login.
Content is the hero — not a pitch. This doc is the spec to copy; the visual system is `../drop-design`
(the canonical web shell) and the signed-in surface is the app at `/app`.

Investigated live on axs.com (Fable, 2026-07-06): homepage, event-detail, search bar, login gates.

## AXS before login (what a signed-out visitor gets — copy this)

Everything is browsable with **no account**. The only auth affordance is a **"Sign In"** pill
top-right. Login gates **purchase/account only**, never browsing.

1. **Header** — logo left; right side = language + **Sign In** pill. That's it. No marketing nav.
2. **Unified search bar, pinned under the header** — three segments in one pill:
   **Search** (events / performers / venues) · **Dates** (Any time / date picker) ·
   **Location** (city, defaults to the visitor's area) + a search button. This is the primary action.
3. **Homepage = a stack of discovery rails**, not a landing page:
   - **Featured** carousel — large image cards, "Starting THU JUL 30" date kicker + bold title,
     ‹ › arrows + dot bullets.
   - **"Events Happening"** — time-filter pill tabs (**Today · This Weekend · Next 30 Days**,
     selected = filled) → horizontal card rail.
   - **"Just Announced"** rail.
   - **Category rails**: Music · Sports · Arts & Family (Drop's equivalent: EDM genre rails —
     House / Techno / Dubstep / DnB …).
   - Every card is an image-forward tile with the title + date overlaid on the image, linking
     straight to an open event page.
4. **Event detail (open, no login)** — date/time, artist + support lineup, venue + city + ages,
   an **Available Offers** list (Tickets / Resale / VIP / Premium / Parking / Rides …), doors time,
   venue address + Get Directions, nearby amenities, and an **app cross-promo** ("Get in with the app").
5. **Login is only required to buy** (Get Tickets → checkout) — never to browse, search, or open an event.

## AXS after login (inferred — not verified; no AXS account used)

The **Sign In** pill becomes an **account menu**; the browse experience is unchanged, plus:
- Saved / favorited events, "My Events", ticket wallet (mobile tickets), transfer-to-friends,
  purchase history, personalized recommendations.
For Drop this is exactly the **signed-in app shell at `/app`** — which already exists and already
carries Drop's differentiator: the **social wedge** ("who's going", crew, Going/Interested).

## Drop = AXS browse pattern + the social layer

Copy AXS's browse-first structure verbatim for the pre-login site; layer Drop's social wedge on top
(friends-going chips, crew rail) the way the `/app` Discover already does. The pre-login site and the
signed-in app should read as **one product**, same as AXS → one wordmark (`◦ drop`), one dark shell,
the same 300×340 image-forward cards (`../drop-design` `.wsc`), the same search+dates+location bar.

## What this replaces on trydropapp.com

The current homepage marketing hero ("Find the shows your friends are going to" + pitch copy +
waitlist framing) is **retired** in favor of the AXS discovery stack: search bar → featured →
Happening (Today/This Weekend/Next 30 Days) → genre rails, all open. Keep the SEO value (static,
crawlable pages), drop the "marketing landing" framing.

## Build checklist (next session — not done here)

- [ ] Homepage: replace hero+waitlist with the AXS discovery stack (search bar pinned, featured
      carousel, Events-Happening time tabs, genre rails). Keep it static/SEO-friendly.
- [ ] Wordmark → `◦ drop` (match the app) across the site.
- [ ] Event pages: AXS-style open detail (lineup, venue, offers, directions) — Drop already has
      `event.html`; align to the offer-list + app-promo pattern.
- [ ] Nav: collapse the marketing nav (For Promoters/About stay in footer); lead with Sign In +
      the search bar, AXS-style.
- [ ] Social wedge on cards/rails (friends-going, crew) so it's Drop, not a plain AXS clone.
