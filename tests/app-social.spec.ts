import { expect, test, type Page } from '@playwright/test';
import { bootSignedIn, fakeCalls, USER_ID } from './helpers/fakeSession';

// Design spec 03 (social surfaces) — Friends, public profile, block/report,
// plan + chat. One test per States-board frame where the data allows.
const EV = { id:'9bd6c283-051a-42d5-a1a6-b01ba64266a4', title:'Social Night', date:new Date(Date.now() + 5 * 86400000).toISOString(), venue_name:'Mission Ballroom', city:'Denver', state:'CO', status:'published', event_artists:[] };
const MAYA = '22222222-2222-4222-8222-000000000001', LENA = '22222222-2222-4222-8222-000000000002', SAM = '22222222-2222-4222-8222-000000000003', DEV = '22222222-2222-4222-8222-000000000004';
const prof = (id: string, name: string, user: string, city = 'Denver', extra: object = {}) => ({ id, display_name:name, username:user, profile_image:null, city, state:'CO', ...extra });
const PROFILES = [prof(MAYA, 'Maya Chen', 'mayachen'), prof(LENA, 'Lena Cruz', 'lenacruz'), prof(DEV, 'Devon Park', 'devonpark', 'Boulder')];
const FRIENDSHIPS = [
  { id:'f1', requester_id:USER_ID, recipient_id:MAYA, status:'accepted' },
  { id:'f2', requester_id:LENA, recipient_id:USER_ID, status:'pending' },
  { id:'f3', requester_id:DEV, recipient_id:USER_ID, status:'pending' },
];
const PLAN = 'aaaaaaaa-0000-4000-8000-000000000001';

async function boot(page: Page, cfg: Record<string, unknown> = {}) {
  await bootSignedIn(page, { rows:{ friendships:FRIENDSHIPS, profiles:PROFILES }, ...cfg }, [EV]);
  await page.goto('/app/index.html');
  await expect(page.getByText('Social Night').first()).toBeVisible();
}
async function friends(page: Page, isMobile: boolean) {
  if (isMobile) { await page.getByRole('button', { name:'Menu' }).click(); await page.locator('.mnav__panel').getByRole('button', { name:/Crew/ }).click(); }
  else { await page.getByRole('button', { name:'Account menu' }).click(); await page.getByLabel('Primary').getByRole('button', { name:'Crew', exact:true }).click(); }
  await expect(page.getByRole('heading', { name:'Friends', exact:true })).toBeVisible();
}
const tab = (page: Page, name: RegExp) => page.getByRole('tablist', { name:'Friends' }).getByRole('tab', { name });

test('tabs carry real counts; friends rows show city and an actions menu; arrows move tabs', async ({ page, isMobile }) => {
  await boot(page);
  await friends(page, isMobile);
  await expect(tab(page, /^Friends 1$/)).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, /^Requests 2$/)).toHaveAttribute('aria-selected', 'false');
  const row = page.locator('.s3-people .s3-row', { hasText:'Maya Chen' });
  await expect(row.getByText('Denver, CO')).toBeVisible();
  await tab(page, /^Friends 1$/).focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, /^Requests 2$/)).toHaveAttribute('aria-selected', 'true');
  await expect(tab(page, /^Requests 2$/)).toBeFocused();
});

test('requests: only the first Accept is primary; accept busy then moves the person to Friends', async ({ page, isMobile }) => {
  await boot(page);
  await friends(page, isMobile);
  await tab(page, /^Requests/).click();
  const first = page.getByRole('button', { name:'Accept request from Lena Cruz' });
  const second = page.getByRole('button', { name:'Accept request from Devon Park' });
  await expect(first).toHaveClass(/btn--primary/);
  await expect(second).toHaveClass(/btn--secondary/);
  await expect(page.locator('main .btn--primary:visible')).toHaveCount(1);
  await first.click();
  await expect(page.getByText('Lena Cruz added to your crew')).toBeVisible();
  await tab(page, /^Friends/).click();
  await expect(page.locator('.s3-people').getByText('Lena Cruz')).toBeVisible();
});

