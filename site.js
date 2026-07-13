/* Drop — shared UI behaviors. Depends on data.js (window.Drop). No modules. */
(function () {
  var Drop = (window.Drop = window.Drop || {});
  var doc = document;

  function el(tag, cls, txt) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function esc(s) { return String(s == null ? '' : s); }
  Drop.el = el;

  // ---- Signature spectrum (ported from old index.html) --------------------
  // Deterministic waveform with a central "drop" peak. CSS gates the EQ motion
  // behind prefers-reduced-motion, so static render needs no JS branch here.
  Drop.spectrum = function (host, bars) {
    if (typeof host === 'string') host = doc.getElementById(host);
    if (!host) return;
    var BARS = bars || 64;
    var frag = doc.createDocumentFragment();
    for (var i = 0; i < BARS; i++) {
      var t = i / BARS;
      var wave = 0.5 + 0.5 * Math.sin(t * Math.PI * 3.0 - 1.2);
      var swell = Math.sin(t * Math.PI);
      var h = 0.16 + (0.55 * wave + 0.40 * swell) * 0.62;
      if (h > 1) h = 1;
      var bar = el('span', 'bar');
      bar.style.setProperty('--h', h.toFixed(3));
      bar.style.setProperty('--dur', (0.9 + (i % 7) * 0.16).toFixed(2) + 's');
      bar.style.setProperty('--delay', ((i % 11) * 0.07).toFixed(2) + 's');
      frag.appendChild(bar);
    }
    host.appendChild(frag);
  };

  // hasRealArt / artistArt moved to data.js — the app shell (app/) loads
  // data.js but not site.js, and it needs the same art chain.

  // ---- Prism art fallback -------------------------------------------------
  Drop.prismArt = function (event) {
    var art = el('div', 'art-prism ' + Drop.genreClass(event));
    art.setAttribute('aria-hidden', 'true');
    var initial = (event.title || '•').trim().charAt(0).toUpperCase();
    art.appendChild(el('span', 'art-mark', initial));
    return art;
  };

  // Login-gated chip <button> — safe to nest inside the card's outer <a>
  // (an <a> can't nest another <a>). Stops the click from bubbling into the
  // card link, then sends the visitor to sign in.
  Drop.gateChip = function (label) {
    var b = el('button', 'chip gate', label);
    b.type = 'button';
    b.title = 'Log in to RSVP';
    b.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      location.href = '/account.html';
    });
    return b;
  };

  // ---- Event card ---------------------------------------------------------
  // Drop.ecard(event, opts) -> <a> shell show card (canonical web look: uniform
  // 300x340 image-forward unit mirroring the app's WebShowCard). Reused everywhere.
  // opts.gate: true adds an inline Going/Interested row, login-gated to /account.html.
  Drop.ecard = function (event, opts) {
    opts = opts || {};
    var a = el('a', 'wsc-card');
    a.href = '/event.html?id=' + encodeURIComponent(event.id);
    a.dataset.eventId = event.id;
    a.setAttribute('aria-label', esc(event.title) + ' at ' + esc(event.venue_name || 'venue'));

    // Art chain: real event image → lineup-artist photo → prism block.
    var artSrc = Drop.hasRealArt(event) ? event.image_url : Drop.artistArt(event);
    if (artSrc) {
      var img = el('img', 'wsc__img');
      img.src = artSrc;
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () {
        // Swap the broken image for the CSS prism-art block.
        if (img.parentNode) { img.parentNode.replaceChild(Drop.prismArt(event), img); }
      };
      a.appendChild(img);
    } else {
      a.appendChild(Drop.prismArt(event));
    }
    a.appendChild(el('div', 'wsc__scrim'));

    a.appendChild(el('span', 'genre-pill', Drop.genreOf(event)));
    var price = Drop.fmtPrice(event.price_min, event.price_max);
    if (price) a.appendChild(el('span', 'wsc__price', price));

    var text = el('div', 'wsc__text');
    text.appendChild(el('div', 'wsc__date', Drop.fmtDate(event.date, event.time_tbd)));
    text.appendChild(el('h3', 'wsc__title', event.title));
    var venue = el('p', 'wsc__venue');
    venue.textContent = [event.venue_name, event.city].filter(Boolean).join(' \u00b7 ');
    text.appendChild(venue);
    if (opts.gate) {
      var gateRow = el('div', 'wsc__gate');
      gateRow.style.cssText = 'display:flex;gap:6px;margin-top:8px;';
      gateRow.appendChild(Drop.gateChip('\u2713 Going'));
      gateRow.appendChild(Drop.gateChip('\u2606 Interested'));
      text.appendChild(gateRow);
    }
    a.appendChild(text);
    return a;
  };

  // Venue card (derived from grouped events).
  Drop.venueCard = function (v) {
    var a = el('a', 'vcard');
    a.href = '/venue.html?name=' + encodeURIComponent(v.name) + '&city=' + encodeURIComponent(v.city || '');
    a.setAttribute('aria-label', esc(v.name) + ' — ' + v.count + ' upcoming shows');
    var art = el('div', 'vcard-art ' + (v.cls || 'g-other'));
    art.setAttribute('aria-hidden', 'true');
    art.appendChild(el('span', 'art-mark', (v.name || '•').charAt(0).toUpperCase()));
    a.appendChild(art);
    var body = el('div', 'vcard-body');
    body.appendChild(el('h3', 'vcard-title', v.name));
    body.appendChild(el('p', 'vcard-loc', [v.city, v.state].filter(Boolean).join(', ')));
    body.appendChild(el('span', 'vcard-count', v.count + ' upcoming show' + (v.count === 1 ? '' : 's')));
    a.appendChild(body);
    return a;
  };

  // Artist card — used by artists.html grid + artist.html "Fans also see".
  // ponytail: reuses .art-prism fallback markup directly (no per-genre tint —
  // artist has no single event to derive one from); add genre tint if requested.
  Drop.acard = function (a, opts) {
    opts = opts || {};
    var link = el('a', 'acard');
    link.href = '/artist.html?id=' + encodeURIComponent(a.id);
    link.setAttribute('aria-label', esc(a.name));
    var media = el('div', 'acard-media');
    function fallback() {
      // Tint the prism fallback by the artist's genre so image-less cards look
      // designed, not blank-gray. Initial letter + name (below) always render.
      var cls = opts.genre ? Drop.genreCls(opts.genre) : 'g-other';
      var art = el('div', 'art-prism ' + cls);
      art.setAttribute('aria-hidden', 'true');
      art.appendChild(el('span', 'art-mark', (a.name || '•').charAt(0).toUpperCase()));
      return art;
    }
    if (a.image_url) {
      var img = el('img', 'acard-img');
      img.src = a.image_url;
      img.alt = esc(a.name);
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.onerror = function () { if (img.parentNode) img.parentNode.replaceChild(fallback(), img); };
      media.appendChild(img);
    } else {
      media.appendChild(fallback());
    }
    link.appendChild(media);
    var body = el('div', 'acard-body');
    body.appendChild(el('h3', 'acard-title', a.name));
    if (opts.genre) body.appendChild(el('span', 'pill', opts.genre));
    if (opts.meta) body.appendChild(el('p', 'acard-meta', opts.meta));
    link.appendChild(body);
    return link;
  };

  // ---- Loading / empty / error states -------------------------------------
  Drop.skeletonGrid = function (host, n) {
    host.innerHTML = '';
    host.classList.add('is-loading');
    for (var i = 0; i < (n || 6); i++) {
      host.appendChild(el('div', 'skeleton wsc__skeleton'));
    }
  };

  Drop.stateEmpty = function (host, msg, actionLabel, actionHref) {
    host.classList.remove('is-loading');
    host.innerHTML = '';
    var box = el('div', 'state-empty');
    box.appendChild(el('span', 'state-icon', 'Drop'));
    box.appendChild(el('p', 'state-msg', msg || 'No shows here yet.'));
    if (actionLabel) {
      var a = el('a', 'btn-ghost', actionLabel);
      a.href = actionHref || '/events.html';
      box.appendChild(a);
    }
    host.appendChild(box);
  };

  Drop.stateError = function (host, retry) {
    host.classList.remove('is-loading');
    host.innerHTML = '';
    var box = el('div', 'state-error');
    box.appendChild(el('span', 'state-icon', '!'));
    box.appendChild(el('p', 'state-msg', "We couldn't load shows just now. Check your connection and try again."));
    var btn = el('button', 'btn-ghost', 'Retry');
    btn.type = 'button';
    btn.addEventListener('click', function () { if (retry) retry(); });
    box.appendChild(btn);
    host.appendChild(box);
  };

  // Render a list of events into a host (rail or grid). Handles empty.
  Drop.renderEvents = function (host, events, opts) {
    opts = opts || {};
    host.classList.remove('is-loading');
    host.innerHTML = '';
    if (!events || !events.length) {
      Drop.stateEmpty(host, opts.emptyMsg, opts.emptyAction, opts.emptyHref);
      return;
    }
    var lim = opts.limit || events.length;
    var ids = [];
    for (var i = 0; i < events.length && i < lim; i++) {
      host.appendChild(Drop.ecard(events[i], opts));
      ids.push(events[i].id);
    }
    // Going pill: fetched after cards land so a slow/failed count never blocks render.
    Drop.fetchGoingCounts(ids).then(function (counts) {
      for (var id in counts) {
        if (counts[id] < 2) continue; // ponytail: hide low counts — an empty room isn't social proof
        var card = host.querySelector('[data-event-id="' + id + '"]');
        if (card) card.appendChild(el('span', 'wsc__going', counts[id] + ' going'));
      }
    });
  };

  // ---- Nav: drawer, location popover, search ------------------------------
  // Binds the Prism .wn nav (replaces the old .site-nav — see shell.css).
  function initNav() {
    var nav = doc.querySelector('.wn');
    if (!nav) return;

    // Reflect current city into every location label — nav pill AND in-page
    // eyebrows/headings ("Near <city>", "Happening in <city>"), not just the nav.
    var city = Drop.city();
    var locLabels = doc.querySelectorAll('.loc-city');
    for (var i = 0; i < locLabels.length; i++) locLabels[i].textContent = city;

    // Hamburger → mobile drawer (.mnav). Inline `display` toggle — the drawer
    // markup ships with `style="display:none"` so it stays hidden on desktop
    // regardless of shell.css's mobile media query forcing `.mnav{display:block}`.
    var burger = nav.querySelector('[data-nav-menu]');
    var drawer = doc.getElementById('nav-drawer');
    if (burger && drawer) {
      var closeEls = drawer.querySelectorAll('[data-nav-close]');
      function openDrawer() { drawer.style.display = 'block'; burger.setAttribute('aria-expanded', 'true'); }
      function closeDrawer() { drawer.style.display = 'none'; burger.setAttribute('aria-expanded', 'false'); }
      burger.addEventListener('click', openDrawer);
      for (var d = 0; d < closeEls.length; d++) closeEls[d].addEventListener('click', closeDrawer);
    }

    // Location popover(s) — the nav pill AND any inline heading dropdown (e.g.
    // index.html's "Happening in {city}") share Drop.city()/Drop.setCity();
    // picking a city from either reloads the page, so both re-render in sync
    // and the live event grid re-filters through the same fetch path.
    var locWraps = doc.querySelectorAll('.loc-wrap');
    for (var w = 0; w < locWraps.length; w++) bindCityPicker(locWraps[w]);

    // Search forms → events.html?q= (nav search + any in-page search form).
    var searches = doc.querySelectorAll('form[role="search"]');
    for (var s = 0; s < searches.length; s++) {
      searches[s].addEventListener('submit', function (e) {
        e.preventDefault();
        var input = this.querySelector('input[type="search"], input[name="q"]');
        var val = input ? input.value.trim() : '';
        var url = '/events.html?city=' + encodeURIComponent(Drop.city());
        if (val) url += '&q=' + encodeURIComponent(val);
        location.href = url;
      });
    }

    // Typeahead on every search input (nav + in-page search fields).
    var searchInputs = doc.querySelectorAll('input[type="search"]');
    for (var t = 0; t < searchInputs.length; t++) Drop.typeahead(searchInputs[t]);

    // Mobile search icon — reveals the nav search row (icon-only otherwise; see
    // shell.css .wn.search-open override of the mobile `.wn__search-inline` hide).
    var searchToggle = nav.querySelector('[data-nav-search]');
    if (searchToggle) {
      searchToggle.addEventListener('click', function () {
        // Pages with their own search (venues) route the icon there instead of
        // opening the overlay row, which would cover the page heading.
        var pageSearch = doc.querySelector('[data-page-search]');
        if (pageSearch) {
          pageSearch.scrollIntoView({ block: 'center', behavior: 'smooth' });
          pageSearch.focus({ preventScroll: true });
          return;
        }
        var open = nav.classList.toggle('search-open');
        searchToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) { var f = nav.querySelector('.wn__search-inline input'); if (f) f.focus(); }
      });
    }
  }

  // Wires one city-picker trigger + its .loc-pop dropdown inside a .loc-wrap.
  // Reused for the nav's .locchip pill and the heading's .city-head-btn.
  function bindCityPicker(wrap) {
    var btn = wrap.querySelector('.locchip, .city-head-btn');
    var pop = wrap.querySelector('.loc-pop');
    if (!btn || !pop) return;
    buildCityList(pop);
    function closePop() { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    function openPop() {
      pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
      if (pop._filter) { pop._filter.value = ''; pop._filter.dispatchEvent(new Event('input')); }
    }
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (pop.hidden) openPop(); else closePop();
    });
    pop.addEventListener('click', function (e) {
      var opt = e.target.closest('[data-city]');
      if (!opt) return;
      Drop.setCity(opt.getAttribute('data-city'));
      // Refetch by reload — pages read Drop.city() on load. Simple + correct.
      location.reload();
    });
    doc.addEventListener('click', function () { if (!pop.hidden) closePop(); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { if (!pop.hidden) { closePop(); btn.focus(); } }
    });
  }

  function buildCityList(pop) {
    if (pop._built) return;
    pop._built = true;

    // Type-to-filter box — also accepts any free-typed city on Enter, so the
    // picker isn't capped to the list.
    var box = el('div', 'loc-filter');
    var input = el('input');
    input.type = 'text'; // not "search" — the global typeahead binds to those
    input.placeholder = 'Type any city…';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', 'Filter cities or type your own');
    box.appendChild(input);
    pop.insertBefore(box, pop.firstChild);
    pop._filter = input;

    var ul = pop.querySelector('ul') || pop.appendChild(el('ul'));
    var cities = Drop.CITIES; // instant paint; replaced by the live list below

    function renderList() {
      ul.innerHTML = '';
      var cur = Drop.city();
      var f = input.value.trim().toLowerCase();
      var all = [Drop.ALL_CITIES].concat(cities).filter(function (c) {
        return !f || c.toLowerCase().indexOf(f) !== -1;
      });
      for (var i = 0; i < all.length; i++) {
        var li = el('li');
        var b = el('button', 'loc-opt', all[i]);
        b.type = 'button';
        b.setAttribute('role', 'option');
        b.setAttribute('data-city', all[i]);
        if (all[i] === cur) { b.setAttribute('aria-selected', 'true'); b.classList.add('sel'); }
        li.appendChild(b);
        ul.appendChild(li);
      }
    }

    input.addEventListener('click', function (e) { e.stopPropagation(); });
    input.addEventListener('input', renderList);
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      var first = ul.querySelector('[data-city]');
      var typed = input.value.trim();
      if (first) Drop.setCity(first.getAttribute('data-city'));
      else if (typed) Drop.setCity(typed); // free text — any city
      else return;
      location.reload();
    });

    renderList();
    Drop.fetchCities().then(function (list) { cities = list; renderList(); });
  }

  // ---- Search typeahead ----------------------------------------------------
  // Attach a suggestions dropdown to a search <input>. Queries live events +
  // artists (debounced), renders links, supports ↑/↓/Enter/Escape. The input's
  // parent box becomes the positioning context.
  Drop.typeahead = function (input) {
    if (!input || input._ta) return;
    input._ta = true;
    var box = input.parentNode;
    box.style.position = 'relative';
    var pop = el('div', 'ta-pop');
    pop.setAttribute('role', 'listbox');
    pop.hidden = true;
    box.appendChild(pop);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'false');
    var timer = null, seq = 0, active = -1;

    function close() {
      pop.hidden = true; active = -1;
      input.setAttribute('aria-expanded', 'false');
    }
    function rows() { return pop.querySelectorAll('.ta-row'); }
    function highlight(i) {
      var r = rows();
      if (!r.length) return;
      active = (i + r.length) % r.length;
      for (var k = 0; k < r.length; k++) r[k].classList.toggle('is-active', k === active);
    }
    function render(q, events, artists, cities) {
      pop.innerHTML = '';
      function row(href, primary, secondary) {
        var a = el('a', 'ta-row');
        a.href = href;
        a.appendChild(el('span', 'ta-primary', primary));
        if (secondary) a.appendChild(el('span', 'ta-secondary', secondary));
        // mousedown beats the input's blur, so the click still navigates.
        a.addEventListener('mousedown', function (e) { e.preventDefault(); location.href = href; });
        pop.appendChild(a);
      }
      (cities || []).slice(0, 3).forEach(function (c) {
        row('/events.html?city=' + encodeURIComponent(c), c, 'City');
      });
      (events || []).slice(0, 5).forEach(function (ev) {
        row('/event.html?id=' + encodeURIComponent(ev.id), ev.title,
          [Drop.fmtDate(ev.date, ev.time_tbd), ev.venue_name].filter(Boolean).join(' · '));
      });
      (artists || []).slice(0, 4).forEach(function (a) {
        row('/artist.html?id=' + encodeURIComponent(a.id), a.name, 'Artist');
      });
      row('/events.html?city=' + encodeURIComponent(Drop.city()) + '&q=' + encodeURIComponent(q),
        'Search “' + q + '”', 'All events');
      pop.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      active = -1;
    }
    function lookup() {
      var q = input.value.trim();
      if (q.length < 2) { close(); return; }
      var mySeq = ++seq;
      Promise.all([
        Drop.fetchEvents({ city: Drop.city(), q: q, limit: 5 }),
        Drop.searchArtists(q, 4),
        Drop.fetchCities()
      ]).then(function (r) {
        if (mySeq !== seq || input.value.trim() !== q) return; // stale response
        var ql = q.toLowerCase();
        var cities = (r[2] || []).filter(function (c) { return c.toLowerCase().indexOf(ql) !== -1; });
        render(q, r[0], r[1], cities);
      }).catch(function () { close(); });
    }

    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(lookup, 250);
    });
    input.addEventListener('keydown', function (e) {
      if (pop.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); highlight(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(active - 1); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); location.href = rows()[active].href; }
      else if (e.key === 'Escape') { close(); }
    });
    input.addEventListener('blur', function () { setTimeout(close, 120); });
  };

  // ---- Rails: prev/next arrows -------------------------------------------
  function initRails() {
    var rails = doc.querySelectorAll('[data-rail]');
    for (var i = 0; i < rails.length; i++) bindRail(rails[i]);
  }
  function bindRail(wrap) {
    var track = wrap.querySelector('.rail');
    var prev = wrap.querySelector('.rail-btn.prev');
    var next = wrap.querySelector('.rail-btn.next');
    if (!track) return;
    function step() { return Math.max(280, Math.round(track.clientWidth * 0.8)); }
    function update() {
      if (!prev || !next) return;
      var max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
      var atEnds = prev.disabled && next.disabled; // nothing to scroll
      if (prev) prev.hidden = atEnds;
      if (next) next.hidden = atEnds;
    }
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // Re-check after cards land (observe child changes once).
    var mo = new MutationObserver(update);
    mo.observe(track, { childList: true });
    update();
  }

  // ---- download-the-app buttons -------------------------------------------
  // ponytail: store URLs stay '' until the app ships — buttons keep their
  // /download.html href; fill these in and nothing else changes.
  var APP_STORE_URL = '', PLAY_STORE_URL = '';
  function initDownloadBtns() {
    var ua = navigator.userAgent || '';
    var store = /iPhone|iPad|iPod/i.test(ua) ? APP_STORE_URL : (/Android/i.test(ua) ? PLAY_STORE_URL : '');
    if (!store) return;
    doc.querySelectorAll('[data-app-download]').forEach(function (a) { a.href = store; });
  }

  // ---- boot ---------------------------------------------------------------
  function boot() { initNav(); initRails(); initDownloadBtns(); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
  Drop.initRails = initRails; // pages that inject rails later can re-bind
})();
