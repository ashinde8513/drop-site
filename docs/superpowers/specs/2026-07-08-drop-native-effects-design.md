# Drop native effects + design-resources — design spec

**Date:** 2026-07-08
**Status:** approved (brainstorming), pending implementation plan
**Surfaces:** `drop-website` (vanilla HTML/CSS/JS), `drop-mobile-app/DropApp` (React Native/Expo), plus a cross-surface design-resources doc in `prism-tokens`.

## Problem

Three UI-inspiration sources were reviewed for Drop:
- **refero.design** — catalog of real apps' `DESIGN.md` style guides (AI-readable tokens). Reference only, no code.
- **Aceternity UI** — React + Tailwind + Framer Motion components (~13 free).
- **Componentry** — React + WebGL animated primitives (license unconfirmed).

Neither library drops into Drop as-is: the website is **vanilla HTML/CSS** (no React, no build step) and the app is **React Native** (not web React, no DOM/WebGL). Value must be captured by **reimplementing a small set of the free effects natively**, wired to Prism tokens — not by importing the libraries.

Constraint from the user: only build the subset that **improves the experience without degrading it**. No new dependencies. Respect `prefers-reduced-motion` everywhere.

## Prism token source of truth

- Canonical: `/Users/aryashinde/Developer/Drop/prism-tokens/palette.json`
- `node sync.mjs` regenerates:
  - app → `drop-mobile-app/DropApp/src/theme/primitives.ts`
  - website → `drop-website/site.css` (CSS variables)
  - design-lib → `drop-design/foundations/tokens.{css,json}`
- All effects below consume existing tokens (brand cyan/magenta/lime, gradients, motion duration/spring). **No hardcoded hex, no hardcoded timings.**

## Scope — what gets built

### A. Website (`drop-website`, vanilla)

**A1. Animated headline (flip-words)**
- New self-contained `flipwords.js` (~30 lines) + a `<span data-flip="drop,set,show">` in the hero HTML.
- Cycles the last word of the hero headline (e.g. "Never miss a **drop / set / show**").
- Word color pulls a Prism brand CSS variable from `site.css`.
- Data-attribute driven; no framework.
- **Reduce-motion:** renders one static word, no cycling.

**A2. Hero aurora backdrop**
- CSS-only `.aurora` layer: Prism cyan/magenta radial gradients with a slow `@keyframes` drift.
- Sits **behind** the existing hero canvas waveform (the site's signature element is preserved, not replaced). Layered via z-index, `pointer-events: none`.
- **Reduce-motion:** static gradient, no drift animation.

### B. App (`drop-mobile-app/DropApp`, React Native)

**B1. Post-show recap celebration burst**
- One self-contained `<RecapCelebration />` component using the RN `Animated` API already in the app. **No new dependency** (hand-rolled sparkle/confetti particles).
- Fires once on recap reveal. Particle colors read from `src/theme/primitives.ts` (Prism brand).
- Interface: `<RecapCelebration trigger={revealed} />`. Mounts into the recap screen; touches nothing else in the shipped flow.
- **Reduce-motion:** guards `AccessibilityInfo.isReduceMotionEnabled()` → renders static or skips the burst.

### C. Design-resources doc (the "where to look" system)

**C1.** New canonical `/Users/aryashinde/Developer/Drop/prism-tokens/DESIGN_RESOURCES.md` (lives next to the token source of truth, git-tracked, surface-neutral). Contents:
- **refero.design** → app design language; named event/ticketing peers to study: DICE, Partiful, Eventbrite, Going, Superlocal.
- **Aceternity UI (free list)** → website effects; note: *reimplement in vanilla CSS/JS, do not import (React-only)*. List the free components.
- **Componentry** → premium hero effects; *verify MIT license before any use*.
- Rule line: "When improving a feature's look or motion, consult this first before inventing from scratch."

**C2.** A one-line pointer to `prism-tokens/DESIGN_RESOURCES.md` appended to each surface's existing backlog doc:
- `drop-website/BACKLOG.md`
- `drop-mobile-app/DropApp` backlog (or PROJECT_STATE if no BACKLOG)
- `resonance-landing` backlog/state doc

## What is explicitly NOT built (backlog / cut)

- **Site moving logo/event cards** — backlog. Needs *real* partner/venue logos; placeholders read as cheap and hurt trust. Add when logos exist.
- **App always-on animated gradient hero** — cut. Continuous background motion on mobile costs battery, distracts, and hurts accessibility. Fails the "preserve UX" bar.
- **Importing Aceternity/Componentry, adding Tailwind/Framer/React to the sites, or migrating the website to a framework** — rejected; disproportionate toolchain for two static pages.

## Isolation / interfaces

- Each effect is one isolated file, prop- or data-attribute-driven, independently testable.
- `flipwords.js` — pure function over a word list; no dependency on the rest of the page.
- `.aurora` — pure CSS class; no JS.
- `<RecapCelebration />` — single prop (`trigger`), self-contained, no coupling to recap internals.

## Testing / verification

- **Website:** manual browser drive of the hero; toggle OS reduce-motion and confirm static fallback for both A1 and A2.
- **App:** component self-check for `<RecapCelebration />` (fires on trigger flip, respects reduce-motion) + drive the recap flow once on simulator.
- **Tokens:** confirm every color/timing resolves from Prism (grep for stray hex/ms literals in the new files).
- **Docs:** confirm `DESIGN_RESOURCES.md` committed and all three pointer lines land.

## Risks

- Touching the shipped post-show recap flow (B1) — mitigated by making `<RecapCelebration />` additive and self-contained; recap logic unchanged.
- Reduce-motion regressions — mitigated by an explicit guard in every effect + a verification step.