test('empty states: zero friends, zero requests', async ({ page, isMobile }) => {
  await boot(page, { rows:{ friendships:[], profiles:[] } });
  await friends(page, isMobile);
  await expect(tab(page, /^Friends 0$/)).toBeVisible();
  await expect(page.getByText('Search for someone you know, or send them your invite link.')).toBeVisible();
  await tab(page, /^Requests 0$/).click();
  await expect(page.getByText('No requests right now.')).toBeVisible();
});

test('error: inline alert with Try again, never a blank pane', async ({ page, isMobile }) => {
  await boot(page, { errors:{ 'friendships.select':'down' } });
  await friends(page, isMobile);
  await expect(page.locator('.s3-people').getByRole('alert')).toContainText('Check your connection and try again.');
  await expect(page.locator('.s3-people').getByRole('button', { name:'Try again' })).toBeVisible();
});

test('find people: idle prompt, results with relationship states, no-result echo, add friend', async ({ page, isMobile }) => {
  await boot(page, { rpc:{ search_public_profiles:[prof(SAM, 'Sam Okafor', 'samokafor'), prof(MAYA, 'Maya Chen', 'mayachen'), prof(USER_ID, 'Me', 'me')] } });
  await friends(page, isMobile);
  if (isMobile) await tab(page, /^Find$/).click();
  await expect(page.getByText('Type a name or username to find people.')).toBeVisible();
  await page.getByRole('searchbox', { name:'Search people' }).fill('sa');
  await expect(page.getByText('2 people found')).toBeVisible(); // the viewer is excluded
  await expect(page.locator('.s3-find .s3-row', { hasText:'Maya Chen' }).getByText('Friends')).toBeVisible();
  const add = page.getByRole('button', { name:'Add friend, Sam Okafor' });
  await add.click();
  await expect.poll(async () => (await fakeCalls(page, 'from')).filter((c: any) => c.table === 'friendships' && c.ops[0][0] === 'insert').map((c: any) => c.ops[0][1][0]))
    .toEqual([{ requester_id:USER_ID, recipient_id:SAM, status:'pending' }]);
  const calls = (await fakeCalls(page, 'rpc')).filter((c: any) => c.name === 'search_public_profiles');
  expect(calls.at(-1).args).toEqual({ p_query:'sa', p_limit:20 });
});

test('find people: zero results echo the query', async ({ page, isMobile }) => {
  await boot(page, { rpc:{ search_public_profiles:[] } });
  await friends(page, isMobile);
  if (isMobile) await tab(page, /^Find$/).click();
  await page.getByRole('searchbox', { name:'Search people' }).fill('zzq');
  await expect(page.getByText('No one found for ‘zzq’. Check the spelling or try their username.')).toBeVisible();
  await expect(page.getByText('0 people found')).toBeVisible();
});

test('actions menu + block dialog: keyboard menu, focus on Cancel, Escape returns focus, block removes the person', async ({ page, isMobile }) => {
  await boot(page);
  await friends(page, isMobile);
  const more = page.getByRole('button', { name:'More actions for Maya Chen' });
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name:'Remove friend' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name:'Block' })).toBeFocused();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name:'Block Maya Chen?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name:'Cancel' })).toBeFocused();
  await expect(dialog).toContainText("They won't be able to find you or see your profile on Drop, and they won't be told. You can unblock them in Settings.");
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.click();
  await page.getByRole('menuitem', { name:'Block' }).click();
  await page.getByRole('dialog').getByRole('button', { name:'Block Maya Chen' }).click();
  await expect(page.getByText('Maya Chen is blocked.')).toBeVisible();
  await expect(page.locator('.s3-people').getByText('Maya Chen')).toHaveCount(0);
  const ins = (await fakeCalls(page, 'from')).filter((c: any) => c.table === 'user_blocks');
  expect(ins[0].ops).toEqual([['insert', [{ blocker_id:USER_ID, blocked_id:MAYA }]]]);
});

