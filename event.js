// Public event preview — fetch a published event via the Supabase anon
// client (RLS-protected, published-only) and render it. No service-role key.
// The anon/publishable key is safe to embed; row access is gated by RLS
// (anon_read_public_event_catalog migration). Fee % mirrors
// DropApp/src/lib/fees.ts (kept in sync manually — small static table).
// supabase-js is imported lazily (inside the IIFE, only when there's an id to
// fetch) so the no-id path never touches the network — keeps the Playwright
// smoke gate (fails on any console error / broken asset) green offline.

const SUPABASE_URL = 'https://ebccwnkmsnhbljxxxdej.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ZMsNcfhfqsGgyvsdBDTKHg__h8SDZyd';

const FEE_PCT = { ticketmaster: 0.27, seatgeek: 0.22, axs: 0.20, dice: 0.12, eventbrite: 0.08 };
const feePct = (v) => FEE_PCT[(v || '').toLowerCase().replace(/\s+/g, '')] ?? 0.15;

const params = new URLSearchParams(location.search);
const id = params.get('id');
const ref = params.get('ref');

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function showUnavailable() {
  const u = $('#ev-unavailable'); if (u) u.hidden = false;
  const m = $('#ev-main'); if (m) m.setAttribute('hidden', '');
}

(async () => {
  if (!id) return showUnavailable();
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data: ev, error } = await supabase
    .from('events')
    .select('id, title, date, venue_name, city, state, image_url, description, status')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !ev) return showUnavailable();

  // Header / meta
  const d = ev.date ? new Date(ev.date) : null;
  const dateStr = d
    ? d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase() +
      ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '';
  $('#ev-eyebrow').textContent = dateStr;
  $('#ev-title').textContent = ev.title;
  $('#ev-venue').textContent = [ev.venue_name, ev.city].filter(Boolean).join(' · ');
  document.title = `${ev.title} — Drop`;
  $('#og-title').setAttribute('content', `${ev.title} — Drop`);
  $('#og-desc').setAttribute('content', [ev.venue_name, ev.city].filter(Boolean).join(', ') || 'See who\'s going on Drop.');
  if (ev.image_url) $('#ev-hero').style.backgroundImage = `url("${ev.image_url}")`;
  $('#ev-about').textContent = ev.description || '';

  // ?ref= survival: preserve on the deep-link CTA so referral credit survives install.
  const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';
  const openA = $('#ev-open');
  if (openA) openA.href = `https://trydropapp.com/event/${encodeURIComponent(ev.id)}${suffix}`;

  // Lineup pills (via linked artists on the event, if the join is anon-readable).
  const { data: la } = await supabase
    .from('event_artists')
    .select('artist:artists(name)')
    .eq('event_id', ev.id)
    .limit(12);
  const names = (la || []).map((r) => r.artist && r.artist.name).filter(Boolean);
  const lineupEl = $('#ev-lineup');
  if (lineupEl && names.length) {
    lineupEl.innerHTML = names.map((n, i) => `<span class="ev-pill${i === 0 ? '' : ' dim'}">${esc(n)}</span>`).join('');
  }

  // Itemized all-in pricing (never collapsed). Cheapest offer's face value + fees.
  const { data: offers } = await supabase
    .from('ticket_offers')
    .select('price_min, vendor')
    .eq('event_id', ev.id)
    .not('price_min', 'is', null)
    .order('price_min', { ascending: true })
    .limit(1);
  const offer = offers && offers[0];
  if (offer && offer.price_min != null) {
    const face = Number(offer.price_min);
    const fees = Math.round(face * feePct(offer.vendor) * 100) / 100;
    $('#ev-price').textContent = `$${(face + fees).toFixed(2)}`;
    $('#ev-facevalue').textContent = `$${face.toFixed(2)}`;
    $('#ev-fees').textContent = `$${fees.toFixed(2)}`;
    $('#ev-ticket').hidden = false;
  } else {
    // No price data — still show the card with the CTA, hide the price rows.
    $('#ev-price').textContent = 'Free';
    $('#ev-ticket').hidden = false;
  }

  // Social proof: referrer display name (public) + aggregate going count.
  // Never expose private friend lists — only the visitor's own referrer + a count.
  // Degrades to hidden if anon RLS blocks either read (correct, safe default).
  let proof = '';
  if (ref) {
    const { data: r } = await supabase.from('profiles').select('display_name, username').eq('id', ref).maybeSingle();
    const name = r && (r.display_name || r.username);
    if (name) proof = `<span class="proof-name">${esc(name)}</span> invited you`;
  }
  const { count } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', ev.id)
    .eq('status', 'going');
  if (count) proof = proof ? `${proof} · ${count} going` : `${count} going on Drop`;
  const proofEl = $('#ev-proof');
  if (proofEl && proof) { proofEl.innerHTML = proof; proofEl.hidden = false; }
})().catch(showUnavailable);
