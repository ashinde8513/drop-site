// Server copy of data.js GENRE_MAP / bucketFor / bestBucket / Drop.genreOf and the
// fetchEvents genre filter, so crawlable pages bucket shows exactly like the
// browser does. tests/entity-seo.test.mjs runs data.js in a VM to keep them equal.
const GENRE_MAP = [
  { label: 'Bass', keys: ['bass', 'dubstep', 'riddim', 'trap'] },
  { label: 'Techno', keys: ['techno', 'hard techno', 'hardstyle'] },
  { label: 'House', keys: ['house', 'melodic', 'tech house', 'deep house', 'progressive', 'trance', 'edm', 'electronic', 'dance'] },
  { label: 'Drum & Bass', keys: ['drum and bass', 'drum & bass', 'dnb', 'd&b', 'jungle', 'breaks', 'breakbeat'] },
  { label: 'Hip-Hop', keys: ['hip hop', 'hip-hop', 'rap', 'r&b', 'rnb'] },
  { label: 'Indie', keys: ['indie', 'rock', 'pop', 'alternative', 'folk'] },
];
const GENERIC_KEYS = new Set(['edm', 'electronic', 'dance', 'pop']);

function bucketFor(raw, skipGeneric) {
  if (!raw) return null;
  const g = String(raw).toLowerCase();
  if (skipGeneric && GENERIC_KEYS.has(g)) return null;
  return GENRE_MAP.find((bucket) => bucket.keys.some((key) => !(skipGeneric && GENERIC_KEYS.has(key)) && g.includes(key))) || null;
}

export function genreOf(event) {
  if (event?.is_festival) return 'Festivals';
  const artists = (event?.event_artists || []).map((entry) => entry.artists).filter(Boolean);
  for (const skipGeneric of [true, false]) {
    for (const artist of artists) {
      for (const raw of artist.genres || []) {
        const bucket = bucketFor(raw, skipGeneric);
        if (bucket) return bucket.label;
      }
    }
  }
  return 'Live music';
}

export function matchesGenre(event, genre) {
  const want = String(genre).toLowerCase();
  return genreOf(event).toLowerCase() === want ||
    (event?.event_artists || []).some((entry) => (entry.artists?.genres || []).some((g) => String(g).toLowerCase() === want));
}
