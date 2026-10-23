import { expect, test, type Page } from '@playwright/test';
import { bootSignedIn, fakeCalls } from './helpers/fakeSession';

// Design spec 01 (multi-seller ticket card) — one test per States-board frame,
// plus selection, keyboard, the phone bar + sheet, and the same-show merge.
const EV_ID = '9bd6c283-051a-42d5-a1a6-b01ba64266a4';
const SIB_ID = '5f0c1e9a-7f4b-4c55-9d2e-1b7d0c7c2f11';
const at = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const DATE = at(5);
const EVENT = { id:EV_ID, title:'Prism Nights', date:DATE, venue_name:'Mission Ballroom', city:'Denver', state:'CO', status:'published', image_url:null, event_artists:[], is_festival:false, ticket_url:'https://www.tixr.com/e/1', price_min:40, price_max:60 };
const fresh = at(-1);
let n = 0;
const offer = (o: object) => ({ id:'00000000-0000-4000-8000-' + String(n++).padStart(12, '0'), event_id:EV_ID, kind:'primary', currency:'USD', price_min:null, price_max:null, price_includes_fees:false, last_seen_at:fresh, ...o });
const AXS = offer({ vendor:'AXS', url:'https://www.axs.com/e/2', price_min:89 });
const TM = offer({ vendor:'Ticketmaster', url:'https://www.ticketmaster.com/e/1', price_min:92 });
const SG = offer({ vendor:'SeatGeek', url:'https://seatgeek.com/e/3', price_min:95 });

const card = (page: Page) => page.locator('section.tk');
const rows = (page: Page) => card(page).getByRole('radio');
const buy = (page: Page, isMobile: boolean) => isMobile ? page.locator('.ed-bottombar').getByRole('link', { name:/^Buy on / }) : card(page).getByRole('link', { name:/^Buy on / });

async function openDetail(page: Page, cfg: Record<string, unknown>, event: object = EVENT) {
  await bootSignedIn(page, { signedOut:true, ...cfg }, [event]);
  await page.goto('/app/index.html');
  await page.getByText((event as any).title).first().click();
  await expect(card(page).getByRole('heading', { name:'Tickets' })).toBeVisible();
}

test('2 multiple sellers: cheapest first, tagged, pre-selected, one primary that names the seller', async ({ page, isMobile }) => {
  await openDetail(page, { rows:{ ticket_offers:[SG, TM, AXS] } });
  const offers = (await fakeCalls(page, 'from')).filter((c: any) => c.table === 'ticket_offers');
  expect(offers[0].ops).toEqual([
    ['select', ['id,event_id,vendor,url,price_min,price_max,currency,price_includes_fees,kind,last_seen_at,last_refreshed,fetched_at']],
    ['in', ['event_id', [EV_ID]]],
  ]);
  await expect(card(page).getByRole('radiogroup', { name:'Ticket sellers' })).toBeVisible();
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(0)).toHaveAccessibleName('AXS, listed from $89, lowest listed');
  await expect(rows(page).nth(1)).toHaveAccessibleName('Ticketmaster, listed from $92');
  await expect(rows(page).nth(2)).toHaveAccessibleName('SeatGeek, listed from $95');
  await expect(rows(page).nth(0)).toHaveAttribute('aria-checked', 'true');
  await expect(card(page).getByText('Lowest listed')).toHaveCount(1);
  await expect(card(page).getByText('Same show, 3 sellers — compare listed prices to find the best deal.')).toBeVisible();
  await expect(card(page).getByText('Prices are what each seller shows us. Fees may be added at checkout. Drop may earn a commission on ticket links.')).toBeVisible();
  await expect(card(page).getByRole('link', { name:/Prices via SeatGeek/ })).toHaveAttribute('href', 'https://seatgeek.com');
  const primary = buy(page, isMobile);
  await expect(primary).toHaveText(/Buy on AXS/);
  await expect(primary).toHaveAttribute('href', 'https://www.axs.com/e/2');
  await expect(primary).toHaveAttribute('target', '_blank');
  await expect(primary).toHaveAttribute('rel', 'noopener sponsored');
  await expect(primary).toHaveAccessibleDescription('Opens in a new tab');
  // Exactly one visible primary on the page; Going is secondary.
  await expect(page.locator('main .btn--primary:visible')).toHaveCount(1);
  await expect(page.getByText('Get tickets')).toHaveCount(0);
});

