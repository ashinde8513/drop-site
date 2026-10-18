### SEO guides (2026-10-18)
- **Changed:** 10 fact-checked evergreen guides at /guides/<slug> + /guides index, generated from guides/src/*.md by scripts/build-guides.mjs (Article + FAQPage JSON-LD, numbered sources, verified date). Sitemap, llms.txt and the city "More in" block link them.
- **Tested:** node --test (guides up to date, citations resolve, FAQ answers visible, renderer escaping), Playwright smoke for /guides and one guide.
- **Remaining:** guide typography QA in the design project (spec D14).
- **Next steps (ranked):**
  1. After editing any guides/src/*.md, run `node scripts/build-guides.mjs` and commit the output; tests/guides.test.mjs fails when it is stale.
  2. Refresh each guide's `last_verified` by re-checking its sources before 2027-04-18.
