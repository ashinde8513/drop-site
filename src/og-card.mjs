// Branded 1200×630 share card for events with no usable art (D20, approved
// 2026-10-20): brand gradient, Drop mark + wordmark, title (≤2 lines), date,
// venue and city. Pure SVG builder; the Function rasterizes it with resvg.
const W = 1200, H = 630, PAD = 72;
const TITLE_CHARS = 24, TITLE_MAX_LINES = 2;

export function xml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

// Greedy word wrap by character budget (Space Grotesk 700 at 76 px ≈ 24
// chars per 1056 px line); the last line ellipsizes. ponytail: char count,
// not glyph metrics; swap for measured widths if titles start clipping.
export function wrapTitle(title, perLine = TITLE_CHARS, maxLines = TITLE_MAX_LINES) {
  const words = String(title || '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? line + ' ' + words[i] : words[i];
    if (next.length <= perLine) { line = next; continue; }
    if (line) lines.push(line);
    line = words[i].length > perLine ? words[i].slice(0, perLine - 1) + '…' : words[i];
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const used = lines.join(' ').replace(/…$/, '').split(' ').length;
  if (lines.length === maxLines && used < words.length && !lines[maxLines - 1].endsWith('…')) {
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = (last.length >= perLine ? last.slice(0, perLine - 1) : last) + '…';
  }
  return lines;
}

export function cardDate(event) {
  const zone = event?.time_tbd ? 'UTC' : event?.timezone || 'UTC';
  const date = new Date(event?.date);
  if (Number.isNaN(date.getTime())) return '';
  try { return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone }); }
  catch { return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }); }
}

export function cardSvg(event, backgroundBase64) {
  const lines = wrapTitle(event?.title || 'Live show');
  const titleTop = lines.length === 1 ? 330 : 290;
  const title = lines.map((line, i) => `<text x="${PAD}" y="${titleTop + i * 92}" font-family="Space Grotesk" font-weight="700" font-size="76" fill="#FFFFFF">${xml(line)}</text>`).join('');
  const meta = [cardDate(event), event?.venue_name].filter(Boolean).join(' · ');
  const place = [event?.city, event?.state].filter(Boolean).join(', ');
  const metaTop = titleTop + (lines.length - 1) * 92 + 80;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#4DE2FF"/><stop offset="52%" stop-color="#E24DFF"/><stop offset="100%" stop-color="#B6FF6A"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="#0B0D18"/>` +
    (backgroundBase64 ? `<image href="data:image/jpeg;base64,${backgroundBase64}" width="${W}" height="${H}"/>` : '') +
    // Mark: the favicon bars at 2x, then the wordmark.
    `<g transform="translate(${PAD} 64) scale(2)" fill="url(#g)"><rect x="4" y="15" width="3" height="8" rx="1.5"/><rect x="9" y="11" width="3" height="14" rx="1.5"/><rect x="14" y="6" width="3" height="21" rx="1.5"/><rect x="19" y="10" width="3" height="15" rx="1.5"/><rect x="24" y="14" width="3" height="9" rx="1.5"/></g>` +
    `<text x="${PAD + 72}" y="114" font-family="Space Grotesk" font-weight="700" font-size="48" fill="#FFFFFF">drop</text>` +
    title +
    (meta ? `<text x="${PAD}" y="${metaTop}" font-family="Sora" font-size="34" fill="#C4CCD8">${xml(meta)}</text>` : '') +
    (place ? `<text x="${PAD}" y="${metaTop + 50}" font-family="Sora" font-size="30" fill="#98A2B3">${xml(place)}</text>` : '') +
    `<text x="${PAD}" y="${H - 56}" font-family="Sora" font-size="26" fill="#8FD2FF">trydropapp.com</text></svg>`;
}
