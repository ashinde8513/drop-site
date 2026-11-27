# 2026-11-27 security audit round 4: hidden-host links, share-image redirects, HEAD on /og

- `data.js` `Drop.safeUrl` and `src/entity-seo.mjs` `safeHttpUrl` refuse `user@host` URLs. `https://ticketmaster.com:x@evil.example/` showed a trusted seller name in a "Get tickets" or artist link and opened another site. Same rule as the web app (`drop-web-rebuild` PR 55) and the mobile app.
- `src/og-image.mjs`: `/og/event` follows redirects by hand, at most 3 fetches per image, and every hop must be https with no `user@host`. Before, a stored image URL could bounce the Worker to an `http://` address.
- `functions/og/event` and `functions/og/card`: HEAD is answered from the GET cache entry (`headAsGet`). Before, HEAD skipped the edge cache, so every HEAD repeated up to 3 upstream image fetches or a card render.
- Not changed: the image host is still any https host (venue sites supply art from many hosts, so no host allowlist). `/freshness.json` is still uncached. Rate-limit rules for `/og/*`, `/search` and `/csp-report` remain a Cloudflare dashboard step.
- Tested: `node --test tests/og-image.test.mjs tests/entity-seo.test.mjs tests/deploy-contract.test.mjs`: 50 pass (3 new tests). Not run locally: `tests/og-card.test.mjs` (needs installed packages) and Playwright; both run in CI.
- Next: after the auto-deploy, `curl -sI https://trydropapp.com/og/event/<published event id>` twice and confirm the second answer carries the edge cache header. If a share image regresses, revert this commit.
