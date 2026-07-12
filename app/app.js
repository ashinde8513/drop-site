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
  const EVENT_MAP = { onclick: 'click', onchange: 'change', oninput: 'input', onfocus: 'focus', onblur: 'blur', onsubmit: 'submit' };

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
    var from = new Date(now); from.setHours(0, 0, 0, 0);
    var to;
    if (dchip === 'today') { to = new Date(from); to.setHours(23, 59, 59, 999); }
    else if (dchip === 'weekend') {
      var toFri = (5 - now.getDay() + 7) % 7;
      var fri = new Date(from); fri.setDate(fri.getDate() + toFri);
      to = new Date(fri); to.setDate(to.getDate() + 2); to.setHours(23, 59, 59, 999);
    } else { to = new Date(from); to.setDate(to.getDate() + 30); to.setHours(23, 59, 59, 999); }
    return { from: from.toISOString(), to: to.toISOString() };
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
      grad: gradFor(ev.id),
      friends: 0,
      goingCount: '—', interestedCount: '—',
      presaleLive: false, presaleCode: '', onsale: ev.status === 'published' ? 'On sale now' : 'Not yet on sale',
      lineup: artists.map(function (a) { return a.name; }),
      lineupArtists: artists, // [{id,name,genres,image_url}] — real artist ids, used to wire follow writes
      city: ev.city || '',
    };
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
    following: { 'ODESZA':true }, followingVenue: {},
    myTab: 'Upcoming', ratings: {},
    gate: false, gateReturn: null, gateTitle: 'Join the crew',
    rsvp: {}, saved: {},
    dtab: 'Happening', dchip: 'weekend',
    city: 'Denver, CO', cityOpen: false, menuOpen: false,
    username: '', descClamped: true, toast: null,
    genre: null,
    // search
    query: '', distance: '25', priceMin: 20, priceMax: 120, sGenres: {}, searchGeo: 'idle',
    // festival
    festTab: 'All', stars: { 'main-2':true },
    // activation wizard
    wizStep: 0, wizGenres: {}, wizFriendSel: {}, wizArtistSel: {}, wizArtQuery: '',
    // settings
    setToggles: { reminders: true, sales: true, comments: false, plans: true },
    recapPrivacy: true, deleteConfirm: '',
    // notifications (unread ids)
    notifRead: {},
    // pick artists / venues / crew / plans / wrapped
    artGenre: 'All', followArt: { 'ODESZA':true, 'Lane 8':true }, followVen: {},
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
    tasteArtists: ['ODESZA','Lane 8','FISHER'], tasteQuery: '', tasteImport: false,
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
    // legal
    legalDoc: 'privacy',
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

  EVENTS = [
    { genre:'Melodic', id:'odesza', title:'ODESZA — The Last Goodbye', venue:'Red Rocks Amphitheatre', venueCity:'Red Rocks Amphitheatre · Morrison, CO', dateShort:'FRI, JUN 20 · 7:00 PM', dateLong:'Fri, Jun 20 · 7:00 PM', price:'$45+', friends:3, grad:'linear-gradient(120deg,#2b1c4d,#0d3b52 55%,#143a22)', goingCount:'1.2k', interestedCount:'3.4k', presaleLive:true, presaleCode:'ODZA2026', onsale:'On sale now · presale live', lineup:['ODESZA','Elderbrook','Yeah Yeah Yeahs'] },
    { genre:'Dubstep', id:'subtronics', title:'Subtronics — Cyclops Army', venue:'Mission Ballroom', venueCity:'Mission Ballroom · Denver, CO', dateShort:'SAT, JUL 12 · 9:00 PM', dateLong:'Sat, Jul 12 · 9:00 PM', price:'$62 all-in', friends:0, grad:'linear-gradient(120deg,#4d1c37,#52270d 55%,#22143a)', goingCount:'860', interestedCount:'2.1k', presaleLive:false, onsale:'On sale now', lineup:['Subtronics','Peekaboo','ISOxo'] },
    { genre:'Melodic', id:'lane8', title:'Lane 8 — This Never Happened', venue:'The Gothic Theatre', venueCity:'The Gothic Theatre · Englewood, CO', dateShort:'THU, AUG 7 · TIME TBA', dateLong:'Thu, Aug 7 · Time TBA', price:'$40+', friends:1, grad:'linear-gradient(120deg,#1c384d,#3b0d52 55%,#3a2b14)', goingCount:'540', interestedCount:'1.3k', presaleLive:false, onsale:'On sale now', lineup:['Lane 8','Sultan + Shepard','Jerro'] },
    { genre:'House', id:'fisher', title:'FISHER — Hi Fisher', venue:'Ball Arena', venueCity:'Ball Arena · Denver, CO', dateShort:'SAT, SEP 6 · 8:00 PM', dateLong:'Sat, Sep 6 · 8:00 PM', price:'$78+', friends:5, grad:'linear-gradient(120deg,#3a1c4d,#0d5250 55%,#3a1414)', goingCount:'2.0k', interestedCount:'4.8k', presaleLive:false, onsale:'On sale now', lineup:['FISHER','Chris Lake','Cloonee'] },
    { genre:'Melodic', id:'rufus', title:'RÜFÜS DU SOL', venue:'Red Rocks Amphitheatre', venueCity:'Red Rocks Amphitheatre · Morrison, CO', dateShort:'SUN, JUN 29 · 6:30 PM', dateLong:'Sun, Jun 29 · 6:30 PM', price:'$85+', friends:2, grad:'linear-gradient(120deg,#1c274d,#520d47 55%,#143a3a)', goingCount:'1.7k', interestedCount:'3.9k', presaleLive:false, onsale:'On sale now', lineup:['RÜFÜS DU SOL','Bob Moses'] },
    { genre:'Bass', id:'skrillex', title:'Skrillex', venue:'Mission Ballroom', venueCity:'Mission Ballroom · Denver, CO', dateShort:'FRI, OCT 3 · 9:00 PM', dateLong:'Fri, Oct 3 · 9:00 PM', price:'$70+', friends:0, grad:'linear-gradient(120deg,#4d3a1c,#0d2f52 55%,#3a1436)', goingCount:'1.1k', interestedCount:'5.2k', presaleLive:false, onsale:'On sale now', lineup:['Skrillex','Fred again..','Four Tet'] },
    { genre:'House', id:'disclosure', title:'Disclosure', venue:'Mission Ballroom', venueCity:'Mission Ballroom · Denver, CO', dateShort:'SAT, NOV 1 · 8:30 PM', dateLong:'Sat, Nov 1 · 8:30 PM', price:'$65+', friends:4, grad:'linear-gradient(120deg,#1c4d3a,#52270d 55%,#2b143a)', goingCount:'930', interestedCount:'2.6k', presaleLive:true, presaleCode:'CARACAL', onsale:'Presale live · on sale Fri', lineup:['Disclosure','Eli Brown'] },
    { genre:'House', id:'peggygou', title:'Peggy Gou', venue:'The Church', venueCity:'The Church · Denver, CO', dateShort:'THU, SEP 18 · 10:00 PM', dateLong:'Thu, Sep 18 · 10:00 PM', price:'$40+', friends:0, grad:'linear-gradient(120deg,#4d1c4a,#0d3b52 55%,#3a3014)', goingCount:'410', interestedCount:'1.1k', presaleLive:false, onsale:'On sale now', lineup:['Peggy Gou','DJ Tennis'] },
  ];

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

  CREW = [
    { name:'Maya', ring:'var(--going)' }, { name:'Devon', ring:'var(--interested)' },
    { name:'Priya', ring:'var(--attended)' }, { name:'Kai', ring:'var(--going)' },
    { name:'Sam', ring:'var(--interested)' }, { name:'Jules', ring:'var(--attended)' },
  ];

  COMMENTS = [
    { name:'ravewithmaya', time:'2d', text:'Red Rocks + ODESZA is a bucket-list combo. Who\u2019s carpooling from Denver?' },
    { name:'bass_devon', time:'5d', text:'Presale code worked, snagged GA. See everyone there!' },
  ];

  FEST_STAGES = [
    { id:'main', name:'Main Stage', color:'var(--going)', sets:[
      { id:'main-0', time:'6:00 – 7:00', artist:'Elderbrook', friends:0 },
      { id:'main-1', time:'7:15 – 8:30', artist:'Lane 8', friends:2 },
      { id:'main-2', time:'8:45 – 10:15', artist:'ODESZA', friends:3 },
      { id:'main-3', time:'10:30 – 12:00', artist:'RÜFÜS DU SOL', friends:1 },
    ]},
    { id:'bass', name:'Bass Cathedral', color:'var(--interested)', sets:[
      { id:'bass-0', time:'6:30 – 7:30', artist:'ISOxo', friends:0 },
      { id:'bass-1', time:'8:00 – 9:15', artist:'Subtronics', friends:1 },
      { id:'bass-2', time:'9:30 – 11:00', artist:'Skrillex', friends:2, clashWith:'ODESZA' },
    ]},
    { id:'house', name:'Warehouse', color:'var(--attended)', sets:[
      { id:'house-0', time:'7:00 – 8:15', artist:'Peggy Gou', friends:0 },
      { id:'house-1', time:'8:30 – 10:00', artist:'FISHER', friends:4 },
      { id:'house-2', time:'10:15 – 11:45', artist:'Disclosure', friends:2 },
    ]},
  ];

  WIZ_FRIENDS = [
    { id:'maya', name:'Maya Chen', sub:'@ravewithmaya · 3 shared artists' },
    { id:'devon', name:'Devon Brooks', sub:'@bass_devon · 5 shared artists' },
    { id:'priya', name:'Priya Nair', sub:'@priyabeats · 2 shared artists' },
    { id:'kai', name:'Kai Tanaka', sub:'@kai_after_dark · 4 shared artists' },
  ];

  WIZ_ARTISTS = ['ODESZA','Lane 8','Skrillex','FISHER','Peggy Gou','Disclosure','Subtronics','RÜFÜS DU SOL','Four Tet'];

  ARTISTS_ALL = [
    { name:'ODESZA', genre:'Melodic', followers:'1.2M', upcoming:true },
    { name:'RÜFÜS DU SOL', genre:'Melodic', followers:'980K', upcoming:true },
    { name:'Lane 8', genre:'Melodic', followers:'640K', upcoming:true },
    { name:'Tycho', genre:'Melodic', followers:'410K', upcoming:false },
    { name:'FISHER', genre:'House', followers:'980K', upcoming:true },
    { name:'Chris Lake', genre:'House', followers:'720K', upcoming:true },
    { name:'Peggy Gou', genre:'House', followers:'1.1M', upcoming:true },
    { name:'John Summit', genre:'House', followers:'890K', upcoming:false },
    { name:'Skrillex', genre:'Bass', followers:'4.8M', upcoming:true },
    { name:'Subtronics', genre:'Bass', followers:'760K', upcoming:true },
    { name:'ISOxo', genre:'Bass', followers:'320K', upcoming:false },
    { name:'Charlotte de Witte', genre:'Techno', followers:'1.4M', upcoming:false },
    { name:'Amelie Lens', genre:'Techno', followers:'980K', upcoming:false },
    { name:'Adam Beyer', genre:'Techno', followers:'540K', upcoming:false },
    { name:'Above & Beyond', genre:'Trance', followers:'2.1M', upcoming:true },
    { name:'Ilan Bluestone', genre:'Trance', followers:'280K', upcoming:false },
    { name:'Disclosure', genre:'House', followers:'3.2M', upcoming:true },
    { name:'Four Tet', genre:'Melodic', followers:'890K', upcoming:true },
  ];

  VENUES_ALL = [
    { name:'Red Rocks Amphitheatre', state:'Colorado', city:'Morrison', capacity:'9,525', inDrop:true },
    { name:'Mission Ballroom', state:'Colorado', city:'Denver', capacity:'3,950', inDrop:true },
    { name:'Ball Arena', state:'Colorado', city:'Denver', capacity:'19,520', inDrop:true },
    { name:'The Gothic Theatre', state:'Colorado', city:'Englewood', capacity:'1,100', inDrop:false },
    { name:'The Church', state:'Colorado', city:'Denver', capacity:'1,200', inDrop:false },
    { name:'Hollywood Palladium', state:'California', city:'Los Angeles', capacity:'3,700', inDrop:true },
    { name:'Shrine Expo Hall', state:'California', city:'Los Angeles', capacity:'6,300', inDrop:true },
    { name:'Bill Graham Civic', state:'California', city:'San Francisco', capacity:'8,500', inDrop:false },
    { name:'Brooklyn Mirage', state:'New York', city:'Brooklyn', capacity:'6,000', inDrop:true },
    { name:'Terminal 5', state:'New York', city:'New York', capacity:'3,000', inDrop:true },
    { name:'Brooklyn Steel', state:'New York', city:'Brooklyn', capacity:'1,800', inDrop:false },
  ];

  FRIENDS = [
    { id:'maya', name:'Maya Chen', handle:'@ravewithmaya', overlap:['ODESZA','Lane 8','Four Tet'], ring:'var(--going)', status:'going' },
    { id:'devon', name:'Devon Brooks', handle:'@bass_devon', overlap:['Skrillex','Subtronics'], ring:'var(--interested)', status:'interested' },
    { id:'priya', name:'Priya Nair', handle:'@priyabeats', overlap:['Peggy Gou','Disclosure','FISHER','John Summit'], ring:'var(--attended)', status:'going' },
    { id:'kai', name:'Kai Tanaka', handle:'@kai_after_dark', overlap:['RÜFÜS DU SOL','Tycho'], ring:'var(--going)', status:'going' },
  ];
  REQUESTS = [
    { id:'sam', name:'Sam Okafor', handle:'@samsound', overlap:['ODESZA','Disclosure'] },
    { id:'jules', name:'Jules Rivera', handle:'@julesbeats', overlap:['Charlotte de Witte','Amelie Lens','Skrillex'] },
  ];
  FIND_PEOPLE = [
    { id:'ren', name:'Ren Alvarez', handle:'@ren_raves', overlap:['ODESZA','FISHER','Lane 8'], mutuals:'3 mutuals' },
    { id:'noa', name:'Noa Feld', handle:'@noafeld', overlap:['Skrillex','Subtronics','ISOxo'], mutuals:'1 mutual' },
    { id:'theo', name:'Theo Park', handle:'@theopark', overlap:['Peggy Gou','Four Tet'], mutuals:'5 mutuals' },
  ];

  PLANS = [
    { id:'p-odesza', eventId:'odesza', roster:[
      { name:'Alex (you)', status:'going', ring:'var(--going)' },
      { name:'Maya', status:'going', ring:'var(--going)' },
      { name:'Kai', status:'going', ring:'var(--going)' },
      { name:'Priya', status:'interested', ring:'var(--interested)' },
      { name:'Devon', status:'invited', ring:'var(--border-strong)' },
    ], spots:['Meet at the north lot','Pre-drinks at Maya’s','Rideshare from RiNo'], chat:[
      { who:'Maya', color:'var(--going)', text:'Got 4 GA tickets in the same section 🎉', time:'2d' },
      { who:'Kai', color:'var(--going)', text:'I can drive, 3 spots in my car', time:'2d' },
      { who:'You', color:'var(--accent)', text:'Amazing — north lot works for me', time:'1d', me:true },
    ]},
    { id:'p-fisher', eventId:'fisher', roster:[
      { name:'Alex (you)', status:'going', ring:'var(--going)' },
      { name:'Priya', status:'going', ring:'var(--going)' },
      { name:'Sam', status:'interested', ring:'var(--interested)' },
    ], spots:['Meet at will-call','Dinner in LoDo first'], chat:[
      { who:'Priya', color:'var(--going)', text:'Who’s in for dinner beforehand?', time:'4d' },
    ]},
  ];

  LEDGER = [
    { id:'l1', label:'Referral — Ren joined Drop', date:'Jul 2', amount:'+1 month', state:'confirmed' },
    { id:'l2', label:'Ticket cashback — FISHER', date:'Jun 28', amount:'+1 week', state:'pending' },
    { id:'l3', label:'Referral — Noa joined Drop', date:'Jun 21', amount:'+1 month', state:'review' },
    { id:'l4', label:'Ticket cashback — ODESZA', date:'Jun 20', amount:'+3 days', state:'confirmed' },
    { id:'l5', label:'Referral bonus — Theo', date:'Jun 10', amount:'+1 month', state:'reversed' },
  ];
  LEDGER_STATES = {
    confirmed: { label:'Confirmed', color:'var(--attended)', bg:'rgba(182,255,106,0.12)' },
    pending:   { label:'Pending', color:'var(--gold)', bg:'rgba(255,203,61,0.12)' },
    review:    { label:'Under review', color:'var(--interested)', bg:'rgba(77,226,255,0.12)' },
    reversed:  { label:'Reversed', color:'var(--danger)', bg:'rgba(255,92,114,0.12)' },
  };

  TAGGED = [
    { id:'t1', who:'Maya', show:'ODESZA — The Last Goodbye', date:'Jun 20', grad:'linear-gradient(120deg,#2b1c4d,#0d3b52 55%,#143a22)' },
    { id:'t2', who:'Priya', show:'FISHER — Hi Fisher', date:'Sep 6', grad:'linear-gradient(120deg,#3a1c4d,#0d5250 55%,#3a1414)' },
    { id:'t3', who:'Kai', show:'RÜFÜS DU SOL', date:'Jun 29', grad:'linear-gradient(120deg,#1c274d,#520d47 55%,#143a3a)' },
  ];

  SUBMISSIONS = [
    { id:'sub1', title:'Fred again.. — Actual Life', venue:'Mission Ballroom · Denver', date:'Oct 4', status:'live' },
    { id:'sub2', title:'Barry Can\u2019t Swim', venue:'The Gothic · Englewood', date:'Sep 12', status:'review' },
    { id:'sub3', title:'Local B2B night', venue:'Larimer Lounge · Denver', date:'Aug 2', status:'rejected' },
  ];
  SUB_STATUS = {
    live:     { label:'Live', color:'var(--attended)', bg:'rgba(182,255,106,0.12)' },
    review:   { label:'In review', color:'var(--gold)', bg:'rgba(255,203,61,0.12)' },
    rejected: { label:'Not added', color:'var(--text-muted)', bg:'var(--surface-hi)' },
  };

  PROMO_EVENTS = [
    { id:'pe1', title:'ODESZA — The Last Goodbye', date:'Fri, Jun 20 · Red Rocks', status:'live', views:'12,840', going:342, redeem:88, grad:'linear-gradient(120deg,#2b1c4d,#0d3b52 55%,#143a22)' },
    { id:'pe2', title:'Lane 8 — Massive Sound', date:'Sat, Aug 16 · Mission Ballroom', status:'live', views:'6,210', going:180, redeem:41, grad:'linear-gradient(120deg,#1c384d,#3b0d52 55%,#3a2b14)' },
    { id:'pe3', title:'Warehouse: Techno All-Nighter', date:'Sat, Sep 6 · The Church', status:'draft', views:'—', going:0, redeem:0, grad:'linear-gradient(120deg,#4d1c4a,#0d3b52 55%,#3a3014)' },
  ];
  GUESTS = [
    { id:'g1', name:'Maya Alvarez', plus:2 },
    { id:'g2', name:'Devon Brooks', plus:0 },
    { id:'g3', name:'Priya Shah', plus:1 },
    { id:'g4', name:'Kai Nakamura', plus:3 },
    { id:'g5', name:'Sam Ellis', plus:0 },
  ];
  CODES = [
    { id:'c1', code:'ODESZA10', desc:'10% off · presale', used:88, cap:200 },
    { id:'c2', code:'RRXLANE8', desc:'Early access · GA', used:41, cap:100 },
  ];
  REVIEW_QUEUE = [
    { id:'rq1', title:'Fred again.. — Actual Life', date:'Oct 4 · Mission Ballroom · Denver', by:'@bass_devon', trust:'Trusted scout · 6 approved', link:'axs.com/frd-den' },
    { id:'rq2', title:'Barry Can\u2019t Swim', date:'Sep 12 · The Gothic · Englewood', by:'@lunar_maya', trust:'New · 0 approved', link:'dice.fm/barry' },
    { id:'rq3', title:'Denver Techno Collective B2B', date:'Aug 2 · Larimer Lounge · Denver', by:'@kai_nk', trust:'Trusted scout · 3 approved', link:'ra.co/dtc' },
    { id:'rq4', title:'Sunset Rooftop: Deep House', date:'Jul 27 · The Nest · Denver', by:'@priya_s', trust:'New · 1 approved', link:'eventbrite.com/nest' },
  ];
  REPORTS = [
    { id:'rp1', kind:'Comment', excerpt:'"this lineup is trash, promoter is a scam\u2026"', ctx:'on Subtronics — Cyclops Army', by:'@anon_4821', reason:'Harassment' },
    { id:'rp2', kind:'Review', excerpt:'"buy followers here cheap \u2192 spammy-link.co"', ctx:'on Red Rocks Amphitheatre', by:'@promo_bot', reason:'Spam' },
    { id:'rp3', kind:'Comment', excerpt:'"met my whole crew in the GA line, best night"', ctx:'on ODESZA — The Last Goodbye', by:'@festhead', reason:'Mis-flag' },
  ];
  ADMIN_SIGNUPS = [42,58,51,77,63,90,84,112,96,131,148,122,167,190];
  ADMIN_TOP_EVENTS = [
    { title:'ODESZA — The Last Goodbye', views:'12.8K', going:342, conv:'2.7%' },
    { title:'Subtronics — Cyclops Army', views:'9.4K', going:288, conv:'3.1%' },
    { title:'Lane 8 — Massive Sound', views:'6.2K', going:180, conv:'2.9%' },
    { title:'Disclosure — Alive Tour', views:'5.1K', going:141, conv:'2.8%' },
    { title:'FISHER — Hi Fisher', views:'4.7K', going:126, conv:'2.7%' },
  ];
  ADMIN_ACTIONS = [
    { label:'RSVPs', value:'18,402' },
    { label:'Shows saved', value:'31,209' },
    { label:'Plans created', value:'2,884' },
    { label:'Recaps shared', value:'6,517' },
    { label:'Codes redeemed', value:'4,120' },
    { label:'Events suggested', value:'913' },
  ];

  SEEN_HISTORY = [
    { id:'s1', year:'2026', shows:[
      { title:'ODESZA — The Last Goodbye', venue:'Red Rocks · Morrison', date:'Jun 20', badge:'3rd time', grad:'linear-gradient(120deg,#2b1c4d,#0d3b52 55%,#143a22)' },      { title:'FISHER — Hi Fisher', venue:'Ball Arena · Denver', date:'Mar 8', badge:null, grad:'linear-gradient(120deg,#3a1c4d,#0d5250 55%,#3a1414)' },
    ]},
    { id:'s2', year:'2025', shows:[
      { title:'Lane 8 — Brightest Lights', venue:'Mission Ballroom · Denver', date:'Nov 14', badge:'Superfan', grad:'linear-gradient(120deg,#1c384d,#3b0d52 55%,#3a2b14)' },
      { title:'Flume', venue:'Red Rocks · Morrison', date:'Sep 21', badge:null, grad:'linear-gradient(120deg,#2b1c4d,#0d3b52 55%,#143a22)' },
      { title:'CloZee', venue:'The Gothic · Englewood', date:'Jan 30', badge:'1st time', grad:'linear-gradient(120deg,#4d3a1c,#0d2f52 55%,#3a1436)' },
    ]},
  ];

  NOTIFS = [
    { id:'n1', icon:'🎫', title:'Subtronics', body:'just announced a Denver date — presale Friday.', time:'12m ago' },
    { id:'n2', icon:'👥', title:'Maya', body:'is going to ODESZA at Red Rocks.', time:'1h ago' },
    { id:'n3', icon:'💬', title:'bass_devon', body:'replied to your comment on Disclosure.', time:'3h ago' },
    { id:'n4', icon:'⏰', title:'Reminder', body:'Lane 8 tickets go on sale tomorrow at 10 AM.', time:'6h ago' },
    { id:'n5', icon:'🎉', title:'Kai', body:'invited you to a plan for FISHER at Ball Arena.', time:'1d ago' },
    { id:'n6', icon:'⭐', title:'Priya', body:'reacted to your Skrillex recap.', time:'2d ago' },
  ];

  BLOCKED = [
    { id:'b1', name:'ticket_flipper_99', handle:'@ticket_flipper_99' },
  ];

  ARTIST_META = {
    'ODESZA': { genre:'Melodic Bass · Electronic', followers:'1.2M', hometown:'Seattle, WA', bio:'Harrison Mills and Clayton Knight built a stadium-scale live show out of intricate, emotional electronic music. The Last Goodbye tour pairs a live drumline and horn section with their signature wall of sound.' },
    'Lane 8': { genre:'Melodic House · Deep House', followers:'640K', hometown:'Los Angeles, CA', bio:'Daniel Goldstein\u2019s This Never Happened project turned phones-away, all-melodic sets into a movement. Warm, hypnotic, and built for the long build.' },
    'Skrillex': { genre:'Dubstep · Bass', followers:'4.8M', hometown:'Los Angeles, CA', bio:'The artist who dragged dubstep into the mainstream, still one of the most restless names in bass music \u2014 genre-hopping sets that never sit still.' },
    'FISHER': { genre:'Tech House', followers:'980K', hometown:'Byron Bay, AU', bio:'Ex-pro surfer turned tech-house hitmaker. Loud, sweaty, relentlessly fun warehouse energy wherever he lands.' },
  };
  ARTIST_GRADS = ['linear-gradient(120deg,#2b1c4d,#0d3b52 55%,#143a22)','linear-gradient(120deg,#4d1c37,#52270d 55%,#22143a)','linear-gradient(120deg,#1c384d,#3b0d52 55%,#3a2b14)','linear-gradient(120deg,#3a1c4d,#0d5250 55%,#3a1414)'];

  VENUE_META = {
    'Red Rocks Amphitheatre': { location:'Morrison, CO', capacity:'9,525', rating:'4.9', reviews:'2,140', grad:'linear-gradient(120deg,#2b1c4d,#0d3b52 55%,#143a22)', about:'A natural amphitheatre carved between two 300-foot sandstone monoliths. Widely considered the best outdoor venue on the planet \u2014 bring layers, the mountain air turns cold after dark.' },
    'Mission Ballroom': { location:'Denver, CO', capacity:'3,950', rating:'4.7', reviews:'1,020', grad:'linear-gradient(120deg,#4d1c37,#52270d 55%,#22143a)', about:'A modern, movable-floor room in RiNo with one of the best sound systems in the country. Sightlines are great from anywhere.' },
    'Ball Arena': { location:'Denver, CO', capacity:'19,520', rating:'4.3', reviews:'860', grad:'linear-gradient(120deg,#3a1c4d,#0d5250 55%,#3a1414)', about:'Downtown arena for the biggest touring productions. GA floor for dance shows, seated bowl around it.' },
    'The Gothic Theatre': { location:'Englewood, CO', capacity:'1,100', rating:'4.6', reviews:'540', grad:'linear-gradient(120deg,#1c384d,#3b0d52 55%,#3a2b14)', about:'Intimate historic theatre on South Broadway. Art-deco bones, loud system, close to the stage no matter where you stand.' },
    'The Church': { location:'Denver, CO', capacity:'1,200', rating:'4.2', reviews:'410', grad:'linear-gradient(120deg,#4d1c4a,#0d3b52 55%,#3a3014)', about:'A converted 19th-century cathedral with three floors and multiple rooms. Late-night techno and house home base.' },
  };

  PAST_SHOWS = [
    { id:'p1', title:'Fred again.. — Actual Life', venueCity:'Mission Ballroom · Denver, CO', dateShort:'FRI, MAR 14', genre:'House', grad:'linear-gradient(120deg,#1c274d,#520d47 55%,#143a3a)' },
    { id:'p2', title:'Flume', venueCity:'Red Rocks Amphitheatre · Morrison, CO', dateShort:'SAT, SEP 21', genre:'Melodic', grad:'linear-gradient(120deg,#2b1c4d,#0d3b52 55%,#143a22)' },
    { id:'p3', title:'CloZee', venueCity:'The Gothic Theatre · Englewood, CO', dateShort:'THU, JAN 30', genre:'Bass', grad:'linear-gradient(120deg,#4d3a1c,#0d2f52 55%,#3a1436)' },
  ];

  go(s){
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
  loadEvents(){
    this.setState({ eventsLoading:true, eventsError:null });
    if (!Drop) { this.setState({ eventsLoading:false, eventsError:'Event catalog unavailable.' }); return; }
    const cityName = (this.state.city || '').split(',')[0].trim();
    const win = dateWindow(this.state.dchip);
    Drop.fetchEvents({ city: cityName || undefined, from: win.from, to: win.to, limit: 48 })
      .then(rows=>this.setState({ realEvents: rows || [], eventsLoading:false }))
      .catch(err=>{ console.error('[app] events fetch failed:', err.message); this.setState({ eventsLoading:false, eventsError:'Could not load shows — try again.' }); });
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
      this.loadProfile(session.user.id);
      this.loadUserData(session.user.id);
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
    const q = supa.from('artists').select('id,name,image_url,merch_url,website_url,claimed_by,verified');
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
    // s.realEvents (Drop.fetchEvents, PostgREST against the `events` table),
    // not the design's mock EVENTS array. this.EVENTS is kept untouched below
    // for the screens that are still explicitly mock (Plans, activation
    // wizard's welcome moment, share cards) and reference its fictional ids.
    const events = (s.realEvents||[]).map(mapRealEvent).map(e=>{
      const st = s.rsvp[e.id];
      return {
        ...e,
        gradStyle: 'background-image:'+e.grad,
        hasFriends: false,
        friendsLabel: '',
        open: (ev)=>{ this.prevent(ev); this.setState({screen:'event', activeId:e.id}); if(typeof window!=='undefined') window.scrollTo(0,0); },
        going: ()=>this.toggleRsvp(e.id,'going'),
        interested: ()=>this.toggleRsvp(e.id,'interested'),
        share: ()=>this.flash('Link copied to clipboard'),
        goingCls: 'wsc__act'+(st==='going'?' is-going':''),
        interestedCls: 'wsc__act'+(st==='interested'?' is-interested':''),
        interestedGlyph: st==='interested'?'★':'☆',
      };
    });
    const ae = events.find(e=>e.id===s.activeId) || events[0] || { ...this.EVENTS[0], lineupArtists:[], city:'' };

    const aeSt = s.rsvp[ae.id];
    const aeSaved = !!s.saved[ae.id];

    const tabList = ['Happening','For You','Crew'].map(t=>({
      label:t, cls: s.dtab===t?'is-active':'', pick:()=>this.setState({dtab:t}),
    }));
    const chipDefs = [['today','Today'],['weekend','This weekend'],['30','Next 30 days']];
    const dateChips = chipDefs.map(([k,label])=>({ label, cls: s.dchip===k?'is-active':'', pick:()=>{ this.setState({dchip:k}); this.loadEvents(); } }));
    const dateChipLabel = ({today:'Today',weekend:'This weekend','30':'Next 30 days'})[s.dchip];

    const cities = ['Denver, CO','Los Angeles, CA','New York, NY','Near me'].map(c=>({
      label:c, pick:()=>{ this.setState({city: c==='Near me'?'Denver, CO':c, cityOpen:false}); this.loadEvents(); },
    }));

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
    const un = s.username.trim().toLowerCase();
    const taken = ['raver','dropfan','maya','admin'];
    let unameIcon='', unameBorder='var(--border)', unameMsg='', unameMsgColor='';
    if(un.length>=3){
      if(taken.includes(un)){ unameIcon='✕'; unameBorder='var(--danger)'; unameMsg='That username is taken'; unameMsgColor='var(--danger)'; }
      else { unameIcon='✓'; unameBorder='var(--attended)'; unameMsg='@'+un+' is available'; unameMsgColor='var(--attended)'; }
    } else if(un.length>0){ unameBorder='var(--border-strong)'; unameMsg='At least 3 characters'; unameMsgColor='var(--text-muted)'; }

    const waveBars = Array.from({length:44}).map((_,i)=>({
      style:'animation-delay:'+(-(i%11)*0.12)+'s;opacity:'+(0.45+0.55*Math.abs(Math.sin(i*0.7))),
    }));

    // Lineup chips carry the real artist id (from event_artists) when the
    // event came from a real fetch, so Artist-page follow can write through
    // to artist_follows; falls back to name-only for the this.EVENTS stub.
    const lineupArtists = ae.lineupArtists || [];
    const lineup = lineupArtists.length
      ? lineupArtists.map((a,i)=>({ name:a.name, headStyle: i===0?'border-color:var(--accent);color:var(--accent);':'', open:()=>this.openArtist(a.name, a.id) }))
      : (ae.lineup||[]).map((name,i)=>({ name, headStyle: i===0?'border-color:var(--accent);color:var(--accent);':'', open:()=>this.openArtist(name, null) }));
    // ponytail: no real seller-comparison feed wired (that's the separate
    // price-comparison project) — these rows are a synthetic estimate off
    // the one real price, same as the original mock. Guarded against events
    // with no price ("See tickets") so it doesn't render "$NaN all-in".
    const aeBasePrice = parseInt((ae.price||'').replace(/\D/g,''), 10);
    const priceRows = isNaN(aeBasePrice) ? [] : [
      { seller:'Drop (AXS)', price:ae.price.replace('+','').replace(' all-in',''), best:true, border:'var(--attended)' },
      { seller:'Ticketmaster', price:'$'+(aeBasePrice+14)+' all-in', best:false, border:'var(--border)' },
      { seller:'StubHub', price:'$'+(aeBasePrice+31)+' all-in', best:false, border:'var(--border)' },
    ];

    // ===== Genre filter (discover) =====
    const genreActive = !!s.genre;
    const discoverSource = genreActive ? events.filter(e=>e.genre===s.genre) : events;
    const genres = this.GENRES.map(g=>({
      name: g.name,
      gradStyle: g.grad,
      tileStyle: g.grad + (s.genre===g.name ? 'box-shadow:0 0 0 2px var(--accent);' : ''),
      pick: (e)=>{ this.prevent(e); this.setState(st=>({ genre: st.genre===g.name ? null : g.name })); },
    }));
    const gridLabel = genreActive ? (s.genre+' shows') : dateChipLabel;
    const gridEmpty = discoverSource.length===0;

    // ===== Search =====
    const q = s.query.trim().toLowerCase();
    const searchEmpty = q.length===0;
    const lo = Math.min(s.priceMin, s.priceMax), hi = Math.max(s.priceMin, s.priceMax);
    const filterPrice = e => { const p = parseInt((e.price||'').replace(/\D/g,''),10); return isNaN(p) || (p >= lo && p <= hi); };
    const filterGenre = e => Object.keys(s.sGenres).filter(k=>s.sGenres[k]).length===0 || s.sGenres[e.genre];
    const matched = events.filter(e =>
      (e.title.toLowerCase().includes(q) || e.venueCity.toLowerCase().includes(q) || e.genre.toLowerCase().includes(q) || e.lineup.join(' ').toLowerCase().includes(q))
      && filterPrice(e) && filterGenre(e));
    const searchResults = matched;
    const searchHasResults = !searchEmpty && matched.length>0;
    const searchNoResults = !searchEmpty && matched.length===0;
    const resultsLabel = matched.length + ' result' + (matched.length===1?'':'s') + ' for "' + s.query + '"';
    const distanceChips = ['10','25','50','100'].map(d=>({ label: d+' mi', cls: s.distance===d?'is-active':'', pick:()=>this.setState({distance:d}) }));
    const searchGeoActive = s.searchGeo==='active';
    const searchGeoPending = s.searchGeo==='pending';
    const searchLocName = searchGeoActive ? 'your location' : s.city;
    const searchLocPillLabel = 'Near me · ' + s.distance + ' mi';
    const searchGeoBtnLabel = searchGeoPending ? 'Locating…' : 'Use my current location';
    const searchLocContext = 'Showing shows within ' + s.distance + ' mi of ' + searchLocName;
    const searchGenreChips = this.GENRES.map(g=>({ label:g.name, cls: s.sGenres[g.name]?'is-active':'', pick:()=>this.setState(st=>({ sGenres:{...st.sGenres, [g.name]: !st.sGenres[g.name]} })) }));
    const trending = ['Melodic','House','Dubstep','Techno','Bass','Trance'];
    const trendingChips = trending.map(t=>({ label:t, pick:()=>this.setState({query:t}) }));
    const recent = ['ODESZA','Red Rocks','Skrillex','Mission Ballroom'];
    const recentSearches = recent.map(r=>({ label:r, pick:()=>this.setState({query:r}) }));
    const typeaheadGroups = searchEmpty ? [] : [
      { label:'Events', items: matched.slice(0,3).map(e=>({ icon:'♪', label:e.title, pick:()=>{ this.setState({screen:'event', activeId:e.id, query:''}); if(typeof window!=='undefined') window.scrollTo(0,0); } })) },
      { label:'Genres', items: this.GENRES.filter(g=>g.name.toLowerCase().includes(q)).map(g=>({ icon:'◆', label:g.name+' shows', pick:()=>this.setState({query:g.name}) })) },
      { label:'Artists', items: this.ARTISTS_ALL.filter(a=>a.name.toLowerCase().includes(q)).slice(0,3).map(a=>({ icon:'♪', label:a.name, pick:()=>{ this.setState({query:''}); this.openArtist(a.name, null); } })) },
    ].filter(grp=>grp.items.length>0);
    const typeaheadOpen = !searchEmpty && typeaheadGroups.length>0;

    // ===== Festival =====
    const festTabs = ['All','My schedule','Friends'].map(t=>({ label:t, cls: s.festTab===t?'is-active':'', pick:()=>this.setState({festTab:t}) }));
    const starredSets = Object.keys(s.stars).filter(k=>s.stars[k]);
    // clash detection: any two starred sets that overlap (hardcoded conflict pair)
    const clashPairs = [['main-2','bass-2']];
    const clashIds = new Set();
    clashPairs.forEach(([a,b])=>{ if(s.stars[a]&&s.stars[b]){ clashIds.add(a); clashIds.add(b); } });
    const festClashBanner = clashIds.size>0 ? 'ODESZA and Skrillex overlap in your schedule (8:45 vs 9:30).' : null;
    const stages = this.FEST_STAGES.map(st=>({
      name: st.name,
      accent: 'background:'+st.color+';',
      sets: st.sets
        .filter(se=> s.festTab==='All' ? true : s.festTab==='My schedule' ? s.stars[se.id] : se.friends>0)
        .map(se=>{
          const on = !!s.stars[se.id];
          const clash = clashIds.has(se.id);
          return {
            time: se.time, artist: se.artist,
            border: clash ? 'var(--danger)' : (on ? 'var(--gold)' : 'var(--border)'),
            clash, clashMsg: clash ? 'Clashes with '+(se.clashWith||'ODESZA') : '',
            hasFriends: se.friends>0, friendsLabel: fl(se.friends)+' going',
            starGlyph: on?'★':'☆',
            starBg: on?'rgba(255,203,61,0.15)':'var(--glass)',
            starBorder: on?'var(--gold)':'var(--glass-border)',
            starColor: on?'var(--gold)':'var(--text-muted)',
            star: ()=>{ if(!this.state.authed){ this.openGate('Log in to build your schedule'); return; } this.setState(x=>({ stars:{...x.stars, [se.id]: !x.stars[se.id]} })); },
          };
        }),
    })).filter(st=>st.sets.length>0);

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
    const wizArtists = this.WIZ_ARTISTS.map(a=>{ const on=!!s.wizArtistSel[a]; return { name:a, border: on?'var(--accent)':'var(--border)', color: on?'var(--accent)':'var(--text-muted)', label: on?'Following':'Follow', toggle:()=>this.setState(x=>({ wizArtistSel:{...x.wizArtistSel, [a]: !x.wizArtistSel[a]} })) }; });
    const wizNextLabel = s.wizStep>=4 ? 'Finish — go to Discover' : 'Continue';
    // manual artist typeahead (vibes step)
    const artQ = s.wizArtQuery.trim().toLowerCase();
    const wizArtMatches = artQ.length>0 ? this.WIZ_ARTISTS
      .filter(a=>a.toLowerCase().includes(artQ) && !s.wizArtistSel[a])
      .slice(0,5)
      .map(a=>({ name:a, add:()=>this.setState(x=>({ wizArtistSel:{...x.wizArtistSel, [a]:true}, wizArtQuery:'' })) })) : [];
    const wizArtOpen = artQ.length>0 && wizArtMatches.length>0;
    const wizArtChosen = this.WIZ_ARTISTS.filter(a=>s.wizArtistSel[a]).map(a=>({ name:a, remove:()=>this.setState(x=>{ const sel={...x.wizArtistSel}; delete sel[a]; return {wizArtistSel:sel}; }) }));

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
    const profileStats = [
      { value: s.realShowsCount!=null ? String(s.realShowsCount) : '—', label:'Shows', color:'' },
      { value: s.realArtistsCount!=null ? String(s.realArtistsCount) : '—', label:'Artists', color:'color:var(--interested);' },
      { value:'23', label:'Friends', color:'color:var(--going);' }, // ponytail: no friends table wired this phase — placeholder
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
    const artMeta = this.ARTIST_META[artName] || { genre:'Electronic', followers:'120K', hometown:'Touring', bio:artName+' is on the road now — follow to get an alert the moment they announce a show near you.' };
    // PHASE 1 real row (loadArtistDetail): verified badge + merch/website
    // links + claim ownership all come from the artists table, not the mock.
    const artRow = s.activeArtistRow;
    const artOwned = !!(artRow && s.userId && artRow.claimed_by === s.userId);
    const artMerchUrl = (artRow && Drop && Drop.safeUrl(artRow.merch_url)) || '';
    const artWebsiteUrl = (artRow && Drop && Drop.safeUrl(artRow.website_url)) || '';
    const artImageUrl = (artRow && Drop && Drop.safeUrl(artRow.image_url)) || '';
    const artGrad = this.ARTIST_GRADS[(artName.length) % this.ARTIST_GRADS.length];
    const artShows = events.filter(e=>e.lineup.some(n=>n===artName));
    const artFollowing = !!s.following[artName];
    const artSimilarNames = ['Lane 8','RÜFÜS DU SOL','FISHER','Disclosure','Peggy Gou','Skrillex'].filter(n=>n!==artName).slice(0,5);
    const artSimilar = artSimilarNames.map(n=>({ name:n, open:()=>this.openArtist(n, null) }));
    // people-focused extras (deterministic from name so it's stable per artist)
    const artHash = artName.split('').reduce((a,c)=>a+c.charCodeAt(0),0);
    const artMonthly = [ '2.4M','1.1M','860K','540K','3.2M','1.8M' ][artHash % 6];
    const artSeenCount = artName==='ODESZA' ? 3 : (artHash % 3);
    const artFriendsSaw = 2 + (artHash % 4);
    const artRating = (4.4 + (artHash % 6) / 10).toFixed(1);
    const artReviewCount = 40 + (artHash % 9) * 17;
    const artReviewText = [
      'Best live act I\u2019ve ever seen. The visuals at Red Rocks were unreal.',
      'Went in not knowing the catalog, left a superfan. Incredible energy.',
      'Tight set, perfect pacing, and the drop everyone waited for landed hard.',
    ];
    const artReviewers = ['ravewithmaya','bass_devon','priyabeats'];
    const artReviews = artReviewText.map((t,i)=>({ name:'@'+artReviewers[i], show:['ODESZA · Red Rocks','FISHER · Ball Arena','Lane 8 · Mission'][i], stars:'★★★★★'.slice(0, i===2?4:5).padEnd(5,'☆'), text:t }));

    // ===== Venue page =====
    const venName = s.activeVenue;
    const venMeta = this.VENUE_META[venName] || { location:'Denver, CO', capacity:'—', rating:'4.5', reviews:'100', grad:this.ARTIST_GRADS[0], about:venName+' hosts a rotating calendar of touring dance acts.' };
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
          share: (evn)=>{ this.prevent(evn); this.flash('Link copied to clipboard'); },
        };
      });
    // ponytail: "Saved" has no backing table — local-only bookmark, so it
    // can only surface events from the currently-loaded Discover batch.
    const mySaved = events.filter(e=>s.saved[e.id]).map(e=>({
      ...e,
      unsave: (evn)=>{ this.prevent(evn); this.toggleSave(e.id); },
      share: (evn)=>{ this.prevent(evn); this.flash('Link copied to clipboard'); },
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

    // ===== Pick Artists =====
    const artGenreNames = ['All', ...this.GENRES.map(g=>g.name)];
    const artGenreChips = artGenreNames.map(g=>({ label:g, cls: s.artGenre===g?'is-active':'', pick:()=>this.setState({artGenre:g}) }));
    const artFiltered = s.artGenre==='All' ? this.ARTISTS_ALL : this.ARTISTS_ALL.filter(a=>a.genre===s.artGenre);
    const artistGrid = artFiltered.map(a=>{
      const on = !!s.followArt[a.name];
      return { name:a.name, genre:a.genre, followers:a.followers, upcoming:a.upcoming,
        open:()=>this.openArtist(a.name, null),
        label: on?'✓ Following':'＋ Follow', cls: on?'wsc__act is-going':'wsc__act',
        toggle:()=>{ if(!this.state.authed){ this.openGate('Log in to follow artists'); return; } this.setState(x=>({ followArt:{...x.followArt, [a.name]: !x.followArt[a.name]} })); } };
    });
    const artBulkShow = s.artGenre!=='All';
    const artAllFollowed = artFiltered.length>0 && artFiltered.every(a=>s.followArt[a.name]);
    const artBulkLabel = (artAllFollowed?'Unfollow all ':'Follow all ')+s.artGenre;

    // ===== Browse Venues =====
    const vq = s.venueQuery.trim().toLowerCase();
    const venMatched = this.VENUES_ALL.filter(v=> !vq || v.name.toLowerCase().includes(vq) || v.city.toLowerCase().includes(vq) || v.state.toLowerCase().includes(vq));
    const stateOrder = [...new Set(venMatched.map(v=>v.state))];
    const venueGroups = stateOrder.map(stt=>{
      const vs = venMatched.filter(v=>v.state===stt);
      return { state:stt, count: vs.length+' venue'+(vs.length===1?'':'s'), venues: vs.map(v=>({
        name:v.name, city:v.city, capacity:v.capacity,
        badge: v.inDrop?'In Drop':'AXS',
        badgeStyle: v.inDrop?'background:var(--attended);color:var(--ink);':'background:var(--surface-hi);color:var(--text-secondary);',
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
    const plansList = this.PLANS.map(pl=>{ const e=this.EVENTS.find(x=>x.id===pl.eventId); const going=pl.roster.filter(m=>m.status==='going').length;
      return { title:e.title, dateShort:e.dateShort, venueCity:e.venueCity, gradStyle:'background-image:'+e.grad,
        avatars: pl.roster.slice(0,3).map(m=>({ ring:m.ring })), goingLabel: going+' going',
        open:()=>{ this.setState({screen:'plan', activePlan:pl.id}); if(typeof window!=='undefined') window.scrollTo(0,0); } }; });

    // ===== Plan detail =====
    const plan = this.PLANS.find(p=>p.id===s.activePlan) || this.PLANS[0];
    const planEv = this.EVENTS.find(e=>e.id===plan.eventId);
    const pdSpot = s.planSpot[plan.id];
    const pd = {
      title:planEv.title, dateShort:planEv.dateShort, venueCity:planEv.venueCity, gradStyle:'background-image:'+planEv.grad,
      roster: plan.roster,
      spotOptions: plan.spots.map((sp,i)=>{ const on = pdSpot===undefined ? i===0 : pdSpot===i; return { label:sp,
        bg: on?'rgba(77,226,255,0.1)':'var(--surface)', border: on?'var(--accent)':'var(--border)', dot: on?'var(--accent)':'var(--border-strong)', glyph: on?'●':'',
        pick:()=>this.setState(x=>({ planSpot:{...x.planSpot, [plan.id]:i} })) }; }),
      chat: plan.chat.map(c=>({ who:c.who, time:c.time, text:c.text, color: c.me?'var(--accent)':c.color,
        align: c.me?'flex-direction:row-reverse;':'', metaAlign: c.me?'text-align:right;':'', showAvatar: !c.me,
        bubbleBg: c.me?'rgba(77,226,255,0.14)':'var(--surface)' })),
    };

    // ===== Crew builder interstitial =====
    const cbEv = this.EVENTS.find(e=>e.id===s.activeId) || this.EVENTS[0];
    const cbFriends = this.WIZ_FRIENDS.slice(0,3).map(f=>{ const on=!!s.wizFriendSel['cb-'+f.id]; return { name:f.name, sub:f.sub.split(' · ')[1], ring: on?'var(--going)':'var(--border-strong)',
      cls: on?'wsc__act is-going':'wsc__act', label: on?'Added':'Add', toggle:()=>this.setState(x=>({ wizFriendSel:{...x.wizFriendSel, ['cb-'+f.id]: !x.wizFriendSel['cb-'+f.id]} })) }; });

    // ===== Invite =====
    const inviteBase = 2;
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
    const logRows = (s.logResults||[]).map(ev=>({
      id: ev.id, title: ev.title || 'Untitled show',
      venueCity: [ev.venue_name, ev.city].filter(Boolean).join(' · '),
      dateShort: ((Drop && Drop.fmtDate(ev.date)) || 'Date TBD').toUpperCase(),
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
    const cityVenues = this.VENUES_ALL.filter(v=>v.state==='Colorado').map(v=>({ name:v.name, city:v.city, capacity:v.capacity, open:()=>{ this.setState({screen:'venue', activeVenue:v.name}); if(typeof window!=='undefined') window.scrollTo(0,0); } }));
    const cityGenres = this.GENRES.map(g=>({ name:g.name, open:()=>{ this.setState({screen:'genre', activeGenre:g.name}); if(typeof window!=='undefined') window.scrollTo(0,0); } }));
    const cityFaq = [
      { q:'What EDM shows are in '+seoCity+' this weekend?', a:'Drop lists every electronic show in '+seoCity+' with all-in prices. Top picks this weekend include ODESZA at Red Rocks and Subtronics at Mission Ballroom.' },
      { q:'Where are the best rave venues in '+seoCity+'?', a:'Red Rocks Amphitheatre, Mission Ballroom, and The Church are the most-followed electronic venues in '+seoCity+' on Drop.' },
      { q:'How do I find friends going to the same show?', a:'Create a free Drop account, sync your contacts, and you\u2019ll see which friends are going to every show near you.' },
      { q:'Are tickets cheaper on Drop?', a:'Drop compares all-in prices across sellers so you always see the true total — fees included — before you buy.' },
    ];

    const seoGenre = s.activeGenre || 'Techno';
    const seoGenreLower = seoGenre.toLowerCase();
    const seoGenreGradMap = { House:'background:linear-gradient(120deg,#2b1c4d,#0d3b52);', Dubstep:'background:linear-gradient(120deg,#4d1c37,#52270d);', Techno:'background:linear-gradient(120deg,#1c384d,#3b0d52);', Melodic:'background:linear-gradient(120deg,#1c274d,#520d47);', Bass:'background:linear-gradient(120deg,#4d3a1c,#0d2f52);', Trance:'background:linear-gradient(120deg,#1c4d3a,#52270d);' };
    const seoGenreGrad = seoGenreGradMap[seoGenre] || seoGenreGradMap.Techno;
    const genreShows = (events.filter(e=>e.genre===seoGenre).length ? events.filter(e=>e.genre===seoGenre) : events).slice(0,3);
    const genreArtistNames = { Techno:['Charlotte de Witte','Amelie Lens','Adam Beyer','ISOxo'], House:['FISHER','Chris Lake','Peggy Gou','John Summit'], Melodic:['ODESZA','Lane 8','RÜFÜS DU SOL','Tycho'], Bass:['Skrillex','Subtronics','ISOxo','Peekaboo'], Dubstep:['Subtronics','Peekaboo','ISOxo','Skrillex'], Trance:['Above & Beyond','Ilan Bluestone','Seven Lions','Gareth Emery'] };
    const genreArtists = (genreArtistNames[seoGenre]||genreArtistNames.Techno).map(n=>({ name:n, open:()=>this.openArtist(n, null) }));
    const relatedGenres = this.GENRES.filter(g=>g.name!==seoGenre).slice(0,4).map(g=>({ name:g.name, open:()=>{ this.setState({screen:'genre', activeGenre:g.name}); if(typeof window!=='undefined') window.scrollTo(0,0); } }));

    const shareEv = this.EVENTS[0];
    const sharePlan = { ...shareEv, gradStyle:'background-image:'+shareEv.grad };

    // ===== Music taste manager =====
    const TASTE_CAP = 20;
    const tasteGenreChips = this.GENRES.map(g=>{ const on=!!s.tasteGenres[g.name]; return { name:g.name, cls:on?'is-active':'', toggle:()=>this.setState(x=>{ const t={...x.tasteGenres}; if(t[g.name]) delete t[g.name]; else t[g.name]=true; return {tasteGenres:t}; }) }; });
    const tasteCount = s.tasteArtists.length;
    const tasteCapLabel = tasteCount+' / '+TASTE_CAP;
    const tasteCapColor = tasteCount>=TASTE_CAP ? 'var(--gold)' : 'var(--text-secondary)';
    const tasteArtistChips = s.tasteArtists.map(n=>({ name:n, remove:()=>this.setState(x=>({tasteArtists:x.tasteArtists.filter(a=>a!==n)})) }));
    const tq = s.tasteQuery.trim().toLowerCase();
    const tasteMatches = tq.length>0 ? this.ARTISTS_ALL.filter(a=>a.name.toLowerCase().includes(tq) && !s.tasteArtists.includes(a.name)).slice(0,4).map(a=>({ name:a.name, add:()=>{ if(this.state.tasteArtists.length>=TASTE_CAP){ this.flash('Artist cap reached ('+TASTE_CAP+')'); return; } this.setState(x=>({tasteArtists:[...x.tasteArtists,a.name], tasteQuery:''})); } })) : [];
    const tasteQueryOpen = tq.length>0 && tasteMatches.length>0;
    const scSubLabel = s.scConnected ? 'Connected · 12 artists imported' : 'Import your likes & follows';
    const scBtnLabel = s.scConnected ? 'Disconnect' : 'Connect';
    const scBtnCls = s.scConnected ? 'btn btn--secondary btn--sm' : 'btn btn--primary btn--sm';

    // ===== Suggest an event =====
    const SCOUT_GOAL = 5, scoutApproved = 3;
    const scoutLabel = scoutApproved+' of '+SCOUT_GOAL+' live';
    const scoutFillStyle = 'width:'+(scoutApproved/SCOUT_GOAL*100)+'%;';
    const scoutHint = scoutApproved>=SCOUT_GOAL ? 'Reward unlocked — a free month of Drop+ 🎉' : (SCOUT_GOAL-scoutApproved)+' more approved shows for a free month of Drop+';
    const CAP_MAX = 5, capUsed = this.SUBMISSIONS.length;
    const capReached = capUsed>=CAP_MAX;
    const saq = s.sugArtist.trim().toLowerCase();
    const sugArtistMatches = saq.length>0 ? this.ARTISTS_ALL.filter(a=>a.name.toLowerCase().includes(saq)).slice(0,4).map(a=>({ name:a.name, pick:()=>this.setState({sugArtist:a.name}) })) : [];
    const sugArtistOpen = saq.length>0 && sugArtistMatches.length>0 && s.sugArtist!==(sugArtistMatches[0]&&sugArtistMatches[0].name);
    const svq = s.sugVenue.trim().toLowerCase();
    const sugVenueMatches = svq.length>0 ? this.VENUES_ALL.filter(v=>v.name.toLowerCase().includes(svq)||v.city.toLowerCase().includes(svq)).slice(0,4).map(v=>({ name:v.name, city:v.city+', '+v.state, pick:()=>this.setState({sugVenue:v.name}) })) : [];
    const sugVenueOpen = svq.length>0 && sugVenueMatches.length>0 && s.sugVenue!==(sugVenueMatches[0]&&sugVenueMatches[0].name);
    const submissions = this.SUBMISSIONS.map(sub=>{ const st=this.SUB_STATUS[sub.status]; return { title:sub.title, venue:sub.venue, date:sub.date, label:st.label, color:st.color, bg:st.bg }; });

    // ===== Promoter =====
    const PROMO_STATUS = { live:{label:'Live', color:'var(--attended)', bg:'rgba(182,255,106,0.12)'}, draft:{label:'Draft', color:'var(--text-muted)', bg:'var(--surface-hi)'} };
    const promoEvents = this.PROMO_EVENTS.map(e=>{ const st=PROMO_STATUS[e.status]; return { ...e, gradStyle:'background-image:'+e.grad, statusLabel:st.label, statusColor:st.color, statusBg:st.bg, manage:()=>{ this.setState({managePromoEvent:e.id, promoTab:'details', promoDelConfirm:''}); this.go('promomanage'); } }; });
    const pmRaw = this.PROMO_EVENTS.find(e=>e.id===s.managePromoEvent) || this.PROMO_EVENTS[0];
    const pm = { ...pmRaw, gradStyle:'background-image:'+pmRaw.grad };
    const promoTabs = ['details','guests','codes'].map(t=>({ label:{details:'Details',guests:'Guest list',codes:'Codes'}[t], cls: s.promoTab===t?'is-active':'', pick:()=>this.setState({promoTab:t}) }));
    const promoDelOk = s.promoDelConfirm.trim().toUpperCase()==='DELETE';
    const guests = this.GUESTS.map(g=>{ const on=!!s.guestChecked[g.id]; return { name:g.name, plusLabel: g.plus>0?('+'+g.plus+' guest'+(g.plus>1?'s':'')):'Solo', bg: on?'rgba(182,255,106,0.06)':'var(--surface)', btnLabel: on?'✓ In':'Check in', btnCls: on?'btn btn--sm is-going wsc__act is-going':'btn btn--secondary btn--sm', toggle:()=>this.setState(x=>({guestChecked:{...x.guestChecked,[g.id]:!x.guestChecked[g.id]}})) }; });
    const guestTotal = this.GUESTS.reduce((n,g)=>n+1+g.plus,0);
    const guestCheckedIn = this.GUESTS.filter(g=>s.guestChecked[g.id]).reduce((n,g)=>n+1+g.plus,0);
    const guestPending = guestTotal - guestCheckedIn;
    const codes = this.CODES.map(c=>({ code:c.code, desc:c.desc, usage: c.used+' / '+c.cap+' used', active: !!s.codeActive[c.id], toggle:()=>this.setState(x=>({codeActive:{...x.codeActive,[c.id]:!x.codeActive[c.id]}})), del:()=>this.flash('Code '+c.code+' deleted') }));

    // ===== Admin =====
    const adminTabs = ['queue','reports','analytics'].map(t=>({ label:{queue:'Review queue',reports:'Reports',analytics:'Analytics'}[t], cls: s.adminTab===t?'is-active':'', pick:()=>this.setState({adminTab:t}) }));
    const reviewQueue = this.REVIEW_QUEUE.filter(r=>!s.reviewActioned[r.id]).map(r=>({ ...r, approve:()=>{ this.setState(x=>({reviewActioned:{...x.reviewActioned,[r.id]:'approved'}})); this.flash('Approved — event is now live'); }, reject:()=>{ this.setState(x=>({reviewActioned:{...x.reviewActioned,[r.id]:'rejected'}})); this.flash('Rejected'); } }));
    const REPORT_ST = { open:{label:'Open', color:'var(--gold)', bg:'rgba(255,203,61,0.12)'}, dismissed:{label:'Dismissed', color:'var(--text-muted)', bg:'var(--surface-hi)'}, reviewed:{label:'Reviewed', color:'var(--accent)', bg:'rgba(77,226,255,0.12)'}, actioned:{label:'Actioned', color:'var(--danger)', bg:'rgba(255,77,109,0.12)'} };
    const reports = this.REPORTS.map(r=>{ const key=s.reportState[r.id]||'open'; const st=REPORT_ST[key]; return { ...r, stLabel:st.label, stColor:st.color, stBg:st.bg, dismiss:()=>{ this.setState(x=>({reportState:{...x.reportState,[r.id]:'dismissed'}})); this.flash('Report dismissed'); }, reviewed:()=>{ this.setState(x=>({reportState:{...x.reportState,[r.id]:'reviewed'}})); this.flash('Marked reviewed'); }, action:()=>{ this.setState(x=>({reportState:{...x.reportState,[r.id]:'actioned'}})); this.flash('Content removed'); } }; });
    const maxSignup = Math.max(...this.ADMIN_SIGNUPS);
    const signupBars = this.ADMIN_SIGNUPS.map(v=>({ h:(v/maxSignup*100)+'%', value:v+' signups' }));

    // ===== Legal =====
    const LEGAL = {
      privacy: { kicker:'LEGAL · PRIVACY', title:'Privacy Policy', body:[
        {h:'What we collect', t:'Account details you give us (email, username), the shows you RSVP to or save, artists and venues you follow, and connected-provider data you explicitly authorize. We collect basic device and usage analytics to keep the app fast and reliable.'},
        {h:'How we use it', t:'To match you with shows worth your night, notify you about presales and friend activity, and improve the product. We never sell your personal data. Recap and Wrapped sharing is always opt-in.'},
        {h:'Connected providers', t:'When you link SoundCloud or another music service, we read likes and follows to seed your taste. We never post, message, or modify anything on your account, and you can disconnect at any time.'},
        {h:'Your controls', t:'Edit or delete your taste data, opt out of appearing in friends\u2019 recaps, block accounts, or delete your account entirely from Settings. Deletion is permanent and removes your plans, recaps, and history.'},
        {h:'Contact', t:'Questions about your data? Reach our privacy team at privacy@drop.fm and we\u2019ll respond within 30 days.'},
      ]},
      terms: { kicker:'LEGAL · TERMS', title:'Terms of Service', body:[
        {h:'Using Drop', t:'You must be 18 or older to create an account. You\u2019re responsible for activity under your account and for keeping your login secure. Don\u2019t use Drop to harass others, scalp tickets, or post spam.'},
        {h:'Tickets & promoters', t:'Drop links to third-party ticketing. We are not the seller of record and don\u2019t control pricing, fees, or entry policies. Drop may earn a commission on some ticket links. Promoters are responsible for the accuracy of their listings, guest lists, and codes.'},
        {h:'Community content', t:'Comments, reviews, and recaps you post are yours, but you grant Drop a license to display them. We may remove content that violates these terms, and repeat violations can lead to account suspension.'},
        {h:'Drop+', t:'Drop+ time is earned or granted as described in the app and applies to your membership. Earned time has no cash value and is non-transferable.'},
        {h:'Changes', t:'We may update these terms; material changes will be announced in-app. Continued use after an update means you accept the revised terms.'},
      ]},
    };
    const legalActive = LEGAL[s.legalDoc] || LEGAL.privacy;
    const legalSections = legalActive.body.map(b=>({ label:b.h, jump:(e)=>{ this.prevent(e); } }));

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
      screenPromoter: s.screen==='promoter', screenPromoManage: s.screen==='promomanage', screenAdmin: s.screen==='admin', screenLegal: s.screen==='legal',
      isPromoter: s.isPromoter, notPromoter: !s.isPromoter,
      promoEvents, pm, promoTabs, promoTabDetails: s.promoTab==='details', promoTabGuests: s.promoTab==='guests', promoTabCodes: s.promoTab==='codes',
      promoDelConfirm: s.promoDelConfirm, promoDelDisabled: !promoDelOk, promoDelOpacity: promoDelOk?'1':'0.5',
      guests, guestTotal, guestCheckedIn, guestPending, codes,
      adminTabs, adminTabQueue: s.adminTab==='queue', adminTabReports: s.adminTab==='reports', adminTabAnalytics: s.adminTab==='analytics',
      reviewQueue, queuePending: reviewQueue.length, queueEmpty: reviewQueue.length===0, reports, signupBars,
      topEvents: this.ADMIN_TOP_EVENTS, adminActions: this.ADMIN_ACTIONS,
      legalKicker: legalActive.kicker, legalTitle: legalActive.title, legalBody: legalActive.body, legalSections,
      legalPrivacyCls: s.legalDoc==='privacy'?'is-active-legal':'', legalTermsCls: s.legalDoc==='terms'?'is-active-legal':'',
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
      submitLabel: capReached ? 'Monthly cap reached' : 'Submit event', submissions,
      aboutStats, team, appFeatures, promoterFeatures, promoterStats,
      seoCity, cityShows, cityVenues, cityGenres, cityFaq,
      seoGenre, seoGenreLower, seoGenreGrad, genreShows, genreArtists, relatedGenres,
      sharePlan,
      authed: s.authed, signedOut: !s.authed,
      // PHASE 1 auth UI state
      authError: s.authError, authBusy: s.authBusy,
      loginBtnLabel: s.authBusy ? 'Working…' : 'Log in',
      signupBtnLabel: s.authBusy ? 'Working…' : 'Create account',
      verifyEmail: s.verifyEmail || 'your email', verifyMessage: s.verifyMessage,
      city: s.city, cityOpen: s.cityOpen, cities, menuOpen: s.menuOpen, menuItems, navOpen: s.navOpen, mobileMenu,
      events, genres, discoverEvents: discoverSource, genreActive, gridLabel, gridEmpty, genreName: s.genre, crew: this.CREW,
      eventsLoading: s.eventsLoading, eventsError: s.eventsError,
      tabs: tabList, dateChips, dateChipLabel,
      comments: this.COMMENTS,
      waveBars,

      // search
      query: s.query, typeahead: typeaheadGroups, typeaheadOpen,
      distanceChips, searchGenreChips, priceMin: s.priceMin, priceMax: s.priceMax,
      searchGeoActive, searchGeoInactive: !searchGeoActive, searchGeoPending,
      searchLocPillLabel, searchGeoBtnLabel, searchLocContext,
      priceRangeLabel: '$'+lo+' – $'+hi+(hi>=200?'+':''),
      priceFillStyle: 'left:'+((lo-20)/180*100)+'%;right:'+(100-(hi-20)/180*100)+'%;',
      searchEmpty, searchHasResults, searchNoResults, searchResults, resultsLabel,
      recentSearches, trendingChips,

      // festival
      festTabs, stages, festClashBanner,

      // wizard
      wizStepNum, wizTitle: wizCur.title, wizSubtitle: wizCur.sub, wizDots, wizNextLabel, wizHasBack: s.wizStep>0,
      wizStep0: s.wizStep===0, wizStep1: s.wizStep===1, wizStep2: s.wizStep===2, wizStep3: s.wizStep===3, wizStep4: s.wizStep===4,
      wizGenreChips, wizFriends, wizArtists,
      wizArtQuery: s.wizArtQuery, wizArtMatches, wizArtOpen, wizArtChosen, wizHasArtChosen: wizArtChosen.length>0,

      // first-rsvp moment
      rm: { ...this.EVENTS[0], gradStyle:'background-image:'+this.EVENTS[0].grad, hasFriends:this.EVENTS[0].friends>0, friendsLabel:fl(this.EVENTS[0].friends) },
      rmName: 'Alex',

      // artist / venue / my shows
      art: { name:artName, ...artMeta, gradStyle:'background-image:'+artGrad,
        monthly:artMonthly, hasSeen:artSeenCount>0, seenCount:artSeenCount+'x',
        hasFriends:artFriendsSaw>0, friendsLabel:artFriendsSaw+' friends', rating:artRating, reviewCount:artReviewCount,
        verified: !!(artRow && artRow.verified), hasMerch: !!artMerchUrl, merchUrl: artMerchUrl, hasWebsite: !!artWebsiteUrl, websiteUrl: artWebsiteUrl,
        hasImage: !!artImageUrl, noImage: !artImageUrl, imageUrl: artImageUrl,
        ownedByMe: artOwned, claimPending: s.claimStatus==='pending', canClaim: !artOwned && s.claimStatus!=='pending' },
      artShows, artHasShows: artShows.length>0, artSimilar, artReviews,
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
      ven: { name:venName, ...venMeta, gradStyle:'background-image:'+venMeta.grad },
      venShows, venHasShows: venShows.length>0,
      venFollowLabel: venFollowing?'✓ Following':'＋ Follow venue', venFollowCls: venFollowing?'btn btn--secondary':'btn btn--primary',
      myTabs,
      myShowUpcoming: s.myTab==='Upcoming', myShowSaved: s.myTab==='Saved', myShowPast: s.myTab==='Past',
      myShowShowWrapped: s.myTab!=='Saved',
      myUpcoming, myUpcomingEmpty: myUpcoming.length===0,
      mySaved, mySavedEmpty: mySaved.length===0,
      myPast, myPastEmpty: myPast.length===0,

      // pick artists
      artGenreChips, artistGrid, artBulkShow, artBulkLabel,
      // browse venues
      venueQuery: s.venueQuery, venueGroups, venuesEmpty: venMatched.length===0,
      // crew
      crewTabs,
      crewFriends: s.crewTab==='Friends', crewRequests: s.crewTab==='Requests', crewFind: s.crewTab==='Find', crewPlans: s.crewTab==='Plans',
      friendsList, requestsList, requestsEmpty: requestsList.length===0, findList, plansList,
      // plan detail
      pd,
      // crew builder
      cbTitle: cbEv.title.split(' — ')[0], cbFriends,
      // invite
      inviteCount, inviteRemainLabel: inviteRemain===0?'Reward unlocked 🎉':inviteRemain+' more for a free month', inviteFillStyle:'width:'+(inviteCount/5*100)+'%;', inviteMilestones, inviteList,
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
      seenYears,
      taggedList, taggedEmpty: taggedList.length===0,
      // drop+
      ledger,
      plusPlans, plusFeatures, plusCtaLabel: s.plusPlan==='annual'?'Start annual — $59.99/yr':'Start monthly — $7.49/mo',
      // link hub
      linkButtons,

      // profile / settings
      prof, profileStats, profileMenu, notifications, notifEmpty: notifications.length===0, settingsToggles, recapPrivacy: s.recapPrivacy,
      blocked, blockedEmpty: blocked.length===0,
      deleteConfirm: s.deleteConfirm, deleteDisabled: !deleteOk,
      deleteBtnBg: deleteOk?'var(--danger)':'var(--surface-hi)', deleteBtnColor: deleteOk?'var(--white)':'var(--text-muted)', deleteCursor: deleteOk?'pointer':'not-allowed',
      username: s.username, unameIcon, unameBorder, unameMsg, unameMsgColor,
      gate: s.gate, gateTitle: s.gateTitle, toast: s.toast,

      // event detail
      ae: { ...ae, gradStyle:'background-image:'+ae.grad, hasFriends:ae.friends>0, friendsLabel:fl(ae.friends), lineup, priceRows,
        description: ae.title.split(' — ')[0]+' brings a full production to '+ae.venue+' — expect a headline set built around the new album, immersive lighting and a stacked support bill. Doors open one hour before showtime. This is an 18+ event; a valid ID is required at the door. Times are subject to change, so keep an eye on your Drop reminders for set-time updates and any presale drops.' },
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
      // legal
      goLegal:(e)=>{ this.prevent(e); this.setState({legalDoc:'privacy'}); this.go('legal'); },
      goTerms:(e)=>{ this.prevent(e); this.setState({legalDoc:'terms'}); this.go('legal'); },
      legalPrivacy:()=>this.setState({legalDoc:'privacy'}),
      legalTerms:()=>this.setState({legalDoc:'terms'}),
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
      walletRedeem:()=>this.flash('Free time applied to your Drop+ renewal'),
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
      cbStart:()=>{ this.setState({screen:'plan', activePlan: (this.PLANS.find(p=>p.eventId===this.state.activeId)||this.PLANS[0]).id}); if(typeof window!=='undefined') window.scrollTo(0,0); this.flash('Plan started — your crew is notified'); },
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
        if (!dobValue) { this.setState({authError:'Enter your date of birth.'}); return; }
        const years = ageFromDob(dobValue);
        if (years == null || years < 16) { this.setState({authError:'You must be 16 or older to use Drop.'}); return; }
        if (!consented) { this.setState({authError:'Agree to the Terms and Privacy Policy to continue.'}); return; }
        this.setState({authBusy:true, authError:''});
        const data = { dob: dobValue, consented_at: new Date().toISOString() };
        if (username) data.username = username;
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
      oauthFacebook:()=>this.oauth('facebook'),
      setUsername:(e)=>this.setState({username: e.target.value}),
      closeGate:()=>this.setState({gate:false}),
      goLoginFromGate:()=>this.setState({gate:false, gateReturn: this.state.screen, screen:'login'}),
      goSignupFromGate:()=>this.setState({gate:false, gateReturn:null, screen:'signup'}),
      aeGoing:()=>this.toggleRsvp(ae.id,'going'),
      aeInterested:()=>this.toggleRsvp(ae.id,'interested'),
      aeSave:()=>this.toggleSave(ae.id),
      aeShare:()=>this.flash('Link copied to clipboard'),
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
      clearFilters:()=>this.setState({sGenres:{}, distance:'25', priceMin:20, priceMax:120, searchGeo:'idle'}),
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
      goFestival:(e)=>{ this.prevent(e); this.go('festival'); },

      // wizard
      wizNext:()=>{ if(this.state.wizStep>=4){ this.setState({screen:'rsvpmoment'}); if(typeof window!=='undefined') window.scrollTo(0,0); } else { this.setState(x=>({wizStep:x.wizStep+1})); } },
      wizBack:()=>{ this.setState(x=>({wizStep: Math.max(0, x.wizStep-1)})); },
      wizSkip:()=>{ if(this.state.wizStep>=4){ this.setState({screen:'rsvpmoment'}); if(typeof window!=='undefined') window.scrollTo(0,0); } else { this.setState(x=>({wizStep:x.wizStep+1})); } },
      setWizArtQuery:(e)=>this.setState({wizArtQuery:e.target.value}),
      rmGoing:()=>{ this.setState(x=>({ rsvp:{...x.rsvp, [this.EVENTS[0].id]:'going'}, screen:'discover' })); if(typeof window!=='undefined') window.scrollTo(0,0); this.flash('You\u2019re going to '+this.EVENTS[0].title.split(' \u2014 ')[0]+' \u2014 welcome to Drop'); },
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
      const claimId = new URLSearchParams(location.search).get('claim');
      if (claimId) instance.setState({ pendingClaimArtistId: claimId });
      // Public-site "suggest an event" deep link → the suggest screen once the
      // session settles (afterLogin below; writes there are auth-gated anyway).
      if (new URLSearchParams(location.search).get('suggest') === '1') instance.setState({ screen: 'suggest' });
    }
    if (supa) {
      instance.afterLogin(); // checks for an existing/just-confirmed session
      supa.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') instance.setState({ authed:false, userId:null, profile:null });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
