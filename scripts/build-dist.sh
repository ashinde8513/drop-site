#!/usr/bin/env bash
# Assemble the deployable site into dist/ — the exact mirror that used to be
# maintained by hand before deploys. Used as the Cloudflare Pages build
# command (output directory: dist) so Git-connected deploys publish ONLY the
# site, never internal docs (PRODUCT.md, DESIGN.md, CLAUDE.md, history/,
# design-drop/, tests, configs).
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf dist
mkdir -p dist

# Pages + root assets (explicit whitelist — add here when shipping new files).
cp ./*.html dist/
cp ./*.css ./*.js dist/
cp favicon.ico favicon.png favicon.svg og-image.png og-image.svg og-image-link.png og-image-link.svg dist/
cp sitemap.xml robots.txt llms.txt dist/
cp _headers _redirects dist/

# Directories the live site serves.
cp -R .well-known app vendor dist/

# Signed-in parity preview. This stays beside the current /app runtime until
# every production-reachable mobile feature has passed parity QA.
npm run build:webapp

# Sites serves the same static build through its asset binding.
mkdir -p dist/server
cp workers/sites-preview/worker.js dist/server/index.js

# Sites binds static files from dist/client; Cloudflare Pages still serves dist/.
mkdir -p dist/client
for site_path in dist/* dist/.well-known; do
  case "$site_path" in
    dist/client|dist/server) continue ;;
  esac
  cp -R "$site_path" dist/client/
done
test -f dist/client/app/next/index.html

echo "dist/ built:"
find dist -type f | wc -l
