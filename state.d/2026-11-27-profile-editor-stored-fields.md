# 2026-11-27 security audit round 4: profile editor no longer saves the account email as the public name

- Finding EP-1 (Low): in the web client the "Display name" field was bound to `prof.name`, which falls back to the username and then to the account email, and the bio field to `prof.bio`, which falls back to placeholder copy. A user with no display name and no username who opened Edit profile and pressed Save (for any change) stored their email address as their public display name. 22 of 114 profiles have neither field; 0 rows hold an email as the name today.
- Change: `app/app.js` adds `prof.editName` and `prof.editBio` (stored values only) and `app/index.html` binds the two form fields to them. Display elsewhere is unchanged.
- Tested: `node --test tests/deploy-contract.test.mjs` (new contract test), `node --check app/app.js`. Playwright not run locally; CI runs it.
- Next: after the auto-deploy, open Edit profile on an account with no display name: the field must be empty.

## Follow-up the same day (verify pass)

- `saveProfile` now refuses when the profile has not loaded (the form is blank then, and saving wiped the name, username, bio and city; a null username also frees the handle for someone else). It reloads the profile and says so.
- City and state are written only when the user changed the shared field. Before, a profile with a state but no city showed an empty field and saving cleared the state.
- Tested: `node --test tests/deploy-contract.test.mjs` (7 pass), `node --check app/app.js`. Playwright in CI.
