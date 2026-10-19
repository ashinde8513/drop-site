# Spec 05: Recap composer and share card

Status: prepared, awaiting design. Written 2026-10-19. Docs only, nothing built.

## Claude design project header
- Project: **Drop Website** (`5b6f000f-c206-44b6-ab8a-5981e36f2af9`)
- Suggested screen names: `Recap / Were you there gate`, `Recap / Composer (desktop)`, `Recap / Composer (mobile)`, `Recap / Share card 9x16 (still frames)`, `Recap / Public share page (real data)`, `Recap / States`.
- Extends: existing POST-SHOW RECAP screen (gate plus "Build your recap" builder with four `image-slot` cells and a sticky 9:16 preview) and SHARED RECAP (public) page, both in `index.html`. Reuses `.btn`, `.sec__title`, `.skel`, `.toast`, `.statuschip`. Share/download pattern already exists for Wrapped (canvas PNG via `renderWrappedCard`, native share sheet where available, copy-link fallback), which this spec should match.

## Purpose and user value
Ranked table #10: the recap is Drop's viral share (value Medium, effort Large, backend "partly"). Today the web builder shows empty photo placeholders and the preview card is hard-coded sample text. A user who was at a show should be able to pick up to four photos, see a real card with the real show, and share or save it.

Two fake-data problems for the designer to remove (found while reading source, not yet fixed):
1. The composer preview and the public share page hard-code "ODESZA", "Red Rocks", "Jun 20, 2026", five gold stars, and "Maya's night at ODESZA". Real frames must use the real show, or neutral placeholder tokens that are visibly placeholders (for example "Artist name", "Venue, date") only in design files.
2. The public share page invites people to "Join Maya on Drop" with an invented person. Real copy must use the sharer's real display name or none.

## Backend contract that already exists
- Table `recap_posts` (`user_id`, `event_id`, `created_at`), upserted on `user_id,event_id` by native `recordRecapPost` so a re-share resurfaces the same row. It feeds the crew activity feed. Web does not touch this table today. Grants and RLS for `recap_posts` are **unverified** for the web client (not in the live-grants doc).
- Attendance gate: only users who attended may build a recap (`attendance`, `logged_shows`, both already used by the web). Existing copy: "Recaps are only for shows you were actually at."
- Photos: native uses the device photo library, which does not exist on web (audit marks it N/A). The web substitute is a file input (`accept="image/*"`). **Where uploaded photos are stored is unconfirmed**: the audit says "storage upload path to confirm". No storage bucket for recap photos is documented. Design must therefore work in two modes: (a) photos stay on the device, only used to render the card in the browser, and nothing is uploaded (default and safest); (b) uploaded to storage with a public URL, only if the build lane confirms a bucket, policy and moderation path. Unverified.
- Share card image: rendered client-side on a canvas (same approach as Wrapped; no html2canvas). Video cannot be drawn into a canvas the same way; see below.
- Native recap screens are gated by device QA (block A-I in the build-29 QA doc: "recap photos From that night, share PNG EXIF"), so native is not a verified reference. Do not copy native behavior blindly.

## States
1. **Were you there gate**: heading and two buttons (see copy). If attendance is already recorded the gate is skipped.
2. **Loading**: skeleton shaped like the composer: left, a 2x2 grid of `skel` squares with a title bar; right, a 9:16 `skel` block with button skeletons. Photo thumbnails show a per-tile skeleton while decoding.
3. **Empty composer**: four dashed slots, each labelled "Add photo". Preview card shows only show name, venue, date (real) and a soft "Add up to 4 photos" hint inside the empty grid. No stock images.
4. **Photos added**: slots show thumbnails; each has an "x" remove button (44px hit area) and a drag handle on desktop. Preview updates live.
5. **Video selected**: tile shows the first still frame with a "VIDEO" badge at top-left (parity with native). The share card uses the still frame only, with a caption under the grid: "Videos show as a still on the card." Clip is not uploaded or rendered.
6. **Rendering**: after tapping share/download, the button shows "Making your card..." (busy, disabled) for the short canvas render.
7. **Success**: native share sheet opens, or the PNG downloads and a `.toast--success` says "Card saved." Copy-link fallback toast "Link copied".
8. **Error**: image too large or unsupported: inline under the grid, `role="alert"`: "That file didn't work. Use a JPG, PNG, or HEIC photo under 10 MB." Render failure: "We couldn't make your card. Try again."
9. **Permission / privacy**: if mode (b) is chosen, a one-line disclosure "Photos you add may be shown to friends you share with." with link to the privacy page. Mode (a) shows "Photos stay on your device." Never both.

