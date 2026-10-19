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
cp favicon.ico favicon.png favicon.svg social-icons.svg og-image.png og-image-link.png dist/
cp sitemap.xml robots.txt llms.txt tiktok3KrSWG3sUOucxtykK5XlHMXDu5JZXf7J.txt tiktok3vSsOjcdAwZqkeershAZQumPuThIJ0JS.txt dist/
# IndexNow key file (public by design; key in Keychain INDEXNOW_KEY_DROP).
for f in ./*.txt; do case "$(basename "$f")" in [0-9a-f][0-9a-f][0-9a-f][0-9a-f]*[0-9a-f].txt) cp "$f" dist/ ;; esac; done
cp _headers _redirects _routes.json dist/

# Directories the live site serves.
cp -R .well-known app assets vendor okf guides dist/
rm -rf dist/guides/src # markdown sources are not published
# Newsletter: only approved issues (newsletter/published.json) ever ship;
# newsletter/drafts/ and newsletter/src/ stay out of the deploy.
if [ -n "$(ls newsletter/live 2>/dev/null)" ]; then mkdir -p dist/newsletter && cp newsletter/live/*.html dist/newsletter/; fi
# app.trydropapp.com maps file-like requests into /app/. Keep the exact TikTok
# verification artifacts available there from their tracked root sources.
cp tiktok3KrSWG3sUOucxtykK5XlHMXDu5JZXf7J.txt tiktok3vSsOjcdAwZqkeershAZQumPuThIJ0JS.txt dist/app/

echo "dist/ built:"
find dist -type f | wc -l
