# Decisions

## 2026-07-18 — One website, two views; "marketing page" framing retired

Founder: trydropapp.com is never to be referred to as a marketing page (or landing page). It is one website with a **signed-out view** (open browse-first discovery at trydropapp.com) and a **signed-in view** (the Prism SPA at `app.trydropapp.com` / `/app`). Docs, code comments, and test names use this framing. Same day, the "✦ The EDM show discovery app" hero badge was removed from both views' signed-out heroes.

## 2026-07-08 — Website plus static browser account shell

trydropapp.com is the public browse-first website. Browser login/account access lives on `app.trydropapp.com`, served from this static website repo through the Cloudflare Worker.

The browser account shell uses Supabase Auth against the same Drop project as the native app and reads the same RLS-protected account data. It must not serve the Expo web app.
