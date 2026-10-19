import { expect, test, type Page } from '@playwright/test';
import { bootSignedIn, fakeCalls } from './helpers/fakeSession';

const EV_ID = '00000000-0000-4000-8000-0000000000aa';
const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const EVENT = { id:EV_ID, title:'Audit Night', date, venue_name:'Mission Ballroom', city:'Denver', state:'CO', status:'published', image_url:null, event_artists:[], is_festival:false };
const NOT_ON_WEB = 'Not available on the web yet — use the iPhone app';

const open = async (page: Page) => {
  await page.goto('/app/index.html');
  await expect(page.getByText('Audit Night').first()).toBeVisible();
};
const account = async (page: Page, item: string) => {
  await page.getByRole('button', { name:'Account menu' }).click();
  await page.getByRole('button', { name:item, exact:true }).click();
};
const footer = async (page: Page, link: string) => { await open(page); await page.getByRole('link', { name:link, exact:true }).click(); };

test.describe('sign-out safety', () => {
  test('transient signup_compliance_status error keeps the session', async ({ page }) => {
    await bootSignedIn(page, { failComplianceTimes:1 }, [EVENT]);
    await page.goto('/app/index.html');
    await expect(page.getByText('Could not confirm the account requirements. Try again.').first()).toBeVisible();
    expect(await fakeCalls(page, 'signOut')).toHaveLength(0);
  });

  test('Log out signs out with scope local', async ({ page, isMobile }) => {
    test.skip(isMobile, 'uses the desktop Account menu');
    await bootSignedIn(page, {}, [EVENT]);
    await open(page);
    await account(page, 'Log out');
    await expect.poll(() => fakeCalls(page, 'signOut')).toEqual([{ kind:'signOut', opts:{ scope:'local' } }]);
  });
});

test.describe('consent versions', () => {
  test('password signup sends terms 2026-07-18 / privacy 2026-08-11', async ({ page }) => {
    await bootSignedIn(page, { signedOut:true }, [EVENT]);
    await page.goto('/app/index.html?mode=signup');
    await page.getByPlaceholder('username').fill('versions');
    await page.locator('#signup-email').fill('v@example.com');
    await page.locator('#signup-dob').fill('1995-04-12');
    await page.locator('#signup-password').fill('correct-horse-battery-staple');
    await page.locator('#signup-consent').evaluate((el: HTMLInputElement) => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles:true })); });
    await page.getByRole('button', { name:/Create account/i }).click();
    const [call] = await fakeCalls(page, 'signUp');
    expect(call.input.options.data).toMatchObject({ terms_version:'2026-07-18', privacy_version:'2026-08-11' });
  });

  test('OAuth signup completes with the same versions', async ({ page }) => {
    await bootSignedIn(page, { signedOut:true }, [EVENT]);
    await page.goto('/app/index.html?mode=signup');
    await page.locator('#signup-dob').fill('1995-04-12');
    await page.locator('#signup-consent').evaluate((el: HTMLInputElement) => { el.checked = true; el.dispatchEvent(new Event('change', { bubbles:true })); });
    await page.getByRole('button', { name:'Facebook' }).click();
    await expect.poll(() => fakeCalls(page, 'oauth')).toHaveLength(1);
    // Return from the provider with a session: the stored pending payload is submitted.
    await page.evaluate(() => (window as any).__cfg.signedOut = false);
    const stored = await page.evaluate(() => sessionStorage.getItem('drop.signup.oauth-compliance'));
    await page.unroute('**/vendor/supabase.js');
    await bootSignedIn(page, {}, [EVENT]);
    await page.addInitScript(v => sessionStorage.setItem('drop.signup.oauth-compliance', v), stored!);
    await page.goto('/app/index.html?mode=signup-complete');
    await expect.poll(async () => (await fakeCalls(page, 'rpc')).find((c: any) => c.name === 'complete_signup_profile')?.args)
      .toEqual({ p_birthdate:'1995-04-12', p_terms_version:'2026-07-18', p_privacy_version:'2026-08-11' });
  });
});

