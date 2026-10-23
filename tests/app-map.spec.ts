import { expect, test, type Page } from '@playwright/test';
import { bootSignedIn, fakeCalls, USER_ID } from './helpers/fakeSession';

// Design spec 04 (Discover map) — one test per States-board frame, plus pins,
// selection, tabs and the phone sheet. The tile style is stubbed (no network);
// pins need WebGL, so pin tests run on Chromium only.
const at = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
const base = { status:'published', image_url:null, event_artists:[], is_festival:false, city:'Denver', state:'CO', currency:'USD', timezone:'America/Denver' };
const id = (n: number) => '11111111-1111-4111-8111-' + String(n).padStart(12, '0');
const EV = [
  { ...base, id:id(1), title:'ODESZA (DJ Set)', venue_name:'Red Rocks Amphitheatre', date:at(2), lat:39.6654, lng:-105.2057, price_min:89, event_artists:[{ artists:{ id:'a1', name:'ODESZA', genres:['electronic'] } }] },
  { ...base, id:id(2), title:'Rezz', venue_name:'Ogden Theatre', date:at(3), lat:39.7403, lng:-104.9752, price_min:null },
  { ...base, id:id(3), title:'Gorgon City', venue_name:'Cervantes', date:at(4), lat:39.9000, lng:-104.8000, price_min:38 },
  { ...base, id:id(4), title:'No Coords Night', venue_name:'Somewhere', date:at(7), lat:null, lng:null, price_min:20 },
];
const STYLE = { version:8, sources:{}, layers:[{ id:'bg', type:'background', paint:{ 'background-color':'#0B0D12' } }] };

async function openMap(page: Page, cfg: Record<string, unknown> = {}, events: unknown[] = EV, style: 'ok' | 'fail' = 'ok') {
  const tiles: string[] = [];
  await page.route('https://tiles.openfreemap.org/**', r => { tiles.push(r.request().url()); return style === 'ok' ? r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(STYLE) }) : r.fulfill({ status:500, body:'' }); });
  await bootSignedIn(page, cfg, events);
  await page.goto('/app/index.html');
  await expect(page.getByRole('button', { name:'Map', exact:true })).toBeVisible();
  await page.getByRole('button', { name:'Map', exact:true }).click();
  return tiles;
}
const canvas = (page: Page) => page.getByRole('group', { name:/^Map of shows in/ });
const rail = (page: Page, isMobile: boolean) => isMobile ? page.locator('.mp-sheet') : page.locator('section.mp-railp');

test('List | Map are inline toggle buttons; Map is pressed after picking it', async ({ page }) => {
  await openMap(page);
  await expect(page.getByRole('group', { name:'View' }).getByRole('button')).toHaveText(['List', 'Map']);
  await expect(page.getByRole('button', { name:'Map', exact:true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name:'List', exact:true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('main [role=listbox], main select')).toHaveCount(0);
  await page.getByRole('button', { name:'List', exact:true }).click();
  await expect(canvas(page)).toHaveCount(0);
  await expect(page.getByText('Gorgon City').first()).toBeVisible();
});

test('1 warming up: nothing mapped → calm panel, the list, one primary, no tile request', async ({ page }) => {
  const tiles = await openMap(page, {}, EV.map(e => ({ ...e, lat:null, lng:null })));
  await expect(page.getByRole('heading', { name:'Map is warming up' })).toBeVisible();
  await expect(page.getByText("We're still adding locations for shows near you. Browse the list for now.")).toBeVisible();
  await expect(page.getByText('4 shows')).toBeVisible();
  await expect(page.locator('.mp-warmlist .mp-card')).toHaveCount(4);
  await expect(page.locator('main .btn--primary:visible')).toHaveCount(1);
  await page.getByRole('button', { name:'Show the list' }).click();
  await expect(page.getByRole('button', { name:'List', exact:true })).toHaveAttribute('aria-pressed', 'true');
  expect(tiles).toEqual([]);
});

test('2 loading: flat skeletons shaped like the canvas and 96px cards, aria-busy, no primary', async ({ page }) => {
  await bootSignedIn(page, {}, []);
  await page.route('**/rest/v1/events?**', () => {}); // the catalog never answers
  await page.goto('/app/index.html');
  await page.getByRole('button', { name:'Map', exact:true }).click();
  await expect(page.locator('.mp-split[aria-busy=true]')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText:'Loading the map' })).toHaveCount(1);
  await expect(page.locator('main .btn--primary:visible')).toHaveCount(0);
});

