/*
 * app/map.js — Discover map (design spec 04).
 *
 * Pure helpers (pin labels and names, screen-space clustering, counts) are
 * required by tests/map.test.mjs. createMapView() lazy-loads the self-hosted
 * MapLibre GL JS 6 (vendor/maplibre/, BSD-3-Clause) only when Map is
 * picked, with OpenFreeMap's no-key dark style (A51: free provider, $0,
 * commercial use allowed per openfreemap.org, checked 2026-10-23).
 */
(function (root) {
  'use strict';

  var STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
  var HIT = 44; // px: pin hit area; pins closer than this cluster (WCAG 2.5.8)

  function tz(ev) { return ev.timezone || 'America/Denver'; }
  function fmt(ev, opts) {
    try { return new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: tz(ev) }, opts)).format(new Date(ev.date)); }
    catch (e) { return ''; }
  }
  // "Fri 23": date mode, and the fallback whenever no price is known.
  function dateLabel(ev) { return fmt(ev, { weekday: 'short' }) + ' ' + fmt(ev, { day: 'numeric' }); }
  // Lowest known price as "$89" via the spec 01 formatter; never "$0", never a guess.
  function priceText(ev, formatAmount) {
    var raw = ev.price_min != null ? ev.price_min : ev.price_max;
    var price = raw == null || raw === '' ? NaN : Number(raw);
    var cur = String(ev.currency || 'USD').trim().toUpperCase();
    return isFinite(price) && price > 0 && /^[A-Z]{3}$/.test(cur) ? formatAmount(price, cur) : '';
  }
  function pinLabel(ev, mode, formatAmount) {
    return (mode === 'price' && priceText(ev, formatAmount)) || dateLabel(ev);
  }
  // "Friday 23 Oct, ODESZA at Red Rocks, from $89, you're going"
  function pinName(ev, status, formatAmount) {
    var when = fmt(ev, { weekday: 'long' }) + ' ' + fmt(ev, { day: 'numeric' }) + ' ' + fmt(ev, { month: 'short' });
    var price = priceText(ev, formatAmount);
    return [when, ev.title + (ev.venue_name ? ' at ' + ev.venue_name : ''), price ? 'from ' + price : '',
      status === 'going' ? "you're going" : status === 'interested' ? "you're interested" : ''].filter(Boolean).join(', ');
  }
  function countLabel(n) { return n + (n === 1 ? ' show' : ' shows'); }

  // Greedy screen-space clusters: points [{id,x,y}] → [{ids,x,y}]. The selected
  // id never clusters. ponytail: O(n²); fine for a city's few hundred pins,
  // switch to a grid index if a view ever holds thousands.
  function cluster(points, selectedId, minDist) {
    var d = minDist || HIT, out = [];
    points.forEach(function (p) {
      if (p.id !== selectedId) {
        for (var i = 0; i < out.length; i++) {
          var c = out[i];
          if (!c.locked && Math.abs(c.x - p.x) < d && Math.abs(c.y - p.y) < d) {
            c.ids.push(p.id); c.x += (p.x - c.x) / c.ids.length; c.y += (p.y - c.y) / c.ids.length;
            return;
          }
        }
      }
      out.push({ ids: [p.id], x: p.x, y: p.y, locked: p.id === selectedId });
    });
    return out.map(function (c) { return { ids: c.ids, x: c.x, y: c.y }; });
  }

  // ---- MapLibre controller (browser only) ----------------------------------
  // The SPA rebuilds its DOM on every render, so the map lives in one
  // persistent element that mount() re-parents into #mp-slot. Pins are
  // MapLibre markers (real <button>s) synced from plain data on every render.
  function createMapView(opts) {
    var el = document.createElement('div');
    el.className = 'mp-gl';
    var map = null, gl = null, markers = {}, data = { pins: [], selectedId: null }, ready = null, focusId = null;
    // The first fit can run before the page CSS sizes the container; refit on resize until the user moves the map.
    var lastFit = null, touched = false, FIT = { padding: 64, maxZoom: 13, duration: 0 };

    function load() {
      if (ready) return ready;
      var base = '/vendor/maplibre/'; // site root on both hosts (the app-host Worker passes /vendor/ through)
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = base + 'maplibre-gl.css';
      document.head.appendChild(css);
      ready = import(base + 'maplibre-gl.mjs').then(function (mod) {
        gl = mod.default || mod;
        map = new gl.Map({ container: el, style: STYLE_URL, center: opts.center, zoom: opts.zoom || 11,
          attributionControl: { compact: false }, dragRotate: false, pitchWithRotate: false, touchPitch: false });
        map.touchZoomRotate.disableRotation();
        map.on('movestart', function (e) { if (e.originalEvent) touched = true; });
        if (typeof ResizeObserver === 'function') new ResizeObserver(function () { if (!map) return; map.resize(); if (lastFit && !touched) map.fitBounds(lastFit, FIT); }).observe(el);
        map.on('moveend', function () { recluster(); opts.onMove(visibleIds()); });
        map.on('error', function (e) { if (!map.loaded() && opts.onError) opts.onError(e && e.error); });
        return new Promise(function (res) { map.once('load', function () { res(map); }); });
      });
      ready.catch(function (e) { if (opts.onError) opts.onError(e); });
      return ready;
    }

    function visibleIds() {
      if (!map) return [];
      var b = map.getBounds();
      return data.pins.filter(function (p) { return b.contains([p.lng, p.lat]); }).map(function (p) { return p.id; });
    }

    function pinEl(key) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'mp-pin'; b.dataset.key = key;
      b.innerHTML = '<span class="mp-pin__dot" aria-hidden="true"></span><span class="mp-pin__lab" aria-hidden="true"></span>';
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var c = b._ids || [];
        if (c.length > 1) { map.easeTo({ center: map.unproject([b._x, b._y]), zoom: map.getZoom() + 2, duration: 0 }); return; }
        opts.onSelect(c[0]);
      });
      b.addEventListener('keydown', onPinKey);
      return b;
    }

    // Arrow keys move between pins in reading order (roving tabindex); Escape leaves the map.
    function onPinKey(e) {
      var list = Object.keys(markers).map(function (k) { return markers[k].getElement(); })
        .sort(function (a, b) { return (a._y - b._y) || (a._x - b._x); });
      var i = list.indexOf(e.currentTarget), j = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % list.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + list.length) % list.length;
      else if (e.key === 'Escape') { e.preventDefault(); opts.onEscape(); return; }
      if (j < 0) return;
      e.preventDefault();
      list.forEach(function (b, k) { b.tabIndex = k === j ? 0 : -1; });
      focusId = list[j].dataset.key;
      list[j].focus();
    }

    function recluster() {
      if (!map) return;
      var pts = data.pins.map(function (p) { var s = map.project([p.lng, p.lat]); return { id: p.id, x: s.x, y: s.y }; });
      var groups = cluster(pts, data.selectedId);
      var byId = {}; data.pins.forEach(function (p) { byId[p.id] = p; });
      var keep = {};
      groups.forEach(function (g) {
        var key = g.ids.length > 1 ? 'c:' + g.ids.slice().sort().join(',') : g.ids[0];
        keep[key] = true;
        var m = markers[key];
        // addTo() re-appends the element (dropping focus), so only new markers get it.
        if (!m) { m = markers[key] = new gl.Marker({ element: pinEl(key), anchor: 'center' }).setLngLat(map.unproject([g.x, g.y])).addTo(map); }
        else m.setLngLat(map.unproject([g.x, g.y]));
        var b = m.getElement(), p = byId[g.ids[0]];
        b._ids = g.ids; b._x = g.x; b._y = g.y;
        // classList, not className: MapLibre keeps its own marker classes on the element.
        var many = g.ids.length > 1, sel = !many && p.id === data.selectedId;
        b.classList.toggle('mp-pin--cluster', many);
        b.classList.toggle('mp-pin--going', !many && p.status === 'going');
        b.classList.toggle('mp-pin--interested', !many && p.status === 'interested');
        b.classList.toggle('is-sel', sel);
        b.classList.toggle('is-flip', !many && g.x > el.clientWidth - 140);
        if (many) {
          b.querySelector('.mp-pin__dot').textContent = g.ids.length;
          b.querySelector('.mp-pin__lab').textContent = '';
          b.setAttribute('aria-label', countLabel(g.ids.length) + ' here. Zoom in to see them.');
          b.removeAttribute('aria-pressed');
        } else {
          b.querySelector('.mp-pin__dot').innerHTML = p.status === 'going' ? '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>'
            : p.status === 'interested' ? '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>'
            : '<i class="mp-pin__dot2"></i>';
          b.querySelector('.mp-pin__lab').textContent = p.label;
          b.setAttribute('aria-label', p.name);
          b.setAttribute('aria-pressed', sel ? 'true' : 'false');
        }
      });
      Object.keys(markers).forEach(function (k) { if (!keep[k]) { markers[k].remove(); delete markers[k]; } });
      // One tab stop for the whole pin group: the focused or selected pin, else the first.
      var els = Object.keys(markers).map(function (k) { return markers[k].getElement(); });
      var stop = markers[focusId] || markers[data.selectedId] || markers[Object.keys(markers)[0]];
      els.forEach(function (b) { b.tabIndex = stop && b === stop.getElement() ? 0 : -1; });
    }

    return {
      el: el,
      // Re-parent into the freshly rendered slot and apply the latest data.
      attach: function (slot, next) {
        if (el.parentNode !== slot) slot.appendChild(el);
        var fresh = next.pins !== data.pins || next.selectedId !== data.selectedId;
        data = next;
        load().then(function () {
          map.resize();
          if (next.fit && next.pins.length) {
            var b = new gl.LngLatBounds();
            next.pins.forEach(function (p) { b.extend([p.lng, p.lat]); });
            lastFit = b; touched = false;
            map.fitBounds(b, FIT);
          } else if (fresh) { recluster(); opts.onMove(visibleIds()); }
        });
      },
      zoom: function (d) { touched = true; if (map) map.easeTo({ zoom: map.getZoom() + d, duration: 0 }); },
      zoomOut: function () { touched = true; if (map) map.easeTo({ zoom: Math.max(3, map.getZoom() - 2), duration: 0 }); },
      panTo: function (lng, lat) { touched = true; if (map) map.jumpTo({ center: [lng, lat] }); },
      centerOn: function (lng, lat, zoom) { touched = true; if (map) map.jumpTo({ center: [lng, lat], zoom: zoom || Math.max(map.getZoom(), 12) }); },
      reset: function () { ready = null; if (map) map.remove(); map = null; markers = {}; },
    };
  }

  var api = { dateLabel: dateLabel, priceText: priceText, pinLabel: pinLabel, pinName: pinName, countLabel: countLabel, cluster: cluster, createMapView: createMapView, STYLE_URL: STYLE_URL };
  root.DropMap = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
