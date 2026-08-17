# Android App Links contract

The canonical association source is `.well-known/assetlinks.json`. The production build copies that file byte-for-byte into `dist/.well-known/assetlinks.json`, and the deploy workflow fails closed unless the built file is present, byte-identical, and contains the exact approved statement below.

- Android package: `app.resonanceventures.drop`
- Google Play App Signing SHA-256: `E3:15:2D:04:79:CB:20:91:35:16:7C:88:DA:77:07:AE:3D:71:E5:87:C5:97:94:7C:EA:BC:E2:2D:77:5F:A1:F2`
- Verified host contract: `trydropapp.com` only
- Native route contract: `/`, `/event/*`, `/plan/*`, and `/reset-password`

The fingerprint comes from Google Play Console's generated Digital Asset Links statement for the current in-use Play App Signing key. It is public certificate metadata, not the private upload key or an EAS credential.

`www.trydropapp.com` remains an ordinary website redirect to the apex host. The coordinated Phase 2 mobile candidate excludes it from Android intent filters until it directly serves a matching association file with HTTP 200 rather than a redirect; that candidate is not yet shipped.

Source readiness does not mean device readiness. Play-signed 1.0.2 (2) is active in Internal Testing, but physical App Links acceptance remains untested because no Android test device is available.
