# Drop Website feature audit — 2026-07-29

## Verdict

No known actionable Critical, High, or Medium issue is unclassified within the audited scope. Every such issue is either fixed/invalid with evidence or explicitly approval-blocked with an owner and exact next action. This is not a claim that Drop has no defects.

The owner-only preview and production were not changed. The verified client fixes are isolated on `qa/website-feature-matrix-20260729`.

## Audited truth

- Website behavior commit: `a081e702e6a3ab14fede797f13fcc4e67f120b0a`
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
- Story result: `578 = 47 passed + 24 failed + 467 blocked + 13 not implemented + 27 awaiting device QA`
- Signed-in website stories: 38
- Unique preserved primary Requirement IDs: 358 (`267` founder, `91` Apple)
- Founder source coverage: all `262/262` non-empty bullet requests are preserved exactly, including both nested bullets
- Original-wording requirement-linked rows with SHA-256: 439 (`391` stories, `48` defect records)
- Defects/blockers: 96 (`1` Critical, `10` High, `57` Medium, `28` Low)
- Disposition: 17 fixed/invalid, 77 blocked/approval-required, 2 open Low measurement/maintenance risks

Historical requirements use only the requested classifications: Implemented, Partial, Missing, Deprecated, Duplicate, Conflicting, or Needs clarification. Sanitized historical Apple dispositions without current direct evidence are classified Needs clarification rather than being promoted to Passed.

Founder bullets beginning `- ` are stored with a spreadsheet-safe leading apostrophe. Display hashes are grouped for readability; the generator removes that escape, normalizes the hash to 64 lowercase hexadecimal characters, and recomputes it over the preserved source wording.

## Verification run this goal

- `npm ci` — passed.
- Post-merge public smoke matrix — 104 passed.
- `npm run typecheck:webapp` — passed.
- `npm run build:webapp` — passed; Vite warned about the 765.14 kB main chunk (216.14 kB gzip), tracked as `WEB-DEF-PERF-001`.
- `npm test` — Sites preview contract passed; Playwright 291 passed and 1 intentional mobile-project skip across desktop Chromium and mobile WebKit in 55.4 seconds.
- Focused review regressions — rejected writes, pending states, out-of-order search, delayed navigation, combobox scrolling, and deletion-modal focus passed in both projects.
- `git diff --check` — passed.
- XLSX ZIP integrity and every worksheet XML document — passed.
- CSV-to-XLSX Feature Matrix cell equality — passed for all 674 rows.
- Every Passed story has non-empty evidence and an audited commit; every Passed website row links a passing same-commit run (`RUN-012`, or the architecture-specific `RUN-014` for `WEB-DEF-DEP-001`).
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

## Approval-required findings

- `WEB-DEF-FRIEND-AUTH-001` (High): friendship UPDATE policy permits requester self-accept. Backend/Security must approve a recipient-only, pending-only contract and DB tests.
- `WEB-DEF-CHECKIN-AUTH-001` (High): Live Mode accepts client-authored time without an authoritative event-window predicate. Backend/Security must approve a server-time RPC/policy and forged-time/privacy tests.
- `WEB-DEF-DEPLOY-001` (High): a non-doc push to `main` enters the production deployment workflow; owner-only access is external. Founder/Release owner must decide the release lane.
- `WEB-DEF-CREW-001` (Medium): multi-write crew membership is not atomic. Backend/Security must approve an atomic replacement RPC.
- `WEB-DEF-CI-001` (Medium): explicit TypeScript checking is not in CI. Repository/CI owner approval is required; runner labels and trust boundaries must not change.
- `WEB-DEF-TEST-001` and `WEB-BLK-BROWSER-001` (Medium): no seeded non-production account matrix or connected owner browser was available for hosted Auth/RLS/access verification.

The inherited mobile/backend requirement register contains additional approval-gated Critical/High/Medium findings. Their owners, reasons, and exact actions remain preserved row-by-row in the canonical matrix.

## Untested or unavailable

- Physical-device Safari, VoiceOver, storage quota/eviction, native share sheets, and universal-link delivery.
- Hosted owner/non-owner/blocked/anonymous RLS and RPC behavior.
- End-to-end OAuth provider completion in the private preview.
- Connected owner-only preview screenshots and hosted console/log checks.
- Original/raw Apple beta comments, screenshots, metadata, and a post-July-27 refresh.
- Production data, migrations, functions, access controls, and deployment.

## Exact next three actions

1. Backend/Security drafts and reviews exact friendship-accept and server-time check-in migrations/RPCs plus denial/privacy DB tests; no apply without exact-filename and auth/privacy approval.
2. Founder/Security provisions seeded non-production accounts and reconnects the owner browser; QA runs the live RLS/access and hosted desktop/mobile console/screenshot matrix.
3. Backend owner designs the atomic crew-membership RPC and failure-injection contract; after approval, update the client and rerun focused plus full suites.
