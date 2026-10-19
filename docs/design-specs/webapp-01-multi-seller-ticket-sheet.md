# Spec 01: Multi-seller ticket sheet

Status: prepared, awaiting design. Written 2026-10-19. Docs only, nothing built.

## Claude design project header
- Project: **Drop Website** (`5b6f000f-c206-44b6-ab8a-5981e36f2af9`)
- Suggested screen names: `Event Detail / Tickets card (desktop)`, `Event Detail / Tickets sheet (mobile)`, `Event Detail / Tickets states`
- Extends: the existing Event Detail screen (`index.html`, section "EVENT DETAIL"). Replaces the current single-seller "Tickets" block (lines ~509-524, "Get tickets" secondary button plus the "only site currently selling" note), the inline primary button (~564) and the mobile bottom bar button (~583).

## Purpose and user value
Ticket click-out is Drop's revenue conversion. Today the web shows one seller and one link. Native shows every seller and a price comparison. Ranked gap #3: value High, effort Medium, backend ready. A person deciding where to buy should see every seller, the price each one shows, and which is cheapest, then tap one clear button.

## Backend contract that already exists
- Table `public.ticket_offers`. Native selects `url, vendor, price_min, price_max, currency` as part of the event card (`EVENT_CARD_SELECT` in drop-mobile-app `DropApp/src/data/index.ts`) and `select('*')` on the detail screen.
- Native `getTicketOffers(eventId)` reads offers for the event AND for "comparable" events (same show listed by other sellers, via `getComparableEventIds`, canonical venue identity migration `20260719171022`). It vets every URL before showing it and keeps a usable same-seller link over a rejected one. The web build must apply the same rules or read through the same helper logic.
- Legacy fallback: `events.ticket_url` (the only thing the web uses today).
- Access: `ticket_offers` is in the deleted-session access guard list (public read of catalogue tables). The web live-grants doc does NOT list `ticket_offers`, so anon/authenticated SELECT and RLS are **unverified** for the web client. Reviewer: do not assume it works until the build lane confirms with a read-only query.
- Column details beyond the five above (fees, "all-in" flag, source_providers, availability) are **unverified**; design must not depend on them. Design assumes price may be missing, min only, or a min to max range.
- Affiliate note: footer already says "Drop may earn a commission on ticket links." Keep that line visible near the sheet.

## States
1. **Loading**: skeleton in the exact shape of the loaded card: card title bar (`skel--title`, 40% wide), then three seller rows each made of a circle (`skel--avatar`), two text lines (`skel--text` 55% and 30%) and a right-aligned price bar. No spinner.
2. **Multiple sellers (success)**: rows sorted cheapest known price first; unknown-price rows after, in stable order. Cheapest known row carries a "Cheapest" tag. Primary button acts on the cheapest known row, or the first row if none has a price.
3. **One seller**: one row, no "Cheapest" tag, no comparison language. Note: "Only one seller lists this show right now."
4. **No seller**: no rows. Message "No tickets listed yet." Body: "Sellers appear here as they list this show." Button: "Follow this event" is NOT offered (no backing feature on web); show only a ghost button "Check the venue site" if the venue has a website, otherwise no button.
5. **Sold out / ended**: if the event date has passed, replace the card with "This show has ended." and no buttons.
6. **Error**: inline row at card top, `role="alert"`, text "We couldn't load sellers." and ghost button "Try again". If the old single `ticket_url` exists, still show it as one row so the user is never blocked.
7. **Price unknown**: the right side shows "See price", never a guessed number.

