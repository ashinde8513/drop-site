import { expect, test, type Page } from '@playwright/test';

const EVENT_ID = '53a7be5f-7165-4613-8be8-b2dfa6538a0d';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=app.resonanceventures.drop';
const eventRow = {
  id:EVENT_ID, title:'Out-of-city <img src=x onerror=alert(1)> show', date:'2025-01-02',
  venue_name:'The Fillmore', city:'San Francisco', state:'CA', status:'published',
  ticket_url:'https://tickets.example.test/show', event_artists:[], is_festival:false,
};

const FAKE_SUPABASE = String.raw`
(function () {
  var config = Object.assign({ session:false, failAttendance:false, phoneRequired:false }, window.__eventIntentConfig || {});
  var calls = [], listeners = [];
  var session = config.session ? { user:{ id:'${USER_ID}', email:'test@example.com', created_at:new Date().toISOString() } } : null;
  function result(data,error,count){ return {data:data,error:error||null,count:count||0}; }
  function query(table){
    var operation='', payload=null, recorded=false;
    var chain = new Proxy({}, { get:function(_,key){
      if(key==='then') return function(resolve,reject){
        if(operation && !recorded){ calls.push({kind:'write',table:table,operation:operation,payload:payload}); recorded=true; }
        var out = table==='attendance' && operation && config.failAttendance
          ? result(null,{message:'write failed'}) : result([],null,0);
        var delivery = table==='venue_follows' && operation && config.delayFollow
          ? new Promise(function(done){ setTimeout(function(){done(out);},250); })
          : Promise.resolve(out);
        return delivery.then(resolve,reject);
      };
      if(key==='catch') return function(reject){ return Promise.resolve(result([],null,0)).catch(reject); };
      if(key==='finally') return function(done){ return Promise.resolve(result([],null,0)).finally(done); };
      return function(value){
        if(key==='insert'||key==='upsert'||key==='delete'){ operation=String(key); payload=value||null; }
        return chain;
      };
    }});
    return chain;
  }
  var client={
    auth:{
      getSession:async function(){ return {data:{session:session},error:null}; },
      onAuthStateChange:function(fn){ listeners.push(fn); return {data:{subscription:{unsubscribe:function(){}}}}; },
      signOut:async function(){ session=null; listeners.forEach(function(fn){fn('SIGNED_OUT',null);}); return {error:null}; },
      signInWithPassword:async function(){ if(config.loginError) return {data:{session:null},error:{message:'Bad login'}}; session={user:{id:'${USER_ID}',email:'test@example.com'}}; return {data:{session:session},error:null}; },
      signInWithOAuth:async function(input){ calls.push({kind:'oauth',input:input}); return {data:{},error:null}; },
      signUp:async function(input){ calls.push({kind:'signup',input:input}); return {data:{session:null},error:null}; },
      resend:async function(input){ calls.push({kind:'resend',input:input}); return {data:{},error:null}; },
      resetPasswordForEmail:async function(email,input){ calls.push({kind:'reset',email:email,input:input}); return {data:{},error:null}; },
      updateUser:async function(){ return {data:{},error:null}; }, verifyOtp:async function(){return {data:{session:session},error:null};}, setSession:async function(){return {data:{session:session},error:null};}
    },
    rpc:async function(name){
      calls.push({kind:'rpc',name:name});
      if(name==='signup_compliance_status') return result(config.phoneRequired
        ? {user_id:'${USER_ID}',complete:true,profile_complete:true,phone_verified:false,phone_enforcement_enabled:false}
        : {user_id:'${USER_ID}',complete:true});
      return result(null);
    },
    functions:{invoke:async function(name,options){
      calls.push({kind:'function',name:name,body:options&&options.body});
      if(name==='verify-phone' && options.body.action==='check'){ config.phoneRequired=false; return result({verified:true}); }
      if(name==='verify-phone') return result({ok:true});
      return result({ok:true});
    }},
    from:function(table){ return query(table); }
  };
  window.__eventIntentFake={calls:calls,config:config,signOut:function(){return client.auth.signOut();}};
  window.supabase={createClient:function(){return client;}};
})();`;

