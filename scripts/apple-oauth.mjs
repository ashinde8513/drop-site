#!/usr/bin/env node
/**
 * apple-oauth — connect Sign in with Apple to the Drop Supabase project.
 *
 * Commands
 *   secret   Generate the Apple client-secret JWT (ES256) from a .p8 key.
 *   status   Show the project's current Apple provider + redirect-URL config.
 *   apply    Enable the Apple provider and/or add the redirect allowlist
 *            entries via the Supabase Management API.
 *   verify   No-token end-to-end probe: AASA served correctly + the
 *            /auth/v1/authorize?provider=apple endpoint redirects to Apple.
 *
 * Run `node scripts/apple-oauth.mjs help` for flags and examples.
 * Full walkthrough (Apple Developer portal side included): docs/APPLE_OAUTH.md
 */

import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

// ── Project constants ────────────────────────────────────────────────────────
const PROJECT_REF = 'ebccwnkmsnhbljxxxdej';               // Supabase "Drop App"
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const MGMT_API = 'https://api.supabase.com';
const TEAM_ID = 'S6H8PA7TUH';                             // Apple Developer Team
const BUNDLE_ID = 'app.drop.mobile';                      // native app (ID-token flow)
const SERVICES_ID = 'app.drop.mobile.web';                // web Services ID (create in portal)
const APPLE_AUD = 'https://appleid.apple.com';
// Supabase validates the token audience against this comma-separated list:
// Services ID first (web OAuth code flow), bundle ID second (native ID-token flow).
const DEFAULT_CLIENT_IDS = `${SERVICES_ID},${BUNDLE_ID}`;
// Redirect URLs the SPA needs allowlisted (PROJECT_STATE "Exact next step" 0).
const REDIRECT_URLS = [
  'https://app.trydropapp.com/**',
  'https://trydropapp.com/app/**',
];
const MAX_SECRET_SECONDS = 15777000; // Apple hard cap: ~6 months

// ── Helpers ──────────────────────────────────────────────────────────────────
const b64url = (buf) => Buffer.from(buf).toString('base64url');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) args[key] = true;
      else { args[key] = next; i++; }
    } else args._.push(a);
  }
  return args;
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function accessToken() {
  const tok = process.env.SUPABASE_ACCESS_TOKEN;
  if (!tok) {
    fail(
      'SUPABASE_ACCESS_TOKEN is not set.\n' +
      '  Create a personal access token at https://supabase.com/dashboard/account/tokens\n' +
      '  then: export SUPABASE_ACCESS_TOKEN=sbp_...'
    );
  }
  return tok;
}

