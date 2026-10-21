-- Signed-in live-check fixture seed (APPROVALS W28, approved by Arya 2026-10-20).
-- Touches ONLY the profile with username 'drop_web_fixture' (an internal, phone-verified
-- test account Arya creates). Idempotent: fixed ids + on conflict do nothing. Aborts if the
-- fixture is missing, is an admin, or is not classified internal.
-- Block target: internal account 'ravewithmaya' (never a real user).
do $$
declare fx uuid; tgt uuid;
begin
  select id into fx from public.profiles where username = 'drop_web_fixture' and not is_admin;
  select id into tgt from public.profiles where username = 'ravewithmaya';
  if fx is null or tgt is null then raise exception 'fixture or block target missing'; end if;
  if not exists (select 1 from private.internal_accounts where user_id = fx) then
    raise exception 'fixture is not classified internal';
  end if;

  insert into public.alerts (id, user_id, kind, title, body, read, created_at) values
    ('f1c7a001-0000-4000-8000-00000000a001', fx, 'reminder', 'Fixture alert A', 'Live check unread alert', false, now()),
    ('f1c7a001-0000-4000-8000-00000000a002', fx, 'reminder', 'Fixture alert B', 'Live check read alert', true, now() - interval '1 day')
  on conflict (id) do update set read = excluded.read;  -- restores A to unread

  insert into public.logged_shows (id, user_id, artist_name, venue_name, city, state, show_date) values
    ('f1c7a001-0000-4000-8000-00000000b024', fx, 'Fixture Act 2024', 'Fixture Hall', 'Denver', 'CO', '2024-05-04'),
    ('f1c7a001-0000-4000-8000-00000000b025', fx, 'Fixture Act 2025', 'Fixture Hall', 'Denver', 'CO', '2025-06-07')
  on conflict (id) do nothing;

  -- Past published event (Daði Freyr, 2026-10-07) marked attended, then a private 4★ rating.
  insert into public.attendance (user_id, event_id, status)
    values (fx, 'e7a21cd6-08f2-4547-8ba2-7dc57b3da462', 'attended')
  on conflict (user_id, event_id) do update set status = 'attended';
  insert into public.show_ratings (user_id, event_id, rating, is_public, is_anonymous)
    values (fx, 'e7a21cd6-08f2-4547-8ba2-7dc57b3da462', 8, false, false)
  on conflict (user_id, event_id) do update set rating = 8;

  insert into public.user_blocks (blocker_id, blocked_id) values (fx, tgt)
  on conflict (blocker_id, blocked_id) do nothing;
end $$;

-- Rollback (run by hand):
-- with fx as (select id from public.profiles where username = 'drop_web_fixture')
--   delete from public.alerts where user_id = (select id from fx) and id::text like 'f1c7a001-%';
-- (repeat for logged_shows by id, show_ratings/attendance by (user_id, event_id), user_blocks by blocker_id)
