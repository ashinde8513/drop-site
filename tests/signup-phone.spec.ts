import { expect, test, type Page } from '@playwright/test';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const FAKE_SUPABASE = String.raw`
(function () {
  var config = Object.assign({ session:false, complianceComplete:true, failCompliance:false, failCheck:false }, window.__dropFakeConfig || {});
  var listeners = [];
  var calls = [];
  var storedSession = false;
  try { storedSession = sessionStorage.getItem('__dropFakeSession') === '1'; } catch (_) {}
  var session = (config.session || storedSession)
    ? { user:{ id:'${USER_ID}', email:'founder@example.com' } }
    : null;
  function result(data, error, count) { return { data:data, error:error || null, count:count == null ? 0 : count }; }
  function query() {
    var promise = Promise.resolve(result([], null, 0));
    var chain;
    chain = new Proxy({}, {
      get:function (_, key) {
        if (key === 'then') return promise.then.bind(promise);
        if (key === 'catch') return promise.catch.bind(promise);
        if (key === 'finally') return promise.finally.bind(promise);
        return function () { return chain; };
      }
    });
    return chain;
  }
  function emit(event) { listeners.slice().forEach(function (listener) { listener(event, session); }); }
  var client = {
    auth:{
      getSession:async function () { return { data:{ session:session }, error:null }; },
      onAuthStateChange:function (listener) {
        listeners.push(listener);
        return { data:{ subscription:{ unsubscribe:function () {} } } };
      },
      signOut:async function () { session = null; emit('SIGNED_OUT'); return { error:null }; },
      signInWithOAuth:async function (input) { calls.push({ kind:'oauth', input:input }); return { data:{ url:'https://oauth.example.test' }, error:null }; },
      signInWithPassword:async function () { return { data:{ session:session }, error:null }; },
      signUp:async function () { return { data:{ session:session }, error:null }; },
      setSession:async function () { return { data:{ session:session }, error:null }; },
      resend:async function () { return { data:{}, error:null }; },
      resetPasswordForEmail:async function () { return { data:{}, error:null }; },
      updateUser:async function () { return { data:{}, error:null }; }
    },
    functions:{
      invoke:async function (name, options) {
        calls.push({ kind:'function', name:name, body:options && options.body });
        if (name !== 'verify-phone') return result({ ok:true });
        if (options.body.action === 'send') return result({ ok:true });
        return config.failCheck
          ? result({ error:'invalid_code' })
          : result({ verified:true });
      }
    },
    rpc:async function (name, args) {
      calls.push({ kind:'rpc', name:name, args:args || null });
      if (name === 'complete_signup_profile') {
        if (config.failCompliance) return result(null, { message:'Could not complete signup' });
        config.complianceComplete = true;
        return result(true);
      }
      if (name === 'signup_compliance_status') {
        return result({ user_id:'${USER_ID}', complete:config.complianceComplete });
      }
      return result(null);
    },
    from:function () { return query(); }
  };
  window.__dropFake = {
    calls:calls,
    config:config,
    setSession:function (enabled) {
      session = enabled ? { user:{ id:'${USER_ID}', email:'founder@example.com' } } : null;
      try { sessionStorage.setItem('__dropFakeSession', enabled ? '1' : '0'); } catch (_) {}
    },
    emit:emit
  };
  window.supabase = { createClient:function () { return client; } };
})();
`;

async function installFakeSupabase(page: Page, config: Record<string, unknown> = {}) {
  await page.addInitScript((value) => { (window as any).__dropFakeConfig = value; }, config);
  await page.route('**/vendor/supabase.js', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: FAKE_SUPABASE,
  }));
  await page.route('https://trydropapp.com/consent.js', (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: '',
  }));
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: '',
  }));
  await page.route('**/rest/v1/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'content-range': '*/0' },
    body: '[]',
  }));
}

async function openPhoneActivation(page: Page) {
  await page.goto('/app/index.html?mode=signup-complete');
  await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
}

