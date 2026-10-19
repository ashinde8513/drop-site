import { expect, test, type Page } from '@playwright/test';
import { bootSignedIn, fakeCalls, USER_ID } from './helpers/fakeSession';

const EV_ID = '00000000-0000-4000-8000-0000000000aa';
const OTHER_ID = '00000000-0000-4000-8000-0000000000bb';
const FRIEND_ID = '22222222-2222-4222-8222-222222222222';
const PENDING_ID = '33333333-3333-4333-8333-333333333333';
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const EVENT = { id:EV_ID, title:'Parity Night', date:day(5), venue_name:'Mission Ballroom', city:'Denver', state:'CO', status:'published', image_url:null, event_artists:[], is_festival:false };
const ELSEWHERE = { ...EVENT, id:OTHER_ID, title:'Saved Elsewhere', city:'Austin', state:'TX' };

const ops = async (page: Page, table: string, op: string) =>
  (await fakeCalls(page, 'from')).filter((c: any) => c.table === table && c.ops[0][0] === op).map((c: any) => c.ops);
const open = async (page: Page) => { await page.goto('/app/index.html'); await expect(page.getByText('Parity Night').first()).toBeVisible(); };
const detail = async (page: Page) => { await open(page); await page.getByText('Parity Night').first().click(); await expect(page.locator('button[aria-label="Save event"]:visible').first()).toBeVisible(); };
const nav = async (page: Page, isMobile: boolean, item: string) => {
  if (isMobile) { await page.getByRole('button', { name:'Menu' }).click(); await page.locator('.mnav__panel').getByRole('button', { name:new RegExp(item) }).click(); }
  else { await page.getByRole('button', { name:'Account menu' }).click(); await page.getByRole('button', { name:item, exact:true }).click(); }
};
const save = (page: Page) => page.locator('button[aria-label="Save event"]:visible').first();
const going = (page: Page) => page.getByRole('button', { name:'✓ Going' }).locator('visible=true').first();
const interested = (page: Page) => page.getByRole('button', { name:/Interested|Mark interested/ }).locator('visible=true').first();

test.describe('A saves persist', () => {
  test('save upserts, unsave deletes', async ({ page }) => {
    await bootSignedIn(page, {}, [EVENT]);
    await detail(page);
    await save(page).click();
    await expect(save(page)).toHaveText('♥');
    expect(await ops(page, 'saved_events', 'upsert')).toEqual([[['upsert', [{ user_id:USER_ID, event_id:EV_ID }, { onConflict:'user_id,event_id', ignoreDuplicates:true }]]]]);
    await save(page).click();
    await expect(save(page)).toHaveText('♡');
    const [del] = await ops(page, 'saved_events', 'delete');
    expect(del).toEqual([['delete', []], ['eq', ['user_id', USER_ID]], ['eq', ['event_id', EV_ID]]]);
  });

  test('failed save rolls back and flashes', async ({ page }) => {
    await bootSignedIn(page, { errors:{ 'saved_events.upsert':'denied' } }, [EVENT]);
    await detail(page);
    await save(page).click();
    await expect(page.getByText('Could not update saved — try again')).toBeVisible();
    await expect(save(page)).toHaveText('♡');
  });

  test('hydrated saves drive the glyph and the Saved tab, and clear on SIGNED_OUT', async ({ page, isMobile }) => {
    await bootSignedIn(page, { rows:{ saved_events:[{ user_id:USER_ID, event_id:EV_ID, events:EVENT }, { user_id:USER_ID, event_id:OTHER_ID, events:ELSEWHERE }] } }, [EVENT]);
    await detail(page);
    await expect(save(page)).toHaveText('♥');
    await nav(page, isMobile, 'My Shows');
    await page.getByText('Saved', { exact:true }).first().click();
    await expect(page.getByText('Saved Elsewhere').first()).toBeVisible();
    await page.evaluate(() => (window as any).__fake.emit('SIGNED_OUT'));
    await expect(page.locator('body')).not.toContainText('Saved Elsewhere');
  });
});

