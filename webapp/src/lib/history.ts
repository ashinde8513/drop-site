import type { DropEvent } from '../discovery';

export type CalendarEntry = {
  id: string;
  title: string;
  location: string | null;
  startDate: Date;
  calendarDate: string;
};

export type ImportCandidate = {
  key: string;
  title: string;
  date: string;
  location: string | null;
  confidence: 'artist' | 'venue' | 'keyword';
  artist: string | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  eventId: string | null;
};

export type HistoryMedia = {
  id: string;
  userId: string;
  showKey: string;
  name: string;
  type: string;
  size: number;
  addedAt: number;
  blob: Blob;
};
type StoredHistoryMedia = Omit<HistoryMedia, 'blob'> & { blob?: Blob; bytes?: ArrayBuffer };

const SHOW_WORDS = ['concert', 'festival', 'rave', 'tour', 'presents', 'tickets', 'doors at', 'doors open', 'dj set', 'live at', 'live in', 'nightclub', 'afterparty', 'b2b'];
const MEDIA_DB = 'drop-history-media';
const MEDIA_STORE = 'media';
const MEDIA_INDEX = 'by-show';
const MEDIA_BUDGET = 250 * 1024 * 1024;
const MEDIA_FILE_BUDGET = 100 * 1024 * 1024;
const MEDIA_FILE_LIMIT = 100;
const MAX_CALENDAR_ENTRIES = 1_000;
const MAX_IMPORT_CANDIDATES = 250;
const pad = (value: number) => String(value).padStart(2, '0');

export function normalizeHistoryText(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function localDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function eventCalendarDate(event: Pick<DropEvent, 'date' | 'timezone'>) {
  const date = new Date(event.date);
  if (Number.isNaN(date.getTime()) || !event.timezone) return event.date.slice(0, 10);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: event.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
  } catch {
    return event.date.slice(0, 10);
  }
}

function unescapeIcs(value: string) {
  return value.replace(/\\n/gi, '\n').replace(/\\([\\;,])/g, '$1');
}

