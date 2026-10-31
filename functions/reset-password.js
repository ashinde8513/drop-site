// Password-reset links open here from older emails. Forward to the web app with
// the FULL query string (Supabase's ?code=… / ?token_hash=…&type=recovery); a
// _redirects rule drops it, which made web-opened reset links fail. The #fragment
// (implicit-flow tokens) is carried by the browser across the redirect.
// The reset link is a secret: no logging, no caching, no referrer.
export function onRequest({ request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const target = new URL('https://app.trydropapp.com/');
  target.searchParams.set('mode', 'reset-password');
  for (const [key, value] of new URL(request.url).searchParams) if (key !== 'mode') target.searchParams.append(key, value);
  return new Response(null, { status: 302, headers: { Location: target.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