test.describe('B going / interested', () => {
  test('upsert payload per status, delete on un-RSVP, hydration includes interested', async ({ page }) => {
    await bootSignedIn(page, {}, [EVENT]);
    await detail(page);
    await going(page).click();
    await interested(page).click();
    await expect.poll(async () => (await ops(page, 'attendance', 'upsert')).length).toBe(2);
    const ups = (await ops(page, 'attendance', 'upsert')).map(o => o[0][1]);
    expect(ups).toEqual([
      [{ user_id:USER_ID, event_id:EV_ID, status:'going' }, { onConflict:'user_id,event_id' }],
      [{ user_id:USER_ID, event_id:EV_ID, status:'interested' }, { onConflict:'user_id,event_id' }],
    ]);
    await interested(page).click(); // same status again = un-RSVP
    await expect.poll(async () => (await ops(page, 'attendance', 'delete')).length).toBe(1);
    expect((await ops(page, 'attendance', 'delete'))[0]).toEqual([['delete', []], ['eq', ['user_id', USER_ID]], ['eq', ['event_id', EV_ID]]]);
  });

  test('interested shows hydrate into My Shows', async ({ page, isMobile }) => {
    const row = { user_id:USER_ID, event_id:EV_ID, status:'interested', created_at:'2026-01-01T00:00:00Z', events:EVENT };
    await bootSignedIn(page, { rows:{ attendance:[row] } }, [EVENT]);
    await open(page);
    await nav(page, isMobile, 'My Shows');
    await expect(page.getByText('☆ Interested').first()).toBeVisible();
  });
});

test.describe('C notification prefs', () => {
  const toggle = (page: Page, label: string) => page.locator('label.sw', { hasText:label }).locator('input');
  test('hydrates, upserts one column, rolls back on error', async ({ page, isMobile }) => {
    await bootSignedIn(page, { rows:{ notification_prefs:[{ user_id:USER_ID, show_reminders:false, sale_alerts:true, comment_alerts:true, plan_messages:true }] }, errors:{ 'notification_prefs.upsert':'denied' } }, [EVENT]);
    await open(page);
    await nav(page, isMobile, 'Settings');
    await expect(toggle(page, 'Show reminders')).not.toBeChecked();
    await expect(toggle(page, 'Comment replies')).toBeChecked();
    await page.locator('label.sw', { hasText:'Presale codes' }).click();
    await expect(page.getByText('Could not save that setting — try again')).toBeVisible();
    await expect(toggle(page, 'Presale codes')).toBeChecked();
    expect(await ops(page, 'notification_prefs', 'upsert')).toEqual([[['upsert', [{ user_id:USER_ID, sale_alerts:false }, { onConflict:'user_id' }]]]]);
  });

  test('no row keeps local defaults; toggle writes its column', async ({ page, isMobile }) => {
    await bootSignedIn(page, {}, [EVENT]);
    await open(page);
    await nav(page, isMobile, 'Settings');
    await expect(toggle(page, 'Show reminders')).toBeChecked();
    await expect(toggle(page, 'Comment replies')).not.toBeChecked();
    await page.locator('label.sw', { hasText:'Crew plans' }).click();
    await expect(toggle(page, 'Crew plans')).not.toBeChecked();
    expect(await ops(page, 'notification_prefs', 'upsert')).toEqual([[['upsert', [{ user_id:USER_ID, plan_messages:false }, { onConflict:'user_id' }]]]]);
  });
});

test.describe('D friends', () => {
  const rows = {
    friendships:[
      { id:'f1', requester_id:USER_ID, recipient_id:FRIEND_ID, status:'accepted' },
      { id:'f2', requester_id:PENDING_ID, recipient_id:USER_ID, status:'pending' },
    ],
    profiles:[
      { id:FRIEND_ID, username:'ravefriend', display_name:'Rave Friend', profile_image:null },
      { id:PENDING_ID, username:'newcrew', display_name:'New Crew', profile_image:null },
    ],
    attendance:[{ user_id:FRIEND_ID, event_id:EV_ID, status:'going', created_at:'2026-01-01T00:00:00Z', events:EVENT }],
  };

  test('lists accepted friends, accepts a pending request', async ({ page, isMobile }) => {
    await bootSignedIn(page, { rows }, [EVENT]);
    await open(page);
    await nav(page, isMobile, 'Crew');
    await expect(page.getByText('Rave Friend')).toBeVisible();
    await expect(page.getByText('@ravefriend')).toBeVisible();
    const profileQ = (await fakeCalls(page, 'from')).find((c: any) => c.table === 'profiles' && c.ops.some((o: any) => o[0] === 'in'));
    expect(profileQ.ops.find((o: any) => o[0] === 'in')[1][0]).toBe('id');
    expect([...profileQ.ops.find((o: any) => o[0] === 'in')[1][1]].sort()).toEqual([FRIEND_ID, PENDING_ID].sort());
    await page.locator('.seg__item', { hasText:'Requests' }).click();
    await expect(page.getByText('New Crew')).toBeVisible();
    await page.getByRole('button', { name:'Accept' }).click();
    const [upd] = await ops(page, 'friendships', 'update');
    expect(upd).toEqual([['update', [{ status:'accepted' }]], ['eq', ['id', 'f2']]]);
    await expect(page.getByText('New Crew')).toHaveCount(0);
    await page.locator('.seg__item', { hasText:'Friends' }).click();
    await expect(page.getByText('New Crew')).toBeVisible();
  });

  test('failed accept rolls back', async ({ page, isMobile }) => {
    await bootSignedIn(page, { rows, errors:{ 'friendships.update':'denied' } }, [EVENT]);
    await open(page);
    await nav(page, isMobile, 'Crew');
    await page.locator('.seg__item', { hasText:'Requests' }).click();
    await page.getByRole('button', { name:'Accept' }).click();
    await expect(page.getByText('Could not update that request — try again')).toBeVisible();
    await expect(page.getByText('New Crew')).toBeVisible();
  });

  test('event detail shows accepted friends going, via one in() query', async ({ page }) => {
    await bootSignedIn(page, { rows }, [EVENT]);
    await detail(page);
    await expect(page.getByText('1 friend going')).toBeVisible();
    const q = (await fakeCalls(page, 'from')).find((c: any) => c.table === 'attendance' && c.ops.some((o: any) => o[0] === 'in' && o[1][0] === 'user_id'));
    expect(q.ops).toEqual([['select', ['user_id']], ['eq', ['event_id', EV_ID]], ['eq', ['status', 'going']], ['in', ['user_id', [FRIEND_ID]]]]);
  });

  test('no friends, no social proof', async ({ page }) => {
    await bootSignedIn(page, {}, [EVENT]);
    await detail(page);
    await expect(page.getByText(/friends? going/)).toHaveCount(0);
  });
});

