import template from '../genre.html';
import notFound from '../404.html';
import { cleanCity, GENRES, knownCity, renderGenrePage } from '../src/acquisition-seo.mjs';
import { htmlResponse } from '../src/entity-seo.mjs';

export function onRequest({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const url = new URL(request.url);
  const params = url.searchParams;
  const city = cleanCity(params.get('city') || 'Denver');
  if (!city) return htmlResponse(notFound, 404);
  const indexableCity = knownCity(city);
  const genre = GENRES.includes(params.get('genre')) ? params.get('genre') : 'House';
  const canonical = '/genre?genre=' + encodeURIComponent(genre) + (params.has('city') ? '&city=' + encodeURIComponent(indexableCity || city) : '');
  if (indexableCity && url.pathname + url.search !== canonical) return new Response(null, { status: 301, headers: { Location: canonical } });
  return htmlResponse(renderGenrePage(template, genre, indexableCity || city, params.has('city'), Boolean(indexableCity)));
}
