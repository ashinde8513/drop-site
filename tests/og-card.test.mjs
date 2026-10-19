import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { cardDate, cardSvg, wrapTitle, xml } from '../src/og-card.mjs';

const asset = (name) => readFileSync(new URL('../src/og-assets/' + name, import.meta.url));
const event = { id: '11111111-1111-4111-8111-111111111111', title: 'Gryffin, Oliver Heldens & <Ar/Co> at Red Rocks Amphitheatre Fall Closing', date: '2026-11-14T01:00:00Z', timezone: 'America/Denver', venue_name: 'Red Rocks', city: 'Morrison', state: 'CO' };

test('share card wraps, ellipsizes and escapes', () => {
  assert.deepEqual(wrapTitle('Short Title'), ['Short Title']);
  const lines = wrapTitle(event.title);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((line) => line.length <= 24), lines.join('|'));
  assert.ok(lines[1].endsWith('…'));
  assert.deepEqual(wrapTitle('Supercalifragilisticexpialidocious'), ['Supercalifragilisticexp…']);
  assert.equal(cardDate(event), 'Fri, Nov 13', 'venue time zone, not UTC');
  assert.equal(xml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;');
  const svg = cardSvg(event, '');
  assert.match(svg, /&lt;Ar\/Co&gt;/);
  assert.doesNotMatch(svg, /<Ar\/Co>/);
  assert.match(svg, />Fri, Nov 13 · Red Rocks</);
  assert.match(svg, />Morrison, CO</);
  assert.match(cardSvg({ title: '' }, ''), />Live show</);
});

test('share card rasterizes to a 1200×630 PNG with the bundled fonts', async () => {
  await initWasm(readFileSync(new URL('../node_modules/@resvg/resvg-wasm/index_bg.wasm', import.meta.url)));
  const png = new Resvg(cardSvg(event, asset('gradient-1200x630.jpg.bin').toString('base64')), {
    font: { fontBuffers: [asset('space-grotesk-700.ttf.bin'), asset('sora-600.ttf.bin')], loadSystemFonts: false, defaultFontFamily: 'Sora' },
  }).render().asPng();
  const buf = Buffer.from(png);
  assert.deepEqual([...buf.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  assert.equal(buf.readUInt32BE(16), 1200);
  assert.equal(buf.readUInt32BE(20), 630);
  assert.ok(png.length > 20000 && png.length < 600000, String(png.length));
});
