# Authorized client delivery evidence — 2026-07-29

## Outcome

The two separately authorized actions completed against their exact immutable inputs:

- Drop-App PR #290 head `16f9463bc7834e52a0489ef52d6c8b35e746cd09` merged into `main` with a merge commit, producing `21ce9b618979f298374d21c232bb3e04f92d7e6b`.
- Owner-only Sites v12 deployed from exact source `7162be246177b646ff7c28dc4b0fec004d7e1e0f`.

No production OTA was authorized or published. The production Drop website repository/route was not merged or deployed.

## Mobile provenance

- PR: `ashinde8513/Drop-App#290`
- Authorized head: `16f9463bc7834e52a0489ef52d6c8b35e746cd09`
- Merge method: Create a merge commit
- Merge commit: `21ce9b618979f298374d21c232bb3e04f92d7e6b`
- Post-merge `main`: exact merge commit above
- Release tag: `release-train-31-21ce9b6`
- Tag target: exact merge commit above
- Release Train 31: closed with zero open issues
- Release controller: run `30515570556`, success
- PR-target reconciliation: run `30515570568`, success
- Main closeout check: run `30515570608`, success
- Tagged web deployment: run `30515582111`, success; exact-clean-tag verification, build, environment guard, and Cloudflare deployment all passed
- Latest `production-release` run remains `30487062427`, created before this merge. No post-merge production-release/OTA run exists.
- Exact-tag release-ref preflight passed.
- Exact-tag iOS fingerprint: `a904ccc60ecf3ff7ab907769b1cdfc7281592806`.
- Latest finished production iOS build: `b913963d-23ef-4575-ac5c-aa8e2726d58e`, runtime `d42ed9dc7445172d9d0ca08124fd0443d0eaa433`.
- The runtimes do not match. The sanctioned OTA guard therefore requires a new native production build; an OTA for this tag must not be dispatched.

## Owner-only Sites provenance

- Project: `appgprj_6a6809bac18c8191b3097005c9b9d546`
- Version: 12
- Version ID: `appgprj_6a6809bac18c8191b3097005c9b9d546~appgver_9798a6ed49448191914b3cf64dded370`
- Source: `7162be246177b646ff7c28dc4b0fec004d7e1e0f`
- Archive SHA-256: `4b04a36c48c8b2d40fc5135e5564ee7e4484a1cca63eccac9a44ce47e14e4a0a`
- Deployment: `appgdep_6a6adb8e9c4c8191b2899b1671661f51`, succeeded
- URL: `https://drop-parity-preview.ashinde8513.chatgpt.site/app/next/`
- Access readback: `custom`; only `ashinde8513@gmail.com`; no account, workspace, or tenant groups

## Live verification

- Desktop Discover rendered real signed-in data. The `Upcoming` heading remained left aligned while four 300×340 cards centered with 114px/113px side gutters inside the collection. `For You` rendered a uniform 300×340 intentional carousel with previous/next controls.
- Event-card navigation opened a website-native detail route. Desktop media rendered wide/contained; 390×844 mobile rendered the faithful responsive detail instead of a vertical poster-card regression.
- The shared location combobox accepted `morr`, returned only `Morrison, CO`, moved the active option with ArrowDown, and removed the listbox on Escape without changing the saved Denver location.
- Profile → Drop Stats → ALLEYCVT seen history → linked show memory completed against real signed-in data. Stats exposed source-backed artist, venue, city, genre, and show destinations.
- Captured console/page-error probes were empty across representative desktop/mobile loads and event/Profile/Stats/history navigation.
- Recent Sites Worker error log query returned zero events.

The browser viewport override was reset after mobile verification. The final connected tab was left on the owner-only preview.

## Inventory reconciliation

`docs/qa/feature-matrix.csv` is 677 rows and 578 stories:

`578 = 46 passed + 24 failed + 468 blocked + 13 not implemented + 27 awaiting device QA`

Delivery evidence is `RUN-024`. Existing blocked rows now point to their actual next actions instead of the completed merge/Sites authorization gate.
Tooling evidence `RUN-026` verifies consecutive workbook generations are byte-identical and remain equal to the canonical CSV.

## Post-push CI evidence

- Exact evidence head `a91098abfdb7d24c96dac9cfcedd2c9a857c7bcf` passed local `npm test`: 295 passed and 1 intentional skip in 54.7 seconds.
- GitHub Actions run `30517391362` attempt 1 failed under five-worker mobile WebKit load: 281 passed, 4 flaky, 10 timed out, and 1 intentionally skipped. PR deploy remained skipped.
- Its single failed-job retry succeeded: 292 passed, 3 flaky, and 1 intentionally skipped. PR deploy again remained skipped.
- `WEB-DEF-CI-FLAKE-001` records the Medium CI reliability defect and exact approval-required two-worker verification action. No workflow, runner, trust-boundary, or deployment change was made.

## Remaining boundaries

- Founder must explicitly choose and authorize `production-release` action `build-only` or `build-and-submit` for exact tag `release-train-31-21ce9b6`, including any EAS build usage and, for `build-and-submit`, the TestFlight submission. OTA is not compatible with the current production build runtime.
- Repository/CI owner must separately approve a CI-only Playwright two-worker cap and two consecutive zero-flake runs; the existing trusted runner and deploy condition must remain unchanged.
- Physical-device/TestFlight QA has not run for this merged source.
- `drop-site` PR #28 remains unmerged; production website routes and access remain unchanged.
- Plans, media, account-utility, and complete Live Mode owner/non-owner/blocked connected journeys remain classified with exact actions in the matrix.
