import type { Page } from '@playwright/test';

export const USER_ID = '11111111-1111-4111-8111-111111111111';

// Signed-in fake Supabase client. Config (window.__cfg): signedOut, failComplianceTimes,
// rows {table: [...]}, rpc {name: data}, errors {'table.op' | 'rpc.name': 'message'},
// hold [table] (queries wait for window.__fake.release()). Records window.__fake.calls.
const FAKE = String.raw`
(function () {
  var cfg = window.__cfg || {}, calls = [], listeners = [], failLeft = cfg.failComplianceTimes || 0, held = [];
  var session = cfg.signedOut ? null : { user:{ id:'${USER_ID}', email:'a@example.com', created_at:'2020-01-01T00:00:00Z' } };
  function res(data, error) { return { data:data, error:error || null, count:0 }; }
  function query(table) {
    var ops = [], chain;
    function run() {
      calls.push({ kind:'from', table:table, ops:ops });
      var err = (cfg.errors || {})[table + '.' + (ops[0] && ops[0][0])];
      // Honour eq/in on columns the row actually has; single/maybeSingle return one row.
      var rows = ((cfg.rows || {})[table] || []).filter(function (r) { return ops.every(function (o) {
        var c = o[1][0];
        return !(c in r) || (o[0] === 'eq' ? r[c] === o[1][1] : o[0] === 'in' ? o[1][1].indexOf(r[c]) > -1 : true);
      }); });
      var one = ops.some(function (o) { return o[0] === 'single' || o[0] === 'maybeSingle'; });
      var gate = (cfg.hold || []).indexOf(table) > -1 ? new Promise(function (r) { held.push(r); }) : Promise.resolve();
      return gate.then(function () { return err ? res(null, { message:err }) : res(one ? rows[0] || null : rows); });
    }
    chain = new Proxy({}, { get:function (_, k) {
      if (k === 'then' || k === 'catch' || k === 'finally') return function () { var p = run(); return p[k].apply(p, arguments); };
      return function () { ops.push([k, [].slice.call(arguments)]); return chain; };
    }});
    return chain;
  }
  window.__fake = {
    calls:calls,
    emit:function (e) { listeners.forEach(function (l) { l(e, session); }); },
    setRows:function (table, rows) { (cfg.rows = cfg.rows || {})[table] = rows; },
    setError:function (key, message) { (cfg.errors = cfg.errors || {})[key] = message; },
    release:function () { cfg.hold = []; held.splice(0).forEach(function (r) { r(); }); }
  };
  window.supabase = { createClient:function () { return {
    auth:{
      getSession:async function () { return { data:{ session:session }, error:null }; },
      onAuthStateChange:function (l) { listeners.push(l); return { data:{ subscription:{ unsubscribe:function () {} } } }; },
      signOut:async function (opts) { calls.push({ kind:'signOut', opts:opts }); session = null; window.__fake.emit('SIGNED_OUT'); return { error:null }; },
      signInWithOAuth:async function (i) { calls.push({ kind:'oauth', input:i }); return { data:{ url:'https://oauth.example.test' }, error:null }; },
      signUp:async function (i) { calls.push({ kind:'signUp', input:i }); return { data:{ session:null }, error:null }; },
      // cfg.mfa = { factors:[...], verifyError } drives two-step sign-in.
      mfa:{
        listFactors:async function () { var all = ((cfg.mfa || {}).factors || []); return res({ all:all, totp:all.filter(function (f) { return f.status === 'verified'; }) }); },
        unenroll:async function (i) { calls.push({ kind:'mfa.unenroll', input:i }); return res({ id:i.factorId }); },
        enroll:async function (i) { calls.push({ kind:'mfa.enroll', input:i }); return res({ id:'factor-1', type:'totp', totp:{ qr_code:'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"/>', secret:'JBSWY3DPEHPK3PXP', uri:'otpauth://totp/Drop' } }); },
        challengeAndVerify:async function (i) { calls.push({ kind:'mfa.verify', input:i }); var e = (cfg.mfa || {}).verifyError; return e ? res(null, { message:e }) : res({ access_token:'aal2' }); }
      }
    },
    functions:{ invoke:async function () { return res({ ok:true }); } },
    rpc:async function (name, args) {
      calls.push({ kind:'rpc', name:name, args:args || null });
      if (name === 'signup_compliance_status') {
        if (failLeft > 0) { failLeft--; return res(null, { message:'rpc unavailable' }); }
        return res({ user_id:'${USER_ID}', complete:true, profile_complete:true, phone_verified:true, phone_enforcement_enabled:false });
      }
      var rpcErr = (cfg.errors || {})['rpc.' + name];
      if (rpcErr) return res(null, { message:rpcErr });
      if (cfg.rpc && name in cfg.rpc) return res(cfg.rpc[name]);
      // Like the server: both directions with the other person's card; blocked pairs dropped either way.
      if (name === 'list_my_friend_edges') {
        var me = '${USER_ID}', rows = cfg.rows || {}, blocks = rows.user_blocks || [];
        return res((rows.friendships || []).filter(function (f) { return f.requester_id === me || f.recipient_id === me; }).map(function (f) {
          var other = f.requester_id === me ? f.recipient_id : f.requester_id;
          var p = (rows.profiles || []).filter(function (x) { return x.id === other; })[0] || {};
          return { friendship_id:f.id, status:f.status, requester_id:f.requester_id, recipient_id:f.recipient_id, other_id:other, other_username:p.username || null, other_display_name:p.display_name || null, other_profile_image:p.profile_image || null, other_city:p.city || null, other_state:p.state || null };
        }).filter(function (e) { return !blocks.some(function (b) { return (b.blocker_id === me && b.blocked_id === e.other_id) || (b.blocker_id === e.other_id && b.blocked_id === me); }); }));
      }
      return res(name === 'complete_signup_profile' ? true : null);
    },
    from:query
  }; } };
})();`;

export async function bootSignedIn(page: Page, cfg: Record<string, unknown> = {}, events: unknown[] = []) {
  await page.addInitScript(c => { (window as any).__cfg = c; }, cfg);
  await page.route('**/vendor/supabase.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:FAKE }));
  await page.route('https://trydropapp.com/consent.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:'' }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.route('**/rest/v1/**', r => r.fulfill({ status:200, contentType:'application/json', headers:{ 'content-range':'*/0' }, body:'[]' }));
  await page.route('**/rest/v1/events?**', r => {
    const offset = Number(new URL(r.request().url()).searchParams.get('offset') || 0);
    r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(offset ? [] : events) });
  });
}

export const fakeCalls = (page: Page, kind: string) =>
  page.evaluate(k => (window as any).__fake.calls.filter((c: any) => c.kind === k), kind);