test('report dialog: Send report waits for a reason, then writes a profile report', async ({ page, isMobile }) => {
  await boot(page);
  await friends(page, isMobile);
  await page.getByRole('button', { name:'More actions for Maya Chen' }).click();
  await page.getByRole('menuitem', { name:'Report' }).click();
  const dialog = page.getByRole('dialog', { name:'Report Maya Chen' });
  await expect(dialog.getByRole('button', { name:'Send report' })).toHaveAttribute('aria-disabled', 'true');
  await dialog.getByRole('radio', { name:'Harassment or bullying' }).check();
  await dialog.getByRole('button', { name:'Send report' }).click();
  await expect(page.getByText('Report sent. Thank you.')).toBeVisible();
  const rep = (await fakeCalls(page, 'from')).filter((c: any) => c.table === 'content_reports');
  expect(rep[0].ops).toEqual([['insert', [{ reporter_id:USER_ID, content_type:'profile', content_id:MAYA, reported_user_id:MAYA, reason:'Harassment or bullying' }]]]);
});

test('profile: friends see stats and Going to; non-friends get Add friend and no Shows seen; private and blocked views', async ({ page, isMobile }) => {
  const going = { status:'going', user_id:MAYA, events:{ id:EV.id, title:'Social Night', date:EV.date, venue_name:'Mission Ballroom', city:'Denver' } };
  await boot(page, {
    rows:{ friendships:FRIENDSHIPS, profiles:PROFILES, attendance:[going], artist_follows:[{ user_id:MAYA, artists:{ name:'ODESZA' } }] },
    rpc:{ public_profile:[prof(MAYA, 'Maya Chen', 'mayachen', 'Denver', { bio:'Melodic house forever.' })] },
  });
  await friends(page, isMobile);
  await page.locator('.s3-people').getByText('Maya Chen').click();
  await expect(page.getByRole('heading', { name:'Maya Chen' })).toBeVisible();
  await expect(page.getByText('Melodic house forever.')).toBeVisible();
  await expect(page.locator('.s3-stat', { hasText:'Artists followed' })).toContainText('1');
  await expect(page.locator('.s3-stat', { hasText:'Shows seen' })).toBeVisible(); // friends only
  await expect(page.getByRole('heading', { name:'Going to' })).toBeVisible();
  await expect(page.locator('.s3-chips').getByText('ODESZA')).toBeVisible();
  await expect(page.locator('.s3-pcard').getByText('Friends')).toBeVisible();
  // A private profile: only Back, never Add friend.
  await page.evaluate(() => { (window as any).__cfg.rpc.public_profile = []; });
  await page.getByRole('link', { name:'Back' }).click();
  await page.locator('.s3-people').getByText('Maya Chen').click();
  await expect(page.getByRole('heading', { name:'This profile is private' })).toBeVisible();
  await expect(page.getByRole('button', { name:'Add friend' })).toHaveCount(0);
});

