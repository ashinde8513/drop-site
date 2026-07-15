# Connecting Apple login (Sign in with Apple) — website + app

One-time setup that makes **"Continue with Apple"** work in the web SPA
(app.trydropapp.com / trydropapp.com/app/) and native Sign in with Apple work in
the mobile app — both through the shared Supabase project (`ebccwnkmsnhbljxxxdej`,
"Drop App"). The companion CLI lives at `scripts/apple-oauth.mjs`
(`npm run apple-oauth -- <command>`); run it with no arguments for flag help.

The same `apply` step also fixes the standing OAuth redirect-bounce item
(PROJECT_STATE "Exact next step" 0) by allowlisting
`https://app.trydropapp.com/**` and `https://trydropapp.com/app/**` — that part
needs no Apple portal work: `npm run apple-oauth -- apply --allowlist-only`.

## What's already done

- The SPA login/signup screens call `supabase.auth.signInWithOAuth({ provider: 'apple' })`
  (`app/app.js` — `oauthApple`); no front-end changes are needed.
- `.well-known/apple-app-site-association` carries the real appID
  `S6H8PA7TUH.app.drop.mobile` (commit 328d2b9) for the app's universal links.

## 1. Apple Developer portal (founder, ~10 min, developer.apple.com)

1. **App ID** — Certificates, Identifiers & Profiles → Identifiers →
   `app.drop.mobile`: enable the **Sign in with Apple** capability (set as
   primary App ID). Create the App ID first if it doesn't exist yet.
2. **Services ID** (the web "client") — Identifiers → **+** → Services IDs →
   identifier **`app.drop.mobile.web`** (the CLI's default; any reverse-DNS id
   works if you pass `--client-id`). Enable Sign in with Apple → Configure:
   - Primary App ID: `app.drop.mobile`
   - Domain: `ebccwnkmsnhbljxxxdej.supabase.co`
   - Return URL: `https://ebccwnkmsnhbljxxxdej.supabase.co/auth/v1/callback`
3. **Key** — Keys → **+** → enable Sign in with Apple, choose primary App ID
   `app.drop.mobile` → register → **download `AuthKey_XXXXXXXXXX.p8`**
   (downloadable exactly once — keep it in a password manager, never in git)
   and note the 10-character **Key ID**.

## 2. Wire it into Supabase (CLI)

```sh
export SUPABASE_ACCESS_TOKEN=sbp_...   # https://supabase.com/dashboard/account/tokens
npm run apple-oauth -- apply --key ~/Keys/AuthKey_XXXXXXXXXX.p8 --key-id XXXXXXXXXX
```

That single command:
- generates the Apple **client secret** (an ES256 JWT signed with the .p8 key,
  `sub` = Services ID, 180-day lifetime — Apple caps at 6 months),
- PATCHes the project auth config: Apple provider on, client IDs
  `app.drop.mobile.web,app.drop.mobile` (web Services ID + native bundle ID so
  the app's ID-token flow validates too), the secret,
- merges the two `trydropapp.com` redirect URLs into the allowlist.

Preview without touching anything: add `--dry-run` (works without the token).
Inspect current state: `npm run apple-oauth -- status`.

## 3. Verify

```sh
npm run apple-oauth -- verify   # no token needed
```

Checks the AASA is served with the right appID and that
`…supabase.co/auth/v1/authorize?provider=apple` 302s to `appleid.apple.com`
with the Supabase callback as `redirect_uri`. Then QA for real: open
`https://app.trydropapp.com/?mode=login` → **Continue with Apple** → should land
back in the SPA signed in (Discover).

## 4. Secret rotation (every ≤6 months)

Apple client secrets expire. Before the expiry printed by the CLI:

```sh
npm run apple-oauth -- apply --key ~/Keys/AuthKey_XXXXXXXXXX.p8 --key-id XXXXXXXXXX
```

Same key/Key ID, fresh JWT — nothing else changes. Set a calendar reminder for
~2 weeks before expiry; an expired secret makes Apple login fail with
`invalid_client` while every other provider keeps working.

## Mobile app note

The native app should use the platform Sign in with Apple sheet →
`supabase.auth.signInWithIdToken({ provider: 'apple', token })` (bundle ID
`app.drop.mobile` is already in the client-ID list). The web OAuth flow above is
independent of app-store review requirements but Apple requires "Sign in with
Apple" in the app if it ships any third-party login (Google/Facebook) — the
mobile repo (`../drop-mobile-app`) tracks that work.
