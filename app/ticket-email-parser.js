(function (root) {
  'use strict';

  const MONTHS = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
  const SUBJECT_PREFIXES = [
    /^your ticketmaster order (confirmation|is confirmed)\s*[-–—:|]?\s*/i,
    /^ticketmaster order confirmation\s*[-–—:|]?\s*/i,
    /^your axs tickets? (for|to|-)\s*/i,
    /^your seatgeek (tickets|order)\s*[-–—:|]?\s*/i,
    /^you'?re going to (see\s*)?/i,
    /^your tickets? (to|for|-)\s*/i,
    /^your order (for|confirmation for)\s*/i,
    /^order confirmed\s*[-–—:|]?\s*/i,
    /^order confirmation\s*[-–—:|]?\s*/i,
    /^(your )?tickets? confirmed\s*[-–—:|]?\s*/i,
    /^confirmation\s*[-–—:|]?\s*/i,
  ];
  const GENERIC = new Set([
    'tour','live','official','the tour','dj set','set','concert','tickets','ticket','vip',
    'presents','featuring','feat','with','and','more','tba','tbd','special guest',
    'special guests','guest','guests','various artists','an evening with',
  ]);

  function iso(year, month, day) {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  }

  function parseShowDate(text) {
    let match = String(text || '').match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (match) return iso(+match[1], +match[2], +match[3]);
    match = String(text || '').match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
    if (match && MONTHS[match[1].slice(0, 3).toLowerCase()]) return iso(+match[3], MONTHS[match[1].slice(0, 3).toLowerCase()], +match[2]);
    match = String(text || '').match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/);
    if (match && MONTHS[match[2].slice(0, 3).toLowerCase()]) return iso(+match[3], MONTHS[match[2].slice(0, 3).toLowerCase()], +match[1]);
    match = String(text || '').match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
    return match ? iso(+match[3], +match[1], +match[2]) : null;
  }

  function htmlToText(input) {
    const withLines = String(input || '')
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*\/\s*(p|div|tr|td|th|li|h[1-6]|table|ul|ol)\s*>/gi, '\n');
    const doc = new DOMParser().parseFromString(withLines, 'text/html');
    return (doc.body.textContent || '')
      .replace(/\r/g, '')
      .split('\n')
      .map(function (line) { return line.replace(/\s+/g, ' ').trim(); })
      .filter(Boolean)
      .join('\n');
  }

  function cleanSubject(subject) {
    let value = String(subject || '').trim();
    for (const prefix of SUBJECT_PREFIXES) {
      const next = value.replace(prefix, '');
      if (next !== value) { value = next; break; }
    }
    return value
      .replace(/\s*[-–—|]\s*(order )?confirmation.*$/i, '')
      .replace(/\s+(is |are )?confirmed[.!]?$/i, '')
      .trim();
  }

  function splitArtists(input) {
    const parts = String(input || '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .split(/\s*(?:,|\+|·|•|\bx\b|\bvs\b\.?|\bb2b\b|\bfeat\b\.?|\bfeaturing\b)\s*/i);
    const seen = new Set();
    return parts.reduce(function (out, part) {
      const name = part
        .replace(/\s*[-–—:]\s*([^-–—:]*\btour\b|live|world tour)\s*$/i, '')
        .replace(/\s+tour$/i, '')
        .trim();
      const key = name.toLowerCase();
      if (name && !GENERIC.has(key) && !seen.has(key)) { seen.add(key); out.push(name); }
      return out;
    }, []);
  }

  function detectSource(email) {
    const text = [email.sender, email.subject, email.body].join(' ').toLowerCase();
    if (/ticketmaster|livenation\.com/.test(text)) return 'ticketmaster';
    if (/axs\.com|@axs\b|\baxs\b/.test(text)) return 'axs';
    if (/dice\.fm|@dice\b|\bdice\b/.test(text)) return 'dice';
    if (/seatgeek/.test(text)) return 'seatgeek';
    if (/eventbrite/.test(text)) return 'eventbrite';
    return 'unknown';
  }

  function clean(value) {
    return value.replace(/\s+/g, ' ').trim().replace(/[.,•·]+$/, '').trim();
  }

  function extractLocation(lines) {
    for (let i = 0; i < lines.length; i++) {
      let match = lines[i].match(/^(.+?),\s*([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\b\.?$/);
      if (match) return { venueName:clean(match[1]), city:clean(match[2]), state:match[3] };
      match = lines[i].match(/^([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\b\.?$/);
      if (match) {
        const previous = i > 0 ? lines[i - 1] : '';
        const noisy = !previous || parseShowDate(previous) || /^(your|order|thank|confirm|hi |hello|dear|doors|view |get |add to)/i.test(previous);
        return { venueName:noisy ? null : clean(previous), city:clean(match[1]), state:match[2] };
      }
    }
    return { venueName:null, city:null, state:null };
  }

  function parseTicketEmail(email) {
    const subject = String(email.subject || '');
    const body = htmlToText(email.body || '');
    const eventName = cleanSubject(subject);
    const location = extractLocation(body.split('\n'));
    return {
      source: detectSource(email),
      eventName: eventName,
      artists: splitArtists(eventName),
      date: parseShowDate(subject + '\n' + body),
      venueName: location.venueName,
      city: location.city,
      state: location.state,
    };
  }

  root.DropTicketEmail = { parseTicketEmail:parseTicketEmail };
})(window);
