// First-party, consent-gated click counts. The browser sends a body-less
// beacon to /e/<name>/<detail>/<surface>; the edge validates it and answers
// 204. Nothing is stored here: Cloudflare's own request analytics counts the
// paths (no cookies, no ids, no third party). Any change to these lists is a
// change to what we measure, so keep it in step with /privacy.
export const EVENTS = {
  ticket_click: ['axs', 'dice', 'etix', 'eventbrite', 'seatgeek', 'seetickets', 'showclix', 'stubhub', 'ticketmaster', 'ticketsauce', 'ticketweb', 'tixr', 'other'],
  app_store_click: ['ios', 'android', 'web'],
};
export const SURFACES = ['home', 'events', 'event', 'venues', 'venue', 'artists', 'artist', 'city', 'genre', 'search', 'download', 'link', 'guides', 'about', 'promoters', 'creators', 'other'];

export function validBeacon(pathname) {
  const parts = String(pathname).split('/').filter(Boolean);
  if (parts.length !== 4 || parts[0] !== 'e') return false;
  const [, name, detail, surface] = parts;
  return Boolean(EVENTS[name]?.includes(detail) && SURFACES.includes(surface));
}
