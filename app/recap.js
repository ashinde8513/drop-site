/*
 * app/recap.js — recap card (design spec 05).
 *
 * Photos stay on the device (A52): files are read into object URLs, drawn
 * onto a canvas and exported as a 1080×1920 PNG. Nothing is uploaded, and the
 * canvas re-encode drops EXIF (GPS included). Pure helpers (layout, labels,
 * file checks) are required by tests/recap.test.mjs; renderCard()/videoStill()
 * run in the browser only.
 */
(function (root) {
  'use strict';

  var MAX_PHOTOS = 4;
  var MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  var UNIT = { w: 320, h: 569, pad: 16, gap: 6, gridMargin: 12 }; // design unit; export is ×3.375

  // Cell rects (fractions of the grid box) for 1–4 photos, as on the Card-Frames board:
  // 1 full bleed · 2 stacked · 3 one large over two (rows 1.3fr / 1fr) · 4 two by two.
  // gap / gapY: the cell gap as a fraction of the grid width / height (equal px both ways).
  function cells(n, gap, gapY) {
    var g = gap || 0, v = gapY == null ? g : gapY, hw = (1 - g) / 2, hh = (1 - v) / 2;
    if (n <= 1) return [[0, 0, 1, 1]];
    if (n === 2) return [[0, 0, 1, hh], [0, hh + v, 1, hh]];
    if (n === 3) { var top = (1 - v) * 1.3 / 2.3; return [[0, 0, 1, top], [0, top + v, hw, 1 - top - v], [hw + g, top + v, hw, 1 - top - v]]; }
    return [[0, 0, hw, hh], [hw + g, 0, hw, hh], [0, hh + v, hw, hh], [hw + g, hh + v, hw, hh]];
  }

  function stars(rating) { return rating > 0 ? rating + ' stars' : ''; }
  // "Recap card: ODESZA, Red Rocks, Oct 23, 2026, 4 stars, 3 photos." (rating clause only when set)
  function cardLabel(d) {
    return 'Recap card: ' + [d.artist, d.venue, d.date, stars(d.rating), d.photos + (d.photos === 1 ? ' photo' : ' photos')].filter(Boolean).join(', ') + '.';
  }
  function metaLine(venue, date) { return [venue, date].filter(Boolean).join(', '); }
  function slug(s) { return String(s || 'show').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'show'; }

  // null = OK; otherwise the board's error copy.
  var FILE_ERROR = "That file didn't work. Use a JPG, PNG, or HEIC photo under 10 MB.";
  function fileError(f) {
    var type = String(f && f.type || '');
    if (/^video\//.test(type)) return null;
    if (!/^image\//.test(type) && !/\.(heic|heif)$/i.test(String(f && f.name || ''))) return FILE_ERROR;
    return f.size > MAX_IMAGE_BYTES ? FILE_ERROR : null;
  }

  // ---- browser only ----------------------------------------------------------
  function loadImage(url) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = function () { rej(new Error('decode failed')); };
      img.src = url; // <img> decode honours EXIF orientation
    });
  }
  // First frame (~0.1 s) of a video as a PNG object URL; the clip itself is never kept.
  function videoStill(file) {
    return new Promise(function (res, rej) {
      var src = URL.createObjectURL(file), v = document.createElement('video');
      var done = function (err, url) { URL.revokeObjectURL(src); v.removeAttribute('src'); if (err) rej(err); else res(url); };
      v.muted = true; v.playsInline = true; v.preload = 'metadata';
      v.onerror = function () { done(new Error('video decode failed')); };
      v.onloadeddata = function () { v.currentTime = Math.min(0.1, (v.duration || 0.2) / 2); };
      v.onseeked = function () {
        var c = document.createElement('canvas');
        c.width = v.videoWidth; c.height = v.videoHeight;
        c.getContext('2d').drawImage(v, 0, 0);
        c.toBlob(function (b) { if (b) done(null, URL.createObjectURL(b)); else done(new Error('still failed')); }, 'image/png');
      };
      v.src = src;
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function cover(ctx, img, x, y, w, h) {
    var s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
  }
  function wrapLines(ctx, text, maxW, maxLines) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    words.forEach(function (w) {
      var t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] += '…'; }
    return lines;
  }

  // d: { artist, meta, rating (0–5), urls: [photo object URLs] } → Promise<Blob> (1080×1920 PNG)
  function renderCard(d) {
    var K = 3.375, W = 1080, H = 1920, P = UNIT.pad * K;
    return Promise.all([
      document.fonts && document.fonts.load ? document.fonts.load('700 88px "Space Grotesk"').catch(function () {}) : null,
      document.fonts && document.fonts.load ? document.fonts.load('400 47px "Sora"').catch(function () {}) : null,
    ].concat(d.urls.map(loadImage))).then(function (all) {
      var imgs = all.slice(2);
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      var ctx = c.getContext('2d');
      roundRect(ctx, 0, 0, W, H, 68); ctx.clip();
      var g = ctx.createLinearGradient(0, 0, W * 0.6, H);
      g.addColorStop(0, '#2b1c4d'); g.addColorStop(0.55, '#0d3b52'); g.addColorStop(1, '#143a22');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // Drop mark + wordmark
      ctx.save(); ctx.translate(P + 24, P + 24); ctx.rotate(Math.PI / 4);
      var mg = ctx.createLinearGradient(-24, 0, 24, 0);
      mg.addColorStop(0, '#4DE2FF'); mg.addColorStop(0.52, '#E24DFF'); mg.addColorStop(1, '#B6FF6A');
      ctx.fillStyle = mg; roundRect(ctx, -24, -24, 48, 48, 4); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#FFFFFF'; ctx.font = '700 47px "Space Grotesk", system-ui, sans-serif'; ctx.textBaseline = 'middle';
      ctx.fillText('DROP', P + 75, P + 24);
      // Text block (bottom), measured first so the grid takes the rest
      ctx.font = '700 88px "Space Grotesk", system-ui, sans-serif';
      var artist = wrapLines(ctx, d.artist, W - 2 * P, 2);
      var metaH = 47 * 1.35, starH = d.rating > 0 ? 54 + 30 : 0;
      var textH = artist.length * 88 * 1.1 + 20 + metaH + starH;
      var gx = P, gy = P + 61 + UNIT.gridMargin * K, gw = W - 2 * P, gh = H - P - textH - UNIT.gridMargin * K - gy; // 61 = mark row (18 × 3.375)
      var gap = UNIT.gap * K;
      cells(imgs.length, gap / gw, gap / gh).forEach(function (r, i) {
        var x = gx + r[0] * gw, y = gy + r[1] * gh, w = r[2] * gw, h = r[3] * gh;
        ctx.save(); roundRect(ctx, x, y, w, h, 34); ctx.clip(); cover(ctx, imgs[i], x, y, w, h); ctx.restore();
      });
      var ty = H - P - textH;
      ctx.textBaseline = 'top'; ctx.fillStyle = '#FFFFFF'; ctx.font = '700 88px "Space Grotesk", system-ui, sans-serif';
      artist.forEach(function (l, i) { ctx.fillText(l, P, ty + i * 88 * 1.1); });
      ty += artist.length * 88 * 1.1 + 20;
      ctx.fillStyle = '#C4CCD8'; ctx.font = '400 47px "Sora", system-ui, sans-serif';
      ctx.fillText(wrapLines(ctx, d.meta, W - 2 * P, 1)[0] || '', P, ty);
      if (d.rating > 0) {
        ty += metaH + 30; ctx.font = '54px system-ui, sans-serif';
        for (var s = 0; s < 5; s++) { ctx.fillStyle = '#FFCB3D'; ctx.fillText(s < d.rating ? '★' : '☆', P + s * 66, ty); }
      }
      return new Promise(function (res, rej) { c.toBlob(function (b) { if (b) res(b); else rej(new Error('export failed')); }, 'image/png'); });
    });
  }

  var api = { MAX_PHOTOS: MAX_PHOTOS, FILE_ERROR: FILE_ERROR, cells: cells, cardLabel: cardLabel, metaLine: metaLine, slug: slug, fileError: fileError, renderCard: renderCard, videoStill: videoStill };
  root.DropRecap = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
