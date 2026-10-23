import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// /privacy must disclose what the shipped app actually collects (launch-readiness
// audit 2026-10-23, App Privacy §2b). Each line here maps to a declared data type.
test('privacy policy discloses the app data the App Privacy label declares', () => {
  const text = readFileSync(new URL('../privacy.html', import.meta.url), 'utf8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const [what, re] of [
    ['crash reporting via Sentry, unlinked', /crash report to our crash-reporting provider, Sentry.*not linked to your account/],
    ['Sentry listed as a service provider', /Sentry for crash reporting/],
    ['precise location on crew notes, shared with the crew', /one precise point \(latitude and longitude\).*members of that plan's crew/],
    ['calendar read for import, write for add', /adds shows you choose to your calendar.*reads calendar events on your device/],
    ['photo dates/locations read on device', /reads photo dates and locations on your device/],
    ['required phone verification', /requires verifying a mobile phone number/],
    ['SoundCloud import', /Apple Music or SoundCloud/],
    ['no raw contact upload', /raw address-book details are not uploaded to or stored by Drop/],
    ['Google Fonts recipient (audit 06 M4)', /Google Fonts, which receives your IP address/],
    ['Cloudflare hosting + network-error reports', /Cloudflare for website hosting, security, and network-error reports/],
    ['OpenFreeMap tiles (A56)', /OpenFreeMap, which serves map tiles through Cloudflare.*Drop sends it no account information/],
    ['QR scan attribution', /record the scan with your device type/],
    ['referral/creator code storage', /referral or creator code/],
  ]) assert.match(text, re, what);
  assert.doesNotMatch(text, /does not share your device location or a live crew location/, 'stale pre-1.0.4 location claim');
  assert.doesNotMatch(text, /optional SMS phone verification/, 'phone verification is required');
  assert.match(text, /delete or de-identify associated personal information within 30 days/, 'deletion commitment (A56)');
  const del = readFileSync(new URL('../delete-account.html', import.meta.url), 'utf8');
  assert.match(del, /within 30 days\./, '/delete-account states the same commitment');
  assert.doesNotMatch(text + del, /reasonable period/);
});