test('plan: members with status chips, RSVP radio group upserts, Enter sends, empty chat copy, one primary', async ({ page, isMobile }) => {
  await boot(page, {
    rpc:{ create_or_get_plan:PLAN },
    rows:{ friendships:FRIENDSHIPS, profiles:PROFILES,
      plans:[{ id:PLAN, event_id:EV.id, creator_id:USER_ID, events:EV }],
      plan_members:[{ plan_id:PLAN, user_id:USER_ID, status:'going', profiles:prof(USER_ID, 'Jordan Reyes', 'jordan') }, { plan_id:PLAN, user_id:MAYA, status:'maybe', profiles:prof(MAYA, 'Maya Chen', 'mayachen') }],
      plan_messages:[] },
  });
  await page.getByText('Social Night').first().click();
  await page.getByRole('button', { name:/Plan with friends/ }).click();
  await expect(page.getByRole('heading', { name:'Social Night' })).toBeVisible();
  await expect(page.getByText('1 going · 1 maybe')).toBeVisible();
  await expect(page.locator('.s3-mem .frow', { hasText:'Maya Chen' }).getByText('Maybe')).toBeVisible();
  await expect(page.getByText('No messages yet. Say hi to your crew.')).toBeVisible();
  const group = page.getByRole('radiogroup', { name:'Your answer' });
  await expect(group.getByRole('radio', { name:"I'm going" })).toHaveAttribute('aria-checked', 'true');
  await group.getByRole('radio', { name:'Maybe' }).click();
  await expect.poll(async () => (await fakeCalls(page, 'from')).filter((c: any) => c.table === 'plan_members' && c.ops[0][0] === 'upsert').map((c: any) => c.ops[0][1]))
    .toEqual([[{ plan_id:PLAN, user_id:USER_ID, status:'maybe' }, { onConflict:'plan_id,user_id' }]]);
  const send = page.getByRole('button', { name:'Send' });
  await expect(send).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('main .btn--primary:visible')).toHaveCount(1); // Send is the only primary (A53)
  await page.getByLabel('Message your crew').fill('Who is driving?');
  await page.getByLabel('Message your crew').press('Enter');
  await expect.poll(async () => (await fakeCalls(page, 'from')).filter((c: any) => c.table === 'plan_messages' && c.ops[0][0] === 'insert').map((c: any) => c.ops[0][1][0]))
    .toEqual([{ plan_id:PLAN, user_id:USER_ID, body:'Who is driving?' }]);
  await expect(page.getByLabel('Message your crew')).toHaveValue('');
});

test('plan: a failed send keeps the text with Try again; leave plan returns to Plans', async ({ page, isMobile }) => {
  await boot(page, {
    rpc:{ create_or_get_plan:PLAN },
    errors:{ 'plan_messages.insert':'denied' },
    rows:{ friendships:FRIENDSHIPS, profiles:PROFILES, plans:[{ id:PLAN, event_id:EV.id, creator_id:USER_ID, events:EV }],
      plan_members:[{ plan_id:PLAN, user_id:USER_ID, status:'going', profiles:prof(USER_ID, 'Jordan Reyes', 'jordan') }], plan_messages:[] },
  });
  await page.getByText('Social Night').first().click();
  await page.getByRole('button', { name:/Plan with friends/ }).click();
  await page.getByLabel('Message your crew').fill('Parking?');
  await page.getByRole('button', { name:'Send' }).click();
  await expect(page.getByText('Not sent', { exact:true })).toBeVisible();
  await expect(page.locator('.s3-m--fail').getByText('Parking?')).toBeVisible();
  await expect(page.locator('.s3-m--fail').getByRole('button', { name:'Try again' })).toBeVisible();
  await page.getByRole('button', { name:'Leave plan' }).click();
  const dialog = page.getByRole('dialog', { name:'Leave this plan?' });
  await expect(dialog.getByRole('button', { name:'Stay in plan' })).toBeFocused();
  await dialog.getByRole('button', { name:'Leave plan' }).click();
  await expect(page.getByText('You left the plan.')).toBeVisible();
  const rpc = (await fakeCalls(page, 'rpc')).filter((c: any) => c.name === 'leave_plan');
  expect(rpc[0].args).toEqual({ p_plan_id:PLAN });
  void isMobile;
});

test('plan: not a member reads neutral, only Back', async ({ page }) => {
  await boot(page, { rpc:{ create_or_get_plan:PLAN }, rows:{ friendships:FRIENDSHIPS, profiles:PROFILES, plans:[], plan_members:[], plan_messages:[] } });
  await page.getByText('Social Night').first().click();
  await page.getByRole('button', { name:/Plan with friends/ }).click();
  await expect(page.getByRole('heading', { name:'This plan is private or no longer exists.' })).toBeVisible();
  await expect(page.getByRole('button', { name:'Back' })).toBeVisible();
});