## Layout, desktop (1024 and up)
Event Detail is already two columns. The Tickets card lives in the right/sticky column under the date and venue block.
- Container: existing card look (`background: var(--surface)`, `1px solid var(--border)`, `border-radius: var(--r-lg)`, padding `var(--sp-lg)`).
- Card title: `.sec__title`, text "Tickets".
- Seller rows: a list, row gap `var(--sp-sm)` (8px), same gap everywhere in the list. Each row is a nested box with `border-radius: var(--r-md)` (14px, smaller than the 20px card, concentric), background `var(--surface-alt)`, `1px solid var(--border)`, padding `var(--sp-md) var(--sp-lg)`.
- Row content left to right: seller name (display font, `--fs-md`, bold), under it a small caption (`--fs-xs`, `--text-secondary`) such as "Official seller" ONLY if the data says so, otherwise omit. Right side: price as the largest, boldest element in the row (display font, `--fs-lg`, bold, `--text`), label "from" or "to" tiny and muted above it (data hierarchy rule: value big, label small).
- "Cheapest" tag: existing `.statuschip` style with the `--attended` (lime) tint, text "Cheapest". Not a second button.
- Selected/primary row: a thin `--accent` border; the rest stay `--border`. Arrow-key or click selects.
- Below the list: one primary button `.btn.btn--primary.btn--block`, label "Buy on {Seller}" (for example "Buy on Ticketmaster"). This is the ONLY primary button in the card. Rows are not buttons styled as primary; each row also has a small ghost action "Open" (`.btn--ghost.btn--sm`) only if the reviewer wants direct per-row buy; default is selecting a row then pressing the primary button.
- Beneath the button: `--fs-xs`, `--text-muted`-or-better caption: "Prices are what each seller shows us. Fees may be added at checkout. Drop may earn a commission." (Use `--text-secondary` if contrast on the surface is below 4.5:1; see spec 06.)
- Keep the existing "Add to calendar" and "Share" buttons secondary and outside this card.

## Layout, mobile (430 and below)
- The card becomes full-width in the content flow (16px side gutters) showing the same rows, with row gap 8px.
- The primary button moves into the existing mobile bottom bar (`ed-bottombar__tickets`) so it sits in the thumb zone. Its label changes live with the selected row: "Buy on {Seller}". There is no second primary button on the page.
- If there are more than 3 sellers, show 3 rows and a ghost text button "Show all {n} sellers" that expands the list in place (the "read more" rule, not a new page).
- Optional tablet/phone sheet variant: tapping the bottom bar when nothing is selected opens a bottom `.sheet` (handle, title "Choose where to buy", the rows, then the primary button). Designer decides; the default is inline rows plus bar.

## Copy
- Card title: "Tickets"
- Tag: "Cheapest"
- Unknown price: "See price"
- Price range: "$45 to $60"; single price: "$45"
- Primary: "Buy on {Seller}"
- Expander: "Show all {n} sellers" / "Show fewer"
- One seller note: "Only one seller lists this show right now."
- Empty: title "No tickets listed yet." body "Sellers appear here as they list this show."
- Ended: "This show has ended."
- Error: "We couldn't load sellers." Retry: "Try again"
- Footnote: "Prices are what each seller shows us. Fees may be added at checkout. Drop may earn a commission on ticket links."
- Do NOT use "fees included" unless the data explicitly says so for that row. If a row has that flag, show a small caption "Fees included" under the price.

## Accessibility
- Rows form a radio group (`role="radiogroup"` with an accessible name "Ticket sellers"); each row is `role="radio"` with a name of "{Seller}, {price or price not listed}, cheapest" as applicable. Arrow keys move selection. Visible focus ring uses the existing focus style.
- The primary button's accessible name matches its visible label.
- Price is real text, not an image. "Cheapest" is text, not color alone.
- Contrast targets: body text 4.5:1 minimum, large text and UI borders 3:1. Use `--text` and `--text-secondary` on `--surface-alt` (both well above 4.5:1; `--text-muted` on `--surface-alt` is 4.43:1 and FAILS, so do not use it for the footnote there).
- Touch targets at least 44px tall; rows are at least 56px tall.
- Outbound links open in a new tab with `rel="noopener sponsored"`; announce "opens in a new tab" in the button's accessible description.
- Loading skeleton has `aria-busy="true"` on the card and a visually hidden "Loading sellers".

## Out of scope
- Price history, price alerts, on-sale reminders (web push not built).
- In-app checkout or any payment.
- Fee calculation or any invented "all-in" price.
- Seat maps, quantity pickers, wallet.
- Seller logos unless the build lane confirms licensed assets; default is name text.

## Acceptance checklist
- [ ] Desktop and mobile frames exist for: loading, 3+ sellers, 1 seller, no sellers, ended, error, unknown price.
- [ ] Exactly one primary button per frame.
- [ ] Button label names the seller and the action.
- [ ] Mobile primary button is in the bottom bar (thumb zone).
- [ ] Skeleton matches the loaded row shape.
- [ ] Price is the largest element in each row; labels are small and quiet.
- [ ] Row radius (14px) is smaller than card radius (20px); row gaps are all 8px.
- [ ] Every muted text pair is at least 4.5:1 (checked against `--surface-alt`).
- [ ] No invented prices, sellers, or "fees included" claims in any frame.
- [ ] More than 3 sellers collapses with "Show all {n} sellers".
