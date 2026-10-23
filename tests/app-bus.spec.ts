import { expect, test, type Page } from '@playwright/test';
import { bootSignedIn, fakeCalls } from './helpers/fakeSession';

// Board Spec01-Bus-Options: "Bus to the show" pickups inside the Tickets card.
const EV_ID = '9bd6c283-051a-42d5-a1a6-b01ba64266a4';
const START = Date.now() + 5 * 86400000;
const iso = (ms: number) => new Date(ms).toISOString();
const EVENT = { id:EV_ID, title:'Prism Nights', date:iso(START), timezone:'America/Denver', venue_name:'Red Rocks Amphitheatre', city:'Denver', state:'CO', status:'published', image_url:null, event_artists:[], is_festival:false, ticket_url:null, price_min:null, price_max:null };
const ETIX = (id: number) => 'https://etix.prf.hn/click/camref:1100l5NLJm/pubref:' + id + '/destination:' + encodeURIComponent('https://www.etix.com/ticket/p/' + id + '/bus');
const AXS = { id:'00000000-0000-4000-8000-000000000001', event_id:EV_ID, vendor:'AXS', kind:'primary', url:'https://www.axs.com/e/2', price_min:89, price_max:null, currency:'USD', price_includes_fees:false, last_seen_at:iso(Date.now() - 86400000) };
let n = 0;
const bus = (o: object) => ({ id:'b' + n++, event_id:EV_ID, kind:'bus', provider:'etix', title:'Prism Bus To Show Pickup Spot (FREE EVENT)', url:null, starts_at:iso(START - 3 * 3600000), pickup_name:'Union Station', pickup_city:'Denver', pickup_state:'CO', price_min:null, price_max:null, currency:'USD', ...o });

const card = (page: Page) => page.locator('section.tk');
const group = (page: Page) => card(page).getByRole('group', { name:'Bus to the show' });
async function open(page: Page, rows: Record<string, unknown>, event: object = EVENT, extra: Record<string, unknown> = {}) {
  await bootSignedIn(page, { signedOut:true, rows:{ ticket_offers:[AXS], ...rows }, ...extra }, [event]);
  await page.goto('/app/index.html');
  await page.getByText('Prism Nights').first().click();
  await expect(card(page).getByRole('heading', { name:'Tickets' })).toBeVisible();
}

test('one pickup, no price: a secondary "Buy on Etix" under the group; the ticket primary stays the only primary', async ({ page, isMobile }) => {
  const one = bus({ url:ETIX(77) });
  await open(page, { event_add_ons:[one] });
  const q = (await fakeCalls(page, 'from')).find((c: any) => c.table === 'event_add_ons');
  expect(q.ops).toEqual([
    ['select', ['id,kind,provider,title,url,starts_at,pickup_name,pickup_city,pickup_state,price_min,price_max,currency']],
    ['eq', ['event_id', EV_ID]], ['eq', ['kind', 'bus']], ['order', ['starts_at', { ascending:true }]],
  ]);
  await expect(group(page)).toBeVisible();
  await expect(group(page)).toContainText('Pickup spots and times from the bus seller. Times are Mountain Time, the show’s time zone.');
  const pick = group(page).getByRole('radiogroup', { name:'Bus pickups, 1 option' }).getByRole('radio');
  await expect(pick).toHaveAccessibleName(/^Union Station, Denver, CO, pickup \d{1,2}:\d\d [AP]M, price not listed, booking link available$/);
  await expect(pick).toHaveAttribute('aria-checked', 'true');
  const busBuy = group(page).getByRole('link', { name:'Buy on Etix, bus from Union Station, Denver' });
  await expect(busBuy).toHaveAttribute('href', ETIX(77));
  await busBuy.scrollIntoViewIfNeeded();
  await expect(busBuy).toBeVisible();
  await expect(busBuy).toHaveAttribute('rel', 'noopener sponsored');
  await expect(busBuy).toHaveClass(/btn--secondary/);
  await expect(card(page).locator('.btn--primary:visible')).toHaveCount(isMobile ? 0 : 1); // phone: the bar holds the primary
  await expect(card(page).getByText('Drop may earn a commission on ticket and bus links.')).toBeVisible();
  await expect(group(page)).not.toContainText('FREE');
});

