import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../workers/sites-preview/worker.js', import.meta.url), 'utf8');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const requestedPaths = [];
const env = {
  ASSETS: {
    fetch(request) {
      const url = new URL(request.url);
      requestedPaths.push(`${url.pathname}${url.search}`);
      return new Response(null, { status: 200 });
    },
  },
};

await worker.fetch(new Request('https://preview.test/app/next/'), env);
await worker.fetch(new Request('https://preview.test/app/next/event/demo?from=share'), env);
await worker.fetch(new Request('https://preview.test/app/next/assets/app.js'), env);
await worker.fetch(new Request('https://preview.test/privacy.html'), env);

assert.deepEqual(requestedPaths, [
  '/app/next/index.html',
  '/app/next/index.html?from=share',
  '/app/next/assets/app.js',
  '/privacy.html',
]);
