import template from '../../event.html';
import notFound from '../../404.html';
import { eventPath, eventView, getEvent, htmlResponse, redirectResponse, renderTemplate, routeId } from '../../src/entity-seo.mjs';

export async function onRequest({ params, request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const id = routeId(params.path);
  if (!id) return htmlResponse(notFound, 404);
  try {
    const event = await getEvent(id);
    if (!event) return htmlResponse(notFound, 404);
    const path = eventPath(event);
    if (new URL(request.url).pathname !== path) return redirectResponse(path, request.url);
    const view = eventView(event);
    return htmlResponse(renderTemplate(template, { ...view, rootId: 'event-root' }));
  } catch {
    return new Response('Event page temporarily unavailable', { status: 503, headers: { 'Retry-After': '60' } });
  }
}
