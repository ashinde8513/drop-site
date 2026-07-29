# Drop Website feature audit — 2026-07-29

## Verdict

No known actionable Critical, High, or Medium issue is unclassified within the audited scope. Every such issue is either fixed/invalid with evidence or explicitly approval-blocked with an owner and exact next action. This is not a claim that Drop has no defects.

The owner-only preview and production were not changed. The verified client fixes are isolated on `qa/website-feature-matrix-20260729`; the matching migration/mobile changes are isolated on `qa/security-contracts-20260729`.

## Audited truth

- Website behavior commit: `236b665fd73f97eaef39c9884addf49240b34aef`
- Mobile/backend behavior commit: `b538a130af3940cd6a9cb01a37f07199fe117ad2`
- Exact unapplied migration: `20260729182349_social_mutation_contracts.sql`
- Website `origin/main` merged into the audit branch: `7b9081118e3c95d89d7d127b367fba84ac3a3405`
- Mobile reference `origin/main`, read-only: `62ba25546b1180969b46f423cc7f2240b9cc8140`
- Canonical inventory: `docs/qa/feature-matrix.csv`
- Generated Excel mirror: `docs/qa/drop-website-feature-matrix.xlsx`
- Route evidence: `docs/signed-in-route-matrix.md`
- Founder source: `/Users/aryashinde/Downloads/Drop app.md/Drop app.md`
- Apple source boundary: locally preserved sanitized feedback/testing dispositions; original App Store Connect comments, screenshots, device/build metadata, and feedback after the last authorized pull were unavailable and were not reconstructed.

The dirty primary mobile checkout and unrelated TicketSauce adapter files were untouched.

## Inventory reconciliation

- Rows: 674
- Stories: 578
- Story result: `578 = 46 passed + 24 failed + 468 blocked + 13 not implemented + 27 awaiting device QA`
- Signed-in website stories: 38
- Unique preserved primary Requirement IDs: 358 (`267` founder, `91` Apple)
- Founder source coverage: all `262/262` non-empty bullet requests are preserved exactly, including both nested bullets
- Original-wording requirement-linked rows with SHA-256: 439 (`391` stories, `48` defect records)
- Defects/blockers: 96 (`1` Critical, `10` High, `57` Medium, `28` Low)
- Disposition: 17 fixed/invalid, 77 blocked/approval-required, 2 open Low measurement/maintenance risks. The three social defects have locally verified fixes but stay blocked because the shared migration is not hosted.

Historical requirements use only the requested classifications: Implemented, Partial, Missing, Deprecated, Duplicate, Conflicting, or Needs clarification. Sanitized historical Apple dispositions without current direct evidence are classified Needs clarification rather than being promoted to Passed.

Founder bullets beginning `- ` are stored with a spreadsheet-safe leading apostrophe. Display hashes are grouped for readability; the generator removes that escape, normalizes the hash to 64 lowercase hexadecimal characters, and recomputes it over the preserved source wording.

## Verification run this goal

- `npm ci` — passed.
- Post-merge public smoke matrix — 104 passed.
- `npm run typecheck:webapp` — passed.
- `npm run build:webapp` — passed; Vite warned about the 764.85 kB main chunk (216.08 kB gzip), tracked as `WEB-DEF-PERF-001`.
- `npm test` — Sites preview contract passed; Playwright 295 passed and 1 intentional mobile-project skip across desktop Chromium and mobile WebKit in 53.8 seconds.
- Mobile `npm run typecheck`, `npm run lint -- --quiet`, and `npm run test:unit` — passed; 524 unit tests.
- Mobile PGlite social contract run — 10 passed against exact unapplied migration `20260729182349_social_mutation_contracts.sql`.
- Connected owner-preview smoke — signed-in v10 Discover rendered with zero console warnings/errors. The Supabase dashboard showed production main only; no preview/persistent Drop branch or seeded non-production account matrix exists.
- Focused review regressions — rejected writes, pending states, out-of-order search, delayed navigation, combobox scrolling, and deletion-modal focus passed in both projects.
- `git diff --check` — passed.
- XLSX ZIP integrity and every worksheet XML document — passed.
- CSV-to-XLSX Feature Matrix cell equality — passed for all 674 rows.
- Every Passed story has non-empty evidence and an audited commit; every Passed website row links a passing same-commit run (`RUN-012`, or the architecture-specific `RUN-014` for `WEB-DEF-DEP-001`). Locally fixed but unapplied authorization defects remain Blocked and link `RUN-015`.
- Dependency audit — two High package entries map to an RSC-only React Router advisory; this client-only Vite/BrowserRouter architecture does not use the vulnerable feature (`WEB-DEF-DEP-001`).
- Adversarial code review and behavior/matrix review — findings either fixed or entered as approval-blocked defects.

