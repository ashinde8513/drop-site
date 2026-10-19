import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { brotliCompressSync, constants } from 'node:zlib';

// Page-weight budget, enforced in the required test job (so it gates deploys).
// Counts what blocks or boots a page: its HTML plus same-origin stylesheets and
// scripts, brotli-compressed as Cloudflare serves them. 2026-10-19 baseline:
// public pages 36–45 KB, app shell 81 KB. Raise a budget only on purpose.
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const br = (buf) => brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const BUDGET_KB = { public: 50, app: 95 };
const IMAGE_MAX_KB = 150;

function weight(page) {
  const html = read(page);
  const refs = [...html.toString().matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/[^"?#]+)|<script[^>]+src="(\/[^"?#]+)"/g)].map((m) => m[1] || m[2]);
  let bytes = br(html);
  for (const ref of refs) {
    const local = ref.replace(/^\//, '');
    const path = page.startsWith('app/') && !local.startsWith('app/') && !localExists(local) ? 'app/' + local : local;
    bytes += br(read(path));
  }
  return bytes;
}
function localExists(path) { try { statSync(new URL(path, root)); return true; } catch { return false; } }

test('every page stays inside its compressed page-weight budget', () => {
  const pages = readdirSync(root).filter((f) => f.endsWith('.html') && !f.startsWith('google'))
    .concat(readdirSync(new URL('guides/', root)).filter((f) => f.endsWith('.html')).map((f) => 'guides/' + f), ['app/index.html']);
  const over = [];
  for (const page of pages) {
    const kb = weight(page) / 1024;
    const limit = page.startsWith('app/') ? BUDGET_KB.app : BUDGET_KB.public;
    if (kb > limit) over.push(`${page}: ${kb.toFixed(1)} KB > ${limit} KB`);
  }
  assert.deepEqual(over, [], 'page-weight budget exceeded');
});

test('no first-party image is heavier than the image budget', () => {
  const heavy = [];
  const walk = (dir) => {
    for (const name of readdirSync(new URL(dir, root))) {
      const path = dir + name;
      const stat = statSync(new URL(path, root));
      if (stat.isDirectory()) walk(path + '/');
      else if (/\.(png|jpe?g|webp|gif|svg|avif)$/i.test(name) && stat.size / 1024 > IMAGE_MAX_KB) heavy.push(`${path}: ${(stat.size / 1024).toFixed(0)} KB`);
    }
  };
  walk('assets/');
  // og-* are social share cards that pages never load.
  for (const f of readdirSync(root)) if (/\.(png|jpe?g|webp|svg)$/i.test(f) && !f.startsWith('og-') && statSync(new URL(f, root)).size / 1024 > IMAGE_MAX_KB) heavy.push(f);
  assert.deepEqual(heavy, [], 'image budget exceeded');
});
