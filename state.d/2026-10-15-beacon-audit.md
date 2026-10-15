# Website beacon audit — 2026-10-15

Owner: Codex `01a13e34-aa5d-79d1-b2e5-be65c321405e`.
Branch: `codex/website-beacon-audit-20261015`; source reference `47e6d918`.

- Completed the unclaimed read-only Cloudflare analytics backlog item after
  inspecting current Claude sessions, claims, PRs, and fresh website main.
- Live seven-case Chromium/mobile-WebKit capture proves RUM before consent,
  after Essential only/reload, and Crew path inclusion despite no-referrer.
  Query/fragment markers absent from decoded bodies. All attempted beacons
  intercepted locally; no test analytics delivered.
- Build passed (66 files, tracked output unchanged); focused unchanged Crew
  contracts 3/3 pass; zero captured page/console errors or warnings and no
  document overflow. Scope is docs only; PR CI and independent review are
  tracked at publication. No claim of repaired production behavior.
- Independent adversarial review approved the documentation against the
  saved evidence: seven cases, capture hash, new reload payloads after
  Essential only, Crew path inclusion, marker exclusions, redaction, and
  delivery/coverage boundaries verified. Reviewer made no edits or live
  requests and did not independently rerun browser/build checks.
- Read [the complete audit](../docs/qa/cloudflare-beacon-audit-2026-10-15.md)
  for evidence, hashes, test cases, limits, and primary documentation.
- Exact next action: inspect authoritative Pages/zone injection settings and
  prepare the minimum disable/readback packet. A live privacy setting change
  requires the user's exact approval. No competing mobile/CI/analytics lane
  or speculative consent loader was started.
- Provider access: separate connected Chrome dashboard tab redirects to
  `/login`. Saved-profile screen is readable; no configuration, sign-in,
  grant, or toggle occurred. Tab kept for user sign-in; this is an access
  blocker, not an inferred settings value.

Startup reconciliation identified mobile primary/source migration-baseline
drift. This lane used fresh website main and no migration state; it neither
baselined nor modified that unrelated mobile drift.
