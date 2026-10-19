import type { Page } from '@playwright/test';

export const FAKE_SUPABASE = `
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

// Route stubs shared by specs: fake Supabase client, no consent/fonts, empty REST.
export async function stubApp(page: Page) {
  await page.route('**/vendor/supabase.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:FAKE_SUPABASE }));
  await page.route('https://trydropapp.com/consent.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:'' }));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.route('**/rest/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
}
