import { expect, test, type Page } from '@playwright/test';

const USER_ID = '11111111-1111-4111-8111-111111111111';

async function openSettings(page: Page, config: Record<string, unknown> = {}, suffix = '') {
  await page.addInitScript((value) => { (window as any).__emailConfig = value; }, config);
  await page.route('**/vendor/supabase.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: `(() => {
      const config = window.__emailConfig;
      const account = { id:'${USER_ID}', email:'old@example.com', new_email:config.pending || '' };
      let signedIn = config.session !== false;
      const calls = [], listeners = [];
      const result = data => ({ data, error:null });
      const query = new Proxy({}, { get:(_, key) => key === 'then'
        ? Promise.resolve(result([])).then.bind(Promise.resolve(result([]))) : () => query });
      const client = {
        from:() => query,
        rpc:async name => result(name === 'signup_compliance_status' ? {user_id:account.id, complete:true} : []),
        auth:{
          getSession:async () => result({session:signedIn ? {user:{...account}} : null}),
          getUser:async () => {
            if (config.failCheck) throw Error('offline');
            return result({user:signedIn ? {...account} : null});
          },
          onAuthStateChange:fn => { listeners.push(fn); return result({subscription:{unsubscribe(){}}}); },
          updateUser:async (input, options) => {
            calls.push({kind:'update', input, options});
            if (config.failUpdate) return {error:{status:429}};
            account.new_email = input.email;
            return result({user:{...account}});
          },
          resend:async input => { calls.push({kind:'resend', input}); return result({}); },
          verifyOtp:async input => { calls.push({kind:'verifyOtp', input}); throw Error('wrong flow'); },
          signOut:async () => { signedIn=false; listeners.forEach(fn=>fn('SIGNED_OUT')); return result({}); }
        }
      };
      window.__emailTest = { account, calls, config };
      window.supabase = {createClient:(_url, _key, options) => { window.__emailTest.options=options; return client; }};
    })();`,
  }));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType:'text/css', body:'' }));
  await page.route('https://trydropapp.com/consent.js', route => route.fulfill({ contentType:'application/javascript', body:'' }));
  await page.route('**/rest/v1/**', route => route.fulfill({ contentType:'application/json', headers:{'content-range':'*/0'}, body:'[]' }));
  await page.goto('/app/index.html?mode=email-change' + suffix);
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 13, 18)');
}

test('email change preserves current address until confirmed, then refreshes and resends', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await openSettings(page);
  await expect(page.getByRole('heading', {name:'Settings', exact:true})).toBeVisible();
  await expect(page.getByTestId('account-current-email')).toHaveText('old@example.com');
  await page.getByLabel('New email address').fill('new@example.com');
  await page.getByRole('button', {name:'Send verification emails', exact:true}).click();
  await expect(page.getByTestId('account-pending-email')).toHaveText('new@example.com');
  await expect(page.getByTestId('account-current-email')).toHaveText('old@example.com');
  await expect(page.getByRole('status')).toContainText('Confirm both links');
  expect(await page.evaluate(() => (window as any).__emailTest.calls[0])).toEqual({
    kind:'update', input:{email:'new@example.com'}, options:{emailRedirectTo:new URL('/app/index.html?mode=email-change', page.url()).href},
  });
  await page.getByRole('button', {name:'Resend verification emails', exact:true}).click();
  expect(await page.evaluate(() => (window as any).__emailTest.calls[1].input)).toEqual({
    type:'email_change', email:'old@example.com', options:{emailRedirectTo:new URL('/app/index.html?mode=email-change', page.url()).href},
  });
  await page.evaluate(() => Object.assign((window as any).__emailTest.account, {email:'new@example.com', new_email:''}));
  await page.getByRole('button', {name:'Check verification status', exact:true}).click();
  await expect(page.getByTestId('account-current-email')).toHaveText('new@example.com');
  await expect(page.getByTestId('account-pending-email')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('Your new email is verified.');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('email change errors never claim success or change current email', async ({ page }) => {
  await openSettings(page, {failUpdate:true});
  await page.getByLabel('New email address').fill('new@example.com');
  await page.getByRole('button', {name:'Send verification emails', exact:true}).click();
  await expect(page.getByRole('status')).toContainText('wait a minute');
  await expect(page.getByTestId('account-current-email')).toHaveText('old@example.com');
  await expect(page.getByTestId('account-pending-email')).toHaveCount(0);
  await page.evaluate(() => { (window as any).__emailTest.config.failCheck=true; });
  await page.getByRole('button', {name:'Check verification status', exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Could not check');
});

test('callback without original browser session scrubs secrets and never exchanges signup tokens', async ({ page }) => {
  await openSettings(page, {session:false}, '&code=private-code&token_hash=private-hash&type=email_change#access_token=private-token');
  await expect(page.getByRole('heading', {name:'Welcome back'})).toBeVisible();
  await expect(page.getByText(/Confirm both email links, then return/)).toBeVisible();
  expect(page.url()).not.toMatch(/private-|token_hash|access_token|&code=/);
  expect(await page.evaluate(() => (window as any).__emailTest.options.auth.detectSessionInUrl)).toBe(false);
  expect(await page.evaluate(() => (window as any).__emailTest.calls)).toEqual([]);
});

test('unchanged or invalid email never submits and expired callbacks show a safe error', async ({ page }) => {
  await openSettings(page, {}, '&error_code=otp_expired&error_description=private-provider-error');
  await expect(page.getByRole('status')).toContainText('could not be confirmed');
  await page.getByLabel('New email address').fill('OLD@example.com');
  await page.getByRole('button', {name:'Send verification emails', exact:true}).click();
  await expect(page.getByRole('status')).toHaveText('Enter a different email address.');
  await page.getByLabel('New email address').fill('not-an-email');
  await page.getByRole('button', {name:'Send verification emails', exact:true}).click();
  expect(await page.evaluate(() => (window as any).__emailTest.calls)).toEqual([]);
  expect(page.url()).not.toContain('private-provider-error');
});
