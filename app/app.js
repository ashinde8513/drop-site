/*
 * app/app.js — standalone runtime for the Drop post-login web app.
 *
 * Ported from design-drop/Drop Website.dc.html. That file's markup is written
 * in claude.ai's "dc" template dialect ({{ expr }} interpolation, <sc-if
 * value="...">, <sc-for list="..." as="item">) and its <script data-dc-script>
 * is a `class Component extends DCLogic { state = {...}; go(screen){...} ... }`
 * meant to be interpreted by a proprietary React-based runtime (support.js,
 * loaded from unpkg + claude.ai infra) that this deploy must not depend on.
 *
 * Below is a from-scratch, dependency-free reimplementation of just the
 * subset of that runtime this file actually exercises (verified by grepping
 * the source: no x-import/dc-import, no streaming, no <select>/<table>) —
 * expression resolver, {{ }}/sc-if/sc-for -> real DOM, and a minimal
 * setState/re-render loop standing in for DCLogic+React. Everything from
 * "DESIGN COMPONENT (verbatim)" to the matching closing brace below is the
 * design's own class, byte-for-byte unchanged from the .dc.html script.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Expression resolver — ported from dc-runtime src/expr.ts (identifier /
  // dotted-path / bracket access / literals / top-level ===,!==,==,!=, !x).
  // Every {{ }} binding in this file's markup is one of those forms (no
  // arithmetic/&&/|| is used anywhere in the template — verified by grep).
  // ---------------------------------------------------------------------
  const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*/;
  const NUMBER_RE = /^-?\d+(\.\d+)?$/;

  function resolve(vals, src) {
    const expr = String(src).trim();
    if (!expr) return undefined;
    if (expr[0] === '(' && expr[expr.length - 1] === ')' && parensWrapWhole(expr)) {
      return resolve(vals, expr.slice(1, -1));
    }
    const eq = findTopLevelEquality(expr);
    if (eq) {
      const lv = resolve(vals, expr.slice(0, eq.index));
      const rv = resolve(vals, expr.slice(eq.index + eq.op.length));
      switch (eq.op) {
        case '===': return lv === rv;
        case '!==': return lv !== rv;
        case '==': return lv == rv; // eslint-disable-line eqeqeq
        default: return lv != rv; // eslint-disable-line eqeqeq
      }
    }
    if (expr[0] === '!') return !resolve(vals, expr.slice(1));
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (expr === 'undefined') return undefined;
    if (NUMBER_RE.test(expr)) return Number(expr);
    if (expr.length >= 2 && (expr[0] === '"' || expr[0] === "'") && expr[expr.length - 1] === expr[0]) {
      return expr.slice(1, -1);
    }
    return resolvePath(vals, expr);
  }

  function parensWrapWhole(expr) {
    let depth = 0;
    for (let i = 0; i < expr.length - 1; i++) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') {
        depth--;
        if (depth === 0) return false;
      }
    }
    return true;
  }

  function findTopLevelEquality(expr) {
    let depth = 0;
    for (let i = 0; i < expr.length; i++) {
      const c = expr[i];
      if (c === '[' || c === '(') depth++;
      else if (c === ']' || c === ')') depth--;
      else if (depth === 0 && (c === '=' || c === '!') && expr[i + 1] === '=') {
        if (i > 0 && (expr[i - 1] === '=' || expr[i - 1] === '!')) continue;
        if (!expr.slice(0, i).trim()) continue;
        const op = expr[i + 2] === '=' ? c + '==' : c + '=';
        return { index: i, op };
      }
    }
    return null;
  }

  function resolvePath(vals, expr) {
    const head = expr.match(IDENT_RE);
    if (!head) return undefined;
    let cur = vals == null ? undefined : vals[head[0]];
    let i = head[0].length;
    while (i < expr.length) {
      if (expr[i] === '.') {
        const m = expr.slice(i + 1).match(IDENT_RE) || expr.slice(i + 1).match(/^\d+/);
        if (!m) return undefined;
        cur = cur == null ? undefined : cur[m[0]];
        i += 1 + m[0].length;
      } else if (expr[i] === '[') {
        let depth = 1;
        let j = i + 1;
        while (j < expr.length && depth > 0) {
          if (expr[j] === '[') depth++;
          else if (expr[j] === ']') {
            depth--;
            if (depth === 0) break;
          }
          j++;
        }
        if (depth !== 0) return undefined;
        const key = resolve(vals, expr.slice(i + 1, j));
        cur = cur == null ? undefined : cur[key];
        i = j + 1;
      } else {
        return undefined;
      }
    }
    return cur;
  }

  // whole `{{ expr }}` attr -> resolver fn; mixed text -> string-join fn.
  function compileAttr(raw) {
    const whole = raw.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
    if (whole) {
      const path = whole[1];
      return (vals) => resolve(vals, path);
    }
    if (raw.includes('{{')) {
      const parts = raw.split(/\{\{([\s\S]+?)\}\}/g);
      return (vals) => parts.map((s, i) => (i & 1 ? resolve(vals, s) ?? '' : s)).join('');
    }
    return () => raw;
  }

  // ---------------------------------------------------------------------
  // Template compiler: {{ }} text / <sc-if value> / <sc-for list as> -> real
  // DOM nodes (no virtual dom / React — full-tree rebuild on every
  // setState, which is plenty fast for a 49-screen mock). on* attrs resolve
  // to a function and get addEventListener'd; boolean attr values (from a
  // whole {{ }} match) follow native HTML boolean-attribute semantics.
  // ---------------------------------------------------------------------
  const EVENT_MAP = { onclick: 'click', onchange: 'change', oninput: 'input', onfocus: 'focus', onblur: 'blur', onsubmit: 'submit', onkeydown: 'keydown' };

  function walkText(node) {
    const txt = node.nodeValue || '';
    if (!txt.includes('{{')) {
      if (!txt.trim() && !txt.includes(' ')) return null;
      return () => [document.createTextNode(txt)];
    }
    const parts = txt.split(/\{\{([\s\S]+?)\}\}/g);
    return (vals) =>
      parts
        .map((p, i) => {
          if (!(i & 1)) return p ? document.createTextNode(p) : null;
          const v = resolve(vals, p);
          if (v === undefined || v === null || typeof v === 'boolean') return null;
          return document.createTextNode(String(v));
        })
        .filter(Boolean);
  }

  function walkChildren(node) {
    return Array.from(node.childNodes).map(walk).filter(Boolean);
  }

  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) return walkText(node);
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const tag = node.tagName.toLowerCase();
    if (tag === 'sc-for') return walkFor(node);
    if (tag === 'sc-if') return walkIf(node);
    return walkElement(node);
  }

  function walkFor(node) {
    const listFn = compileAttr(node.getAttribute('list') || '');
    const asName = node.getAttribute('as') || 'item';
    const kids = walkChildren(node);
    return (vals) => {
      const list = listFn(vals);
      if (!Array.isArray(list)) return [];
      const out = [];
      list.forEach((item, i) => {
        const sub = Object.assign({}, vals, { [asName]: item, $index: i });
        kids.forEach((b) => out.push(...b(sub)));
      });
      return out;
    };
  }

  function walkIf(node) {
    const valFn = compileAttr(node.getAttribute('value') || '');
    const kids = walkChildren(node);
    return (vals) => {
      if (!valFn(vals)) return [];
      const out = [];
      kids.forEach((b) => out.push(...b(vals)));
      return out;
    };
  }

  function walkElement(node) {
    const tag = node.tagName.toLowerCase();
    const attrs = Array.from(node.attributes).map((a) => [a.name, compileAttr(a.value)]);
    const kids = walkChildren(node);
    // stable key so a focused text/range input survives a full-tree re-render
    // (see mount()) — derived from its static `value="{{ expr }}"` binding.
    const valueAttr = node.getAttribute('value');
    const wholeVal = valueAttr && /^\{\{([\s\S]+?)\}\}$/.exec(valueAttr);
    const bindKey = wholeVal ? wholeVal[1].trim() : null;
    return (vals) => {
      const el = document.createElement(tag);
      for (const [name, fn] of attrs) {
        if (EVENT_MAP[name]) {
          const handler = fn(vals);
          if (typeof handler === 'function') el.addEventListener(EVENT_MAP[name], handler);
          continue;
        }
        const v = fn(vals);
        if (v === undefined || v === null || v === false) continue;
        if (v === true) {
          el.setAttribute(name, '');
          continue;
        }
        el.setAttribute(name, String(v));
      }
      if (bindKey) el.dataset.bindKey = bindKey;
      kids.forEach((b) => b(vals).forEach((n) => el.appendChild(n)));
      return [el];
    };
  }

  function compileTemplate(html) {
    const tpl = document.createElement('template');
    tpl.innerHTML = html;
    const builders = walkChildren(tpl.content);
    return (vals) => {
      const frag = document.createDocumentFragment();
      builders.forEach((b) => b(vals).forEach((n) => frag.appendChild(n)));
      return frag;
    };
  }

  // Full-tree render into `container`, preserving focus + caret/selection on
  // whatever bound input the user was typing into (see walkElement's
  // bindKey) — otherwise every keystroke would blur the field.
  function mount(container, render, vals) {
    const active = document.activeElement;
    let savedKey = null;
    let savedStart = null;
    let savedEnd = null;
    if (active && active.dataset && active.dataset.bindKey && container.contains(active)) {
      savedKey = active.dataset.bindKey;
      if ('selectionStart' in active) {
        savedStart = active.selectionStart;
        savedEnd = active.selectionEnd;
      }
    }
    container.replaceChildren(render(vals));
    if (savedKey) {
      const el = container.querySelector('[data-bind-key="' + CSS.escape(savedKey) + '"]');
      if (el) {
        el.focus();
        if (savedStart != null && 'setSelectionRange' in el) {
          try {
            el.setSelectionRange(savedStart, savedEnd);
          } catch (e) {
            /* not a text-selectable input type (e.g. range) — ignore */
          }
        }
      }
    }
  }

  // Genre carousel (Discover "Pick your night") — the rail is a fresh DOM node
  // after every full-tree re-render, so re-wire its scroll listener + arrow
  // disabled-at-ends state on each mount. Arrow clicks scrollBy() the node
  // directly (no setState), so a smooth scroll isn't reset mid-flight.
  function syncGenreArrows() {
    const rail = document.getElementById('genreRail');
    const prev = document.getElementById('genrePrev');
    const next = document.getElementById('genreNext');
    if (!rail || !prev || !next) return;
    const max = rail.scrollWidth - rail.clientWidth - 1;
    prev.disabled = rail.scrollLeft <= 0;
    next.disabled = max <= 0 || rail.scrollLeft >= max;
  }
  function wireGenreRail() {
    const rail = document.getElementById('genreRail');
    if (!rail) return;
    rail.addEventListener('scroll', syncGenreArrows, { passive: true });
    syncGenreArrows();
  }

  // ---------------------------------------------------------------------
  // Minimal DCLogic base — state/setState/forceUpdate + a render hook. The
  // design's Component class extends this exactly like it extended the
  // proprietary runtime's DCLogic/StreamableLogic.
  // ---------------------------------------------------------------------
  let scheduleRender = () => {}; // wired up by boot(), after Component exists

  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
    }
    setState(update, cb) {
      const patch = typeof update === 'function' ? update(this.state) : update;
      this.state = Object.assign({}, this.state, patch);
      scheduleRender();
      if (cb) cb();
    }
    forceUpdate() {
      scheduleRender();
    }
    componentDidMount() {}
    componentDidUpdate() {}
    componentWillUnmount() {}
    renderVals() {
      return {};
    }
  }

  // =======================================================================
  // PHASE 1 — real Supabase wiring. Same client + auth patterns as
  // account.js (same URL/anon key, same login-with-username edge function,
  // same PKCE flow) and the same public fetch layer as data.js (loaded via
  // <script src="/data.js"> — window.Drop). Kept outside the "verbatim"
  // Component class below so the ported design block stays diffable against
  // the .dc.html source; Component methods reference these by closure.
  // =======================================================================
  var SUPA_URL = 'https://ebccwnkmsnhbljxxxdej.supabase.co';
  var SUPA_KEY = 'sb_publishable_ZMsNcfhfqsGgyvsdBDTKHg__h8SDZyd';
  var supa = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPA_URL, SUPA_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
      })
    : null;
  var Drop = window.Drop || null; // from data.js — public event catalog + formatters

  function looksLikeEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v || ''); }
  function cleanUsername(v) { return String(v || '').trim().replace(/^@+/, '').toLowerCase(); }
  function ageFromDob(v) {
    var dob = new Date(v);
    if (isNaN(dob.getTime())) return null;
    return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }
  function fieldVal(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function fieldChecked(id) { var el = document.getElementById(id); return !!(el && el.checked); }

  // Stable per-event gradient — real events carry no per-row art direction,
  // so pick deterministically from the design's preset palette (same trick
  // already used for the artist-page ARTIST_GRADS pick further down).
  var EVENT_GRADS = [
    'linear-gradient(120deg,#2b1c4d,#0d3b52 55%,#143a22)', 'linear-gradient(120deg,#4d1c37,#52270d 55%,#22143a)',
    'linear-gradient(120deg,#1c384d,#3b0d52 55%,#3a2b14)', 'linear-gradient(120deg,#3a1c4d,#0d5250 55%,#3a1414)',
    'linear-gradient(120deg,#1c274d,#520d47 55%,#143a3a)', 'linear-gradient(120deg,#4d3a1c,#0d2f52 55%,#3a1436)',
  ];
  function hashStr(str) {
    var h = 0, s = String(str || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function gradFor(id) { return EVENT_GRADS[hashStr(id) % EVENT_GRADS.length]; }

  // Discover date-chip -> real from/to window for Drop.fetchEvents.
  function dateWindow(dchip) {
    var now = new Date();
    var today = new Date(now); today.setHours(0, 0, 0, 0);
    var from = today, to;
    if (dchip === 'today') { to = new Date(today); to.setHours(23, 59, 59, 999); }
    else if (dchip === 'weekend') {
      // "This weekend" = the Fri–Sun containing today, or the upcoming one on
      // Mon–Thu. from must be the LATER of Friday and today — the old version
      // always started at today, so Mon–Thu leaked into the weekend window.
      var day = now.getDay(); // 0=Sun
      var fri = new Date(today);
      fri.setDate(fri.getDate() + (day === 0 ? -2 : 5 - day));
      from = fri > today ? fri : today;
      to = new Date(fri); to.setDate(to.getDate() + 2); to.setHours(23, 59, 59, 999);
    } else if (dchip === '30') { to = new Date(today); to.setDate(to.getDate() + 30); to.setHours(23, 59, 59, 999); }
    else { to = new Date(today); to.setDate(to.getDate() + 365); to.setHours(23, 59, 59, 999); } // 'all' upcoming
    return { from: from.toISOString(), to: to.toISOString() };
  }

  function festivalDateLabel(startIso, endIso, timeZone) {
    if (!startIso) return 'DATES TO BE ANNOUNCED';
    const opts = { month:'short', day:'numeric' };
    if (timeZone) opts.timeZone = timeZone;
    const start = new Date(startIso);
    const end = endIso ? new Date(endIso) : null;
    try {
      const fmt = new Intl.DateTimeFormat('en-US', opts);
      const first = fmt.format(start);
      if (!end || isNaN(end.getTime()) || zonedDayKey(startIso, timeZone) === zonedDayKey(endIso, timeZone)) return first.toUpperCase();
      return (first + ' – ' + fmt.format(end)).toUpperCase();
    } catch (_) {
      return (Drop && Drop.fmtDate(startIso) || 'Dates TBA').toUpperCase();
    }
  }

  function zonedTime(iso, timeZone) {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone || undefined,
        hour: 'numeric', minute: '2-digit', hour12: true,
      }).format(new Date(iso)).replace(':00', '').replace(/\s/g, '');
    } catch (_) {
      const d = new Date(iso);
      let h = d.getHours(); const m = d.getMinutes(); const ap = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return h + (m ? ':' + String(m).padStart(2, '0') : '') + ap;
    }
  }

  function zonedDayKey(iso, timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timeZone || undefined, year:'numeric', month:'2-digit', day:'2-digit',
      }).formatToParts(new Date(iso));
      const value = {};
      parts.forEach(p => { if (p.type !== 'literal') value[p.type] = p.value; });
      return value.year + '-' + value.month + '-' + value.day;
    } catch (_) {
      return String(iso).slice(0, 10);
    }
  }

  function zonedDayLabel(iso, timeZone) {
    if (!iso) return 'Date TBA';
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone || undefined,
        weekday:'short', month:'short', day:'numeric',
      }).format(new Date(iso));
    } catch (_) {
      return String(iso).slice(0, 10);
    }
  }

  function setsOverlap(a, b) {
    const aStart = Date.parse(a.start_time), bStart = Date.parse(b.start_time);
    const aEnd = a.end_time ? Date.parse(a.end_time) : aStart + 60 * 60000;
    const bEnd = b.end_time ? Date.parse(b.end_time) : bStart + 60 * 60000;
    return aStart < bEnd && bStart < aEnd;
  }

  // DB url -> a CSS url() token safe to inject into an inline style attribute:
  // safeUrl enforces http(s), then quote/paren/backslash/space are %-encoded so
  // the value can't break out of url('…') (CSS injection via image_url).
  function cssUrl(u) {
    u = Drop && Drop.safeUrl(u);
    if (!u) return null;
    return "url('" + u.replace(/['"()\\\s]/g, function (c) { return encodeURIComponent(c); }) + "')";
  }

  // Same art chain as the public site cards (site rule since 2026-07-11):
  // real event image -> lineup artist photo -> prism gradient. The photo is
  // layered OVER the gradient so the gradient shows while it loads/fails.
  function artFor(ev) {
    var grad = gradFor(ev.id);
    // CSS background layers are fetched in parallel, so keep this bounded:
    // event art plus the first two billed artist fallbacks.
    var urls = Drop ? Drop.eventArtCandidates(ev).slice(0, 3).map(cssUrl).filter(Boolean) : [];
    return urls.concat([grad]).join(', ');
  }

  // Real Supabase event row -> the view-model shape the ported markup expects.
  // `friends`/goingCount stay at 0/'—' — there is no real friend-attendance
  // signal wired yet (out of Phase 1 scope), so no fake social proof is shown.
  function mapRealEvent(ev) {
    var artists = (ev.event_artists || []).map(function (x) { return x.artists; }).filter(Boolean);
    return {
      id: ev.id,
      title: ev.title,
      venue: ev.venue_name || '',
      venueCity: [ev.venue_name, ev.city].filter(Boolean).join(' · '),
      dateShort: (Drop && Drop.fmtDate(ev.date, ev.time_tbd) || 'Date TBD').toUpperCase(),
      dateLong: (Drop && Drop.fmtDate(ev.date, ev.time_tbd)) || 'Date TBD',
      price: Drop ? Drop.fmtPrice(ev.price_min, ev.price_max) : 'See tickets',
      genre: Drop ? Drop.genreOf(ev) : 'Live music',
      grad: artFor(ev),
      ticketUrl: (Drop && Drop.safeUrl(ev.ticket_url)) || '',
      friends: 0,
      goingCount: '—', interestedCount: '—',
      presaleLive: false, presaleCode: '', onsale: ev.status === 'published' ? 'On sale now' : 'Not yet on sale',
      lineup: artists.map(function (a) { return a.name; }),
      lineupArtists: artists, // [{id,name,genres,image_url}] — real artist ids, used to wire follow writes
      city: ev.city || '',
      state: ev.state || '',
      date: ev.date,
      isFestival: !!ev.is_festival,
      endDate: ev.end_date || null,
      timezone: ev.timezone || null,
    };
  }

  // USPS code -> full name, for state lookups in city/venue/event search.
  const STATE_NAMES = { AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California', CO:'Colorado', CT:'Connecticut', DE:'Delaware', DC:'Washington DC', FL:'Florida', GA:'Georgia', HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas', KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland', MA:'Massachusetts', MI:'Michigan', MN:'Minnesota', MS:'Mississippi', MO:'Missouri', MT:'Montana', NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico', NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma', OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina', SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont', VA:'Virginia', WA:'Washington', WV:'West Virginia', WI:'Wisconsin', WY:'Wyoming' };
  const stateName = st => STATE_NAMES[st] || st || '';

  // ponytail: store URLs stay '' until the app ships — the button routes to
  // the public download/waitlist page; fill these in and nothing else changes.
  const APP_STORE_URL = '', PLAY_STORE_URL = '';
  function appDownloadHref() {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    if (/iPhone|iPad|iPod/i.test(ua) && APP_STORE_URL) return APP_STORE_URL;
    if (/Android/i.test(ua) && PLAY_STORE_URL) return PLAY_STORE_URL;
    return 'https://trydropapp.com/download.html';
  }

  // Canvas render of the Wrapped 9:16 share card — a from-scratch redraw
  // (not a DOM screenshot; no html2canvas dependency) good enough for
  // "Download image". Native share (wrappedShare handler) covers "post to
  // story" without needing a pixel-perfect canvas clone of the on-screen card.
  function renderWrappedCard(wr) {
    var W = 720, H = 1280;
    var canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#2b1c4d'); grad.addColorStop(0.55, '#0d3b52'); grad.addColorStop(1, '#143a22');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 34px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText('◆ DROP', 56, 100);

    ctx.fillStyle = '#4DE2FF';
    ctx.font = '800 24px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(wr.badge, 56, 180);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 140px "Space Grotesk", system-ui, sans-serif';
    ctx.fillText(wr.shows, 52, 360);

    ctx.fillStyle = '#C4CCD8';
    ctx.font = '400 28px "Sora", system-ui, sans-serif';
    ctx.fillText(wr.showsLabel, 56, 410);

    var rows = [['Top artist', wr.topArtist], ['Top venue', wr.topVenue], ['Top genre', wr.topGenre]];
    var y = H - 260;
    rows.forEach(function (pair) {
      ctx.fillStyle = '#7C8597';
      ctx.font = '400 24px "Sora", system-ui, sans-serif';
      ctx.fillText(pair[0], 56, y);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 26px "Space Grotesk", system-ui, sans-serif';
      ctx.fillText(String(pair[1] || '—'), 260, y);
      y += 60;
    });
    return canvas;
  }

  // =======================================================================
  // DESIGN COMPONENT (verbatim) — Drop Website.dc.html lines 2933-4105,
  // byte-for-byte unchanged: state, all 49 screens' derived render values,
  // go() router, every event handler. Do not hand-edit; re-run the ingest
  // if the design file changes. (Phase 1 wiring lives in new methods/state
  // added at the edges — search "PHASE 1" — rather than inline in this block.)
  // =======================================================================
class Component extends DCLogic {
  state = {
    screen: 'home', authed: false, activeId: 'odesza',
    activeArtist: 'ODESZA', activeVenue: 'Red Rocks Amphitheatre',
    following: {}, followingVenue: {},
    myTab: 'Upcoming', ratings: {},
    gate: false, gateReturn: null, gateTitle: 'Join the crew',
    rsvp: {}, saved: {},
    dtab: 'Happening', dchip: 'all', discPage: 0,
    city: 'Denver, CO', cityOpen: false, cityFilter: '', menuOpen: false,
    username: '', descClamped: true, toast: null,
    genre: null,
    // search
    query: '', distance: '25', priceMin: 0, priceMax: 200, sGenres: {}, searchGeo: 'idle',
    // search filter dropdowns (design round 4) — distance/genre/city/venue selects
    sDistOpen: false, searchGenreOpen: false, searchGenreFilter: '',
    sCity: '', sVenue: '', sCityOpen: false, sVenueOpen: false, sCityFilter: '', sVenueFilter: '',
    // festival — always live rows; no seeded schedule or fake friend picks.
    festTab: 'All', stars: {}, festivalEvent: null, festivalSetTimes: [],
    festivalLoading: false, festivalError: null,
    // activation wizard
    wizStep: 0, wizGenres: {}, wizFriendSel: {}, wizArtistSel: {}, wizArtQuery: '',
    // settings
    setToggles: { reminders: true, sales: true, comments: false, plans: true },
    recapPrivacy: true, deleteConfirm: '',
    // notifications (unread ids)
    notifRead: {},
    // pick artists / venues / crew / plans / wrapped
    artGenre: 'All', artShown: 48, followArt: {}, followVen: {},
    venueQuery: '',
    crewTab: 'Friends', reqActioned: {}, addedPeople: {},
    activePlan: 'p-odesza', planSpot: {}, planTab: 'plan',
    wrappedRange: 'This year',
    invited: {},
    // log a past show — archive picker (multi-select) + manual form
    logQuery: '', logYear: 'All', logResults: [], logSelected: {}, logSearching: false,
    logArtist: '', logVenue: '', logCity: '', logState: '', logDate: '',
    loggedShows: [],
    // memories / recap
    recapWasThere: null, recapPhotos: {},
    tagActioned: {},
    // drop+
    plusPlan: 'annual',
    activeGenre: 'Techno',
    // taste manager
    scConnected: false, tasteConsent: false, tasteGenres: {House:true, Melodic:true, Techno:true},
    tasteArtists: [], tasteQuery: '', tasteImport: false,
    // suggest an event
    sugArtist: '', sugVenue: '', sugCity: 'Denver, CO', sugLink: '',
    // states
    loading: false,
    notifCleared: false,
    // roles
    isPromoter: false,
    // promoter
    managePromoEvent: 'pe1', promoTab: 'details', promoDelConfirm: '',
    guestChecked: { g1:true, g3:true }, codeActive: { c1:true, c2:false },
    // admin
    adminTab: 'queue', reviewActioned: {}, reportState: {},
    // mobile nav
    navOpen: false,
    // PHASE 1 — real Supabase wiring
    userId: null, userEmail: '', profile: null,
    authBusy: false, authError: '', verifyEmail: '', verifyMessage: '',
    activeArtistId: null, venueCity: '',
    realEvents: [], eventsLoading: true, eventsError: null,
    myShowsRows: [], realShowsCount: null, realArtistsCount: null,
    // artist detail (real row) + claim/edit-links flow
    activeArtistRow: null, claimStatus: null, pendingClaimArtistId: null,
    claimStep: 0, claimArtist: null, claimArtistId: null, claimHasListing: true,
    claimNotListed: false, claimNewName: '', claimWebsite: '', claimSocial: '', claimEmail: '',
    claimSubmitted: false, claimBusy: false, claimError: '',
    editLinksOpen: false, editMerch: '', editWebsite: '',
  };

  // City picker catalog — the cities Drop covers, for the nav dropdown's
  // filter/scroll list. ponytail: seed counts are decorative (the actual grid
  // still loads live from Supabase on pick); Denver leads because it's the
  // launch market. Free-typed cities are honored via cityKey (Enter).
  // Real city catalog — derived from the full event catalog by loadCatalog()
  // (deriveCities): every city with an upcoming show, counts included.
  CITIES = [];

  // Renamed to match data.js's real genre buckets (Drop.genreOf) instead of
  // the design's invented labels — Dubstep/Melodic/Trance had no real
  // counterpart in the actual event data. ponytail: gradients unchanged, just
  // relabeled, so no CSS/markup churn.
  GENRES = [
    { name:'House', grad:'background:linear-gradient(120deg,#2b1c4d,#0d3b52);' },
    { name:'Bass', grad:'background:linear-gradient(120deg,#4d1c37,#52270d);' },
    { name:'Techno', grad:'background:linear-gradient(120deg,#1c384d,#3b0d52);' },
    { name:'Drum & Bass', grad:'background:linear-gradient(120deg,#1c274d,#520d47);' },
    { name:'Hip-Hop', grad:'background:linear-gradient(120deg,#4d3a1c,#0d2f52);' },
    { name:'Indie', grad:'background:linear-gradient(120deg,#1c4d3a,#52270d);' },
  ];

  // ponytail: no crew/friends table wired this phase — comments has no
  // backend either (no event_comments table). Both stay empty; templates
  // show an honest empty state instead of seed content.
  COMMENTS = [];

  // ponytail: no friends/crew backend this phase — friend suggestions,
  // requests, plans and the wizard's friend-add step all stay empty (honest
  // empty states in the templates) instead of seeding fake people.
  WIZ_FRIENDS = [];
  FRIENDS = [];
  REQUESTS = [];
  FIND_PEOPLE = [];
  PLANS = [];

  // ponytail: no Drop+ wallet/ledger table wired this phase — earn history
  // stays empty (honest "No Drop+ activity yet" empty state).
  LEDGER = [];
  LEDGER_STATES = {
    confirmed: { label:'Confirmed', color:'var(--attended)', bg:'rgba(182,255,106,0.12)' },
    pending:   { label:'Pending', color:'var(--gold)', bg:'rgba(255,203,61,0.12)' },
    review:    { label:'Under review', color:'var(--interested)', bg:'rgba(77,226,255,0.12)' },
    reversed:  { label:'Reversed', color:'var(--danger)', bg:'rgba(255,92,114,0.12)' },
  };

  // ponytail: no tagged-in-shows / event-submission tables wired this phase —
  // both stay empty (honest empty states in the templates).
  TAGGED = [];

  SUBMISSIONS = [];
  SUB_STATUS = {
    live:     { label:'Live', color:'var(--attended)', bg:'rgba(182,255,106,0.12)' },
    review:   { label:'In review', color:'var(--gold)', bg:'rgba(255,203,61,0.12)' },
    rejected: { label:'Not added', color:'var(--text-muted)', bg:'var(--surface-hi)' },
  };

  // ponytail: promoter events/guests/codes and admin review-queue/reports/
  // analytics all need real tables no schema has yet — stay empty (honest
  // empty states in the templates) instead of seeded fake dashboards.
  PROMO_EVENTS = [];
  GUESTS = [];
  CODES = [];
  REVIEW_QUEUE = [];
  REPORTS = [];
  ADMIN_SIGNUPS = [];
  ADMIN_TOP_EVENTS = [];
  ADMIN_ACTIONS = [];

  // ponytail: no "shows you've seen" history table this phase — stays empty.
  SEEN_HISTORY = [];

  // ponytail: no notifications table this phase — stays empty.
  NOTIFS = [];

  // ponytail: no blocked-accounts table this phase — stays empty.
  BLOCKED = [];

  // ARTIST_GRADS: deterministic gradient palette (not user data) — kept.
  ARTIST_GRADS = ['linear-gradient(120deg,#2b1c4d,#0d3b52 55%,#143a22)','linear-gradient(120deg,#4d1c37,#52270d 55%,#22143a)','linear-gradient(120deg,#1c384d,#3b0d52 55%,#3a2b14)','linear-gradient(120deg,#3a1c4d,#0d5250 55%,#3a1414)'];

  // Share = copy the event's public page URL (the SEO page works signed-out,
  // so it's the right link to hand a friend). Same URL shape site.js uses.
  shareEvent(id){
    const url = 'https://trydropapp.com/event.html?id=' + encodeURIComponent(id || '');
    if (!id) { this.flash('Nothing to share yet'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(
        ()=>this.flash('Link copied to clipboard'),
        ()=>this.flash(url));
    } else { this.flash(url); }
  }

  go(s){
    // Authed users never land on the marketing hero — Discover is the
    // logged-in main (design contract; hero is a signed-out surface).
    if (s === 'home' && this.state.authed) s = 'discover';
    if (s !== 'festival') this._festivalRequest = (this._festivalRequest || 0) + 1;
    const withSkel = (s==='discover'||s==='event'||s==='search'||s==='myshows');
    this.setState({ screen: s, cityOpen:false, menuOpen:false, navOpen:false, loading: withSkel });
    if(typeof window!=='undefined') window.scrollTo(0,0);
    if(withSkel){ clearTimeout(this._skelT); this._skelT = setTimeout(()=>this.setState({loading:false}), 750); }
  }
  prevent(e){ if(e&&e.preventDefault) e.preventDefault(); }

  flash(msg){ this.setState({ toast: msg }); clearTimeout(this._t); this._t = setTimeout(()=>this.setState({toast:null}), 2200); }

  openGate(title){ this.setState({ gate:true, gateTitle: title||'Join the crew', menuOpen:false }); }

  toggleRsvp(id, status){
    if(!this.state.authed){ this.openGate(status==='going'?'Log in to RSVP':'Log in to save'); return; }
    const cur = this.state.rsvp[id];
    const next = cur===status ? null : status;
    this.setState(s=>{ const rsvp={...s.rsvp}; rsvp[id]=next; return {rsvp}; });
    // PHASE 1: real write — attendance(user_id,event_id,status), same
    // upsert/delete shape as DropApp/src/data/index.ts's setAttendance().
    if (supa && this.state.userId) {
      const uid = this.state.userId;
      const p = next===null
        ? supa.from('attendance').delete().eq('user_id', uid).eq('event_id', id)
        : supa.from('attendance').upsert({ user_id: uid, event_id: id, status: next }, { onConflict: 'user_id,event_id' });
      p.then(r=>{ if (r && r.error) console.error('[app] attendance write failed:', r.error.message); else this.loadMyShows(uid); });
    }
  }
  toggleSave(id){
    if(!this.state.authed){ this.openGate('Log in to save'); return; }
    // ponytail: "Saved" has no backing table (attendance only has going/
    // interested/attended) — stays a local-only bookmark, not persisted.
    this.setState(s=>({ saved:{...s.saved, [id]: !s.saved[id]} }));
    this.flash(this.state.saved[id] ? 'Removed from saved' : 'Saved to My Shows');
  }

  // ===== PHASE 1: real data loaders =====================================
  // Full upcoming catalog — EVERY published show, paged past PostgREST's
  // 1000-row cap, fetched once per session. City/date narrowing is client-
  // side so the city picker (all ~200 cities), venues browse and search
  // cover the whole DB instead of one 240-row page.
  loadFestivalCatalog(){
    if (this._festivalCatalogP) return this._festivalCatalogP;
    this._festivalCatalogP = Drop.fetchFestivals({ limit: 1000 })
      .catch(err => { this._festivalCatalogP = null; throw err; });
    return this._festivalCatalogP;
  }
  loadCatalog(){
    if (this._catalogP) return this._catalogP;
    const page = (offset, acc) => Drop.fetchEvents({ limit: 1000, offset })
      .then(rows => { acc.push(...(rows||[])); return (rows && rows.length === 1000) ? page(offset+1000, acc) : acc; });
    this._catalogP = Promise.all([page(0, []), this.loadFestivalCatalog().catch(() => [])]).then(([rows, festivals]) => {
      const byId = new Map(rows.map(row => [row.id, row]));
      (festivals || []).forEach(row => byId.set(row.id, row));
      rows = [...byId.values()].sort((a,b) => String(a.date||'').localeCompare(String(b.date||'')) || String(a.id||'').localeCompare(String(b.id||'')));
      this.CATALOG = rows;
      this.CITIES = this.deriveCities(rows);
      return rows;
    }).catch(err => { this._catalogP = null; throw err; });
    return this._catalogP;
  }
  deriveCities(rows){
    const seen = new Map();
    rows.forEach(r => {
      if (!r.city) return;
      const label = r.city + (r.state ? ', ' + r.state : '');
      const e = seen.get(label) || { label, city: r.city, state: r.state || '', count: 0 };
      e.count++; seen.set(label, e);
    });
    return [...seen.values()].sort((a,b)=> b.count-a.count || a.label.localeCompare(b.label));
  }
  loadEvents(){
    this.setState({ eventsLoading:true, eventsError:null, discPage: 0 });
    if (!Drop) { this.setState({ eventsLoading:false, eventsError:'Event catalog unavailable.' }); return; }
    this.loadCatalog().then(()=>{
      const label = this.state.city || '';
      const cityName = label === 'All cities' ? '' : label.split(',')[0].trim().toLowerCase();
      const win = dateWindow(this.state.dchip);
      const fromT = Date.parse(win.from), toT = Date.parse(win.to);
      const rows = this.CATALOG.filter(r => {
        if (cityName && (r.city||'').toLowerCase() !== cityName) return false;
        return Drop.eventOverlapsWindow(r, fromT, toT);
      });
      this.setState({ realEvents: rows, eventsLoading:false });
    }).catch(err=>{ console.error('[app] events fetch failed:', err.message); this.setState({ eventsLoading:false, eventsError:'Could not load shows — try again.' }); });
  }
  openFestival(eventId){
    const requestId = this._festivalRequest = (this._festivalRequest || 0) + 1;
    this._festivalRequestedId = eventId || null;
    this.setState({
      screen:'festival', festivalEvent:null, festivalSetTimes:[], stars:{},
      festivalLoading:true, festivalError:null, festTab:'All',
    });
    if (typeof window!=='undefined') window.scrollTo(0,0);
    if (!supa || !Drop) {
      this.setState({ festivalLoading:false, festivalError:'Festival schedules are unavailable right now.' });
      return;
    }
    Promise.all([this.loadCatalog(), this.loadFestivalCatalog()]).then(([rows, festivals]) => {
      if (requestId !== this._festivalRequest) return;
      const byId = new Map(rows.map(row => [row.id, row]));
      (festivals || []).forEach(row => byId.set(row.id, row));
      rows = [...byId.values()];
      const requestedRow = eventId ? rows.find(r => r.id === eventId && r.is_festival) : null;
      if (eventId && !requestedRow) {
        this.setState({ festivalEvent:null, festivalSetTimes:[], festivalLoading:false, festivalError:'This festival is not available or published.' });
        return;
      }
      const festivalRow = requestedRow || rows.find(r => r.is_festival) || null;
      if (!festivalRow) {
        this.setState({ festivalEvent:null, festivalSetTimes:[], festivalLoading:false, festivalError:'No upcoming festival is published yet.' });
        return;
      }
      const festival = mapRealEvent(festivalRow);
      this._festivalRequestedId = festival.id;
      this.setState({ festivalEvent:festival, festivalSetTimes:[], stars:{} });
      const picksP = this.state.userId
        ? supa.from('my_set_times').select('set_time_id').eq('user_id', this.state.userId)
        : Promise.resolve({ data:[], error:null });
      return Promise.all([
        supa.from('event_set_times').select('*').eq('event_id', festival.id).order('start_time', { ascending:true }),
        picksP,
      ]).then(([setsResult, picksResult]) => {
        if (requestId !== this._festivalRequest) return;
        if (setsResult.error) throw setsResult.error;
        if (picksResult.error) throw picksResult.error;
        const setTimes = (setsResult.data || []).filter(r => r.status === 'published');
        const validIds = new Set(setTimes.map(r => r.id));
        const stars = {};
        (picksResult.data || []).forEach(r => { if (validIds.has(r.set_time_id)) stars[r.set_time_id] = true; });
        this.setState({ festivalEvent:festival, festivalSetTimes:setTimes, stars, festivalLoading:false, festivalError:null });
      });
    }).catch(err => {
      if (requestId !== this._festivalRequest) return;
      console.error('[app] festival schedule load failed:', err.message);
      this.setState({ festivalLoading:false, festivalError:'Could not load this festival schedule — try again.' });
    });
  }
  toggleFestivalSet(setTimeId){
    if (!this.state.authed || !this.state.userId) { this.openGate('Log in to build your schedule'); return; }
    this._festivalWrites = this._festivalWrites || new Set();
    if (this._festivalWrites.has(setTimeId)) return;
    this._festivalWrites.add(setTimeId);
    const wasOn = !!this.state.stars[setTimeId];
    this.setState(s => ({ stars:{ ...s.stars, [setTimeId]:!wasOn } }));
    const write = wasOn
      ? supa.from('my_set_times').delete().eq('user_id', this.state.userId).eq('set_time_id', setTimeId)
      : supa.from('my_set_times').upsert(
        { user_id:this.state.userId, set_time_id:setTimeId },
        { onConflict:'user_id,set_time_id', ignoreDuplicates:true }
      );
    write.then(({ error }) => {
      this._festivalWrites.delete(setTimeId);
      if (!error) return;
      console.error('[app] festival schedule write failed:', error.message);
      this.setState(s => ({ stars:{ ...s.stars, [setTimeId]:wasOn } }));
      this.flash('Could not update your schedule — try again');
    });
  }
  loadProfile(uid){
    if (!supa) return;
    supa.from('profiles').select('id,username,display_name,city,state,bio,profile_image').eq('id', uid).maybeSingle()
      .then(({ data, error })=>{ if (error) console.error('[app] profile load failed:', error.message); else this.setState({ profile: data || null }); });
  }
  loadUserData(uid){
    if (!supa) return;
    supa.from('attendance').select('event_id,status').eq('user_id', uid).then(({ data, error })=>{
      if (error) { console.error('[app] attendance load failed:', error.message); return; }
      const rsvp = {}; (data||[]).forEach(r=>{ rsvp[r.event_id] = r.status; });
      this.setState({ rsvp });
    });
    supa.from('artist_follows').select('artist_id, artists(name)').eq('user_id', uid).then(({ data, error })=>{
      if (error) { console.error('[app] artist_follows load failed:', error.message); return; }
      const following = {}; (data||[]).forEach(r=>{ if (r.artists && r.artists.name) following[r.artists.name] = true; });
      this.setState({ following });
    });
    supa.from('venue_follows').select('venue_name').eq('user_id', uid).then(({ data, error })=>{
      if (error) { console.error('[app] venue_follows load failed:', error.message); return; }
      const followingVenue = {}; (data||[]).forEach(r=>{ if (r.venue_name) followingVenue[r.venue_name] = true; });
      this.setState({ followingVenue });
    });
    Promise.all([
      supa.from('attendance').select('id', { count:'exact', head:true }).eq('user_id', uid).in('status', ['going','attended']),
      supa.from('artist_follows').select('artist_id', { count:'exact', head:true }).eq('user_id', uid),
    ]).then(([showsRes, artistsRes])=>{
      this.setState({ realShowsCount: showsRes.count || 0, realArtistsCount: artistsRes.count || 0 });
    }).catch(()=>{});
    this.loadMyShows(uid);
    this.loadLoggedShows(uid);
  }
  // Dedicated My Shows read — a join, not derived from Discover's fetch, so
  // it's not limited by Discover's city/date-window pagination. Mirrors
  // account.js's loadShows() query shape.
  loadMyShows(uid){
    if (!supa) return;
    supa.from('attendance')
      .select('status, created_at, events(id,title,date,venue_name,city,ticket_url,time_tbd,is_festival,event_artists(artists(id,name,genres)))')
      .eq('user_id', uid)
      .order('created_at', { ascending:false })
      .limit(100)
      .then(({ data, error })=>{
        if (error) { console.error('[app] my shows load failed:', error.message); return; }
        this.setState({ myShowsRows: data || [] });
      });
  }
  // Free-text past shows the user logged manually (logged_shows) — separate
  // from attendance⋈events; merged into Wrapped's all-time/year tallies.
  loadLoggedShows(uid){
    if (!supa) return;
    supa.from('logged_shows')
      .select('artist_name,venue_name,city,state,show_date')
      .eq('user_id', uid)
      .order('show_date', { ascending:false })
      .limit(200)
      .then(({ data, error })=>{
        if (error) { console.error('[app] logged_shows load failed:', error.message); return; }
        this.setState({ loggedShows: data || [] });
      });
  }
  // ===== Log a past show — archive picker query + bulk/manual writes =====
  // Recent PAST published events, optional title/venue search + year filter.
  logSearch(){
    if (!supa) return;
    this.setState({ logSearching:true });
    const nowIso = new Date().toISOString();
    let q = supa.from('events')
      .select('id,title,date,venue_name,city')
      .eq('status', 'published')
      .lt('date', nowIso)
      .order('date', { ascending:false })
      .limit(30);
    // Strip chars that would break the PostgREST or=() filter syntax.
    const term = (this.state.logQuery || '').replace(/[,()]/g, ' ').trim();
    if (term) { const t = '%' + term + '%'; q = q.or('title.ilike.' + t + ',venue_name.ilike.' + t); }
    const yr = this.state.logYear;
    if (yr && yr !== 'All' && /^\d{4}$/.test(yr)) { q = q.gte('date', yr + '-01-01').lte('date', yr + '-12-31T23:59:59'); }
    q.then(({ data, error })=>{
      if (error) { console.error('[app] log archive search failed:', error.message); this.setState({ logSearching:false, logResults:[] }); return; }
      this.setState({ logResults: data || [], logSearching:false });
    });
  }
  // Bulk "I was there" → attendance(status:'attended'); duplicates ignored.
  logAddSelected(){
    const uid = this.state.userId, ids = Object.keys(this.state.logSelected || {});
    if (!supa || !uid || ids.length === 0) return;
    const rows = ids.map(id=>({ user_id:uid, event_id:id, status:'attended' }));
    supa.from('attendance').upsert(rows, { onConflict:'user_id,event_id', ignoreDuplicates:true }).then(({ error })=>{
      if (error && error.code !== '23505') { console.error('[app] log bulk add failed:', error.message); this.flash('Could not add — try again'); return; }
      const n = ids.length;
      this.setState({ logSelected:{} });
      this.loadMyShows(uid);
      this.flash('Added ' + n + ' show' + (n===1?'':'s') + ' to your history');
      this.go('myshows');
    });
  }
  // Manual entry → logged_shows (free-text; no matching catalog event).
  logSubmitManual(){
    const uid = this.state.userId;
    if (!supa || !uid) { this.flash('Log in to add shows'); return; }
    const artist = (this.state.logArtist || '').trim();
    const date = (this.state.logDate || '').trim();
    if (!artist || !date) { this.flash('Artist and date are required'); return; }
    const row = {
      user_id: uid, artist_id: null, artist_name: artist,
      venue_name: (this.state.logVenue || '').trim() || null,
      city: (this.state.logCity || '').trim() || null,
      state: (this.state.logState || '').trim().toUpperCase() || null,
      show_date: date, notes: fieldVal('log-notes').trim() || null,
    };
    supa.from('logged_shows').insert(row).then(({ error })=>{
      if (error) { console.error('[app] logged_shows insert failed:', error.message); this.flash('Could not save — try again'); return; }
      this.setState({ logArtist:'', logVenue:'', logCity:'', logState:'', logDate:'' });
      this.loadLoggedShows(uid);
      this.flash('Show added to your history');
      this.go('myshows');
    });
  }
  afterLogin(){
    if (!supa) return;
    supa.auth.getSession().then(({ data })=>{
      const session = data && data.session;
      if (!session) { if (this.state.pendingClaimArtistId) this.openGate('Log in to claim your profile'); return; }
      this.setState({ authed:true, userId: session.user.id, userEmail: session.user.email || '' });
      // Authed users never sit on the marketing hero or an auth form —
      // Discover is the logged-in home (design: doLogin/doVerify → discover).
      const scr = this.state.screen;
      if (scr === 'home' || scr === 'login' || scr === 'signup') this.go('discover');
      this.loadProfile(session.user.id);
      this.loadUserData(session.user.id);
      if (this.state.screen === 'festival' && this.state.festivalEvent) {
        this.openFestival(this.state.festivalEvent.id);
      }
      this.maybeResumeClaimDeepLink();
    });
  }

  // ===== Artist detail + claim/edit-links (PHASE 1 real writes) ==========
  // Single entry point for every "go to an artist page" call site (lineup
  // chips, similar-artists, pick-artists grid, seo genre page) so the real
  // row fetch happens exactly once, in one place, no matter how the user
  // got there — same root-cause-fix shape as the RSVP/follow writes above.
  openArtist(name, id){
    this.setState({ screen:'artist', activeArtist:name, activeArtistId:id||null, activeArtistRow:null, claimStatus:null });
    if (typeof window!=='undefined') window.scrollTo(0,0);
    this.loadArtistDetail(name, id);
  }
  loadArtistDetail(name, id){
    if (!supa) return;
    const q = supa.from('artists').select('id,name,genres,image_url,merch_url,website_url,claimed_by,verified');
    (id ? q.eq('id', id) : q.eq('name', name)).maybeSingle().then(({ data, error })=>{
      if (error) { console.error('[app] artist detail load failed:', error.message); return; }
      this.setState({ activeArtistRow: data || null, activeArtistId: (data && data.id) || id || null });
      if (data && this.state.userId) this.loadClaimStatus(data.id);
    });
  }
  loadClaimStatus(artistId){
    if (!supa || !this.state.userId) return;
    supa.from('artist_claims').select('status').eq('artist_id', artistId).eq('user_id', this.state.userId).maybeSingle()
      .then(({ data, error })=>{ if (error) { console.error('[app] claim status load failed:', error.message); return; } this.setState({ claimStatus: data ? data.status : null }); });
  }
  // Opens the claim wizard for whatever artist row is currently loaded
  // (activeArtistRow/activeArtistId) — used both by the on-page "Claim this
  // profile" link and the ?claim= deep link below.
  startClaim(){
    const row = this.state.activeArtistRow;
    const hasListing = !!(row && row.id);
    this.setState({
      screen:'claim', claimStep:0, claimArtist:this.state.activeArtist, claimArtistId:hasListing?row.id:null,
      claimHasListing:hasListing, claimNotListed:!hasListing, claimNewName:hasListing?'':this.state.activeArtist,
      claimWebsite:'', claimSocial:'', claimEmail:this.state.userEmail||'', claimSubmitted:false, claimError:'',
    });
    if (typeof window!=='undefined') window.scrollTo(0,0);
  }
  openClaimFor(artistId){
    if (!supa) return;
    supa.from('artists').select('id,name,image_url,merch_url,website_url,claimed_by,verified').eq('id', artistId).maybeSingle().then(({ data, error })=>{
      if (error || !data) { this.flash('Could not find that artist'); return; }
      this.setState({ activeArtist:data.name, activeArtistId:data.id, activeArtistRow:data });
      this.startClaim();
    });
  }
  // ?claim=<artistId> deep link from the public site — resumed once a
  // session exists (right after login, or immediately if already logged in).
  maybeResumeClaimDeepLink(){
    const id = this.state.pendingClaimArtistId;
    if (!id) return;
    this.setState({ pendingClaimArtistId:null });
    this.openClaimFor(id);
  }
  logout(){
    if (supa) supa.auth.signOut().catch(()=>{});
    this.setState({ authed:false, userId:null, userEmail:'', profile:null, rsvp:{}, following:{}, followingVenue:{}, realShowsCount:null, realArtistsCount:null, myShowsRows:[], loggedShows:[], logSelected:{}, logResults:[] });
  }
  oauth(provider){
    if (!supa) { this.setState({ authError:'Login is unavailable. Refresh and try again.' }); return; }
    supa.auth.signInWithOAuth({ provider, options: { redirectTo: location.origin + location.pathname } })
      .then(out=>{ if (out.error) this.setState({ authError: out.error.message }); });
  }

  renderVals(){
    const s = this.state;
    const fl = n => n===1 ? '1 friend' : n+' friends';

    // PHASE 1: real events — Discover/Home/Search/Event-detail all read from
    // s.realEvents (Drop.fetchEvents, PostgREST against the `events` table).
    // The design's mock EVENTS array is gone; every screen below that used to
    // reference it (Plans, crew builder, share cards, first-RSVP moment) now
    // falls back to a real loaded event (or a safe empty stand-in — never a
    // fabricated one) when nothing is loaded yet.
    const decorate = e => {
      const st = s.rsvp[e.id];
      return {
        ...e,
        gradStyle: 'background-image:'+e.grad,
        hasFriends: false,
        friendsLabel: '',
        open: (ev)=>{ this.prevent(ev); this.setState({screen:'event', activeId:e.id}); if(typeof window!=='undefined') window.scrollTo(0,0); },
        going: ()=>this.toggleRsvp(e.id,'going'),
        interested: ()=>this.toggleRsvp(e.id,'interested'),
        share: (evn)=>{ this.prevent(evn); this.shareEvent(e.id); },
        goingCls: 'wsc__act'+(st==='going'?' is-going':''),
        interestedCls: 'wsc__act'+(st==='interested'?' is-interested':''),
        interestedGlyph: st==='interested'?'★':'☆',
      };
    };
    const events = (s.realEvents||[]).map(mapRealEvent).map(decorate);
    const ae = events.find(e=>e.id===s.activeId) || events[0] || {
      id:null, title:'', venue:'', venueCity:'', dateShort:'', dateLong:'', price:'See tickets', genre:'',
      grad:EVENT_GRADS[0], gradStyle:'background-image:'+EVENT_GRADS[0], friends:0, goingCount:'—', interestedCount:'—',
      presaleLive:false, presaleCode:'', onsale:'', lineup:[], lineupArtists:[], city:'',
    };

    const aeSt = s.rsvp[ae.id];
    const aeSaved = !!s.saved[ae.id];

    // Real artist/venue catalogs — derived from the currently-loaded real
    // events (event_artists join, already fetched — no new query/table)
    // instead of the design's invented ARTISTS_ALL/VENUES_ALL mock lists.
    // genre buckets reuse Drop.genreOf's real bucketing so it matches the
    // GENRES filter chips; there's no real follower/capacity count wired
    // this phase, so those fields are just left off rather than invented.
    // Artists from the FULL catalog (every artist with an upcoming show
    // anywhere — 700+), busiest first; the grid pages via artShown.
    const realArtists = (()=>{
      const seen = new Map();
      (this.CATALOG || s.realEvents || []).forEach(r=>(r.event_artists||[]).forEach(x=>{
        const a = x && x.artists; if (!a || !a.name) return;
        const e = seen.get(a.name);
        if (e) { e.shows++; return; }
        const genre = (a.genres && a.genres.length && Drop) ? Drop.genreOf({ event_artists:[{ artists:{ genres:a.genres } }] }) : '';
        seen.set(a.name, { name:a.name, genre, img: (Drop && Drop.isRealArtUrl(a.image_url) && Drop.safeUrl(a.image_url)) || '', upcoming:true, shows:1 });
      }));
      return [...seen.values()].sort((a,b)=> b.shows-a.shows || a.name.localeCompare(b.name));
    })();
    // Venues from the FULL catalog (not the city-scoped Discover window) so
    // Browse Venues covers every venue in the DB, with real state + counts.
    const realVenues = (()=>{
      const seen = new Map();
      (this.CATALOG || s.realEvents || []).forEach(r=>{
        if (!r.venue_name) return;
        const v = seen.get(r.venue_name) || { name:r.venue_name, city:r.city||'', state:r.state||'', count:0 };
        v.count++; seen.set(r.venue_name, v);
      });
      return [...seen.values()];
    })();

    // First-RSVP moment ("rm") — the first real loaded event, or none if
    // nothing has loaded yet (the template hides the event card via
    // rmHasEvent instead of showing a fabricated show).
    const rmEv = events[0] || null;
    const rmDisplayName = (s.profile && (s.profile.display_name || s.profile.username)) || (s.userEmail ? s.userEmail.split('@')[0] : 'there');

    const tabList = ['Happening','For You','Crew'].map(t=>({
      label:t, cls: s.dtab===t?'is-active':'', pick:()=>this.setState({dtab:t}),
    }));
    const chipDefs = [['all','All upcoming'],['today','Today'],['weekend','This weekend'],['30','Next 30 days']];
    const dateChips = chipDefs.map(([k,label])=>({ label, cls: s.dchip===k?'is-active':'', pick:()=>{ this.setState({dchip:k}); this.loadEvents(); } }));
    const dateChipLabel = ({all:'All upcoming',today:'Today',weekend:'This weekend','30':'Next 30 days'})[s.dchip];

    // City picker dropdown — filterable, scrollable catalog; picking a city
    // reloads the grid from Supabase for that city. Dot marks the active one.
    const cf = (s.cityFilter||'').trim().toLowerCase();
    // "All cities" heads the list; typing a state code or full state name
    // ("CO" / "Colorado") narrows to that state's cities.
    const cityList = [{ label:'All cities', state:'', count:(this.CATALOG||[]).length }, ...this.CITIES]
      .filter(c=>!cf || c.label.toLowerCase().includes(cf) || stateName(c.state).toLowerCase().includes(cf))
      .map(c=>({
        label: c.label,
        count: c.count + (c.count===1?' show':' shows'),
        dotStyle: c.label===s.city ? 'background:var(--accent);' : 'background:transparent;',
        pick:()=>{ this.setState({city:c.label, cityOpen:false, cityFilter:''}); this.loadEvents(); },
      }));
    const cityFilterEmpty = cityList.length===0;

    const menuRoute = {
      'Profile':'profile', 'My Shows':'myshows', 'Crew':'crew', 'Notifications':'notifications', 'Settings':'settings', 'Drop+':'wallet',
    };
    const menuItems = [
      ['Profile','var(--text)'],['My Shows','var(--text)'],['Crew','var(--text)'],
      ['Notifications','var(--text)'],['Drop+','var(--text)'],['Settings','var(--text)'],['Log out','var(--danger)'],
    ].map(([label,color])=>({ label, color, act:()=>{
      if(label==='Log out'){ this.setState({menuOpen:false}); this.logout(); this.go('home'); }
      else if(menuRoute[label]){ this.setState({menuOpen:false}); this.go(menuRoute[label]); }
      else { this.setState({menuOpen:false}); this.flash(label+' — coming soon'); }
    } }));

    const mobileMenu = [
      ['🔔','Notifications','var(--text)','notifications'],
      ['🎟️','My Shows','var(--text)','myshows'],
      ['👤','Profile','var(--text)','profile'],
      ['👥','Crew','var(--text)','crew'],
      ['✦','Drop+','var(--text)','wallet'],
      ['⚙','Settings','var(--text)','settings'],
      ['⎋','Log out','var(--danger)',null],
    ].map(([icon,label,color,route])=>({ icon, label, color, act:()=>{
      if(label==='Log out'){ this.setState({navOpen:false}); this.logout(); this.go('home'); }
      else { this.go(route); }
    } }));

    const waveBars = Array.from({length:44}).map((_,i)=>({
      style:'animation-delay:'+(-(i%11)*0.12)+'s;opacity:'+(0.45+0.55*Math.abs(Math.sin(i*0.7))),
    }));

    // Lineup chips carry the real artist id (from event_artists) when the
    // event came from a real fetch, so Artist-page follow can write through
    // to artist_follows; falls back to name-only when nothing is loaded yet.
    const lineupArtists = ae.lineupArtists || [];
    const lineup = lineupArtists.length
      ? lineupArtists.map((a,i)=>({ name:a.name, headStyle: i===0?'border-color:var(--accent);color:var(--accent);':'', open:()=>this.openArtist(a.name, a.id) }))
      : (ae.lineup||[]).map((name,i)=>({ name, headStyle: i===0?'border-color:var(--accent);color:var(--accent);':'', open:()=>this.openArtist(name, null) }));
    // One honest row: the event's real ticket link, labeled with the real
    // seller from its hostname. The old mock synthesized Ticketmaster/StubHub
    // rows off the one real price, so every "Get tickets" button opened the
    // same link under different vendor names — removed until the real
    // seller-comparison feed (separate project) is wired in.
    const priceRows = ae.ticketUrl ? [
      { seller:(Drop && Drop.sellerName(ae.ticketUrl)) || 'Tickets', price:ae.price, best:false, border:'var(--attended)' },
    ] : [];
    const aeSingleSeller = priceRows.length === 1;

    const lo = Math.min(s.priceMin, s.priceMax), hi = Math.max(s.priceMin, s.priceMax);
    // hi at the slider cap means "$200+" (unbounded above); lo 0 = free shows in
    const filterPrice = e => { const p = parseInt((e.price||'').replace(/\D/g,''),10); return isNaN(p) || (p >= lo && (hi >= 200 || p <= hi)); };
    const filterGenre = e => Object.keys(s.sGenres).filter(k=>s.sGenres[k]).length===0 || s.sGenres[e.genre];
    // Facet filters (price/genre-set/city/venue) come from the shared filter
    // panel and narrow BOTH the Discover grid and Search results.
    const facetPass = e => filterPrice(e) && filterGenre(e) && (!s.sCity || e.city===s.sCity) && (!s.sVenue || e.venue===s.sVenue);

    // ===== Genre filter (discover) =====
    const genreActive = !!s.genre;
    const discoverSource = (genreActive ? events.filter(e=>e.genre===s.genre) : events).filter(facetPass);
    // Tiles = every genre with a loaded show, busiest first. GENRES is only
    // the tint palette now; unknown genres get a stable hashed gradient.
    const genreCounts = {};
    events.forEach(e=>{ if (e.genre) genreCounts[e.genre] = (genreCounts[e.genre]||0)+1; });
    const genres = Object.keys(genreCounts).sort((a,b)=>genreCounts[b]-genreCounts[a]).map(name=>{
      const pal = this.GENRES.find(g=>g.name===name);
      const grad = pal ? pal.grad : 'background:'+gradFor('genre:'+name)+';';
      return {
        name,
        gradStyle: grad,
        tileStyle: grad + (s.genre===name ? 'box-shadow:0 0 0 2px var(--accent);' : ''),
        pick: (e)=>{ this.prevent(e); this.setState(st=>({ genre: st.genre===name ? null : name, discPage: 0 })); },
      };
    });
    const gridLabel = genreActive ? (s.genre+' shows') : dateChipLabel;
    const gridEmpty = discoverSource.length===0;

    // Discover pagination (design: 24/page client pager over the loaded set)
    const PAGE = 24;
    const discTotalPages = Math.max(1, Math.ceil(discoverSource.length/PAGE));
    const discPage = Math.min(s.discPage, discTotalPages-1);
    const discoverEvents = discoverSource.slice(discPage*PAGE, (discPage+1)*PAGE);
    const discShowPager = discTotalPages>1;
    const discPageLabel = 'Page '+(discPage+1)+' of '+discTotalPages;
    const discPrevDisabled = discPage<=0;
    const discNextDisabled = discPage>=discTotalPages-1;

    // ===== Search =====
    const q = s.query.trim().toLowerCase();
    const searchEmpty = q.length===0;
    // No query and no facet = the full Discover set (his rule). A query OR
    // any facet searches the WHOLE catalog (every city/state), so "Miami",
    // "Texas" or the Austin city facet work from any city.
    const facetActive = !!(s.sCity || s.sVenue || s.priceMin>0 || s.priceMax<200 || Object.keys(s.sGenres).some(k=>s.sGenres[k]));
    this._catMapped = this.CATALOG ? (this._catMapped || this.CATALOG.map(mapRealEvent)) : null;
    const searchPool = ((searchEmpty && !facetActive) || !this._catMapped) ? events : this._catMapped.map(decorate);
    const matched = searchPool.filter(e =>
      (searchEmpty || e.title.toLowerCase().includes(q) || e.venueCity.toLowerCase().includes(q) || e.genre.toLowerCase().includes(q) || (e.state||'').toLowerCase()===q || stateName(e.state).toLowerCase().includes(q) || e.lineup.join(' ').toLowerCase().includes(q))
      && facetPass(e));
    const searchResults = matched;
    const searchHasResults = matched.length>0;
    const searchNoResults = matched.length===0;
    const resultsLabel = searchEmpty
      ? matched.length + ' show' + (matched.length===1?'':'s')
      : matched.length + ' result' + (matched.length===1?'':'s') + ' for "' + s.query + '"';
    const searchGeoActive = s.searchGeo==='active';
    const searchGeoPending = s.searchGeo==='pending';
    const searchGeoIdle = s.searchGeo==='idle';
    const searchLocPillLabel = 'Near me · ' + s.distance + ' mi';
    const searchGeoBtnLabel = searchGeoPending ? 'Locating…' : 'Use my location';
    // ===== Search filter dropdowns (design round 4) =====
    // Distance dropdown — cosmetic radius (same as the old chips; real geo
    // narrowing isn't wired server-side yet).
    const distOptions = ['5','10','25','50'].map(d=>({
      label:'Within '+d+' mi', selected: s.distance===d,
      checkGlyph: s.distance===d?'✓':'',
      checkStyle: s.distance===d ? 'background:var(--grad-glow-fill);color:var(--ink);border-color:transparent;' : 'background:var(--glass);color:transparent;',
      pick:()=>this.setState({distance:d, sDistOpen:false}),
    }));
    const distLabel = 'Within '+s.distance+' mi';
    // Genre / city / venue facets — built from the loaded events (client-side
    // filters over what Discover fetched for the current city).
    // Facet OPTION lists always cover the whole catalog (so any city/venue/
    // genre is pickable from anywhere); the facet FILTERS then narrow the pool.
    const facetSrc = this._catMapped || searchPool;
    const sGenreCounts = {};
    facetSrc.forEach(e=>{ if(e.genre) sGenreCounts[e.genre]=(sGenreCounts[e.genre]||0)+1; });
    const sgf = (s.searchGenreFilter||'').trim().toLowerCase();
    const searchGenreList = this.GENRES
      .filter(g=>!sgf || g.name.toLowerCase().includes(sgf))
      .map(g=>{ const on=!!s.sGenres[g.name]; const n=sGenreCounts[g.name]||0; return {
        name:g.name, count:n+(n===1?' show':' shows'),
        checkGlyph: on?'✓':'', checkStyle: on?'background:var(--grad-glow-fill);color:var(--ink);border-color:transparent;':'background:var(--glass);color:transparent;',
        pick:()=>this.setState(st=>({ sGenres:{...st.sGenres, [g.name]: !st.sGenres[g.name]} })),
      }; });
    const searchGenreEmpty = searchGenreList.length===0;
    const sGenSel = Object.keys(s.sGenres).filter(k=>s.sGenres[k]);
    const searchGenreLabel = sGenSel.length===0 ? 'All genres' : sGenSel.length===1 ? sGenSel[0] : (sGenSel[0]+' +'+(sGenSel.length-1));
    const sCityCounts = {};
    facetSrc.forEach(e=>{ if(e.city) sCityCounts[e.city]=(sCityCounts[e.city]||0)+1; });
    const sCityCat = Object.keys(sCityCounts).map(c=>({name:c,n:sCityCounts[c]})).sort((a,b)=> b.n-a.n || a.name.localeCompare(b.name));
    const scf = (s.sCityFilter||'').trim().toLowerCase();
    const searchCityList = sCityCat.filter(c=>!scf || c.name.toLowerCase().includes(scf)).map(c=>({
      label:c.name, count:c.n+(c.n===1?' show':' shows'),
      pick:()=>this.setState({sCity:c.name, sCityOpen:false, sCityFilter:''}),
    }));
    const searchCityEmptyList = searchCityList.length===0;
    const searchCityLabel = s.sCity || 'All cities';
    const sVenueCounts = {};
    facetSrc.forEach(e=>{ if(e.venue) sVenueCounts[e.venue]=(sVenueCounts[e.venue]||0)+1; });
    const sVenueCat = Object.keys(sVenueCounts).map(v=>({name:v,n:sVenueCounts[v]})).sort((a,b)=> b.n-a.n || a.name.localeCompare(b.name));
    const svf = (s.sVenueFilter||'').trim().toLowerCase();
    const searchVenueList = sVenueCat.filter(v=>!svf || v.name.toLowerCase().includes(svf)).map(v=>({
      name:v.name, count:v.n+(v.n===1?' show':' shows'),
      pick:()=>this.setState({sVenue:v.name, sVenueOpen:false, sVenueFilter:''}),
    }));
    const searchVenueEmptyList = searchVenueList.length===0;
    const searchVenueLabel = s.sVenue || 'All venues';
    const trending = ['Melodic','House','Dubstep','Techno','Bass','Trance'];
    const trendingChips = trending.map(t=>({ label:t, pick:()=>this.setState({query:t}) }));
    // ponytail: no search-history table this phase — stays empty (the
    // "Recent searches" row hides itself via hasRecentSearches).
    const recent = [];
    const recentSearches = recent.map(r=>({ label:r, pick:()=>this.setState({query:r}) }));
    const typeaheadGroups = searchEmpty ? [] : [
      { label:'Events', items: matched.slice(0,3).map(e=>({ icon:'♪', label:e.title, pick:()=>{ this.setState({screen:'event', activeId:e.id, query:''}); if(typeof window!=='undefined') window.scrollTo(0,0); } })) },
      { label:'Genres', items: this.GENRES.filter(g=>g.name.toLowerCase().includes(q)).map(g=>({ icon:'◆', label:g.name+' shows', pick:()=>this.setState({query:g.name}) })) },
      { label:'Artists', items: realArtists.filter(a=>a.name.toLowerCase().includes(q)).slice(0,3).map(a=>({ icon:'♪', label:a.name, pick:()=>{ this.setState({query:''}); this.openArtist(a.name, null); } })) },
    ].filter(grp=>grp.items.length>0);
    const typeaheadOpen = !searchEmpty && typeaheadGroups.length>0;

    // ===== Festival — real event_set_times rows only =====
    const festival = s.festivalEvent;
    const festSetTimes = s.festivalSetTimes || [];
    const festivalTimeZone = (festival && festival.timezone) || (festSetTimes.find(se=>se.timezone) || {}).timezone || '';
    const festTabs = ['All','My schedule'].map(t=>({
      label:t,
      cls:s.festTab===t?'is-active':'',
      selected:s.festTab===t?'true':'false',
      pick:()=>{
        if (t === 'My schedule' && !this.state.authed) { this.openGate('Log in to build your schedule'); return; }
        this.setState({festTab:t});
      },
    }));
    const starredSets = festSetTimes.filter(se=>s.stars[se.id]);
    const clashNames = new Map();
    const clashPairs = [];
    for (let i=0; i<starredSets.length; i++) {
      for (let j=i+1; j<starredSets.length; j++) {
        if (!setsOverlap(starredSets[i], starredSets[j])) continue;
        const a=starredSets[i], b=starredSets[j];
        clashPairs.push([a,b]);
        clashNames.set(a.id, [...(clashNames.get(a.id)||[]), b.artist_name]);
        clashNames.set(b.id, [...(clashNames.get(b.id)||[]), a.artist_name]);
      }
    }
    const festClashBanner = clashPairs.length
      ? clashPairs[0][0].artist_name+' and '+clashPairs[0][1].artist_name+' overlap in your schedule'+(clashPairs.length>1?' (+'+(clashPairs.length-1)+' more clash'+(clashPairs.length>2?'es':'')+')':'')+'.'
      : null;
    const stageColors = ['var(--going)','var(--interested)','var(--attended)','var(--gold)','var(--accent)'];
    const groupedStages = new Map();
    festSetTimes
      .filter(se=>s.festTab==='All' || !!s.stars[se.id])
      .forEach(se=>{
        const stage = se.stage || 'Stage TBA';
        const zone = se.timezone || festivalTimeZone || undefined;
        const dayKey = zonedDayKey(se.start_time, zone);
        const groupKey = dayKey + '|' + stage;
        if (!groupedStages.has(groupKey)) groupedStages.set(groupKey, { stage, dayKey, dayLabel:zonedDayLabel(se.start_time, zone), sets:[] });
        groupedStages.get(groupKey).sets.push(se);
      });
    const stages = [...groupedStages.values()]
      .sort((a,b)=>a.dayKey.localeCompare(b.dayKey) || a.stage.localeCompare(b.stage))
      .map((group, stageIndex)=>({
      name:group.stage,
      dayLabel:group.dayLabel,
      accent:'background:'+stageColors[stageIndex%stageColors.length]+';',
      sets:group.sets.map(se=>{
        const on=!!s.stars[se.id];
        const clashes=clashNames.get(se.id)||[];
        const zone=se.timezone||festivalTimeZone||undefined;
        return {
          time:zonedTime(se.start_time, zone)+(se.end_time?' – '+zonedTime(se.end_time, zone):''),
          artist:se.artist_name,
          border:clashes.length?'var(--danger)':(on?'var(--gold)':'var(--border)'),
          clash:clashes.length>0,
          clashMsg:clashes.length?'Clashes with '+clashes.join(', '):'',
          hasFriends:false,
          friendsLabel:'',
          starGlyph:on?'★':'☆',
          starLabel:(on?'Remove ':'Add ')+se.artist_name+(on?' from':' to')+' my schedule',
          starPressed:on?'true':'false',
          starBg:on?'rgba(255,203,61,0.15)':'var(--glass)',
          starBorder:on?'var(--gold)':'var(--glass-border)',
          starColor:on?'var(--gold)':'var(--text-muted)',
          star:()=>this.toggleFestivalSet(se.id),
        };
      }),
    }));
    const festivalLocation = festival ? [festival.city, festival.state].filter(Boolean).join(', ') : '';
    const festivalStageCount = new Set(festSetTimes.map(se=>se.stage||'Stage TBA')).size;
    const festivalKicker = festival
      ? [festivalDateLabel(festival.date, festival.endDate, festivalTimeZone||undefined), festivalLocation].filter(Boolean).join(' · ')
      : '';
    const festivalVenueMeta = festival
      ? [festival.venue, festivalStageCount+(festivalStageCount===1?' stage':' stages'), festSetTimes.length+(festSetTimes.length===1?' set':' sets')].filter(Boolean).join(' · ')
      : '';
    const festivalHasSchedule = !s.festivalLoading && !s.festivalError && festSetTimes.length>0;
    const festivalEmpty = !s.festivalLoading && !s.festivalError && !!festival && festSetTimes.length===0;
    const festivalTabEmpty = festivalHasSchedule && stages.length===0;

    // ===== Activation wizard =====
    const wizSteps = [
      { title:'Add a profile photo', sub:'Help your crew recognize you.' },
      { title:'Where do you go out?', sub:'We\u2019ll show shows near you first.' },
      { title:'What are your vibes?', sub:'Pick genres so your feed fits your taste.' },
      { title:'Add your friends', sub:'See which shows they\u2019re going to.' },
      { title:'Follow artists', sub:'Get alerts when they announce near you.' },
    ];
    const wizStepNum = s.wizStep+1;
    const wizCur = wizSteps[s.wizStep] || wizSteps[0];
    const wizDots = wizSteps.map((_,i)=>({ style: 'width:'+(i===s.wizStep?'28px':'6px')+';background:'+(i<=s.wizStep?'var(--accent)':'var(--border-strong)')+';' }));
    const wizGenreChips = this.GENRES.map(g=>({ label:g.name, cls: s.wizGenres[g.name]?'is-active':'', toggle:()=>this.setState(x=>({ wizGenres:{...x.wizGenres, [g.name]: !x.wizGenres[g.name]} })) }));
    const wizFriends = this.WIZ_FRIENDS.map(f=>{ const on=!!s.wizFriendSel[f.id]; return { name:f.name, sub:f.sub, cls: on?'wsc__act is-going':'wsc__act', label: on?'Added':'Add', toggle:()=>this.setState(x=>({ wizFriendSel:{...x.wizFriendSel, [f.id]: !x.wizFriendSel[f.id]} })) }; });
    // Real artist names (from realArtists, derived above) instead of the
    // design's fixed WIZ_ARTISTS mock list — same pool as Pick Artists.
    const wizArtistPool = realArtists.map(a=>a.name);
    const wizArtists = wizArtistPool.map(a=>{ const on=!!s.wizArtistSel[a]; return { name:a, border: on?'var(--accent)':'var(--border)', color: on?'var(--accent)':'var(--text-muted)', label: on?'Following':'Follow', toggle:()=>this.setState(x=>({ wizArtistSel:{...x.wizArtistSel, [a]: !x.wizArtistSel[a]} })) }; });
    const wizNextLabel = s.wizStep>=4 ? 'Finish — go to Discover' : 'Continue';
    // manual artist typeahead (vibes step)
    const artQ = s.wizArtQuery.trim().toLowerCase();
    const wizArtMatches = artQ.length>0 ? wizArtistPool
      .filter(a=>a.toLowerCase().includes(artQ) && !s.wizArtistSel[a])
      .slice(0,5)
      .map(a=>({ name:a, add:()=>this.setState(x=>({ wizArtistSel:{...x.wizArtistSel, [a]:true}, wizArtQuery:'' })) })) : [];
    const wizArtOpen = artQ.length>0 && wizArtMatches.length>0;
    const wizArtChosen = wizArtistPool.filter(a=>s.wizArtistSel[a]).map(a=>({ name:a, remove:()=>this.setState(x=>{ const sel={...x.wizArtistSel}; delete sel[a]; return {wizArtistSel:sel}; }) }));

    // ===== Profile — real profiles-table fields where a session exists;
    // Shows/Artists stats are real counts (attendance/artist_follows).
    // Friends stays a placeholder — no real friend system wired this phase. =====
    const profileSrc = s.profile;
    const prof = {
      name: (profileSrc && (profileSrc.display_name || profileSrc.username)) || s.userEmail || 'Drop user',
      handleCity: [
        profileSrc && profileSrc.username ? '@'+profileSrc.username : null,
        profileSrc && profileSrc.city ? profileSrc.city + (profileSrc.state ? ', '+profileSrc.state : '') : null,
      ].filter(Boolean).join(' · ') || s.userEmail || '',
      bio: (profileSrc && profileSrc.bio) || 'Add a bio so your crew knows your vibe.',
      username: (profileSrc && profileSrc.username) || '',
      cityState: profileSrc && profileSrc.city ? profileSrc.city + (profileSrc.state ? ', '+profileSrc.state : '') : '',
    };
    // ponytail: no friends table this phase — drop the "Friends" stat tile
    // entirely instead of showing an invented count.
    const profileStats = [
      { value: s.realShowsCount!=null ? String(s.realShowsCount) : '—', label:'Shows', color:'' },
      { value: s.realArtistsCount!=null ? String(s.realArtistsCount) : '—', label:'Artists', color:'color:var(--interested);' },
    ];
    const profileMenu = [
      { icon:'🎟️', label:'My Shows', act:()=>this.go('myshows') },
      { icon:'📸', label:'Memories', act:()=>this.go('memories') },
      { icon:'🕘', label:'Shows you\u2019ve seen', act:()=>this.go('seen') },
      { icon:'🏷️', label:'Tagged in shows', act:()=>this.go('tagged') },
      { icon:'✦', label:'Drop+ wallet', act:()=>this.go('wallet') },
      { icon:'🎁', label:'Drop Wrapped', act:()=>this.go('wrapped') },
      { icon:'♪', label:'Follow artists', act:()=>this.go('artists') },
      { icon:'🎚️', label:'Music taste', act:()=>this.go('taste') },
      { icon:'📣', label:'Suggest an event', act:()=>this.go('suggest') },
      { icon:'🎛️', label:'Promoter tools', act:()=>{ if(!this.state.isPromoter && !this.state.authed){} this.go('promoter'); } },
      { icon:'🔔', label:'Notifications', act:()=>this.go('notifications') },
      { icon:'✎', label:'Edit profile', act:()=>this.go('editprofile') },
      { icon:'⚙', label:'Settings', act:()=>this.go('settings') },
    ];

    // ===== Notifications =====
    const notifications = s.notifCleared ? [] : this.NOTIFS.map(n=>{ const unread=!s.notifRead[n.id]; return { ...n, unread, bg: unread?'var(--surface-hi)':'var(--surface)', act:()=>{ this.setState(x=>({ notifRead:{...x.notifRead, [n.id]:true} })); } }; });

    // ===== Settings =====
    const settingsToggles = [
      { key:'reminders', label:'Show reminders & on-sale alerts' },
      { key:'sales', label:'Presale codes & price drops' },
      { key:'comments', label:'Comment replies & mentions' },
      { key:'plans', label:'Crew plans & messages' },
    ].map(t=>({ label:t.label, on: !!s.setToggles[t.key], toggle:()=>this.setState(x=>({ setToggles:{...x.setToggles, [t.key]: !x.setToggles[t.key]} })) }));
    const blocked = this.BLOCKED.filter(b=>!this._unblocked || !this._unblocked[b.id]).map(b=>({ ...b, unblock:()=>{ this._unblocked=this._unblocked||{}; this._unblocked[b.id]=true; this.flash('Unblocked '+b.name); this.forceUpdate(); } }));
    const deleteOk = s.deleteConfirm.trim().toUpperCase()==='DELETE';

    // ===== Artist page =====
    const artName = s.activeArtist;
    // PHASE 1 real row (loadArtistDetail): genre, verified badge, merch/
    // website links and claim ownership all come from the artists table.
    // No bio/hometown/monthly-listeners/rating columns exist this phase —
    // the ARTIST_META mock dict of invented per-artist bios is gone; every
    // artist gets the same honest generic line instead of a fabricated one.
    const artRow = s.activeArtistRow;
    const artRowGenres = (artRow && artRow.genres) || [];
    const artGenre = (artRowGenres.length && Drop) ? Drop.genreOf({ event_artists:[{ artists:{ genres:artRowGenres } }] }) : '';
    const artBio = artName ? (artName+' — follow to get an alert the moment they announce a show near you.') : '';
    const artOwned = !!(artRow && s.userId && artRow.claimed_by === s.userId);
    const artMerchUrl = (artRow && Drop && Drop.safeUrl(artRow.merch_url)) || '';
    const artWebsiteUrl = (artRow && Drop && Drop.safeUrl(artRow.website_url)) || '';
    const artImageUrl = (artRow && Drop && Drop.isRealArtUrl(artRow.image_url) && Drop.safeUrl(artRow.image_url)) || '';
    const artGrad = this.ARTIST_GRADS[(artName.length) % this.ARTIST_GRADS.length];
    const artShows = events.filter(e=>e.lineup.some(n=>n===artName));
    const artFollowing = !!s.following[artName];
    // "Fans also follow" — other real artists currently loaded, not a
    // fixed fictional list.
    const artSimilar = realArtists.filter(a=>a.name!==artName).slice(0,5).map(a=>({ name:a.name, open:()=>this.openArtist(a.name, null) }));
    // No ratings/reviews table for artists this phase — empty + honest state.
    const artReviews = [];

    // ===== Venue page =====
    const venName = s.activeVenue;
    // No venues table (capacity/rating/reviews/about) this phase — location
    // comes from the real event city the user arrived from (s.venueCity);
    // everything else is just left off rather than invented.
    const venMeta = { location: s.venueCity || '', grad: gradFor(venName || 'venue') };
    const venShows = events.filter(e=>e.venue===venName);
    const venFollowing = !!s.followingVenue[venName];

    // ===== My Shows — real, from a dedicated attendance⋈events join
    // (s.myShowsRows, loaded by loadMyShows()) rather than derived from
    // Discover's city/date-filtered fetch, so a show outside the current
    // Discover window still shows up here. =====
    const myNow = Date.now();
    const myRows = (s.myShowsRows||[]).map(r=>({ row:r, ev: r.events||{} }));
    const myUpcoming = myRows
      .filter(x=>(x.row.status==='going'||x.row.status==='interested') && (!x.ev.date || new Date(x.ev.date).getTime()>=myNow))
      .map(x=>{
        const ev = x.ev;
        return {
          id: ev.id, title: ev.title || 'Untitled show',
          venueCity: [ev.venue_name, ev.city].filter(Boolean).join(' · '),
          dateShort: ((Drop && Drop.fmtDate(ev.date, ev.time_tbd)) || 'Date TBD').toUpperCase(),
          genre: Drop ? Drop.genreOf(ev) : '',
          gradStyle: 'background-image:'+gradFor(ev.id||x.row.status),
          statusLabel: x.row.status==='going' ? '✓ Going' : '☆ Interested',
          statusStyle: x.row.status==='going' ? 'background:var(--going);color:var(--white);' : 'background:var(--interested);color:var(--ink);',
          open: (evn)=>{ this.prevent(evn); this.setState({screen:'event', activeId: ev.id}); if(typeof window!=='undefined') window.scrollTo(0,0); },
          ics: (evn)=>{ this.prevent(evn); this.flash('Added to calendar (.ics)'); },
          share: (evn)=>{ this.prevent(evn); this.shareEvent(ev.id); },
        };
      });
    // ponytail: "Saved" has no backing table — local-only bookmark, so it
    // can only surface events from the currently-loaded Discover batch.
    const mySaved = events.filter(e=>s.saved[e.id]).map(e=>({
      ...e,
      unsave: (evn)=>{ this.prevent(evn); this.toggleSave(e.id); },
      share: (evn)=>{ this.prevent(evn); this.shareEvent(e.id); },
    }));
    const myPast = myRows
      .filter(x=>x.row.status==='attended' || (x.ev.date && new Date(x.ev.date).getTime()<myNow))
      .map(x=>{
        const ev = x.ev;
        const r = s.ratings[ev.id] || 0;
        return {
          id: ev.id, title: ev.title || 'Untitled show',
          venueCity: [ev.venue_name, ev.city].filter(Boolean).join(' · '),
          dateShort: ((Drop && Drop.fmtDate(ev.date, ev.time_tbd)) || 'Date TBD').toUpperCase(),
          gradStyle: 'background-image:'+gradFor(ev.id||'past'),
          // ponytail: no show_ratings table wired this phase — ratings stay
          // local/session-only (matches the original mock behavior).
          rateLabel: r>0 ? 'You rated '+r+'★' : 'Rate this show',
          stars: [1,2,3,4,5].map(n=>({ glyph: n<=r?'★':'☆', color: n<=r?'var(--gold)':'var(--text-muted)', set:()=>{ if(!this.state.authed){ this.openGate('Log in to rate shows'); return; } this.setState(x2=>({ ratings:{...x2.ratings, [ev.id]: x2.ratings[ev.id]===n?0:n} })); this.flash('Rated '+n+'★'); } })),
        };
      });
    const myTabs = ['Upcoming','Saved','Past'].map(t=>({ label:t, cls: s.myTab===t?'is-active':'', pick:()=>this.setState({myTab:t}) }));

    // ===== Pick Artists — real artists (realArtists, derived above) =====
    // Genre chips derived from the artists actually present (same honest-
    // derivation rule as Discover's genre rail), not the static palette.
    const artGenreCounts = {};
    realArtists.forEach(a=>{ if(a.genre) artGenreCounts[a.genre]=(artGenreCounts[a.genre]||0)+1; });
    const artGenreNames = ['All', ...Object.keys(artGenreCounts).sort((a,b)=>artGenreCounts[b]-artGenreCounts[a])];
    const artGenreChips = artGenreNames.map(g=>({ label:g, cls: s.artGenre===g?'is-active':'', pick:()=>this.setState({artGenre:g, artShown:48}) }));
    const artFiltered = s.artGenre==='All' ? realArtists : realArtists.filter(a=>a.genre===s.artGenre);
    const artistGrid = artFiltered.slice(0, s.artShown).map(a=>{
      const on = !!s.followArt[a.name];
      const aUrl = a.img && cssUrl(a.img);
      return { name:a.name, genre:a.genre, upcoming:a.upcoming,
        artStyle: aUrl ? 'background-image:'+aUrl+';background-size:cover;background-position:center;' : 'background:var(--grad-brand);',
        open:()=>this.openArtist(a.name, null),
        label: on?'✓ Following':'＋ Follow', cls: on?'wsc__act is-going':'wsc__act',
        toggle:()=>{ if(!this.state.authed){ this.openGate('Log in to follow artists'); return; } this.setState(x=>({ followArt:{...x.followArt, [a.name]: !x.followArt[a.name]} })); } };
    });
    const artistGridEmpty = artistGrid.length===0;
    const artBulkShow = s.artGenre!=='All';
    const artAllFollowed = artFiltered.length>0 && artFiltered.every(a=>s.followArt[a.name]);
    const artBulkLabel = (artAllFollowed?'Unfollow all ':'Follow all ')+s.artGenre;
    const artMoreShow = artFiltered.length > s.artShown;
    const artMoreLabel = 'Show more ('+(artFiltered.length - s.artShown)+' left)';

    // ===== Browse Venues — full-catalog venues grouped by STATE (design
    // format): sticky state header, card = name + "city · N upcoming shows".
    // Search matches venue, city, state code and full state name.
    const vq = s.venueQuery.trim().toLowerCase();
    const venMatched = realVenues.filter(v=> !vq || v.name.toLowerCase().includes(vq) || v.city.toLowerCase().includes(vq) || (v.state||'').toLowerCase()===vq || stateName(v.state).toLowerCase().includes(vq));
    const stateOrder = [...new Set(venMatched.map(v=>v.state||''))].sort((a,b)=> (stateName(a)||'ZZ').localeCompare(stateName(b)||'ZZ'));
    const venueGroups = stateOrder.map(st=>{
      const vs = venMatched.filter(v=>(v.state||'')===st).sort((a,b)=> b.count-a.count || a.name.localeCompare(b.name));
      return { state: stateName(st) || 'Other', count: vs.length+' venue'+(vs.length===1?'':'s'), venues: vs.map(v=>({
        name:v.name, city: v.city + ' · ' + v.count + ' upcoming show' + (v.count===1?'':'s'),
        open:()=>{ this.setState({screen:'venue', activeVenue:v.name, venueCity:v.city}); if(typeof window!=='undefined') window.scrollTo(0,0); },
      })) };
    });

    // ===== Crew =====
    const crewTabs = ['Friends','Requests','Find','Plans'].map(t=>({ label:t, cls: s.crewTab===t?'is-active':'', pick:()=>this.setState({crewTab:t}) }));
    const overlapChip = arr => arr.slice(0,3).map(n=>({ label:n }));
    const overlapText = arr => arr.length+' shared artist'+(arr.length===1?'':'s');
    const friendsList = this.FRIENDS.map(f=>({ name:f.name, handle:f.handle, ring:f.ring, chips:overlapChip(f.overlap), overlapLabel:overlapText(f.overlap), overlapColor: f.overlap.length>=4?'var(--attended)':'var(--accent)' }));
    const requestsList = this.REQUESTS.filter(r=>!s.reqActioned[r.id]).map(r=>({ name:r.name, handle:r.handle, overlapLabel:overlapText(r.overlap),
      accept:()=>{ this.setState(x=>({ reqActioned:{...x.reqActioned, [r.id]:'a'} })); this.flash(r.name+' added to your crew'); },
      decline:()=>{ this.setState(x=>({ reqActioned:{...x.reqActioned, [r.id]:'d'} })); this.flash('Request declined'); } }));
    const findList = this.FIND_PEOPLE.map(p=>{ const on=!!s.addedPeople[p.id]; return { name:p.name, handle:p.handle, mutuals:p.mutuals, chips:overlapChip(p.overlap),
      label: on?'Requested':'＋ Add', cls: on?'wsc__act is-going':'wsc__act', add:()=>{ this.setState(x=>({ addedPeople:{...x.addedPeople, [p.id]:true} })); this.flash('Request sent to '+p.name); } }; });
    // No plans table this phase — PLANS is always empty, so this stays [].
    const plansList = this.PLANS.map(pl=>{ const e=events.find(x=>x.id===pl.eventId) || {}; const going=pl.roster.filter(m=>m.status==='going').length;
      return { title:e.title, dateShort:e.dateShort, venueCity:e.venueCity, gradStyle:'background-image:'+e.grad,
        avatars: pl.roster.slice(0,3).map(m=>({ ring:m.ring })), goingLabel: going+' going',
        open:()=>{ this.setState({screen:'plan', activePlan:pl.id}); if(typeof window!=='undefined') window.scrollTo(0,0); } }; });

    // ===== Plan detail — guarded: PLANS is empty this phase, so `plan` is
    // always null and this screen is unreached from the (also-empty) Plans
    // tab; the fallback keeps render() crash-free if it's ever hit anyway. =====
    const plan = this.PLANS.find(p=>p.id===s.activePlan) || this.PLANS[0] || null;
    const planEv = plan ? (events.find(e=>e.id===plan.eventId) || null) : null;
    const pdSpot = plan ? s.planSpot[plan.id] : undefined;
    const pd = (plan && planEv) ? {
      title:planEv.title, dateShort:planEv.dateShort, venueCity:planEv.venueCity, gradStyle:'background-image:'+planEv.grad,
      roster: plan.roster,
      spotOptions: plan.spots.map((sp,i)=>{ const on = pdSpot===undefined ? i===0 : pdSpot===i; return { label:sp,
        bg: on?'rgba(77,226,255,0.1)':'var(--surface)', border: on?'var(--accent)':'var(--border)', dot: on?'var(--accent)':'var(--border-strong)', glyph: on?'●':'',
        pick:()=>this.setState(x=>({ planSpot:{...x.planSpot, [plan.id]:i} })) }; }),
      chat: plan.chat.map(c=>({ who:c.who, time:c.time, text:c.text, color: c.me?'var(--accent)':c.color,
        align: c.me?'flex-direction:row-reverse;':'', metaAlign: c.me?'text-align:right;':'', showAvatar: !c.me,
        bubbleBg: c.me?'rgba(77,226,255,0.14)':'var(--surface)' })),
    } : { title:'', dateShort:'', venueCity:'', gradStyle:'background-image:'+EVENT_GRADS[0], roster:[], spotOptions:[], chat:[] };

    // ===== Crew builder interstitial — reuses the real active event (ae),
    // not the deleted EVENTS mock. cbFriends has no backend this phase. =====
    const cbEv = ae;
    const cbFriends = [];

    // ===== Invite =====
    // ponytail: no referral backend — start from 0, not a fake "2 already
    // joined" baseline.
    const inviteBase = 0;
    const inviteExtra = Object.keys(s.invited).filter(k=>s.invited[k]).length;
    const inviteCount = Math.min(5, inviteBase + inviteExtra);
    const inviteRemain = 5 - inviteCount;
    const inviteMilestones = [1,2,3,4,5].map(n=>({ glyph: n<=inviteCount?'✓':n, bg: n<=inviteCount?'var(--attended)':'var(--surface-hi)', color: n<=inviteCount?'var(--ink)':'var(--text-muted)' }));
    const inviteList = this.FIND_PEOPLE.map(p=>{ const on=!!s.invited[p.id]; return { name:p.name, handle:p.handle, label: on?'Invited':'Invite', cls: on?'wsc__act is-going':'wsc__act',
      invite:()=>{ this.setState(x=>({ invited:{...x.invited, [p.id]:true} })); this.flash('Invite sent to '+p.name); } }; });

    // ===== Wrapped — real data, two modes (This year / All time) =====
    // Built off myRows (attendance ⋈ events, defined above in My Shows) —
    // same "is this show in the past" test as My Shows > Past, since Wrapped
    // only counts shows that already happened.
    const wrappedYear = s.wrappedRange==='This year';
    const wrappedCurYear = new Date().getFullYear();
    // Manually-logged shows (logged_shows) mapped into the same event shape so
    // artist_name → top artists and show_date → months/years/first-show fold
    // straight into the tallies below. ponytail: no genre on a free-text log,
    // so genreOf() buckets them as "Live music" — a small skew, not fake data.
    const loggedAsRows = (s.loggedShows||[]).map(ls=>({
      date: ls.show_date, venue_name: ls.venue_name||'', city: ls.city||'',
      title: ls.artist_name||'Show', time_tbd:false,
      event_artists: ls.artist_name ? [{ artists:{ name: ls.artist_name } }] : [],
    })).filter(ev=>ev.date);
    const wrappedPastRows = myRows
      .filter(x=>x.row.status==='attended' || (x.ev.date && new Date(x.ev.date).getTime()<myNow))
      .map(x=>x.ev)
      .filter(ev=>ev.date) // undated shows can't be placed on a timeline
      .concat(loggedAsRows);
    const wrappedRows = wrappedYear ? wrappedPastRows.filter(ev=>new Date(ev.date).getFullYear()===wrappedCurYear) : wrappedPastRows;
    const wrappedEmpty = wrappedPastRows.length===0;
    const tally = (list)=>{ const counts=new Map(); list.forEach(v=>{ if(v) counts.set(v,(counts.get(v)||0)+1); }); return [...counts.entries()].sort((a,b)=>b[1]-a[1]); };
    const wrArtistNames = ev=>(ev.event_artists||[]).map(x=>x.artists&&x.artists.name).filter(Boolean);
    const wrArtistCounts = tally(wrappedRows.flatMap(wrArtistNames));
    const wrVenueCounts = tally(wrappedRows.map(ev=>ev.venue_name));
    const wrGenreCounts = tally(wrappedRows.map(ev=>Drop && Drop.genreOf(ev)));
    const wrRankColors = ['color:var(--accent);','color:var(--interested);','color:var(--text-muted);'];
    const wrappedTopArtists = wrArtistCounts.slice(0,3).map(([name,n],i)=>({ rank:(i+1)+'', name, meta:n+' show'+(n===1?'':'s'), rankColor:wrRankColors[i]||'' }));
    const wrappedTopVenues = wrVenueCounts.slice(0,3).map(([name,n],i)=>({ rank:(i+1)+'', name, meta:n+' show'+(n===1?'':'s'), rankColor:wrRankColors[i]||'' }));
    const wrGenreMax = wrGenreCounts.length ? wrGenreCounts[0][1] : 1;
    const wrappedTopGenres = wrGenreCounts.slice(0,3).map(([name,n])=>({ name, pct:Math.round(n*100/wrappedRows.length)+'%', barStyle:'width:'+Math.round(n*100/wrGenreMax)+'%;' }));

    // month-by-month strip — year mode only
    const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthCounts = MONTH_LABELS.map(()=>0);
    wrappedRows.forEach(ev=>{ monthCounts[new Date(ev.date).getMonth()]++; });
    const monthMax = Math.max(1, ...monthCounts);
    let busiestIdx = 0; monthCounts.forEach((c,i)=>{ if(c>monthCounts[busiestIdx]) busiestIdx=i; });
    const wrappedMonths = MONTH_LABELS.map((label,i)=>({ label, barStyle:'height:'+Math.round(monthCounts[i]/monthMax*100)+'%;background:'+(i===busiestIdx&&monthCounts[i]>0?'var(--grad-glow-fill)':'var(--surface-hi)')+';' }));

    // first-ever show + years active — all-time mode only
    const wrSortedAll = [...wrappedPastRows].sort((a,b)=>new Date(a.date)-new Date(b.date));
    const wrFirst = wrSortedAll[0];
    const wrFirstYear = wrFirst ? new Date(wrFirst.date).getFullYear() : wrappedCurYear;
    const wrYearsActive = Math.max(1, wrappedCurYear - wrFirstYear + 1);

    // ponytail: no per-show duration is tracked — "hours on the floor" is a
    // flat 3.5h/show estimate (clearly labeled "est."), not measured. Upgrade
    // to real numbers if/when check-in times exist.
    const wrHours = Math.round(wrappedRows.length * 3.5);
    const wrArtistSet = new Set(wrappedRows.flatMap(wrArtistNames));
    const wrVenueSet = new Set(wrappedRows.map(ev=>ev.venue_name).filter(Boolean));

    const wrappedTabs = [['This year', wrappedCurYear+' Wrapped'],['All time','All-time Wrapped']]
      .map(([key,label])=>({ label, cls: s.wrappedRange===key?'is-active':'', pick:()=>this.setState({wrappedRange:key}) }));
    const wr = {
      shows: String(wrappedRows.length),
      showsLabel: wrappedYear ? ('Shows in '+wrappedCurYear) : 'Shows all-time',
      subhead: wrappedYear ? 'Your year in raving' : ('Every show since '+wrFirstYear),
      badge: wrappedYear ? (wrappedCurYear+' WRAPPED') : 'ALL-TIME WRAPPED',
      hours: String(wrHours),
      topArtist: (wrArtistCounts[0]||[])[0] || '—', topVenue: (wrVenueCounts[0]||[])[0] || '—', topGenre: (wrGenreCounts[0]||[])[0] || '—',
      busiestMonth: MONTH_LABELS[busiestIdx], busiestCount: String(monthCounts[busiestIdx]),
      yearsActive: String(wrYearsActive), sinceYear: String(wrFirstYear),
      firstTitle: wrFirst ? (wrFirst.title||'Untitled show') : '—',
      firstVenue: wrFirst ? [wrFirst.venue_name, wrFirst.city].filter(Boolean).join(' · ') : '—',
      firstDate: wrFirst ? ((Drop && Drop.fmtDate(wrFirst.date, wrFirst.time_tbd)) || '') : '',
    };
    const wrappedStats = [
      { value:String(wrArtistSet.size), label:'Artists seen', color:'' },
      { value:wr.hours, label:'Hours on the floor (est.)', color:'color:var(--interested);' },
      { value:wr.topGenre, label:'Top genre', color:'color:var(--going);' },
      { value:String(wrVenueSet.size), label:'Venues visited', color:'color:var(--attended);' },
    ];

    // ===== Claim artist profile (artist_claims insert) =====
    const claimListed = !s.claimNotListed;
    const claimTargetName = s.claimNotListed ? (s.claimNewName.trim() || 'your artist') : (s.claimArtist || '');
    const claimTitles = ['Confirm the artist','Verify it’s you','Review & submit'];
    const claimSubs = ['Tell us which profile you’re claiming.','Add official links so our team can verify you.','Double-check the details, then send it to our team.'];
    const claimStepNum = s.claimStep+1;
    const claimEmailShown = s.claimEmail.trim() || 'your email';

    // ===== Edit artist links modal (owner-only artists.merch_url/website_url) =====
    const editArtistName = s.activeArtist;

    // ===== Log a past show — archive picker (multi-select) + manual form =====
    const logSel = s.logSelected || {};
    // Month-abbrev labels for past-show archive dates (design round 4's moL
    // helper) — renders real Supabase event dates as "Mon D, YYYY".
    const moL=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const archiveDate = iso => { const d = iso ? new Date(iso) : null; return (d && !isNaN(d.getTime())) ? (moL[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear()) : ((Drop && Drop.fmtDate(iso)) || 'Date TBD'); };
    const logRows = (s.logResults||[]).map(ev=>({
      id: ev.id, title: ev.title || 'Untitled show',
      venueCity: [ev.venue_name, ev.city].filter(Boolean).join(' · '),
      dateShort: archiveDate(ev.date),
      checked: !!logSel[ev.id],
      boxStyle: logSel[ev.id] ? 'background:var(--accent);border-color:var(--accent);color:var(--ink);' : 'border-color:var(--border-strong);color:transparent;',
      rowStyle: logSel[ev.id] ? 'border-color:var(--accent);background:rgba(77,226,255,0.06);' : 'border-color:var(--border);background:var(--surface);',
      check: logSel[ev.id] ? '✓' : '',
      toggle:()=>this.setState(x=>{ const n={...x.logSelected}; if(n[ev.id]) delete n[ev.id]; else n[ev.id]=true; return {logSelected:n}; }),
    }));
    const logSelCount = Object.keys(logSel).length;
    const logCurYear = new Date().getFullYear();
    const logYearChips = ['All', String(logCurYear), String(logCurYear-1), String(logCurYear-2), String(logCurYear-3)]
      .map(y=>({ label:y, cls: (s.logYear||'All')===y?'is-active':'', pick:()=>{ this.setState({logYear:y}); this.logSearch(); } }));

    // ===== Memories =====
    const memorySlots = [1,2,3,4,5,6].map(n=>({ id:'mem-'+n }));

    // ===== Recap =====
    const recapGate = s.recapWasThere !== true;
    const recapBuild = s.recapWasThere === true;
    const recapChosen = Object.keys(s.recapPhotos).filter(k=>s.recapPhotos[k]).length;
    const recapSlots = [1,2,3,4].map(n=>({ id:'recap-'+n, n }));
    const recapPreviewCells = [1,2,3,4].map(n=>({ id:'recap-'+n, bg:'background:rgba(255,255,255,0.06);' }));
    const recapCountLabel = 'Drag photos into the four slots — they fill the recap card on the right.';

    // ===== Seen history =====
    const seenYears = this.SEEN_HISTORY.map(y=>({ year:y.year, shows:y.shows.map(sh=>({ title:sh.title, venue:sh.venue, date:sh.date, gradStyle:'background-image:'+sh.grad,
      hasBadge: !!sh.badge, badge:sh.badge,
      badgeStyle: sh.badge==='Superfan'?'background:var(--grad-glow);color:var(--ink);':'background:var(--surface-hi);color:var(--accent);' })) }));

    // ===== Tagged =====
    const taggedList = this.TAGGED.filter(t=>!s.tagActioned[t.id]).map(t=>({ who:t.who, show:t.show, date:t.date, gradStyle:'background-image:'+t.grad,
      accept:()=>{ this.setState(x=>({ tagActioned:{...x.tagActioned, [t.id]:'a'} })); this.flash('Added to your history'); },
      dismiss:()=>{ this.setState(x=>({ tagActioned:{...x.tagActioned, [t.id]:'d'} })); this.flash('Tag dismissed'); } }));

    // ===== Wallet ledger =====
    const ledger = this.LEDGER.map(l=>{ const st=this.LEDGER_STATES[l.state]; return { label:l.label, date:l.date, amount:l.amount,
      stateLabel:st.label, stateColor:st.color, stateBg:st.bg,
      amountStyle: l.state==='reversed'?'color:var(--text-muted);text-decoration:line-through;':(l.state==='confirmed'?'color:var(--attended);':'color:var(--text);') }; });

    // ===== Paywall =====
    const plusPlans = [
      { key:'annual', title:'Annual', sub:'$59.99 / yr · $5.00 per month', badge:'Save 33%', hasBadge:true },
      { key:'monthly', title:'Monthly', sub:'$7.49 / mo · cancel anytime', badge:'', hasBadge:false },
    ].map(p=>{ const on=s.plusPlan===p.key; return { title:p.title, sub:p.sub, badge:p.badge, hasBadge:p.hasBadge,
      bg: on?'rgba(77,226,255,0.08)':'var(--surface)', border: on?'var(--accent)':'var(--border)', dot: on?'var(--accent)':'var(--border-strong)', dotBg: on?'var(--accent)':'transparent', check: on?'✓':'',
      pick:()=>this.setState({plusPlan:p.key}) }; });
    const plusFeatures = [
      { label:'Presale codes & alerts before anyone else' },
      { label:'Ticket cashback, banked as free Drop+ time' },
      { label:'Early RSVP for sold-out shows' },
      { label:'Unlimited crews & plans' },
      { label:'Drop Wrapped, all-time stats & recaps' },
    ];

    // ===== Link hub =====
    const linkButtons = [
      { icon:'🎟️', label:'See what I\u2019m going to', bg:'var(--glass)', act:()=>this.go('discover') },
      { icon:'🎁', label:'My Drop Wrapped', bg:'var(--glass)', act:()=>this.go('wrapped') },
      { icon:'👥', label:'Add me on Drop', bg:'var(--glass)', act:()=>this.go('signup') },
      { icon:'✦', label:'Get Drop free', bg:'var(--glass)', act:()=>this.go('signup') },
    ];

    // ===== Marketing / SEO / share =====
    const aboutStats = [
      { value:'40K+', label:'Ravers', color:'' },
      { value:'2,400', label:'Shows tracked', color:'color:var(--interested);' },
      { value:'18', label:'Cities', color:'color:var(--going);' },
      { value:'4', label:'Founders', color:'color:var(--attended);' },
    ];
    const team = [
      { name:'Harrison Mills', role:'CEO · ex-warehouse promoter' },
      { name:'Clayton Knight', role:'CTO' },
      { name:'Sasha Vidal', role:'Head of Design' },
      { name:'Marcus Lee', role:'Head of Community' },
    ];
    const appFeatures = [
      { icon:'🔔', title:'Presale push alerts', body:'Be first in line the second codes drop.' },
      { icon:'👥', title:'Contacts sync', body:'Find friends already on Drop in one tap.' },
      { icon:'🎟️', title:'Ticket wallet', body:'Your codes and passes, offline-ready at the door.' },
    ];
    const promoterFeatures = [
      { icon:'📡', title:'Reach real ravers', body:'Genre- and location-matched fans who actually attend — not a cold ad audience.' },
      { icon:'📋', title:'Guest lists & comps', body:'Manage guest lists, comps, and door check-in from one dashboard.' },
      { icon:'◆', title:'Presale codes', body:'Distribute presale codes to Drop+ members and track redemptions live.' },
    ];
    const promoterStats = [
      { value:'92%', label:'RSVP-to-attend rate' },
      { value:'3.4x', label:'Avg. reach vs. socials' },
      { value:'0%', label:'Listing fee to start' },
    ];

    const seoCity = 'Denver';
    const cityShows = events.slice(0,5);
    const cityVenues = realVenues.filter(v=>v.city===seoCity).map(v=>({ name:v.name, city:v.city, open:()=>{ this.setState({screen:'venue', activeVenue:v.name, venueCity:v.city}); if(typeof window!=='undefined') window.scrollTo(0,0); } }));
    const cityGenres = this.GENRES.map(g=>({ name:g.name, open:()=>{ this.setState({screen:'genre', activeGenre:g.name}); if(typeof window!=='undefined') window.scrollTo(0,0); } }));
    const cityFaq = [
      { q:'What EDM shows are in '+seoCity+' this weekend?', a:'Drop lists every electronic show in '+seoCity+' with all-in prices. Top picks this weekend include ODESZA at Red Rocks and Subtronics at Mission Ballroom.' },
      { q:'Where are the best rave venues in '+seoCity+'?', a:'Red Rocks Amphitheatre, Mission Ballroom, and The Church are the most-followed electronic venues in '+seoCity+' on Drop.' },
      { q:'How do I find friends going to the same show?', a:'Create a free Drop account, sync your contacts, and you\u2019ll see which friends are going to every show near you.' },
      { q:'Are tickets cheaper on Drop?', a:'Drop links you straight to the official seller for every show — no markup from us. Some links are affiliate links, at no extra cost to you.' },
    ];

    const seoGenre = s.activeGenre || 'Techno';
    const seoGenreLower = seoGenre.toLowerCase();
    const seoGenreGradMap = { House:'background:linear-gradient(120deg,#2b1c4d,#0d3b52);', Dubstep:'background:linear-gradient(120deg,#4d1c37,#52270d);', Techno:'background:linear-gradient(120deg,#1c384d,#3b0d52);', Melodic:'background:linear-gradient(120deg,#1c274d,#520d47);', Bass:'background:linear-gradient(120deg,#4d3a1c,#0d2f52);', Trance:'background:linear-gradient(120deg,#1c4d3a,#52270d);' };
    const seoGenreGrad = seoGenreGradMap[seoGenre] || seoGenreGradMap.Techno;
    const genreShows = (events.filter(e=>e.genre===seoGenre).length ? events.filter(e=>e.genre===seoGenre) : events).slice(0,3);
    const genreArtistNames = { Techno:['Charlotte de Witte','Amelie Lens','Adam Beyer','ISOxo'], House:['FISHER','Chris Lake','Peggy Gou','John Summit'], Melodic:['ODESZA','Lane 8','RÜFÜS DU SOL','Tycho'], Bass:['Skrillex','Subtronics','ISOxo','Peekaboo'], Dubstep:['Subtronics','Peekaboo','ISOxo','Skrillex'], Trance:['Above & Beyond','Ilan Bluestone','Seven Lions','Gareth Emery'] };
    const genreArtists = (genreArtistNames[seoGenre]||genreArtistNames.Techno).map(n=>({ name:n, open:()=>this.openArtist(n, null) }));
    const relatedGenres = this.GENRES.filter(g=>g.name!==seoGenre).slice(0,4).map(g=>({ name:g.name, open:()=>{ this.setState({screen:'genre', activeGenre:g.name}); if(typeof window!=='undefined') window.scrollTo(0,0); } }));

    const shareEv = events[0] || { title:'', dateShort:'', venueCity:'', grad:EVENT_GRADS[0] };
    const sharePlan = { ...shareEv, gradStyle:'background-image:'+shareEv.grad };

    // ===== Music taste manager =====
    const TASTE_CAP = 20;
    const tasteGenreChips = this.GENRES.map(g=>{ const on=!!s.tasteGenres[g.name]; return { name:g.name, cls:on?'is-active':'', toggle:()=>this.setState(x=>{ const t={...x.tasteGenres}; if(t[g.name]) delete t[g.name]; else t[g.name]=true; return {tasteGenres:t}; }) }; });
    const tasteCount = s.tasteArtists.length;
    const tasteCapLabel = tasteCount+' / '+TASTE_CAP;
    const tasteCapColor = tasteCount>=TASTE_CAP ? 'var(--gold)' : 'var(--text-secondary)';
    const tasteArtistChips = s.tasteArtists.map(n=>({ name:n, remove:()=>this.setState(x=>({tasteArtists:x.tasteArtists.filter(a=>a!==n)})) }));
    const tq = s.tasteQuery.trim().toLowerCase();
    const tasteMatches = tq.length>0 ? realArtists.filter(a=>a.name.toLowerCase().includes(tq) && !s.tasteArtists.includes(a.name)).slice(0,4).map(a=>({ name:a.name, add:()=>{ if(this.state.tasteArtists.length>=TASTE_CAP){ this.flash('Artist cap reached ('+TASTE_CAP+')'); return; } this.setState(x=>({tasteArtists:[...x.tasteArtists,a.name], tasteQuery:''})); } })) : [];
    const tasteQueryOpen = tq.length>0 && tasteMatches.length>0;
    const scSubLabel = s.scConnected ? 'Connected · 12 artists imported' : 'Import your likes & follows';
    const scBtnLabel = s.scConnected ? 'Disconnect' : 'Connect';
    const scBtnCls = s.scConnected ? 'btn btn--secondary btn--sm' : 'btn btn--primary btn--sm';

    // ===== Suggest an event =====
    // ponytail: no scout-rewards backend — approved count derives from the
    // (always-empty this phase) SUBMISSIONS list rather than a fake "3 of 5".
    const SCOUT_GOAL = 5, scoutApproved = this.SUBMISSIONS.filter(sb=>sb.status==='live').length;
    const scoutLabel = scoutApproved+' of '+SCOUT_GOAL+' live';
    const scoutFillStyle = 'width:'+(scoutApproved/SCOUT_GOAL*100)+'%;';
    const scoutHint = scoutApproved>=SCOUT_GOAL ? 'Reward unlocked — a free month of Drop+ 🎉' : (SCOUT_GOAL-scoutApproved)+' more approved shows for a free month of Drop+';
    const CAP_MAX = 5, capUsed = this.SUBMISSIONS.length;
    const capReached = capUsed>=CAP_MAX;
    const saq = s.sugArtist.trim().toLowerCase();
    const sugArtistMatches = saq.length>0 ? realArtists.filter(a=>a.name.toLowerCase().includes(saq)).slice(0,4).map(a=>({ name:a.name, pick:()=>this.setState({sugArtist:a.name}) })) : [];
    const sugArtistOpen = saq.length>0 && sugArtistMatches.length>0 && s.sugArtist!==(sugArtistMatches[0]&&sugArtistMatches[0].name);
    const svq = s.sugVenue.trim().toLowerCase();
    const sugVenueMatches = svq.length>0 ? realVenues.filter(v=>v.name.toLowerCase().includes(svq)||v.city.toLowerCase().includes(svq)).slice(0,4).map(v=>({ name:v.name, city:v.city, pick:()=>this.setState({sugVenue:v.name}) })) : [];
    const sugVenueOpen = svq.length>0 && sugVenueMatches.length>0 && s.sugVenue!==(sugVenueMatches[0]&&sugVenueMatches[0].name);
    const submissions = this.SUBMISSIONS.map(sub=>{ const st=this.SUB_STATUS[sub.status]; return { title:sub.title, venue:sub.venue, date:sub.date, label:st.label, color:st.color, bg:st.bg }; });

    // ===== Promoter =====
    const PROMO_STATUS = { live:{label:'Live', color:'var(--attended)', bg:'rgba(182,255,106,0.12)'}, draft:{label:'Draft', color:'var(--text-muted)', bg:'var(--surface-hi)'} };
    // No promoter events table this phase — PROMO_EVENTS is always empty;
    // pmRaw falls back to a safe empty event so promomanage (unreached from
    // an empty dashboard, same as plan detail above) can't crash render().
    const promoEvents = this.PROMO_EVENTS.map(e=>{ const st=PROMO_STATUS[e.status]; return { ...e, gradStyle:'background-image:'+e.grad, statusLabel:st.label, statusColor:st.color, statusBg:st.bg, manage:()=>{ this.setState({managePromoEvent:e.id, promoTab:'details', promoDelConfirm:''}); this.go('promomanage'); } }; });
    const promoEventsEmpty = promoEvents.length===0;
    const pmRaw = this.PROMO_EVENTS.find(e=>e.id===s.managePromoEvent) || this.PROMO_EVENTS[0] || { id:'', title:'', date:'', grad:EVENT_GRADS[0], status:'draft', views:'—', going:0, redeem:0 };
    const pm = { ...pmRaw, gradStyle:'background-image:'+pmRaw.grad };
    const promoTabs = ['details','guests','codes'].map(t=>({ label:{details:'Details',guests:'Guest list',codes:'Codes'}[t], cls: s.promoTab===t?'is-active':'', pick:()=>this.setState({promoTab:t}) }));
    const promoDelOk = s.promoDelConfirm.trim().toUpperCase()==='DELETE';
    const guests = this.GUESTS.map(g=>{ const on=!!s.guestChecked[g.id]; return { name:g.name, plusLabel: g.plus>0?('+'+g.plus+' guest'+(g.plus>1?'s':'')):'Solo', bg: on?'rgba(182,255,106,0.06)':'var(--surface)', btnLabel: on?'✓ In':'Check in', btnCls: on?'btn btn--sm is-going wsc__act is-going':'btn btn--secondary btn--sm', toggle:()=>this.setState(x=>({guestChecked:{...x.guestChecked,[g.id]:!x.guestChecked[g.id]}})) }; });
    const guestsEmpty = guests.length===0;
    const guestTotal = this.GUESTS.reduce((n,g)=>n+1+g.plus,0);
    const guestCheckedIn = this.GUESTS.filter(g=>s.guestChecked[g.id]).reduce((n,g)=>n+1+g.plus,0);
    const guestPending = guestTotal - guestCheckedIn;
    const codes = this.CODES.map(c=>({ code:c.code, desc:c.desc, usage: c.used+' / '+c.cap+' used', active: !!s.codeActive[c.id], toggle:()=>this.setState(x=>({codeActive:{...x.codeActive,[c.id]:!x.codeActive[c.id]}})), del:()=>this.flash('Code '+c.code+' deleted') }));
    const codesEmpty = codes.length===0;

    // ===== Admin =====
    const adminTabs = ['queue','reports','analytics'].map(t=>({ label:{queue:'Review queue',reports:'Reports',analytics:'Analytics'}[t], cls: s.adminTab===t?'is-active':'', pick:()=>this.setState({adminTab:t}) }));
    const reviewQueue = this.REVIEW_QUEUE.filter(r=>!s.reviewActioned[r.id]).map(r=>({ ...r, approve:()=>{ this.setState(x=>({reviewActioned:{...x.reviewActioned,[r.id]:'approved'}})); this.flash('Approved — event is now live'); }, reject:()=>{ this.setState(x=>({reviewActioned:{...x.reviewActioned,[r.id]:'rejected'}})); this.flash('Rejected'); } }));
    const REPORT_ST = { open:{label:'Open', color:'var(--gold)', bg:'rgba(255,203,61,0.12)'}, dismissed:{label:'Dismissed', color:'var(--text-muted)', bg:'var(--surface-hi)'}, reviewed:{label:'Reviewed', color:'var(--accent)', bg:'rgba(77,226,255,0.12)'}, actioned:{label:'Actioned', color:'var(--danger)', bg:'rgba(255,77,109,0.12)'} };
    const reports = this.REPORTS.map(r=>{ const key=s.reportState[r.id]||'open'; const st=REPORT_ST[key]; return { ...r, stLabel:st.label, stColor:st.color, stBg:st.bg, dismiss:()=>{ this.setState(x=>({reportState:{...x.reportState,[r.id]:'dismissed'}})); this.flash('Report dismissed'); }, reviewed:()=>{ this.setState(x=>({reportState:{...x.reportState,[r.id]:'reviewed'}})); this.flash('Marked reviewed'); }, action:()=>{ this.setState(x=>({reportState:{...x.reportState,[r.id]:'actioned'}})); this.flash('Content removed'); } }; });
    const maxSignup = Math.max(1, ...this.ADMIN_SIGNUPS);
    const signupBars = this.ADMIN_SIGNUPS.map(v=>({ h:(v/maxSignup*100)+'%', value:v+' signups' }));

    return {
      showNav: s.screen!=='login' && s.screen!=='signup' && s.screen!=='activation' && s.screen!=='rsvpmoment' && s.screen!=='crewbuilder' && s.screen!=='recap' && s.screen!=='forgot' && s.screen!=='reset' && s.screen!=='verify' && s.screen!=='referral' && s.screen!=='link' && s.screen!=='paywall' && s.screen!=='shareplan' && s.screen!=='sharerecap' && s.screen!=='sharewrapped' && s.screen!=='claim',
      screenHome: s.screen==='home', screenLogin: s.screen==='login', screenSignup: s.screen==='signup',
      screenDiscover: s.screen==='discover', screenEvent: s.screen==='event',
      screenSearch: s.screen==='search', screenFestival: s.screen==='festival', screenActivation: s.screen==='activation',
      screenRsvpMoment: s.screen==='rsvpmoment',
      screenArtist: s.screen==='artist', screenVenue: s.screen==='venue', screenMyShows: s.screen==='myshows',
      screenArtists: s.screen==='artists', screenVenues: s.screen==='venues', screenClaim: s.screen==='claim',
      screenCrew: s.screen==='crew', screenPlan: s.screen==='plan', screenCrewBuilder: s.screen==='crewbuilder',
      screenInvite: s.screen==='invite', screenWrapped: s.screen==='wrapped',
      screenProfile: s.screen==='profile', screenEditProfile: s.screen==='editprofile',
      screenNotifications: s.screen==='notifications', screenSettings: s.screen==='settings',
      screenBlocked: s.screen==='blocked', screenDelete: s.screen==='delete',
      screenLogShow: s.screen==='logshow', screenMemories: s.screen==='memories', screenRecap: s.screen==='recap',
      screenSeen: s.screen==='seen', screenTagged: s.screen==='tagged',
      screenWallet: s.screen==='wallet', screenPaywall: s.screen==='paywall',
      screenForgot: s.screen==='forgot', screenReset: s.screen==='reset', screenVerify: s.screen==='verify', screenReferral: s.screen==='referral',
      screen404: s.screen==='e404', screenLink: s.screen==='link',
      screenAbout: s.screen==='about', screenGetApp: s.screen==='getapp', screenPromoters: s.screen==='promoters',
      screenCity: s.screen==='city', screenGenre: s.screen==='genre',
      screenSharePlan: s.screen==='shareplan', screenShareRecap: s.screen==='sharerecap', screenShareWrapped: s.screen==='sharewrapped',
      screenTaste: s.screen==='taste', screenSuggest: s.screen==='suggest', screenError: s.screen==='error',
      screenPromoter: s.screen==='promoter', screenPromoManage: s.screen==='promomanage', screenAdmin: s.screen==='admin',
      isPromoter: s.isPromoter, notPromoter: !s.isPromoter,
      promoEvents, promoEventsEmpty, promoEventCount: promoEvents.length, pm, promoTabs, promoTabDetails: s.promoTab==='details', promoTabGuests: s.promoTab==='guests', promoTabCodes: s.promoTab==='codes',
      promoDelConfirm: s.promoDelConfirm, promoDelDisabled: !promoDelOk, promoDelOpacity: promoDelOk?'1':'0.5',
      guests, guestsEmpty, guestTotal, guestCheckedIn, guestPending, codes, codesEmpty,
      adminTabs, adminTabQueue: s.adminTab==='queue', adminTabReports: s.adminTab==='reports', adminTabAnalytics: s.adminTab==='analytics',
      reviewQueue, queuePending: reviewQueue.length, queueEmpty: reviewQueue.length===0, reports, reportsEmpty: reports.length===0, signupBars,
      topEvents: this.ADMIN_TOP_EVENTS, adminActions: this.ADMIN_ACTIONS,
      // Real events fetch factors into the shared skeleton/content-ready gate
      // so Discover/Home/Event/Search never flash an empty grid before the
      // first real fetch resolves.
      loading: s.loading || s.eventsLoading,
      contentReady: !s.loading && !s.eventsLoading,
      skelCards: [1,2,3,4,5,6,7,8].map(n=>({})),
      skelRows: [1,2,3,4].map(n=>({})),
      tasteImport: s.tasteImport, tasteConsent: s.tasteConsent,
      tasteGenreChips, tasteCapLabel, tasteCapColor, tasteArtistChips, tasteMatches, tasteQuery: s.tasteQuery, tasteQueryOpen,
      scSubLabel, scBtnLabel, scBtnCls,
      scoutLabel, scoutFillStyle, scoutHint, capUsed, capMax: CAP_MAX, capReached,
      sugArtist: s.sugArtist, sugArtistMatches, sugArtistOpen, sugVenue: s.sugVenue, sugVenueMatches, sugVenueOpen, sugCity: s.sugCity, sugLink: s.sugLink,
      submitLabel: capReached ? 'Monthly cap reached' : 'Submit event', submissions, submissionsEmpty: submissions.length===0,
      aboutStats, team, appFeatures, promoterFeatures, promoterStats,
      seoCity, cityShows, cityVenues, cityGenres, cityFaq,
      seoGenre, seoGenreLower, seoGenreGrad, genreShows, genreArtists, relatedGenres,
      sharePlan,
      authed: s.authed, signedOut: !s.authed,
      // PHASE 1 auth UI state
      authError: s.authError, authBusy: s.authBusy,
      loginBtnLabel: s.authBusy ? 'Working…' : 'Log in',
      signupBtnLabel: s.authBusy ? 'Working…' : 'Create account',
      username: s.username,
      verifyEmail: s.verifyEmail || 'your email', verifyMessage: s.verifyMessage,
      city: s.city, cityOpen: s.cityOpen, cityFilter: s.cityFilter, cityList, cityFilterEmpty, menuOpen: s.menuOpen, menuItems, navOpen: s.navOpen, mobileMenu,
      events, genres, discoverEvents, discShowPager, discPageLabel, discPrevDisabled, discNextDisabled, genreActive, gridLabel, gridEmpty, genreName: s.genre,
      homeEmpty: !s.eventsLoading && events.length===0,
      eventsLoading: s.eventsLoading, eventsError: s.eventsError,
      tabs: tabList, dateChips, dateChipLabel,
      comments: this.COMMENTS, commentsEmpty: this.COMMENTS.length===0,
      waveBars,

      // search
      query: s.query, typeahead: typeaheadGroups, typeaheadOpen,
      distOptions, distLabel, sDistOpen: s.sDistOpen, priceMin: s.priceMin, priceMax: s.priceMax,
      searchGenreList, searchGenreEmpty, searchGenreLabel, searchGenreOpen: s.searchGenreOpen, searchGenreFilter: s.searchGenreFilter,
      searchCityList, searchCityEmptyList, searchCityLabel, searchCityOpen: s.sCityOpen, sCityFilter: s.sCityFilter,
      searchVenueList, searchVenueEmptyList, searchVenueLabel, searchVenueOpen: s.sVenueOpen, sVenueFilter: s.sVenueFilter,
      searchGeoActive, searchGeoInactive: !searchGeoActive, searchGeoPending, searchGeoIdle,
      searchLocPillLabel, searchGeoBtnLabel,
      priceRangeLabel: '$'+lo+' – $'+hi+(hi>=200?'+':''),
      priceFillStyle: 'left:'+(lo/200*100)+'%;right:'+(100-hi/200*100)+'%;',
      searchEmpty, searchHasResults, searchNoResults, searchResults, resultsLabel,
      recentSearches, hasRecentSearches: recentSearches.length>0, trendingChips,

      // festival
      festTabs, stages, festClashBanner,
      festivalLoading:s.festivalLoading,
      festivalError:s.festivalError,
      festivalHasEvent:!!festival,
      festivalHasSchedule,
      festivalEmpty,
      festivalTabEmpty,
      festivalTitle:festival ? festival.title : 'Festival schedule',
      festivalKicker,
      festivalVenueMeta,
      festivalTimeZone,

      // wizard
      wizStepNum, wizTitle: wizCur.title, wizSubtitle: wizCur.sub, wizDots, wizNextLabel, wizHasBack: s.wizStep>0,
      wizStep0: s.wizStep===0, wizStep1: s.wizStep===1, wizStep2: s.wizStep===2, wizStep3: s.wizStep===3, wizStep4: s.wizStep===4,
      wizGenreChips, wizFriends, wizArtists,
      wizArtQuery: s.wizArtQuery, wizArtMatches, wizArtOpen, wizArtChosen, wizHasArtChosen: wizArtChosen.length>0,

      // first-rsvp moment — real event or none (rmHasEvent gates the card)
      rm: rmEv ? { ...rmEv, gradStyle:'background-image:'+rmEv.grad, hasFriends:false, friendsLabel:'' } : null,
      rmHasEvent: !!rmEv, rmNoEvent: !rmEv,
      rmName: rmDisplayName,

      // artist / venue / my shows
      art: { name:artName, genre:artGenre, hasGenre: !!artGenre, bio:artBio, gradStyle:'background-image:'+artGrad,
        hasSeen:false, seenCount:'',
        hasFriends:false, friendsLabel:'',
        verified: !!(artRow && artRow.verified), hasMerch: !!artMerchUrl, merchUrl: artMerchUrl, hasWebsite: !!artWebsiteUrl, websiteUrl: artWebsiteUrl,
        hasImage: !!artImageUrl, noImage: !artImageUrl, imageUrl: artImageUrl,
        ownedByMe: artOwned, claimPending: s.claimStatus==='pending', canClaim: !artOwned && s.claimStatus!=='pending' },
      artShows, artHasShows: artShows.length>0, artSimilar, artReviews, artReviewsEmpty: artReviews.length===0,
      artFollowLabel: artFollowing?'✓ Following':'＋ Follow', artFollowCls: artFollowing?'btn btn--secondary':'btn btn--primary',
      // claim artist + owner links
      claimForm: !s.claimSubmitted, claimSubmitted: s.claimSubmitted,
      claimStep1: s.claimStep===0, claimStep2: s.claimStep===1, claimStep3: s.claimStep===2,
      claimStepNum, claimTitle: claimTitles[s.claimStep]||claimTitles[0], claimSubtitle: claimSubs[s.claimStep]||claimSubs[0],
      claimNextLabel: s.claimStep>=2 ? (s.claimBusy?'Submitting…':'Submit claim') : 'Continue',
      claimArtistName: s.claimArtist, claimNotListed: s.claimNotListed, claimNewName: s.claimNewName, claimHasListing: s.claimHasListing,
      claimWebsite: s.claimWebsite, claimSocial: s.claimSocial, claimEmail: s.claimEmail, claimError: s.claimError,
      claimTargetName, claimEmailShown, claimWebsiteShown: s.claimWebsite.trim()||'—', claimSocialShown: s.claimSocial.trim()||'—', claimEmailReview: s.claimEmail.trim()||'—',
      claimListedBorder: claimListed?'var(--accent)':'var(--border)', claimListedDot: claimListed?'var(--accent)':'var(--border-strong)', claimListedFill: claimListed?'var(--accent)':'transparent',
      claimNotListedBorder: s.claimNotListed?'var(--accent)':'var(--border)', claimNotListedDot: s.claimNotListed?'var(--accent)':'var(--border-strong)', claimNotListedFill: s.claimNotListed?'var(--accent)':'transparent',
      editLinksOpen: s.editLinksOpen, editMerch: s.editMerch, editWebsite: s.editWebsite, editArtistName,
      ven: { name:venName, ...venMeta, gradStyle:'background-image:'+venMeta.grad, hasLocation: !!venMeta.location },
      venShows, venHasShows: venShows.length>0,
      venFollowLabel: venFollowing?'✓ Following':'＋ Follow venue', venFollowCls: venFollowing?'btn btn--secondary':'btn btn--primary',
      myTabs,
      myShowUpcoming: s.myTab==='Upcoming', myShowSaved: s.myTab==='Saved', myShowPast: s.myTab==='Past',
      myShowShowWrapped: s.myTab!=='Saved',
      myUpcoming, myUpcomingEmpty: myUpcoming.length===0,
      mySaved, mySavedEmpty: mySaved.length===0,
      myPast, myPastEmpty: myPast.length===0,

      // pick artists
      artGenreChips, artistGrid, artistGridEmpty, artBulkShow, artBulkLabel, artMoreShow, artMoreLabel,
      artMore:()=>this.setState(x=>({ artShown: x.artShown + 96 })),
      // browse venues
      venueQuery: s.venueQuery, venueGroups, venuesEmpty: venMatched.length===0,
      // crew
      crewTabs,
      crewFriends: s.crewTab==='Friends', crewRequests: s.crewTab==='Requests', crewFind: s.crewTab==='Find', crewPlans: s.crewTab==='Plans',
      friendsList, friendsEmpty: friendsList.length===0, requestsList, requestsEmpty: requestsList.length===0,
      findList, findEmpty: findList.length===0, plansList, plansListEmpty: plansList.length===0,
      // plan detail
      pd,
      // crew builder
      cbTitle: cbEv.title.split(' — ')[0], cbFriends, cbFriendsEmpty: cbFriends.length===0,
      // invite
      inviteCount, inviteRemainLabel: inviteRemain===0?'Reward unlocked 🎉':inviteRemain+' more for a free month', inviteFillStyle:'width:'+(inviteCount/5*100)+'%;', inviteMilestones, inviteList, inviteListEmpty: inviteList.length===0,
      inviteHandle: (s.profile && s.profile.username) || 'you',
      // wrapped
      wrappedTabs, wr, wrappedStats, wrappedYear, wrappedAllTime: !wrappedYear, wrappedEmpty, wrappedHasData: !wrappedEmpty,
      wrappedTopArtists, wrappedTopVenues, wrappedTopGenres, wrappedMonths,
      // log a past show — archive picker + manual form
      logQuery: s.logQuery, logYearChips, logRows, logResultsEmpty: !s.logSearching && logRows.length===0, logSearching: s.logSearching,
      logSelCount, logHasSelected: logSelCount>0, logAddLabel: 'Add '+logSelCount+' show'+(logSelCount===1?'':'s'),
      logArtist: s.logArtist, logVenue: s.logVenue, logCity: s.logCity, logState: s.logState, logDate: s.logDate,
      // memories / recap / seen / tagged
      memorySlots,
      recapGate, recapBuild, recapSlots, recapPreviewCells, recapCountLabel,
      seenYears, seenEmpty: seenYears.length===0,
      taggedList, taggedEmpty: taggedList.length===0,
      // drop+
      ledger, ledgerEmpty: ledger.length===0,
      plusPlans, plusFeatures, plusCtaLabel: s.plusPlan==='annual'?'Start annual — $59.99/yr':'Start monthly — $7.49/mo',
      // link hub
      linkButtons,

      // profile / settings
      prof, profileStats, profileMenu, notifications, notifEmpty: notifications.length===0,
      notifBadge: String(notifications.filter(n=>n.unread).length), hasNotifBadge: notifications.some(n=>n.unread),
      settingsToggles, recapPrivacy: s.recapPrivacy,
      blocked, blockedEmpty: blocked.length===0,
      deleteConfirm: s.deleteConfirm, deleteDisabled: !deleteOk,
      deleteBtnBg: deleteOk?'var(--danger)':'var(--surface-hi)', deleteBtnColor: deleteOk?'var(--white)':'var(--text-muted)', deleteCursor: deleteOk?'pointer':'not-allowed',
      gate: s.gate, gateTitle: s.gateTitle, toast: s.toast,

      // event detail
      ae: { ...ae, gradStyle:'background-image:'+ae.grad, hasFriends:ae.friends>0, friendsLabel:fl(ae.friends), lineup, priceRows,
        description: ae.title.split(' — ')[0]+' brings a full production to '+ae.venue+' — expect a headline set built around the new album, immersive lighting and a stacked support bill. Doors open one hour before showtime. This is an 18+ event; a valid ID is required at the door. Times are subject to change, so keep an eye on your Drop reminders for set-time updates and any presale drops.' },
      aeSingleSeller,
      descCls: s.descClamped?'is-clamped':'', descToggle: s.descClamped?'Read more':'Show less',
      aeGoingCls: 'wsc__act'+(aeSt==='going'?' is-going':''),
      aeInterestedCls: 'wsc__act'+(aeSt==='interested'?' is-interested':''),
      aeInterestedGlyph: aeSt==='interested'?'★':'☆',
      aeSaveCls:'', aeSaveGlyph: aeSaved?'♥':'♡',

      // handlers
      noop:(e)=>{ this.prevent(e); this.setState({cityOpen:false,menuOpen:false}); },
      stop:(e)=>{ if(e&&e.stopPropagation) e.stopPropagation(); },
      goHome:(e)=>{ this.prevent(e); this.go('home'); },
      goLogin:(e)=>{ this.prevent(e); this.go('login'); },
      goSignup:(e)=>{ this.prevent(e); this.go('signup'); },
      goDiscover:(e)=>{ this.prevent(e); this.go('discover'); },
      goArtists:(e)=>{ this.prevent(e); this.go('artists'); },
      goVenues:(e)=>{ this.prevent(e); this.go('venues'); },
      goCrew:(e)=>{ this.prevent(e); if(!this.state.authed){ this.openGate('Log in to see your crew'); return; } this.go('crew'); },
      goInvite:(e)=>{ this.prevent(e); if(!this.state.authed){ this.openGate('Log in to invite friends'); return; } this.go('invite'); },
      goWrapped:(e)=>{ this.prevent(e); this.go('wrapped'); },
      goMemories:(e)=>{ this.prevent(e); if(!this.state.authed){ this.openGate('Log in to see your memories'); return; } this.go('memories'); },
      goLogShow:(e)=>{ this.prevent(e); if(!this.state.authed){ this.openGate('Log in to log shows'); return; } this.setState({logSelected:{}}); this.go('logshow'); this.logSearch(); },
      genrePrev:()=>{ const r=document.getElementById('genreRail'); if(r) r.scrollBy({ left: -Math.round(r.clientWidth*0.9), behavior:'smooth' }); },
      genreNext:()=>{ const r=document.getElementById('genreRail'); if(r) r.scrollBy({ left: Math.round(r.clientWidth*0.9), behavior:'smooth' }); },
      goRecap:(e)=>{ this.prevent(e); this.setState({recapWasThere:null}); this.go('recap'); },
      goSeen:(e)=>{ this.prevent(e); this.go('seen'); },
      goTagged:(e)=>{ this.prevent(e); this.go('tagged'); },
      goWallet:(e)=>{ this.prevent(e); this.go('wallet'); },
      goPaywall:(e)=>{ this.prevent(e); this.go('paywall'); },
      go404:(e)=>{ this.prevent(e); this.go('e404'); },
      goLink:(e)=>{ this.prevent(e); this.go('link'); },
      goAbout:(e)=>{ this.prevent(e); this.go('about'); },
      goGetApp:(e)=>{ this.prevent(e); this.go('getapp'); },
      goPromoters:(e)=>{ this.prevent(e); this.go('promoters'); },
      goCity:(e)=>{ this.prevent(e); this.go('city'); },
      goGenre:(e)=>{ this.prevent(e); this.go('genre'); },
      goSharePlan:(e)=>{ this.prevent(e); this.go('shareplan'); },
      goShareRecap:(e)=>{ this.prevent(e); this.go('sharerecap'); },
      goShareWrapped:(e)=>{ this.prevent(e); this.go('sharewrapped'); },
      appToast:()=>this.flash('App Store — coming soon'),
      promoterToast:()=>this.flash('Promoter signup — coming soon'),
      goTaste:(e)=>{ this.prevent(e); if(!this.state.authed){ this.openGate('Log in to manage your taste'); return; } this.go('taste'); },
      goSuggest:(e)=>{ this.prevent(e); if(!this.state.authed){ this.openGate('Log in to suggest events'); return; } this.go('suggest'); },
      goError:(e)=>{ this.prevent(e); this.go('error'); },
      errorRetry:()=>{ this.go('discover'); this.flash('Reloaded'); },
      // promoter
      goPromoter:(e)=>{ this.prevent(e); if(!this.state.authed){ this.openGate('Log in to access promoter tools'); return; } this.go('promoter'); },
      becomePromoter:()=>{ this.setState({isPromoter:true}); this.flash('You\u2019re a promoter — welcome!'); },
      promoNewEvent:()=>this.flash('New event — draft created'),
      promoSaveDetails:()=>this.flash('Event details saved'),
      setPromoDel:(e)=>this.setState({promoDelConfirm:e.target.value}),
      promoDelete:()=>{ if(this.state.promoDelConfirm.trim().toUpperCase()!=='DELETE') return; this.setState({promoDelConfirm:''}); this.go('promoter'); this.flash('Event deleted'); },
      promoAddGuest:()=>this.flash('Guest added to list'),
      promoAddCode:()=>this.flash('Presale code created'),
      // admin
      goAdmin:(e)=>{ this.prevent&&this.prevent(e); this.go('admin'); },
      // taste
      scAction:()=>{ if(this.state.scConnected){ this.setState({scConnected:false, tasteImport:false}); this.flash('SoundCloud disconnected'); } else { this.setState({tasteConsent:true}); } },
      scConfirm:()=>{ this.setState({scConnected:true, tasteConsent:false, tasteImport:true}); this.flash('Imported 12 artists from SoundCloud'); },
      scCancel:()=>this.setState({tasteConsent:false}),
      tasteUndo:()=>{ this.setState({tasteImport:false, scConnected:false}); this.flash('Import undone'); },
      setTasteQuery:(e)=>this.setState({tasteQuery:e.target.value}),
      // suggest
      setSugArtist:(e)=>this.setState({sugArtist:e.target.value}),
      setSugVenue:(e)=>this.setState({sugVenue:e.target.value}),
      setSugCity:(e)=>this.setState({sugCity:e.target.value}),
      setSugLink:(e)=>this.setState({sugLink:e.target.value}),
      submitSuggestion:()=>{ if(this.state.sugArtist.trim()===''){ this.flash('Add an artist first'); return; } this.setState({sugArtist:'', sugVenue:'', sugLink:''}); this.flash('Submitted for review — thanks, scout!'); },
      goReferral:(e)=>{ this.prevent(e); this.go('referral'); },
      goForgot:(e)=>{ this.prevent(e); this.setState({authError:''}); this.go('forgot'); },
      goVerify:(e)=>{ this.prevent(e); this.go('verify'); },
      // Forgot-password submit: sends a REAL reset email (supa.auth.resetPasswordForEmail).
      // Stays on the forgot screen — the actual password change only happens
      // after the user clicks the emailed link, which lands back here with
      // ?mode=reset-password (see initRealData) and routes to the reset screen.
      goReset:(e)=>{
        this.prevent(e);
        if (!supa) { this.setState({authError:'Password reset is unavailable. Refresh and try again.'}); return; }
        const email = fieldVal('forgot-email').trim();
        if (!email) { this.setState({authError:'Enter your account email.'}); return; }
        this.setState({authBusy:true, authError:''});
        supa.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '?mode=reset-password' }).then(out=>{
          this.setState({authBusy:false});
          if (out.error) { this.setState({authError: out.error.message}); return; }
          this.flash('Reset link sent — check your email');
        });
      },
      // log a past show — archive search (debounced) + manual field setters
      setLogQuery:(e)=>{ this.setState({logQuery:e.target.value}); clearTimeout(this._logT); this._logT=setTimeout(()=>this.logSearch(), 250); },
      setLogArtist:(e)=>this.setState({logArtist:e.target.value}),
      setLogVenue:(e)=>this.setState({logVenue:e.target.value}),
      setLogCity:(e)=>this.setState({logCity:e.target.value}),
      setLogState:(e)=>this.setState({logState:e.target.value}),
      setLogDate:(e)=>this.setState({logDate:e.target.value}),
      addSelectedShows:()=>this.logAddSelected(),
      submitManualLog:()=>this.logSubmitManual(),
      recapYes:()=>this.setState({recapWasThere:true}),
      recapShare:()=>this.flash('Recap card copied to share'),
      recapDownload:()=>this.flash('Recap image (9:16) downloaded'),
      plusContinue:()=>this.flash('Drop+ checkout — coming soon'),
      doReset:()=>{
        if (!supa) return;
        const pw = fieldVal('reset-password'), pw2 = fieldVal('reset-password-confirm');
        if (!pw || pw.length<8) { this.setState({authError:'Use at least 8 characters.'}); return; }
        if (pw !== pw2) { this.setState({authError:'Passwords do not match.'}); return; }
        this.setState({authBusy:true, authError:''});
        supa.auth.updateUser({ password: pw }).then(out=>{
          this.setState({authBusy:false});
          if (out.error) { this.setState({authError: out.error.message}); return; }
          this.flash('Password updated — log in');
          this.go('login');
        });
      },
      doVerify:()=>{
        if (!supa) { this.go('discover'); return; }
        this.setState({verifyMessage:'Checking...'});
        supa.auth.getSession().then(({data})=>{
          if (data && data.session) { this.setState({verifyMessage:''}); this.afterLogin(); this.go('discover'); this.flash('Email verified — welcome to Drop'); }
          else this.setState({verifyMessage:'Not verified yet — click the link in your email first.'});
        });
      },
      resendVerify:(e)=>{
        this.prevent(e);
        if (!supa || !this.state.verifyEmail) return;
        this.setState({verifyMessage:'Sending...'});
        supa.auth.resend({ type:'signup', email:this.state.verifyEmail }).then(out=>{
          this.setState({ verifyMessage: out.error ? (out.error.message||'Could not resend — try again.') : 'Email resent — check your inbox.' });
        });
      },
      setVenueQuery:(e)=>this.setState({venueQuery:e.target.value}),
      artBulkFollow:()=>{ if(!this.state.authed){ this.openGate('Log in to follow artists'); return; } this.setState(x=>{ const f={...x.followArt}; artFiltered.forEach(a=>{ f[a.name]=!artAllFollowed; }); return {followArt:f}; }); this.flash(artAllFollowed?('Unfollowed all '+s.artGenre):('Following all '+s.artGenre)); },
      planSend:()=>this.flash('Message sent to your crew'),
      // ponytail: no plans backend this phase — can't actually start a real
      // plan, so this is honest ("coming soon") instead of faking one.
      cbStart:()=>{ this.go('event'); this.flash('Plans — coming soon'); },
      cbSkip:()=>{ this.go('event'); },
      inviteCopy:()=>this.flash('Invite link copied'),
      // ponytail: no image-perfect html-to-image lib — native share sheet
      // (text+URL) for "post to story", canvas render (below) for the actual
      // image download. Covers both asks without a screenshot dependency.
      wrappedShare:()=>{
        const text = 'My '+wr.badge+' on Drop — '+wr.shows+' shows, top artist '+wr.topArtist+'.';
        const url = typeof location!=='undefined' ? location.origin+location.pathname : '';
        if (typeof navigator!=='undefined' && navigator.share) { navigator.share({ title:'Drop Wrapped', text, url }).catch(()=>{}); return; }
        if (typeof navigator!=='undefined' && navigator.clipboard) { navigator.clipboard.writeText(text+' '+url).then(()=>this.flash('Wrapped card copied to share')).catch(()=>this.flash('Could not copy — try again')); return; }
        this.flash('Wrapped card copied to share');
      },
      wrappedDownload:()=>{
        try {
          const canvas = renderWrappedCard(wr);
          canvas.toBlob((blob)=>{
            if (!blob) { this.flash('Could not generate image'); return; }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'drop-wrapped-'+s.wrappedRange.replace(/\s+/g,'-').toLowerCase()+'.png';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(()=>URL.revokeObjectURL(url), 4000);
            this.flash('Wrapped image downloaded');
          });
        } catch (e) { console.error('[app] wrapped image render failed:', e.message); this.flash('Could not generate image'); }
      },
      goArtist:(e)=>{ this.prevent(e); this.go('artist'); },
      goVenue:(e)=>{ this.prevent(e); this.go('venue'); },
      goMyShows:(e)=>{ this.prevent(e); this.go('myshows'); },
      // Real write only when opened from a real event's lineup (activeArtistId
      // set — see `lineup` above). Opened from the mock Browse/Pick Artists
      // catalog (no real id) — same local-only toggle as before, unchanged.
      artFollow:()=>{
        if(!this.state.authed){ this.openGate('Log in to follow artists'); return; }
        const aid = this.state.activeArtistId, uid = this.state.userId;
        this.setState(x=>({ following:{...x.following, [artName]: !x.following[artName]} }));
        this.flash(artFollowing?'Unfollowed '+artName:'Following '+artName);
        if (supa && uid && aid) {
          const p = artFollowing
            ? supa.from('artist_follows').delete().eq('user_id', uid).eq('artist_id', aid)
            : supa.from('artist_follows').insert({ user_id: uid, artist_id: aid });
          p.then(r=>{ if (r && r.error) console.error('[app] artist_follows write failed:', r.error.message); });
        }
      },
      // claim artist profile → artist_claims insert (RLS: user_id = own uid)
      goClaim:(e)=>{
        this.prevent(e);
        if(!this.state.authed){ this.openGate('Log in to claim your profile'); return; }
        this.startClaim();
      },
      claimPickListed:()=>this.setState({claimNotListed:false}),
      claimPickNotListed:()=>this.setState({claimNotListed:true}),
      setClaimNewName:(e)=>this.setState({claimNewName:e.target.value}),
      setClaimWebsite:(e)=>this.setState({claimWebsite:e.target.value}),
      setClaimSocial:(e)=>this.setState({claimSocial:e.target.value}),
      setClaimEmail:(e)=>this.setState({claimEmail:e.target.value}),
      claimNext:()=>{
        const st=this.state;
        if(st.claimStep===0 && st.claimNotListed && !st.claimNewName.trim()){ this.setState({claimError:'Enter an artist or project name.'}); return; }
        if(st.claimStep<2){ this.setState(x=>({claimStep:x.claimStep+1, claimError:''})); return; }
        if(!supa || !st.userId){ this.setState({claimError:'Log in to submit a claim.'}); return; }
        const evidence = ['Website: '+(st.claimWebsite.trim()||'—'), 'Social: '+(st.claimSocial.trim()||'—')].join('\n');
        const row = {
          user_id: st.userId,
          proposed_name: st.claimNotListed ? (st.claimNewName.trim()||null) : null,
          artist_id: st.claimNotListed ? null : st.claimArtistId,
          evidence, contact_email: st.claimEmail.trim() || null,
        };
        this.setState({claimBusy:true, claimError:''});
        supa.from('artist_claims').insert(row).then(({error})=>{
          this.setState({claimBusy:false});
          // Unique(artist_id,user_id) violation (Postgres 23505) or any
          // duplicate-claim error → treat as "already pending", not a hard
          // failure, and re-check the real status so the UI matches the DB.
          if (error && error.code==='23505') { this.setState({claimStatus:'pending', claimSubmitted:true}); return; }
          if (error) { this.setState({claimError: error.message||'Could not submit — try again.'}); return; }
          if (!st.claimNotListed && st.claimArtistId) this.loadClaimStatus(st.claimArtistId);
          this.setState({claimSubmitted:true});
          if(typeof window!=='undefined') window.scrollTo(0,0);
        });
      },
      claimBack:()=>{ const st=this.state; if(st.claimStep<=0){ this.setState({screen:'artist'}); if(typeof window!=='undefined') window.scrollTo(0,0); } else { this.setState(x=>({claimStep:x.claimStep-1})); } },
      claimDone:()=>{ this.setState({screen:'artist', claimSubmitted:false}); if(typeof window!=='undefined') window.scrollTo(0,0); },
      // owner-only edit-links modal → artists.merch_url/website_url update
      // (RLS restricts the update to rows where claimed_by = auth uid).
      openEditLinks:()=>{ this.setState({ editLinksOpen:true, editMerch:artMerchUrl, editWebsite:artWebsiteUrl }); },
      setEditMerch:(e)=>this.setState({editMerch:e.target.value}),
      setEditWebsite:(e)=>this.setState({editWebsite:e.target.value}),
      saveEditLinks:()=>{
        if (!supa || !this.state.activeArtistId) { this.setState({editLinksOpen:false}); return; }
        const id = this.state.activeArtistId, merch = this.state.editMerch.trim(), website = this.state.editWebsite.trim();
        supa.from('artists').update({ merch_url: merch||null, website_url: website||null }).eq('id', id).then(({error})=>{
          if (error) { this.flash('Could not save — '+error.message); return; }
          this.setState(x=>({ editLinksOpen:false, activeArtistRow: x.activeArtistRow ? {...x.activeArtistRow, merch_url:merch, website_url:website} : x.activeArtistRow }));
          this.flash('Links updated');
        });
      },
      closeEditLinks:()=>this.setState({editLinksOpen:false}),
      // Real write always — venue_follows keys on (venue_name, city), which
      // both the real-event path and the Browse Venues mock catalog supply.
      venFollow:()=>{
        if(!this.state.authed){ this.openGate('Log in to follow venues'); return; }
        const uid = this.state.userId, city = this.state.venueCity || '';
        this.setState(x=>({ followingVenue:{...x.followingVenue, [venName]: !x.followingVenue[venName]} }));
        this.flash(venFollowing?'Unfollowed '+venName:'Following '+venName);
        if (supa && uid) {
          const p = venFollowing
            ? supa.from('venue_follows').delete().eq('user_id', uid).eq('venue_name', venName).eq('city', city)
            : supa.from('venue_follows').insert({ user_id: uid, venue_name: venName, city });
          p.then(r=>{ if (r && r.error) console.error('[app] venue_follows write failed:', r.error.message); });
        }
      },
      bulkIcs:()=>this.flash(myUpcoming.length+' shows added to calendar (.ics)'),
      onSearchFocus:()=>this.go('search'),
      toggleCity:(e)=>{ this.prevent(e); this.setState(st=>({cityOpen:!st.cityOpen, menuOpen:false})); },
      // City picker (design round 4) — filter/type + "Back to Denver"
      discPrev:(e)=>{ this.prevent(e); this.setState(st=>({discPage: Math.max(0, st.discPage-1)})); },
      discNext:(e)=>{ this.prevent(e); this.setState(st=>({discPage: st.discPage+1})); },
      cityToDenver:(e)=>{ this.prevent(e); this.setState({city:'Denver, CO', cityOpen:false, cityFilter:''}); this.loadEvents(); },
      setCityFilter:(e)=>this.setState({cityFilter:e.target.value}),
      cityKey:(e)=>{ if(e.key==='Enter'){ if(e.preventDefault) e.preventDefault(); const qq=(this.state.cityFilter||'').trim().toLowerCase(); if(!qq) return; const m=this.CITIES.find(c=>c.label.toLowerCase()===qq) || this.CITIES.find(c=>c.label.toLowerCase().includes(qq)) || this.CITIES.find(c=>stateName(c.state).toLowerCase().includes(qq)); this.setState({city: m?m.label:this.state.cityFilter.trim(), cityOpen:false, cityFilter:''}); this.loadEvents(); } },
      // Search filter dropdowns (design round 4)
      toggleSDist:(e)=>{ this.prevent(e); this.setState(st=>({sDistOpen:!st.sDistOpen, searchGenreOpen:false, sCityOpen:false, sVenueOpen:false})); },
      toggleSearchGenre:(e)=>{ this.prevent(e); this.setState(st=>({searchGenreOpen:!st.searchGenreOpen, sDistOpen:false, sCityOpen:false, sVenueOpen:false})); },
      setSearchGenreFilter:(e)=>this.setState({searchGenreFilter:e.target.value}),
      searchGenreAll:()=>this.setState({sGenres:{}, searchGenreFilter:''}),
      toggleSCity:(e)=>{ this.prevent(e); this.setState(st=>({sCityOpen:!st.sCityOpen, searchGenreOpen:false, sDistOpen:false, sVenueOpen:false})); },
      setSCityFilter:(e)=>this.setState({sCityFilter:e.target.value}),
      sCityAll:()=>this.setState({sCity:'', sCityOpen:false, sCityFilter:''}),
      toggleSVenue:(e)=>{ this.prevent(e); this.setState(st=>({sVenueOpen:!st.sVenueOpen, searchGenreOpen:false, sDistOpen:false, sCityOpen:false})); },
      setSVenueFilter:(e)=>this.setState({sVenueFilter:e.target.value}),
      sVenueAll:()=>this.setState({sVenue:'', sVenueOpen:false, sVenueFilter:''}),
      toggleMenu:(e)=>{ this.prevent(e); this.setState(st=>({menuOpen:!st.menuOpen, cityOpen:false})); },
      toggleNav:(e)=>{ this.prevent(e); this.setState(st=>({navOpen:!st.navOpen, cityOpen:false, menuOpen:false})); },
      closeNav:(e)=>{ this.prevent(e); this.setState({navOpen:false}); },
      navGoDiscover:(e)=>{ this.prevent(e); this.go('discover'); },
      navGoVenues:(e)=>{ this.prevent(e); this.go('venues'); },
      navGoArtists:(e)=>{ this.prevent(e); this.go('artists'); },
      navGoLogin:(e)=>{ this.prevent(e); this.go('login'); },
      navGoSignup:(e)=>{ this.prevent(e); this.go('signup'); },
      // Real auth — reuses account.js's exact patterns: email/password via
      // signInWithPassword, username login via the login-with-username edge
      // function (exchanges for a real session via setSession).
      doLogin:()=>{
        if (!supa) { this.setState({authError:'Login is unavailable. Refresh and try again.'}); return; }
        const login = fieldVal('login-email').trim();
        const password = fieldVal('login-password');
        if (!login || !password) { this.setState({authError:'Enter your email or username and password.'}); return; }
        this.setState({authBusy:true, authError:''});
        const finish = (err)=>{
          this.setState({authBusy:false});
          if (err) { this.setState({authError: err.message || 'Could not log in.'}); return; }
          const ret = this.state.gateReturn;
          this.setState({gate:false, gateReturn:null, screen: ret||'discover'});
          if (typeof window!=='undefined') window.scrollTo(0,0);
          this.flash('Welcome back to Drop');
          this.afterLogin();
        };
        (async ()=>{
          try {
            if (!looksLikeEmail(login)) {
              const username = cleanUsername(login);
              const res = await supa.functions.invoke('login-with-username', { body: { username, password } });
              if (res.error || !res.data || !res.data.access_token || !res.data.refresh_token) throw new Error('Invalid username or password.');
              const sessionRes = await supa.auth.setSession({ access_token: res.data.access_token, refresh_token: res.data.refresh_token });
              if (sessionRes.error) throw sessionRes.error;
            } else {
              const out = await supa.auth.signInWithPassword({ email: login, password });
              if (out.error) throw out.error;
            }
            finish(null);
          } catch (e) { finish(e); }
        })();
      },
      doSignup:()=>{
        if (!supa) { this.setState({authError:'Signup is unavailable. Refresh and try again.'}); return; }
        const email = fieldVal('signup-email').trim();
        const username = cleanUsername(this.state.username);
        const password = fieldVal('signup-password');
        const dobValue = fieldVal('signup-dob');
        const consented = fieldChecked('signup-consent');
        if (!email || !password) { this.setState({authError:'Enter your email and password.'}); return; }
        if (!username) { this.setState({authError:'Pick a username.'}); return; }
        if (!dobValue) { this.setState({authError:'Enter your date of birth.'}); return; }
        const years = ageFromDob(dobValue);
        if (years == null || years < 16) { this.setState({authError:'You must be 16 or older to use Drop.'}); return; }
        if (!consented) { this.setState({authError:'Agree to the Terms and Privacy Policy to continue.'}); return; }
        this.setState({authBusy:true, authError:''});
        const data = { username, dob: dobValue, consented_at: new Date().toISOString() };
        // ponytail: referral is cosmetic (no crew-join backend yet) — same
        // note as account.js's signUp(); the raw ref token still rides along
        // as user metadata for a future crew-join job.
        const referralRef = (typeof location!=='undefined' && new URLSearchParams(location.search).get('ref')) || '';
        if (referralRef) data.referred_by = referralRef;
        const redirectTo = location.origin + location.pathname;
        (async ()=>{
          try {
            const out = await supa.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo, data } });
            if (out.error) throw out.error;
            this.setState({authBusy:false});
            if (!out.data.session) { this.setState({ verifyEmail: email, screen:'verify' }); return; }
            this.setState({gate:false, gateReturn:null, screen:'activation', wizStep:0});
            if (typeof window!=='undefined') window.scrollTo(0,0);
            this.afterLogin();
          } catch (e) { this.setState({authBusy:false, authError: e.message || 'Could not create your account.'}); }
        })();
      },
      oauthGoogle:()=>this.oauth('google'),
      oauthApple:()=>this.oauth('apple'),
      downloadApp:()=>{ if (typeof location !== 'undefined') location.href = appDownloadHref(); },
      setUsername:(e)=>this.setState({username: e.target.value}),
      closeGate:()=>this.setState({gate:false}),
      goLoginFromGate:()=>this.setState({gate:false, gateReturn: this.state.screen, screen:'login'}),
      goSignupFromGate:()=>this.setState({gate:false, gateReturn:null, screen:'signup'}),
      aeGoing:()=>this.toggleRsvp(ae.id,'going'),
      aeInterested:()=>this.toggleRsvp(ae.id,'interested'),
      aeSave:()=>this.toggleSave(ae.id),
      aeTickets:()=>{ if (ae.ticketUrl) window.open(ae.ticketUrl, '_blank', 'noopener'); else this.flash('Tickets not on sale yet'); },
      aeShare:()=>this.shareEvent(ae.id),
      aeOpenVenue:(e)=>{ this.prevent(e); this.setState({screen:'venue', activeVenue:ae.venue, venueCity:ae.city||''}); if(typeof window!=='undefined') window.scrollTo(0,0); },
      aeCopyCode:()=>this.flash('Presale code copied'),
      aeIcs:()=>this.flash('Calendar file (.ics) downloaded'),
      toggleDesc:()=>this.setState(st=>({descClamped:!st.descClamped})),
      requirePlan:()=>{ if(!this.state.authed){ this.openGate('Log in to make plans'); return; } this.setState({screen:'crewbuilder'}); if(typeof window!=='undefined') window.scrollTo(0,0); },
      requireComment:()=>{ if(!this.state.authed) this.openGate('Log in to comment'); },

      // search handlers
      setQuery:(e)=>this.setState({query:e.target.value}),
      setPriceMin:(e)=>this.setState({priceMin: parseInt(e.target.value)}),
      setPriceMax:(e)=>this.setState({priceMax: parseInt(e.target.value)}),
      clearFilters:()=>this.setState({sGenres:{}, searchGenreOpen:false, searchGenreFilter:'', sCity:'', sVenue:'', sCityOpen:false, sVenueOpen:false, sCityFilter:'', sVenueFilter:'', sDistOpen:false, distance:'25', priceMin:0, priceMax:200, searchGeo:'idle'}),
      searchUseLocation:()=>{
        if (typeof navigator==='undefined' || !navigator.geolocation) { this.setState({searchGeo:'denied', cityOpen:true}); this.flash('Location unavailable — pick a city'); return; }
        this.setState({searchGeo:'pending'});
        navigator.geolocation.getCurrentPosition(
          ()=>{ this.setState({searchGeo:'active'}); this.flash('Using your current location'); },
          ()=>{ this.setState({searchGeo:'denied', cityOpen:true}); this.flash('Location blocked — pick a city instead'); },
          { timeout: 8000, maximumAge: 60000 }
        );
      },
      searchClearLocation:()=>this.setState({searchGeo:'idle'}),
      clearGenre:(e)=>{ this.prevent(e); this.setState({genre:null}); },

      // festival
      goFestival:(e)=>{ this.prevent(e); this.openFestival(ae.id); },
      retryFestival:()=>this.openFestival(this._festivalRequestedId),

      // wizard
      wizNext:()=>{ if(this.state.wizStep>=4){ this.setState({screen:'rsvpmoment'}); if(typeof window!=='undefined') window.scrollTo(0,0); } else { this.setState(x=>({wizStep:x.wizStep+1})); } },
      wizBack:()=>{ this.setState(x=>({wizStep: Math.max(0, x.wizStep-1)})); },
      wizSkip:()=>{ if(this.state.wizStep>=4){ this.setState({screen:'rsvpmoment'}); if(typeof window!=='undefined') window.scrollTo(0,0); } else { this.setState(x=>({wizStep:x.wizStep+1})); } },
      setWizArtQuery:(e)=>this.setState({wizArtQuery:e.target.value}),
      rmGoing:()=>{ if(rmEv) this.toggleRsvp(rmEv.id,'going'); this.setState({screen:'discover'}); if(typeof window!=='undefined') window.scrollTo(0,0); this.flash(rmEv ? ('You\u2019re going to '+rmEv.title.split(' \u2014 ')[0]+' \u2014 welcome to Drop') : 'Welcome to Drop'); },
      rmSkip:()=>{ this.setState({screen:'discover'}); if(typeof window!=='undefined') window.scrollTo(0,0); },
      toastPhoto:()=>this.flash('Photo uploaded'),
      toastLoc:()=>this.flash('Using your current location'),
      toastSc:()=>this.flash('SoundCloud connect — coming soon'),

      // profile / settings
      goProfile:(e)=>{ this.prevent(e); this.go('profile'); },
      goEditProfile:(e)=>{ this.prevent(e); this.go('editprofile'); },
      goSettings:(e)=>{ this.prevent(e); this.go('settings'); },
      goBlocked:(e)=>{ this.prevent(e); this.go('blocked'); },
      goDelete:(e)=>{ this.prevent(e); this.go('delete'); },
      goNotifications:(e)=>{ this.prevent(e); this.go('notifications'); },
      saveProfile:()=>{
        if (supa && this.state.userId) {
          const uid = this.state.userId;
          const name = fieldVal('edit-name').trim();
          const uname = cleanUsername(fieldVal('edit-username'));
          const bioEl = document.getElementById('edit-bio');
          const bio = bioEl ? bioEl.value.trim() : '';
          const cityState = fieldVal('edit-city').trim();
          const parts = cityState.split(',');
          const city = (parts[0]||'').trim(), state_ = (parts[1]||'').trim();
          supa.from('profiles').update({ display_name: name || null, username: uname || null, bio, city, state: state_ }).eq('id', uid).then(({error})=>{
            if (error) { this.flash('Could not save — ' + error.message); return; }
            this.loadProfile(uid);
            this.go('profile'); this.flash('Profile saved');
          });
          return;
        }
        this.go('profile'); this.flash('Profile saved');
      },
      toastWrapped:(e)=>{ this.prevent&&this.prevent(e); this.go('wrapped'); },
      markAllRead:()=>{ const all={}; this.NOTIFS.forEach(n=>all[n.id]=true); this.setState({notifRead:all}); this.flash('All caught up'); },
      clearNotifs:()=>{ this.setState({notifCleared:true}); this.flash('Notifications cleared'); },
      toggleRecap:()=>this.setState(x=>({recapPrivacy:!x.recapPrivacy})),
      doLogout:()=>{ this.logout(); this.go('home'); },
      setDeleteConfirm:(e)=>this.setState({deleteConfirm:e.target.value}),
      // ponytail: real account-row deletion needs a service-role edge
      // function (can't run client-side with the anon key) — not built this
      // phase. This signs the session out for real; the account itself is
      // NOT actually deleted. Flag as unverified/mock in the Phase-1 report.
      confirmDelete:()=>{ if(this.state.deleteConfirm.trim().toUpperCase()==='DELETE'){ this.logout(); this.setState({deleteConfirm:''}); this.go('home'); this.flash('Account deleted'); } },
    };
  }
}

  // ---------------------------------------------------------------------
  // Boot: instantiate the design's Component, compile the markup once from
  // the inert <template>, and re-render into #app on every setState.
  // ---------------------------------------------------------------------
  function boot() {
    const tplEl = document.getElementById('dc-template');
    const container = document.getElementById('app');
    if (!tplEl || !container) {
      console.error('[app] missing #dc-template or #app in index.html');
      return;
    }
    const render = compileTemplate(tplEl.innerHTML);
    const instance = new Component({});
    let pending = false;
    scheduleRender = () => {
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        mount(container, render, instance.renderVals());
        wireGenreRail();
      });
    };
    mount(container, render, instance.renderVals());
    wireGenreRail();

    // PHASE 1: real events + session check, run once after first mount.
    // A Supabase password-reset email lands back here with
    // ?mode=reset-password (detectSessionInUrl already consumed the token) —
    // route straight to the "choose a new password" screen instead of Home.
    instance.loadEvents();
    if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('mode') === 'reset-password') {
      instance.setState({ screen: 'reset' });
    }
    if (typeof location !== 'undefined') {
      // Public-site "Log in / Get started" links land here (?mode=login|signup)
      // now that the old static /account.html shell is retired. afterLogin()
      // hops an already-authed session past these to Discover.
      const mode = new URLSearchParams(location.search).get('mode');
      if (mode === 'login') instance.setState({ screen: 'login' });
      if (mode === 'signup') instance.setState({ screen: 'signup' });
      const claimId = new URLSearchParams(location.search).get('claim');
      if (claimId) instance.setState({ pendingClaimArtistId: claimId });
      // Public-site "suggest an event" deep link → the suggest screen once the
      // session settles (afterLogin below; writes there are auth-gated anyway).
      if (new URLSearchParams(location.search).get('suggest') === '1') instance.setState({ screen: 'suggest' });
      // Public event pages link festival schedules directly. `festival=1`
      // selects the next published festival; a UUID opens that exact edition.
      const festivalId = new URLSearchParams(location.search).get('festival');
      if (festivalId) instance.openFestival(festivalId === '1' ? null : festivalId);
    }
    if (supa) {
      instance.afterLogin(); // checks for an existing/just-confirmed session
      supa.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
          if (instance._festivalWrites) instance._festivalWrites.clear();
          instance.setState({ authed:false, userId:null, profile:null, stars:{}, festTab:'All' });
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
