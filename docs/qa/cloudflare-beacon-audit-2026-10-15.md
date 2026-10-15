# Website Cloudflare beacon audit — 2026-10-15

Completed read-only audit; two open privacy/product findings. No provider setting,
runtime source, database, account, or deployed asset changed.

## Findings

1. **P2 — consent choice does not gate injected RUM.** Fresh `/download` loads
   attempt a Cloudflare analytics POST before any choice. After selecting
   `Essential only` and reloading, `drop.cookie-consent=essential` persists,
   `DropConsent.allowsAnalytics()` is false, and a new page-load POST still
   occurs. `Accept all` also permits the injected script, but does not cause
   its initial loading. The signed-out `app.trydropapp.com` shell also attempts
   RUM before a choice. `consent.js` exposes the intended consent API but has
   no control over the hosting-injected script. The policy's statement that
   the public website currently loads no optional analytics, and its promise
   that Essential only keeps future optional analytics off, do not describe
   this observed RUM behavior. This is a verified product/policy mismatch,
   not a legal conclusion about whether this cookieless RUM requires consent.
2. **P2 — Crew path identifiers enter analytics payloads.** The synthetic URL
   `/crew-picks/audit-synthetic-crew-20261015?audit_query=codex-synthetic-query#codex-synthetic-fragment`
   returns the generic install page with `Referrer-Policy: no-referrer` and
   `X-Robots-Tag: noindex, nofollow`. The outgoing POST has no HTTP Referer
   header, yet JSON `location` contains the complete Crew path, including the
   synthetic identifier. Core Web Vitals `path` fields also contain it in
   captured Chromium payloads. Chromium and mobile WebKit initial payloads
   reproduce the `location` behavior. The tested query string and fragment
   are absent from decoded payloads. No actual board ID, membership data,
   authentication token, phone number, or user content was used or retrieved.
   This establishes a path disclosure mechanism; it does not establish that
   the identifier alone grants board access or that real private data was
   historically retained by Cloudflare.

## Method and results

Capture: **2026-10-15T06:20:17.418Z–06:21:05.487Z**. Repository reference:
`47e6d9184f29b9a4c24689f527d748fcc198d797`. Runtime claims come from live
responses and browser requests, not from that source SHA alone.

Browser plugin was not available. Used existing Playwright 1.61.1 Chromium
and WebKit installs in isolated unsigned-in contexts, preserving connected
Chrome and Claude's tabs. Desktop 1280×900; mobile WebKit 390×844.
The flow under test was: open download/Crew/app fallback → inspect automatic
RUM → select a cookie choice where applicable → reload → compare payloads.

Every `/cdn-cgi/rum` request was intercepted **before delivery**, captured,
and answered locally with 204. All other non-GET/HEAD requests were blocked;
none occurred. Thus these are attempted browser payloads, not proof of
Cloudflare ingestion, processing, or retention. Only synthetic URL markers
were used. Public analytics site tokens were redacted in saved evidence.

| Case | Attempted RUM POSTs | Decoded bodies | Consent state inspected |
| --- | ---: | ---: | --- |
| Download, no choice | 1 | 1 | unset |
| Download, Essential only + reload | 4 | 4 | unset → essential |
| Download, Accept all + reload | 3 | 3 | unset → accepted |
| Crew, no choice | 1 | 1 | unset |
| Crew, Essential only + reload | 3 | 3 | unset → essential |
| Crew, mobile WebKit | 2 | 1 | unset |
| App shell, signed out | 2 | 2 | unset |

Counts include initial load, reload, and unload; they are not a stable
performance contract. A new `eventType=1` page-load payload is present after
each tested choice/reload. One WebKit unload body was unavailable; its
initial body was decoded and supports the Crew finding independently.
The phase label can include the preceding document's unload; distinguish
page loads by `eventType` and `pageloadId` rather than the label alone.

All seven cases returned HTTP 200 with meaningful content, no document
horizontal overflow, and zero captured console warnings/page errors.
Desktop and mobile Crew screenshots show the install content and cookie
banner. Selecting Essential only dismissed the banner and persisted the
choice in both screenshot cases. No login, store navigation, form submission,
real board lookup, or signed-in write was exercised.

