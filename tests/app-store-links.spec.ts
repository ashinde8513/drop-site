import { expect, test } from '@playwright/test';

// Download buttons go straight to the device's store; Android links carry a
// Play install referrer naming the surface so Play Console can attribute installs.
const PLAY = 'https://play.google.com/store/apps/details?id=app.resonanceventures.drop';
const APP_STORE = 'https://apps.apple.com/us/app/drop-edm-events/id6790662825';

for (const [ua, expected] of [
  ['Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36', PLAY + '&referrer=utm_source%3Dtrydropapp.com%26utm_medium%3Dhome%26utm_campaign%3Dweb_download'],
  ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148', APP_STORE],
]) {
  test.describe(ua.includes('Android') ? 'Android' : 'iPhone', () => {
    test.use({ userAgent: ua });
    test('homepage download buttons target the device store', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css', body:'' }));
      await page.route('**/rest/v1/**', route => route.fulfill({ status:200, contentType:'application/json', body:'[]' }));
      await page.goto('/index.html');
      const buttons = page.locator('[data-app-download="home"]');
      await expect(buttons).toHaveCount(2);
      for (const button of await buttons.all()) await expect(button, errors.join(' | ')).toHaveAttribute('href', expected);
      expect(errors).toEqual([]);
    });
  });
}

test('link hub forwards an allowlisted bio utm_source into the Play referrer', async ({ page }) => {
  await page.goto('/link.html?utm_source=Instagram&utm_campaign=bio');
  await expect(page.locator('#getGooglePlay')).toHaveAttribute('href', PLAY + '&referrer=utm_source%3Dinstagram%26utm_medium%3Dlink_hub%26utm_campaign%3Dbio');
  await page.goto('/link.html?utm_source=<script>');
  await expect(page.locator('#getGooglePlay')).toHaveAttribute('href', PLAY + '&referrer=utm_source%3Dtrydropapp.com%26utm_medium%3Dlink_hub%26utm_campaign%3Dweb_download');
  await expect(page.getByText('Some ticket links in Drop may be affiliate links')).toBeVisible();
});
