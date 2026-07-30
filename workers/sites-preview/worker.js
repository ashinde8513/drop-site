export default {
  fetch(request, env) {
    const url = new URL(request.url);
    const isPreviewRoute = url.pathname === '/app/next'
      || (url.pathname.startsWith('/app/next/') && !url.pathname.slice('/app/next/'.length).includes('.'));
    if (isPreviewRoute) {
      url.pathname = '/app/next/index.html';
      return env.ASSETS.fetch(new Request(url, request));
    }
    return env.ASSETS.fetch(request);
  },
};
