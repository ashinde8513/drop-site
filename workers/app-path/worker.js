// Static browser account shell. No Expo web proxy.
const SITE_ORIGIN = 'https://trydropapp.com';
const ACCOUNT_HOST = 'app.trydropapp.com';
const ACCOUNT_PATH = '/account';
const WEBSITE_LOGIN_PATH = '/account.html';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.hostname === ACCOUNT_HOST) {
      const upstream = new URL(SITE_ORIGIN);
      const isShellRoute = isAccountRoute(url.pathname);
      upstream.pathname = isShellRoute ? ACCOUNT_PATH : url.pathname;
      upstream.search = url.search;
      const response = await fetch(new Request(upstream.toString(), request));
      if (!isShellRoute) return response;
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store, no-cache, max-age=0');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    if (url.hostname === 'trydropapp.com' && url.pathname !== '/app' && !url.pathname.startsWith('/app/')) {
      return fetch(request);
    }

    const redirectTarget = new URL(WEBSITE_LOGIN_PATH + url.search, SITE_ORIGIN).toString();
    return Response.redirect(redirectTarget, 302);
  },
};

function isAccountRoute(pathname) {
  if (
    pathname === ACCOUNT_PATH ||
    pathname === '/account.html' ||
    pathname === '/login' ||
    pathname === '/signup'
  ) return true;
  if (pathname === '/' || pathname === '') return true;
  if (pathname.indexOf('.') !== -1) return false;
  return true;
}
