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
    try { return new URL(url).protocol === 'https:'; } catch { return false; }
  }).slice(0, 3);
}

// First candidate that is a real image under the size cap, or null.
export async function fetchArt(candidates, fetcher = fetch) {
  for (const url of candidates) {
    try {
      const response = await fetcher(url, { headers: { Accept: 'image/*' }, redirect: 'follow', signal: AbortSignal.timeout(4000) });
      if (!response.ok) continue;
      const declared = Number(response.headers.get('content-length') || 0);
      if (declared > MAX_BYTES) continue;
      const bytes = new Uint8Array(await response.arrayBuffer());
      const type = bytes.length <= MAX_BYTES ? imageType(bytes) : null;
      if (type) return { bytes, type };
    } catch { /* next candidate */ }
  }
  return null;
}
