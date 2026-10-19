import test from 'node:test';
import assert from 'node:assert/strict';
import { latestMarkdown, PAGES, rating, summarize } from '../scripts/cwv-monitor.mjs';

test('cwv monitor summarizes Lighthouse JSON and rates against Google thresholds', () => {
  assert.equal(PAGES.length, 20);
  const report = { categories: { performance: { score: 0.86 } }, audits: {
    'largest-contentful-paint': { numericValue: 4141.7 }, 'cumulative-layout-shift': { numericValue: 0.00123 },
    'first-contentful-paint': { numericValue: 1790.2 }, 'total-blocking-time': { numericValue: 12.4 } } };
  const row = summarize(report);
  assert.deepEqual(row, { perf: 86, lcp_ms: 4142, cls: 0.001, fcp_ms: 1790, tbt_ms: 12, inp_ms: null });
  assert.deepEqual(rating(row), { lcp: 'poor', cls: 'good' });
  assert.deepEqual(rating({ lcp_ms: 2500, cls: 0.25 }), { lcp: 'good', cls: 'needs-improvement' });
  assert.deepEqual(summarize({ audits: {} }).lcp_ms, null);
  assert.match(latestMarkdown([{ url: '/', mode: 'applied', ...row }], 'now'), /\| \/ \| applied \| 86 \| 4\.14 s \(poor\) \| 0\.001 \(good\) \| 12 ms \|/);
});
