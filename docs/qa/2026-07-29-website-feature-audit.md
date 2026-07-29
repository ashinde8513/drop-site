# Drop Website feature audit — 2026-07-29

## Verdict

No known actionable Critical, High, or Medium issue is unclassified within the audited scope. Every such issue is either fixed/invalid with evidence or explicitly approval-blocked with an owner and exact next action. This is not a claim that Drop has no defects.

The owner-only preview and client deployments were not changed. Founder-approved exact migration `20260729182349_social_mutation_contracts.sql` is live in production Supabase; verified client candidates remain isolated on `qa/website-feature-matrix-20260729` and `qa/security-contracts-20260729`.

## Audited truth

- Website behavior commit: `236b665fd73f97eaef39c9884addf49240b34aef`
- Mobile/client behavior commit: `94d6b68f2a3541ba956e39d1b51368a6c38b540b`
- Hosted evidence commit: `105b2d2e83e3373103da71c6b87bfc1ed7ae0608`
- Exact migration: `20260729182349_social_mutation_contracts.sql`, SHA-256 `3c3857edc73b56f49a01dfe9db5aaad3baaa383ef3396fb216fae025d431e89f`; passed twice on QA project `jrlqozbbrbivmzazuaic`, then applied once to production `ebccwnkmsnhbljxxxdej` as version `20260729200633`, name `v20260729182349_social_mutation_contracts`
- Production evidence commit: `712bd97cbed680bf0ec38da48a5c538a82e5f190`
- Website `origin/main` merged into the audit branch: `7b9081118e3c95d89d7d127b367fba84ac3a3405`
- Mobile reference `origin/main`, read-only: `891e02c4d45f9babbe168b9598ced3e6139ed993`
- Canonical inventory: `docs/qa/feature-matrix.csv`
- Generated Excel mirror: `docs/qa/drop-website-feature-matrix.xlsx`
- Route evidence: `docs/signed-in-route-matrix.md`
- Founder source: `/Users/aryashinde/Downloads/Drop app.md/Drop app.md`
- Apple source boundary: locally preserved sanitized feedback/testing dispositions; original App Store Connect comments, screenshots, device/build metadata, and feedback after the last authorized pull were unavailable and were not reconstructed.

The dirty primary mobile checkout and unrelated TicketSauce adapter files were untouched.

## Inventory reconciliation

- Rows: 675
- Stories: 578
- Story result: `578 = 46 passed + 24 failed + 468 blocked + 13 not implemented + 27 awaiting device QA`
- Signed-in website stories: 38
- Unique preserved primary Requirement IDs: 358 (`267` founder, `91` Apple)
- Founder source coverage: all `262/262` non-empty bullet requests are preserved exactly, including both nested bullets
- Original-wording requirement-linked rows with SHA-256: 439 (`391` stories, `48` defect records)
- Defects/blockers: 97 (`1` Critical, `10` High, `58` Medium, `28` Low)
- Disposition: 20 fixed/invalid, 75 blocked/approval-required, 2 open Low measurement/maintenance risks. Friendship acceptance and check-in authorization are fixed in production; the mobile social-control accessibility defect is fixed in the candidate; crew remains blocked on corrected-client delivery because legacy direct grants and deployed multi-write clients remain.

Historical requirements use only the requested classifications: Implemented, Partial, Missing, Deprecated, Duplicate, Conflicting, or Needs clarification. Sanitized historical Apple dispositions without current direct evidence are classified Needs clarification rather than being promoted to Passed.

Founder bullets beginning `- ` are stored with a spreadsheet-safe leading apostrophe. Display hashes are grouped for readability; the generator removes that escape, normalizes the hash to 64 lowercase hexadecimal characters, and recomputes it over the preserved source wording.

## Verification run this goal

