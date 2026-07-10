// Standalone post-login web app (the ported Prism design SPA) lives at /app/ on
// the drop-site Pages project. This Worker makes app.trydropapp.com serve it:
// asset paths (contain a ".") map into /app/<path>, every extensionless path is
// a client-side route and gets the SPA shell. trydropapp.com/app* passes through
// to Pages directly (no more redirect to /account.html).
const SITE_ORIGIN = 'https://trydropapp.com';
const APP_HOST = 'app.trydropapp.com';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.hostname === APP_HOST) {
      const upstream = new URL(SITE_ORIGIN);
      const isAsset = url.pathname.indexOf('.') !== -1;
      upstream.pathname = isAsset ? '/app' + url.pathname : '/app/';
      upstream.search = url.search;
      const response = await fetch(new Request(upstream.toString(), request));
      const headers = new Headers(response.headers);
      // Zone Browser Cache TTL would stamp 4h max-age on css/js, serving stale
      // assets against fresh HTML. no-store for the shell, no-cache (etag 304)
      // for assets so deploys take effect immediately.
      headers.set('Cache-Control', isAsset ? 'no-cache' : 'no-store, no-cache, max-age=0');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // trydropapp.com/app and /app/... serve the deployed app straight from Pages.
    return fetch(request);
  },
};
