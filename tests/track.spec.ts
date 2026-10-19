import { expect, test } from '@playwright/test';

// Records beacons instead of sending them, and keeps clicks on the page.
async function setup(page, consent: string | null) {
  await page.addInitScript((value) => {
    try { if (value) localStorage.setItem('drop.cookie-consent', value); } catch {}
    (window as any).__beacons = [];
    // Record only conversion beacons (/e/...) and their privacy options; every
    // other request (catalog, cities) goes to the real fetch untouched.
    const real = window.fetch.bind(window);
    window.fetch = function (url: any, init?: RequestInit) {
      const path = String(url);
      if (!/^\/e\//.test(path)) return real(url, init);
      (window as any).__beacons.push(path);
      (window as any).__beaconInit = { method: init?.method, keepalive: init?.keepalive, referrerPolicy: init?.referrerPolicy, credentials: init?.credentials };
      return Promise.resolve(new Response(null, { status: 204 }));
    };
    document.addEventListener('click', (e) => e.preventDefault());
  }, consent);
  await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}
// The local python server occasionally drops a script request under parallel
// load (page renders, site.js never runs); one reload covers that.
async function open(page, path: string) {
  await page.goto(path);
  const ready = () => page.evaluate(() => Boolean((window as any).Drop?.track && (window as any).DropConsent));
  await page.waitForLoadState('load');
  if (!(await ready())) await page.reload();
  // consent.js is deferred: without it Drop.track (correctly) sends nothing.
  await page.waitForFunction(() => (window as any).Drop?.track && (window as any).DropConsent);
}
async function clickLinks(page) {
  await page.evaluate(() => {
    for (const [href, rel] of [['https://www.etix.com/ticket/p/1', 'noopener nofollow sponsored'], ['https://play.google.com/store/apps/details?id=x', 'noopener']]) {
      const a = document.createElement('a'); a.href = href; a.rel = rel; a.textContent = 'x'; document.body.appendChild(a); a.click();
    }
  });
  return page.evaluate(() => (window as any).__beacons);
}

test('the switch turns counting off entirely, even with consent', async ({ page }) => {
  await setup(page, 'accepted');
  await open(page, '/about.html');
  await page.evaluate(() => { (window as any).Drop.TRACKING = false; });
  expect(await clickLinks(page)).toEqual([]);
});

test('when enabled, only "Accept all" visitors send path-only counts', async ({ page }) => {
  await setup(page, 'accepted');
  await open(page, '/about.html');
  await page.evaluate(() => { (window as any).Drop.TRACKING = true; });
  expect(await clickLinks(page)).toEqual(['/e/ticket_click/etix/about', '/e/app_store_click/android/about']);
  expect(await page.evaluate(() => (window as any).__beaconInit)).toEqual({ method: 'POST', keepalive: true, referrerPolicy: 'no-referrer', credentials: 'omit' });
});

test('essential-only visitors send nothing when enabled', async ({ page }) => {
  await setup(page, 'essential');
  await open(page, '/about.html');
  await page.evaluate(() => { (window as any).Drop.TRACKING = true; });
  expect(await clickLinks(page)).toEqual([]);
});
