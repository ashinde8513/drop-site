# Spec 03: Social surfaces (friends, public profile, plan detail and chat, block and report)

Status: **built 2026-10-23** in `app/` (tests `tests/app-social.spec.ts`) from the approved canvas boards "Spec 03 · Social surfaces" and Arya's A53 decisions (on a plan, Send is the only primary and RSVP is a segmented control; with several requests only the first Accept is primary). Block/report wording and report reasons are drafts pending the coordinator's safety review. Live RLS checked read-only 2026-10-23: `friendships` accept works through a `status` column grant plus policy; `user_blocks` has no UPDATE policy, so block is a plain insert; `content_reports.content_type` is one of comment, chat_message, profile, event; other users' friend counts and non-friends' attended rows are not readable, so the profile shows "Shows seen" only for friends and omits a friends count. Written 2026-10-19.

## Claude design project header
- Project: **Drop Website** (`5b6f000f-c206-44b6-ab8a-5981e36f2af9`)
- Suggested screen names: `Friends / Find + Requests (desktop two-column)`, `Friends (mobile)`, `Public profile (desktop)`, `Public profile (mobile)`, `Plan detail + chat (desktop)`, `Plan detail + chat (mobile)`, `Block and report sheet`, plus a `States` board for each.
- Extends: existing CREW screen (Friends / Crews tabs), PLAN DETAIL, PROFILE, BLOCKED ACCOUNTS, INVITE FRIENDS, SHARED PLAN (public), in `index.html`. Reuses `.frow`, `.avstack`, `.seg`, `.sheet`, `.modal`, `.chip`, `.skel`.

## Purpose and user value
Friends are Drop's social wedge. Ranked table: #4 friends, requests, find people (High, Medium); #5 plans, crews, chat (High, Large); #7 public profile (Medium, Small); #8 block and report (Medium, Small). The web FAQ already promises "see which friends are going", yet no friends data exists on web; shared profile and plan links dead-end. App-store safety rules also expect block and report wherever people can see each other. Build order the audit implies: block/report and public profile first, then friends, then plans.

## Backend contract that already exists (native, from drop-mobile-app `DropApp/src/data/index.ts` at origin/main)
- **Friendships**: table `friendships` (`id`, `requester_id`, `recipient_id`, `status` pending or accepted). Send = insert `status:'pending'`; unique unordered pair, conflict code 23505 means already related. Accept = update `status:'accepted'` by id; decline or remove = delete by id. List = RPC `list_my_friend_edges`.
- **Find people**: RPC `search_public_profiles`.
- **Public profile**: RPC `public_profile` with argument `uid`. Counts of friends come from `friendships` head count.
- **Plans**: `plans`, `plan_members` (`plan_id`, `user_id`, `status`, upsert on `plan_id,user_id`), `plan_messages` (`plan_id`, `user_id`, `body`). RPCs `create_or_get_plan(p_event_id)` and `leave_plan(p_plan_id)`.
- **Block**: table `user_blocks` (`blocker_id`, `blocked_id`, upsert on that pair); RPC `list_my_blocked_profiles`. Note native says RLS-level hiding is a later step, so the client must filter content itself.
- **Report**: table `content_reports` insert (`reporter_id`, `content_type`, `content_id`, `reported_user_id`, `reason`). Valid `content_type` values: **unverified**; confirm in the native migration before designing a reason list.
- **Web today**: only `profiles`, `attendance`, `artist_follows`, `venue_follows` etc. are touched. None of the tables above are used by the web (parity doc). Web live-grants doc: `friendships` for role `authenticated` has DELETE, INSERT, SELECT only at table level, no UPDATE. Native accepts requests by UPDATE, so either a column grant, a policy, or an RPC covers it; **unverified for the web client**. `profiles` read is gated by `can_view_profile(id)` and a signup-complete guard. Grants for `plans`, `plan_members`, `plan_messages`, `user_blocks`, `content_reports` were not in the live-grants audit: **unverified**.
- Every authenticated table also carries the `signup_complete_*_guard` policy; a user who has not finished signup will get empty or denied results. Design the error state for that.