test.describe('E suggest an event', () => {
  const form = async (page: Page) => { await open(page); await page.getByRole('link', { name:'Suggest an event', exact:true }).click(); };
  test('requires artist, city and date', async ({ page }) => {
    await bootSignedIn(page, {}, [EVENT]);
    await form(page);
    const submit = page.getByRole('button', { name:'Submit event' });
    await submit.click();
    await expect(page.getByRole('alert')).toHaveText('Enter the artist or headliner.');
    await page.locator('[data-bind-key="sugArtist"]').fill('Some DJ');
    await submit.click();
    await expect(page.getByRole('alert')).toHaveText('Pick the event date.');
    await page.getByLabel('Event date').fill(day(30));
    await page.getByLabel('Ticket link').or(page.locator('[data-bind-key="sugLink"]')).first().fill('javascript:alert(1)');
    await submit.click();
    await expect(page.getByRole('alert')).toContainText('https://');
    expect(await ops(page, 'events', 'insert')).toHaveLength(0);
  });

  test('inserts a pending_review row and clears the form', async ({ page }) => {
    await bootSignedIn(page, {}, [EVENT]);
    await form(page);
    await page.locator('[data-bind-key="sugArtist"]').fill('Some DJ');
    await page.locator('[data-bind-key="sugVenue"]').fill('The Church');
    await page.getByLabel('Event date').fill(day(30));
    await page.locator('[data-bind-key="sugLink"]').fill('https://tickets.example.test/x');
    await page.getByRole('button', { name:'Submit event' }).click();
    await expect(page.getByText('Submitted for review — we’ll email you when it’s live')).toBeVisible();
    expect(await ops(page, 'events', 'insert')).toEqual([[['insert', [{
      title:'Some DJ at The Church', venue_name:'The Church', city:'Denver', state:'CO', ticket_url:'https://tickets.example.test/x',
      date:day(30) + 'T12:00:00Z', time_tbd:true, submitted_by:USER_ID, status:'pending_review',
    }]]]]);
    await expect(page.locator('[data-bind-key="sugArtist"]')).toHaveValue('');
    await expect(page.getByText('Not available on the web yet — use the iPhone app')).toHaveCount(0);
  });

  test('insert error flashes and keeps the form', async ({ page }) => {
    await bootSignedIn(page, { errors:{ 'events.insert':'denied' } }, [EVENT]);
    await form(page);
    await page.locator('[data-bind-key="sugArtist"]').fill('Keep Me');
    await page.getByLabel('Event date').fill(day(30));
    await page.getByRole('button', { name:'Submit event' }).click();
    await expect(page.getByText('Could not submit — try again')).toBeVisible();
    await expect(page.locator('[data-bind-key="sugArtist"]')).toHaveValue('Keep Me');
    await expect(page.locator('body')).not.toContainText('Submitted for review');
  });
});

test('F FAQ copy is true', async ({ page }) => {
  // City SEO pages render the FAQ inside the SPA.
  await bootSignedIn(page, {}, [EVENT]);
  const src = await (await page.request.get('/app/app.js')).text();
  expect(src).not.toContain('sync your contacts');
  expect(src).toContain('add friends who are on Drop');
  expect(src).toContain('Drop may earn a commission at no extra cost to you');
});
