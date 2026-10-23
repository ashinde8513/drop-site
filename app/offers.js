/*
 * app/offers.js — ticket seller rules for the web Event Detail (design spec 01).
 *
 * Ports the native app's fail-closed rules so web and app agree:
 *   - comparableOfferEventIds: DropApp src/lib/eventOfferMatch.ts (same show,
 *     other source rows). Never matches on title alone.
 *   - usableTicketOffers / bestOfferPerVendor: DropApp src/lib/affiliate.ts and
 *     eventOfferMatch.ts (link vetting, Etix only via Drop's owned link,
 *     duplicate same-seller rows collapsed).
 * Then the web display rules Arya approved 2026-10-23 (A50):
 *   - "$89" / "$89.50" for USD, "€80", "£80", other codes "CAD 95".
 *   - no price, an invalid currency, or a quote older than 7 days reads
 *     "Live price · See current total on seller site". No fee estimates.
 *   - "Lowest listed" / "Lowest known" only when prices are comparable;
 *     cheapest-first only then, otherwise A–Z.
 *
 * Web comparability rule. Native also requires an identical ticket_class, but
 * that column does not exist live (checked 2026-10-22 and 2026-10-23), so the
 * web rule uses what the data has: 2+ sellers, every row primary, one valid
 * ISO currency on every row, one fee basis (price_includes_fees) on every row,
 * and a unique lowest fresh price. "Lowest listed" when every row is priced
 * and fresh, "Lowest known" when some are not.
 *
 * Pure and dependency-free: loaded by app/index.html (window.DropOffers) and
 * required by tests/offers.test.mjs.
 */