test('several pickups: sorted, 3 + "Show 1 more", a row without a link is shown but skipped', async ({ page }) => {
  await open(page, { event_add_ons:[
    bus({ pickup_name:'Belmar Center', pickup_city:'Lakewood', starts_at:iso(START - 1.5 * 3600000), url:ETIX(4) }),
    bus({ pickup_name:'14th & Walnut', pickup_city:'Boulder', starts_at:iso(START - 2 * 3600000) }),
    bus({ pickup_name:'Union Station', starts_at:iso(START - 3 * 3600000), url:ETIX(1) }),
    bus({ pickup_name:'Colorado Blvd Park-n-Ride', starts_at:iso(START - 2.5 * 3600000), url:ETIX(2) }),
    bus({ pickup_name:'Already left', starts_at:iso(Date.now() - 60000), url:ETIX(9) }),
  ] });
  const radios = group(page).getByRole('radio');
  await expect(radios).toHaveCount(3);
  await expect(radios.nth(0)).toHaveAccessibleName(/^Union Station/);
  await expect(radios.nth(1)).toHaveAccessibleName(/^Colorado Blvd Park-n-Ride/);
  await expect(radios.nth(2)).toHaveAccessibleName(/^14th & Walnut, Boulder, CO, .*booking link not available$/);
  await expect(radios.nth(2)).toHaveAttribute('aria-disabled', 'true');
  await expect(radios.nth(2)).toContainText('Booking link not available');
  const more = group(page).getByRole('button', { name:'Show 1 more bus pickup' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(radios).toHaveCount(4);
  await expect(group(page).getByRole('button', { name:'Show fewer bus pickups' })).toHaveAttribute('aria-expanded', 'true');
  // Arrows walk bookable pickups only: Colorado Blvd -> (skip 14th & Walnut) -> Belmar.
  await radios.nth(0).focus();
  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(radios.nth(3)).toBeFocused();
  await expect(radios.nth(3)).toHaveAttribute('aria-checked', 'true');
  await expect(group(page).getByRole('link', { name:'Buy on Etix, bus from Belmar Center, Lakewood' })).toHaveAttribute('href', ETIX(4));
  await radios.nth(2).click({ force:true }); // not selectable
  await expect(radios.nth(3)).toHaveAttribute('aria-checked', 'true');
});

test('no link on any pickup: a plain list and one line, never a dead button', async ({ page }) => {
  await open(page, { event_add_ons:[bus({ pickup_name:'Union Station' }), bus({ pickup_name:'Belmar Center', pickup_city:'Lakewood', starts_at:iso(START - 3600000) })] });
  await expect(group(page)).toContainText('Booking links aren’t available for these pickups yet.');
  await expect(group(page).getByRole('radiogroup')).toHaveCount(0);
  await expect(group(page).getByRole('list', { name:'Bus pickups, 2 options' }).getByRole('listitem')).toHaveCount(2);
  await expect(group(page).getByRole('link')).toHaveCount(0);
});

test('pickup name missing: the seller title is cut before its claims; a set price reads "Listed from", 0 reads "Free"', async ({ page }) => {
  await open(page, { event_add_ons:[bus({ pickup_name:null, pickup_city:'Lakewood', url:ETIX(5), price_min:12, price_max:12 }), bus({ pickup_name:'Belmar Center', starts_at:iso(START - 3600000), url:ETIX(6), price_min:0, price_max:0 })] });
  const radios = group(page).getByRole('radio');
  await expect(radios.nth(0)).toContainText('Prism Bus To Show Pickup…');
  await expect(radios.nth(0)).toContainText('Listed from $12');
  await expect(radios.nth(1)).toContainText('Free');
  await expect(group(page)).not.toContainText('FREE EVENT');
});

test('no bus rows, a failed load, or an ended show: no group at all', async ({ page }) => {
  await open(page, {});
  await expect(group(page)).toHaveCount(0);
  await expect(card(page).getByText('Drop may earn a commission on ticket links.')).toBeVisible();
});

test('a failed bus load only hides the group', async ({ page }) => {
  await open(page, { event_add_ons:[bus({ url:ETIX(7) })] }, EVENT, { errors:{ 'event_add_ons.select':'relation does not exist' } });
  await expect(card(page).getByRole('radio', { name:/^AXS/ })).toBeVisible();
  await expect(group(page)).toHaveCount(0);
});

test('ended show: the ended card replaces everything, even with bus rows', async ({ page }) => {
  // Past shows aren't on Discover: open it while upcoming, then move the clock past its end.
  await page.clock.install();
  await open(page, { event_add_ons:[bus({ url:ETIX(8) })] });
  await expect(group(page)).toBeVisible();
  await page.clock.setSystemTime(START + 13 * 3600000);
  await card(page).getByRole('radio', { name:/^AXS/ }).click(); // any re-render
  await expect(card(page).getByText('This show has ended.')).toBeVisible();
  await expect(group(page)).toHaveCount(0);
});

test('when the ticket seller is also Etix the bus button says "Buy bus on Etix"', async ({ page }) => {
  const etixTicket = { ...AXS, id:'00000000-0000-4000-8000-000000000009', vendor:'Etix', url:ETIX(55) };
  await open(page, { ticket_offers:[etixTicket], event_add_ons:[bus({ url:ETIX(77) })] });
  await expect(group(page).getByRole('link', { name:'Buy bus on Etix, from Union Station, Denver' })).toHaveText(/Buy bus on Etix/);
});

test('phone: the group sits under the sellers in the page and after the primary in the sheet', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await open(page, { ticket_offers:[AXS, { ...AXS, id:'00000000-0000-4000-8000-000000000002', vendor:'Ticketmaster', url:'https://www.ticketmaster.com/e/1', price_min:92 }], event_add_ons:[bus({ url:ETIX(77) })] });
  await expect(group(page)).toBeVisible();
  await page.locator('.ed-bottombar').getByRole('button', { name:/Choose a seller/ }).click();
  const sheet = page.getByRole('dialog', { name:'Choose where to buy' });
  const order = await sheet.evaluate(d => [...d.querySelectorAll('.tk__buy, .bs')].map(e => e.className.split(' ')[0]));
  expect(order).toEqual(['btn', 'bs']);
  await expect(sheet.getByRole('group', { name:'Bus to the show' }).getByRole('link', { name:/^Buy on Etix, bus from/ })).toBeVisible();
});

test('a11y: bus rows and buttons are at least 44px; secondary text clears 4.5:1', async ({ page }) => {
  await open(page, { event_add_ons:[bus({ url:ETIX(1) }), bus({ pickup_name:'14th & Walnut', starts_at:iso(START - 2 * 3600000) })] });
  const res = await group(page).evaluate(g => {
    const rgb = (c: string) => c.match(/[\d.]+/g)!.map(Number);
    const lum = (c: string) => { const [r, gg, b] = rgb(c).slice(0, 3).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
    const bgOf = (el: Element | null): string => { for (; el; el = el.parentElement) { const c = getComputedStyle(el).backgroundColor, a = rgb(c)[3]; if (a === undefined || a === 1) return c; } return 'rgb(11,13,18)'; };
    const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    return {
      small: [...g.querySelectorAll('button, a')].filter(e => e.getBoundingClientRect().height < 43.5).map(e => e.textContent),
      low: [...g.querySelectorAll('.tk__sub, .tk-row__line, .tk-row__lab, .bs-st, .tk-row__amt, .tk-row__name')].map(e => ratio(getComputedStyle(e).color, bgOf(e))).filter(r => r < 4.5),
    };
  });
  expect(res).toEqual({ small:[], low:[] });
});
