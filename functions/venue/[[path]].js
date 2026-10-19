import template from '../../venue.html';
import notFound from '../../404.html';
import { getVenue, htmlResponse, redirectResponse, renderTemplate, routeId, venuePath, venueView, edgeCached } from '../../src/entity-seo.mjs';
import { getVenueIntel, knowBeforeYouGo, normalizeIntel } from '../../src/venue-facts.mjs';

export function onRequest(context) {
  return edgeCached(context, () => render(context));
}

async function render({ params, request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const id = routeId(params.path);
  if (!id) return htmlResponse(notFound, 404);
  try {
    const [data, intel] = await Promise.all([getVenue(id), getVenueIntel(id)]);
    if (!data) return htmlResponse(notFound, 404);
    const path = venuePath(data.venue);
    if (new URL(request.url).pathname !== path) return redirectResponse(path);
    const view = venueView(data, { knowBeforeYouGo: knowBeforeYouGo(normalizeIntel(intel, id), data.events) });
    return htmlResponse(renderTemplate(template, { ...view, rootId: 'venue-content' }));
  } catch {
    return new Response('Venue page temporarily unavailable', { status: 503, headers: { 'Retry-After': '60' } });
  }
}
