# Drop — website (trydropapp.com)

**Drop's website** (EDM event-discovery product, operated by Resonance Ventures LLC):
the public website at trydropapp.com. It is one of Drop's two front-end surfaces — the other is
the **mobile app** (`../drop-mobile-app`) — and both show the same content because both read the
same backend (Supabase project `ebccwnkmsnhbljxxxdej`, versioned in `../drop-backend`). The only
difference is how users access it: native app vs. website.

The **pre-login browse-first discovery site** (modeled on axs.com — see `AXS_MODEL.md`), NOT a
marketing landing: a unified search+dates+location bar over open discovery rails from the live
Supabase catalog, plus event/artist/venue pages, the link-in-bio hub, and privacy/terms. The
signed-in app is served at `/app` (worker-proxied). Plain HTML/CSS/JS, zero build step.

```
index.html      Discovery home (search bar + featured + Happening + genre rails — AXS-style)
events/artists/venues + event/artist/venue detail pages (open, no login)
login.html      → 301 to /app/login (the app owns login)
link.html       Link-in-bio hub for the Instagram/TikTok bios
privacy.html    Privacy Policy  ← also your Apple "Privacy Policy URL"
terms.html      Terms of Service / EULA  ← also your Apple "EULA URL"
site.css        All styling (pulls drop-design shell tokens)
```

## What this unblocks

- **Partner / affiliate program applications** — a real website URL to enter on partner forms.
- **Apple App Store** — hosted Privacy Policy + Terms/EULA URLs (a submission requirement).
- **App Store marketing URL** — point it at the deployed discovery home.

## Deploy — pick one (all genuinely free, commercial use OK)

### Option A — Cloudflare Pages (recommended)
1. Push this folder to a GitHub repo (or drag-and-drop the folder in the dashboard).
2. Cloudflare dashboard → **Workers & Pages → Create → Pages**.
3. Connect the repo (or upload). **Build command: none. Output directory: `/`**.
4. You get a free `*.pages.dev` URL with HTTPS. Add a custom domain anytime.

### Option B — GitHub Pages
1. Create a repo, push these files to the `main` branch.
2. Repo **Settings → Pages → Source: `main` / root**.
3. Live at `https://<username>.github.io/<repo>/` within a minute.

### Option C — Netlify
Drag the folder onto <https://app.netlify.com/drop> — instant deploy, free Starter tier.

> **Note on Vercel:** Vercel's free **Hobby** plan is, per their terms, for *non-commercial / personal* use. Since Drop is a commercial venture, prefer Cloudflare Pages or GitHub Pages above (no commercial restriction). Vercel works technically but the free tier isn't licensed for this.

## Custom domain
Grab something like `trydrop.app` or `trydropapp.com` (~$12/yr). On `.app`, HTTPS is mandatory and provided automatically by all three hosts above. Point the domain at your host per their docs.

## Before you publish
- The Privacy Policy and Terms were prepared as working templates — confirm every data practice matches the shipped app and consider a legal review before relying on them.
- The launch CTA is wired to **Kit (ConvertKit)** — paste your Form ID into `KIT_FORM_ID` in `index.html` to activate it, and enable double opt-in in Kit. `link.html` is the link-in-bio hub for the social bios.
