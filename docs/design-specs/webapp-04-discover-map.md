# Spec 04: Discover map

Status: prepared, awaiting design. Written 2026-10-19. Docs only, nothing built.

## Claude design project header
- Project: **Drop Website** (`5b6f000f-c206-44b6-ab8a-5981e36f2af9`)
- Suggested screen names: `Discover / Map split (desktop)`, `Discover / Map (mobile)`, `Discover / Map states` (loading, warming up, error, no results).
- Extends: the existing DISCOVER (signed-in) screen in `index.html`: adds a List / Map toggle next to the date and location chips. Reuses `.seg`, `.chip`, `.locchip`, `.ec` (compact), `.skel`, `.empty`.

## Purpose and user value
Ranked table #12: a browse alternative for people who think in places, value Medium, effort Large. Native has a map (screen 49). It helps someone new to a city see what is near, and a map is also a visually strong share.

## Backend contract that already exists
- Table `events` has `lat` and `lng` (native maps them via `lat: row.lat`). Native's `listEventsWithCoords()` returns upcoming events that have real venue coordinates.
- IMPORTANT, from native source: most rows are **null today**; coordinates have not been backfilled. The map can legitimately have zero pins. The native screen falls back to a "warming up" empty state plus the List toggle. The web design must lead with this state, not treat it as an edge case.
- Events are publicly readable (anon and authenticated SELECT; the web already reads them through `data.js` REST). Price comes from `events` fields and `ticket_offers` (see spec 01); the price chip may be absent.
- `event_going_counts` RPC supplies "going" counts the web already uses.
- No map provider is chosen or contracted. The tile provider, key, and cost are a **decision for the founder/build lane**. Design must work with any raster/vector provider and must include required attribution.

## States
1. **Loading**: map area shows a flat `--surface-alt` block with the shimmer from `.skel`, plus a skeleton list rail (3 compact card skeletons, `skel--card` at 96px height). No spinner.
2. **Warming up (no coordinates)**: no map canvas; instead a calm panel (see copy) and the list view is shown. This is the default design frame, not an error.
3. **Partial coverage**: map shows pins only for events with coordinates; a small notice chip "Showing {n} of {total} shows with a map location." is truthful and visible.
4. **Success**: pins, price/date chips on pins (see below), selected-event card.
5. **No results in view** (user panned): "No shows in this area." with ghost "Zoom out".
6. **Error**: `role="alert"` card "We couldn't load the map." with ghost "Try again" and the List view still working.
7. **Location permission**: the page never asks for location on load. Tapping "Near me" asks; denial shows "Location is off. Pick a city instead." with a link to the city selector. Never block the map on permission.

## Layout, desktop (1024 and up)
- Discover header unchanged. Add a `.seg` toggle with two items: "List" and "Map" (2 options shown inline).
- Map view is a split: left rail about 400px with scrollable compact event cards (`.ec` compact variant: 96px image, title, date, venue, price), right map fills the rest. Gutter between them `var(--sp-lg)`. Rail and map share the same top and bottom edges.
- Map canvas radius `var(--r-lg)` (20px) with 1px `--border`; the inner floating controls (zoom, "Near me") use radius `var(--r-md)` (14px), concentric.
- Pins: circular markers, 32px, filled with the event status color only when the user has a status (Going magenta, Interested cyan) otherwise `--surface-hi` with a white ring; the pin label chip shows the date short form ("Fri 24") or the price ("$45") depending on the active chip. A "Price / Date" toggle `.seg` floats top-left of the map (2 options). Missing price shows the date, never a guess.
- Selected pin enlarges and its card in the rail highlights (`--accent` border) and scrolls into view. Clicking a rail card centers the pin.
- Floating selected-event card (map overlay, bottom-left, max 320px): image 64px, title, date, venue, one primary button "View event". The only primary button in this view; rail cards have no buttons, they are links.
- Filters row above the map reuses the existing date chips and the city chip; the range slider rule applies if price filtering is added later (out of scope now).
- Attribution text from the tile provider bottom-right of the map in `--fs-xs`, at least 4.5:1 against the map.

## Layout, mobile (430 and below)
- Full-bleed map under the sticky header and chips; the toggle "List / Map" is in the header (2-option `.seg`).
- Bottom sheet over the map: collapsed state shows a handle and "{n} shows" count; dragging up shows the event rail as a vertical list. Selecting a pin shows one compact card in the sheet with the primary "View event" button, in the thumb zone above the tab bar.
- Map controls: "Near me" and zoom as two 44px circular buttons at the right, above the sheet.
- Price/Date toggle moves into the chip row above the map.
- Warming-up state: panel centered with the List already below.

## Copy
- Toggle: "List", "Map"
- Chip toggle: "Price", "Date"
- Button: "View event"; "Near me"; "Zoom out"; "Try again"
- Warming up: title "Map is warming up", body "We're still adding locations for shows near you. Browse the list for now." primary "Show the list".
- Partial: "Showing {n} of {total} shows with a map location."
- Empty area: "No shows in this area."
- Location denied: "Location is off. Pick a city instead."
- Error: "We couldn't load the map."
- Count: "{n} shows" (use the real number; "1 show" singular).

## Accessibility
- A map is not accessible by itself: the rail/list IS the accessible equivalent and must be reachable by keyboard and screen reader and hold the same set of events. Provide a skip link "Skip map" before the canvas.
- Pins are focusable (roving tabindex), have names like "Friday 24 Oct, Artist at Venue, $45", and Enter activates the same selection as the rail. Arrow keys pan only when the canvas itself has focus; Escape returns focus to the toggle.
- Price/Date chip text on pins must be at least 4.5:1 against the pin fill (`--ink` text on a `--surface-hi` or white pin, or white on `--ink`; ink on lime is 16.2:1).
- Do not use color alone for status; selected pins also grow and show a ring.
- Reduced motion: no pin bounce, no animated fly-to; jump instead (tokens.css already disables motion under `prefers-reduced-motion`).
- Touch targets at least 44px, including pins when zoomed out (cluster rather than shrink).
- Clusters announce their count and expand on activation.

## Out of scope
- Routing, directions, transit, parking.
- Heat maps, venue pages on the map, drawing a search area.
- Backfilling coordinates (data/ingestion lane).
- Choosing and paying for the map provider.
- Live traffic or "happening now" layers.
- Saving map searches.

## Acceptance checklist
- [ ] Desktop split and mobile bottom-sheet frames exist for loading, warming up, partial, success, no results, error, location denied.
- [ ] The "warming up" frame is complete, since it is today's real state.
- [ ] One primary button ("View event") per frame.
- [ ] Mobile primary button sits in the thumb zone.
- [ ] Toggle options (List/Map, Price/Date) are visible inline, not dropdowns.
- [ ] Skeleton shapes match the rail cards and map area.
- [ ] Radii nest (canvas 20, controls 14).
- [ ] Grid gap between rail and map equals the page gutter.
- [ ] Every pin label falls back to the date when price is unknown.
- [ ] List view holds the identical event set (accessible equivalent).
- [ ] Attribution space reserved and legible.
- [ ] No fake pins or counts.