test.describe('honest buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__blobs = [];
      const make = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (b: any) => { (window as any).__blobs.push(b); return make(b); };
      HTMLAnchorElement.prototype.click = function () { (window as any).__downloads = [...((window as any).__downloads || []), this.download]; };
    });
  });

  test('event .ics download is a real text/calendar file with the title', async ({ page }) => {
    await bootSignedIn(page, {}, [EVENT]);
    await open(page);
    await page.getByText('Audit Night').first().click();
    await page.getByRole('button', { name:/Download \.ics/ }).click();
    const { type, text, name } = await page.evaluate(async () => {
      const b = (window as any).__blobs[0];
      return { type:b.type, text:await b.text(), name:(window as any).__downloads[0] };
    });
    expect(type).toBe('text/calendar');
    expect(name).toBe('drop-event.ics');
    expect(text).toContain('SUMMARY:Audit Night');
    expect(text).toContain('LOCATION:Mission Ballroom\\, Denver');
    expect(text).toContain('DTSTART;VALUE=DATE:' + date.replace(/-/g, ''));
  });

  for (const [label, button] of [['Music taste', 'Agree & connect'], ['Promoter tools', 'Become a promoter']] as const) {
    test(`${button} never claims success`, async ({ page, isMobile }) => {
      test.skip(isMobile && label === 'Music taste', 'uses the desktop Account menu');
      await bootSignedIn(page, {}, [EVENT]);
      if (label === 'Music taste') { await open(page); await account(page, 'Profile'); await page.getByText('Music taste', { exact:true }).click(); await page.getByRole('button', { name:/connect/i }).first().click(); }
      else await footer(page, 'Promoter dashboard');
      await expect(page.getByRole('button', { name:button })).toBeDisabled();
      await expect(page.getByText(NOT_ON_WEB).first()).toBeVisible();
      await expect(page.locator('body')).not.toContainText(/Imported 12 artists|welcome!/);
    });
  }
});

test.describe('a11y labels', () => {
  test('signup consent links are underlined and suggest dates are named', async ({ page }) => {
    await bootSignedIn(page, { signedOut:true }, [EVENT]);
    await page.goto('/app/index.html?mode=signup');
    for (const name of ['Terms', 'Privacy Policy']) {
      const deco = await page.locator('.cb__label').getByRole('link', { name }).evaluate(a => getComputedStyle(a).textDecorationLine);
      expect(deco).toBe('underline');
    }
    // every date input in the template has an id (own label), aria-label, or a sibling label
    const tpl = await page.evaluate(() => [...document.querySelector<HTMLTemplateElement>('#dc-template')!.content.querySelectorAll('input[type="date"]')]
      .filter(i => !i.id && !i.getAttribute('aria-label') && !(i.parentElement?.querySelector('label[for]'))).length);
    expect(tpl).toBe(0);
  });
});

test.describe('error visibility and hygiene', () => {
  test('failed artist_follows insert flashes and reverts the follow', async ({ page }) => {
    const artist = { id:'aaaaaaaa-0000-4000-8000-000000000001', name:'Rollback DJ', genres:[], image_url:null };
    await bootSignedIn(page, { errors:{ 'artist_follows.insert':'permission denied (403)' } }, [{ ...EVENT, event_artists:[{ artists:artist }] }]);
    await page.goto('/app/index.html');
    await page.getByText('Audit Night').first().click();
    await page.getByText('Rollback DJ').first().click();
    await page.getByRole('button', { name:'＋ Follow', exact:true }).click();
    await expect(page.getByText('Could not update your follow — try again')).toBeVisible();
    await expect(page.getByRole('button', { name:'＋ Follow', exact:true })).toBeVisible();
    await expect(page.getByRole('button', { name:'✓ Following' })).toHaveCount(0);
  });

  test('logout empties My Shows', async ({ page, isMobile }) => {
    test.skip(isMobile, 'uses the desktop Account menu');
    const row = { status:'going', created_at:'2026-01-01T00:00:00Z', events:{ id:EV_ID, title:'Audit Night', date, venue_name:'Mission Ballroom', city:'Denver' } };
    await bootSignedIn(page, { rows:{ attendance:[row] } }, [EVENT]);
    await open(page);
    await account(page, 'My Shows');
    await expect(page.getByText('Audit Night').first()).toBeVisible();
    await page.evaluate(() => (window as any).__fake.emit('SIGNED_OUT'));
    await expect(page.locator('body')).not.toContainText('Audit Night');
  });
});

test('festival set times: explicit columns and published filter in the query', async ({ page }) => {
  const festivalId = '5c26525c-99ae-41cd-a9de-00b9196c3975';
  const festival = { ...EVENT, id:festivalId, title:'Fest', is_festival:true };
  await page.route('https://trydropapp.com/consent.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:'' }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.route('**/rest/v1/events?**', r => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify([festival]) }));
  let url = '';
  await page.route('**/rest/v1/event_set_times?**', r => { url = r.request().url(); r.fulfill({ status:200, contentType:'application/json', body:'[]' }); });
  await page.goto(`/app/index.html?festival=${festivalId}`);
  await expect.poll(() => url).not.toBe('');
  const q = new URL(url).searchParams;
  expect(q.get('select')).toBe('id,stage,artist_name,start_time,end_time,timezone,status');
  expect(q.get('status')).toBe('eq.published');
  expect(q.get('event_id')).toBe('eq.' + festivalId);
});
