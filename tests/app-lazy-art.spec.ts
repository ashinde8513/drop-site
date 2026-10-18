import { expect, test } from '@playwright/test';

// Discover renders every event card with inline CSS background art. Offscreen
// art must not download until its card nears the viewport.
const FAKE_SUPABASE = `
  (function () {
    function result(data) { return { data:data, error:null, count:0 }; }
    function query() {
      var promise = Promise.resolve(result([]));
      var chain = new Proxy({}, { get:function (_, key) {
        if (key === 'then') return promise.then.bind(promise);
        if (key === 'catch') return promise.catch.bind(promise);
        if (key === 'finally') return promise.finally.bind(promise);
        return function () { return chain; };
      }});
      return chain;
    }
    var client = {
      auth:{
        getSession:async function () { return { data:{ session:null }, error:null }; },
        onAuthStateChange:function () { return { data:{ subscription:{ unsubscribe:function () {} } } }; }
      },
      from:function () { return query(); },
      rpc:async function () { return result(null); }
    };
    window.supabase = { createClient:function () { return client; } };
  })();`;

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const COUNT = 60;

test('discover defers offscreen card art until it nears the viewport', async ({ page }) => {
  const date = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const events = Array.from({ length:COUNT }, (_, i) => ({
    id:`00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    title:`Show ${i}`, date, venue_name:'Mission Ballroom', city:'Denver', state:'CO',
    status:'published', image_url:`https://art.test/${i}.png`, event_artists:[], is_festival:false,
  }));
  const fetched = new Set<string>();
  await page.route('**/vendor/supabase.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:FAKE_SUPABASE }));
  await page.route('https://trydropapp.com/consent.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:'' }));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css', body:'' }));
  // Later routes win in Playwright, so the catch-all goes first.
  await page.route('**/rest/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
  await page.route('**/rest/v1/events?*', route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') || 0);
    route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(offset ? [] : events) });
  });
  await page.route('https://art.test/**', route => {
    fetched.add(new URL(route.request().url()).pathname);
    route.fulfill({ status:200, contentType:'image/png', body:PNG });
  });

  await page.goto('/app/index.html');
  const cards = page.locator('.wsc__img');
  await expect(cards.first()).toBeVisible();
  await expect.poll(() => fetched.size).toBeGreaterThan(0);
  expect(await cards.count()).toBeGreaterThan(fetched.size);

  // The gradient placeholder stays in place while art is deferred.
  const last = cards.last();
  await expect(last).toHaveAttribute('data-lazy-art', /url\(/);
  await expect(last).toHaveCSS('background-image', /gradient/);

  await last.scrollIntoViewIfNeeded();
  await expect(last).not.toHaveAttribute('data-lazy-art', /./);
  await expect(last).toHaveCSS('background-image', /art\.test/);
});
