# Live Supabase facts for the web-app audit (read-only queries, 2026-10-19, project ebccwnkmsnhbljxxxdej)

## S1 profile privilege hardening — NOT yet applied live
`information_schema.column_privileges` for grantee `authenticated` on `public.profiles` still lists INSERT and UPDATE on
`is_admin`, `is_plus`, `is_plus_until` (plus every other column). The migration
`supabase/migrations/20261018080000_profile_privilege_hardening.sql` lives on the security lane's branch
`claude/fable-security-profile-grants-20261018` (drop-mobile-app), not on main. When it lands it will:
- add triggers `profiles_protect_admin` / `profiles_protect_creator_program` that force `is_admin=false,is_plus=false,is_plus_until=null` on insert and revert changes on update;
- `revoke insert, update on public.profiles from authenticated` and re-grant INSERT/UPDATE **column-by-column** for every column except those three.
Consequence for the SPA: its only profiles write is `update({display_name, username, bio, city, state})` (app.js:3487) and `complete_signup_profile` RPC (SECURITY DEFINER) handles creation — both stay valid under column grants. Reads unaffected (SELECT not revoked).

## Table privileges (anon / authenticated) on tables the SPA touches
- profiles: authenticated DELETE,INSERT,UPDATE (SELECT is column-level, not whole-table)
- attendance: authenticated DELETE,INSERT,SELECT,UPDATE
- logged_shows: anon AND authenticated DELETE,INSERT,SELECT,UPDATE  ← anon write grants exist; RLS `auth.uid()=user_id` blocks in practice
- my_set_times: authenticated DELETE,INSERT,SELECT,UPDATE
- artist_follows: authenticated DELETE,INSERT,SELECT,UPDATE
- venue_follows: anon AND authenticated DELETE,INSERT,SELECT,UPDATE  ← same note
- artist_claims: anon AND authenticated DELETE,INSERT,SELECT,UPDATE  ← same note
- artists: anon AND authenticated DELETE,INSERT,SELECT (no UPDATE at table level; "artists claimed owner update" policy exists → UPDATE must be column-level or absent — VERIFY: the SPA calls `.from('artists').update` at app.js:3265)
- events: anon AND authenticated DELETE,INSERT,SELECT,UPDATE
- friendships: authenticated DELETE,INSERT,SELECT
- analytics_events: anon AND authenticated DELETE,SELECT,UPDATE (no INSERT) — the security lane's "phase B rpc-only" migration targets this

## RLS policies (all listed tables)
Every table carries `signup_complete_{select,insert,update,delete}_guard` for role authenticated using `current_user_signup_complete()`; plus owner policies:
- profiles: read `can_view_profile(id)`; insert own; update own
- attendance: write own; read "by relationship or public history" (can_view_profile AND (own OR status='going' OR friendship …))
- artist_follows: write own; read `can_view_profile(user_id)`
- venue_follows / logged_shows / my_set_times: own (ALL)
- artist_claims: insert own; read own or admin; admin update (public role!)
- artists: read true (anon+authenticated); update when `claimed_by = auth.uid()`

## RPCs the SPA calls (all EXECUTE for authenticated only)
signup_compliance_status() [secdef], complete_signup_profile(p_birthdate,p_terms_version,p_privacy_version) [secdef],
record_signup_referral(p_referrer,p_kind,p_target,p_source) [NOT secdef], record_creator_referral(p_code) [secdef],
review_artist_claim(claim_id,new_status) [secdef].

## SPA write inventory (app.js line → call)
3487 profiles.update · 3282/3281 venue_follows insert/delete · 3265 artists.update · 3243 artist_claims.insert ·
3214/3213 artist_follows insert/delete · 1529 logged_shows.insert · 1506/1129/1128 attendance upsert/delete ·
1370/1369 my_set_times upsert/delete · 1241 venue_follows.insert · rpc: 1756/1707/1611/1411/1390 signup_compliance_status,
1693 complete_signup_profile, 1413 record_signup_referral, 1392 record_creator_referral.
