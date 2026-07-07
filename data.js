/* Drop — data layer. Live catalog from the app's public (anon-readable) Supabase.
   No build step, no modules: everything hangs off window.Drop and is reused by every
   page. The publishable key is public by design (row-level security governs access);
   safe to ship in client JS. */
(function () {
  var Drop = (window.Drop = window.Drop || {});

  var SUPA_URL = 'https://ebccwnkmsnhbljxxxdej.supabase.co';
  var SUPA_KEY = 'sb_publishable_ZMsNcfhfqsGgyvsdBDTKHg__h8SDZyd';
  var REST = SUPA_URL + '/rest/v1/';

  // Location — client-side choice, persisted. Denver is densest (~140 upcoming).
  var CITIES = ['Denver', 'Los Angeles', 'Seattle', 'Portland', 'San Diego',
    'Brooklyn', 'New York', 'Chicago', 'Dallas', 'Austin', 'Boston'];
  Drop.CITIES = CITIES;
  Drop.ALL_CITIES = 'All cities';

  Drop.city = function () {
    try { return localStorage.getItem('drop.city') || 'Denver'; }
    catch (e) { return 'Denver'; } // ponytail: private-mode localStorage throws — default
  };
  Drop.setCity = function (c) {
    try { localStorage.setItem('drop.city', c); } catch (e) {}
    return c;
  };

  // ---- REST helper --------------------------------------------------------
  function todayISO() {
    // Start-of-today so events later today still show.
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }

  function q(params) {
    var parts = [];
    for (var k in params) {
      if (params[k] === undefined || params[k] === null || params[k] === '') continue;
      parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
    }
    return parts.join('&');
  }

  function get(path) {
    return fetch(REST + path, {
      headers: { apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY },
      referrerPolicy: 'no-referrer'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  var EVENT_COLS =
    'id,title,description,date,end_date,venue_name,city,state,image_url,ticket_url,' +
    'price_min,price_max,currency,is_festival,time_tbd,status,created_at';
  var EVENT_SELECT = EVENT_COLS + ',event_artists(artists(id,name,genres,image_url))';

  // ---- Public fetchers ----------------------------------------------------
  // opts: {city, genre, q, venue, from, to, festival, limit, offset, sort}
  Drop.fetchEvents = function (opts) {
    opts = opts || {};
    var params = {
      select: EVENT_SELECT,
      status: 'eq.published',
      order: opts.sort === 'new' ? 'created_at.desc' : 'date.asc',
      limit: opts.limit || 24
    };
    if (opts.offset) params.offset = opts.offset;

    // date window — default: from start-of-today forward.
    params.date = 'gte.' + (opts.from || todayISO());

    var and = [];
    if (opts.to) and.push('date.lte.' + opts.to);
    // City: exact match unless "All cities".
    if (opts.city && opts.city !== Drop.ALL_CITIES) {
      params.city = 'ilike.' + opts.city; // ilike = case-insensitive exact (no wildcards)
    }
    if (opts.venue) params.venue_name = 'ilike.' + opts.venue;
    if (opts.festival) params.is_festival = 'is.true';
    // Keyword: search title OR venue OR city via `or=`.
    if (opts.q) {
      var s = '*' + opts.q + '*';
      params.or = '(title.ilike.' + s + ',venue_name.ilike.' + s + ',city.ilike.' + s + ')';
    }

    var url = 'events?' + q(params);
    // Genre isn't a column — filter client-side after fetch (genres live on artists).
    return get(url).then(function (rows) {
      rows = rows || [];
      if (opts.genre) {
        var want = String(opts.genre).toLowerCase();
        rows = rows.filter(function (ev) { return Drop.genreOf(ev).toLowerCase() === want; });
      }
      return rows;
    });
  };

  Drop.fetchEvent = function (id) {
    return get('events?' + q({ select: EVENT_SELECT, id: 'eq.' + id, limit: 1 }))
      .then(function (rows) {
        if (!rows || !rows.length) throw new Error('not found');
        return rows[0];
      });
  };

  // Name-prefix + substring artist lookup for the search typeahead.
  Drop.searchArtists = function (query, limit) {
    return get('artists?' + q({
      select: 'id,name,image_url',
      name: 'ilike.*' + query + '*',
      order: 'name.asc',
      limit: limit || 4
    }));
  };

  Drop.fetchArtist = function (id) {
    var artistP = get('artists?' + q({ select: 'id,name,genres,image_url', id: 'eq.' + id, limit: 1 }));
    // Events for this artist, upcoming.
    var evP = get('events?' + q({
      select: EVENT_SELECT,
      status: 'eq.published',
      date: 'gte.' + todayISO(),
      order: 'date.asc',
      'event_artists.artists.id': 'eq.' + id,
      limit: 100
    })).then(function (rows) {
      // The nested filter above narrows the embed, not the parent — keep only events
      // that actually embed this artist.
      return (rows || []).filter(function (ev) {
        return (ev.event_artists || []).some(function (ea) {
          return ea.artists && String(ea.artists.id) === String(id);
        });
      });
    });
    return Promise.all([artistP, evP]).then(function (r) {
      if (!r[0] || !r[0].length) throw new Error('not found');
      return { artist: r[0][0], events: r[1] };
    });
  };

  // Anon-safe aggregate "going" counts — one batched RPC call for a list of event
  // ids. Server returns event_id+count only (no per-user rows); see
  // drop-backend/migrations/0004_event_going_counts.sql.
  Drop.fetchGoingCounts = function (ids) {
    ids = (ids || []).filter(Boolean);
    if (!ids.length) return Promise.resolve({});
    return fetch(REST + 'rpc/event_going_counts', {
      method: 'POST',
      headers: {
        apikey: SUPA_KEY, Authorization: 'Bearer ' + SUPA_KEY,
        'Content-Type': 'application/json'
      },
      referrerPolicy: 'no-referrer',
      body: JSON.stringify({ event_ids: ids })
    }).then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) {
        var map = {};
        (rows || []).forEach(function (row) { map[row.event_id] = row.going_count; });
        return map;
      })
      .catch(function () { return {}; }); // ponytail: social proof is decorative, never block the card
  };

  Drop.fetchVenue = function (name, city) {
    var params = {
      select: EVENT_SELECT,
      status: 'eq.published',
      date: 'gte.' + todayISO(),
      venue_name: 'ilike.' + name,
      order: 'date.asc',
      limit: 100
    };
    if (city) params.city = 'ilike.' + city;
    return get('events?' + q(params)).then(function (rows) {
      rows = rows || [];
      if (!rows.length) throw new Error('not found');
      var e0 = rows[0];
      return { venue: { name: e0.venue_name, city: e0.city, state: e0.state }, events: rows };
    });
  };

  // ---- Derived / formatting ----------------------------------------------
  // Genre bucket → used for label AND prism-art tint class.
  var GENRE_MAP = [
    { cls: 'g-techno', label: 'Techno', keys: ['techno', 'bass', 'dubstep', 'riddim', 'trap', 'hardstyle', 'hard techno'] },
    { cls: 'g-house', label: 'House', keys: ['house', 'melodic', 'tech house', 'deep house', 'progressive', 'trance', 'edm', 'electronic', 'dance'] },
    { cls: 'g-dnb', label: 'Drum & Bass', keys: ['drum and bass', 'drum & bass', 'dnb', 'd&b', 'jungle', 'breaks', 'breakbeat'] },
    { cls: 'g-hiphop', label: 'Hip-Hop', keys: ['hip hop', 'hip-hop', 'rap', 'r&b', 'rnb'] },
    { cls: 'g-indie', label: 'Indie', keys: ['indie', 'rock', 'pop', 'alternative', 'folk'] }
  ];

  // Genre strings too vague to bucket on their own — only match these when no
  // artist genre matched a specific key (they'd otherwise drag everything
  // electronic into "House").
  var GENERIC_KEYS = ['edm', 'electronic', 'dance', 'pop'];
  function isGeneric(g) {
    for (var i = 0; i < GENERIC_KEYS.length; i++) {
      if (g === GENERIC_KEYS[i]) return true;
    }
    return false;
  }

  // Map a raw genre string to a bucket, or null. skipGeneric: ignore
  // catch-all genres like "edm"/"electronic" (used for the first pass).
  function bucketFor(raw, skipGeneric) {
    if (!raw) return null;
    var g = String(raw).toLowerCase();
    if (skipGeneric && isGeneric(g)) return null;
    for (var i = 0; i < GENRE_MAP.length; i++) {
      var keys = GENRE_MAP[i].keys;
      for (var j = 0; j < keys.length; j++) {
        if (skipGeneric && isGeneric(keys[j])) continue;
        if (g.indexOf(keys[j]) !== -1) return GENRE_MAP[i];
      }
    }
    return null;
  }

  // Best bucket for an event: scan EVERY genre of EVERY artist, preferring a
  // specific match (e.g. "tech house", "dubstep") over a generic one ("edm").
  // The old genres[0]-of-first-artist read misclassified most events.
  function bestBucket(ev) {
    var arts = (ev && ev.event_artists) || [];
    var pass, i, j, a, b;
    for (pass = 0; pass < 2; pass++) {
      for (i = 0; i < arts.length; i++) {
        a = arts[i].artists;
        if (!a || !a.genres) continue;
        for (j = 0; j < a.genres.length; j++) {
          b = bucketFor(a.genres[j], pass === 0);
          if (b) return b;
        }
      }
    }
    return null;
  }

  Drop.genreOf = function (ev) {
    // Festivals bucket first — a festival is always "Festivals" regardless of its
    // artists' genres, so events.html?genre=Festivals never misses them.
    if (ev && ev.is_festival) return 'Festivals';
    var b = bestBucket(ev);
    return b ? b.label : 'Live music';
  };

  // Prism-art tint class for a raw genre string (used by artist cards, which have
  // no event to derive a tint from). Falls back to the neutral prism wash.
  Drop.genreCls = function (raw) {
    var b = bucketFor(raw);
    return b ? b.cls : 'g-other';
  };

  // Only trust http(s) URLs from the API before using them as an href — guards
  // against javascript:/data: values injected into ticket_url. Returns null if unsafe.
  Drop.safeUrl = function (u) {
    return /^https?:\/\//i.test(u || '') ? u : null;
  };

  // CSS class for prism-art tint, keyed off the display genre.
  Drop.genreClass = function (ev) {
    if (ev && ev.is_festival) return 'g-fest';
    var b = bestBucket(ev);
    return b ? b.cls : 'g-other';
  };

  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  Drop.fmtDate = function (iso, timeTbd) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var base = DOW[d.getDay()] + ', ' + MON[d.getMonth()] + ' ' + d.getDate();
    if (timeTbd) return base + ' · Time TBA';
    // Only append a time if the ISO carried one that isn't midnight-UTC placeholder.
    var h = d.getHours(), m = d.getMinutes();
    if (h === 0 && m === 0) return base;
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    var mm = m < 10 ? '0' + m : '' + m;
    return base + ' · ' + h12 + ':' + mm + ' ' + ap;
  };

  // Short date pieces for the artist-row date block.
  Drop.dateBlock = function (iso) {
    var d = new Date(iso);
    if (isNaN(d)) return { mon: '', day: '', dow: '' };
    return { mon: MON[d.getMonth()].toUpperCase(), day: '' + d.getDate(), dow: DOW[d.getDay()] };
  };

  Drop.fmtPrice = function (min, max) {
    var cur = '$';
    function n(v) { return cur + Math.round(v); }
    if (min == null && max == null) return 'See tickets';
    if (min != null && max != null && max > min) return n(min) + '–' + n(max);
    if (min != null) return 'From ' + n(min);
    if (max != null) return 'From ' + n(max);
    return 'See tickets';
  };

  // Google Maps search link (no embed — no API key needed).
  Drop.mapsUrl = function (name, city, state) {
    var qstr = [name, city, state].filter(Boolean).join(', ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(qstr);
  };
})();
