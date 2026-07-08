(function () {
  var Drop = window.Drop || {};
  var SUPA_URL = 'https://ebccwnkmsnhbljxxxdej.supabase.co';
  var SUPA_KEY = 'sb_publishable_ZMsNcfhfqsGgyvsdBDTKHg__h8SDZyd';
  var AUTH_ORIGIN = location.hostname === 'app.trydropapp.com'
    ? 'https://app.trydropapp.com'
    : location.origin;
  var AUTH_REDIRECT = AUTH_ORIGIN + '/login';

  var client = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPA_URL, SUPA_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    })
    : null;

  var mode = modeFromUrl();
  var authPanel = document.getElementById('auth-panel');
  var dashPanel = document.getElementById('dash-panel');
  var authForm = document.getElementById('auth-form');
  var authTitle = document.getElementById('auth-title');
  var authCopy = document.getElementById('auth-copy');
  var authSubmit = document.getElementById('auth-submit');
  var authMessage = document.getElementById('auth-message');
  var modeCopy = document.getElementById('mode-copy');
  var modeButton = document.getElementById('mode-button');
  var forgotButton = document.getElementById('forgot-button');

  function modeFromUrl() {
    var path = location.pathname.replace(/\/+$/, '');
    var query = new URLSearchParams(location.search);
    if (query.get('mode') === 'reset-password') return 'reset-password';
    if (path === '/signup') return 'signup';
    return 'login';
  }

  function setMessage(text, kind) {
    authMessage.textContent = text || '';
    authMessage.className = 'auth-message' + (kind ? ' is-' + kind : '');
  }

  function setBusy(busy) {
    authSubmit.disabled = busy;
    authSubmit.textContent = busy ? 'Working...' : labelForMode();
  }

  function labelForMode() {
    if (mode === 'signup') return 'Create account';
    if (mode === 'reset') return 'Send reset link';
    if (mode === 'reset-password') return 'Update password';
    return 'Log in';
  }

  function setMode(next) {
    mode = next;
    var signup = mode === 'signup';
    var reset = mode === 'reset';
    var resetPassword = mode === 'reset-password';
    document.querySelectorAll('[data-login-only]').forEach(function (el) { el.hidden = signup || reset || resetPassword; });
    document.querySelectorAll('[data-email-field]').forEach(function (el) { el.hidden = !(signup || reset); });
    document.querySelectorAll('[data-signup-only]').forEach(function (el) { el.hidden = !signup; });
    document.querySelectorAll('[data-social-auth]').forEach(function (el) { el.hidden = reset || resetPassword; });
    document.querySelector('[data-password-field]').hidden = reset || resetPassword;
    document.getElementById('new-password-field').hidden = !resetPassword;
    forgotButton.hidden = reset || resetPassword;
    authTitle.textContent = signup ? 'Create your account' : reset ? 'Reset password' : resetPassword ? 'Choose a new password' : 'Welcome back';
    authCopy.textContent = signup
      ? 'Use the same account across Drop on mobile and web.'
      : reset
        ? 'Enter your account email and we will send a reset link.'
        : resetPassword
          ? 'Set a new password for your Drop account.'
          : 'Log in to keep tracking your shows.';
    modeCopy.textContent = signup ? 'Already have an account?' : 'No account?';
    modeButton.textContent = signup ? 'Log in' : 'Create one';
    authSubmit.textContent = labelForMode();
    setMessage('');
  }

  function looksLikeEmail(value) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
  }

  function cleanUsername(value) {
    return String(value || '').trim().replace(/^@+/, '').toLowerCase();
  }

  function fmtDate(value) {
    if (!value) return 'Date TBD';
    try {
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
    } catch (e) {
      return 'Date TBD';
    }
  }

  function text(value, fallback) {
    return value == null || value === '' ? fallback : String(value);
  }

  async function signIn() {
    var login = document.getElementById('auth-login').value.trim();
    var password = document.getElementById('auth-password').value;
    if (!login || !password) throw new Error('Enter your email or username and password.');
    if (!looksLikeEmail(login)) {
      var username = cleanUsername(login);
      var res = await client.functions.invoke('login-with-username', { body: { username: username, password: password } });
      if (res.error || !res.data || !res.data.access_token || !res.data.refresh_token) {
        throw new Error('Invalid username or password.');
      }
      var sessionRes = await client.auth.setSession({
        access_token: res.data.access_token,
        refresh_token: res.data.refresh_token
      });
      if (sessionRes.error) throw sessionRes.error;
      return;
    }
    var out = await client.auth.signInWithPassword({ email: login, password: password });
    if (out.error) throw out.error;
  }

  async function signUp() {
    var email = document.getElementById('auth-email').value.trim();
    var username = cleanUsername(document.getElementById('auth-username').value);
    var password = document.getElementById('auth-password').value;
    if (!email || !password) throw new Error('Enter your email and password.');
    var options = { emailRedirectTo: AUTH_REDIRECT };
    if (username) options.data = { username: username };
    var out = await client.auth.signUp({ email: email, password: password, options: options });
    if (out.error) throw out.error;
    if (!out.data.session) {
      setMessage('Check your email to confirm your account.', 'ok');
      return;
    }
    await showDashboard();
  }

  async function sendReset() {
    var email = document.getElementById('auth-email').value.trim();
    if (!email) throw new Error('Enter your account email.');
    var out = await client.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_ORIGIN + '/login?mode=reset-password'
    });
    if (out.error) throw out.error;
    setMessage('Password reset link sent.', 'ok');
  }

  async function updatePassword() {
    var password = document.getElementById('auth-new-password').value;
    if (!password || password.length < 8) throw new Error('Use at least 8 characters.');
    var out = await client.auth.updateUser({ password: password });
    if (out.error) throw out.error;
    setMessage('Password updated.', 'ok');
    await showDashboard();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!client) {
      setMessage('Account login is unavailable. Refresh and try again.', 'error');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'signup') await signUp();
      else if (mode === 'reset') await sendReset();
      else if (mode === 'reset-password') await updatePassword();
      else await signIn();
      if (mode === 'login') await showDashboard();
    } catch (e) {
      setMessage(e && e.message ? e.message : 'Could not complete that request.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function socialSignIn(provider) {
    if (!client) return setMessage('Account login is unavailable. Refresh and try again.', 'error');
    var out = await client.auth.signInWithOAuth({
      provider: provider,
      options: { redirectTo: AUTH_REDIRECT }
    });
    if (out.error) setMessage(out.error.message, 'error');
  }

  function profileName(profile, user) {
    return profile && (profile.display_name || profile.username)
      ? (profile.display_name || '@' + profile.username)
      : user.email || 'Drop user';
  }

  function renderProfile(profile, user) {
    var el = document.getElementById('profile-card');
    el.textContent = '';
    var avatar = document.createElement('div');
    avatar.className = 'profile-avatar';
    if (profile && profile.profile_image && /^https?:\/\//i.test(profile.profile_image)) {
      var img = document.createElement('img');
      img.src = profile.profile_image;
      img.alt = '';
      avatar.appendChild(img);
    } else {
      avatar.textContent = profileName(profile, user).slice(0, 1).toUpperCase();
    }
    var body = document.createElement('div');
    var h = document.createElement('h3');
    h.textContent = profileName(profile, user);
    var p = document.createElement('p');
    p.textContent = [
      profile && profile.username ? '@' + profile.username : null,
      profile && profile.city ? profile.city + (profile.state ? ', ' + profile.state : '') : null,
      user.email
    ].filter(Boolean).join(' · ');
    body.appendChild(h);
    body.appendChild(p);
    el.appendChild(avatar);
    el.appendChild(body);
  }

  function item(title, meta, badge, href) {
    var row = document.createElement(href ? 'a' : 'div');
    row.className = 'account-item';
    if (href) row.href = href;
    var copy = document.createElement('div');
    var strong = document.createElement('strong');
    strong.textContent = title;
    var small = document.createElement('small');
    small.textContent = meta;
    copy.appendChild(strong);
    copy.appendChild(small);
    row.appendChild(copy);
    if (badge) {
      var pill = document.createElement('span');
      pill.className = 'account-badge';
      pill.textContent = badge;
      row.appendChild(pill);
    }
    return row;
  }

  function empty(textValue) {
    var el = document.createElement('p');
    el.className = 'account-empty';
    el.textContent = textValue;
    return el;
  }

  function renderList(id, nodes, emptyText) {
    var el = document.getElementById(id);
    el.textContent = '';
    if (!nodes.length) el.appendChild(empty(emptyText));
    nodes.forEach(function (node) { el.appendChild(node); });
  }

  async function loadCounts(userId) {
    var q = [
      client.from('attendance').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'going'),
      client.from('attendance').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'interested'),
      client.from('attendance').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'attended'),
      client.from('artist_follows').select('artist_id', { count: 'exact', head: true }).eq('user_id', userId)
    ];
    var r = await Promise.all(q);
    document.getElementById('stat-going').textContent = r[0].count || 0;
    document.getElementById('stat-interested').textContent = r[1].count || 0;
    document.getElementById('stat-attended').textContent = r[2].count || 0;
    document.getElementById('stat-artists').textContent = r[3].count || 0;
  }

  async function loadShows(userId) {
    var out = await client
      .from('attendance')
      .select('status, created_at, events(id,title,date,venue_name,city,state,ticket_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(24);
    var rows = out.data || [];
    renderList('shows-list', rows.map(function (row) {
      var ev = row.events || {};
      var href = ev.id ? 'https://trydropapp.com/event.html?id=' + encodeURIComponent(ev.id) : null;
      var meta = [fmtDate(ev.date), ev.venue_name, ev.city].filter(Boolean).join(' · ');
      return item(text(ev.title, 'Untitled show'), meta, row.status, href);
    }), 'No shows yet. Mark events Going or Interested in Drop and they will appear here.');
  }

  async function loadArtists(userId) {
    var out = await client
      .from('artist_follows')
      .select('created_at, artists(id,name,genres)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12);
    var rows = out.data || [];
    renderList('artists-list', rows.map(function (row) {
      var a = row.artists || {};
      var href = a.id ? 'https://trydropapp.com/artist.html?id=' + encodeURIComponent(a.id) : null;
      return item(text(a.name, 'Unknown artist'), (a.genres || []).slice(0, 2).join(' · ') || 'Followed artist', null, href);
    }), 'No followed artists yet.');
  }

  async function loadVenues(userId) {
    var out = await client
      .from('venue_follows')
      .select('venue_name, city, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(12);
    var rows = out.data || [];
    renderList('venues-list', rows.map(function (row) {
      var href = 'https://trydropapp.com/venue.html?name=' + encodeURIComponent(row.venue_name || '') + '&city=' + encodeURIComponent(row.city || '');
      return item(text(row.venue_name, 'Unknown venue'), text(row.city, 'Venue'), null, href);
    }), 'No followed venues yet.');
  }

  async function showDashboard() {
    var sessionOut = await client.auth.getSession();
    var session = sessionOut.data && sessionOut.data.session;
    if (!session) {
      authPanel.hidden = false;
      dashPanel.hidden = true;
      return;
    }
    var user = session.user;
    authPanel.hidden = true;
    dashPanel.hidden = false;
    var profileOut = await client
      .from('profiles')
      .select('id,email,username,display_name,profile_image,city,state,bio,onboarding_complete')
      .eq('id', user.id)
      .maybeSingle();
    var profile = profileOut.data || null;
    document.getElementById('dash-title').textContent = profileName(profile, user);
    renderProfile(profile, user);
    await Promise.all([loadCounts(user.id), loadShows(user.id), loadArtists(user.id), loadVenues(user.id)]);
  }

  modeButton.addEventListener('click', function () {
    setMode(mode === 'signup' ? 'login' : 'signup');
  });

  forgotButton.addEventListener('click', function () {
    setMode('reset');
    var login = document.getElementById('auth-login').value.trim();
    if (looksLikeEmail(login)) document.getElementById('auth-email').value = login;
  });

  authForm.addEventListener('submit', handleSubmit);

  document.querySelectorAll('[data-provider]').forEach(function (button) {
    button.addEventListener('click', function () { socialSignIn(button.getAttribute('data-provider')); });
  });

  document.getElementById('signout-button').addEventListener('click', async function () {
    if (client) await client.auth.signOut();
    authPanel.hidden = false;
    dashPanel.hidden = true;
    setMode('login');
  });

  setMode(mode);
  if (!client) setMessage('Account login is unavailable. Refresh and try again.', 'error');
  else if (mode !== 'reset-password') showDashboard();
})();
