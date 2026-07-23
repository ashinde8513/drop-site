import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { AppleLogo } from '@phosphor-icons/react/AppleLogo';
import { Bell } from '@phosphor-icons/react/Bell';
import { CalendarDots } from '@phosphor-icons/react/CalendarDots';
import { CaretDown } from '@phosphor-icons/react/CaretDown';
import { Check } from '@phosphor-icons/react/Check';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { CircleNotch } from '@phosphor-icons/react/CircleNotch';
import { Cloud } from '@phosphor-icons/react/Cloud';
import { Compass } from '@phosphor-icons/react/Compass';
import { Eye } from '@phosphor-icons/react/Eye';
import { EyeSlash } from '@phosphor-icons/react/EyeSlash';
import { FacebookLogo } from '@phosphor-icons/react/FacebookLogo';
import { FlagBanner } from '@phosphor-icons/react/FlagBanner';
import { GearSix } from '@phosphor-icons/react/GearSix';
import { GoogleLogo } from '@phosphor-icons/react/GoogleLogo';
import { LockKey } from '@phosphor-icons/react/LockKey';
import { MagnifyingGlass } from '@phosphor-icons/react/MagnifyingGlass';
import { MapPin } from '@phosphor-icons/react/MapPin';
import { SignOut } from '@phosphor-icons/react/SignOut';
import { Ticket } from '@phosphor-icons/react/Ticket';
import { Trash } from '@phosphor-icons/react/Trash';
import { UserCircle } from '@phosphor-icons/react/UserCircle';
import { UsersThree } from '@phosphor-icons/react/UsersThree';
import { WarningCircle } from '@phosphor-icons/react/WarningCircle';
import { X } from '@phosphor-icons/react/X';
import {
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import {
  defaultNotificationPrefs,
  getMusicConnections,
  getNotificationPrefs,
  saveNotificationPrefs,
  uploadAvatar,
  type MusicConnection,
  type NotificationPrefs,
  type Profile,
} from './lib/account';

type Notice = { tone: 'success' | 'error'; text: string } | null;

const navItems = [
  { to: '/discover', label: 'Discover', icon: Compass },
  { to: '/map', label: 'Map', icon: MapPin },
  { to: '/shows', label: 'My Shows', icon: Ticket },
  { to: '/friends', label: 'Friends', icon: UsersThree },
  { to: '/plans', label: 'Plans', icon: CalendarDots },
  { to: '/festivals', label: 'Festivals & Live', icon: FlagBanner },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'Profile', icon: UserCircle },
  { to: '/settings', label: 'Settings', icon: GearSix },
] as const;

const mobileNavItems = navItems.filter(({ to }) =>
  ['/discover', '/map', '/shows', '/friends', '/profile'].includes(to),
);

function errorMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Something went wrong. Please try again.';
}

function resultError(result: unknown) {
  if (result && typeof result === 'object' && 'error' in result && typeof result.error === 'string') return result.error;
  return '';
}

function field(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className="brand" href="https://trydropapp.com/" aria-label="Drop home">
      <img className="brand__mark" src="/favicon.svg" alt="" />
      {!compact && <span>DROP</span>}
    </a>
  );
}

function PublicHeader({ authenticated = false }: { authenticated?: boolean }) {
  const auth = useAuth();
  const user = auth.user;
  const profile = auth.profile;

  return (
    <header className="public-header">
      <Brand />
      <button className="location-pill" type="button" aria-label="Current location: Denver, Colorado">
        <span aria-hidden="true" /> Denver, CO <CaretDown size={13} weight="bold" />
      </button>
      <a className="header-search" href="https://trydropapp.com/events" aria-label="Search artists, venues, and shows">
        <MagnifyingGlass size={15} />
        <span>Search artists, venues, shows</span>
      </a>
      <nav className="public-links" aria-label="Website">
        <a href="https://trydropapp.com/events">Events</a>
        <a href="https://trydropapp.com/venues">Venues</a>
        <a href="https://trydropapp.com/artists">Artists</a>
      </nav>
      <div className="header-actions">
        {authenticated ? (
          <Link className="header-account" to="/profile" aria-label="Open profile">
            <Avatar profile={profile} name={displayName(profile, user?.email)} size="small" />
          </Link>
        ) : (
          <>
            <Link className="header-login" to="/login">Log in</Link>
            <Link className="button button--primary button--small" to="/signup">Get started</Link>
          </>
        )}
      </div>
    </header>
  );
}