async function mgmt(method, path, body) {
  const res = await fetch(`${MGMT_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) fail(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

// ── secret: Apple client-secret JWT ─────────────────────────────────────────
function makeSecret({ keyPath, keyId, teamId, clientId, days }) {
  const pem = readFileSync(keyPath, 'utf8');
  const key = createPrivateKey(pem);
  if (key.asymmetricKeyType !== 'ec') fail(`${keyPath} is not an EC key (.p8 from Apple is ES256/P-256)`);

  const now = Math.floor(Date.now() / 1000);
  const lifetime = Math.min(Math.floor(days * 86400), MAX_SECRET_SECONDS);
  const header = { alg: 'ES256', kid: keyId };
  const payload = { iss: teamId, iat: now, exp: now + lifetime, aud: APPLE_AUD, sub: clientId };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  // JWT ES256 needs the raw 64-byte r||s signature, not DER.
  const sig = sign('sha256', Buffer.from(signingInput), { key, dsaEncoding: 'ieee-p1363' });
  return { jwt: `${signingInput}.${sig.toString('base64url')}`, exp: payload.exp };
}

function cmdSecret(args) {
  const keyPath = args.key || fail('--key <path/to/AuthKey_XXXXXXXXXX.p8> is required');
  const keyId = args['key-id'] || fail('--key-id <10-char Key ID from the Apple portal> is required');
  const { jwt, exp } = makeSecret({
    keyPath,
    keyId,
    teamId: args['team-id'] || TEAM_ID,
    clientId: args['client-id'] || SERVICES_ID,
    days: Number(args.days || 180),
  });
  console.error(`# Apple client secret (sub=${args['client-id'] || SERVICES_ID}), expires ${new Date(exp * 1000).toISOString()}`);
  console.error('# Rotate before expiry — Apple caps secrets at 6 months.');
  console.log(jwt);
  return jwt;
}

// ── status / apply: Supabase Management API ─────────────────────────────────
function mergedAllowlist(current) {
  const entries = (current || '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const url of REDIRECT_URLS) if (!entries.includes(url)) entries.push(url);
  return entries.join(',');
}

async function cmdStatus() {
  const cfg = await mgmt('GET', `/v1/projects/${PROJECT_REF}/config/auth`);
  const allow = (cfg.uri_allow_list || '').split(',').map((s) => s.trim()).filter(Boolean);
  console.log(`site_url:            ${cfg.site_url}`);
  console.log(`apple enabled:       ${cfg.external_apple_enabled}`);
  console.log(`apple client_id(s):  ${cfg.external_apple_client_id || '(unset)'}`);
  console.log(`apple secret set:    ${cfg.external_apple_secret ? 'yes' : 'no'}`);
  console.log('redirect allowlist:');
  if (!allow.length) console.log('  (empty — everything falls back to site_url)');
  for (const u of allow) console.log(`  ${u}`);
  const missing = REDIRECT_URLS.filter((u) => !allow.includes(u));
  if (missing.length) console.log(`MISSING (run apply): ${missing.join(', ')}`);
}

async function cmdApply(args) {
  const patch = {};

  if (!args['allowlist-only']) {
    let secret = args.secret;
    if (!secret && args.key) {
      secret = makeSecret({
        keyPath: args.key,
        keyId: args['key-id'] || fail('--key-id is required with --key'),
        teamId: args['team-id'] || TEAM_ID,
        clientId: args['sub'] || SERVICES_ID,
        days: Number(args.days || 180),
      }).jwt;
    }
    if (!secret) {
      fail(
        'apply needs the Apple secret: pass --key/--key-id (generates it) or --secret <jwt>.\n' +
        '  To only fix the redirect allowlist, use --allowlist-only.'
      );
    }
    patch.external_apple_enabled = true;
    patch.external_apple_client_id = args['client-id'] || DEFAULT_CLIENT_IDS;
    patch.external_apple_secret = secret;
  }

  if (args['dry-run'] && !process.env.SUPABASE_ACCESS_TOKEN) {
    // No token needed to preview: show the entries that get merged in at run time.
    patch.uri_allow_list = `<existing entries> + ${REDIRECT_URLS.join(',')}`;
  } else {
    const cfg = await mgmt('GET', `/v1/projects/${PROJECT_REF}/config/auth`);
    const merged = mergedAllowlist(cfg.uri_allow_list);
    if (merged !== (cfg.uri_allow_list || '')) patch.uri_allow_list = merged;
  }

  if (!Object.keys(patch).length) { console.log('Nothing to change — config already up to date.'); return; }

  if (args['dry-run']) {
    const preview = { ...patch };
    if (preview.external_apple_secret) preview.external_apple_secret = `<jwt ${patch.external_apple_secret.length} chars>`;
    console.log('DRY RUN — would PATCH /v1/projects/' + PROJECT_REF + '/config/auth with:');
    console.log(JSON.stringify(preview, null, 2));
    return;
  }

  await mgmt('PATCH', `/v1/projects/${PROJECT_REF}/config/auth`, patch);
  console.log('Applied. Current state:');
  await cmdStatus();
}

// ── verify: token-free end-to-end probe ─────────────────────────────────────
async function cmdVerify() {
  let ok = true;
  const check = (label, pass, detail) => {
    ok = ok && pass;
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  };

  const aasa = await fetch('https://trydropapp.com/.well-known/apple-app-site-association', { redirect: 'follow' })
    .then(async (r) => ({ status: r.status, body: await r.text() }))
    .catch((e) => ({ status: 0, body: String(e) }));
  let appIds = [];
  try { appIds = JSON.parse(aasa.body)?.applinks?.details?.[0]?.appIDs || []; } catch { /* not JSON */ }
  check('AASA served', aasa.status === 200, `HTTP ${aasa.status}`);
  check('AASA appID', appIds.includes(`${TEAM_ID}.${BUNDLE_ID}`), appIds.join(',') || 'unparseable');

  const auth = await fetch(`${SUPABASE_URL}/auth/v1/authorize?provider=apple`, { redirect: 'manual' })
    .then((r) => ({ status: r.status, location: r.headers.get('location') || '' }))
    .catch((e) => ({ status: 0, location: String(e) }));
  check(
    'Supabase → Apple authorize redirect',
    auth.status === 302 && auth.location.startsWith(APPLE_AUD),
    `HTTP ${auth.status} → ${auth.location.slice(0, 120) || '(no Location)'}`
  );
  if (auth.status === 302 && auth.location.startsWith(APPLE_AUD)) {
    const cb = new URL(auth.location).searchParams.get('redirect_uri');
    check('Apple redirect_uri = Supabase callback', cb === `${SUPABASE_URL}/auth/v1/callback`, cb || '(none)');
  }

  process.exit(ok ? 0 : 1);
}

// ── main ─────────────────────────────────────────────────────────────────────
const HELP = `apple-oauth — connect Sign in with Apple to Supabase project ${PROJECT_REF}

USAGE
  node scripts/apple-oauth.mjs <command> [flags]

COMMANDS
  secret     Print the Apple client-secret JWT (stderr = notes, stdout = jwt)
               --key <AuthKey_XXXX.p8>   (required) key file from the Apple portal
               --key-id <KID>            (required) 10-char Key ID
               --client-id <id>          JWT sub (default ${SERVICES_ID})
               --team-id <id>            default ${TEAM_ID}
               --days <n>                lifetime, default 180 (Apple max ~182)

  status     Show Apple provider + redirect allowlist (needs SUPABASE_ACCESS_TOKEN)

  apply      Enable Apple provider + merge redirect allowlist (needs SUPABASE_ACCESS_TOKEN)
               --key/--key-id [...]      generate the secret inline (same flags as secret)
               --secret <jwt>            or pass a pre-generated secret
               --client-id <ids>         Supabase client_id list, default ${DEFAULT_CLIENT_IDS}
               --allowlist-only          only add the redirect URLs, skip Apple provider
               --dry-run                 print the PATCH payload without sending

  verify     Token-free live checks: AASA + authorize redirect to Apple

EXAMPLES
  # one-shot full setup
  export SUPABASE_ACCESS_TOKEN=sbp_...
  node scripts/apple-oauth.mjs apply --key ~/Keys/AuthKey_ABC123DEFG.p8 --key-id ABC123DEFG

  # just fix the OAuth redirect bounce (no Apple portal work needed)
  node scripts/apple-oauth.mjs apply --allowlist-only
`;

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0] || 'help';
try {
  if (cmd === 'secret') cmdSecret(args);
  else if (cmd === 'status') await cmdStatus();
  else if (cmd === 'apply') await cmdApply(args);
  else if (cmd === 'verify') await cmdVerify();
  else console.log(HELP);
} catch (e) {
  fail(e.message || String(e));
}
