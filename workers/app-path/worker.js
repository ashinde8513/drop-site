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

    if (url.hostname === 'app.trydropapp.com') {
      const to = new URL(url.pathname + url.search, 'https://trydropapp.com/app/');
      to.pathname = '/app' + (url.pathname === '/' ? '/' : url.pathname);
      return Response.redirect(to.toString(), 301);
    }

    // trydropapp.com/app[/...]
    let rest = url.pathname.slice('/app'.length);
    if (rest === '') return Response.redirect(url.origin + '/app/', 301);
    const upstream = new URL(rest + url.search, PAGES_ORIGIN);
    return fetch(new Request(upstream.toString(), request));
  },
};
