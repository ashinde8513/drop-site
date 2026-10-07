# Public discovery and ticket path — 2026-10-07

- Owner: `codex/ticket-path-20261007`, session `01a11719-8eef-7a43-8cac-7f68956e4f80`. Exclusive new public website lane; existing app/email, affiliate attribution, recovery, backend, and `/app/next` holds preserved.
- Base: fresh canonical `ashinde8513/drop-site` main `5b41b5bad4ee7867cc0848865ade4ddabebe575b`; isolated worktree.
- Defects: `opts.to` was discarded before query serialization; old discovery responses could replace current filters/errors; price redraw could resurrect cached cards during a newer request or error. Live Tonight results included October 8–10 shows on October 7; live `data.js` matched base bytes.
- Fix: serialize upper date bound in shared fetcher; use current request identity for success, error, and cached price rendering. No dependency, backend, auth, affiliate identity, CI/workflow, or migration change.
- Regression proof: unchanged source failed missing `and` and three late-response permutations; cache regression failed before its guard. Final five scenarios cover Tonight/weekend/month, late success/error, and pending/error price changes on desktop Chromium and mobile WebKit.
- Local checks: 20 Node contracts, dist/source parity, Android association build contract, and diff check pass. Final 254-case browser run: 253 passed; one unrelated cookie case had localhost Etix SVG `ERR_CONNECTION_RESET`, focused serial verification passed all 12 selected desktop/mobile cases unchanged.
- Review: independent correctness, refuter, security reviewers approved exact production/test hashes. Refuter exercised 16 response/mode combinations, page resets and cache recovery against actual source.
- Live preflight: Codex browser used because connected Chrome unavailable/Mac locked. Madeon `2ff0192b-a9de-44eb-8739-bc89ae0671bf` renders date/venue, safe sponsored AXS link and mobile sticky CTA; AXS destination independently confirms October 8, 9 PM, Mission Ballroom. No purchase/auth/account/data write.
- Boundaries: mobile-repo migration drift remains unrelated; no schema action. Physical Safari and authenticated production writes are not verified by fixtures. AXS popup handoff is not observable through Codex browser; destination was opened directly from exact inspected href.
- Exact next step: PR exact-head `Test & Deploy` → merge after nonempty green tests → automatic main deployment → byte provenance and live desktop/mobile filter/search/location/detail/ticket QA → project closeout and claim release.

- Documentation correction: fresh mobile `origin/main:DropApp/app.json` at `e6b703a31778f31cecbb9aba1fd5488258ab35b4` already excludes www from Android intent filters; obsolete website next action corrected, with native delivery/install/device evidence kept separate.