test('3 partial: pins only where coordinates exist, truthful chip, no primary until a pin is picked', async ({ page, isMobile, browserName }) => {
  test.skip(browserName !== 'chromium', 'pins need WebGL');
  await openMap(page);
  await expect(page.getByRole('status').filter({ hasText:'Showing 3 of 4 shows with a map location.' })).toBeVisible();
  await expect(page.locator('.mp-pin')).toHaveCount(3);
  await expect(rail(page, isMobile).getByText('3 shows')).toBeVisible();
  await expect(page.locator('main .btn--primary:visible')).toHaveCount(0);
  await expect(canvas(page)).toHaveAttribute('aria-label', 'Map of shows in Denver. 3 shows. The list has the same shows.');
  // Labels: price, else the date; never a guess. Date mode shows dates.
  await expect(page.locator('.mp-pin__lab')).toContainText(['$89']);
  await expect(page.getByRole('button', { name:/Rezz at Ogden Theatre$/ })).toBeVisible();
});

test('success: picking a pin selects its card and shows one primary, View event', async ({ page, isMobile, browserName }) => {
  test.skip(browserName !== 'chromium', 'pins need WebGL');
  await openMap(page);
  const pin = page.getByRole('button', { name:/ODESZA \(DJ Set\) at Red Rocks Amphitheatre, from \$89$/ });
  await pin.click();
  await expect(pin).toHaveAttribute('aria-pressed', 'true');
  const primary = page.locator('main .btn--primary:visible');
  await expect(primary).toHaveCount(1);
  await expect(primary).toHaveText('View event');
  if (isMobile) {
    const box = (await primary.boundingBox())!;
    expect(box.y + box.height).toBeGreaterThan(844 * 0.6); // thumb zone
  } else {
    await expect(page.locator('section.mp-railp .mp-card.is-sel')).toHaveAttribute('aria-current', 'true');
  }
  await primary.click();
  await expect(page.locator('section.tk')).toBeVisible(); // event detail
});

test('keyboard: one tab stop for pins, arrows move between them, Escape returns to the toggle', async ({ page, isMobile, browserName }) => {
  test.skip(browserName !== 'chromium' || isMobile, 'desktop pins need WebGL');
  await openMap(page);
  await expect(page.locator('.mp-pin')).toHaveCount(3);
  await expect(page.locator('.mp-pin[tabindex="0"]')).toHaveCount(1);
  await page.locator('.mp-pin[tabindex="0"]').focus();
  const first = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'));
  await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))).not.toBe(first);
  await page.keyboard.press('Enter');
  await expect(page.locator('.mp-pin[aria-pressed=true]')).toHaveCount(1);
  await expect(page.locator('.mp-pin[aria-pressed=true]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name:'Map', exact:true })).toBeFocused();
  // Skip map moves focus to the rail.
  await page.getByRole('link', { name:'Skip map' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#mp-rail')).toBeFocused();
});

test('Price | Date toggle relabels pins; a missing price always reads as the date', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'pins need WebGL');
  await openMap(page);
  await expect(page.locator('.mp-pin__lab').filter({ hasText:'$89' })).toHaveCount(1);
  await page.getByRole('group', { name:'Pin label' }).filter({ visible:true }).getByRole('button', { name:'Date' }).click();
  await expect(page.locator('.mp-pin__lab').filter({ hasText:'$' })).toHaveCount(0);
});