test('selecting a row changes the primary, never navigates; arrows/Home/End move focus and selection', async ({ page, isMobile, context }) => {
  await openDetail(page, { rows:{ ticket_offers:[AXS, TM, SG] } });
  let popups = 0;
  context.on('page', () => { popups++; });
  await rows(page).nth(1).click();
  await expect(rows(page).nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(rows(page).nth(0)).toHaveAttribute('aria-checked', 'false');
  await expect(buy(page, isMobile)).toHaveText(/Buy on Ticketmaster/);
  // Roving tabindex: only the selected row is in the tab order.
  await expect(rows(page).nth(1)).toHaveAttribute('tabindex', '0');
  await expect(rows(page).nth(0)).toHaveAttribute('tabindex', '-1');
  await rows(page).nth(1).focus();
  await page.keyboard.press('ArrowDown');
  await expect(rows(page).nth(2)).toBeFocused();
  await expect(rows(page).nth(2)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowDown'); // wraps
  await expect(rows(page).nth(0)).toBeFocused();
  await page.keyboard.press('End');
  await expect(rows(page).nth(2)).toBeFocused();
  await page.keyboard.press('Home');
  await expect(rows(page).nth(0)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(rows(page).nth(2)).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Enter'); // Enter on a row selects, never buys
  await expect(buy(page, isMobile)).toHaveText(/Buy on SeatGeek/);
  expect(popups).toBe(0);
});

test('1 loading: skeleton in the card shape, aria-busy, hidden status, no primary', async ({ page }) => {
  await openDetail(page, { hold:['ticket_offers'], rows:{ ticket_offers:[AXS] } });
  await expect(card(page)).toHaveAttribute('aria-busy', 'true');
  await expect(card(page).getByRole('status')).toHaveText('Loading sellers');
  await expect(card(page).locator('.tk-row--sk')).toHaveCount(3);
  await expect(page.getByRole('link', { name:/^Buy on / })).toHaveCount(0);
  await page.evaluate(() => (window as any).__fake.release());
  await expect(rows(page)).toHaveCount(1);
  await expect(card(page)).not.toHaveAttribute('aria-busy', 'true');
});

test('3 one seller: no tag, one-seller note, primary names it', async ({ page, isMobile }) => {
  await openDetail(page, { rows:{ ticket_offers:[{ ...TM, price_max:140 }] } });
  await expect(card(page).getByText('Only one seller lists this show right now.')).toBeVisible();
  await expect(card(page).getByText('up to $140')).toBeVisible();
  await expect(card(page).getByText(/Lowest/)).toHaveCount(0);
  await expect(buy(page, isMobile)).toHaveText(/Buy on Ticketmaster/);
});

test('5 no seller and no ticket link: empty message, no button at all', async ({ page }) => {
  await openDetail(page, { rows:{ ticket_offers:[] } }, { ...EVENT, ticket_url:null });
  await expect(card(page).getByText('No tickets listed yet.')).toBeVisible();
  await expect(card(page).getByText('Sellers appear here as they list this show.')).toBeVisible();
  await expect(card(page).locator('a, button')).toHaveCount(0);
  await expect(page.getByRole('link', { name:/^Buy on / })).toHaveCount(0);
  await expect(card(page).getByText(/Drop may earn a commission/)).toHaveCount(0);
});

test('no seller rows: the event ticket_url is one Live price row named by its host', async ({ page, isMobile }) => {
  await openDetail(page, { rows:{ ticket_offers:[] } });
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toHaveAccessibleName('tixr.com, price not listed, see current total on seller site');
  await expect(card(page).getByText('Live price')).toBeVisible();
  await expect(buy(page, isMobile)).toHaveText(/Buy on tixr\.com/);
  await expect(buy(page, isMobile)).toHaveAttribute('href', 'https://www.tixr.com/e/1');
});

test('6 ended: card replaced, no rows, no buttons, no footnote', async ({ page }) => {
  // Past shows aren't on Discover, so open it while upcoming, then move the clock past its end.
  await page.clock.install();
  await openDetail(page, { rows:{ ticket_offers:[AXS, TM] } });
  await page.clock.setSystemTime(Date.parse(DATE) + 13 * 3600000);
  await rows(page).nth(1).click(); // any re-render
  await expect(card(page).getByText('This show has ended.')).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(card(page).locator('a, button')).toHaveCount(0);
  await expect(page.getByRole('link', { name:/^Buy on / })).toHaveCount(0);
});

test('7 error with ticket_url fallback; Try again reloads and focuses the first row', async ({ page, isMobile }) => {
  await openDetail(page, { rows:{ ticket_offers:[AXS, TM] }, errors:{ 'ticket_offers.select':'boom' } });
  await expect(card(page).getByRole('alert')).toContainText('We couldn’t load sellers.');
  await expect(rows(page)).toHaveCount(1);
  await expect(buy(page, isMobile)).toHaveText(/Buy on tixr\.com/);
  await page.evaluate(() => (window as any).__fake.setError('ticket_offers.select', undefined));
  await card(page).getByRole('button', { name:'Try again' }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(card(page).getByRole('alert')).toHaveCount(0);
  await expect(rows(page).first()).toBeFocused();
});

test('8 error with no ticket_url: alert only, no primary', async ({ page }) => {
  await openDetail(page, { errors:{ 'ticket_offers.select':'boom' } }, { ...EVENT, ticket_url:null });
  await expect(card(page).getByRole('alert')).toBeVisible();
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByRole('link', { name:/^Buy on / })).toHaveCount(0);
});

test('9 price unknown or stale: Live price lines, tag reads Lowest known', async ({ page }) => {
  await openDetail(page, { rows:{ ticket_offers:[
    AXS,
    { ...TM, last_seen_at:at(-10) },
    offer({ vendor:'Etix', url:null }),
  ] } });
  await expect(rows(page).nth(0)).toHaveAccessibleName('AXS, listed from $89, lowest known');
  await expect(card(page).getByText('Previous quote expired')).toBeVisible();
  await expect(card(page).getByText('See current total on seller site')).toBeVisible();
  await expect(card(page).getByText('Live price')).toHaveCount(2);
  await expect(card(page).getByText('Same show, 3 sellers — compare available prices or open a seller for its live total.')).toBeVisible();
});

test('10 not comparable: currencies differ, no tag, A to Z, first row selected', async ({ page, isMobile }) => {
  await openDetail(page, { rows:{ ticket_offers:[TM, { ...SG, currency:'CAD' }] } });
  await expect(rows(page).nth(0)).toHaveAccessibleName('SeatGeek, listed from CAD 95');
  await expect(rows(page).nth(1)).toHaveAccessibleName('Ticketmaster, listed from $92');
  await expect(card(page).getByText(/Lowest/)).toHaveCount(0);
  await expect(buy(page, isMobile)).toHaveText(/Buy on SeatGeek/);
});

test('11 fees included only when the row says so', async ({ page }) => {
  await openDetail(page, { rows:{ ticket_offers:[
    offer({ vendor:'Tixr', url:'https://www.tixr.com/e/9', price_min:104, price_includes_fees:true }),
    offer({ vendor:'Dice', url:'https://dice.fm/e/9', price_min:98.5, price_includes_fees:true }),
  ] } });
  await expect(rows(page).nth(0)).toHaveAccessibleName('Dice, listed from $98.50, lowest listed');
  await expect(card(page).getByText('Fees included')).toHaveCount(2);
});

test('12 more than 3 sellers collapse to 3; the selected row never hides', async ({ page }) => {
  await openDetail(page, { rows:{ ticket_offers:[AXS, TM, SG,
    offer({ vendor:'Etix', url:'https://etix.prf.hn/click/camref:1100l5NLJm/pubref:7/destination:' + encodeURIComponent('https://www.etix.com/ticket/p/7/x'), price_min:99 }),
    offer({ vendor:'Tixr', url:'https://www.tixr.com/e/5', price_min:120 }),
  ] } });
  await expect(rows(page)).toHaveCount(3);
  const more = card(page).getByRole('button', { name:'Show all 5 sellers' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(more).toHaveAttribute('aria-controls', 'tk-list');
  await more.click();
  await expect(rows(page)).toHaveCount(5);
  await rows(page).nth(4).click();
  await card(page).getByRole('button', { name:'Show fewer' }).click();
  await expect(rows(page)).toHaveCount(4);
  await expect(rows(page).nth(3)).toHaveAttribute('aria-checked', 'true');
});

test('vetting: a non-Drop Etix link is dropped; same-show rows from another source join', async ({ page }) => {
  const anchor = { id:EV_ID, title:'Prism Nights', date:DATE, city:'Denver', venue_name:'Mission Ballroom', source:'ticketmaster', status:'published', event_artists:[] };
  const sibling = { ...anchor, id:SIB_ID, source:'seatgeek', venue_name:'Mission Ballroom - Denver' };
  await openDetail(page, { rows:{ events:[anchor, sibling], ticket_offers:[
    AXS,
    { ...SG, event_id:SIB_ID },
    offer({ vendor:'Etix', url:'https://www.etix.com/ticket/p/1', price_min:10 }),
  ] } });
  const offers = (await fakeCalls(page, 'from')).filter((c: any) => c.table === 'ticket_offers');
  expect(offers[0].ops[1]).toEqual(['in', ['event_id', [EV_ID, SIB_ID]]]);
  await expect(rows(page)).toHaveCount(2);
  await expect(card(page).getByText('Etix')).toHaveCount(0);
});

test('phone: primary in the bottom bar; Sellers sheet is modal and returns focus', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'phone layout');
  await openDetail(page, { rows:{ ticket_offers:[AXS, TM, SG] } });
  await expect(card(page).locator('.tk__buy')).toBeHidden();
  const bar = page.locator('.ed-bottombar');
  await expect(bar.getByRole('link', { name:/Buy on AXS/ })).toBeVisible();
  const sellers = bar.getByRole('button', { name:'Choose a seller, 3 listed' });
  await sellers.click();
  const sheet = page.getByRole('dialog', { name:'Choose where to buy' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('radio').first()).toBeFocused();
  await expect(page.locator('main.wsh')).toHaveAttribute('inert', '');
  await page.keyboard.press('ArrowDown');
  await expect(sheet.getByRole('radio').nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(sheet).toBeVisible(); // selecting does not close it
  await expect(sheet.getByRole('link', { name:/Buy on Ticketmaster/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(bar.getByRole('button', { name:'Choose a seller, 3 listed' })).toBeFocused();
  await expect(bar.getByRole('link', { name:/Buy on Ticketmaster/ })).toBeVisible();
});

test('desktop: card tops the sticky right column; targets and text contrast hold', async ({ page, isMobile }) => {
  test.skip(isMobile, 'desktop layout');
  await openDetail(page, { rows:{ ticket_offers:[AXS, TM, SG] } });
  const box = await card(page).boundingBox();
  const art = await page.locator('.ed-main > div').first().boundingBox();
  expect(box!.x).toBeGreaterThan(art!.x + art!.width);
  expect(Math.abs(box!.y - art!.y)).toBeLessThan(2);
  expect(await card(page).evaluate(el => getComputedStyle(el).position)).toBe('sticky');
  for (const el of await card(page).locator('.tk-row, .tk__buy, .tk__attr').all()) expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // Every text pair in the card passes 4.5:1 against its row or card fill.
  const worst = await card(page).evaluate((root) => {
    const lum = (c: string) => { const [r, g, b] = c.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const bgOf = (el: Element | null): string => { for (; el; el = el.parentElement) { const s = getComputedStyle(el); if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') return s.backgroundColor; } return 'rgb(11, 13, 18)'; };
    let min = 99;
    root.querySelectorAll('.tk-row__name, .tk-row__lab, .tk-row__amt, .tk__sub, .tk__foot, .tk__attr').forEach((el) => {
      const a = lum(getComputedStyle(el).color), b = lum(bgOf(el));
      min = Math.min(min, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
    });
    return min;
  });
  expect(worst).toBeGreaterThanOrEqual(4.5);
});