test.describe('optional phone signup behavior', () => {
  test('authenticated signup completion is one-shot and preserves unrelated URL params', async ({ page }) => {
    await installFakeSupabase(page, { session:true });
    await page.goto('/app/index.html?mode=signup-complete&safe=1&code=query-secret#access_token=hash-secret&keep=yes');

    await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
    const url = new URL(page.url());
    expect(url.searchParams.get('safe')).toBe('1');
    expect(url.searchParams.has('mode')).toBe(false);
    expect(url.searchParams.has('code')).toBe(false);
    expect(new URLSearchParams(url.hash.slice(1)).get('keep')).toBe('yes');
    expect(url.hash).not.toContain('access_token');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Verify your phone' })).toHaveCount(0);
    await expect(page.getByText('Pick your night')).toBeVisible();
  });

  test('manual signup-complete URL without a session fails closed to signup', async ({ page }) => {
    await installFakeSupabase(page, { session:false });
    await page.goto('/app/index.html?mode=signup-complete&safe=1');

    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByText('Sign up or use the verified link from your email to finish account setup.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verify your phone' })).toHaveCount(0);
    const url = new URL(page.url());
    expect(url.searchParams.get('safe')).toBe('1');
    expect(url.searchParams.has('mode')).toBe(false);
  });

  test('login-origin OAuth cannot open Discover for an incomplete new identity', async ({ page }) => {
    await installFakeSupabase(page, { session:true, complianceComplete:false });
    await page.goto('/app/index.html');

    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByText('Finish account setup through Get started before logging in.')).toBeVisible();
    await expect(page.getByText('Pick your night')).toHaveCount(0);

    await page.evaluate(() => {
      sessionStorage.setItem('drop.signup.oauth-compliance', JSON.stringify({
        birthdate:'1995-04-12', termsVersion:'2026-07-18', privacyVersion:'2026-07-18'
      }));
      (window as any).__dropFake.setSession(true);
      history.pushState({}, '', '?mode=signup-complete');
      (window as any).__dropFake.emit('SIGNED_IN');
    });
    await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
    const rpcNames = await page.evaluate(() => (window as any).__dropFake.calls
      .filter((call: any) => call.kind === 'rpc').map((call: any) => call.name));
    expect(rpcNames).toContain('complete_signup_profile');
    expect(rpcNames.filter((name: string) => name === 'signup_compliance_status').length).toBeGreaterThanOrEqual(2);
  });

  test('signup OAuth requires DOB and consent, then completes the sanctioned RPC', async ({ page }) => {
    await installFakeSupabase(page, { session:false });
    await page.goto('/app/index.html?mode=signup');

    await page.getByRole('button', { name: 'Google' }).click();
    await expect(page.getByText('Enter your date of birth.')).toBeVisible();
    await page.locator('#signup-dob').fill('1995-04-12');
    await page.getByRole('button', { name: 'Google' }).click();
    await expect(page.getByText('Agree to the Terms and Privacy Policy to continue.')).toBeVisible();
    await page.locator('#signup-dob').fill('1995-04-12');
    await page.locator('#signup-consent').evaluate((element: HTMLInputElement) => {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles:true }));
    });
    await expect(page.locator('#signup-consent')).toBeChecked();
    await page.getByRole('button', { name: 'Google' }).click();

    const oauth = await page.evaluate(() => (window as any).__dropFake.calls.find((call: any) => call.kind === 'oauth'));
    expect(oauth.input.options.redirectTo).toContain('?mode=signup-complete');
    expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('drop.signup.oauth-compliance') || 'null'))).toEqual({
      birthdate:'1995-04-12',
      termsVersion:'2026-07-18',
      privacyVersion:'2026-07-18',
    });

    await page.evaluate(() => (window as any).__dropFake.setSession(true));
    await page.goto('/app/index.html?mode=signup-complete');
    await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
    const complianceCall = await page.evaluate(() => (window as any).__dropFake.calls.find((call: any) => call.name === 'complete_signup_profile'));
    expect(complianceCall.args).toEqual({
      p_birthdate:'1995-04-12',
      p_terms_version:'2026-07-18',
      p_privacy_version:'2026-07-18',
    });
    expect(await page.evaluate(() => sessionStorage.getItem('drop.signup.oauth-compliance'))).toBeNull();
  });

  test('OAuth compliance completion failure signs out and fails closed', async ({ page }) => {
    await installFakeSupabase(page, { session:true, failCompliance:true });
    await page.addInitScript(() => sessionStorage.setItem('drop.signup.oauth-compliance', JSON.stringify({
      birthdate:'1995-04-12',
      termsVersion:'2026-07-18',
      privacyVersion:'2026-07-18',
    })));
    await page.goto('/app/index.html?mode=signup-complete');

    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await expect(page.getByText('Could not finish account setup. Please try signing up again.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verify your phone' })).toHaveCount(0);
    expect(await page.evaluate(() => sessionStorage.getItem('drop.signup.oauth-compliance'))).toBeNull();
  });

  test('phone remains skippable and send/check success removes raw values', async ({ page }) => {
    await installFakeSupabase(page, { session:true });
    await openPhoneActivation(page);

    await page.locator('#wiz-phone').fill('(303) 555-0100');
    await page.getByRole('button', { name: 'Text me a code' }).click();
    await expect(page.getByText('Enter the 6-digit code sent to +13035550100.')).toBeVisible();
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page.getByRole('heading', { name: 'Add a profile photo' })).toBeVisible();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('#wiz-phone')).toHaveValue('');
    await expect(page.locator('#wiz-phone-code')).toHaveCount(0);

    await page.locator('#wiz-phone').fill('(303) 555-0100');
    await page.getByRole('button', { name: 'Text me a code' }).click();
    await page.locator('#wiz-phone-code').fill('123456');
    await page.getByRole('button', { name: 'Verify phone' }).click();

    await expect(page.getByText('Phone verified')).toBeVisible();
    await expect(page.locator('#wiz-phone')).toHaveCount(0);
    await expect(page.locator('#wiz-phone-code')).toHaveCount(0);
    const calls = await page.evaluate(() => (window as any).__dropFake.calls.filter((call: any) => call.name === 'verify-phone'));
    expect(calls.map((call: any) => call.body)).toEqual([
      { action:'send', phone:'+13035550100' },
      { action:'send', phone:'+13035550100' },
      { action:'check', phone:'+13035550100', code:'123456' },
    ]);
  });

  test('mapped verification failure is safe and logout/new activation clears pending values', async ({ page }) => {
    await installFakeSupabase(page, { session:true, failCheck:true });
    await openPhoneActivation(page);
    await page.locator('#wiz-phone').fill('3035550100');
    await page.getByRole('button', { name: 'Text me a code' }).click();
    await page.locator('#wiz-phone-code').fill('654321');
    await page.getByRole('button', { name: 'Verify phone' }).click();
    await expect(page.getByRole('status')).toContainText('That code is invalid or expired.');

    await page.getByRole('button', { name: 'Skip' }).click();
    for (let step = 0; step < 5; step += 1) await page.getByRole('button', { name: /Continue|Finish/ }).click();
    await page.getByRole('button', { name: 'Maybe later — take me to Discover' }).click();
    const mobileMenu = page.getByRole('button', { name: 'Menu' });
    if (await mobileMenu.isVisible()) await mobileMenu.click();
    else await page.locator('.wn__avatar').click();
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('button', { name: /Get started/ }).first()).toBeVisible();

    await page.evaluate(() => {
      (window as any).__dropFake.config.failCheck = false;
      (window as any).__dropFake.setSession(true);
      history.pushState({}, '', '?mode=signup-complete');
      (window as any).__dropFake.emit('SIGNED_IN');
    });
    await expect(page.getByRole('heading', { name: 'Verify your phone' })).toBeVisible();
    await expect(page.locator('#wiz-phone')).toHaveValue('');
    await expect(page.locator('#wiz-phone-code')).toHaveCount(0);
  });
});
