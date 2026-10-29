import { expect, test, type Page } from '@playwright/test';
import { bootSignedIn, fakeCalls, USER_ID } from './helpers/fakeSession';

// Admins can read every member's data, so Settings offers them TOTP two-step sign-in.
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const EVENT = { id:'9bd6c283-051a-42d5-a1a6-b01ba64266a4', title:'MFA Night', date:day(5), venue_name:'Mission Ballroom', city:'Denver', state:'CO', status:'published', image_url:null, event_artists:[], is_festival:false, ticket_url:null };
const admin = (isAdmin: boolean) => ({ public_profile:[{ id:USER_ID, is_admin:isAdmin }] });
const settings = async (page: Page, isMobile: boolean) => {
  await page.goto('/app/index.html');
  await expect(page.getByRole('button', { name:isMobile ? 'Menu' : 'Account menu' })).toBeVisible({ timeout:15000 });
  if (isMobile) { await page.getByRole('button', { name:'Menu' }).click(); await page.locator('.mnav__panel').getByRole('button', { name:/Settings/ }).click(); }
  else { await page.getByRole('button', { name:'Account menu' }).click(); await page.getByLabel('Primary').getByRole('button', { name:'Settings', exact:true }).click(); }
  await expect(page.getByRole('heading', { name:'Settings' })).toBeVisible();
};

test('non-admins never see two-step setup', async ({ page, isMobile }) => {
  await bootSignedIn(page, { rpc:admin(false) }, [EVENT]);
  await settings(page, isMobile);
  await expect(page.getByText('Two-step sign-in')).toHaveCount(0);
});

test('admin enrolls TOTP: stale factor cleared, QR shown, code verified', async ({ page, isMobile }) => {
  await bootSignedIn(page, { rpc:admin(true), mfa:{ factors:[{ id:'stale', factor_type:'totp', status:'unverified' }] } }, [EVENT]);
  await settings(page, isMobile);
  await page.getByRole('button', { name:'Set up two-step sign-in' }).click();
  await expect(page.getByAltText('QR code to add Drop to your authenticator app')).toBeVisible();
  await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible();
  expect(await fakeCalls(page, 'mfa.unenroll')).toEqual([{ kind:'mfa.unenroll', input:{ factorId:'stale' } }]);
  const turnOn = page.getByRole('button', { name:'Turn on two-step sign-in' });
  await expect(turnOn).toBeDisabled();
  await page.getByLabel('6-digit code').fill('123456');
  await turnOn.click();
  await expect(page.getByText('On. Signing in to this admin account')).toBeVisible();
  expect(await fakeCalls(page, 'mfa.verify')).toEqual([{ kind:'mfa.verify', input:{ factorId:'factor-1', code:'123456' } }]);
});

test('wrong code keeps setup open with an alert', async ({ page, isMobile }) => {
  await bootSignedIn(page, { rpc:admin(true), mfa:{ verifyError:'Invalid TOTP code entered' } }, [EVENT]);
  await settings(page, isMobile);
  await page.getByRole('button', { name:'Set up two-step sign-in' }).click();
  await page.getByLabel('6-digit code').fill('000000');
  await page.getByRole('button', { name:'Turn on two-step sign-in' }).click();
  await expect(page.getByRole('alert')).toContainText('didn’t match');
  await expect(page.getByAltText('QR code to add Drop to your authenticator app')).toBeVisible();
});

test('admin with a verified factor sees it on', async ({ page, isMobile }) => {
  await bootSignedIn(page, { rpc:admin(true), mfa:{ factors:[{ id:'f', factor_type:'totp', status:'verified' }] } }, [EVENT]);
  await settings(page, isMobile);
  await expect(page.getByText('On. Signing in to this admin account')).toBeVisible();
  await expect(page.getByRole('button', { name:'Set up two-step sign-in' })).toHaveCount(0);
});