The live beacon script returned 200, 31,679 bytes, SHA-256
`3e5bc7ca508f5d5aa7255341243840c8d2b70c8aea323800b51610df3f5a8a2c`.
The live `consent.js` SHA-256
`9551fb89aa8c9064fe97987075ccda075c4b77623fa3bd68d5f1ee530f347578`
matches source. No claim is made about browser cookies/storage beyond the
explicitly inspected consent key; cookie fields in the shared capture are
redacted.

## Evidence and checks

Evidence directory:
`/Users/aryashinde/Documents/Codex/2026-10-15/new-chat/outputs/`.

- `beacon-capture.json`: sanitized request bodies and live state, SHA-256
  `70d7ca7a0caf5189d26fa83681c999c45c35afe8c00ff48c4c22241d3295274f`.
- `beacon-summary.json`: seven-case assertion summary and coverage limits.
- `crew-no-choice.png`, `crew-webkit.png`: inspected desktop/mobile captures.
- Temporary capture driver: sibling `work/capture-beacon.cjs`; no new runtime
  package or browser was installed. No raw HAR or authenticated session saved.
- `bash scripts/build-dist.sh`: pass, 66 deployable files, tracked output unchanged.
- `node --test tests/crew-links.test.mjs`: 3/3 pass, nonempty; verifies the
  unchanged Crew fallback, AASA hold, and headers, not telemetry suppression.
- `git diff --check`: pass before documentation publication.

The full local browser suite was not rerun for this documentation-only change.
The normal PR workflow remains authoritative for repository CI. The fresh
review result and source publication receipt are recorded in the session
closeout, rather than inferred from this audit.

## Next action and boundaries

Recommended minimum remediation: disable the automatic beacon injection that
currently covers the website; keep analytics off until any desired collection
has a reviewed consent and URL policy. First inspect the authoritative Pages
project and/or zone injection settings to identify the exact setting and
whether an ordinary redeployment is needed. The active configuration was
**not inspected** here, so this report is not an executable settings packet.

Then request one exact approval for that live privacy configuration change
and its dependent ordinary redeploy/readback. After approval, verify no RUM
script or POST on fresh download, Crew, and app-shell visits, including
Essential only and reload, while preserving store content, Crew URL/header
behavior, AASA/DAL, and other owners' work. Do not silently remove the cookie
choice or change policy to imply that the mismatch is repaired.

The user's global instructions explicitly require approval before a previously
unapproved production legal/privacy/security mutation. This read-only audit
does not supply that approval. No provider toggle, secret, Worker deployment,
analytics purge, migration, release train, or mobile source work occurred.

Unverified: provider configuration and regional exclusions, DNT/GPC behavior,
authenticated/account callback paths, real historical collection or retention,
physical devices, and natural user traffic. Existing mobile telemetry cleanup,
CI, analytics, design, intake, and outreach remain with Claude's owners.

## Current primary documentation

- [Cloudflare RUM fields and processing](https://developers.cloudflare.com/speed/observatory/rum-beacon/)
  describes page location/referrer/performance collection and cookieless behavior.
  The field-level finding above is based on the capture, not provider claims.
- [Beacon origin and collection](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/)
  identifies the beacon and `/cdn-cgi/rum` endpoints and visibility reporting.
- [Pages Web Analytics](https://developers.cloudflare.com/pages/how-to/web-analytics/)
  documents automatic snippet addition after enabling analytics and deploying.
- [Web Analytics rules](https://developers.cloudflare.com/web-analytics/configuration-options/rules/)
  documents host/path controls for proxied sites. Applicability to this exact
  account/project must be confirmed before proposing a specific mutation.

## Provider access readback

After the capture, opened a separate connected Chrome tab at
`https://dash.cloudflare.com/` without disturbing Claude's tabs. It redirected
to `/login` and displayed the saved-profile sign-in screen. No account/project
configuration was readable; no sign-in, permission grant, or setting change
was initiated. The tab is kept for user sign-in so this lane can identify
the exact remediation target before requesting a production change.
