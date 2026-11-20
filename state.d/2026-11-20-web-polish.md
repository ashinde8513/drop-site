# 2026-11-20 — Web polish lane (Claude)

Lane resumed on the MacBook after the Mac mini ran out of memory; this note closes the mini lane's work.

## Shipped (all merged to `main`, deployed, live-verified)
- #241 Keyboard focus ring on nav search and genre pills (WCAG 2.4.7).
- #243 Regenerated guides and newsletter drafts after the nav search change (fixed `main` test).
- #244 Underlined inline links on legal and guide pages (`.doc p a`, `.doc li a`), with a Playwright check. #242 was closed as a stale-head duplicate of #244.

## Live proof (2026-11-20, after Test & Deploy run 44796552642)
- `https://trydropapp.com/site.css` contains the `.doc p a:not(.btn), .doc li a:not(.btn)` underline rule.
- `https://trydropapp.com/events` has no inline `outline:none`; `shell.css` has the `#nav-q:focus-visible` rule.
- Not checked: rendered ring/underline in a browser (code-level proof only).
- Home page title, description and OG tags present; `/`, `/events`, `/sitemap.xml`, `/robots.txt` return 200.

## Not done
- Signed-out Going counts/comments on event pages: access rules not reviewed; any change needs a backend/RLS packet to the Main coordinator.
- Desktop/mobile and light/dark browser audit, city pages, event structured data: not run.
- `drop-web-rebuild`: no changes from this lane.

## Exact next step
- Audit event and city pages in Chrome (structured data, mobile width, dark mode) and fix top issues as small PRs.
