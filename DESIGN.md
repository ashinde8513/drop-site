# Design

> Design for the Drop website. Mirrors the Prism identity defined in the `drop-design` system — pull from there; do not fork the look.

## Theme

Dark, nightlife-premium, iridescent — the web expression of Prism. Deep navy base, controlled cyan→magenta→lime spectrum as the signature, glassmorphic header, animated frequency visualization. Reads as a club at night: dark room, bright signal.

Color strategy: **Restrained base, committed accent** — deep-navy surfaces, iridescence reserved for the hero signature, wordmark, and emphasis.

## Color

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#0B0D12` | base background (deep navy) |
| `--bg-2` | `#14161D` | secondary background |
| `--surface` | `#1C1F28` | cards / surfaces |
| `--surface-hi` | `#262A35` | raised / hover surface |
| `--line` | `rgba(255,255,255,0.10)` | hairline divider |
| `--line-2` | `rgba(255,255,255,0.16)` | emphasized divider |
| `--ink` | `#FFFFFF` | primary text |
| `--muted` | `#AAB2C2` | secondary text (verify ≥4.5:1 at 17px) |
| `--cyan` | `#4DE2FF` | spectrum / accent |
| `--magenta` | `#E24DFF` | spectrum / caret / legal numerals |
| `--lime` | `#B6FF6A` | spectrum |
| `--chrome` | `#C9D2DF` | metallic wordmark |
| `--gold` | `#FFCB3D` | accent |

Gradients:

- `--grad`: `linear-gradient(120deg, #4DE2FF 0%, #E24DFF 52%, #B6FF6A 100%)` — iridescent signature
- `--grad-chrome`: `linear-gradient(120deg, #C9D2DF, #8A93A5, #EDF2F8)` — metallic "DROP" wordmark

Link-hub badge gradient (`link.html`): `#FF2E9A` → `#8A5CFF` → `#25E6C8`.

## Typography

- **Display:** `'Space Grotesk', system-ui, sans-serif` — headings, labels, wordmark
- **Body:** `'Sora', system-ui, sans-serif` — body / paragraphs
- Loaded via Google Fonts; weights 400/500/600/700. Base body 17px / line-height 1.6.

Scale (responsive `clamp()`):

- Hero H1: `clamp(40px, 5.5vw, 76px)` — search-first hero, discovery site (the 150px poster H1 retired with the 2026-07-06 rebuild)
- Section H2: `clamp(26px, 3.4vw, 40px)`
- Card title: 17px / 600 · Eyebrow: 12px / 600 / 0.18em uppercase · Body 16–17px / 1.6

## Layout

- Container max-width `--wrap: 1240px` (`--wrap-narrow: 760px` for prose).
- Shared stylesheet `site.css` (Prism token block copied verbatim from `drop-design/foundations/tokens.css`) + `data.js` (live Supabase public-catalog fetch layer, `window.Drop.*`) + `site.js` (nav/rails/cards/spectrum). Plain static HTML, zero build. Legacy `styles.css` remains ONLY for `link.html`.
- Pages (12 + hub): `index`, `events` (filterable listing), `event`/`venue`/`artist` (param-driven detail templates), `venues`, `artists`, `promoters`, `about`, `download` (waitlist), `privacy`, `terms`, plus `link.html`.
- Hero is search-first (`clamp(40px, 5.5vw, 76px)`), not the old 150px poster headline.

## Components (site.css)

- `.site-nav` — sticky glass header: wordmark, location popover, search, page links, CTA; mobile drawer (no app tab bars)
- `.ecard` — event card (16:10 art, genre pill + date chip on scrim, title/venue/price); `.art-prism` genre-tinted fallback when no image
- `.rail` — scroll-snap card rail with arrow buttons + right-edge fade mask; `.grid-events` auto-fill grid
- `.chip` / `.chip-social` — filter pills (aria-pressed) / cyan social-glass "N friends going" (product-preview sections ONLY — never faked on real events)
- `.spectrum` — 64-bar frequency visualization (the signature; one per page max)
- `.state-empty` / `.state-error` / `.skeleton` — required states for every live-data surface
- `.cta-band`, `.wl-form` (waitlist, Kit + mailto fallback), `.doc` (legal prose, 760px, magenta numerals), `.site-foot` (4-col footer + FTC/LLC lines)

## Motion

Spectrum animation and marquee scroll are the primary motion. Add `prefers-reduced-motion: reduce` alternatives (freeze the spectrum to a static EQ shape; pause the marquee). Keep entrances tied to what they reveal — no uniform whole-page fade-in.

## Brand Assets

Wordmark "DROP▾" — chrome-gradient "DROP" + magenta caret, Space Grotesk. Link-hub uses an inline SVG frequency-spectrum badge. Favicon: `favicon.svg` (spectrum mark). Domain `trydropapp.com` (public website). `app.trydropapp.com` serves the static browser account shell from this repo; it must not serve Expo web.
