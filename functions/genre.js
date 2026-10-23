import template from '../genre.html';
import notFound from '../404.html';
import { cleanCity, GENRES, knownCity, renderGenrePage, upcomingEvents } from '../src/acquisition-seo.mjs';
import { getEntityUrls, htmlResponse, edgeCached } from '../src/entity-seo.mjs';

// Whole-catalog read for the "<Genre> in other cities" links, shared across
// requests in this isolate. ponytail: 1h memo; a failed read retries next request.
let catalogMemo = null;
function catalog() {
  if (!catalogMemo || Date.now() - catalogMemo.at > 36e5) {
    const promise = getEntityUrls().then((entities) => entities.events);
    catalogMemo = { at: Date.now(), promise };
    promise.catch(() => { if (catalogMemo?.promise === promise) catalogMemo = null; });
  }
  return catalogMemo.promise.catch(() => null);
}

export function onRequest(context) {
  return edgeCached(context, () => render(context));
}

async function render({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const url = new URL(request.url);
  const params = url.searchParams;
  const city = cleanCity(params.get('city') || 'Denver');
  if (!city) return htmlResponse(notFound, 404);
  const indexableCity = knownCity(city);
  const genre = GENRES.includes(params.get('genre')) ? params.get('genre') : 'House';
  const canonical = '/genre?genre=' + encodeURIComponent(genre) + (params.has('city') ? '&city=' + encodeURIComponent(indexableCity || city) : '');
  if (indexableCity && url.pathname + url.search !== canonical) return new Response(null, { status: 301, headers: { Location: canonical } });
  // Real shows only for cities Drop covers; HEAD skips the catalog read.
  const live = indexableCity && request.method !== 'HEAD';
  const [events, all] = live ? await Promise.all([upcomingEvents({ city: indexableCity, genre }), catalog()]) : [null, null];
  return htmlResponse(renderGenrePage(template, genre, indexableCity || city, params.has('city'), Boolean(indexableCity), events, all));
}
