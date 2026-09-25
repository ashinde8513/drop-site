import template from '../city.html';
import notFound from '../404.html';
import { knownCity, renderCityPage } from '../src/acquisition-seo.mjs';
import { htmlResponse } from '../src/entity-seo.mjs';

export function onRequest({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const url = new URL(request.url);
  const city = knownCity(url.searchParams.get('city') || 'Denver');
  if (!city) return htmlResponse(notFound, 404);
  const canonical = '/city?city=' + encodeURIComponent(city);
  if (url.pathname + url.search !== canonical) return new Response(null, { status: 301, headers: { Location: canonical } });
  return htmlResponse(renderCityPage(template, city));
}