function Avatar({ profile, name, size = 'large' }: { profile?: Profile | null; name: string; size?: 'small' | 'large' }) {
  const src = field(profile?.profile_image);
  return src ? (
    <img className={`avatar avatar--${size}`} src={src} alt={`${name}'s profile`} />
  ) : (
    <span className={`avatar avatar--${size} avatar--fallback`} aria-label={`${name}'s profile`}><UserCircle aria-hidden="true" /></span>
  );
}

function displayName(profile?: Profile | null, email?: string | null) {
  return field(profile?.display_name) || field(profile?.username) || email?.split('@')[0] || 'Drop user';
}

function StatusNotice({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p className={`status status--${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      {notice.tone === 'success' ? <CheckCircle size={18} weight="fill" /> : <WarningCircle size={18} weight="fill" />}
      {notice.text}
    </p>
  );
}

function PasswordField({ id, label, value, onChange, autoComplete }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <span className="password-control">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          required
          minLength={8}
        />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}

function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <PublicHeader />
      <main className="auth-main">
        <section className="auth-story" aria-label="About Drop">
          <span className="auth-story__brand">Drop</span>
          <div>
            <h1>Every rave you’d hate to miss.</h1>
            <p>See which friends are going, plan the night, and never rave alone.</p>
          </div>
        </section>
        <section className="auth-panel">{children}</section>
      </main>
    </div>
  );
}

function AuthTabs({ active }: { active: 'login' | 'signup' }) {
  return (
    <div className="auth-tabs" role="navigation" aria-label="Account access">
      <Link className={active === 'login' ? 'is-active' : ''} to="/login" aria-current={active === 'login' ? 'page' : undefined}>Log in</Link>
      <Link className={active === 'signup' ? 'is-active' : ''} to="/signup" aria-current={active === 'signup' ? 'page' : undefined}>Create account</Link>
    </div>
  );
}

function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth.signIn) return setNotice({ tone: 'error', text: 'Sign-in is temporarily unavailable.' });
    setPending(true);
    setNotice(null);
    try {
      const result = await auth.signIn(identifier.trim(), password);
      const error = resultError(result);
      if (error) throw new Error(error);
      navigate('/discover', { replace: true });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <AuthTabs active="login" />
      <div className="auth-heading">
        <h1>Welcome back</h1>
        <p>Use the same Drop account you use in the app.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <label className="field" htmlFor="login-identifier">
          <span>Email or username</span>
          <input id="login-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="maya@example.com or @mayachen" required />
        </label>
        <PasswordField id="login-password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        <Link className="form-link form-link--end" to="/forgot-password">Forgot password?</Link>
        <StatusNotice notice={notice} />
        <button className="button button--primary button--block" type="submit" disabled={pending}>
          {pending ? <><CircleNotch className="spin" size={18} /> Logging in…</> : 'Log in'}
        </button>
      </form>
      <OAuthButtons />
      <p className="auth-switch">New to Drop? <Link to="/signup">Create an account</Link></p>
    </AuthLayout>
  );
}

function OAuthButtons() {
  const auth = useAuth();
  const [pending, setPending] = useState<'google' | 'apple' | 'facebook' | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function start(provider: 'google' | 'apple' | 'facebook') {
    if (!auth.signInWithOAuth) return setNotice({ tone: 'error', text: 'Social sign-in is temporarily unavailable.' });
    setPending(provider);
    setNotice(null);
    try {
      const result = await auth.signInWithOAuth(provider);
      const error = resultError(result);
      if (error) throw new Error(error);
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
      setPending(null);
    }
  }

  return (
    <div className="oauth">
      <div className="oauth__divider"><span>or continue with</span></div>
      <div className="oauth__buttons">
        <button className="button button--secondary" type="button" onClick={() => start('google')} disabled={pending !== null}>
          <GoogleLogo size={19} weight="bold" /> {pending === 'google' ? 'Connecting…' : 'Google'}
        </button>
        <button className="button button--secondary" type="button" onClick={() => start('apple')} disabled={pending !== null}>
          <AppleLogo size={20} weight="fill" /> {pending === 'apple' ? 'Connecting…' : 'Apple'}
        </button>
        <button className="button button--secondary" type="button" onClick={() => start('facebook')} disabled={pending !== null}>
          <FacebookLogo size={20} weight="fill" /> {pending === 'facebook' ? 'Connecting…' : 'Facebook'}
        </button>
      </div>
      <StatusNotice notice={notice} />
    </div>
  );
}

function SignupPage() {
  const auth = useAuth();
  const [values, setValues] = useState({ username: '', email: '', password: '', birthdate: '', legal: false });
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  function update(key: keyof typeof values, value: string | boolean) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!values.birthdate || !values.legal) return setNotice({ tone: 'error', text: 'Add your birthdate and accept the account terms to continue.' });
    if (!auth.signUp) return setNotice({ tone: 'error', text: 'Account creation is temporarily unavailable.' });
    setPending(true);
    setNotice(null);
    try {
      const result = await auth.signUp({
        email: values.email.trim(),
        password: values.password,
        username: values.username.replace(/^@/, '').trim(),
        birthdate: values.birthdate,
        legalAccepted: values.legal,
      });
      const error = resultError(result);
      if (error) throw new Error(error);
      setNotice({ tone: 'success', text: 'Check your email to verify your account.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <AuthTabs active="signup" />
      <div className="auth-heading"><h1>Create your account</h1><p>Your account and show history are shared with the Drop app.</p></div>
      <form className="auth-form auth-form--signup" onSubmit={submit}>
        <label className="field" htmlFor="signup-username"><span>Username</span><input id="signup-username" value={values.username} onChange={(event) => update('username', event.target.value)} autoComplete="username" placeholder="mayachen" required /></label>
        <label className="field" htmlFor="signup-email"><span>Email</span><input id="signup-email" type="email" value={values.email} onChange={(event) => update('email', event.target.value)} autoComplete="email" required /></label>
        <PasswordField id="signup-password" label="Password" value={values.password} onChange={(value) => update('password', value)} autoComplete="new-password" />
        <label className="field" htmlFor="signup-birthdate"><span>Date of birth · You must be 16 or older</span><input id="signup-birthdate" type="date" value={values.birthdate} onChange={(event) => update('birthdate', event.target.value)} autoComplete="bday" required /></label>
        <label className="check-row"><input type="checkbox" checked={values.legal} onChange={(event) => update('legal', event.target.checked)} /><span>I agree to the <a href="https://trydropapp.com/terms" target="_blank" rel="noreferrer">Terms</a> and <a href="https://trydropapp.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span></label>
        <StatusNotice notice={notice} />
        <button className="button button--primary button--block" type="submit" disabled={pending}>{pending ? <><CircleNotch className="spin" size={18} /> Creating account…</> : 'Create account'}</button>
      </form>
      <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
    </AuthLayout>
  );
}

function RecoveryPage({ mode }: { mode: 'forgot' | 'reset' | 'verify' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const content = {
    forgot: { title: 'Reset your password', body: 'We’ll send a secure reset link to your Drop email.', action: 'Send reset link' },
    reset: { title: 'Choose a new password', body: 'Use at least eight characters.', action: 'Update password' },
    verify: { title: 'Verify your email', body: 'Open the link in your email to finish setting up Drop.', action: 'Resend verification email' },
  }[mode];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    try {
      if (mode === 'forgot') {
        if (!auth.requestPasswordReset) throw new Error('Password recovery is temporarily unavailable.');
        const result = await auth.requestPasswordReset(email.trim());
        const error = resultError(result);
        if (error) throw new Error(error);
        setNotice({ tone: 'success', text: 'Reset link sent. Check your email.' });
      } else if (mode === 'reset') {
        if (!auth.updatePassword) throw new Error('Password update is temporarily unavailable.');
        const result = await auth.updatePassword(password);
        const error = resultError(result);
        if (error) throw new Error(error);
        navigate(auth.signupCompliance === 'complete' ? '/discover' : '/complete-profile', { replace: true });
      } else {
        if (!auth.resendVerification) throw new Error('Email verification is temporarily unavailable.');
        const result = await auth.resendVerification(email.trim());
        const error = resultError(result);
        if (error) throw new Error(error);
        setNotice({ tone: 'success', text: 'Verification email sent.' });
      }
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-icon" aria-hidden="true">{mode === 'verify' ? <CheckCircle size={28} /> : <LockKey size={28} />}</div>
      <div className="auth-heading auth-heading--center"><h1>{content.title}</h1><p>{content.body}</p></div>
      <form className="auth-form" onSubmit={submit}>
        {(mode === 'forgot' || mode === 'verify') && <label className="field" htmlFor="recovery-email"><span>Email</span><input id="recovery-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>}
        {mode === 'reset' && <PasswordField id="new-password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />}
        <StatusNotice notice={notice} />
        <button className="button button--primary button--block" type="submit" disabled={pending}>{pending ? <><CircleNotch className="spin" size={18} /> Working…</> : content.action}</button>
      </form>
      <button className="button button--ghost button--block" type="button" onClick={() => navigate('/login')}>Back to login</button>
    </AuthLayout>
  );
}

function LoadingScreen() {
  return <main className="loading-screen"><Brand /><CircleNotch className="spin" size={28} aria-label="Loading Drop" /></main>;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const user = auth.user;
  const loading = auth.loading || (Boolean(user) && auth.signupCompliance === 'unknown');
  if (loading) return <LoadingScreen />;
  if (user && auth.signupCompliance !== 'complete') return <Navigate to="/complete-profile" replace />;
  return user ? children : <Navigate to="/login" replace />;
}

function pageTitle(pathname: string) {
  return navItems.find(({ to }) => pathname.startsWith(to))?.label ?? 'Discover';
}

function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const profile = auth.profile;
  const user = auth.user;
  const name = displayName(profile, user?.email);
  const title = pageTitle(location.pathname);

  return (
    <div className="app-shell">
      <PublicHeader authenticated />
      <div className="mobile-app-header">
        <Brand compact />
        <strong>{title}</strong>
        <div className="mobile-app-header__actions"><button type="button" aria-label="Search"><MagnifyingGlass size={20} /></button><Link to="/profile" aria-label="Open profile"><Avatar profile={profile} name={name} size="small" /></Link></div>
      </div>
      <aside className="side-nav">
        <div className="side-nav__title">Account</div>
        <nav aria-label="Primary">
          {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon size={19} /><span>{label}</span></NavLink>)}
        </nav>
      </aside>
      <section className="app-stage">
        <header className="stage-header">
          <h1>{title}</h1>
          <div className="stage-header__actions"><span><MapPin size={17} /> Denver, CO</span><Link to="/notifications" aria-label="Notifications"><Bell size={19} /></Link><Link to="/profile" aria-label="Profile"><Avatar profile={profile} name={name} size="small" /></Link></div>
        </header>
        <main className="stage-content">
          <Routes>
            <Route index element={<Navigate to="/discover" replace />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />
            {navItems.filter(({ to }) => !['/profile', '/settings'].includes(to)).map(({ to, label, icon }) => (
              <Route key={to} path={to.slice(1)} element={<NextSlice title={label} icon={icon} name={name} />} />
            ))}
            <Route path="*" element={<Navigate to="/discover" replace />} />
          </Routes>
        </main>
      </section>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {mobileNavItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon size={21} /><span>{label}</span></NavLink>)}
      </nav>
    </div>
  );
}

function NextSlice({ title, icon: Icon, name }: { title: string; icon: typeof Compass; name: string }) {
  const greeting = title === 'Discover' ? `Good evening, ${name.split(' ')[0]}.` : title;
  return (
    <section className="placeholder-page" aria-labelledby="placeholder-title">
      <p className="page-intro" id="placeholder-title">{greeting}</p>
      <div className="honest-state">
        <span className="honest-state__icon"><Icon size={28} /></span>
        <h2>{title} is next</h2>
        <p>This feature arrives in the next approved parity slice. No demo data is shown here.</p>
      </div>
    </section>
  );
}

function ProfilePage() {
  const auth = useAuth();
  const profile = auth.profile;
  const user = auth.user;
  const [values, setValues] = useState(() => ({
    display_name: field(profile?.display_name), username: field(profile?.username), bio: field(profile?.bio), city: field(profile?.city), state: field(profile?.state),
  }));
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const name = displayName(profile, user?.email);

  useEffect(() => {
    if (!profile) return;
    setValues({
      display_name: field(profile.display_name),
      username: field(profile.username),
      bio: field(profile.bio),
      city: field(profile.city),
      state: field(profile.state),
    });
  }, [profile?.id]);

  if (!profile) {
    return <p className="page-intro" role="status">{auth.profileError ?? 'Loading profile…'}</p>;
  }

  function update(key: keyof typeof values, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!auth.updateProfile) return setNotice({ tone: 'error', text: 'Profile editing is temporarily unavailable.' });
    setPending(true);
    setNotice(null);
    try {
      await auth.updateProfile({ ...values, username: values.username.replace(/^@/, '').trim(), display_name: values.display_name.trim(), bio: values.bio.trim(), city: values.city.trim(), state: values.state.trim() });
      setNotice({ tone: 'success', text: 'Profile saved.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  async function changePhoto(file?: File) {
    if (!file) return;
    setPending(true);
    setNotice(null);
    try {
      await uploadAvatar(file);
      await auth.refreshProfile();
      setNotice({ tone: 'success', text: 'Profile photo updated.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="settings-width">
      <div className="profile-hero">
        <Avatar profile={profile} name={name} />
        <div><h2>{name}</h2><p>{profile?.username ? `@${profile.username}` : user?.email}</p></div>
        <label className="button button--secondary button--small file-button">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void changePhoto(event.target.files?.[0])} disabled={pending} /></label>
      </div>
      <form className="settings-card" onSubmit={save}>
        <h2>Profile</h2>
        <label className="field" htmlFor="profile-name"><span>Display name</span><input id="profile-name" value={values.display_name} onChange={(event) => update('display_name', event.target.value)} autoComplete="name" maxLength={80} /></label>
        <label className="field" htmlFor="profile-username"><span>Username</span><input id="profile-username" value={values.username} onChange={(event) => update('username', event.target.value)} autoComplete="username" maxLength={30} /></label>
        <label className="field" htmlFor="profile-bio"><span>Bio <em>· 200 max</em></span><textarea id="profile-bio" value={values.bio} onChange={(event) => update('bio', event.target.value)} maxLength={200} rows={4} /></label>
        <div className="field-row">
          <label className="field" htmlFor="profile-city"><span>City</span><input id="profile-city" value={values.city} onChange={(event) => update('city', event.target.value)} autoComplete="address-level2" /></label>
          <label className="field field--state" htmlFor="profile-state"><span>State</span><input id="profile-state" value={values.state} onChange={(event) => update('state', event.target.value)} autoComplete="address-level1" maxLength={30} /></label>
        </div>
        <StatusNotice notice={notice} />
        <div className="form-actions"><button className="button button--primary" type="submit" disabled={pending}>{pending ? <><CircleNotch className="spin" size={18} /> Saving…</> : 'Save changes'}</button></div>
      </form>
    </section>
  );
}

function SettingsPage() {
  const auth = useAuth();
  const profile = auth.profile;
  const user = auth.user;
  const [notice, setNotice] = useState<Notice>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const privacyRows = [
    { key: 'recap_includable', title: 'Friends’ recaps', body: 'Allow friends to include your shared show activity in their recaps.' },
    { key: 'show_history_public', title: 'Public show history', body: 'Show your attended events on your Drop profile.' },
    { key: 'show_age', title: 'Show age', body: 'Display your age on your Drop profile.' },
  ] as const;

  async function toggle(key: (typeof privacyRows)[number]['key'], value: boolean) {
    if (!auth.updateProfile) return setNotice({ tone: 'error', text: 'Privacy settings are temporarily unavailable.' });
    setNotice(null);
    try {
      await auth.updateProfile({ [key]: value });
      setNotice({ tone: 'success', text: 'Privacy preference saved.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    }
  }

  async function logout() {
    if (!auth.signOut) return;
    setLoggingOut(true);
    try {
      const result = await auth.signOut();
      const error = resultError(result);
      if (error) throw new Error(error);
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
      setLoggingOut(false);
    }
  }

  return (
    <section className="settings-width settings-page">
      <header className="page-heading"><h2>Settings</h2><p>Changes apply to the same Drop account on web and mobile.</p></header>
      <StatusNotice notice={notice} />
      <NotificationPreferences />
      {profile && <section className="settings-section" aria-labelledby="privacy-heading"><div className="section-heading"><h3 id="privacy-heading">Privacy</h3><p>Choose what other people can see.</p></div><div className="settings-card settings-list">{privacyRows.map(({ key, title, body }) => <ToggleRow key={key} title={title} body={body} checked={profile[key]} onChange={(checked) => toggle(key, checked)} />)}</div></section>}
      <MusicConnections />
      <section className="settings-section" aria-labelledby="account-heading"><div className="section-heading"><h3 id="account-heading">Account</h3><p>Manage this shared Drop account.</p></div><div className="settings-card settings-list"><div className="setting-row setting-row--static"><div><h4>Email</h4><p>{user?.email ?? 'No email available'}</p></div></div><button className="setting-row setting-row--button" type="button" onClick={logout} disabled={loggingOut}><span className="setting-row__icon"><SignOut size={20} /></span><span><strong>{loggingOut ? 'Logging out…' : 'Log out'}</strong><small>Log out of Drop on all devices.</small></span></button><button className="setting-row setting-row--button setting-row--danger" type="button" onClick={() => setDeleteOpen(true)}><span className="setting-row__icon"><Trash size={20} /></span><span><strong>Delete account</strong><small>Permanently delete your Drop account and associated data.</small></span></button></div></section>
      {deleteOpen && <DeleteAccountDialog onClose={() => setDeleteOpen(false)} />}
    </section>
  );
}

function ToggleRow({ title, body, checked, onChange }: { title: string; body: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="setting-row toggle-row"><span><strong>{title}</strong><small>{body}</small></span><input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="switch" aria-hidden="true"><span /></span></label>;
}

const notificationRows: ReadonlyArray<{ key: keyof NotificationPrefs; title: string; body: string }> = [
  { key: 'artist_announcements', title: 'Artist announcements', body: 'New shows from artists you follow' },
  { key: 'friend_activity', title: 'Friend activity', body: 'When friends mark Going to a show' },
  { key: 'show_reminders', title: 'Show reminders', body: 'Day-before reminders for upcoming shows' },
  { key: 'sale_alerts', title: 'Sale alerts', body: 'Presale and on-sale notifications' },
  { key: 'comment_alerts', title: 'Event comments', body: "When someone comments on a show you're going to" },
  { key: 'plan_messages', title: 'Plan chat messages', body: 'New messages in your group plan chats' },
  { key: 'recap_alerts', title: 'Recap reminders', body: 'A morning nudge to share your recap after a show' },
];

function NotificationPreferences() {
  const [prefs, setPrefs] = useState(defaultNotificationPrefs);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void getNotificationPrefs()
      .then((next) => { if (active) setPrefs(next); })
      .catch(() => { if (active) setError('Notification preferences are temporarily unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function toggle(key: keyof NotificationPrefs, value: boolean) {
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setError('');
    try {
      await saveNotificationPrefs(next);
    } catch {
      setPrefs(previous);
      setError('Could not save that notification preference.');
    }
  }

  return (
    <section className="settings-section" aria-labelledby="notifications-heading">
      <div className="section-heading"><h3 id="notifications-heading">Notifications</h3><p>These preferences apply to your shared Drop account and mobile notifications.</p></div>
      {error && <p className="status status--error" role="alert"><WarningCircle size={18} weight="fill" />{error}</p>}
      <div className="settings-card settings-list" aria-busy={loading}>
        {notificationRows.map(({ key, title, body }) => <ToggleRow key={key} title={title} body={body} checked={prefs[key]} onChange={(checked) => void toggle(key, checked)} />)}
      </div>
    </section>
  );
}

function MusicConnections() {
  const [connections, setConnections] = useState<MusicConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    void getMusicConnections()
      .then((rows) => { if (active) setConnections(rows); })
      .catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const providers = [
    { key: 'apple_music', label: 'Apple Music', icon: AppleLogo },
    { key: 'soundcloud', label: 'SoundCloud', icon: Cloud },
  ] as const;
  return (
    <section className="settings-section" aria-labelledby="music-heading">
      <div className="section-heading"><h3 id="music-heading">Music connections</h3><p>Connection status is shared with the Drop mobile app.</p></div>
      <div className="settings-card settings-list">
        {providers.map(({ key, label, icon: Icon }) => {
          const connection = connections.find(({ provider }) => provider?.toLowerCase() === key || provider?.toLowerCase() === key.replace('_', ''));
          const connected = connection?.status === 'connected';
          const detail = loading
            ? 'Checking connection…'
            : loadError
              ? 'Connection status is temporarily unavailable.'
              : connected
                ? connection?.last_synced_at
                  ? `Connected · Last synced ${formatDate(connection.last_synced_at)}`
                  : 'Connected'
                : 'Not connected · Connect in the Drop mobile app';
          return <div className="setting-row music-row" key={key}><span className="setting-row__icon"><Icon size={21} weight={key === 'apple_music' ? 'fill' : 'regular'} /></span><span><strong>{label}</strong><small>{detail}</small></span><span className={`connection-badge ${connected ? 'is-connected' : ''}`}>{loading ? 'Checking' : connected ? <><Check size={13} weight="bold" /> Connected</> : 'Not connected'}</span></div>;
        })}
      </div>
    </section>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'recently' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState('');
  const [state, setState] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const confirmed = confirmation.trim().toUpperCase() === 'DELETE';

  async function removeAccount() {
    if (!confirmed || !auth.deleteAccount) return;
    setState('pending');
    setMessage('');
    try {
      const result = await auth.deleteAccount();
      const error = resultError(result);
      if (error) throw new Error(error);
      setState('success');
    } catch (error) {
      setState('error');
      setMessage(errorMessage(error));
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && state !== 'pending') onClose(); }}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
        {state === 'success' ? <div className="dialog-success"><span><CheckCircle size={30} weight="fill" /></span><h2 id="delete-title">Account deleted</h2><p id="delete-description">Your Drop account deletion completed successfully.</p><button className="button button--primary button--block" type="button" onClick={() => navigate('/login', { replace: true })}>Return to login</button></div> : <><button className="dialog__close" type="button" onClick={onClose} disabled={state === 'pending'} aria-label="Close delete account dialog"><X size={20} /></button><span className="dialog__danger"><Trash size={24} /></span><h2 id="delete-title">Delete account?</h2><p id="delete-description">This permanently removes your profile, RSVPs, saved shows, crews, plans, and Drop history. This cannot be undone.</p><label className="field" htmlFor="delete-confirmation"><span>Type DELETE to confirm</span><input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" placeholder="DELETE" disabled={state === 'pending'} /></label>{state === 'error' && <p className="status status--error" role="alert"><WarningCircle size={18} weight="fill" />{message}</p>}<div className="dialog__actions"><button className="button button--secondary" type="button" onClick={onClose} disabled={state === 'pending'}>Cancel</button><button className="button button--danger" type="button" onClick={removeAccount} disabled={!confirmed || state === 'pending'}>{state === 'pending' ? <><CircleNotch className="spin" size={18} /> Deleting…</> : 'Permanently delete account'}</button></div></>}
      </div>
    </div>
  );
}

function CompleteProfilePage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [birthdate, setBirthdate] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (auth.loading || (auth.user && auth.signupCompliance === 'unknown')) return <LoadingScreen />;
  if (!auth.user) return <Navigate to="/login" replace />;
  if (auth.signupCompliance === 'complete') return <Navigate to="/discover" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!legalAccepted) return setNotice({ tone: 'error', text: 'Accept the Terms and Privacy Policy to continue.' });
    setPending(true);
    setNotice(null);
    const result = await auth.completeSignupCompliance(birthdate);
    setPending(false);
    if (result.error) return setNotice({ tone: 'error', text: result.error });
    navigate('/discover', { replace: true });
  }

  return (
    <AuthLayout>
      <div className="auth-heading"><h1>Finish account setup</h1><p>Drop needs your birthdate and current legal consent before account features unlock.</p></div>
      <form className="auth-form" onSubmit={submit}>
        <label className="field" htmlFor="compliance-birthdate"><span>Date of birth · You must be 16 or older</span><input id="compliance-birthdate" type="date" value={birthdate} onChange={(event) => setBirthdate(event.target.value)} autoComplete="bday" required /></label>
        <label className="check-row"><input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} /><span>I agree to the <a href="https://trydropapp.com/terms" target="_blank" rel="noreferrer">Terms</a> and <a href="https://trydropapp.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</span></label>
        <StatusNotice notice={notice} />
        <button className="button button--primary button--block" type="submit" disabled={pending}>{pending ? <><CircleNotch className="spin" size={18} /> Saving…</> : 'Finish setup'}</button>
      </form>
      <button className="button button--ghost button--block" type="button" onClick={() => void auth.signOut()}>Log out</button>
      <button className="button button--ghost button--block" type="button" onClick={() => setDeleteOpen(true)}>Delete account</button>
      {deleteOpen && <DeleteAccountDialog onClose={() => setDeleteOpen(false)} />}
    </AuthLayout>
  );
}

function RootRoutes() {
  const auth = useAuth();
  const user = auth.user;
  const signedInDestination = auth.signupCompliance === 'complete' ? '/discover' : '/complete-profile';
  return (
    <Routes>
      <Route path="login" element={user ? <Navigate to={signedInDestination} replace /> : <LoginPage />} />
      <Route path="signup" element={user ? <Navigate to={signedInDestination} replace /> : <SignupPage />} />
      <Route path="complete-profile" element={<CompleteProfilePage />} />
      <Route path="forgot-password" element={<RecoveryPage mode="forgot" />} />
      <Route path="forgot" element={<RecoveryPage mode="forgot" />} />
      <Route path="reset-password" element={auth.isPasswordRecovery ? <RecoveryPage mode="reset" /> : <Navigate to="/forgot-password" replace />} />
      <Route path="reset" element={auth.isPasswordRecovery ? <RecoveryPage mode="reset" /> : <Navigate to="/forgot-password" replace />} />
      <Route path="verify-email" element={<RecoveryPage mode="verify" />} />
      <Route path="verify" element={<RecoveryPage mode="verify" />} />
      <Route path="/*" element={<RequireAuth><AppShell /></RequireAuth>} />
    </Routes>
  );
}

export function App() {
  return <AuthProvider><RootRoutes /></AuthProvider>;
}
