# drop-web-app — Agent Rules

Drop's **web app** (the website at trydropapp.com): public event/artist discovery pages,
link-in-bio hub, and affiliate/legal pages. This is one of Drop's two front-end surfaces;
the other is the **mobile app** (`../drop-mobile-app`). Both render the same content because
both read the same backend (Supabase `ebccwnkmsnhbljxxxdej`, versioned in `../drop-backend`) —
only the access method differs (website vs. native app). (This repo was formerly `drop-landing`.)

## Read first

Before meaningful work, every agent must read:

1. `PROJECT_STATE.md`
2. This `AGENTS.md`
3. `CLAUDE.md` (project-specific rules)
4. `DESIGN.md` / `PRODUCT.md` for brand/product context
5. Obsidian project page: `[[drop-landing]]`

## Source of truth

- Current implementation: this repo deployed via GitHub Pages / static hosting.
- Current handoff: `PROJECT_STATE.md`.
- Cross-project memory: Obsidian project page.

## Operating rules

1. Keep pages fast and accessible — no heavy JS frameworks unless justified.
2. FTC disclosures must remain on all affiliate/partner pages.
3. Never commit secrets or API keys.
4. Run Playwright tests before declaring work done.
5. Update `PROJECT_STATE.md` after meaningful work.

## Validation

```bash
npm test
npx playwright test
```

## Multi-Agent Handoff Protocol
Worked on by multiple agents (Claude, Codex, Hermes), possibly concurrently.
### Start
1. Read PROJECT_STATE.md; check live claims: `python3 ~/Developer/agent-stack/scripts/session_claim.py list`.
2. Sessions auto-isolate in their own worktree (dev-session.zsh) — no global lock. If a live claim already covers the feature you intended, pick different work or coordinate.
3. Record Working on (<feature> on <branch>) in PROJECT_STATE.md SESSION LOCK.
### End
1. Commit/push your code (or open a PR via ship.sh).
2. Update PROJECT_STATE.md: add a Recent-sessions entry; update Exact next step; set SESSION LOCK status.
3. The vault mirrors PROJECT_STATE.md automatically (now per-branch).

## Command Center closeout

The repo-local docs here are the single source of truth. `AI Agents/Operations/Command Center.md`, its per-project priority pages, `command-center.json`, and the Ops kiosk are generated mirrors — never hand-edit them.

At closeout, after meaningful work:
- Update `PROJECT_STATE.md` — exact next step, current status, and a Recent-sessions note.
- Update `BACKLOG.md`/roadmap only if priorities or scope changed; `DECISIONS.md` only for durable decisions.
- To mark a dashboard item done, resolve it in the SOURCE — remove the line from `PROJECT_STATE.md`'s "Blocked / waiting on" (or set it to None), write the new exact next step, or flip the item's status in `FOUNDER_ACTION_QUEUE.md` (if the project has one).

Nothing auto-detects completion; the source doc is the only signal. The Command Center (heartbeat, ~30 min) and Ops kiosk (~3 min) regenerate from these docs and fade resolved items out on their own.
