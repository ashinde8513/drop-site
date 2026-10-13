# Focus indicators — 2026-09-25

- Owner: `codex/web-focus-indicators-20260925`.
- Change: removed 49 redundant inline `outline:none` overrides from focusable controls in `app/index.html`; shared `:focus-visible` rule remains the source of focus styling.
- Regression: `tests/app-accessibility.spec.ts` checks rendered public search for a solid outline; cloned mock phone, verification-code, and profile fields for 2px solid outlines.
- Local verification: `PLAYWRIGHT_BROWSERS_PATH=.../work/pw-browsers npx playwright test tests/app-accessibility.spec.ts --project=desktop --grep 'public and mocked form inputs'` passed (1 test).
- External effects: none; mocked Supabase only, no login, SMS, or account write.
- Independent review: PASS; no actionable findings.
- Exact next step: commit and push this reviewed branch, open PR, then wait for required exact-head CI before merge.