function destination(action:string, seconds=3600) {
  return `/event/${EVENT_ID}?action=${action}&expires=${Math.floor(Date.now()/1000)+seconds}`;
}
async function install(page:Page, config:Record<string,unknown>={}) {
  await page.addInitScript(value => { (window as any).__eventIntentConfig=value; }, config);
  await page.route('**/vendor/supabase.js', route => route.fulfill({status:200,contentType:'application/javascript',body:FAKE_SUPABASE}));
  await page.route('https://trydropapp.com/consent.js', route => route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({status:200,contentType:'text/css',body:''}));
  // Playwright checks routes newest-first, so register the generic fallback first.
  await page.route('**/rest/v1/**', route => route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'*/0'},body:'[]'}));
  await page.route('**/rest/v1/events?**', async route => {
    const url=new URL(route.request().url());
    const exact=url.searchParams.get('id')===`eq.${EVENT_ID}`;
    if(!exact) await new Promise(resolve=>setTimeout(resolve,Number((config as any).catalogDelayMs||250)));
    await route.fulfill({status:200,contentType:'application/json',headers:{'content-range':'*/0'},body:JSON.stringify(exact?[eventRow]:[])});
  });
}
async function writes(page:Page){ return page.evaluate(() => (window as any).__eventIntentFake.calls.filter((x:any)=>x.kind==='write')); }

