import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// Python's static test server does not interpret Cloudflare Pages _redirects.
// Emulate only the asserted source rewrite here. Hosted routing and OS link
// interception require separate delivery/device proof.
test('canonical Crew URL renders the existing install page without board requests', async ({ page }) => {
  const errors: string[] = [];
  const boardRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('request', (request) => {
    if (/crew_pick|crew-pick-preview/.test(request.url())) boardRequests.push(request.url());
  });
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.addInitScript(() => localStorage.setItem('drop.cookie-consent', 'essential'));

  const rule = readFileSync('_redirects', 'utf8').split('\n').find((line) => line.startsWith('/crew-picks/:id'));
  expect(rule?.trim().split(/\s+/)).toEqual(['/crew-picks/:id', '/download', '200']);
  const path = '/crew-picks/11111111-1111-4111-8111-111111111111';
  await page.route('**' + path, (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: readFileSync('download.html', 'utf8'),
  }));
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(new RegExp(path + '$'));
  await expect(page).toHaveTitle('Download Drop for iPhone and Android');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Drop in your pocket');
  await expect(page.getByRole('link', { name: 'Download Drop on the App Store', exact: true })).toHaveAttribute('href',
    'https://apps.apple.com/us/app/drop-edm-events/id6790662825?pt=129160185&ct=site-download&mt=8');
  await expect(page.getByRole('link', { name: 'Get Drop on Google Play', exact: true })).toHaveAttribute('href',
    'https://play.google.com/store/apps/details?id=app.resonanceventures.drop&referrer=utm_source%3Dtrydropapp.com%26utm_medium%3Ddownload_page%26utm_campaign%3Dweb_download');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  expect(boardRequests).toEqual([]);
  expect(errors).toEqual([]);
});
