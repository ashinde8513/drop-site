import template from '../index.html';
import { edgeCached, htmlResponse } from '../src/entity-seo.mjs';
import { fetchHomeSeed, homeLcpImage, withHomeCards, withHomeSeed, withLcpHint } from '../src/home-lcp.mjs';

export async function onRequest(context) {
  try {
    // Query-string hits (auth callbacks carry one-time codes, UTM links) are
    // rendered but never become edge-cache keys.
    return new URL(context.request.url).search ? await render(context) : await edgeCached(context, () => render(context));
  } catch {
    return context.next(); // the plain static homepage, never a 500
  }
}

// Same static homepage, plus the LCP image hint. Any catalog failure serves
// the page unchanged.
async function render({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const seed = request.method === 'GET' ? await fetchHomeSeed().catch(() => null) : null;
  // Keep the static homepage's revalidate-every-view policy (no HTML/CSS skew).
  return htmlResponse(withHomeCards(withHomeSeed(withLcpHint(template, seed && homeLcpImage(seed.rows)), seed), seed), 200, 'no-cache');
}
