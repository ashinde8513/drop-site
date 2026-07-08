// Website-only routing: the public site is separate from the native app.
// Old Expo web URLs stay alive, but they no longer render the Expo web export.
const WEBSITE_APP_TARGET = 'https://trydropapp.com/download.html';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (
      url.hostname === 'trydropapp.com'
      && url.pathname !== '/app'
      && !url.pathname.startsWith('/app/')
    ) {
      return fetch(request);
    }

    return Response.redirect(WEBSITE_APP_TARGET, 302);
  },
};
