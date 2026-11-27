# 2026-11-27 security audit round 4: the "Include me in friends' recaps" switch now saves

- Finding (Low, privacy control): Settings → Privacy showed the switch ON for everyone and a tap changed only the page. `profiles.recap_includable` was never read or written, so a user who turned it off in the app saw ON here, and turning it off here saved nothing. The value also carried over to the next account in the same tab.
- Change: `app/app.js` loads `recap_includable` with the profile, `toggleRecap` writes it and requires the returned row (rollback and a message otherwise), and sign-out resets it. `app/index.html` locks the switch until the stored value has loaded.
- Tested: `node --check app/app.js`. New Playwright test in `tests/app-parity.spec.ts` (stored value shown, write shape, rollback on error); Playwright runs in CI, not locally.
- Next: after the auto-deploy, open Settings on an account with the setting off in the app: the switch must show off.

## Hotfix the same day

- Regression from the change above: the profile read named `recap_includable`, which signed-in clients may update but not select (column grant). The read was refused, so the profile never loaded on the live site (blank name and edit form, profile save refused) from the deploy at about 10:25 UTC until this hotfix.
- Change: the profile read is back to its original columns. The setting is read through `get_my_profile_settings()` (owner-only function). One write at a time on the switch.
- Why CI missed it: the test client does not model column grants. The test now asserts that no `profiles` read names `recap_includable`.
- Next: after the auto-deploy, sign in on the live site and confirm the profile name shows and the switch is enabled.
