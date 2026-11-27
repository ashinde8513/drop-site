import { expect, test } from '@playwright/test';
import { bootSignedIn, fakeCalls } from './helpers/fakeSession';

const ARTIST = '22222222-2222-4222-8222-222222222222';
const VENUE = '33333333-3333-4333-8333-333333333333';
const date = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
const EVENT = { id:'00000000-0000-4000-8000-0000000000aa', title:'Next Night', date, venue_id:VENUE, venue_name:'Mission Ballroom', city:'Denver', state:'CO', status:'published', image_url:null, event_artists:[], is_festival:false };
const writes = async (page: any, table: string) =>
  (await fakeCalls(page, 'from')).filter((c: any) => c.table === table && c.ops[0][0] === 'insert').map((c: any) => c.ops[0][1][0]);

test.describe('?next= from public Follow links', () => {
  test('artist link follows after sign-in and removes next from the URL', async ({ page }) => {
    await bootSignedIn(page, { rows:{ artists:[{ id:ARTIST, name:'Bonobo' }] } }, [EVENT]);
    await page.goto(`/app/index.html?mode=login&next=/artist/${ARTIST}/bonobo`);
    await expect(page.getByText('Following Bonobo').first()).toBeVisible();
    expect(await writes(page, 'artist_follows')).toEqual([{ user_id:'11111111-1111-4111-8111-111111111111', artist_id:ARTIST }]);
    expect(page.url()).not.toContain('next=');
  });

  test('venue link follows the venue after sign-in', async ({ page }) => {
    await bootSignedIn(page, {}, [EVENT]);
    await page.goto(`/app/index.html?mode=login&next=/venue/${VENUE}/mission-ballroom-denver`);
    await expect(page.getByText('Following Mission Ballroom').first()).toBeVisible();
    expect(await writes(page, 'venue_follows')).toEqual([{ user_id:'11111111-1111-4111-8111-111111111111', venue_name:'Mission Ballroom', city:'Denver' }]);
  });

  for (const bad of ['https://evil.example/x', '//evil.example/x', '/artist/not-a-uuid', `/artist/${ARTIST}?x=1`, '/event/abc', `/artist/${ARTIST}/%2e%2e`, 'javascript:alert(1)']) {
    test(`ignores ${bad}`, async ({ page }) => {
      await bootSignedIn(page, { rows:{ artists:[{ id:ARTIST, name:'Bonobo' }] } }, [EVENT]);
      await page.goto(`/app/index.html?mode=login&next=${encodeURIComponent(bad)}`);
      await expect(page.getByText('Next Night').first()).toBeVisible();
      expect(await writes(page, 'artist_follows')).toHaveLength(0);
      expect(await writes(page, 'venue_follows')).toHaveLength(0);
      expect(await page.evaluate(() => sessionStorage.getItem('drop.nextTarget'))).toBeNull();
    });
  }
});
