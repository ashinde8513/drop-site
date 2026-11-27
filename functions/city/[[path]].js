import notFound from '../../404.html';
import { citySlugTarget } from '../../src/acquisition-seo.mjs';
import { htmlResponse } from '../../src/entity-seo.mjs';

// /city/denver, /city/los-angeles → the canonical /city?city=Denver page. Unknown slugs 404.
export function onRequest({ request, params }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const slug = [].concat(params.path || []).join('/');
  const target = citySlugTarget(slug);
  if (!target) return htmlResponse(notFound, 404);
  return new Response(null, { status: 301, headers: { Location: target } });
}
