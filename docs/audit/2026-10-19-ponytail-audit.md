# Drop website — ponytail audit (2026-10-19)

Worktree `drop-website-wt-audit-20261019`, branch `claude/site-audit-20261019` @ origin/main `c0a083e`. Read-only; nothing applied.
Tools: manual grep reference sweeps, a scripted export/function-usage scan, `wc`/`du`, and a scratch-copy `build-dist.sh` run (dist size). `knip` / `depcheck` NOT available offline (not installed anywhere; not installed). Unverified: unused CSS selectors, unused app/app.js internals (only top-level `function` names scanned, none found dead), sitemap.xml tests.

## 1. Repo shape
| metric | value |
|---|---|
| tracked files | 182 |
| shipped files (build-dist) | 83 files, 2.8 MB (og-image.png 680K, app/ 564K, guides 268K, assets 224K, vendor 204K) |
| in repo, not shipped | ~99 files: tests (23), docs/, history/, design-drop/, state.d/, newsletter/*, guides/src, md docs, configs |
| LOC app/ | 7,425 (app.js 3,619; index.html 3,240; app.css 473) |
| LOC root html / js / css | 6,180 / 1,359 / 1,571 |
| LOC functions + workers | 266 + 51 |
| LOC src/ (edge SEO modules) | 1,111 |
| LOC scripts/ | 316 |
| LOC guides html / newsletter | 3,145 / 761 (generated outputs, committed) |
| LOC tests | 4,303 (59 node:test cases in 8 files; ~130 playwright `test()` x 2 projects) |
| LOC docs+history+design-drop+state.d | ~1,090 (+ PROJECT_STATE.md 898 lines / 158 KB) |
| deps | 1 devDep (`@playwright/test`), 0 runtime. lockfile 78 lines. node_modules: none in this worktree; sibling repo 17 MB |

## 2. Ranked findings
Rank = LOC removed x confidence. "Proof" = the test that shows behaviour unchanged.

| # | kind | what + where | evidence | change | -LOC | risk / proof | blast radius |
|---|---|---|---|---|---|---|---|
| 1 | duplicate logic | `FAKE_SUPABASE` stub x5 byte-identical (23 lines each, md5 `fe56eebf...`): `tests/a11y-nonvisual.spec.ts:3-25`, `app-lazy-art.spec.ts:5-27`, `app-accessibility.spec.ts:3-25`, `a11y-wave5.spec.ts:3-25`, `app-honest-copy.spec.ts:5-27`. The 3 route stubs (supabase/consent/fonts/rest) repeat in each `beforeEach` (`a11y-wave5:28-31`, `app-accessibility:28-31`, ...). 3 more divergent variants (auth-input 38, event-intent 57, signup-phone 108 lines) | md5 of the 5 blocks equal; no shared helper exists (`grep "import .* from './"` in tests/*.ts = 0) | new `tests/_fake-supabase.ts` exporting stub + `stubApp(page)`; import in 5 specs | ~100 | none; `npx playwright test tests/a11y-nonvisual.spec.ts tests/app-lazy-art.spec.ts tests/app-accessibility.spec.ts tests/a11y-wave5.spec.ts tests/app-honest-copy.spec.ts` | tests only, no deploy surface |
| 2 | stale doc / dead scratch | `design-drop/shell-test.html` (3.4 KB) + `design-drop/app-port-check.png` (258 KB) | `grep -rn "shell-test\|app-port-check"` = 0 hits outside themselves; last touched by the redesign import (75568e9); not in build-dist | delete both (keep `INGEST_PLAN.md`) | ~100 (+260 KB) | none; `npm test` | none (never shipped) |
| 3 | stale doc | `PROJECT_STATE.md` 898 lines / 158 KB. `.project-os.json` says `keep_inline_sessions: 3` and `history/sessions.md` exists (56 lines) but state holds ~25 "SHIPPED/REVIEWED" blocks back to Sept | file size; AGENTS/global rule: state is lean, history archived | move entries older than the newest 3 waves to `history/sessions.md`; keep SESSION LOCK, What works (current), Exact next step | ~700 | none; `tests/*` do not read it (`grep PROJECT_STATE tests` = 0, verify before PR) | docs only; **owned by live claim holders per AGENTS (session lock) - coordinate** |
| 4 | duplicate logic | `functions/venue/[[path]].js` vs `functions/artist/[[path]].js`: 23 vs 24 lines, identical shape (405 guard, routeId, get, canonical redirect, view, 503 catch). Same 405+`edgeCached` preamble also in `city.js`, `genre.js`, `search.js`, `events.js`, `index.js` | side-by-side read | `entityRoute({template, get, pathOf, view, rootId, label})` factory in `src/entity-seo.mjs` | ~35 | low; `node --test tests/entity-seo.test.mjs tests/go-route.test.mjs tests/search.test.mjs` + smoke venue/artist pages | **live edge Functions** `/venue/*`, `/artist/*`; `_routes.json` includes them |
| 5 | stale doc | `design-qa.md` (root, 2.7 KB): QA notes pointing at `/tmp/codex-remote-attachments/...` and `/private/tmp/*.png` paths that no longer exist | `grep -rn design-qa` = 0 refs | delete | 40 | none | none |
| 6 | stale / tracked-generated | `dist/_headers` (19 lines) + `dist/_redirects` (24) tracked via `.gitignore` `!dist/_...` exceptions. They differ from the root files (older: `.html` targets, no security headers). `build-dist.sh` does `rm -rf dist` first, so they are never used | `diff dist/_headers _headers`; `grep "dist/" tests scripts .github` = only index/sanity checks, none read these | `git rm` both; drop the two `!dist/...` lines in `.gitignore` | 43 + 2 | none; `bash scripts/build-dist.sh` then `diff dist/_headers _headers` empty; `npm test` | trap removal only: a human running `wrangler deploy dist` without a build would have shipped stale redirects. Never ships from git. |
| 7 | dead code | `Drop.dateBlock` in `data.js:595-599` | only hit repo-wide (`grep -rnw dateBlock`) is its definition | delete | 6 | none; `npx playwright test tests/smoke.spec.ts` | ships in `data.js` on every page and `app.trydropapp.com` (Worker passes `/data.js` through) |
| 8 | needless export | 8 symbols exported but used only inside their own file: `genrePath`, `liveGenres` (`src/acquisition-seo.mjs:85,90`), `inWeekend`, `weekendPath`, `FESTIVALS_PATH` (`src/editorial.mjs:52,150,153`), `HOME_CITY`, `fmtDate`, `fmtPrice` (`src/home-lcp.mjs:9,77,91`) | scripted scan over `functions src scripts tests workers`: 0 importers | drop `export` | 0 (API surface -8) | none; `node --test tests/*.test.mjs` | none |
| 9 | config bloat | Unused npm scripts `test:ui`, `test:headed`, `report` (`package.json:8-10`) - no workflow/doc reference (only the CLAUDE.md prose mention of `npm test`) | `grep "test:ui\|test:headed\|npm run report"` | delete 3 lines (plus stale comment `playwright.config.ts:3-6` "Reusable template: copy...") | ~8 | none; `npm test` | none. **package.json is inside the audit claim scope** |
| 10 | config bloat | `sitemap.xml` 45 `changefreq`/`priority` lines; Google ignores both | Google docs; unverified: tests may regex-assert them (`static-seo.test.mjs` not checked line-by-line) | strip the tags | ~45 | low; `node --test tests/static-seo.test.mjs` | live `/sitemap.xml`; verify Search Console still accepts it |
| 11 | dead shipped bytes | `og-image.svg`, `og-image-link.svg` copied by `build-dist.sh:16` but referenced by no page/meta (OG uses the `.png`s) | `grep -rn "og-image.svg"` / `og-image-link.svg` = build-dist only | stop copying (keep files as PNG sources) | 0 repo / -6 KB dist | none; `bash scripts/build-dist.sh` + `npm test` | live static root, unreferenced |
| 12 | dup token block | `site.css` (56 vars) and `app/tokens.css` (53 vars) share 50 identical custom properties | var-name intersect | **leave**: both are generated by `prism-tokens/sync.mjs` ("Do not hand-edit") | 0 | - | see do-not-touch |

Not findings (checked and lean): no runtime deps; `scripts/*` all referenced by workflow/tests; every root `.html` is referenced (sitemap/redirect/nav/tests); partner assets all referenced; every `Drop.*` method in `site.js`/`data.js` besides `dateBlock` is used (`submitCreatorApplication` is called by `creators.js`); no unused CSS custom properties in `site.css`; `functions/go.js` is a deliberate permanent QR route. Server `fmtDate/fmtPrice` in `src/home-lcp.mjs` mirror `data.js` on purpose (parity test in `tests/entity-seo.test.mjs`).

Net: about -1,000 lines (-1,100 incl. PROJECT_STATE), -0 deps possible, -260 KB repo.

## 3. Do NOT touch
- Live claim (`session_claim.py list`): `drop-site:claude/site-audit-20261019` [fable-trading-20261017] scope `docs/audit/**; package.json; package-lock.json` - this audit's own lane (scope "widens per audit"). No other live claim lists drop-site paths. Others (drop-mobile-app, drop-backend, agent-stack) are out of repo.
- `.well-known/apple-app-site-association`, `.well-known/assetlinks.json` (AASA/DAL; deploy.yml greps AASA and `verify-android-assetlinks.mjs`), `scripts/verify-android-assetlinks.mjs`, `docs/android-app-links.md`.
- `_redirects`, `_headers`, `_routes.json`, `functions/**` routing contract (`/event/*`, `/plan/*`, `/crew-picks/:id`, `/go`), `workers/app-path/**` (separate manual `wrangler deploy`, not in CI; hardcoded zone routes).
- Generated-and-committed outputs guarded by "is stale" tests: `guides/*.html` (from `guides/src`, deployed without a build step), `newsletter/drafts/*.html`, `newsletter/published.json`.
- `site.css` token block and `app/tokens.css` (generated by `prism-tokens/sync.mjs`).
- Verification/identity files: `google75d252b1adf86e07.html`, `tiktok3*.txt` (also copied into `dist/app/`), `favicon.ico`, `robots.txt`, `llms.txt`, `okf/**`.
- `docs/**`, `history/**` (deliberate archives; `docs/qa/_cloudflare-beacon-audit-2026-10-15.md` is open remediation evidence), `state.d/**`, `.impeccable/live/config.json` (tool config), `.gitleaks.toml`, `lighthouserc.json` + `lighthouse.yml`.
- `app/app.js`, `app/index.html`: shipped SPA runtime, cache-busted by `?v=` strings in index.html; any edit needs the version bump and design-first flow (design approval gates per project memory).

## 4. Dependency diet
| dep | used by | verdict |
|---|---|---|
| `@playwright/test` ^1.49.1 (locked 1.61.1) | `playwright.config.ts`, 15 `*.spec.ts`; `tests/deploy-contract.test.mjs` asserts lock version == pinned CI image tag | keep |
| `fsevents` 2.3.2 (lock only, optional darwin dep of playwright) | transitive | keep |
| `playwright` 1.61.1 (transitive) | via test runner | keep |
| `@lhci/cli@0.15.1` | `npx` in `lighthouse.yml` only (not in package.json) | keep (warn-only) |
| `wrangler-action` pinned SHA | deploy.yml | keep |

Lockfile 78 lines. node_modules: absent here; `/Users/aryashinde/Developer/Drop/drop-website/node_modules` = 17 MB (playwright + playwright-core). Unused deps: none. Only diet is deleting three npm scripts (finding 9).

## 5. Top 5 PR-sized batches
1. **Test stub dedupe** (finding 1, ~-100 LOC). Gate: `npx playwright test tests/a11y-nonvisual.spec.ts tests/app-lazy-art.spec.ts tests/app-accessibility.spec.ts tests/a11y-wave5.spec.ts tests/app-honest-copy.spec.ts`. Live: none (tests only); confirm main Test & Deploy green.
2. **Dead files** (findings 2, 5, 6, 7 = shell-test.html, app-port-check.png, design-qa.md, dist/_headers, dist/_redirects, `.gitignore` 2 lines, `Drop.dateBlock`; ~-200 LOC, -260 KB). Gate: `npm test`, then `bash scripts/build-dist.sh && diff dist/_headers _headers && diff dist/_redirects _redirects`. Live after deploy: `curl -sI https://trydropapp.com/events` shows security headers; `/login` still 302 to app host; `app.trydropapp.com` loads and `/data.js` 200.
3. **Edge function entity-route factory** (finding 4, ~-35 LOC). Gate: `node --test tests/entity-seo.test.mjs tests/search.test.mjs tests/go-route.test.mjs && npx playwright test tests/smoke.spec.ts`. Live: one known `/venue/<id>-slug` and `/artist/<id>-slug` return 200 with JSON-LD; wrong slug 301s; HEAD works; bad id 404.
4. **Export + script + comment trim** (findings 8, 9 + sitemap tags 10 + 11 stop shipping SVG; ~-60 LOC). Gate: `npm test`. Live: `/sitemap.xml` 200 and parses; OG image URLs 200 (`/og-image.png`, `/og-image-link.png`).
5. **PROJECT_STATE.md archive** (finding 3, ~-700 LOC). Gate: `bash ~/Developer/agent-stack/scripts/closeout-check.sh <worktree>` + `grep -rn PROJECT_STATE tests` empty. Docs-only commits skip deploy (`paths-ignore **.md`). Coordinate with the active owner before moving content.
