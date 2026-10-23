import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Spec 05 card rules: layouts for 1–4 photos, the card's text alternative,
// and the file checks (A52: photos stay on the device).
const R = createRequire(import.meta.url)('../app/recap.js');

test('photo layouts match the Card-Frames board', () => {
  assert.deepEqual(R.cells(1, 0), [[0, 0, 1, 1]]);
  assert.deepEqual(R.cells(2, 0), [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]]);
  const three = R.cells(3, 0);
  assert.equal(three.length, 3);
  assert.equal(three[0][2], 1, 'the first of three spans the width');
  assert.ok(Math.abs(three[0][3] - 1.3 / 2.3) < 1e-9, 'rows 1.3fr / 1fr');
  assert.deepEqual(R.cells(4, 0), [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]]);
  for (const n of [1, 2, 3, 4]) for (const [x, y, w, h] of R.cells(n, 0.02)) assert.ok(x + w <= 1 + 1e-9 && y + h <= 1 + 1e-9);
});

test('card text alternative names show, venue, date, rating only when set, and the photo count', () => {
  assert.equal(R.cardLabel({ artist: 'ODESZA', venue: 'Red Rocks', date: 'Oct 23, 2026', rating: 4, photos: 3 }), 'Recap card: ODESZA, Red Rocks, Oct 23, 2026, 4 stars, 3 photos.');
  assert.equal(R.cardLabel({ artist: 'ODESZA', venue: 'Red Rocks', date: 'Oct 23, 2026', rating: 0, photos: 1 }), 'Recap card: ODESZA, Red Rocks, Oct 23, 2026, 1 photo.');
  assert.equal(R.metaLine('Red Rocks', 'Oct 23, 2026'), 'Red Rocks, Oct 23, 2026');
  assert.equal(R.slug('Fred again.. & Friends (Live)'), 'fred-again-friends-live');
});

test('files: images under 10 MB and videos pass; anything else gets the board copy', () => {
  assert.equal(R.fileError({ type: 'image/jpeg', size: 1e6, name: 'a.jpg' }), null);
  assert.equal(R.fileError({ type: '', size: 1e6, name: 'IMG_1.HEIC' }), null, 'HEIC without a type (Chrome)');
  assert.equal(R.fileError({ type: 'video/quicktime', size: 5e8, name: 'a.mov' }), null);
  assert.equal(R.fileError({ type: 'image/png', size: 11 * 1024 * 1024, name: 'big.png' }), R.FILE_ERROR);
  assert.equal(R.fileError({ type: 'application/pdf', size: 10, name: 'a.pdf' }), R.FILE_ERROR);
  assert.equal(R.FILE_ERROR, "That file didn't work. Use a JPG, PNG, or HEIC photo under 10 MB.");
});
