import template from '../search.html';
import { cleanQuery, renderSearchPage, searchCatalog } from '../src/search.mjs';
import { htmlResponse, edgeCached } from '../src/entity-seo.mjs';

export function onRequest(context) {
  return edgeCached(context, () => render(context));
}

async function render({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const q = cleanQuery(new URL(request.url).searchParams.get('q'));
  const empty = { events: [], artists: [] };
  try {
    const results = q && request.method === 'GET' ? await searchCatalog(q) : empty;
    return htmlResponse(renderSearchPage(template, q, results), 200, 'public, max-age=60, s-maxage=600');
  } catch {
    return new Response('Search temporarily unavailable', { status: 503, headers: { 'Retry-After': '30' } });
  }
}
