# 2026-11-27 security audit round 4: the "Include me in friends' recaps" switch now saves

- Finding (Low, privacy control): Settings → Privacy showed the switch ON for everyone and a tap changed only the page. `profiles.recap_includable` was never read or written, so a user who turned it off in the app saw ON here, and turning it off here saved nothing. The value also carried over to the next account in the same tab.
- Change: `app/app.js` loads `recap_includable` with the profile, `toggleRecap` writes it and requires the returned row (rollback and a message otherwise), and sign-out resets it. `app/index.html` locks the switch until the stored value has loaded.
- Tested: `node --check app/app.js`. New Playwright test in `tests/app-parity.spec.ts` (stored value shown, write shape, rollback on error); Playwright runs in CI, not locally.
- Next: after the auto-deploy, open Settings on an account with the setting off in the app: the switch must show off.
