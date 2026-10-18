import template from '../events.html';
import { edgeCached, htmlResponse } from '../src/entity-seo.mjs';
import { editorialView, renderFestivalsPage, renderWeekendPage, upcomingFestivals, weekendEvents } from '../src/editorial.mjs';

// Only the two editorial views are server-rendered; every other /events URL
// (search, genre, price filters) is the unchanged static page.
export async function onRequest(context) {
  const view = editorialView(context.request.url);
  if (!view || (context.request.method !== 'GET' && context.request.method !== 'HEAD')) return context.next();
  try {
    return await edgeCached(context, () => render(view));
  } catch {
    return context.next();
  }
}

async function render(view) {
  const events = view.kind === 'weekend' ? await weekendEvents(view.city) : await upcomingFestivals();
  if (events === null) throw new Error('catalog unavailable'); // → static page
  const html = view.kind === 'weekend' ? renderWeekendPage(template, view.city, events) : renderFestivalsPage(template, events);
  return htmlResponse(html, 200, 'no-cache');
}
