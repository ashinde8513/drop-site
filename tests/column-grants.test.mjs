import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Signed-in clients may select only these columns of public.profiles; any other column in a
// client select fails the whole request at runtime (the 2026-11-27 profile-load incident).
// Pinned from the live column grants for the signed-in role (2026-11-27): when a migration
// widens or narrows them, update this list in the same change.
const PROFILES_SELECTABLE = new Set([
  'id', 'username', 'display_name', 'profile_image', 'city', 'state', 'bio', 'is_plus',
  'is_plus_until', 'show_history_public', 'creator_status', 'creator_code',
]);

const roots = ['.', 'app'];
const files = roots.flatMap((dir) => readdirSync(dir)
  .filter((name) => /\.(js|mjs|html)$/.test(name) && !/^(playwright|lighthouserc)/.test(name))
  .map((name) => join(dir, name)));

// Top-level column names of a PostgREST select string; embedded resources are returned separately.
export function parseSelect(select) {
  const columns = [], embeds = [];
  let depth = 0, token = '', inner = '';
  const flush = () => {
    const t = token.trim();
    if (t && depth === 0) columns.push(t);
    token = '';
  };
  for (const ch of select) {
    if (ch === '(') { if (depth === 0) { inner = ''; embeds.push({ name: token.trim(), body: '' }); token = ''; } else inner += ch; depth++; continue; }
    if (ch === ')') { depth--; if (depth === 0) embeds[embeds.length - 1].body = inner; else inner += ch; continue; }
    if (depth > 0) { inner += ch; continue; }
    if (ch === ',') { flush(); continue; }
    token += ch;
  }
  flush();
  const names = columns.map((c) => c.replace(/::.*$/, '').replace(/^.*:/, '').trim()).filter((c) => c && c !== '*');
  return { columns: names, embeds };
}

function profileColumnsIn(select, rootIsProfiles = false) {
  const found = [];
  const walk = (sel, isProfiles) => {
    const { columns, embeds } = parseSelect(sel);
    if (isProfiles) found.push(...columns);
    for (const e of embeds) walk(e.body, /^(\w+:)?profiles(!.*)?$/.test(e.name.replace(/\s/g, '')));
  };
  walk(select, rootIsProfiles);
  return found;
}

// Every literal client select that reads public.profiles (directly or as an embed).
function profileSelects(source) {
  const out = [];
  const direct = /\.from\(\s*['"]profiles['"]\s*\)[\s\S]{0,400}?\.select\(\s*(['"`])([^'"`]*)\1/g;
  for (const m of source.matchAll(direct)) out.push({ select: m[2], direct: true });
  const embedded = /\.select\(\s*(['"`])([^'"`]*\bprofiles\b[^'"`]*)\1/g;
  for (const m of source.matchAll(embedded)) out.push({ select: m[2], direct: false });
  return out.filter((s) => !s.select.includes('${'));
}

test('parseSelect handles aliases, casts and embeds', () => {
  assert.deepEqual(parseSelect('id,name:username,events(id,title),x::text').columns, ['id', 'username', 'x']);
  assert.deepEqual(profileColumnsIn('user_id,profiles!fk(id,username,email)'), ['id', 'username', 'email']);
  assert.deepEqual(profileColumnsIn('id,events(id,profiles(display_name))'), ['display_name']);
  assert.deepEqual(profileColumnsIn('id,email', true), ['id', 'email']);
});

test('no client select reads a profiles column the signed-in role cannot select', () => {
  const bad = [];
  let checked = 0;
  for (const file of files) {
    for (const { select, direct } of profileSelects(readFileSync(file, 'utf8'))) {
      const cols = profileColumnsIn(select, direct);
      checked++;
      for (const col of cols) if (!PROFILES_SELECTABLE.has(col)) bad.push(`${file}: ${col} in select('${select}')`);
    }
  }
  assert.ok(checked >= 3, `expected to find the app's profile selects, found ${checked}`);
  assert.deepEqual(bad, []);
});
