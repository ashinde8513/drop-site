import { BRAND_IMAGE, artCandidates, fetchArt } from '../../../src/og-image.mjs';
import { edgeCached, getEvent, routeId } from '../../../src/entity-seo.mjs';

export function onRequest(context) {
  return edgeCached(context, () => render(context));
}

async function render({ params, request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  // One cache entry per event: a query string would bypass the edge cache and
  // force an upstream fetch per request.
  const url = new URL(request.url);
  if (url.search) return new Response(null, { status: 301, headers: { Location: url.pathname } });
  const id = routeId(params.path);
  const event = id ? await getEvent(id).catch(() => null) : null;
  const art = event ? await fetchArt(artCandidates(event)) : null;
  if (!art) return new Response(null, { status: 302, headers: { Location: BRAND_IMAGE, 'Cache-Control': 'public, max-age=3600' } });
  return new Response(request.method === 'HEAD' ? null : art.bytes, {
    headers: { 'Content-Type': art.type, 'Cache-Control': 'public, max-age=86400, s-maxage=86400', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' },
  });
}