## Layout, desktop (1024 and up)
- Page max width 900px as today; two columns with a `var(--sp-xxl)` gap: left composer (flexible), right sticky preview (320px).
- Left: `.sec__title` "Pick up to 4 photos", caption count "2 of 4 added" (`--fs-xs`, `--text-secondary`). A 2x2 grid of square slots, gap `var(--sp-md)` (12px) both directions; slot radius `var(--r-md)` (14px), dashed `--border-strong` when empty. Below the grid, a ghost button "Add photos" (opens the file picker; multiple allowed). Optional star rating row below: five tappable stars (gold) with label "Your rating (optional)"; empty by default, no default stars.
- Right: label "Recap card" (`--fs-xs`, uppercase, muted-or-better), the 9:16 card (radius `var(--r-lg)` 20px; inner photo cells radius `var(--r-sm)` 10px, concentric; gap 6px), then the button row: primary "Share recap" (`.btn--primary`, flex 1) and a secondary "Save image" (`.btn--secondary`). Where native share is unavailable, the primary is "Copy link" for a public share page, otherwise "Save image" becomes the primary. Exactly one primary at any time.
- 9:16 card content: top-left Drop mark (existing glyph plus "DROP"); middle photo grid (1 to 4 photos; with 1 photo, one full-bleed cell; with 2, two stacked; 3, one large plus two; 4, 2x2); bottom block: artist (display font bold, the largest text), then "Venue, Month D, YYYY" in `--text-secondary`, then stars only if the user set a rating. Gradient background is the existing deep purple-teal-green; it is dark enough that text above 7:1 is easy.
- Export size: 1080 x 1920 PNG for download; preview is a scaled copy.

## Layout, mobile (430 and below)
- Single column, 16px gutters. Order: heading, photo grid (2x2, 12px gap), "Add photos" ghost button, rating row, 9:16 preview (full width, max 280px centered), then buttons.
- Primary "Share recap" is pinned in the thumb zone as a sticky bottom bar above the tab bar, full width; "Save image" is a secondary text button in the same bar. Preview is above the fold only on tall phones, so the bar must always be reachable.
- Photo tiles use the system file picker (camera or library appears natively on phones through `accept="image/*"`; a separate "Take photo" button is not needed).

## Public share page (real data)
- Same 9:16 card on the left (desktop) or on top (mobile), real artist/venue/date and the real sharer name when the sharer allowed it. Title "{Name}'s night at {Artist}". Primary "Join {Name} on Drop" only when a real name exists, otherwise "Join Drop". Secondary ghost "Get the app". If the recap cannot be found: `.empty` "This recap isn't available." with primary "Browse shows".
- No photos from other people are displayed unless the sharer chose to share them.

## Copy
- Gate: title "Were you there?" body "Confirm you attended to build a recap. Recaps are only for shows you were at." Buttons: "Yes, I was there" (primary), "Not this one" (ghost).
- Composer title: "Build your recap"
- Slot: "Add photo"; counter "{n} of 4 added"; remove label "Remove photo {n}"
- Buttons: "Add photos", "Share recap", "Save image", "Copy link"
- Video badge: "VIDEO"; caption "Videos show as a still on the card."
- Rating label: "Your rating (optional)"
- Busy: "Making your card..."
- Success toasts: "Card saved." / "Link copied"
- Errors: as in states 8.
- Privacy line: either "Photos stay on your device." or "Photos you add may be shown to friends you share with."
- Never show prefilled stars, a prefilled show, or sample artist names in production.

## Accessibility
- File input has a visible label ("Add photos"); the dashed slots are buttons that open the picker and have accessible names "Add photo {n}".
- Remove buttons have names including the photo number. Reordering (desktop drag) must have a keyboard alternative: "Move left"/"Move right" buttons.
- The preview card is an image with a text alternative that reads the card text: "Recap card: {Artist}, {Venue}, {Date}, {rating} stars, {n} photos." Photo `alt` text field is optional per photo ("Describe this photo"), default empty-but-labelled decorative.
- Star rating is a radio group with five options and visible focus; not color-only.
- Busy state is announced with `aria-live="polite"`.
- Contrast: on the card, `--text` (white) on the dark gradient is above 12:1; `--text-secondary` above 8:1; gold stars on the gradient above 7:1. Outside the card, caption text uses `--text-secondary` (10+:1 on `--bg`) rather than `--text-muted` on a lighter surface.
- Reduced motion: no card flip or confetti.

## Out of scope
- Video playback, trimming, or rendering into the PNG.
- Native photo library, camera permissions, EXIF handling beyond stripping location data from any uploaded image (a build lane requirement: no GPS EXIF leaves the device).
- Comments or likes on recaps, crew feed display.
- "From that night" friend-photo aggregation.
- AI captions, filters, stickers.
- Choosing the storage bucket (decision for the build lane).

## Acceptance checklist
- [ ] Frames for gate, empty composer, 1/2/3/4 photos, video still with badge, rendering, success, error, public page, not-found; desktop and mobile.
- [ ] No hard-coded sample artist/venue/date/name remains in any production frame.
- [ ] One primary button at a time; the other is secondary.
- [ ] Mobile primary action sits in a sticky thumb-zone bar.
- [ ] Skeletons match the grid and the 9:16 card.
- [ ] Concentric radii on card (20), cells (10), slots (14).
- [ ] Grid gutter is the same in both directions.
- [ ] 9:16 export specified at 1080 x 1920; layout variants for 1 to 4 photos shown.
- [ ] Video still-frame fallback and its caption are shown.
- [ ] Privacy line shown, matching whichever storage mode the build lane picks.
- [ ] Keyboard path for photo reorder and removal documented.
- [ ] Text contrast on card at least 4.5:1 with measured values.