function parseIcsDate(value: string) {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second, utc] = match;
  const parts = [Number(year), Number(month) - 1, Number(day), Number(hour ?? 0), Number(minute ?? 0), Number(second ?? 0)] as const;
  const date = utc ? new Date(Date.UTC(...parts)) : new Date(...parts);
  const read = utc
    ? [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
    : [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
  if (Number.isNaN(date.getTime()) || read.some((value, index) => value !== parts[index])) return null;
  const authoredDate = `${year}-${month}-${day}`;
  return { date, calendarDate: utc ? localDate(date) : authoredDate };
}

export function parseIcs(text: string): CalendarEntry[] {
  const entries: CalendarEntry[] = [];
  let active = false;
  let summary = '';
  let location = '';
  let uid = '';
  let start: Date | null = null;
  let calendarDate = '';
  for (const line of text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
    if (/^BEGIN:VEVENT/i.test(line)) {
      active = true;
      summary = '';
      location = '';
      uid = '';
      start = null;
      calendarDate = '';
      continue;
    }
    if (/^END:VEVENT/i.test(line)) {
      if (active && summary && start && calendarDate) entries.push({
        id: uid || `ics-${entries.length}`,
        title: unescapeIcs(summary).slice(0, 500),
        location: location ? unescapeIcs(location).slice(0, 500) : null,
        startDate: start,
        calendarDate,
      });
      if (entries.length >= MAX_CALENDAR_ENTRIES) break;
      active = false;
      continue;
    }
    if (!active) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const [rawName] = line.slice(0, separator).split(';');
    const name = rawName.toUpperCase();
    const value = line.slice(separator + 1).trim();
    if (name === 'SUMMARY') summary = value;
    else if (name === 'LOCATION') location = value;
    else if (name === 'UID') uid = value;
    else if (name === 'DTSTART') {
      const parsed = parseIcsDate(value);
      start = parsed?.date ?? null;
      calendarDate = parsed?.calendarDate ?? '';
    }
  }
  return entries;
}

function contains(haystack: string, needle: string) {
  return needle.length > 2 && ` ${haystack} `.includes(` ${needle} `);
}

export function buildImportCandidates(
  entries: CalendarEntry[],
  catalog: DropEvent[],
  existing: Array<{ date: string; title: string }>,
  knownArtists: Array<{ name: string }> = [],
  knownVenues: Array<{ venue_name: string; city: string | null; state: string | null }> = [],
) {
  const today = localDate(new Date());
  const existingByDay = new Map<string, string[]>();
  for (const show of existing) {
    const date = show.date.slice(0, 10);
    const values = existingByDay.get(date) ?? [];
    values.push(normalizeHistoryText(show.title));
    existingByDay.set(date, values);
  }
  const artists = new Map<string, string>();
  const venues = new Map<string, { venue_name: string | null; city: string | null; state: string | null }>();
  for (const artist of knownArtists) if (artist.name) artists.set(normalizeHistoryText(artist.name), artist.name);
  for (const venue of knownVenues) if (venue.venue_name) venues.set(normalizeHistoryText(venue.venue_name), venue);
  for (const event of catalog) {
    if (event.venue_name) venues.set(normalizeHistoryText(event.venue_name), event);
    for (const row of event.event_artists) {
      if (row.artists?.name) artists.set(normalizeHistoryText(row.artists.name), row.artists.name);
    }
  }

  const seen = new Set<string>();
  const candidates: ImportCandidate[] = [];
  let alreadyLogged = 0;
  for (const entry of entries) {
    if (candidates.length >= MAX_IMPORT_CANDIDATES) break;
    const title = entry.title.trim();
    const date = entry.calendarDate || localDate(entry.startDate);
    if (!title || date >= today) continue;
    const normalized = normalizeHistoryText(title);
    const key = `${date}|${normalized}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const duplicate = (existingByDay.get(date) ?? []).some((value) => contains(normalized, value) || contains(value, normalized));
    if (duplicate) {
      alreadyLogged += 1;
      continue;
    }
    const artistMatch = [...artists].filter(([name]) => contains(normalized, name)).sort((left, right) => right[0].length - left[0].length)[0];
    const venueHaystack = normalizeHistoryText(`${title} ${entry.location ?? ''}`);
    const venueMatch = [...venues].filter(([name]) => name.length >= 5 && contains(venueHaystack, name)).sort((left, right) => right[0].length - left[0].length)[0];
    const keyword = SHOW_WORDS.some((word) => contains(venueHaystack, normalizeHistoryText(word)));
    if (!artistMatch && !venueMatch && !keyword) continue;
    const linked = catalog.find((event) => {
      if (eventCalendarDate(event) !== date) return false;
      const names = [event.title, ...event.event_artists.map((row) => row.artists?.name ?? '')]
        .map(normalizeHistoryText).filter(Boolean);
      return names.some((name) => contains(normalized, name) || contains(name, normalized));
    }) ?? null;
    candidates.push({
      key,
      title,
      date,
      location: entry.location?.trim() || null,
      confidence: artistMatch ? 'artist' : venueMatch ? 'venue' : 'keyword',
      artist: artistMatch?.[1] ?? null,
      venue: venueMatch?.[1].venue_name ?? entry.location?.trim() ?? null,
      city: venueMatch?.[1].city ?? null,
      state: venueMatch?.[1].state ?? null,
      eventId: linked?.id ?? null,
    });
  }
  candidates.sort((left, right) => right.date.localeCompare(left.date));
  return { candidates, alreadyLogged };
}

function openMediaDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB, 2);
    request.onupgradeneeded = () => {
      const store = request.result.objectStoreNames.contains(MEDIA_STORE)
        ? request.transaction!.objectStore(MEDIA_STORE)
        : request.result.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
      if (!store.indexNames.contains(MEDIA_INDEX)) store.createIndex(MEDIA_INDEX, ['userId', 'showKey']);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function mediaTransaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, done: (value: T) => void, fail: (error?: unknown) => void) => void) {
  return openMediaDb().then((db) => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(MEDIA_STORE, mode);
    let result: T;
    let failed = false;
    const fail = (error?: unknown) => {
      if (failed) return;
      failed = true;
      try { transaction.abort(); } catch { /* transaction already finished */ }
      db.close();
      reject(error ?? transaction.error ?? new Error('Local media transaction failed.'));
    };
    run(transaction.objectStore(MEDIA_STORE), (value) => { result = value; }, fail);
    transaction.oncomplete = () => {
      db.close();
      if (!failed) resolve(result!);
    };
    transaction.onabort = () => fail(transaction.error);
    transaction.onerror = () => fail(transaction.error);
  }));
}

export function listHistoryMedia(userId: string, showKey: string) {
  return mediaTransaction<HistoryMedia[]>('readonly', (store, done, fail) => {
    const request = store.index(MEDIA_INDEX).getAll(IDBKeyRange.only([userId, showKey]));
    request.onsuccess = () => done((request.result as StoredHistoryMedia[])
      .sort((left, right) => right.addedAt - left.addedAt)
      .map((item) => ({
        ...item,
        blob: item.blob instanceof Blob ? item.blob : new Blob([item.bytes ?? new ArrayBuffer(0)], { type: item.type }),
      })));
    request.onerror = () => fail(request.error);
  });
}

export async function addHistoryMedia(userId: string, showKey: string, files: File[]) {
  const accepted = files.filter((file) => /^(image|video)\//.test(file.type));
  let rejected = files.length - accepted.length;
  const current = await listHistoryMedia(userId, showKey);
  let used = current.reduce((sum, item) => sum + item.size, 0);
  const additions: HistoryMedia[] = [];
  for (const file of accepted) {
    if (file.size > MEDIA_FILE_BUDGET || used + file.size > MEDIA_BUDGET || current.length + additions.length >= MEDIA_FILE_LIMIT) {
      rejected += 1;
      continue;
    }
    used += file.size;
    additions.push({
      id: crypto.randomUUID(),
      userId,
      showKey,
      name: file.name,
      type: file.type,
      size: file.size,
      addedAt: Date.now(),
      blob: new Blob([file], { type: file.type }),
    });
  }
  for (const { blob, ...item } of additions) {
    const stored = { ...item, bytes: await blob.arrayBuffer() } satisfies StoredHistoryMedia;
    await mediaTransaction<void>('readwrite', (store, done, fail) => {
      const storedRequest = store.put(stored);
      storedRequest.onsuccess = () => done();
      storedRequest.onerror = () => fail(storedRequest.error);
    });
  }
  return { items: await listHistoryMedia(userId, showKey), rejected };
}

export async function deleteHistoryMediaForUser(userId: string) {
  await mediaTransaction<void>('readwrite', (store, done, fail) => {
    const request = store.index(MEDIA_INDEX).openCursor(IDBKeyRange.bound([userId, ''], [userId, '\uffff']));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return done();
      const deletion = cursor.delete();
      deletion.onerror = () => fail(deletion.error);
      cursor.continue();
    };
    request.onerror = () => fail(request.error);
  });
}

export async function removeHistoryMedia(id: string) {
  await mediaTransaction<void>('readwrite', (store, done, fail) => {
    const request = store.delete(id);
    request.onsuccess = () => done();
    request.onerror = () => fail(request.error);
  });
}

export function parseRatedNote(raw: string | null) {
  if (!raw) return { rating: 0, note: '' };
  const match = raw.match(/^Rated (\d+(?:\.5)?)\/(5|10) ★(?: — ([\s\S]*))?$/);
  if (!match) return { rating: 0, note: raw };
  const rating = Number(match[1]) * (match[2] === '5' ? 2 : 1);
  return Number.isInteger(rating) && rating >= 1 && rating <= 10
    ? { rating, note: match[3] ?? '' }
    : { rating: 0, note: raw };
}

export function composeRatedNote(rating: number, note: string) {
  const clean = note.trim();
  const valid = Number.isInteger(rating) && rating >= 1 && rating <= 10 ? rating : 0;
  return [valid ? `Rated ${valid / 2}/5 ★` : '', clean].filter(Boolean).join(' — ') || null;
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, maxLines = 3) {
  const words = text.split(/\s+/);
  let line = '';
  let row = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= width || !line) {
      line = next;
      continue;
    }
    context.fillText(line, x, y + row * lineHeight);
    row += 1;
    if (row >= maxLines) return;
    line = word;
  }
  if (line && row < maxLines) context.fillText(line, x, y + row * lineHeight);
}

async function drawCover(context: CanvasRenderingContext2D, blob: Blob, x: number, y: number, width: number, height: number) {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.max(width / bitmap.width, height / bitmap.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  context.drawImage(bitmap, (bitmap.width - sourceWidth) / 2, (bitmap.height - sourceHeight) / 2, sourceWidth, sourceHeight, x, y, width, height);
  bitmap.close();
}

export async function createRecapPng(input: {
  title: string;
  venue: string;
  date: string;
  rating: number;
  artists: string[];
  crew: string[];
  media: HistoryMedia[];
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');
  const background = context.createLinearGradient(0, 0, 1080, 1920);
  background.addColorStop(0, '#0b2032');
  background.addColorStop(0.48, '#321145');
  background.addColorStop(1, '#12251d');
  context.fillStyle = background;
  context.fillRect(0, 0, 1080, 1920);
  const media = input.media.filter((item) => item.type.startsWith('image/')).slice(0, 4);
  const cells = media.length <= 1
    ? [[0, 0, 1080, 1220]]
    : media.length === 2
      ? [[0, 0, 540, 1220], [540, 0, 540, 1220]]
      : [[0, 0, 540, 610], [540, 0, 540, 610], [0, 610, 540, 610], [540, 610, 540, 610]];
  await Promise.all(media.map((item, index) => drawCover(context, item.blob, ...(cells[index] as [number, number, number, number]))));
  const shade = context.createLinearGradient(0, 900, 0, 1920);
  shade.addColorStop(0, 'rgba(7,8,12,0)');
  shade.addColorStop(0.32, 'rgba(7,8,12,.9)');
  shade.addColorStop(1, '#07080c');
  context.fillStyle = shade;
  context.fillRect(0, 700, 1080, 1220);
  context.fillStyle = '#4de2ff';
  context.font = '700 28px system-ui';
  context.fillText('FROM THAT NIGHT · DROP', 72, 1190);
  context.fillStyle = '#fff';
  context.font = '700 76px system-ui';
  wrapCanvasText(context, input.title, 72, 1295, 936, 88, 3);
  context.fillStyle = '#b3bac8';
  context.font = '500 32px system-ui';
  wrapCanvasText(context, `${input.date} · ${input.venue}`, 72, 1580, 936, 42, 2);
  context.fillStyle = '#e24dff';
  context.font = '700 34px system-ui';
  context.fillText(input.rating ? `${input.rating / 2}/5 ★` : 'A night worth remembering', 72, 1700);
  context.fillStyle = '#b3bac8';
  context.font = '500 26px system-ui';
  const artistLine = input.artists.filter(Boolean).slice(0, 6).join(' · ');
  if (artistLine) wrapCanvasText(context, artistLine, 72, 1765, 936, 34, 2);
  if (input.crew.length) context.fillText(`With ${input.crew.slice(0, 5).join(', ')}`, 72, 1860);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create recap image.')), 'image/png', 0.95));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
