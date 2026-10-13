# Crew canonical website companion — 2026-10-13

Owner chat: `01a13783-0fa3-7121-9e8a-517f6fa9413e`; coordinator `01a13768-04e4-7b60-9660-19e4949ee3dd`.
Isolated branch/worktree: `codex/crew-link-companion-20261013`, `/Users/aryashinde/Developer/Drop/worktrees/crew-link-companion-20261013`.
Base: `b80e0eee45591ec43d78ee80b5ec81afd848e2ad` from fetched website main. Primary preserved.

## Contract and status

- [x] PR794 owner confirmed canonical bare `https://trydropapp.com/crew-picks/<UUID>` and native `drop` scheme; builder/parser enforce RFC UUID versions 1–5/variant 8–b. Owner source checkpoint `faf793b5a199ad8c438206e4060c8053d43e301c`.
- [x] Static `/crew-picks/:id -> /download 200` install fallback preserves the browser path. Existing HTML/assets/store controls are reused unchanged. Missing/extra segments do not match. Malformed/new single segments may receive generic install content, expressly accepted by Crew owner; no identity/existence/membership inference or custom app target.
- [x] Additive source AASA `/crew-picks/*` preserves team/bundle identity and all prior association paths. No Android DAL, mobile/native, Worker or account-shell source changes.
- [x] Crew path response rules specify `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow`. No board data or preview RPC access added.
- [x] 23/23 registered Node contracts, zero skips; standard `bash scripts/build-dist.sh`, source/dist parity for routing/headers/AASA/download and Android assetlinks verifier pass.
- [x] Independent correctness/security/refuter panel: initial HTML rewrite canonicalization defect repaired by extensionless target; strict-path concern narrowed and ratified by Crew owner. Final reviews qualify bounded source, with delivery checks still open.
- [ ] Exact-head ordinary website CI: initial run `38482993065` on `3acac76` passed 23 Node and 258/260 browser cases (including both new Crew cases); the existing desktop/mobile AASA expected-path arrays lacked the new Crew path. The expectation is repaired additively, preserving every prior path; full exact-head rerun is tracked on the draft PR. Browser test emulates only the asserted static rewrite and supplies no privacy headers; it does not prove hosted Cloudflare behavior or native interception. No local WebKit binary was present, no install/browser download/dependency sharing occurred.
- [ ] Coordinator PR794 compatibility and website delivery clearance. Keep draft; no merge or public deployment from this lane.
- [ ] After standard main CI/deploy: live UUID URL 200/zero redirects, generic store content, response policy headers and AASA byte provenance; negative missing/extra path checks.
- [ ] Physical Universal/App Links using a compatible native artifact, membership/authentication and complete anonymous Crew board preview remain separate mobile/design/backend acceptance.

## Preview boundary

PR794 migration `20261013200000_crew_picks_mvp.sql` has a source-only anonymous aggregate preview contract (`get_crew_pick_preview`): board name/status/counts plus published event candidates; no roster, notes, profiles or votes. Dispatch reported migration absent in production. This companion calls no preview RPC and changes no backend privileges. Generic install metadata never implies that the board exists or that the recipient may vote.

Root authorized the normal draft website PR/automatic test lane after review, but explicitly holds merge/public deployment for combined compatibility. No new screen is introduced, so no new-screen design approval was used or inferred. Richer preview needs its own concrete approved design and activation/readback proof.

## Evidence and next action

Task output handoff: `/Users/aryashinde/Documents/Codex/2026-10-13/drop-104-crew-link-delivery/outputs/CREW-WEBSITE-HANDOFF.md` contains exact final commit/PR/CI results and artifact hashes. Node log is alongside it. On initial read-only production probe, canonical UUID URL returned 404 without redirect and live apex AASA omitted Crew paths.

Coordinator: assess this draft with PR794, obtain non-skipped exact-head website CI, then clear ordinary website delivery only when compatible. Do not substitute SPA HTTP 200, an install page, local mocks or AASA source for shared-board preview/device acceptance. Existing email/affiliate/recovery/public-catalog owners and holds remain unchanged.
