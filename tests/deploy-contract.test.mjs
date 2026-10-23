import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { verifyAndroidAssetLinks } from '../scripts/verify-android-assetlinks.mjs';

const EXPECTED_ASSETLINKS = `${JSON.stringify([
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: 'app.resonanceventures.drop',
      sha256_cert_fingerprints: [
        'E3:15:2D:04:79:CB:20:91:35:16:7C:88:DA:77:07:AE:3D:71:E5:87:C5:97:94:7C:EA:BC:E2:2D:77:5F:A1:F2',
      ],
    },
  },
], null, 2)}\n`;

test('Android DAL deploy verification rejects a missing built artifact', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'drop-dal-contract-'));
  const sourcePath = join(fixture, 'assetlinks.json');
  const missingDeployPath = join(fixture, 'dist-assetlinks.json');

  try {
    writeFileSync(sourcePath, EXPECTED_ASSETLINKS);
    assert.throws(
      () => verifyAndroidAssetLinks(sourcePath, missingDeployPath),
      /ENOENT/,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('CI browser image matches the locked Playwright version and pins its digest', () => {
  const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  const image = workflow.match(/image: mcr\.microsoft\.com\/playwright:v([\d.]+)-noble@sha256:[a-f0-9]{64}(?=\s|$)/);
  assert.ok(image, 'Use the official Playwright image with an immutable digest');
  assert.equal(image[1], lock.packages['node_modules/@playwright/test'].version);
});

const readRepo = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('static and Function responses share one security header baseline', async () => {
  const { SECURITY_HEADERS, htmlResponse } = await import('../src/entity-seo.mjs');
  const block = readRepo('_headers').match(/^\/\*\n((?:[ \t]+[^\n]+\n)+)/m)?.[1] || '';
  const response = htmlResponse('<p>x</p>');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.equal(response.headers.get(name), value, name);
    // Pages already sends nosniff + strict-origin-when-cross-origin on static files.
    if (name === 'X-Content-Type-Options' || name === 'Referrer-Policy') continue;
    assert.ok(block.includes(`${name}: ${value}`), name);
  }
});

test('partner upload short links redirect to the two Google Forms', () => {
  const redirects = readRepo('_redirects');
  assert.match(redirects, /^\/submit\s+https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform\s+302$/m);
  assert.match(redirects, /^\/send\s+https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform\s+302$/m);
});

test('legacy routes land on pages that exist', () => {
  const redirects = readRepo('_redirects');
  assert.match(redirects, /^\/plan\/\*\s+\/share-plan\s+200$/m);
  assert.match(redirects, /^\/onboarding\s+\/download\s+302$/m);
  assert.doesNotMatch(readRepo('data.js'), /\/venue\.html\?name=/);
});
