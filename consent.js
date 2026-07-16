/* Drop — cookie / local-storage consent banner. Self-contained (injects its
   own styles, no dependency on site.js or the app shell) so the same file is
   loaded by every public page AND app/index.html. The choice lives in
   localStorage under drop.cookie-consent: 'accepted' (all) | 'essential'.
   If storage is unavailable (private mode) nothing persists and the banner
   simply shows again next load. Policy text: /privacy.html#cookies. */
(function () {
  var KEY = 'drop.cookie-consent';
  var doc = document;

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  var CSS =
    '.ck-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:999;max-width:420px;' +
    'padding:18px 20px;border-radius:16px;background:var(--surface,#12151D);color:var(--text,#EDEFF7);' +
    'border:1px solid var(--glass-border,rgba(255,255,255,.12));box-shadow:0 18px 48px rgba(0,0,0,.5);' +
    'font-family:var(--font-body,"Sora",system-ui,sans-serif);font-size:14px;line-height:1.5;}' +
    '.ck-banner p{margin:0 0 12px;color:var(--text-secondary,#B8BFCF);}' +
    '.ck-banner strong{color:var(--text,#EDEFF7);}' +
    '.ck-banner a{color:var(--brand-cyan,#39D2FF);text-decoration:underline;}' +
    '.ck-actions{display:flex;gap:10px;flex-wrap:wrap;}' +
    '.ck-btn{height:40px;padding:0 18px;border-radius:999px;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;}' +
    '.ck-accept{background:var(--text,#EDEFF7);color:var(--ink,#0B0D12);border:1px solid transparent;}' +
    '.ck-essential{background:transparent;color:var(--text,#EDEFF7);border:1px solid var(--glass-border,rgba(255,255,255,.18));}' +
    '@media (prefers-reduced-motion:no-preference){.ck-banner{animation:ck-in .35s ease both;}' +
    '@keyframes ck-in{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:none;}}}';

  var banner = null;
  function ensureStyles() {
    if (doc.getElementById('ck-styles')) return;
    var s = doc.createElement('style');
    s.id = 'ck-styles';
    s.textContent = CSS;
    doc.head.appendChild(s);
  }

  function close() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
    banner = null;
  }

  function choose(v) { store(v); close(); }

  function open() {
    if (banner) return;
    ensureStyles();
    banner = doc.createElement('div');
    banner.className = 'ck-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');

    var p = doc.createElement('p');
    var b = doc.createElement('strong');
    b.textContent = 'Cookies on Drop. ';
    p.appendChild(b);
    p.appendChild(doc.createTextNode(
      'We use local storage for essentials — your city, your session, this choice. ' +
      'With your OK, we may also use analytics to understand what’s working. '));
    var a = doc.createElement('a');
    a.href = 'https://trydropapp.com/privacy.html#cookies';
    a.textContent = 'Cookie policy';
    p.appendChild(a);
    banner.appendChild(p);

    var actions = doc.createElement('div');
    actions.className = 'ck-actions';
    var accept = doc.createElement('button');
    accept.type = 'button';
    accept.className = 'ck-btn ck-accept';
    accept.textContent = 'Accept all';
    accept.addEventListener('click', function () { choose('accepted'); });
    var essential = doc.createElement('button');
    essential.type = 'button';
    essential.className = 'ck-btn ck-essential';
    essential.textContent = 'Essential only';
    essential.addEventListener('click', function () { choose('essential'); });
    actions.appendChild(accept);
    actions.appendChild(essential);
    banner.appendChild(actions);

    doc.body.appendChild(banner);
  }

  // Small public surface: the privacy page's "Manage cookie preferences"
  // button reopens the banner; future analytics must gate on allowsAnalytics().
  window.DropConsent = {
    get: stored,
    open: open,
    allowsAnalytics: function () { return stored() === 'accepted'; }
  };

  function boot() {
    doc.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('[data-cookie-prefs]') : null;
      if (t) { e.preventDefault(); open(); }
    });
    if (!stored()) open();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
