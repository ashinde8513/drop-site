# Web app design specs

Written 2026-10-19 from `docs/audit/2026-10-19-webapp-parity-gaps.md`. Plain-English specs for a designer. Nothing here is built. All six go to the Claude design project "Drop Website" (`5b6f000f-c206-44b6-ab8a-5981e36f2af9`).

| # | Spec | Ranked gap | Status |
|---|---|---|---|
| 01 | [Multi-seller ticket sheet](webapp-01-multi-seller-ticket-sheet.md) | #3 | prepared, awaiting design |
| 02 | [Honest empty and "Get the app" states](webapp-02-honest-empty-get-the-app-states.md) | rows 33-36, 41, 46 | prepared, awaiting design |
| 03 | [Social surfaces: friends, public profile, plan and chat, block/report](webapp-03-social-surfaces.md) | #4, #5, #7, #8 | prepared, awaiting design |
| 04 | [Discover map](webapp-04-discover-map.md) | #12 | prepared, awaiting design |
| 05 | [Recap composer and share card](webapp-05-recap-composer-share-card.md) | #10 | prepared, awaiting design |
| 06 | [Drop+ plan card contrast](webapp-06-drop-plus-card-contrast.md) | axe `color-contrast` | prepared, awaiting design |

Every spec follows the 19 rules in `~/.claude/design/ui-best-practices/UI-BEST-PRACTICES.md` and uses the classes and tokens in `app/app.css` and `app/tokens.css`. Backend contracts are copied from the native app source and the live-grants audit; anything not confirmed is marked **unverified**.
