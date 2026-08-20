// /t — promoter-attributed ticket clicks.
//
// The Edge Function owns creator authorization, event lookup, analytics, and
// Partnerize link generation. This Pages Function only validates bounded public
// inputs, hides the Supabase origin, and guarantees a safe event-page fallback.

const EDGE_URL = 'https://ebccwnkmsnhbljxxxdej.supabase.co/functions/v1/promoter-ticket';
const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIMEOUT_MS = 1500;

function normalizeCreatorCode(value) {
  const code = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z0-9]{4,24}$/.test(code) ? code : null;
}

function isOwnedEtixLocation(value) {
  try {
    const url = new URL(value);
    const match = url.pathname.match(
      /^\/click\/camref:1100l5NLJm\/pubref:(\d+)(?:-[A-Z0-9]{4,24})?\/destination:(.+)$/i,
    );
    if (url.protocol !== 'https:' || url.hostname !== 'etix.prf.hn'
        || url.username || url.password || url.port || url.search || url.hash || !match) return false;

    const destination = new URL(decodeURIComponent(match[2]));
    return destination.protocol === 'https:'
      && destination.hostname === 'www.etix.com'
      && !destination.username
      && !destination.password
      && !destination.port
      && new RegExp(`^/ticket/p/${match[1]}(?:/|$)`).test(destination.pathname);
  } catch {
    return false;
  }
}

function redirect(location) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

export async function onRequest({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const incoming = new URL(request.url);
  const eventId = incoming.searchParams.get('event') || '';
  if (!EVENT_ID.test(eventId)) return redirect('https://trydropapp.com/');

  const target = new URL(EDGE_URL);
  target.searchParams.set('event', eventId);
  const creatorCode = normalizeCreatorCode(incoming.searchParams.get('creator'));
  if (creatorCode) target.searchParams.set('creator', creatorCode);
  const surface = incoming.searchParams.get('surface');
  target.searchParams.set('surface', surface === 'native' ? 'native' : 'web');

  try {
    const response = await fetch(target.toString(), {
      method: request.method,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = response.headers.get('location');
    if (location && isOwnedEtixLocation(location)) return redirect(location);
  } catch {
    // The show page remains useful when attribution is unavailable.
  }

  return redirect(`https://trydropapp.com/event/${eventId}`);
}
