# drop-landing — Agent Rules

Drop App landing site at trydropapp.com: marketing pages, link-in-bio hub, and affiliate/legal pages.

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
