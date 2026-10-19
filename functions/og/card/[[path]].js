// /og/card/<event-id>: the branded share card (src/og-card.mjs) as a PNG.
// Rasterizing costs real CPU, so results are edge-cached for a day and any
// failure falls back to the static brand card.
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import gradient from '../../../src/og-assets/gradient-1200x630.jpg.bin';
import spaceGrotesk from '../../../src/og-assets/space-grotesk-700.ttf.bin';
import sora from '../../../src/og-assets/sora-600.ttf.bin';
import { cardSvg } from '../../../src/og-card.mjs';
import { BRAND_IMAGE } from '../../../src/og-image.mjs';
import { edgeCached, getEvent, routeId } from '../../../src/entity-seo.mjs';

let ready = null;
const FONTS = [new Uint8Array(spaceGrotesk), new Uint8Array(sora)];
const BACKGROUND = btoa(String.fromCharCode(...new Uint8Array(gradient)));

export function onRequest(context) {
  return edgeCached(context, () => render(context));
}

async function render({ params, request }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const url = new URL(request.url);
  if (url.search) return new Response(null, { status: 301, headers: { Location: url.pathname } });
  const fallback = () => new Response(null, { status: 302, headers: { Location: BRAND_IMAGE, 'Cache-Control': 'public, max-age=3600' } });
  const id = routeId(params.path);
  const event = id ? await getEvent(id).catch(() => null) : null;
  if (!event) return fallback();
  try {
    ready ||= initWasm(resvgWasm);
    await ready;
    const png = new Resvg(cardSvg(event, BACKGROUND), { font: { fontBuffers: FONTS, loadSystemFonts: false, defaultFontFamily: 'Sora' } }).render().asPng();
    return new Response(request.method === 'HEAD' ? null : png, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, s-maxage=86400', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' },
    });
  } catch {
    return fallback();
  }
}
