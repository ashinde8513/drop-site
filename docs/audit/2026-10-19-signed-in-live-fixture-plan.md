# Signed-in live verification fixture for app.trydropapp.com (plan, 2026-10-19)

Status: plan only. Nothing is created, seeded or wired yet. Approval item: weekly `APPROVALS.md` → **W28**.

## Why
Every signed-in web-app feature shipped in parity batches 1–3 is verified only against the fake Supabase stub in Playwright. That covers the inbox (`alerts`), Seen history (`logged_shows`), saves, notification prefs, friends, ratings (`show_ratings`) and blocked accounts (`user_blocks`). Live checks so far are anonymous only. Agents may not type credentials into production, so the live check has to run as a CI job that reads a secret. It must not run in an agent's browser.

## Fixture account (reuse, don't invent)
- Reuse the **disposable, phone-verified E2E account** the native nightly already expects (Keychain items `drop-e2e-maestro-email` / `-password`; the email item exists on the Mac mini, value not read). It must be listed in `private.internal_accounts` so growth metrics exclude it (`docs/growth-analytics.md` in Drop-App). If that account is still `e2ewebqa` with no verified phone, verify a phone on it first. That is a founder step: no faked phone ownership, no founder account.
- One account only. `user_blocks` needs a second profile to block, so pick an existing internal account (e.g. `ravewithmaya`) as the block target. Never use a real user.

## Seed (production data, owned by the fixture; idempotent)
One SQL file, run once, then re-runnable. It uses fixed UUIDs, `on conflict do nothing`, and touches only the fixture's `user_id`:
| Table | Rows | Purpose |
|---|---|---|
| `alerts` | 2 (1 unread "Fixture alert A", 1 read "Fixture alert B") | inbox renders, badge shows, mark-read works |
| `logged_shows` | 2 in different years ("Fixture Act 2024", "Fixture Act 2025") | Seen history groups by year |
| `attendance` | 1 `attended` on a past published event | ratings allowed by RLS (`has_attended_event`) |
| `show_ratings` | 1 private, rating 8, no notes | rating hydrate shows 4★ |
| `user_blocks` | fixture → internal block target | Blocked accounts list |
Mark-read and unblock change state, so the job re-runs the seed first (restores `read=false`, re-inserts the block). Rollback: `delete … where user_id = <fixture>` on each table, listed in the same file.

## Runner and secret placement
- New workflow `live-signed-in.yml` in drop-site: `workflow_dispatch` plus a post-deploy trigger. It runs `tests/live-signed-in.spec.ts` against `https://app.trydropapp.com` with `DROP_FIXTURE_EMAIL` / `DROP_FIXTURE_PASSWORD` from a GitHub **environment** secret (`live-fixture`, required-reviewer off, main-only). drop-site CI runs on GitHub-hosted runners today; this job stays there. Do not borrow the Drop-App `drop-pr` / `drop-control` runners.
- The spec is read-mostly: log in → assert inbox shows both fixture alerts and the badge → open Seen history and assert 2025 before 2024 → My Shows Past shows "You rated 4★" → Settings › Blocked accounts lists the block target → log out with `scope:'local'`. It writes only through the reseed step.
- The spec skips itself when the env vars are absent, so PR runs and forks never see the secret.

## Approvals needed (W28)
1. Confirm the fixture account (Keychain item above) and the internal block-target account.
2. Production data: run the seed file for that one account (and re-run it before each live job).
3. Secret write: add `DROP_FIXTURE_EMAIL` / `DROP_FIXTURE_PASSWORD` to a drop-site `live-fixture` environment through `paste-secret` (never in chat).
After approval: build the workflow + spec in one PR, run it once, and record the run URL in `PROJECT_STATE.md`.
