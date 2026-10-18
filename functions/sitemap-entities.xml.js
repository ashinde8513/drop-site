import { getEntityUrls, sitemapXml, edgeCached } from '../src/entity-seo.mjs';
import { genreCityPaths } from '../src/acquisition-seo.mjs';

export function onRequest(context) {
  return edgeCached(context, () => render(context));
}

async function render({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  try {
    const entities = await getEntityUrls();
    return new Response(sitemapXml(entities, genreCityPaths(entities.events)), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '60' } });
  }
}
