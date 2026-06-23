# Product

## Register

brand

## Users

EDM and live-music fans — festival-goers, club regulars, and the friend-group "planner" who tracks who's going to what. They arrive almost entirely from social: an Instagram or TikTok bio link (`link.html`), tapping in on a phone, mid-scroll, with seconds of patience. Pre-launch, the job is simple: understand what Drop is in one glance and decide whether to grab launch access. The link-in-bio hub is the highest-traffic entry point and must route fast (iOS → App Store when live; everyone else → launch list).

## Product Purpose

The marketing face and conversion funnel for **Drop**, an EDM event-discovery iOS app by Resonance Ventures LLC. It exists to (1) drive launch-access / waitlist signups, (2) host the legal URLs (Privacy, Terms) and App Store marketing URL required to ship and to unlock partner applications (Etix/Partnerize, Apple), and (3) act as the social link-in-bio hub for @trydropapp. Success = qualified signups and a frictionless path from a social tap to the App Store. It sells the *feeling* of never missing the drop and knowing who's going — not a feature checklist.

## Brand Personality

**Electric · nocturnal · premium.** Music-culture-native and confident, never corporate. The voice is short, kinetic, scene-fluent ("Never miss the drop"). The iridescent PRISM identity (cyan → magenta → lime over deep navy), the animated frequency spectrum, and motion-as-music carry the energy. Premium is communicated through restraint in layout and richness in the signature visual, not through loudness everywhere. This is the same Prism identity as the app — the landing mirrors the product, it does not invent a separate look.

## Anti-references

This should NOT look like:
- **Generic SaaS / template** — hero-metric blocks, identical icon+heading+text card grids, a tracked-uppercase eyebrow over every section, AI-scaffold cadence.
- **Corporate / navy fintech** — safe enterprise navy-and-gray, trust-by-default coldness. Drop is a nightlife brand, not a bank.
- **Loud crypto / web3 / VC hype** — neon-on-black hype, gradient *text* everywhere, aggressive overstimulation. The iridescence is a controlled signature, not wall-to-wall noise.
- **Linktree-default blandness** — the `link.html` hub must read as Drop, not as a default page-builder link list with no identity.

## Design Principles

- **One Prism, everywhere.** The landing, the app, and the design system share a single identity. Pull from `drop-design` tokens; never fork the look.
- **Motion is music.** Animation reinforces the EDM narrative (the spectrum, the marquee). It is intentional and rhythmic, never decorative filler.
- **Social proof is the hook.** "Who's going" is the product's north star; the marketing should foreground belonging and the crowd, not feature lists.
- **Funnel clarity over cleverness.** Every page has one obvious next action. The link hub routes in one tap; the landing converts to launch access.
- **Premium through restraint.** Richness lives in the signature visual and typography; the rest stays calm so the brand reads as considered, not loud.

## Accessibility & Inclusion

Target **WCAG 2.2 AA**. Watch items specific to this surface: muted text (`--muted: #AAB2C2` on `--bg: #0B0D12`) sits near the AA boundary at 17px — verify ≥4.5:1 and bump toward `--ink` if close. Provide `prefers-reduced-motion` alternatives for the spectrum animation and marquee. Email-capture form needs inline validation and visible focus states. Secondary CTAs need a non-color hover/focus affordance.
