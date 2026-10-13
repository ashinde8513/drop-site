import { expect, test, type Page } from '@playwright/test';

const FAKE_SUPABASE = String.raw`
(function () {
  var calls = [];
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
      onAuthStateChange:function () { return { data:{ subscription:{ unsubscribe:function () {} } } }; },
      signInWithPassword:async function (input) {
        calls.push({ kind:'login', input:input });
        return { data:{ session:null }, error:{ message:'Expected test rejection' } };
      },
      signInWithOAuth:async function () { return { data:{}, error:null }; },
      signUp:async function () { return { data:{ session:null }, error:null }; },
      resetPasswordForEmail:async function () { return { data:{}, error:null }; },
      updateUser:async function () { return { data:{}, error:null }; },
      verifyOtp:async function () { return { data:{ session:null }, error:null }; },
      setSession:async function () { return { data:{ session:null }, error:null }; },
      resend:async function () { return { data:{}, error:null }; },
      signOut:async function () { return { error:null }; }
    },
    functions:{ invoke:async function () { return result({ ok:true }); } },
    rpc:async function () { return result(null); },
    from:function () { return query(); }
  };
  window.__authInputFake = { calls:calls };
  window.supabase = { createClient:function () { return client; } };
})();`;

async function openWithDelayedCatalog(page: Page, mode: string) {
  let releaseCatalog!: () => void;
  const catalogGate = new Promise<void>((resolve) => { releaseCatalog = resolve; });
  let requested = 0;
  let fulfilled = 0;

  await page.route('**/vendor/supabase.js', (route) => route.fulfill({
    status:200, contentType:'application/javascript', body:FAKE_SUPABASE,
  }));
  await page.route('https://trydropapp.com/consent.js', (route) => route.fulfill({
    status:200, contentType:'application/javascript', body:'',
  }));
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({
    status:200, contentType:'text/css', body:'',
  }));
  await page.route('**/rest/v1/**', (route) => route.fulfill({
    status:200, contentType:'application/json', headers:{ 'content-range':'*/0' }, body:'[]',
  }));
  await page.route('**/rest/v1/events?**', async (route) => {
    requested++;
    await catalogGate;
    await route.fulfill({ status:200, contentType:'application/json', body:'[]' });
    fulfilled++;
  });

  await page.goto(`/app/index.html?mode=${mode}`);
  await expect.poll(() => requested).toBe(3);
  return {
    releaseCatalog,
    catalogFinished: () => fulfilled,
  };
}

const forms = [
  {
    name:'login', mode:'login', heading:'Welcome back', focus:'#login-password',
    values:[['#login-email', 'person@example.com'], ['#login-password', 'login-secret']],
  },
  {
    name:'signup', mode:'signup', heading:'Create your account', focus:'#signup-password',
    values:[
      ['#signup-email', 'new@example.com'], ['input[placeholder="username"]', 'newperson'],
      ['#signup-creator-code', 'MAYA2026'], ['#signup-dob', '1990-04-12'],
      ['#signup-password', 'signup-secret'],
    ],
    checkbox:'#signup-consent',
  },
  {
    name:'forgot-password', mode:'login', heading:'Reset your password', focus:'#forgot-email',
    values:[['#forgot-email', 'recover@example.com']], openForgot:true,
  },
  {
    name:'password-reset', mode:'reset-password', heading:'Choose a new password', focus:'#reset-password-confirm',
    values:[['#reset-password', 'replacement-secret'], ['#reset-password-confirm', 'replacement-secret']],
  },
] as const;

for (const form of forms) {
  test(`${form.name} values survive a delayed catalog rerender`, async ({ page }) => {
    const catalog = await openWithDelayedCatalog(page, form.mode);
    if ('openForgot' in form) await page.getByText('Forgot?', { exact:true }).click();
    await expect(page.getByRole('heading', { name:form.heading })).toBeVisible();

    for (const [selector, value] of form.values) await page.locator(selector).fill(value);
    if ('checkbox' in form) await page.locator(form.checkbox).evaluate((element: HTMLInputElement) => {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles:true }));
    });
    await page.locator(form.focus).focus();
    const focusedBefore = await page.locator(form.focus).elementHandle();

    catalog.releaseCatalog();
    await expect.poll(catalog.catalogFinished).toBe(3);
    await expect.poll(() => focusedBefore!.evaluate((element) => !element.isConnected)).toBe(true);

    for (const [selector, value] of form.values) await expect(page.locator(selector)).toHaveValue(value);
    if ('checkbox' in form) await expect(page.locator(form.checkbox)).toBeChecked();
    await expect.poll(() => page.evaluate((selector) =>
      document.activeElement === document.querySelector(selector), form.focus)).toBe(true);

    if (form.name === 'login') {
      await page.getByRole('button', { name:'Log in', exact:true }).click();
      await expect.poll(() => page.evaluate(() => (window as any).__authInputFake.calls)).toEqual([
        { kind:'login', input:{ email:'person@example.com', password:'login-secret' } },
      ]);
      await page.getByText('Forgot?', { exact:true }).click();
      await page.getByText('Back to log in', { exact:true }).click();
      await expect(page.locator('#login-email')).toHaveValue('');
      await expect(page.locator('#login-password')).toHaveValue('');
    }
  });
}
