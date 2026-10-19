import type { Page } from '@playwright/test';

export const USER_ID = '11111111-1111-4111-8111-111111111111';

// Signed-in fake Supabase client. Config (window.__cfg): signedOut, failComplianceTimes,
// rows {table: [...]}, errors {'table.op': 'message'}. Records window.__fake.calls.
const FAKE = String.raw`
(function () {
  var cfg = window.__cfg || {}, calls = [], listeners = [], failLeft = cfg.failComplianceTimes || 0;
  var session = cfg.signedOut ? null : { user:{ id:'${USER_ID}', email:'a@example.com', created_at:'2020-01-01T00:00:00Z' } };
  function res(data, error) { return { data:data, error:error || null, count:0 }; }
  function query(table) {
    var ops = [], chain;
    function run() {
      calls.push({ kind:'from', table:table, ops:ops });
      var err = (cfg.errors || {})[table + '.' + (ops[0] && ops[0][0])];
      return Promise.resolve(err ? res(null, { message:err }) : res((cfg.rows || {})[table] || []));
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
    setRows:function (table, rows) { (cfg.rows = cfg.rows || {})[table] = rows; }
  };
  window.supabase = { createClient:function () { return {
    auth:{
      getSession:async function () { return { data:{ session:session }, error:null }; },
      onAuthStateChange:function (l) { listeners.push(l); return { data:{ subscription:{ unsubscribe:function () {} } } }; },
      signOut:async function (opts) { calls.push({ kind:'signOut', opts:opts }); session = null; window.__fake.emit('SIGNED_OUT'); return { error:null }; },
      signInWithOAuth:async function (i) { calls.push({ kind:'oauth', input:i }); return { data:{ url:'https://oauth.example.test' }, error:null }; },
      signUp:async function (i) { calls.push({ kind:'signUp', input:i }); return { data:{ session:null }, error:null }; }
    },
    functions:{ invoke:async function () { return res({ ok:true }); } },
    rpc:async function (name, args) {
      calls.push({ kind:'rpc', name:name, args:args || null });
      if (name === 'signup_compliance_status') {
        if (failLeft > 0) { failLeft--; return res(null, { message:'rpc unavailable' }); }
        return res({ user_id:'${USER_ID}', complete:true, profile_complete:true, phone_verified:true, phone_enforcement_enabled:false });
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
