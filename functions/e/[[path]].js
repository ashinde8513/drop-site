import { validBeacon } from '../../src/track.mjs';

// Beacon sink: validate and acknowledge; the request itself is the count.
export function onRequest({ request }) {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  const ok = validBeacon(new URL(request.url).pathname);
  return new Response(null, { status: ok ? 204 : 404, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
