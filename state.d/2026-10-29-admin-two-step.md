# 2026-10-29 admin two-step sign-in (A115 step 1)

- Web Settings shows a "Two-step sign-in" card to admins only (`public_profile` is_admin for self). Set up enrolls a Supabase TOTP factor (QR + manual key), clearing any half-finished unverified factor first. A 6-digit code then verifies it through `mfa.challengeAndVerify`.
- No server change. The AAL2 requirement in `is_admin()` is a separate migration ask, made only after both admins have verified factors.
- Tested:
  - `tests/admin-mfa.spec.ts` (4 cases × desktop + mobile-safari), serial and repeat-each 3.
  - Related app specs pass with 1 retry. The remaining flakes are public-site smoke pages that also flake on main locally.
- Next: after deploy, both admins enroll at app.trydropapp.com → Settings. The coordinator verifies `auth.mfa_factors` (status verified) via read-only SQL, then the AAL2 migration ask.