## States (apply to each surface)
1. **Loading**: skeleton in the shape of the content. Friends: segmented tabs real, then 4 `.frow` shaped rows (avatar circle `skel--avatar`, two `skel--text` lines, right-hand action bar). Profile: avatar circle 96px, name bar, three stat blocks, then event card skeletons (`skel--card`). Plan: header bar, member avatar row, then chat bubbles alternating left and right.
2. **Empty (real)**: see copy. Friends with zero friends is a real-empty state with a web action (find people, invite link), not the "get the app" state.
3. **Error**: inline `role="alert"` with ghost "Try again". Signup-incomplete case: "Finish setting up your account to see friends." with primary "Finish setup".
4. **Success**: data present.
5. **Blocked or private**: viewing a profile you cannot see: "This profile is private." with only "Back".
6. **Pending action**: buttons show an in-place busy label, do not remove the row until the server confirms.

## Layout, desktop (1024 and up)
Native density, new desktop layout. Max content width 1100px, two columns with a `var(--sp-xl)` (24px) gap on all sides (consistent gutters).

**A. Friends screen** (inside CREW > Friends tab)
- Left column (about 380px): "Find people" boxed search input (filled, bordered box, 52px high, placeholder "Search by name or username", search icon) then results as `.frow` rows. Each result has one action: ghost small "Add friend". Rows already friends show a `.statuschip` "Friends"; pending show "Requested" (disabled).
- Right column: segmented control `.seg` with "Friends {n}" and "Requests {n}". Requests rows have TWO small buttons: "Accept" (primary-weight small: `.btn--primary.btn--sm`) and "Decline" (`.btn--ghost.btn--sm`). That is the only primary on the row; the screen's other buttons are ghost.
- Friend rows: avatar, name, small caption (city or "Going to {event}" only if real), overflow menu "..." opening Block, Report, Remove.
- Header row: title "Friends", one ghost button "Invite by link" (uses real copy only; see spec 02).

**B. Public profile**
- Left column (about 320px): avatar (96px circle), display name (display font, `--fs-xl`), username in `--text-secondary`, bio truncated to 3 lines with "Read more", primary button depends on relationship: "Add friend" / "Requested" (disabled ghost) / "Accept request" / "Friends" (ghost, opens menu). Overflow "..." menu: Block, Report.
- Right column: stat row (counts large and bold, labels small and quiet: shows seen, artists followed, friends), then "Going to" event cards using the existing event card `.ec` smaller variant, then "Followed artists" chips.
- Only show sections the viewer is allowed to see; hide, do not show locked placeholders.

**C. Plan detail and chat**
- Left column (about 380px): event card summary (`.ec` compact), date and venue, members list as `.frow` rows with a status chip (Going, Maybe, Invited), buttons: "I'm going" primary, "Maybe" ghost, "Leave plan" ghost danger-text. The three are a radio-style segmented choice (2 to 3 options shown inline, not a dropdown).
- Right column: chat panel with fixed height, message bubbles (own right, others left; inner bubble radius smaller than panel radius, so panel 20px, bubble 14px), timestamp captions, message composer pinned at the bottom: boxed multiline input and a "Send" small primary button.
- Chat is text only. Latest at the bottom. Scroll to latest on open. New messages appear when the user focuses or reloads (live updates are an open question below).

**D. Block and report sheet**
- Desktop: `.modal` (max 360px) centered. Mobile: `.sheet` bottom.
- Block: title "Block {name}?", body "They won't be able to find you or see your profile. You can unblock them in Settings.", buttons: primary-danger "Block {name}" (`.btn--danger`) and ghost "Cancel". Since danger is the dominant action here, it is the one dominant button.
- Report: title "Report {name}", reason as radio list (2 to 3 visible radios plus "Something else"; if more than 3 reasons, use toggle chips in a grid per the toggle-token rule, single-select), optional boxed textarea "Tell us what happened (optional)", primary "Send report", ghost "Cancel". Reason labels to be confirmed with the safety lane.
- After block or report: a success `.toast--success`. Blocking removes the person from lists on this screen immediately.