Local deterministic screenshot evidence:

| Surface | Evidence | SHA-256 |
| --- | --- | --- |
| Desktop Discover | `/private/tmp/drop-website-qa-a081-desktop-discover.png` | `d8f95f582300c5cec35f77adff956d6971cb347fbeced296b7e0bf07bb2ccad2` |
| Desktop Event Detail | `/private/tmp/drop-website-qa-a081-desktop-event.png` | `21ccb82563d6df627515f69dd591f98b19ee20cfe535105c794ba98758f36abe` |
| Mobile Discover | `/private/tmp/drop-website-qa-a081-mobile-safari-discover.png` | `496c1a5e06bf506dfc3ff82181515122a8b8a387c0b5f0d06572917cb7bdb605` |
| Mobile Event Detail | `/private/tmp/drop-website-qa-a081-mobile-safari-event.png` | `73bc23c83caf7ee9d306326927526925312d259545222974cc18648753fc8ffb` |

The screenshots confirm centered uniform event collections with left-aligned headings and a wide/contained website-native event detail rather than a vertical poster regression.

## Changes made

- Merged current `origin/main` into the isolated audit branch, preserving reset-password fallback and server-side waitlist confirmation behavior.
- Added visible pending/error handling for Friends, festival schedule, Live Mode, reminders, and unblock actions.
- Prevented stale schedule/Live/utility mutation completions from updating another route.
- Prevented slower friend searches from overwriting newer results.
- Added full delete-dialog focus lifecycle, including a focus target while destructive controls are disabled.
- Kept keyboard-active combobox options in view.
- Added deterministic desktop/mobile regressions for every non-trivial client fix.
- Corrected stale parity documentation and created the canonical CSV/XLSX audit artifacts.
- Added the exact recipient/pending friendship, server-time/event-window check-in, reverse-block privacy, and atomic crew contracts plus rollback tests in the isolated mobile/backend branch.
- Updated both clients to require an accepted friendship row, omit client-authored check-in timestamps while the server overrides identity/time, and use the atomic crew RPC.
- Reused the app's shared active-event fallback in Live Mode and disabled check-in outside the server-matching window.

## Approval-required findings

- `WEB-DEF-FRIEND-AUTH-001` (High): exact recipient/pending migration and denial/success tests pass locally, but the exploitable production policy is unchanged. Backend/Security must approve the exact migration in non-production and review hosted evidence before any production request.
- `WEB-DEF-CHECKIN-AUTH-001` (High): exact server-time/window and reverse-block-privacy contracts pass locally, but production remains unchanged. Backend/Security must approve the exact migration in non-production and review hosted time/privacy evidence.
- `WEB-DEF-DEPLOY-001` (High): a non-doc push to `main` enters the production deployment workflow; owner-only access is external. Founder/Release owner must decide the release lane.
- `WEB-DEF-CREW-001` (Medium): the atomic RPC and rollback tests pass locally and both branch clients use it, but no hosted backend exposes it. Backend/Security must approve the exact migration and hosted owner/non-owner/failure matrix before coordinated release.
- `WEB-DEF-CI-001` (Medium): explicit TypeScript checking is not in CI. Repository/CI owner approval is required; runner labels and trust boundaries must not change.
- `WEB-DEF-TEST-001` and `WEB-BLK-BROWSER-001` (Medium): connected owner-preview smoke passed, but no authorized non-production branch/project or seeded multi-account matrix exists for hosted Auth/RLS/access verification.

The inherited mobile/backend requirement register contains additional approval-gated Critical/High/Medium findings. Their owners, reasons, and exact actions remain preserved row-by-row in the canonical matrix.

## Untested or unavailable

- Physical-device Safari, VoiceOver, storage quota/eviction, native share sheets, and universal-link delivery.
- Hosted owner/non-owner/blocked/anonymous RLS and RPC behavior; the only available Drop backend is production and was kept read-only.
- End-to-end OAuth provider completion in the private preview.
- Connected mobile-viewport preview screenshots and multi-account owner-only enforcement. The connected desktop owner/console smoke passed.
- Original/raw Apple beta comments, screenshots, metadata, and a post-July-27 refresh.
- Production data, migrations, functions, access controls, and deployment.

## Exact next three actions

1. Backend/Security reviews exact migration `20260729182349_social_mutation_contracts.sql`; the owner approves/provisions an authorized non-production Supabase target, including any disclosed cost. Production stays untouched.
2. Apply only that exact migration in the approved non-production target; seed requester/recipient, owner/non-owner, friend/nonfriend, and either-direction-block accounts; run the hosted authorization/rollback and desktop/mobile preview matrix.
3. If hosted evidence passes, request separate exact-filename production approval and coordinate backend, mobile, and website release; do not deploy either client before its RPC/policy dependency exists.
