### 2026-11-27 — Admin sign-in asks for your authenticator code

- **Changed:** `app/app.js`, `app/index.html`. After sign-in, an account that has two-step sign-in turned on is shown "Enter your sign-in code" and enters the 6-digit code from its authenticator app before the app continues. Once per session. "Sign out" leaves instead. Accounts without two-step sign-in see nothing new.
- **Copy:** the Settings line for two-step sign-in now says the code is asked on this website.
- **Tests:** `tests/admin-mfa.spec.ts` (3 new cases: asked after sign-in and accepted; wrong code keeps the prompt and sign out leaves; a session that already passed is not asked). `tests/helpers/fakeSession.ts` gained the level lookup. Local run of that spec: 14 passed (desktop and mobile).
- **Not verified:** with a real authenticator on the live site.
- **Next step:** sign in on trydropapp.com/app with the admin account and enter a real code.