- `npm ci` — passed.
- Post-merge public smoke matrix — 104 passed.
- `npm run typecheck:webapp` — passed.
- `npm run build:webapp` — passed; Vite warned about the 764.85 kB main chunk (216.08 kB gzip), tracked as `WEB-DEF-PERF-001`.
- `npm test` — Sites preview contract passed; Playwright 295 passed and 1 intentional mobile-project skip across desktop Chromium and mobile WebKit in 53.8 seconds.
- Mobile `npm run typecheck`, `npm run lint -- --quiet`, and `npm run test:unit` — passed; 529 unit tests, including three focused accessibility contracts.
- Mobile PGlite social contract run — 10 passed against exact migration `20260729182349_social_mutation_contracts.sql`.
- Mobile iOS 26.5 Simulator build/run — passed from the generated isolated workspace; crew/report/block/unblock actions were reachable through named controls. Simulator QA is not physical-device VoiceOver QA.
- Approved production-account client journey — `e2ewebqa`, `ashinde8513`, and `ravewithmaya` proved block/unblock profile privacy and temporary crew create/delete. Final catalog readback restored both accepted friendships, the exact original Bass Squad membership, zero blocks, and zero temporary crews.
- Connected Browser candidate journey — desktop/mobile Discover alignment and uniform cards, carousel controls and keyboard behavior, shared location/search combobox typing/empty/Arrow/Enter/Escape states, website-native event detail, Stats show/artist/venue/city drill-downs, honest map empty state, and zero browser warnings/errors passed.
- Hosted Supabase QA — Free-plan branching was unavailable, so a separate $0/month clean project `jrlqozbbrbivmzazuaic` was created. Target-dependent schema signatures were compared with production catalogs; exact migration hash `3c3857ed…431e89f` applied only there.
- Hosted authorization/rollback matrix — 14 anonymous/requester/recipient/owner/non-owner/friend/nonfriend/both-block-direction/time-window/dedupe/failure-rollback checks passed twice. All fixture counts read back zero; catalog checks proved policies, trigger, column grants, fixed search path, and bounded RPC execution.
- Supabase advisors — security ERROR count is zero after test-fixture RLS alignment. Remaining warnings are intentional bounded SECURITY DEFINER RPC/helpers; remaining INFO/performance notices belong to the minimal QA fixture.
- Production Supabase apply/readback — founder-approved exact hash applied once as version `20260729200633`; project remained `ACTIVE_HEALTHY`. Migration history, RLS, recipient/pending friendship policies, old-policy removal, status-only update grant, enabled server-time/window trigger, either-direction block policy, authenticated-only fixed-search-path crew RPC, and function guards read back. Production security and performance advisors each reported zero ERRORs; target warnings are the intentionally callable bounded crew RPC and the existing own-plus-friends permissive check-in SELECT pair. The migration apply executed no application-row DML and verification queried catalogs only.
- Final website closeout rerun — `npm run typecheck:webapp` and `npm run build:webapp` passed; `npm test` passed 295 with 1 intentional skip in 55.2 seconds. The first unprivileged attempt stopped before tests because the sandbox blocked its localhost server; the approved localhost rerun passed.
- Connected owner-preview smoke — signed-in v10 Discover rendered with zero console warnings/errors. The local candidate then passed representative desktop/mobile navigation with zero console warnings/errors; plans/media/account-utility owner/non-owner authorization remains unavailable.
- Focused review regressions — rejected writes, pending states, out-of-order search, delayed navigation, combobox scrolling, and deletion-modal focus passed in both projects.
- `git diff --check` — passed.
- XLSX ZIP integrity and every worksheet XML document — passed.
- CSV-to-XLSX Feature Matrix cell equality — passed for all 675 rows.
- Every Passed story has non-empty evidence and an audited commit; every Passed website row links a passing same-commit run (`RUN-012`, `RUN-014` for `WEB-DEF-DEP-001`, `RUN-018` for production backend defects, or `RUN-020` for the mobile accessibility defect).
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
- Added explicit roles, accessible names, and checked/selected states to the mobile crew, report/block, unblock, and member-picker controls without hiding child actions behind static row containers.
- Added versioned hosted baseline/matrix SQL, first applied the exact migration to isolated QA, and recorded twice-passing zero-residue authorization/rollback evidence.
- Applied the separately approved exact hash once to production and recorded migration/catalog/grant/function/project/advisor readback without executing production application-row DML or delivering clients.
- Exercised approved block/unblock profile privacy and temporary crew create/delete, then read back exact friendship, block, membership, and zero-residue state.

## Approval-required findings

- `WEB-DEF-DEPLOY-001` (High): a non-doc push to `main` enters the production deployment workflow; owner-only access is external. Founder/Release owner must decide the release lane.
- `WEB-DEF-CREW-001` (Medium): atomic RPC and rollback tests pass and the RPC is live in production, but deployed clients still use the legacy multi-write path. Release owner must separately authorize exact corrected client heads; later direct-grant revocation is a separate reviewed cutover.
- `WEB-DEF-CI-001` (Medium): explicit TypeScript checking is not in CI. Repository/CI owner approval is required; runner labels and trust boundaries must not change.
- `WEB-DEF-TEST-001` and `WEB-BLK-BROWSER-001` (Medium): targeted social Auth-role/RLS/RPC and approved social/profile/crew client journeys pass, but remaining plans/media/account-utility owner/non-owner authorization needs explicitly approved test accounts on an exact delivered candidate or a Pro/full-schema non-production target.

The inherited mobile/backend requirement register contains additional approval-gated Critical/High/Medium findings. Their owners, reasons, and exact actions remain preserved row-by-row in the canonical matrix.

## Untested or unavailable

- Physical-device Safari, VoiceOver, storage quota/eviction, native share sheets, and universal-link delivery.
- Hosted authorization outside the targeted friendship/check-in/crew contracts; the clean Free-plan QA project intentionally contains only the catalog-matched social fixture.
- End-to-end OAuth provider completion in the private preview.
- Multi-account owner-only Sites access-control enforcement. Connected mobile/desktop candidate rendering and owner-preview console smoke passed.
- Original/raw Apple beta comments, screenshots, metadata, and a post-July-27 refresh.
- Production plans/media/account-utility owner/non-owner journeys. The approved social/profile/crew journey used only named test accounts, restored exact starting state, and left zero temporary rows.

## Exact next three actions

1. Push immutable mobile/backend and owner-only website candidate heads and require their exact self-hosted gates to pass.
2. Present the exact mobile head/release-train PR and saved undeployed Sites version for two separate Founder authorizations.
3. After the mobile merge creates an immutable release tag and provenance passes, request a distinct exact-tag OTA authorization; keep the broader plans/media/account-utility authorization rows blocked until their approved journeys run.
