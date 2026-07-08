# CLAUDE.md

## Design Context
Before any UI work, read `PRODUCT.md` (strategy/voice) and `DESIGN.md` (visual tokens) in this repo. They are the impeccable design context.

- **Register:** product — the **browse-first discovery website** (AXS-style; see `AXS_MODEL.md`), NOT a marketing landing. Content is the hero; browser login/account access lives on `app.trydropapp.com` as a static Supabase-backed shell, not Expo web.
- **Identity:** the Prism iridescent system (cyan→magenta→lime on deep navy `#0B0D12`). Shared with `~/Developer/Drop/drop-design` (the source-of-truth design system) — pull tokens from there; never fork the look.
- **Principles:** one Prism everywhere · motion is music · social proof ("who's going") is the hook · funnel clarity over cleverness · premium through restraint.
- **Anti-references:** generic SaaS/template, corporate navy fintech, crypto/web3 hype, Linktree-default blandness.
- **Accessibility:** target WCAG 2.2 AA; provide `prefers-reduced-motion` fallbacks for the spectrum and marquee.

## Default skills
- **UI:** `impeccable` to shape/review (covers spacing/hierarchy), `design-auditor` for the a11y + rules pass before pushing; motion → `motion-framer`.
- Skill named here missing from the available list → use the nearest available or none; never stall hunting.
- **Copy:** `copywriting` (+ `marketing-psychology`, `offers`) → `humanizer`; pressure-test with `cro`.
- **Funnel/visibility:** run `seo-audit` + `ai-seo` before any launch push.

## Testing (run before pushing UI/content changes)
Playwright smoke tests live in `tests/`. After any change to the HTML/CSS, run `npm test` — it loads every page (desktop + mobile Safari), checks titles, core content, legal links, and **fails on any JS console error or broken asset**. If you add a new page, add it to the `PAGES` list in `tests/smoke.spec.ts`. `npm run test:ui` for the interactive runner. (Pattern doc: `~/TESTING.md`.)