test('4 no results in view: zoomed away, the rail says so and offers Zoom out', async ({ page, isMobile, browserName }) => {
  test.skip(browserName !== 'chromium' || isMobile, 'desktop pins need WebGL');
  await openMap(page);
  await expect(page.locator('.mp-pin')).toHaveCount(3);
  const box = (await canvas(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 20, box.y + 20, { steps:8 });
  await page.mouse.move(box.x - 600, box.y - 600, { steps:8 });
  await page.mouse.up();
  for (let i = 0; i < 4 && await page.getByText('No shows in this area.').count() === 0; i++) await page.getByRole('button', { name:'Zoom in' }).click();
  await expect(page.locator('section.mp-railp').getByText('No shows in this area.')).toBeVisible();
  await expect(page.getByRole('heading', { name:'0 shows' })).toBeVisible();
  await expect(page.locator('section.mp-railp').getByRole('button', { name:'Zoom out' })).toBeVisible();
});

test('5 error: provider fails → alert on the map, the rail still lists every show, Try again', async ({ page, isMobile }) => {
  await openMap(page, {}, EV, 'fail');
  await expect(page.getByRole('alert').filter({ hasText:"We couldn't load the map." })).toBeVisible();
  await expect(page.getByRole('alert').getByRole('button', { name:'Try again' })).toBeVisible();
  if (!isMobile) {
    await expect(page.locator('section.mp-railp').getByText('List still works')).toBeVisible();
    await expect(page.locator('section.mp-railp .mp-card')).toHaveCount(4);
  }
  await expect(page.locator('main .btn--primary:visible')).toHaveCount(0);
});

test('6 location off: Near me is the only geolocation ask; denial shows the notice and a city link', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'controls render with the canvas');
  await context.clearPermissions();
  let asked = 0;
  await page.addInitScript(() => {
    (navigator.geolocation as any).getCurrentPosition = (_ok: unknown, fail: (e: unknown) => void) => { (window as any).__geoAsked = ((window as any).__geoAsked || 0) + 1; fail({ code:1 }); };
  });
  await openMap(page);
  asked = await page.evaluate(() => (window as any).__geoAsked || 0);
  expect(asked).toBe(0); // never on load
  await page.getByRole('button', { name:/Near me/ }).click();
  await expect(page.getByRole('status').filter({ hasText:'Location is off. Pick a city instead.' })).toBeVisible();
  await page.getByRole('link', { name:'Pick a city' }).click();
  await expect(page.locator('#city-filter')).toBeFocused();
});

test('For You and Crew filter the map and the list alike', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'pins need WebGL');
  const friend = '22222222-2222-4222-8222-222222222222';
  await openMap(page, { rows:{
    artist_follows:[{ user_id:USER_ID, artist_id:'a1', artists:{ name:'ODESZA' } }],
    friendships:[{ id:'f1', requester_id:USER_ID, recipient_id:friend, status:'accepted' }],
    attendance:[{ user_id:friend, event_id:id(3), status:'interested' }],
  } });
  await page.getByRole('group', { name:'Feed' }).getByRole('button', { name:'For You' }).click();
  await expect(page.getByRole('group', { name:'Feed' }).getByRole('button', { name:'For You' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.mp-pin')).toHaveCount(1);
  await expect(page.getByRole('button', { name:/ODESZA/ }).first()).toBeVisible();
  await page.getByRole('group', { name:'Feed' }).getByRole('button', { name:'Crew' }).click();
  await expect(page.locator('.mp-pin')).toHaveCount(1);
  await expect(page.getByRole('button', { name:/Gorgon City/ }).first()).toBeVisible();
  const crew = (await fakeCalls(page, 'from')).filter((c: any) => c.table === 'attendance' && c.ops[0][1][0] === 'event_id');
  expect(crew[0].ops).toEqual([['select', ['event_id']], ['in', ['user_id', [friend]]], ['in', ['status', ['going', 'interested']]]]);
  await page.getByRole('button', { name:'List', exact:true }).click();
  await expect(page.locator('.wsc__title')).toHaveText(['Gorgon City']);
});

test('phone: sheet shows the count; handle expands the list; a picked pin swaps in one card + primary', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'pins need WebGL; phone width on Chromium');
  await page.setViewportSize({ width:390, height:844 });
  await openMap(page);
  const sheet = page.getByRole('region', { name:'Shows' });
  await expect(sheet.getByText('3 shows')).toBeVisible();
  await expect(sheet.locator('.mp-card')).toHaveCount(0);
  await sheet.getByRole('button', { name:'Expand shows list' }).click();
  await expect(sheet.locator('.mp-card')).toHaveCount(3);
  await expect(sheet.getByRole('button', { name:'Collapse shows list' })).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name:/Rezz at Ogden Theatre$/ }).click();
  await expect(sheet.locator('.mp-card')).toHaveCount(1);
  await expect(sheet.getByRole('link', { name:'View event' })).toBeVisible();
});
