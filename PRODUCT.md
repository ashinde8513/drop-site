# Product

## Register

product (browse-first discovery — one website with a signed-out view and a signed-in view)

## Users

EDM and live-music fans — festival-goers, club regulars, and the friend-group "planner" who tracks who's going to what. They arrive to **browse shows**: from a social bio link (`link.html`), a search result, or typing the URL, on a phone or desktop. The job is to **discover events immediately** — search by artist/venue, filter by date + location, open an event, see who's going — with no account required, exactly like axs.com. The signed-in view lives on `app.trydropapp.com`; the signed-out view is the open front door to the same catalog.

## Product Purpose

trydropapp.com is Drop's **browse-first discovery website** — modeled on **axs.com** (see `AXS_MODEL.md`). It is not a marketing page: it is one website with a **signed-out view** (open discovery) and a **signed-in view** (`app.trydropapp.com`). Content is the hero: a unified search+dates+location bar over discovery rails (Featured, Happening this week — Today/This Weekend/Next 30 Days, genre rails), all openly browsable from the same Supabase catalog the app reads. It also (a) hosts the legal URLs (Privacy, Terms) + App Store URL required to ship and to unlock partner applications (Etix/Partnerize, Apple), (b) acts as the social link-in-bio hub for @trydropapp, and (c) routes to the signed-in view at `app.trydropapp.com`. Success = a fan lands, finds a show worth going to in seconds, and — Drop's differentiator over AXS — sees the social wedge ("who's going", crew).

## Brand Personality

**Electric · nocturnal · premium.** Music-culture-native and confident, never corporate. The voice is short, kinetic, scene-fluent ("Never miss the drop"). The iridescent PRISM identity (cyan → magenta → lime over deep navy), the animated frequency spectrum, and motion-as-music carry the energy. Premium is communicated through restraint in layout and richness in the signature visual, not through loudness everywhere. This is the same Prism identity as the app — the website mirrors the product, it does not invent a separate look.

## Anti-references

This should NOT look like:
- **Generic SaaS / template** — hero-metric blocks, identical icon+heading+text card grids, a tracked-uppercase eyebrow over every section, AI-scaffold cadence.
- **Corporate / navy fintech** — safe enterprise navy-and-gray, trust-by-default coldness. Drop is a nightlife brand, not a bank.
- **Loud crypto / web3 / VC hype** — neon-on-black hype, gradient *text* everywhere, aggressive overstimulation. The iridescence is a controlled signature, not wall-to-wall noise.
- **Linktree-default blandness** — the `link.html` hub must read as Drop, not as a default page-builder link list with no identity.

## Design Principles

- **One Prism, everywhere.** The website, the app, and the design system share a single identity. Pull from `drop-design` tokens; never fork the look.
- **Motion is music.** Animation reinforces the EDM narrative (the spectrum, the marquee). It is intentional and rhythmic, never decorative filler.
- **Browse-first, AXS-style.** Content is the hero. The homepage is a discovery stack (search bar → featured → Happening time-tabs → genre rails), openly browsable with no account — never a marketing pitch or waitlist gate. See `AXS_MODEL.md`.
- **Social proof is the hook.** "Who's going" is the north star and Drop's edge over AXS; foreground belonging and the crowd (friends-going, crew) on cards and rails, not feature lists.
- **One Prism across surfaces.** The website and native app share identity, data, wordmark, shell language, and cards. The website's signed-out view is open discovery; its signed-in view (`app.trydropapp.com`) and the native app carry accounts.
- **Premium through restraint.** Richness lives in the signature visual and typography; the rest stays calm so the brand reads as considered, not loud.

## Accessibility & Inclusion

Target **WCAG 2.2 AA**. Watch items specific to this surface: muted text (`--muted: #AAB2C2` on `--bg: #0B0D12`) sits near the AA boundary at 17px — verify ≥4.5:1 and bump toward `--ink` if close. Provide `prefers-reduced-motion` alternatives for the spectrum animation and marquee. Email-capture form needs inline validation and visible focus states. Secondary CTAs need a non-color hover/focus affordance.
