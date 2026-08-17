#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const EXPECTED_ASSOCIATION = [
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
];

export function verifyAndroidAssetLinks(
  sourcePath = '.well-known/assetlinks.json',
  deployPath = 'dist/.well-known/assetlinks.json',
) {
  const source = readFileSync(sourcePath);
  const deployed = readFileSync(deployPath);

  assert.deepEqual(deployed, source, 'deployed assetlinks.json must be byte-identical to its source');
  assert.deepEqual(
    JSON.parse(source.toString('utf8')),
    EXPECTED_ASSOCIATION,
    'assetlinks.json must contain the exact approved Play signing identity',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyAndroidAssetLinks();
  console.log('Android Digital Asset Links deploy contract verified.');
}