## Layout, mobile (430 and below)
- Single column, 16px gutters, 12px gap between sections.
- Friends: `.seg` tabs at the top (Friends / Requests / Find). Find opens as the third tab, not a separate page. Search input sticks under the tabs.
- Public profile: centered avatar and name, stats row of three equal cells (equal gutters), primary relationship button full-width and pinned in the thumb zone at the bottom (above the tab bar). Overflow "..." top right.
- Plan: event summary, members as horizontal avatar stack (`.avstack`) with "See all" expanding; chat fills the remaining height; composer pinned above the tab bar with safe-area padding; "I'm going / Maybe / Leave" sits in a compact row at the top of the plan, not in the thumb zone, because Send is the primary action on that screen (one primary button).
- Block/report: bottom `.sheet`, buttons stacked full width, primary on top.

## Copy
- Friends title: "Friends"; tabs: "Friends {n}", "Requests {n}", "Find".
- Search placeholder: "Search by name or username"
- Buttons: "Add friend", "Requested", "Accept", "Decline", "Remove friend", "Invite by link"
- Empty friends: title "No friends on Drop yet" body "Search for someone you know, or send them your invite link." primary "Find people".
- Empty requests: "No requests right now."
- Empty search before typing: "Type a name or username to find people."
- No search results: "No one found for '{query}'. Check the spelling or try their username."
- Profile private: "This profile is private."
- Plan empty chat: "No messages yet. Say hi to your crew."
- Composer placeholder: "Message your crew"; button "Send"
- Leave plan confirm: title "Leave this plan?" body "You'll stop getting messages from it." buttons "Leave plan" (danger) and "Stay in plan".
- Block/report: as above.
- Errors: "We couldn't send that. Try again." for a failed message; "We couldn't add {name}. Try again." for a failed request.
- Never show invented friend names, mutual counts, or "{n} friends going" unless computed from real rows.

## Accessibility
- Segmented tabs use `role="tablist"` with arrow-key navigation; selected tab has `aria-selected`. Counts are part of the accessible name.
- Search input has a visible or `aria-label` label ("Search people"). Results are announced with a polite live region ("5 people found").
- Row actions have names that include the person ("Add friend, Alex Rivera").
- Chat log is `role="log"` with `aria-live="polite"`; composer has a label; Enter sends, Shift+Enter adds a newline; message send errors are announced.
- Modal and sheet trap focus, return focus to the invoking "..." button, close on Escape.
- Overflow menu is a real menu button with `aria-haspopup`.
- Contrast: all text at least 4.5:1, using `--text`, `--text-secondary`; `--text-muted` only on `--bg`/`--surface` (4.87:1 or better, see spec 06). Danger text `--danger` on `--surface` is 6.05:1 (pass) but white text on a `--danger` fill is 2.99:1 (fail), so the existing `.btn--danger` uses ink text (6.5:1); keep that.
- Do not rely on color alone for Going / Maybe; chips carry text.

## Out of scope
- Crews (named groups), Crew Picks, Crew activity, Festival crew, Taste match (audit ranks 14, unshipped).
- Contact sync and phone-book matching (not possible on web).
- Push notifications, typing indicators, read receipts, reactions, images or GIFs in chat.
- Admin moderation views.
- Real-time delivery is an open question for the build lane (polling vs Supabase realtime); design only needs the "new message" and "reconnecting" affordances: a small chip "New messages" and a muted line "Reconnecting...".

## Acceptance checklist
- [ ] Frames: Friends (find, friends, requests), Public profile (4 relationship states), Plan detail + chat, Block, Report; each in desktop and mobile.
- [ ] States board per surface: loading skeleton, empty, error, success.
- [ ] One primary button per screen or sheet (plan screen: Send is primary; others are ghost).
- [ ] Accept and Decline are visually unequal (primary vs ghost).
- [ ] Mobile primary actions sit in the thumb zone.
- [ ] Inputs are boxed (filled and bordered), not underlined; related label and input are tighter than the gap between groups.
- [ ] Nested radii are smaller than their containers (panel 20, bubble 14, avatar chip as pill).
- [ ] Grid gutters are the same on all sides in each layout.
- [ ] Bio uses 3-line truncation plus "Read more".
- [ ] No fake people, counts, or messages anywhere.
- [ ] Block and report copy reviewed by the safety lane.
- [ ] Contrast pairs listed in the frames and all at least 4.5:1.
