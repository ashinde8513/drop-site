# 2026-10-29 security audit: app shell script CSP + /go allowlist

- `_headers` `/app/*`: enforced `script-src 'self' https://trydropapp.com` + the two inline-script hashes of `app/index.html`, `worker-src 'self' blob:`. Pages joins it with the `/*` CSP (both enforced). The report-only candidate is unchanged.
- `functions/go.js`: proxied Edge Location must be https on trydropapp.com / apps.apple.com / play.google.com, else the device fallback.
- Tested:
  - `node --test` (all 22 files): 111 pass.
  - Playwright under Node 22: 511 pass. 19 failed on the first run; rerun shows parallel flakes, and the same crew-links mobile-safari failure reproduces with this change stashed.
  - The exact policy was injected into live app.trydropapp.com in Chromium and WebKit: 0 CSP errors, Discover map canvas drawn. A negative control (`script-src 'self'` alone) breaks the page as expected.
- Next: after the auto-deploy, run `curl -sI https://app.trydropapp.com/` (both CSPs present) and dispatch the live signed-in check. If anything regresses, revert this commit.
