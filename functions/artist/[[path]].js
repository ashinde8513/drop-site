import template from '../../artist.html';
import notFound from '../../404.html';
import { artistPath, artistView, getArtist, htmlResponse, redirectResponse, renderTemplate, routeId } from '../../src/entity-seo.mjs';

export async function onRequest({ params, request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const id = routeId(params.path);
  if (!id) return htmlResponse(notFound, 404);
  try {
    const data = await getArtist(id);
    if (!data) return htmlResponse(notFound, 404);
    const path = artistPath(data.artist);
    if (new URL(request.url).pathname !== path) return redirectResponse(path);
    const view = artistView(data);
    return htmlResponse(renderTemplate(template, { ...view, rootId: 'artist-content' }));
  } catch {
    return new Response('Artist page temporarily unavailable', { status: 503, headers: { 'Retry-After': '60' } });
  }
}
