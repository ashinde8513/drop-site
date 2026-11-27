// Per-event share image served from our own origin: the event's art (or a
// performer photo), byte-checked and re-served with the right Content-Type,
// else the brand card. Fixes third-party art that crawlers reject (SeeTickets
// answers PNGs as application/x-www-form-urlencoded) or that has gone 404.
export const BRAND_IMAGE = 'https://trydropapp.com/og-image.png';
export const MAX_BYTES = 5 * 1024 * 1024;

export function imageType(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  return null;
}

export function artCandidates(event) {
  const performers = (event?.event_artists || []).map((entry) => entry.artists).filter(Boolean);
  return [event?.image_url, ...performers.map((artist) => artist.image_url)].filter((url) => {
    try { return httpsOnly(new URL(url)); } catch { return false; }
  }).slice(0, 3);
}

const httpsOnly = (url) => url.protocol === 'https:' && !url.username && !url.password;

// Redirects are followed by hand so every hop is checked like the first URL:
// a 302 to http:// or to a user@host address is a miss, not a fetch.
async function fetchHttps(url, fetcher) {
  for (let hop = 0; hop < 3; hop++) {
    const response = await fetcher(url, { headers: { Accept: 'image/*' }, redirect: 'manual', signal: AbortSignal.timeout(4000) });
    if (response.status < 300 || response.status > 399) return response;
    const next = new URL(response.headers.get('location') || '', url);
    if (!httpsOnly(next)) return null;
    url = next.href;
  }
  return null;
}

// HEAD shares the GET cache entry. Uncached, every HEAD repeated the upstream
// fetches (or the card render), so a cheap probe cost more than a real view.
export async function headAsGet(context, serve) {
  if (context.request.method !== 'HEAD') return serve(context);
  const response = await serve({ ...context, request: new Request(context.request.url), waitUntil: (work) => context.waitUntil(work) });
  return new Response(null, response);
}

// Reads at most MAX_BYTES, cancelling the stream past the cap, so a missing or
// false Content-Length can't make the edge buffer an unbounded body.
export async function readCapped(response) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

// First candidate that is a real image under the size cap, or null.
export async function fetchArt(candidates, fetcher = fetch) {
  for (const url of candidates) {
    try {
      const response = await fetchHttps(url, fetcher);
      if (!response?.ok) continue;
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > MAX_BYTES) continue;
      const bytes = await readCapped(response);
      const type = bytes ? imageType(bytes) : null;
      if (type) return { bytes, type };
    } catch { /* next candidate */ }
  }
  return null;
}
