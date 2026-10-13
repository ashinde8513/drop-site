// /go — the permanent physical-QR entry point printed on Drop business cards.
//
// This URL is printed on physical cards and can never change. Everything that
// might change (attribution, analytics, app destinations, platform
// availability) lives behind it in the drop-card Supabase Edge Function.
//
// Thin server-side proxy, not a redirect: we call the Edge Function with
// redirect:'manual', read its Location, and return our own 302. The scanner
// sees exactly one redirect and never sees a Supabase URL. Cloudflare holds no
// Supabase credential — the Edge Function reads campaign data with its
// server-side secret key.
//
// If the Edge Function is slow or down we still route the scanner correctly,
// just without attribution. A scan must never dead-end on an error page.

const EDGE_URL = 'https://ebccwnkmsnhbljxxxdej.supabase.co/functions/v1/drop-card?k=drop-card-v1';
const IOS_STORE_URL = 'https://apps.apple.com/us/app/drop-edm-events/id6790662825';
const ANDROID_STORE_URL = 'https://play.google.com/store/apps/details?id=app.resonanceventures.drop';
const WEB_URL = 'https://trydropapp.com/';
const FORWARDED = ['placement', 'distributor', 'batch', 'variant'];
const TIMEOUT_MS = 1500;

function isIOS(userAgent) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // iPadOS 13+ reports a desktop Safari UA; the touch hint is the only tell.
  return /Macintosh/i.test(userAgent) && /Mobile\/|Touch/i.test(userAgent);
}

function isAndroid(userAgent) {
  return /Android/i.test(userAgent);
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
  const userAgent = request.headers.get('user-agent') || '';
  const target = new URL(EDGE_URL);
  for (const name of FORWARDED) {
    const value = incoming.searchParams.get(name);
    if (value) target.searchParams.set(name, value.slice(0, 64));
  }

  try {
    const response = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'manual',
      // The Edge Function classifies the device; it must see the scanner's UA,
      // not Cloudflare's. No IP is forwarded — device class is all we store.
      headers: { 'x-drop-user-agent': userAgent.slice(0, 300) },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = response.headers.get('location');
    if (location) return redirect(location);
  } catch {
    // fall through to the untracked redirect below
  }

  return redirect(isIOS(userAgent) ? IOS_STORE_URL : (isAndroid(userAgent) ? ANDROID_STORE_URL : WEB_URL));
}
