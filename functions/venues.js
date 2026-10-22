import template from '../venues.html';
import { edgeCached, getEntityUrls, htmlResponse, withVenueDirectory } from '../src/entity-seo.mjs';

// /venues with its directory rows server-rendered (crawlable venue links);
// falls back to the static page if the catalog is unavailable.
export async function onRequest(context) {
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') return context.next();
  try {
    return await edgeCached(context, render);
  } catch {
    return context.next();
  }
}

async function render() {
  const { venues } = await getEntityUrls();
  return htmlResponse(withVenueDirectory(template, venues), 200, 'no-cache');
}
