# Single-URL cutover runbook (Option B)

End state: **one URL.** trydropapp.com = static discovery site (root, SEO, login) + the
Expo web app at **/app** (worker-proxied to CF Pages `drop-web`). app.trydropapp.com 301s
to trydropapp.com/app.

## Pre-flight (founder, once)
- Supabase Dashboard → Auth → URL Configuration → add `https://trydropapp.com/app` to
  Redirect URLs (keep the app.trydropapp.com entry until after cutover). Google/Apple
  provider consoles need NO change — their callback is the supabase.co URL.

## Cutover order (a few minutes of app.trydropapp.com breakage in between — root site unaffected)
1. Merge the mobile repo PR `feat/single-url-app-basepath` → web-deploy.yml auto-ships the
   `/app`-based export to Pages project `drop-web`. From this moment direct
   app.trydropapp.com serving is broken (assets reference /app/*) until step 2.
2. Deploy this worker: `cd workers/app-path && npx wrangler deploy`. Routes go live:
   `trydropapp.com/app*` → proxy to drop-web (prefix stripped);
   `app.trydropapp.com/*` → 301 → trydropapp.com/app/*.
3. Deploy the site (login handoff + links now target `/app/`):
   `npx wrangler pages deploy dist --project-name=drop-site --branch=main`.
4. Verify: trydropapp.com/app/ renders the shell (0 console errors); site login lands
   signed-in at /app; app.trydropapp.com/anything 301s; Google login round-trips.

## Later (post-verification)
- Remove `https://app.trydropapp.com` from the Supabase redirect allowlist.
- Web-push subscriptions registered under app.trydropapp.com are origin-stale — fine at
  7 test users; users re-enable notifications once on /app.
- Consider dropping the app.trydropapp.com DNS record after a deprecation window (the
  301 worker keeps old links alive as long as the record + route exist).
