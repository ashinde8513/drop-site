import template from '../index.html';
import { edgeCached, htmlResponse } from '../src/entity-seo.mjs';
import { fetchHomeLcpImage, withLcpHint } from '../src/home-lcp.mjs';

export function onRequest(context) {
  return edgeCached(context, () => render(context));
}

// Same static homepage, plus the LCP image hint. Any catalog failure serves
// the page unchanged.
async function render({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const image = request.method === 'GET' ? await fetchHomeLcpImage().catch(() => null) : null;
  // Keep the static homepage's revalidate-every-view policy (no HTML/CSS skew).
  return htmlResponse(withLcpHint(template, image), 200, 'no-cache');
}