test.describe('public event intent continuation', () => {
  test('public event actions carry only bounded exact event intents', async ({page}) => {
    await page.route('**/rest/v1/events?**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([eventRow])}));
    await page.goto(`/event.html?id=${EVENT_ID}`);
    for(const action of ['going','interested','save','follow','plan','invite']){
      const href=await page.locator(`a[href*="action%3D${action}"]`).first().getAttribute('href');
      expect(href).toBeTruthy();
      const url=new URL(href!); const target=url.searchParams.get('returnTo')!;
      expect(target).toMatch(new RegExp(`^/event/${EVENT_ID}\\?action=${action}&expires=\\d{10}$`));
      expect(Number(new URL(target,'https://safe.test').searchParams.get('expires'))-Math.floor(Date.now()/1000)).toBeGreaterThan(86390);
      expect(url.origin).toBe('https://app.trydropapp.com');
      expect(url.searchParams.get('mode')).toBe(['going','interested','follow'].includes(action)?'login':null);
    }
  });

  test('public event without a venue does not offer a follow intent', async ({page}) => {
    const noVenue={...eventRow,venue_name:null};
    await page.route('**/rest/v1/events?**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([noVenue])}));
    await page.goto(`/event.html?id=${EVENT_ID}`);
    await expect(page.getByRole('link',{name:'＋ Follow venue'})).toHaveCount(0);
    await expect(page.locator('a[href*="action%3Dfollow"]')).toHaveCount(0);
  });

  test('rejects hostile, malformed, duplicate and expired return targets', async ({page}) => {
    await install(page);
    const validExpiry=Math.floor(Date.now()/1000)+3600;
    const bad=[
      'https://evil.example/', '//evil.example/x', `/event/x/../${EVENT_ID}?action=going&expires=${validExpiry}`,
      `/event/%2e%2e/${EVENT_ID}?action=going&expires=${validExpiry}`,
      `/event/${EVENT_ID}?action=%67oing&expires=${validExpiry}`,
      `/event/${EVENT_ID}?action=delete&expires=${validExpiry}`,
      `/event/${EVENT_ID}?action=going&expires=${Math.floor(Date.now()/1000)-1}`,
      `/event/${EVENT_ID}?action=going&expires=${Math.floor(Date.now()/1000)+90000}`,
      `/event/${EVENT_ID}?action=going&action=interested&expires=${validExpiry}`,
      `/event/${EVENT_ID}?action=going&expires=${validExpiry}&extra=1`,
      `/event/${'a'.repeat(180)}?action=going&expires=${validExpiry}`,
    ];
    for(const value of bad){
      await page.goto('/app/index.html?mode=login&returnTo='+encodeURIComponent(value));
      expect(await page.evaluate(()=>sessionStorage.getItem('drop.eventIntent'))).toBeNull();
      expect(new URL(page.url()).searchParams.has('returnTo')).toBe(false);
    }
    const good=destination('going');
    await page.goto('/app/index.html?returnTo='+encodeURIComponent(good)+'&returnTo='+encodeURIComponent(good));
    expect(await page.evaluate(()=>sessionStorage.getItem('drop.eventIntent'))).toBeNull();
  });

  test('native-only plan survives reload, preserves exact event, and cancels without a write', async ({page}) => {
    await install(page);
    await page.goto('/app/index.html?returnTo='+encodeURIComponent(destination('plan')));
    await expect(page.getByText('Plan with friends · Out-of-city', {exact:false})).toBeVisible();
    await expect(page.getByRole('link',{name:'Open this event in Drop'})).toHaveAttribute('href',`https://trydropapp.com/event/${EVENT_ID}`);
    await expect(page.getByRole('button',{name:'Get Drop'})).toBeVisible();
    expect(await writes(page)).toHaveLength(0);
    await page.reload();
    await expect(page.getByRole('link',{name:'Open this event in Drop'})).toBeVisible();
    await page.getByRole('button',{name:'Cancel'}).click();
    expect(await page.evaluate(()=>sessionStorage.getItem('drop.eventIntent'))).toBeNull();
    expect(await writes(page)).toHaveLength(0);
    await page.reload();
    await expect(page.getByRole('link',{name:'Open this event in Drop'})).toHaveCount(0);
  });

  test('signed-in native-only intent stays on discovery until explicit cancel', async ({page}) => {
    await install(page,{session:true});
    await page.goto('/app/index.html?returnTo='+encodeURIComponent(destination('plan')));
    await expect(page.getByText('Plan with friends · Out-of-city', {exact:false})).toBeVisible();
    await expect(page.getByRole('link',{name:'Open this event in Drop'})).toHaveAttribute('href',`https://trydropapp.com/event/${EVENT_ID}`);
    await expect(page.getByRole('button',{name:'Confirm Plan with friends'})).toHaveCount(0);
    await expect(page.getByText('← Back to discover')).toHaveCount(0);
    expect(await writes(page)).toHaveLength(0);
    expect(await page.evaluate(()=>sessionStorage.getItem('drop.eventIntent'))).toContain('action=plan');
    await page.getByRole('button',{name:'Cancel'}).click();
    expect(await page.evaluate(()=>sessionStorage.getItem('drop.eventIntent'))).toBeNull();
    expect(await writes(page)).toHaveLength(0);
  });

  test('signed-in RSVP fetches the exact filtered-out event and waits for explicit success', async ({page}) => {
    await install(page,{session:true});
    await page.goto('/app/index.html?returnTo='+encodeURIComponent(destination('going')));
    await expect(page.getByText('RSVP Going · Out-of-city', {exact:false})).toBeVisible();
    await page.waitForTimeout(350); // filtered catalog finishes after the exact-event request
    await expect(page.getByText('Out-of-city <img src=x onerror=alert(1)> show',{exact:true}).first()).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(await writes(page)).toHaveLength(0);
    await page.getByRole('button',{name:'Confirm RSVP Going'}).click();
    await expect.poll(()=>writes(page)).toHaveLength(1);
    await expect(page.getByText('Going saved')).toBeVisible();
    expect(await page.evaluate(()=>sessionStorage.getItem('drop.eventIntent'))).toBeNull();
  });

  test('failed RSVP stays pending and never reports success', async ({page}) => {
    await install(page,{session:true,failAttendance:true});
    await page.goto('/app/index.html?returnTo='+encodeURIComponent(destination('interested')));
    await page.getByRole('button',{name:'Confirm RSVP Interested'}).click();
    await expect(page.getByText('Nothing changed. Try again or cancel.')).toBeVisible();
    await expect(page.getByText('Interested saved')).toHaveCount(0);
    expect(await page.evaluate(()=>sessionStorage.getItem('drop.eventIntent'))).toContain('action=interested');
  });

  test('phone gate keeps context and performs no RSVP before final confirmation', async ({page}) => {
    await install(page,{session:true,phoneRequired:true});
    await page.goto('/app/index.html?returnTo='+encodeURIComponent(destination('going')));
    await expect(page.getByRole('heading',{name:'Verify your phone'})).toBeVisible();
    await expect(page.getByText('RSVP Going · Out-of-city',{exact:false})).toBeVisible();
    expect(await writes(page)).toHaveLength(0);
    await page.getByPlaceholder('(303) 555-0100').fill('5551234567');
    await page.getByRole('button',{name:'Text me a code'}).click();
    await page.getByPlaceholder('123456').fill('123456');
    await page.getByRole('button',{name:'Verify phone'}).click();
    await expect(page.getByRole('button',{name:'Confirm RSVP Going'})).toBeVisible();
    expect(await writes(page)).toHaveLength(0);
  });

  test('missing or unpublished exact event clears intent without showing another event', async ({page}) => {
    await install(page);
    await page.unroute('**/rest/v1/events?**');
    await page.route('**/rest/v1/events?**', route => route.fulfill({status:200,contentType:'application/json',body:'[]'}));
    await page.goto('/app/index.html?returnTo='+encodeURIComponent(destination('going')));
    await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('drop.eventIntent'))).toBeNull();
    await expect(page.getByRole('button',{name:'Confirm RSVP Going'})).toHaveCount(0);
    await expect(page.getByText(eventRow.title,{exact:true})).toHaveCount(0);
  });

  test('password recovery callback retains the bounded intent', async ({page}) => {
    await install(page);
    await page.goto('/app/index.html?mode=login&returnTo='+encodeURIComponent(destination('going')));
    await expect(page.getByText('RSVP Going · Out-of-city',{exact:false})).toBeVisible();
    await page.waitForTimeout(300);
    await page.getByText('Forgot?',{exact:true}).click();
    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByRole('button',{name:'Send reset link'}).click();
    await expect.poll(() => page.evaluate(() => (window as any).__eventIntentFake.calls.some((x:any)=>x.kind==='reset'))).toBe(true);
    const call=await page.evaluate(() => (window as any).__eventIntentFake.calls.find((x:any)=>x.kind==='reset'));
    const callback=new URL(call.input.redirectTo);
    expect(callback.searchParams.get('mode')).toBe('reset-password');
    expect(callback.searchParams.get('returnTo')).toContain(`/event/${EVENT_ID}?action=going&expires=`);
  });

  test('password login error preserves context, then success restores explicit review', async ({page}) => {
    await install(page,{loginError:true,catalogDelayMs:800});
    await page.goto('/app/index.html?mode=login&returnTo='+encodeURIComponent(destination('going')));
    const loginEmail=page.getByPlaceholder('you@example.com');
    const loginPassword=page.getByPlaceholder('••••••••');
    await loginEmail.fill('test@example.com');
    await loginPassword.fill('correct-horse-battery-staple');
    await loginPassword.evaluate((field:HTMLInputElement)=>field.setSelectionRange(8,8));
    await page.waitForTimeout(900); // delayed catalog forces a same-screen full-tree render
    await expect(loginEmail).toHaveValue('test@example.com');
    await expect(loginPassword).toHaveValue('correct-horse-battery-staple');
    expect(await page.evaluate(()=>({id:(document.activeElement as HTMLElement)?.id,start:(document.activeElement as HTMLInputElement)?.selectionStart}))).toEqual({id:'login-password',start:8});
    await page.getByRole('button',{name:'Log in',exact:true}).click();
    await expect(page.getByText('Bad login')).toBeVisible({timeout:15000});
    expect(await page.evaluate(()=>sessionStorage.getItem('drop.eventIntent'))).toContain('action=going');
    expect(await writes(page)).toHaveLength(0);
    await page.evaluate(() => { (window as any).__eventIntentFake.config.loginError=false; });
    await page.getByPlaceholder('you@example.com').fill('test@example.com');
    await page.getByPlaceholder('••••••••').fill('correct-horse-battery-staple');
    await page.getByRole('button',{name:'Log in',exact:true}).click();
    await expect(page.getByRole('button',{name:'Confirm RSVP Going'})).toBeVisible();
    expect(await writes(page)).toHaveLength(0);
  });

  test('OAuth and signup callbacks retain only the bounded intent through age consent', async ({page}) => {
    await install(page);
    const target=destination('interested');
    await page.goto('/app/index.html?mode=login&returnTo='+encodeURIComponent(target));
    await page.getByRole('button',{name:'Continue with Google'}).click();
    const oauth=await page.evaluate(() => (window as any).__eventIntentFake.calls.find((x:any)=>x.kind==='oauth'));
    expect(new URL(oauth.input.options.redirectTo).searchParams.get('returnTo')).toBe(target);

    await page.goto('/app/index.html?mode=signup&returnTo='+encodeURIComponent(target));
    await expect(page.getByText('RSVP Interested · Out-of-city',{exact:false})).toBeVisible();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('username').fill('intentuser');
    await page.locator('#signup-email').fill('intent@example.com');
    await page.locator('#signup-password').fill('correct-horse-battery-staple');
    await page.locator('#signup-dob').fill('2020-01-01');
    await page.locator('#signup-consent').evaluate((element:HTMLInputElement)=>{
      element.checked=true; element.dispatchEvent(new Event('change',{bubbles:true}));
    });
    await page.getByRole('button',{name:/Create account/i}).click();
    await expect(page.getByText('You must be 13 or older to use Drop.')).toBeVisible();
    expect(await writes(page)).toHaveLength(0);
    const today=new Date(); const exact13=new Date(Date.UTC(today.getUTCFullYear()-13,today.getUTCMonth(),today.getUTCDate())).toISOString().slice(0,10);
    await page.getByPlaceholder('username').fill('intentuser');
    await page.locator('#signup-email').fill('intent@example.com');
    await page.locator('#signup-password').fill('correct-horse-battery-staple');
    await page.locator('#signup-dob').fill(exact13);
    await page.locator('#signup-consent').evaluate((element:HTMLInputElement)=>{
      element.checked=true; element.dispatchEvent(new Event('change',{bubbles:true}));
    });
    await page.getByRole('button',{name:/Create account/i}).click();
    await expect.poll(() => page.evaluate(() => (window as any).__eventIntentFake.calls.some((x:any)=>x.kind==='signup'))).toBe(true);
    const signup=await page.evaluate(() => (window as any).__eventIntentFake.calls.find((x:any)=>x.kind==='signup'));
    expect(new URL(signup.input.options.emailRedirectTo).searchParams.get('returnTo')).toBe(target);
  });

  test('completed password recovery still returns to review, not an automatic RSVP', async ({page}) => {
    await install(page,{session:true,catalogDelayMs:800});
    await page.goto('/app/index.html?mode=reset-password&returnTo='+encodeURIComponent(destination('going')));
    await expect(page.getByRole('heading',{name:'Choose a new password'})).toBeVisible();
    const resetPassword=page.locator('#reset-password');
    const resetConfirm=page.locator('#reset-password-confirm');
    await resetPassword.fill('new-correct-password');
    await resetConfirm.fill('new-correct-password');
    await resetConfirm.evaluate((field:HTMLInputElement)=>field.setSelectionRange(6,6));
    await page.waitForTimeout(900); // delayed catalog forces a same-screen full-tree render
    await expect(resetPassword).toHaveValue('new-correct-password');
    await expect(resetConfirm).toHaveValue('new-correct-password');
    expect(await page.evaluate(()=>({id:(document.activeElement as HTMLElement)?.id,start:(document.activeElement as HTMLInputElement)?.selectionStart}))).toEqual({id:'reset-password-confirm',start:6});
    await page.getByRole('button',{name:'Update password'}).click();
    await expect(page.getByRole('heading',{name:'Choose a new password'})).toHaveCount(0);
    const loginHeading=page.getByRole('heading',{name:'Welcome back'});
    const confirm=page.getByRole('button',{name:'Confirm RSVP Going'});
    await expect(loginHeading.or(confirm).first()).toBeVisible({timeout:15000});
    if (await loginHeading.isVisible()) {
      await page.getByPlaceholder('you@example.com').fill('test@example.com');
      await page.getByPlaceholder('••••••••').fill('new-correct-password');
      await page.getByRole('button',{name:'Log in',exact:true}).click();
    }
    await expect(confirm).toBeVisible({timeout:15000});
    expect(await page.evaluate(()=>sessionStorage.getItem('drop.eventIntent'))).toContain('action=going');
    expect(await writes(page)).toHaveLength(0);
  });

  test('sign-out during a delayed venue follow suppresses stale success state', async ({page}) => {
    await install(page,{session:true,delayFollow:true});
    await page.goto('/app/index.html?returnTo='+encodeURIComponent(destination('follow')));
    await page.getByRole('button',{name:'Confirm Follow venue'}).click();
    await page.evaluate(() => (window as any).__eventIntentFake.signOut());
    await page.waitForTimeout(350);
    await expect(page.getByText('Following venue saved')).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'Welcome back'})).toBeVisible();
    expect(await page.evaluate(()=>sessionStorage.getItem('drop.eventIntent'))).toContain('action=follow');
  });

});

test('download page and app expose both official stores', async ({page}) => {
  await page.goto('/download.html');
  await expect(page.getByText('Available for iPhone and Android',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Download Drop on the App Store'})).toHaveAttribute('href','https://apps.apple.com/us/app/drop-edm-events/id6790662825');
  await expect(page.getByRole('link',{name:'Get Drop on Google Play'})).toHaveAttribute('href',PLAY_STORE);
  await expect(page.getByText('Is Android coming?')).toHaveCount(0);
  await expect.poll(()=>page.getByRole('link',{name:'Get Drop on Google Play'}).locator('img').evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
});