(function (root) {
  'use strict';

  var HOUR = 60 * 60 * 1000;
  var STALE_MS = 7 * 24 * HOUR;

  // ---- same-show matching (eventOfferMatch.ts) -----------------------------
  function latinFold(value) {
    return String(value == null ? '' : value).toLowerCase()
      .replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ß/g, 'ss')
      .replace(/[øōő]/g, 'o').replace(/[ł]/g, 'l').replace(/[đ]/g, 'd').replace(/[ı]/g, 'i')
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function normalized(value) { return latinFold(value).replace(/[^a-z0-9]/g, ''); }

  var IGNORED_VENUE_TOKENS = ['the', 'and', 'at', 'venue', 'center', 'centre', 'hall', 'arena', 'ballroom', 'nightclub'];
  function venueTokens(value) {
    return latinFold(value).split(/[^a-z0-9]+/).filter(function (t) { return t.length >= 3 && IGNORED_VENUE_TOKENS.indexOf(t) < 0; });
  }
  function venueNamesCompatible(a, b) {
    var left = normalized(a), right = normalized(b);
    if (!left || !right) return false;
    if (left === right || (left.length >= 6 && right.length >= 6 && (left.indexOf(right) >= 0 || right.indexOf(left) >= 0))) return true;
    var rightTokens = venueTokens(b);
    var shared = venueTokens(a).filter(function (t, i, all) { return all.indexOf(t) === i && rightTokens.indexOf(t) >= 0; });
    return shared.length >= 2;
  }
  function sameVenue(a, b) {
    // Two canonical ids are authoritative; legacy rows need venue-name proof.
    if (a.venue_id && b.venue_id) return a.venue_id === b.venue_id;
    return venueNamesCompatible(a.venue_name, b.venue_name);
  }
  function headlinerKeys(c) {
    var keys = [];
    (c.event_artists || []).forEach(function (e) {
      if (!(e.position == null || e.position === 0)) return;
      var id = e.artist_id && String(e.artist_id).trim();
      var name = normalized(e.artists && e.artists.name);
      if (id) keys.push('id:' + id);
      if (name) keys.push('name:' + name);
    });
    return keys;
  }
  function sharesHeadliner(a, b) {
    var left = headlinerKeys(a);
    return headlinerKeys(b).some(function (k) { return left.indexOf(k) >= 0; });
  }
  function localDay(date, timezone) {
    var parsed = new Date(date);
    if (!isFinite(parsed.getTime())) return null;
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed);
    } catch (e) { return null; }
  }
  function sameShowWindow(a, b) {
    var left = Date.parse(a.date), right = Date.parse(b.date);
    if (!isFinite(left) || !isFinite(right)) return false;
    var leftTbd = a.time_tbd === true, rightTbd = b.time_tbd === true;
    if (!leftTbd && !rightTbd) return left === right;
    if (leftTbd === rightTbd || Math.abs(left - right) > 3 * HOUR) return false;
    if (!a.timezone || a.timezone !== b.timezone) return false;
    return localDay(a.date, a.timezone) === localDay(b.date, a.timezone);
  }
  function sameExactPerformance(a, b) {
    var left = Date.parse(a.date);
    return isFinite(left) && left === Date.parse(b.date) &&
      normalized(a.title) === normalized(b.title) && normalized(a.city) === normalized(b.city) && sameVenue(a, b);
  }

  // Every safely matched source row for one show; [anchorId] when unsure.
  function comparableOfferEventIds(anchorId, candidates) {
    var anchor = (candidates || []).find(function (c) { return c.id === anchorId; });
    if (!anchor) return [anchorId];
    var matches = candidates.filter(function (c) {
      if (c.id === anchorId) return true;
      if (!sameShowWindow(c, anchor) || normalized(c.city) !== normalized(anchor.city)) return false;
      if (normalized(c.title) === normalized(anchor.title)) return sameVenue(anchor, c);
      // A different title needs a shared headliner AND venue proof.
      return sharesHeadliner(anchor, c) && sameVenue(anchor, c);
    });
    if (matches.length < 2) return [anchorId];
    // A repeated source is safe only when its rows are the exact same performance.
    var bySource = {};
    matches.forEach(function (c) { var k = normalized(c.source); (bySource[k] = bySource[k] || []).push(c); });
    var ambiguous = Object.keys(bySource).some(function (k) {
      var group = bySource[k];
      return group.length > 1 && group.some(function (c) { return !sameExactPerformance(group[0], c); });
    });
    return ambiguous ? [anchorId] : matches.map(function (c) { return c.id; });
  }

  // ---- link vetting (affiliate.ts) -----------------------------------------
  function hostOf(url) {
    try {
      var u = new URL(url);
      if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password) return '';
      return u.hostname.toLowerCase();
    } catch (e) { return ''; }
  }
  // Same exact-owned contract as the Etix importer: short links or another
  // publisher's camref do not prove Drop attribution.
  function isOwnedEtixUrl(url) {
    var m = String(url).match(/^https:\/\/etix\.prf\.hn\/click\/camref:1100l5NLJm\/pubref:([0-9]+)\/destination:([^/\s?#]+)$/);
    if (!m) return false;
    try {
      var d = new URL(decodeURIComponent(m[2]));
      var id = d.pathname.match(/^\/ticket\/p\/(\d+)(?:\/|$)/);
      return d.protocol === 'https:' && d.hostname === 'www.etix.com' && !d.port && !d.username && !d.password && !!id && id[1] === m[1];
    } catch (e) { return false; }
  }
  function isUsableTicketUrl(url, vendor) {
    if (!url) return false;
    var host = hostOf(url).replace(/\.+$/, '');
    if (!host) return false;
    if (vendor === 'Etix' || ['etix.com', 'etix.prf.hn'].some(function (h) { return host === h || host.slice(-h.length - 1) === '.' + h; })) return isOwnedEtixUrl(url);
    return true;
  }
  // Rows with no URL stay as price-only rows.
  function usableTicketOffers(offers) {
    return (offers || []).filter(function (o) { return !o.url || isUsableTicketUrl(o.url, o.vendor); });
  }

  // ---- duplicate collapse (eventOfferMatch.ts bestOfferPerVendor) ----------
  function stamp(o) { var p = Date.parse(o.last_refreshed || o.fetched_at || ''); return isFinite(p) ? p : 0; }
  function quoteStamp(o) { var p = o.last_seen_at ? Date.parse(o.last_seen_at) : NaN; return isFinite(p) ? p : -Infinity; }
  function byStamp(fn) {
    return function (a, b) { return fn(a) !== fn(b) ? (fn(a) > fn(b) ? a : b) : (String(a.id).localeCompare(String(b.id)) <= 0 ? a : b); };
  }
  var newer = byStamp(stamp), newerQuote = byStamp(quoteStamp);
  function knownPrice(o) { return o.price_min != null || o.price_max != null; }
  function channel(url) {
    if (!url) return null;
    try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') || null; } catch (e) { return 'malformed:' + normalized(url); }
  }
  function mergeOffers(group) {
    if (group.length === 1) return group[0];
    var base = group.reduce(newer);
    var priced = group.filter(knownPrice);
    var linked = group.filter(function (o) { return o.url; });
    var quote = priced.length ? priced.reduce(newerQuote) : base;
    // Keep the complete quote together even when its link was refreshed.
    return Object.assign({}, base, {
      url: linked.length ? linked.reduce(newer).url : null,
      price_min: quote.price_min == null ? null : quote.price_min,
      price_max: quote.price_max == null ? null : quote.price_max,
      currency: quote.currency == null ? null : quote.currency,
      price_includes_fees: quote.price_includes_fees == null ? null : quote.price_includes_fees,
      last_seen_at: quote.last_seen_at == null ? null : quote.last_seen_at,
    });
  }
  // Collapse same-vendor, same-domain rows without losing a channel.
  function bestOfferPerVendor(offers) {
    var vendors = {};
    (offers || []).forEach(function (o) { var v = normalized(o.vendor); (vendors[v] = vendors[v] || []).push(o); });
    var out = [];
    Object.keys(vendors).forEach(function (v) {
      var group = vendors[v];
      var domains = group.map(function (o) { return channel(o.url); })
        .filter(function (c, i, all) { return c && c.indexOf('malformed:') !== 0 && all.indexOf(c) === i; });
      var only = domains.length === 1 ? domains[0] : null;
      var byChannel = {};
      group.forEach(function (o) { var k = channel(o.url) || only || 'unknown'; (byChannel[k] = byChannel[k] || []).push(o); });
      Object.keys(byChannel).forEach(function (k) { out.push(mergeOffers(byChannel[k])); });
    });
    return out;
  }

  // ---- web display ---------------------------------------------------------
  var SYMBOL = { USD: '$', EUR: '€', GBP: '£' };
  function validCurrency(c) { var code = String(c == null ? '' : c).trim().toUpperCase(); return /^[A-Z]{3}$/.test(code) ? code : null; }
  // "$89", "$89.50", "€80", "CAD 95". Caller passes a valid ISO code.
  function formatAmount(value, currency) {
    var whole = Math.round(value * 100) % 100 === 0;
    var n = Number(value).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
    return SYMBOL[currency] ? SYMBOL[currency] + n : currency + ' ' + n;
  }
  function freshness(lastSeen, now) {
    var seen = lastSeen ? Date.parse(lastSeen) : NaN;
    if (!isFinite(seen) || seen > now) return 'unknown';
    return now - seen > STALE_MS ? 'stale' : 'fresh';
  }
  // One offer's quote: amount is null when the price can't be shown.
  function quote(o, now) {
    var raw = o.price_min != null ? o.price_min : o.price_max;
    var price = raw == null || raw === '' ? NaN : Number(raw);
    var currency = validCurrency(o.currency);
    var fresh = freshness(o.last_seen_at, now);
    // Like native quoteTotal: only a fresh quote is shown; unknown age reads Live price too.
    // $0 may be a free show or a feed placeholder: claim neither (never "$0", same as map pins).
    var amount = isFinite(price) && price > 0 && currency && fresh === 'fresh' ? price : null;
    var max = o.price_max == null || o.price_max === '' ? NaN : Number(o.price_max);
    return { amount: amount, currency: currency, fresh: fresh, stale: fresh === 'stale', upTo: amount != null && isFinite(max) && max > amount ? max : null };
  }

  // Ordered card rows plus the tag (or null). Each row keeps the offer's id.
  function ticketRows(offers, now) {
    var rows = (offers || []).map(function (o) { return { offer: o, q: quote(o, now) }; });
    var tag = null;
    var currencies = rows.map(function (r) { return r.q.currency; });
    var basis = rows.map(function (r) { return !!r.offer.price_includes_fees; });
    var comparable = rows.length >= 2 && !!currencies[0] &&
      rows.every(function (r, i) { return currencies[i] === currencies[0] && basis[i] === basis[0] && (!r.offer.kind || r.offer.kind === 'primary'); });
    var priced = comparable ? rows.filter(function (r) { return r.q.amount != null; })
      .sort(function (a, b) { return a.q.amount - b.q.amount; }) : [];
    if (priced.length && !(priced[1] && priced[1].q.amount === priced[0].q.amount)) {
      tag = { id: priced[0].offer.id, text: priced.length === rows.length ? 'Lowest listed' : 'Lowest known' };
    }
    var alpha = function (a, b) {
      return String(a.offer.vendor || '').localeCompare(String(b.offer.vendor || '')) || String(a.q.currency || '').localeCompare(String(b.q.currency || ''));
    };
    var ordered = tag
      ? priced.concat(rows.filter(function (r) { return priced.indexOf(r) < 0; }).sort(alpha))
      : rows.slice().sort(alpha);
    return {
      tag: tag,
      rows: ordered.map(function (r) {
        var q = r.q, o = r.offer;
        var captions = [];
        if (q.upTo != null) captions.push('up to ' + formatAmount(q.upTo, q.currency));
        if (q.amount != null && o.price_includes_fees) captions.push('Fees included');
        return {
          id: o.id,
          seller: o.vendor || 'Tickets',
          url: o.url || null,
          amount: q.amount == null ? null : formatAmount(q.amount, q.currency),
          caption: captions.join(' · '),
          line: q.amount != null ? '' : q.stale ? 'Previous quote expired' : 'See current total on seller site',
          tag: tag && tag.id === o.id ? tag.text : '',
          seatgeek: String(o.vendor || '').toLowerCase() === 'seatgeek',
        };
      }),
    };
  }

  var api = {
    comparableOfferEventIds: comparableOfferEventIds,
    venueNamesCompatible: venueNamesCompatible,
    usableTicketOffers: usableTicketOffers,
    isUsableTicketUrl: isUsableTicketUrl,
    hostOf: hostOf,
    bestOfferPerVendor: bestOfferPerVendor,
    formatAmount: formatAmount,
    freshness: freshness,
    ticketRows: ticketRows,
  };
  root.DropOffers = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
