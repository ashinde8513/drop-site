# Search discovery source — 2026-09-25

- Owner: isolated `codex/drop-site-seo-20260925` branch; PR #114.
- Change: align six public discovery pages with extensionless canonical routes and render city/genre query metadata in initial HTML. Curated city URLs redirect case variants and reject unknown cities; unsitemapped city/genre combinations use `noindex, follow`.
- Local verification: 20 Node tests, 234 Playwright cases, Pages Functions build, and local Wrangler route readbacks passed. Independent review found no remaining actionable issues.
- Exact next step: Check PR #114 required `Test & Deploy` run for the final head, merge after green, then verify the main deploy and read live initial HTML for `/events`, `/city?city=Los%20Angeles`, and `/genre?genre=Drum%20%26%20Bass`.
