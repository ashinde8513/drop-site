// Single-URL consolidation worker (Option B, 2026-07-06).
// Two routes, one script:
//   1. trydropapp.com/app*      → proxy to the Expo web app (CF Pages project drop-web),
//      stripping the /app prefix. The export is built with experiments.baseUrl='/app',
//      so every asset/router URL it emits already starts with /app — requests loop
//      back through this route.
//   2. app.trydropapp.com/*     → 301 to trydropapp.com/app/* (legacy URLs + the old
//      login fragment handoff; URL fragments survive redirects in browsers).
// The static discovery site keeps every other trydropapp.com path.

const PAGES_ORIGIN = 'https://drop-web-2lo.pages.dev';

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // SECURITY: never feed the request path to `new URL(path, base)` — a path like
    // `//evil.com/x` is protocol-relative and would swap the host (open redirect /
    // open proxy). Hosts are fixed constants; paths get leading slashes collapsed
    // and are assigned via url.pathname, which cannot change the origin.
    const safePath = url.pathname.replace(/\/{2,}/g, '/');

    if (url.hostname === 'app.trydropapp.com') {
      return Response.redirect(
        'https://trydropapp.com/app' + (safePath === '/' ? '/' : safePath) + url.search,
        301,
      );
    }

    // trydropapp.com/app[/...]
    const rest = safePath.slice('/app'.length);
    if (rest === '') return Response.redirect(url.origin + '/app/', 301);
    const upstream = new URL(PAGES_ORIGIN);
    upstream.pathname = rest;
    upstream.search = url.search;
    return fetch(new Request(upstream.toString(), request));
  },
};
