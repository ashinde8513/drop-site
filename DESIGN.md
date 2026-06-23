# Design

> Brand landing for Drop. Mirrors the Prism identity defined in the `drop-design` system — pull from there; do not fork the look.

## Theme

Dark, nightlife-premium, iridescent — the marketing expression of Prism. Deep navy base, controlled cyan→magenta→lime spectrum as the signature, glassmorphic header, animated frequency visualization. Reads as a club at night: dark room, bright signal.

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

- Hero H1: `clamp(54px, 13vw, 150px)`, weight 700, lh 0.92, tracking -0.03em
- Section H2: `clamp(30px, 5vw, 50px)`, weight 700, lh 1.04, tracking -0.02em
- Feature H3: 23px / 700 / lh 1.12
- Eyebrow: 12px / 600 / tracking 0.22em / uppercase
- Button: 15px / 600

> Hero ceiling (150px) exceeds the impeccable display ceiling (~96px). Acceptable as a deliberate brand statement, but test the headline copy at every breakpoint for overflow.

## Layout

- Container max-width `--wrap: 1120px`.
- Single shared stylesheet `styles.css`. Plain static HTML, zero build, zero dependencies.
- Pages: `index.html` (landing), `link.html` (link-in-bio hub), `privacy.html`, `terms.html`.

## Components

- `.site-head` — sticky header, backdrop blur, border
- `.hero` — full-viewport hero, gradient text, CTA
- `.spectrum` — 64-bar animated frequency visualization (sine-shaped, EQ motion) — the signature
- `.features` — 3-column grid (collapses to 1 on mobile)
- `.cta-band` — rounded container, radial gradients, centered waitlist form
- `.wl-form` — email capture (input + submit + consent)
- `.marquee` — infinite-scroll event-type loop
- `.linkhub` — centered link-in-bio hub (`link.html`)
- `.doc` — long-form legal layout (max-width 760px, magenta section numerals)

## Motion

Spectrum animation and marquee scroll are the primary motion. Add `prefers-reduced-motion: reduce` alternatives (freeze the spectrum to a static EQ shape; pause the marquee). Keep entrances tied to what they reveal — no uniform whole-page fade-in.

## Brand Assets

Wordmark "DROP▾" — chrome-gradient "DROP" + magenta caret, Space Grotesk. Link-hub uses an inline SVG frequency-spectrum badge. No favicon committed yet — add one (the spectrum mark). Domain `trydropapp.com`.
