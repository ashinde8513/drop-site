// app.trydropapp.com serves only the signed-in app shell. Public content (legal pages, events,
// artists, venues) lives on trydropapp.com; send those paths there instead of showing the app's
// landing screen under a URL that promises something else.
(function (root) {
  var PUBLIC = /^\/(legal|event|artist|venue)\/|^\/(privacy|terms)\/?$/;
  function publicPathTarget(hostname, pathname, search, hash) {
    if (hostname !== 'app.trydropapp.com' || !PUBLIC.test(pathname)) return null;
    return 'https://trydropapp.com' + pathname + (search || '') + (hash || '');
  }
  root.publicPathTarget = publicPathTarget;
  if (typeof location !== 'undefined') {
    var target = publicPathTarget(location.hostname, location.pathname, location.search, location.hash);
    if (target) location.replace(target);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
