#!/usr/bin/env python3
"""Upsert the signed-in website QA inventory and build a dependency-free XLSX."""

from __future__ import annotations

import csv
import re
from collections import Counter
from datetime import datetime, timezone
from html import escape
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "docs/qa/feature-matrix.csv"
XLSX_PATH = ROOT / "docs/qa/drop-website-feature-matrix.xlsx"
WEBSITE_COMMIT = "25512a5c966dbc0ad93302291b768c19cea554ca"
MOBILE_COMMIT = "62ba25546b1180969b46f423cc7f2240b9cc8140"
AUDIT_DATE = "2026-07-29"


def story(
    id_: str,
    surface: str,
    journey: str,
    module: str,
    user_story: str,
    acceptance: str,
    edges: str,
    implementation: str,
    test_status: str,
    evidence: str,
    next_action: str,
    *,
    requirement: str = "WEBSITE-SIGNED-IN-INVENTORY",
    defects: str = "",
    ux: str = "",
    performance: str = "",
    security: str = "",
) -> dict[str, str]:
    return {
        "ID": id_,
        "Product surface": surface,
        "Feature or user journey": journey,
        "Module": module,
        "Dependencies": "React Router; Supabase client; shared Drop event/profile data",
        "User story": user_story,
        "Acceptance criteria": acceptance,
        "Edge cases": edges,
        "Implementation status": implementation,
        "Test type": "Playwright desktop/mobile source-backed journey",
        "Test command or evidence": evidence,
        "Last-tested commit": WEBSITE_COMMIT,
        "Known defects": defects,
        "UX/accessibility issues": ux,
        "Performance concerns": performance,
        "Security/privacy concerns": security,
        "Severity": "None assigned — requirement/story",
        "Resolution status": {
            "Passed": "Passed",
            "Failed": "Known defect unresolved or approval-required",
            "Blocked": "Blocked",
            "Not implemented": "Not implemented; requirement retained",
            "Awaiting device QA": "Awaiting device QA",
        }[test_status],
        "Exact next action": next_action,
        "Row type": "Story",
        "Requirement ID": requirement,
        "Original requirement wording": "",
        "Original wording SHA-256": "",
        "Source": (
            f"drop-website-parity {WEBSITE_COMMIT}; drop-mobile-app {MOBILE_COMMIT}; "
            "docs/signed-in-route-matrix.md; founder and sanitized Apple requirement registry"
        ),
        "Test status": test_status,
        "Expected behavior": acceptance,
        "Actual behavior": (
            "Deterministic evidence passed." if test_status == "Passed"
            else "The linked defect or capability gap prevents a passing disposition."
        ),
        "Minimal reproduction": evidence,
        "Environment": f"Local Playwright desktop Chromium and mobile WebKit emulation, {AUDIT_DATE}",
        "Root cause": "",
        "Owner": "Website owner",
        "Linked stories": id_,
    }


def defect(
    id_: str,
    surface: str,
    journey: str,
    module: str,
    severity: str,
    expected: str,
    actual: str,
    reproduction: str,
    root_cause: str,
    status: str,
    next_action: str,
    linked: str,
    *,
    security: str = "",
    test_status: str = "Failed",
    owner: str = "Website owner",
) -> dict[str, str]:
    return {
        "ID": id_,
        "Product surface": surface,
        "Feature or user journey": journey,
        "Module": module,
        "Dependencies": "React; Supabase client; website deployment workflow",
        "User story": "",
        "Acceptance criteria": expected,
        "Edge cases": reproduction,
        "Implementation status": "Defect confirmed",
        "Test type": "Source inspection and focused reproduction",
        "Test command or evidence": reproduction,
        "Last-tested commit": WEBSITE_COMMIT,
        "Known defects": id_,
        "UX/accessibility issues": actual if "A11Y" in id_ else "",
        "Performance concerns": actual if "PERF" in id_ else "",
        "Security/privacy concerns": security,
        "Severity": severity,
        "Resolution status": status,
        "Exact next action": next_action,
        "Row type": "Defect",
        "Requirement ID": "",
        "Original requirement wording": "",
        "Original wording SHA-256": "",
        "Source": f"drop-website-parity {WEBSITE_COMMIT}; read-only audit {AUDIT_DATE}",
        "Test status": test_status,
        "Expected behavior": expected,
        "Actual behavior": actual,
        "Minimal reproduction": reproduction,
        "Environment": f"Local source and Playwright at {WEBSITE_COMMIT}, {AUDIT_DATE}",
        "Root cause": root_cause,
        "Owner": owner,
        "Linked stories": linked,
    }


def blocker(
    id_: str,
    surface: str,
    journey: str,
    expected: str,
    actual: str,
    next_action: str,
    linked: str,
    owner: str,
) -> dict[str, str]:
    row = defect(
        id_, surface, journey, "External verification boundary", "Medium",
        expected, actual, actual, "Required external capability was unavailable.",
        "Blocked; no product result inferred.", next_action, linked,
        test_status="Blocked", owner=owner,
    )
    row["Row type"] = "Blocker"
    row["Implementation status"] = "Verification blocked"
    return row


WEBSITE_ROWS = [
    story(
        "WEBAPP-001", "Signed-in website / authentication", "Sign up, sign in, recovery, and compliance gate",
        "webapp/src/App.tsx; webapp/src/auth",
        "As a visitor, I want secure account entry and recovery, so that I can reach only the state my account is authorized to use.",
        "Invalid credentials stay on the form; taken usernames do not create an account; compliance fails closed; password reset requires a recovery event; authenticated users reach /discover.",
        "offline; timeout; malformed email; duplicate username; expired recovery event; unauthorized session; interrupted signup",
        "Implemented", "Passed",
        "npm test: auth errors, compliance timeout/fail-closed, recovery-event, and delete-dialog tests passed in both configured projects.",
        "Retain the deterministic auth mocks and obtain a seeded non-production account for live Auth/RLS verification.",
        security="Mocked browser tests prove client behavior, not hosted Auth settings or RLS enforcement.",
    ),
    story(
        "WEBAPP-002", "Signed-in website / responsive shell", "Desktop side navigation and mobile app-like navigation",
        "webapp/src/App.tsx; webapp/src/styles.css",
        "As a signed-in user, I want navigation suited to my screen, so that the website remains efficient on desktop and familiar on mobile.",
        "Desktop shows the Prism header and side rail; mobile shows root bottom navigation and child back navigation; neither layout overflows horizontally; every implemented route is reachable.",
        "390px viewport; wide desktop; deep link; browser back; unknown route; profile load failure",
        "Implemented", "Passed",
        "npm test: authenticated desktop/mobile navigation, placeholder replacement, settings fallback, and console-clean route tests passed.",
        "Retain both Playwright projects as the responsive navigation regression gate.",
        requirement="REQ-FOUNDER-152; REQ-FOUNDER-202; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-003", "Signed-in website / location", "Searchable city picker, browser location, and exact city/state filtering",
        "webapp/src/App.tsx; webapp/src/discovery.tsx; webapp/src/Combobox.tsx",
        "As a signed-in user, I want to type or detect my location, so that Discover, Search, and Map show the intended area.",
        "The visible location picker accepts supported and arbitrary city text; browser geolocation clears conflicting URL city state; same-named cities remain distinguished by state; missing profile state is never invented.",
        "permission denied; geolocation timeout; blank state; duplicate city names; malformed query; profile hydration race; no matching city",
        "Partial", "Passed",
        "npm test: location picker, geolocation, same-name city, blank-state, and hydration-race tests passed.",
        "Implement the separately tracked direct Discover/Map Near me and Everywhere modes before calling location parity complete.",
        requirement="REQ-FOUNDER-104; REQ-FOUNDER-153; REQ-FOUNDER-154; REQ-FOUNDER-155; REQ-FOUNDER-159; REQ-FOUNDER-199; REQ-FOUNDER-249; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-004", "Signed-in website / Discover", "Personalized For You, Upcoming, Crew, genres, festivals, and entity navigation",
        "webapp/src/discovery.tsx",
        "As a signed-in user, I want real personalized discovery results, so that I can find relevant events and open their real destinations.",
        "Real catalog data powers sections; For You uses follows/location/genres; Crew uses accepted-friend attendance; headings remain left aligned while event collections are centered; cards navigate to event, artist, venue, festival schedule, map, and notifications destinations.",
        "loading; empty follows; no friends; previous-day event; ongoing multi-day event; retry after fetch failure; sparse collection",
        "Implemented", "Passed",
        "npm test: personalized Discover, centered collections, ongoing-event, retry, child-route, and representative navigation tests passed.",
        "Retain the current source-backed route matrix and regression suite.",
        requirement="REQ-FOUNDER-002; REQ-FOUNDER-031; REQ-FOUNDER-079; REQ-FOUNDER-080; REQ-FOUNDER-178; REQ-FOUNDER-179; REQ-FOUNDER-198; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-005", "Signed-in website / Search", "Grouped typeahead and city, date, genre, price, and distance filters",
        "webapp/src/discovery.tsx; webapp/src/Combobox.tsx",
        "As a signed-in user, I want typeable search and filters, so that I can find events, artists, and venues without guessing an exact name.",
        "Typing opens grouped suggestions; keyboard Enter follows native destinations; city and genre filters are searchable; URL-backed query state survives reload; filters produce honest ready/empty/error states.",
        "empty query; no results; malformed URL query; duplicate entity labels; keyboard Escape/Enter/arrows; location denied; price unknown; timeout/retry",
        "Implemented", "Passed",
        "npm test: native calm state, grouped typeahead, multi-filter sheet, URL reload, and keyboard destination tests passed.",
        "Retain the shared combobox and search regression tests.",
        requirement="REQ-FOUNDER-019; REQ-FOUNDER-053; REQ-FOUNDER-109; REQ-FOUNDER-110; REQ-FOUNDER-125; REQ-FOUNDER-126; REQ-FOUNDER-135; REQ-FOUNDER-154; REQ-FOUNDER-155; REQ-FOUNDER-180; REQ-FOUNDER-181; REQ-FOUNDER-242; REQ-FOUNDER-247; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-006", "Signed-in website / Map", "Working attributed browser map with event markers and card navigation",
        "webapp/src/discovery.tsx",
        "As a signed-in user, I want a working event map, so that I can understand where nearby shows are and open their details.",
        "CARTO/OSM tiles render with attribution; only events with reliable coordinates in the selected area receive pins; marker/card selection opens /event/:eventId; no blank or fake Apple map appears.",
        "missing coordinates; city-only fallback; no events; tile failure; permission denied; duplicate coordinates; mobile pan/zoom",
        "Implemented", "Passed",
        "npm test: real coordinates, city-only exclusion, square tiles, area filtering, and event navigation tests passed.",
        "Keep the working browser map; require a MapKit JS token/service decision before any provider replacement.",
        requirement="REQ-FOUNDER-068; REQ-FOUNDER-069; REQ-FOUNDER-079; REQ-FOUNDER-080; REQ-FOUNDER-081; REQ-FOUNDER-082; REQ-FOUNDER-104; REQ-FOUNDER-122; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-007", "Signed-in website / Event detail", "Website-native event detail, RSVP/save/follow, calendar, comments, plans, and ticket handoff",
        "webapp/src/discovery.tsx",
        "As a signed-in user, I want a complete event page, so that I can decide, save, plan, discuss, and buy without an enlarged poster-card regression.",
        "Wide responsive media and readable facts render; Going/Interested/Save and venue-follow state persist only after hydration; calendar output is valid; moderated comments fail closed; ticket links are sanitized external URLs opened safely.",
        "past event; time TBA; multi-day event; missing art; action-read failure; comment failure; blocked commenter; cancelled share; malformed ticket URL; duplicate action",
        "Implemented", "Passed",
        "npm test: responsive landscape media, action hydration/fail-closed, calendar, comments, offers, tickets, past-event, share-cancel, weather, and plan-start tests passed.",
        "Retain focused event-detail coverage and verify real seller redirects only in an approved non-production account.",
        requirement="REQ-FOUNDER-052; REQ-FOUNDER-077; REQ-FOUNDER-103; REQ-FOUNDER-157; REQ-FOUNDER-163; REQ-FOUNDER-167; REQ-FOUNDER-196; WEBSITE-SIGNED-IN-INVENTORY",
        security="External URLs are sanitized and opened with safe rel attributes; presale codes remain server-gated.",
    ),
    story(
        "WEBAPP-008", "Signed-in website / Artists", "Artist detail, follow state, upcoming events, and seen-history entry",
        "webapp/src/discovery.tsx; webapp/src/parity.tsx",
        "As a signed-in user, I want an artist profile connected to my history, so that I can follow the artist, find upcoming shows, and review nights I attended.",
        "Artist identity and art render without merging same-name IDs; follow state is explicit; upcoming event rows open event detail; history opens /history/artist/:artistId.",
        "missing image; unresolved ID; duplicate name; empty upcoming; follow read/write failure; private history",
        "Implemented", "Passed",
        "npm test: artist/venue suggestion navigation, same-name artist isolation, Stats artist history, and event-row navigation passed.",
        "Add a direct focused artist-page follow failure test when live non-production RLS verification becomes available.",
        requirement="REQ-FOUNDER-054; REQ-FOUNDER-064; REQ-FOUNDER-070; REQ-FOUNDER-071; REQ-FOUNDER-072; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-009", "Signed-in website / Artist seen history", "Artist-specific attended/logged show history",
        "webapp/src/parity.tsx",
        "As a signed-in user, I want an artist’s seen-history view, so that I can revisit each specific show rather than landing on a marketing page.",
        "The route filters real attended/logged history by canonical artist ID; newest shows appear first; each row opens linked /show/:id or /event/:id; ambiguous names remain an explicit real-name filter.",
        "same-name artists; unresolved catalog ID; manual show; empty history; selected year/all-time range; missing linked event",
        "Implemented", "Passed",
        "npm test: Stats drill-down, ambiguous artist filter, range preservation, and canonical artist ID isolation passed.",
        "Retain the Stats/history drill-down regression tests.",
        requirement="REQ-FOUNDER-055; REQ-FOUNDER-056; REQ-FOUNDER-057; REQ-FOUNDER-062; REQ-FOUNDER-063; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-010", "Signed-in website / Venues", "Venue detail, follow state, upcoming events, and visit history entry",
        "webapp/src/discovery.tsx; webapp/src/parity.tsx",
        "As a signed-in user, I want a venue page connected to upcoming events and my visits, so that I can follow the venue and revisit prior nights.",
        "Venue route preserves city/state identity; upcoming rows open event detail; follow state is hydrated before mutation; visit history opens /history/venue/:venueKey.",
        "same venue name in two cities; missing state; empty upcoming; follow failure; missing image; private history",
        "Implemented", "Passed",
        "npm test: venue route state requirements, venue suggestion navigation, follow-state gating, and venue Stats history passed.",
        "Retain venue identity and history tests.",
        requirement="REQ-FOUNDER-020; REQ-FOUNDER-027; REQ-FOUNDER-028; REQ-FOUNDER-229; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-011", "Signed-in website / Venue and city history", "Venue visits and website-native city history",
        "webapp/src/parity.tsx",
        "As a signed-in user, I want venue and city history results, so that Stats destinations show the nights behind each count.",
        "Venue history filters real visits by stable key; city history preserves city/state context and filters the same real history; every result opens show or event detail.",
        "duplicate city names; blank state; manual show; empty results; selected range; deleted catalog event",
        "Implemented", "Passed",
        "npm test: venue/city Stats destinations, city-state matching, range preservation, and result-row navigation passed.",
        "Retain the deliberate website-native city extension documented in DECISIONS.md.",
        requirement="REQ-FOUNDER-020; REQ-FOUNDER-027; REQ-FOUNDER-061; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-012", "Signed-in website / My Shows", "Upcoming, saved, past, plans, Wrapped, Stats, log, and import navigation",
        "webapp/src/parity.tsx",
        "As a signed-in user, I want one My Shows hub, so that I can manage future intent and past history without mixing them.",
        "Upcoming, Saved, and Past use real attendance/saved/history data; canonical and manual history dedupe; past is newest-first; child routes open the correct show/event; plans, Wrapped, Stats, log, and import are reachable.",
        "empty list; ongoing multi-day event; duplicate linked memory; deleted event; loading/error/retry; unauthorized read",
        "Implemented", "Passed",
        "npm test: canonical dedupe, ongoing-event, past merge/order, approved route replacement, and linked show navigation passed.",
        "Retain My Shows as the cross-device history entry point.",
        requirement="REQ-FOUNDER-048; REQ-FOUNDER-050; REQ-FOUNDER-060; REQ-FOUNDER-076; REQ-FOUNDER-130; REQ-FOUNDER-215; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-013", "Signed-in website / Past shows", "Manual show logging and private detail editing",
        "webapp/src/parity.tsx; webapp/src/lib/history.ts",
        "As a signed-in user, I want to log and edit a past show, so that my history, artists, Stats, and recap stay accurate across Drop surfaces.",
        "Manual entry validates required fields; private notes/rating/lineup/tags save to the owner’s rows; linked event identity is retained; failed tag hydration does not erase existing tags.",
        "malformed date; unknown artist/venue; duplicate save; authorization denial; interrupted edit; tag hydration failure; conflicting lineup",
        "Implemented", "Passed",
        "npm test: manual memory editing, conflict choice, tag hydration failure, and history merge tests passed.",
        "Add live non-production RLS assertions before promoting this from client-verified to service-verified.",
        requirement="REQ-FOUNDER-047; REQ-FOUNDER-049; REQ-FOUNDER-052; REQ-FOUNDER-228; REQ-FOUNDER-229; REQ-FOUNDER-247; WEBSITE-SIGNED-IN-INVENTORY",
        security="Owner-scoped writes are mocked locally; hosted RLS remains a separate verification blocker.",
    ),
    story(
        "WEBAPP-014", "Signed-in website / History import", "Local .ics parsing, review, dedupe, and confirmed save",
        "webapp/src/parity.tsx; webapp/src/lib/history.ts",
        "As a signed-in user, I want to review calendar imports before saving, so that I can add history quickly without corrupting existing shows.",
        "The browser parses .ics locally; nothing writes before confirmation; exact matches are protected; ambiguous archive matches require manual review; only checked rows save.",
        "malformed calendar; duplicate VEVENT; timezone boundary; ambiguous title; partial save failure; interrupted session; empty file",
        "Implemented", "Passed",
        "npm test: local-until-confirmed, checked-only save, exact match protection, and ambiguous-review tests passed.",
        "Retain local parsing and explicit confirmation; do not add mailbox access without separate authorization.",
        requirement="REQ-FOUNDER-058; REQ-FOUNDER-101; REQ-FOUNDER-161; REQ-FOUNDER-166; REQ-FOUNDER-203; REQ-FOUNDER-254; WEBSITE-SIGNED-IN-INVENTORY",
        security="Calendar contents stay local until the user confirms selected rows.",
    ),
    story(
        "WEBAPP-015", "Signed-in website / Local media and recap", "User/show-scoped IndexedDB media and attended-only recap",
        "webapp/src/parity.tsx; webapp/src/lib/history.ts",
        "As a signed-in user, I want private local show media and recaps, so that I can remember a night without silently uploading my library.",
        "Explicit browser-selected media is stored user/show-scoped in IndexedDB; future/unattended shows cannot create recaps; recap exports recheck consent and omit private tags by default; deletion clears local media when possible.",
        "storage quota; unsupported file; deleted source file; future show; cancelled share; browser clear; account switch; interrupted write",
        "Implemented", "Passed",
        "npm test: attended-only recap, local-first export, share cancellation, and device-local media editing passed.",
        "Run physical-device Safari storage/quota and share-sheet cases on the exact delivered artifact.",
        requirement="REQ-FOUNDER-001; REQ-FOUNDER-065; REQ-FOUNDER-100; REQ-FOUNDER-163; REQ-FOUNDER-185; REQ-FOUNDER-186; WEBSITE-SIGNED-IN-INVENTORY",
        security="No automatic Photo Library scan exists on web; private tags require explicit export consent.",
    ),
    story(
        "WEBAPP-016", "Signed-in website / Drop Stats", "Current-year/all-time rankings and show/entity drill-downs",
        "webapp/src/parity.tsx",
        "As a signed-in user, I want every Stats count and ranking to open its underlying history, so that I can verify what produced the number.",
        "Current year is Jan 1–Dec 31 and all-time is selectable; show rows open show/event detail; artist opens artist seen history; venue and city open matching history; genre opens filtered history; range persists through destinations.",
        "zero history; same-name artists/cities; manual show; missing catalog entity; selected range; duplicated linked memory",
        "Implemented", "Passed",
        "npm test: current-year/all-time, artist/venue/city/show/genre navigation, ambiguity, range persistence, and entity isolation passed.",
        "Retain source-backed Stats destinations as a release gate.",
        requirement="REQ-FOUNDER-046; REQ-FOUNDER-059; REQ-FOUNDER-061; REQ-FOUNDER-062; REQ-FOUNDER-063; REQ-FOUNDER-074; REQ-FOUNDER-076; REQ-FOUNDER-184; REQ-ASC-FEEDBACK-009; REQ-ASC-FEEDBACK-010; REQ-ASC-FEEDBACK-028; REQ-ASC-FEEDBACK-029; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-017", "Signed-in website / Friends", "Friend search, requests, activity, and public profiles",
        "webapp/src/parity.tsx",
        "As a signed-in user, I want to find and manage friends, so that I can see allowed activity and navigate to their profiles.",
        "Search uses the privacy-safe RPC; blocked profiles are excluded; incoming requests accept/decline with visible success or failure; activity rows open plan/event; profile history respects friendship/privacy/block rules.",
        "search under two characters; no results; duplicate request; mutation denial; blocked user; private profile; timeout/retry",
        "Implemented", "Failed",
        "Source inspection webapp/src/parity.tsx:1575-1594: accept/decline and add mutations discard Supabase errors; happy-path Playwright coverage passed.",
        "Fix WEB-DEF-SOC-001, add failure-path regression coverage, then rerun focused and full suites.",
        defects="WEB-DEF-SOC-001",
        security="Profile and activity queries must continue to fail closed for blocks and private history.",
    ),
    story(
        "WEBAPP-018", "Signed-in website / Blocks and privacy", "Blocked-user exclusion and unblock controls",
        "webapp/src/parity.tsx",
        "As a signed-in user, I want blocking to remove another account from social surfaces, so that my privacy choice is consistently enforced.",
        "Blocked IDs are excluded before friends, notification attendance, crew, profile, and live presence render; public profile fails closed; unblock reports success or failure without optimistic drift.",
        "block-list read failure; unblock denial; stale notification; simultaneous friendship; missing profile; duplicate click",
        "Implemented", "Failed",
        "npm test proved fail-closed reads and cross-surface exclusion; source inspection parity.tsx:2272-2275 found silent unblock failure.",
        "Fix WEB-DEF-UTIL-001, add an unblock failure regression test, and rerun the privacy suite.",
        defects="WEB-DEF-UTIL-001",
        security="Block-list read failures must fail closed.",
    ),
    story(
        "WEBAPP-019", "Signed-in website / Plans", "Plan creation, detail, RSVP, invite, chat, share, and leave",
        "webapp/src/discovery.tsx; webapp/src/parity.tsx",
        "As a signed-in user, I want to coordinate a show plan with accepted friends and crews, so that attendance details stay in one private place.",
        "Plan creation uses the atomic backend contract; detail opens from plan/event; members RSVP, invite accepted friends/crews, read ordered bounded chat, share, and leave via authorized contracts.",
        "duplicate click; invite non-friend; stale membership; message limit; RPC failure; creator leave; interrupted request",
        "Implemented", "Passed",
        "npm test: atomic plan start, 100-message ordering, invited-member RSVP/leave, creator invite, and handoff RPC tests passed.",
        "Add a live non-production authorization run for plan membership policies.",
        security="Client tests mock the atomic RPC; hosted authorization remains unverified.",
    ),
    story(
        "WEBAPP-020", "Signed-in website / Crews", "Create and manage private reusable friend groups",
        "webapp/src/parity.tsx",
        "As a signed-in user, I want private crews of accepted friends, so that I can reuse a group for plans.",
        "Only accepted friends are selectable; free-tier cap is rechecked before insert; member changes either apply completely or leave the original membership intact; failures are visible.",
        "cap race; add and remove together; one write denied; duplicate member; stale friend edge; interrupted session",
        "Partial", "Failed",
        "npm test passed cap and happy-path membership checks; source inspection parity.tsx:1705-1717 found parallel add/delete can partially apply.",
        "Backend owner designs an atomic crew-membership RPC; obtain backend approval, add contract tests, then update the client.",
        defects="WEB-DEF-CREW-001",
        security="Membership changes require owner authorization and an atomic server contract.",
    ),
    story(
        "WEBAPP-021", "Signed-in website / Festivals", "Festival list, official schedule, day/stage grouping, and saved sets",
        "webapp/src/parity.tsx",
        "As a signed-in user, I want a real festival schedule, so that I can build a personal set list without demo data.",
        "Published festival data opens /schedule/:eventId; official set times group by venue-timezone day and stage; add/remove set persists only on successful write; empty/unpublished and retry states are honest.",
        "no schedule; timezone boundary; overlapping stages; duplicate tap; mutation denial; transient catalog failure",
        "Implemented", "Failed",
        "Public festival timezone/retry tests and signed-in connected schedule tests passed; source inspection parity.tsx:1874-1880 found silent mutation failure.",
        "Fix WEB-DEF-SCHED-001, add a rejected-write test, and rerun festival suites.",
        defects="WEB-DEF-SCHED-001",
    ),
    story(
        "WEBAPP-022", "Signed-in website / Live Mode", "Time-bounded set context, crew presence, and check-in",
        "webapp/src/parity.tsx",
        "As a signed-in attendee, I want time-bounded Live Mode, so that I can see current/next sets and share presence only during the show.",
        "Check-in is disabled outside the authored event window; existing check-in restores; route changes reset local state; open sets remain correct across stages; failed writes show an error and do not mark checked-in.",
        "outside event window; missing end; another stage starts; route change; background polling; blocked friend; write denial; duplicate tap",
        "Implemented", "Failed",
        "npm test passed six Live Mode timing/state cases; source inspection parity.tsx:1932-1936 found silent check-in failure.",
        "Fix WEB-DEF-LIVE-001, add rejected-write coverage, and rerun Live Mode tests.",
        defects="WEB-DEF-LIVE-001",
        security="Presence is time-bounded and block-filtered.",
    ),
    story(
        "WEBAPP-023", "Signed-in website / Notifications and reminders", "Derived notifications, routing, preferences, and on-sale reminders",
        "webapp/src/parity.tsx; webapp/src/App.tsx",
        "As a signed-in user, I want honest notifications and reminders, so that relevant plan/event activity routes correctly without fabricating browser push.",
        "Notifications wait for profile hydration, preserve current synthesized alerts, exclude blocked friends, and route to plan/event; reminder dates use event timezone; toggles report failed writes.",
        "no notifications; stale history; profile race; blocked friend; same-day timezone; write denial; browser push unavailable",
        "Implemented", "Failed",
        "npm test passed hydration, cap, block, route, and timezone tests; source inspection parity.tsx:2268-2271 found silent reminder failure.",
        "Fix WEB-DEF-UTIL-001 and keep native push/browser background delivery explicitly out of the web claim.",
        defects="WEB-DEF-UTIL-001",
    ),
    story(
        "WEBAPP-024", "Signed-in website / Profile and settings", "Profile editing, preferences, wallet, utilities, legal, and account deletion",
        "webapp/src/App.tsx; webapp/src/parity.tsx",
        "As a signed-in user, I want to manage my profile, preferences, utilities, and account, so that I control my identity and privacy.",
        "Profile values persist with validation; settings remain reachable when profile hydration fails; utility routes show real conditional states; deletion requires DELETE, exposes errors, and keeps keyboard focus inside the modal until closed.",
        "missing profile; duplicate username; photo failure; compliance unavailable; deletion failure; Escape; Tab/Shift+Tab; interrupted deletion",
        "Implemented", "Failed",
        "npm test passed profile fallback, compliance fail-closed, and delete confirmation; source inspection App.tsx:880-917 found no focus trap or Escape close.",
        "Fix WEB-DEF-A11Y-001, add keyboard-modal coverage, then rerun auth/settings tests.",
        defects="WEB-DEF-A11Y-001",
        security="Account deletion behavior itself is approval-gated; this audit changes only modal accessibility.",
    ),
    story(
        "WEBAPP-025", "Signed-in website / Wrapped", "Current-year/all-time history summary and attended-only sharing",
        "webapp/src/parity.tsx",
        "As a signed-in user, I want current-year and all-time Wrapped results, so that I can review and share an honest summary of attended shows.",
        "Wrapped derives from real deduped history, preserves range, keeps mobile share actions centered, and treats share cancellation as a no-op.",
        "zero history; private tags; cancelled share; unsupported Web Share; long artist name; mobile viewport",
        "Implemented", "Passed",
        "npm test: current-year/all-time history and Wrapped share-cancellation tests passed in desktop and mobile projects.",
        "Run physical-device share-sheet verification on the delivered artifact.",
        requirement="REQ-FOUNDER-037; REQ-FOUNDER-051; REQ-FOUNDER-160; REQ-FOUNDER-162; REQ-FOUNDER-192; REQ-FOUNDER-215; WEBSITE-SIGNED-IN-INVENTORY",
    ),
    story(
        "WEBAPP-026", "Signed-in website / shared form controls", "Accessible searchable combobox",
        "webapp/src/Combobox.tsx",
        "As a keyboard or screen-reader user, I want every large option picker to be typeable, so that I can find and select values efficiently.",
        "One shared combobox supports typing, arrows, Enter, Escape, visible focus, listbox/option semantics, empty results, labels, single/multi-select, and keeps the active option visible.",
        "zero results; long list; filtered active index; multiple selection; blur; disabled state; screen reader; zoom",
        "Implemented", "Failed",
        "Keyboard destination tests passed; source inspection Combobox.tsx:50-176 found no scrollIntoView when keyboard movement selects an off-screen option.",
        "Fix WEB-DEF-A11Y-002, add a long-list keyboard regression test, and rerun desktop/mobile search tests.",
        defects="WEB-DEF-A11Y-002",
        ux="Active keyboard option can move outside the scroll viewport.",
    ),
    story(
        "WEBAPP-027", "Signed-in website / application states", "Conditional loading, ready, empty, error, and retry behavior",
        "webapp/src/parity.tsx; webapp/src/discovery.tsx",
        "As a signed-in user, I want honest conditional states, so that I understand whether data is loading, absent, or recoverable.",
        "Loading/empty/error are driven by data state, not visible demo tabs; failures expose retry where safe; ready content remains during background refresh; no fabricated event/friend/plan/history rows appear.",
        "offline; timeout; retry success; stale refresh; permission denied; malformed response; zero rows",
        "Implemented", "Passed",
        "npm test: parity-page retry, festival retry, comment fail-closed, optional weather, background polling, and empty-state cases passed.",
        "Retain deterministic conditional-state coverage.",
    ),
    story(
        "WEBAPP-028", "Signed-in website / event collections", "Uniform centered cards, responsive columns, and accessible rails",
        "webapp/src/discovery.tsx; webapp/src/styles.css",
        "As a signed-in user, I want consistent event cards and collections, so that browsing feels stable and artwork stays useful at every viewport.",
        "Cards in one context share width, height, ratio, radius, crop, and structure; headings stay left while collections center; intentional rails have previous/next, touch scroll, keyboard support, snap, and balanced gutters; event clicks open detail.",
        "one card; sparse final row; broken art; very wide/narrow viewport; touch scroll; keyboard scroll; reduced motion",
        "Implemented", "Passed",
        "npm test: centered Upcoming, uniform card rail, working controls, mobile For You rail, event detail landscape media, and public grid tests passed.",
        "Capture release screenshots whenever card CSS changes.",
        requirement="REQ-FOUNDER-086; REQ-FOUNDER-103; REQ-FOUNDER-152; REQ-FOUNDER-158; REQ-FOUNDER-159; REQ-FOUNDER-160; REQ-FOUNDER-168; REQ-FOUNDER-202; REQ-ASC-FEEDBACK-017; WEBSITE-SIGNED-IN-INVENTORY",
        performance="Artwork sharpness still depends on upstream source resolution and provider availability.",
    ),
    story(
        "WEBAPP-029", "Signed-in website / Submit Event", "Validated community event submission",
        "No React route",
        "As a signed-in user, I want to submit a missing event for review, so that the catalog can improve without direct public writes.",
        "A validated form creates a pending-review submission under authenticated authorization, reports real reward/status, prevents duplicates, and exposes loading/error/retry.",
        "unauthorized; duplicate event; malformed URL/date; upload failure; interrupted submission; moderation rejection",
        "Missing", "Not implemented",
        "docs/signed-in-route-matrix.md:9 and :45-47 explicitly record no React route.",
        "Product/backend owner approves the web submission contract; implement the smallest route against the existing reviewed submission service with auth/RLS tests.",
    ),
    story(
        "WEBAPP-030", "Signed-in website / event social parity", "Event-specific crew builder, tagged shows, and dedicated invites",
        "No equivalent React routes",
        "As a signed-in user, I want event-specific crew, invite, and tagged-show destinations, so that social actions preserve the mobile outcome.",
        "Each trigger reaches its own website-native result; no unrelated redirect substitutes for crew builder, tagged history, or invite flow; privacy and authorization match mobile.",
        "no accepted friends; duplicate invite; private tag; blocked user; event deleted; unauthorized request",
        "Missing", "Not implemented",
        "docs/signed-in-route-matrix.md:17,34,45-47 records the three missing destinations.",
        "Product owner ranks the three outcomes; implement one source-backed route at a time with authorization tests.",
    ),
    story(
        "WEBAPP-031", "Signed-in website / Taste Match", "Friend taste comparison",
        "No equivalent React route",
        "As a signed-in user, I want an explainable Taste Match with a friend, so that I can understand shared and different music history.",
        "The score is derived from authorized real data, exposes its basis, handles zero history honestly, and opens only for eligible profiles.",
        "no shared history; identical history; private profile; blocked user; duplicate artists; stale score",
        "Missing", "Not implemented",
        "docs/signed-in-route-matrix.md:34-35,45-47 records Taste Match as an audited gap.",
        "Product/data owner defines the current scoring contract and privacy eligibility before website implementation.",
    ),
    story(
        "WEBAPP-032", "Signed-in website / direct location modes", "Discover and Map Near me / Everywhere controls",
        "webapp/src/discovery.tsx",
        "As a signed-in user, I want direct Near me and Everywhere modes in Discover and Map, so that I can switch scope without detouring through Search.",
        "Near me uses permissioned browser coordinates; Everywhere clears local constraints; the active scope is visible and consistent across Discover/Map; denial and empty states are honest.",
        "permission denied; timeout; stale profile location; no nearby events; duplicate city; route reload",
        "Partial", "Blocked",
        "docs/signed-in-route-matrix.md:12,45-47 records profile picker/Search support but no direct Discover/Map modes.",
        "Product owner confirms whether direct scope controls remain required; then add them by reusing existing location state and geolocation logic.",
    ),
    story(
        "WEBAPP-033", "Signed-in website / activation", "First-run setup and feature education",
        "No equivalent React flow",
        "As a new website user, I want an optional first-run setup, so that I can choose tastes and understand history, Stats, and social features.",
        "Setup uses real profile/taste fields, is skippable, resumes safely, never blocks existing accounts, and explains core outcomes without demo data.",
        "returning user; interrupted setup; offline; skipped step; empty artist catalog; duplicate selection",
        "Missing", "Not implemented",
        "BACKLOG.md and docs/signed-in-route-matrix.md:45-47 record activation as a remaining specialist gap.",
        "Product owner approves the current activation sequence and field contract before implementation.",
    ),
    story(
        "WEBAPP-034", "Signed-in website / promoter and admin", "Promoter tools, artist claims, submissions, and moderation",
        "No signed-in React specialist routes",
        "As an authorized promoter, artist, or moderator, I want role-specific tools, so that I can manage only the catalog records I own or review.",
        "Role and ownership are server-enforced; unauthorized users see no controls; writes are auditable; review states and errors are honest.",
        "role revoked; ownership conflict; duplicate claim; malformed event; moderation denial; audit-log failure",
        "Missing", "Not implemented",
        "BACKLOG.md and docs/signed-in-route-matrix.md:45-47 record promoter/admin as specialist gaps.",
        "Security/product owner defines roles, authorization policies, and audit requirements before any UI work.",
        security="This is an authorization-sensitive surface and cannot be inferred from client code.",
    ),
    story(
        "WEBAPP-035", "Signed-in website / deeper social", "Realtime crew activity, comments, invites, and group behavior",
        "Partial React social surfaces",
        "As a signed-in user, I want deeper realtime social coordination, so that crew activity updates without fabricating or leaking private data.",
        "Only authorized events stream; blocks and privacy apply before render; reconnect and missed-event recovery are defined; offline state is honest.",
        "disconnect/reconnect; blocked user; stale event; duplicate delivery; private plan; high-volume activity",
        "Partial", "Blocked",
        "BACKLOG.md and docs/signed-in-route-matrix.md:45-47 record deeper realtime/social behavior as a gap.",
        "Product/backend owner defines the minimum realtime event contract and privacy model before implementation.",
    ),
    story(
        "WEBAPP-036", "Signed-in website / browser map provider", "Apple Maps parity boundary",
        "webapp/src/discovery.tsx; DECISIONS.md",
        "As a signed-in web user, I want a reliable map, so that provider limitations never leave a blank product surface.",
        "The current attributed CARTO/OSM map remains functional; Apple branding is never faked; MapKit JS replaces it only after an approved token, service, privacy, and cost decision.",
        "missing token; tile outage; provider quota; tracking consent; unsupported browser",
        "Partial", "Blocked",
        "docs/signed-in-route-matrix.md:49-51 and passing map tests prove the working fallback; no approved MapKit JS credential/service exists.",
        "Owner decides whether to provision MapKit JS; until then retain and monitor the tested CARTO/OSM path.",
        requirement="REQ-FOUNDER-104; WEBSITE-SIGNED-IN-INVENTORY",
        security="A browser MapKit token/service and its privacy/cost boundary require explicit approval.",
    ),
    story(
        "WEBAPP-037", "Website-to-device handoff", "Universal links, recovery links, and physical share sheets",
        "AASA; browser and iOS handoff",
        "As a user moving between web and iOS, I want links and shares to open the correct delivered app state, so that the journey survives device boundaries.",
        "Installed and uninstalled universal links, recovery links, calendar files, IndexedDB persistence, and native share sheets behave on the exact delivered artifact.",
        "app absent; old build; expired recovery link; Private Browsing; storage eviction; cancelled share",
        "Implemented", "Awaiting device QA",
        "Local AASA and browser-emulation tests passed; simulator/browser emulation is not physical-device QA.",
        "Founder runs the documented physical-device matrix against the exact delivered website and iOS artifact.",
    ),
    story(
        "WEBAPP-038", "Signed-in website / live authorization", "Hosted Auth, RLS, RPC, and owner-only preview enforcement",
        "Supabase policies; Sites access control",
        "As a user, I want hosted authorization to enforce the same ownership the UI assumes, so that another account cannot read or mutate my private data.",
        "A seeded non-production account matrix proves owner/non-owner/blocked/anonymous behavior for history, plans, crews, attendance, media metadata, profile privacy, and account utilities; preview access is owner-only.",
        "expired token; anonymous request; owner mismatch; blocked pair; revoked membership; retry after timeout",
        "Partial", "Blocked",
        "Local Playwright uses mocked Supabase calls and cannot prove hosted RLS/OAuth or Sites access control.",
        "Owner provisions a seeded non-production account and authorizes read/write QA against the private preview; QA runs the RLS/account matrix without production writes.",
        defects="WEB-DEF-TEST-001; WEB-DEF-DEPLOY-001",
        security="This is the principal remaining authorization evidence gap.",
    ),
    defect(
        "WEB-DEF-MERGE-001", "Website branch integration", "Parity branch omits current reset-password browser fallback",
        "_redirects; dist/_redirects; tests/smoke.spec.ts", "High",
        "The parity branch contains all current origin/main security and recovery fixes before review or merge.",
        "The parity branch fork predates origin/main commit 006fe8d, so merging it as-is can regress /reset-password to an unsupported route.",
        "git log --left-right HEAD...origin/main; compare _redirects and smoke recovery tests.",
        "Long-lived parity work diverged while production main continued receiving fixes.",
        "Unresolved; isolated branch only; no merge or deploy performed.",
        "Merge current origin/main into the isolated QA branch, resolve docs/tests without dropping parity, then rerun the recovery suite.",
        "WEBAPP-001; WEBAPP-037",
    ),
    defect(
        "WEB-DEF-MERGE-002", "Website branch integration", "Parity branch omits confirmation-service waitlist semantics",
        "data.js; download.html; tests/smoke.spec.ts", "High",
        "The parity branch retains the current server-side join-waitlist confirmation path before review or merge.",
        "The parity branch fork predates origin/main commit 655f54a, so merging it as-is can restore direct REST insertion and weaker confirmation behavior.",
        "git log --left-right HEAD...origin/main; compare data.js and launch-access tests.",
        "Long-lived parity work diverged while production main continued receiving fixes.",
        "Unresolved; isolated branch only; no merge or deploy performed.",
        "Merge current origin/main into the isolated QA branch and rerun duplicate/outage/invalid-email waitlist tests.",
        "WEB-010; WEBAPP-001",
        security="Do not regress server-side validation/confirmation to a public direct insert.",
    ),
    defect(
        "WEB-DEF-DEPLOY-001", "Website deployment", "Main workflow deploys signed-in /app/next to production",
        ".github/workflows/deploy.yml; scripts/build-dist.sh", "High",
        "Signed-in parity remains owner-only until an explicit production release decision and access-control verification.",
        "Any non-doc push to main runs the production Cloudflare Pages deploy; repository routing does not itself enforce owner-only access to /app/next.",
        "Inspect .github/workflows/deploy.yml push trigger and dist build inclusion; no deployment was attempted.",
        "Deployment trust is attached to main, while owner-only preview access is an external Sites control.",
        "Approval required; no workflow, access-control, merge, or deployment change made.",
        "Owner chooses the release lane and approves either a non-production branch target or production launch; verify access controls before any push to main.",
        "WEBAPP-038",
        security="Accidental production exposure is a release/access-control risk.",
        test_status="Blocked", owner="Founder/Release owner",
    ),
    defect(
        "WEB-DEF-SOC-001", "Signed-in website / Friends", "Friend mutations fail silently",
        "webapp/src/parity.tsx:1575-1594", "Medium",
        "Accept, decline, and add actions expose pending, success, and actionable error states and never refresh as if a rejected write succeeded.",
        "respond() discards update/delete errors and refreshes; add() leaves the button unchanged with no explanation when insert fails.",
        "Mock a Supabase mutation error, click Accept/Decline/Add, and observe no role=alert or retry guidance.",
        "Mutation results are not checked consistently.",
        "Unresolved; safe local fix identified.",
        "Add one shared notice/pending state in FriendsPage, check mutation errors, add focused Playwright failure tests, and rerun the social suite.",
        "WEBAPP-017",
    ),
    defect(
        "WEB-DEF-SCHED-001", "Signed-in website / Festival schedule", "Saved-set mutation fails silently",
        "webapp/src/parity.tsx:1874-1880", "Medium",
        "Rejected add/remove set writes leave UI state unchanged and show an actionable error/retry.",
        "toggle() changes state only on success but provides no feedback on error.",
        "Mock my_set_times insert/delete rejection and click a set toggle.",
        "The mutation error is ignored.",
        "Unresolved; safe local fix identified.",
        "Add local notice/pending handling and one rejected-write regression test, then rerun festival tests.",
        "WEBAPP-021",
    ),
    defect(
        "WEB-DEF-LIVE-001", "Signed-in website / Live Mode", "Check-in mutation fails silently",
        "webapp/src/parity.tsx:1932-1936", "Medium",
        "Rejected check-in writes keep the user unchecked and show an actionable error.",
        "checkIn() ignores the error and leaves the user with no feedback.",
        "Mock event_checkins upsert rejection during an active event and click check in.",
        "The mutation error is ignored.",
        "Unresolved; safe local fix identified.",
        "Add pending/error state and a rejected-write regression test, then rerun Live Mode tests.",
        "WEBAPP-022",
    ),
    defect(
        "WEB-DEF-UTIL-001", "Signed-in website / Reminders and blocks", "Reminder and unblock mutations fail silently",
        "webapp/src/parity.tsx:2268-2275", "Medium",
        "Rejected reminder/unblock writes keep prior state and expose an actionable error.",
        "Both handlers refresh only on success but render no error on rejection.",
        "Mock onsale_reminders upsert or user_blocks delete rejection and activate the control.",
        "The mutation error is ignored.",
        "Unresolved; safe local fix identified.",
        "Add one utility-page notice/pending state and focused rejection tests, then rerun notification/privacy tests.",
        "WEBAPP-018; WEBAPP-023",
    ),
    defect(
        "WEB-DEF-CREW-001", "Signed-in website / Crews", "Crew membership can partially apply",
        "webapp/src/parity.tsx:1705-1717", "Medium",
        "One authorized atomic operation applies the full requested membership set or none of it.",
        "Parallel insert and delete requests can leave additions applied when removals fail, or vice versa.",
        "Edit one crew to add and remove members; reject only one of the two Supabase calls; inspect resulting server membership.",
        "The client composes a multi-write invariant without a transaction/RPC.",
        "Approval required; no backend or schema change made.",
        "Backend owner designs an authorized atomic replace-members RPC plus DB contract; obtain approval before client adoption.",
        "WEBAPP-020",
        security="Partial membership writes can produce unintended private-group access.",
        test_status="Blocked", owner="Backend/Security owner",
    ),
    defect(
        "WEB-DEF-A11Y-001", "Signed-in website / Account deletion dialog", "Modal lacks focus trap and Escape close",
        "webapp/src/App.tsx:880-917", "Medium",
        "Opening the destructive modal moves focus inside it; Tab/Shift+Tab stay inside; Escape closes when not pending; close restores invoking-button focus.",
        "The dialog has aria-modal but no keyboard focus lifecycle or Escape handler.",
        "Open Delete account, press Tab repeatedly or Escape, and observe focus can leave the dialog and Escape does not close.",
        "ARIA semantics were added without modal focus management.",
        "Unresolved; safe local accessibility fix identified.",
        "Add minimal ref/effect keyboard focus management and Playwright keyboard coverage.",
        "WEBAPP-024",
    ),
    defect(
        "WEB-DEF-A11Y-002", "Signed-in website / Combobox", "Keyboard-active option can remain off-screen",
        "webapp/src/Combobox.tsx:50-176", "Low",
        "Every ArrowUp/ArrowDown change scrolls the active option into the listbox viewport without moving DOM focus.",
        "aria-activedescendant updates, but no scrollIntoView call keeps a long-list active option visible.",
        "Open a long combobox, press ArrowDown beyond the visible rows, and inspect the list scroll position.",
        "Visual focus synchronization was omitted.",
        "Unresolved; safe local accessibility fix identified.",
        "Add an active-option ref/effect with block=nearest and a long-list keyboard test.",
        "WEBAPP-026",
    ),
    defect(
        "WEB-DEF-CI-001", "Website CI", "CI does not run the explicit TypeScript check",
        ".github/workflows/deploy.yml; package.json", "Medium",
        "Required CI rejects type errors before any production deploy.",
        "The workflow runs npm test but npm test does not invoke npm run typecheck:webapp.",
        "Compare package.json scripts with the workflow test job; local npm run typecheck:webapp passed separately.",
        "The typecheck script was added after the original CI command.",
        "CI trust-boundary approval required; no workflow change made.",
        "Repository owner approves adding npm run typecheck:webapp to the existing trusted test job; do not change runners or deploy conditions.",
        "WEBAPP-001 through WEBAPP-028",
        test_status="Blocked", owner="Repository/CI owner",
    ),
    defect(
        "WEB-DEF-TEST-001", "Signed-in website / authorization evidence", "Mocked E2E cannot prove live RLS or owner-only access",
        "tests/webapp-parity.spec.ts; Supabase; Sites access control", "Medium",
        "A seeded non-production two-account matrix proves server authorization and private preview access without production writes.",
        "Local tests intercept Supabase; no approved seeded account or connected authenticated browser was available.",
        "Review test mocks and attempt connected-browser selection; browser runtime returned no available browsers.",
        "Current deterministic coverage is intentionally isolated from hosted identity and data.",
        "Approval required; no live writes or access-control changes made.",
        "Owner provisions/authorizes a seeded non-production account and connected owner browser; QA runs owner/non-owner/blocked/anonymous cases.",
        "WEBAPP-013; WEBAPP-019; WEBAPP-020; WEBAPP-038",
        security="Hosted authorization remains unproven by client mocks.",
        test_status="Blocked", owner="Founder/Security owner",
    ),
    defect(
        "WEB-DEF-DOC-001", "Website documentation", "Parity plan lists already implemented history work as remaining",
        "docs/web-parity-plan.md", "Low",
        "Planning docs distinguish shipped/verified routes from remaining gaps.",
        "The plan predates implemented import, local media, recap, and several navigation routes.",
        "Compare docs/web-parity-plan.md with App.tsx routes and passing Playwright coverage.",
        "The planning note was not updated after later parity slices.",
        "Unresolved; safe documentation fix identified.",
        "Update the plan to point to the canonical route matrix and current gap list.",
        "WEBAPP-012 through WEBAPP-015",
    ),
    defect(
        "WEB-DEF-DEP-001", "Website dependencies", "npm audit reports a High React Router RSC advisory",
        "package-lock.json; react-router 7.18.1", "Low",
        "Production-used dependency paths have no known applicable High vulnerability.",
        "npm audit exits 1 for GHSA-qwww-vcr4-c8h2; the advisory affects unstable React Server Components APIs, while this Vite BrowserRouter app is client-only and has no RSC use.",
        "Run npm audit --json and search the app for RSC/router server APIs.",
        "The lockfile version falls in the advisory range even though the vulnerable feature is absent.",
        "Proven non-applicable to current architecture; upgrade remains maintenance work.",
        "During an approved React Router 8 migration, upgrade to >=8.3.0 and rerun build/typecheck/E2E; do not force a broad major upgrade in this defect pass.",
        "WEBAPP-001 through WEBAPP-038",
        security="Advisory is High upstream but the affected RSC feature is not used.",
        test_status="Passed", owner="Dependency owner",
    ),
    defect(
        "WEB-DEF-PERF-001", "Signed-in website / performance", "Main signed-in bundle exceeds Vite warning threshold",
        "webapp build output", "Low",
        "Signed-in routes meet an agreed real-device performance budget.",
        "npm run build:webapp emitted a 761.75 kB JavaScript chunk (215.38 kB gzip) and the >500 kB warning; no field or device regression has yet been measured.",
        "Run npm run build:webapp and inspect the Vite chunk warning.",
        "All parity routes currently compile into one main chunk.",
        "Unresolved measurement risk; no speculative split added.",
        "Measure cold load and route interaction on target desktop/mobile; only add route-level lazy loading if the agreed budget fails.",
        "WEBAPP-002 through WEBAPP-028",
    ),
    blocker(
        "WEB-BLK-BROWSER-001", "Private owner-only preview", "Connected authenticated browser verification unavailable",
        "The connected owner browser opens the preview, proves owner-only access, and captures desktop/mobile screenshots and console output.",
        "The browser runtime returned no available browser connections on 2026-07-29; standalone Playwright remained available and passed.",
        "Reconnect an owner-authenticated browser, then run the representative preview chain and capture screenshots/console without inspecting session storage.",
        "WEBAPP-002; WEBAPP-004; WEBAPP-007; WEBAPP-016; WEBAPP-038",
        "Founder/QA environment",
    ),
]


TEST_RUNS = [
    ["RUN-001", AUDIT_DATE, WEBSITE_COMMIT, "npm ci", "Passed", "Exact package-lock install completed; 43 packages."],
    ["RUN-002", AUDIT_DATE, WEBSITE_COMMIT, "npm run typecheck:webapp", "Passed", "TypeScript completed with no diagnostics."],
    ["RUN-003", AUDIT_DATE, WEBSITE_COMMIT, "npm run build:webapp", "Passed with warning", "Vite 8.1.5 built 169 modules; JS 761.75 kB / 215.38 kB gzip; >500 kB warning linked to WEB-DEF-PERF-001."],
    ["RUN-004", AUDIT_DATE, WEBSITE_COMMIT, "npm run test:sites-preview", "Passed", "Sites preview worker contract passed."],
    ["RUN-005", AUDIT_DATE, WEBSITE_COMMIT, "npm test", "Passed", "271 passed, 1 intentional mobile-project skip; desktop Chromium and mobile WebKit emulation; 55.7 s."],
    ["RUN-006", AUDIT_DATE, WEBSITE_COMMIT, "npm audit --json", "Failed / classified", "Two High audit findings map to one RSC-only React Router advisory; current client-only architecture proven non-applicable in WEB-DEF-DEP-001."],
    ["RUN-007", AUDIT_DATE, WEBSITE_COMMIT, "Connected browser selection", "Blocked", "No browser connections available; linked WEB-BLK-BROWSER-001."],
]


def validate(headers: list[str], rows: list[dict[str, str]]) -> None:
    required = [
        "ID", "Product surface", "Feature or user journey", "Module", "Dependencies",
        "User story", "Acceptance criteria", "Edge cases", "Implementation status",
        "Test type", "Test command or evidence", "Last-tested commit", "Known defects",
        "UX/accessibility issues", "Performance concerns", "Security/privacy concerns",
        "Severity", "Resolution status", "Exact next action",
    ]
    missing = [column for column in required if column not in headers]
    if missing:
        raise SystemExit(f"Missing required columns: {missing}")
    ids = [row["ID"] for row in rows]
    duplicates = sorted(id_ for id_, count in Counter(ids).items() if count > 1)
    if duplicates:
        raise SystemExit(f"Duplicate stable IDs: {duplicates}")
    story_statuses = {"Passed", "Failed", "Blocked", "Not implemented", "Awaiting device QA"}
    defects = {row["ID"] for row in rows if row["Row type"] == "Defect"}
    for row in rows:
        if row["Row type"] == "Story":
            if not re.match(r"^As an? ", row["User story"]):
                raise SystemExit(f"{row['ID']}: invalid user-story form")
            if not row["Acceptance criteria"].strip():
                raise SystemExit(f"{row['ID']}: missing acceptance criteria")
            if row["Test status"] not in story_statuses:
                raise SystemExit(f"{row['ID']}: unknown test status {row['Test status']!r}")
            if row["Test status"] == "Failed":
                linked = {part.strip() for part in re.split(r"[;,]", row["Known defects"]) if part.strip()}
                if not linked or not linked.issubset(defects):
                    raise SystemExit(f"{row['ID']}: failed story lacks a valid linked defect")
            if row["Test status"] in {"Blocked", "Not implemented", "Awaiting device QA"} and not row["Exact next action"].strip():
                raise SystemExit(f"{row['ID']}: blocked story lacks exact next action")


def xml_text(value: object) -> str:
    text = "" if value is None else str(value)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)[:32767]
    return escape(text)


def column_name(index: int) -> str:
    name = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        name = chr(65 + remainder) + name
    return name


def worksheet_xml(table: list[list[object]], *, filter_row: bool = True) -> str:
    width = max((len(row) for row in table), default=1)
    height = max(len(table), 1)
    rows_xml = []
    for row_index, row in enumerate(table, 1):
        cells = []
        for column_index, value in enumerate(row, 1):
            ref = f"{column_name(column_index)}{row_index}"
            style = 1 if row_index == 1 else 2
            cells.append(
                f'<c r="{ref}" s="{style}" t="inlineStr"><is><t xml:space="preserve">'
                f"{xml_text(value)}</t></is></c>"
            )
        rows_xml.append(f'<row r="{row_index}">{"".join(cells)}</row>')
    auto_filter = f'<autoFilter ref="A1:{column_name(width)}{height}"/>' if filter_row and height else ""
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" '
        'activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        '<cols>' + "".join(
            f'<col min="{i}" max="{i}" width="{55 if i > 1 else 20}" customWidth="1"/>'
            for i in range(1, width + 1)
        ) + '</cols>'
        f'<sheetData>{"".join(rows_xml)}</sheetData>{auto_filter}</worksheet>'
    )


def write_xlsx(rows: list[dict[str, str]], headers: list[str]) -> None:
    stories = [row for row in rows if row["Row type"] == "Story"]
    issues = [row for row in rows if row["Row type"] in {"Defect", "Blocker"}]
    status = Counter(row["Test status"] for row in stories)
    severity = Counter(row["Severity"] for row in issues)
    summary = [
        ["Drop Website QA feature matrix", ""],
        ["Audited website commit", WEBSITE_COMMIT],
        ["Audited mobile commit", MOBILE_COMMIT],
        ["Audit date", AUDIT_DATE],
        ["Total stories", len(stories)],
        ["Passed", status["Passed"]],
        ["Failed", status["Failed"]],
        ["Blocked", status["Blocked"]],
        ["Not implemented", status["Not implemented"]],
        ["Awaiting device QA", status["Awaiting device QA"]],
        ["Critical issues", severity["Critical"]],
        ["High issues", severity["High"]],
        ["Medium issues", severity["Medium"]],
        ["Low issues", severity["Low"]],
        ["Reconciliation", (
            f"{len(stories)} = {status['Passed']} + {status['Failed']} + "
            f"{status['Blocked']} + {status['Not implemented']} + {status['Awaiting device QA']}"
        )],
        ["Evidence note", "Founder wording and sanitized Apple feedback are preserved in the canonical CSV rows; unavailable raw Apple comments are never reconstructed."],
    ]
    matrix = [headers] + [[row.get(header, "") for header in headers] for row in rows]
    story_table = [headers] + [[row.get(header, "") for header in headers] for row in stories]
    issue_table = [headers] + [[row.get(header, "") for header in headers] for row in issues]
    test_table = [["Run ID", "Date", "Commit", "Command", "Result", "Evidence"], *TEST_RUNS]
    changes = [
        ["Version", "Date", "Change", "Evidence boundary"],
        ["Inventory v1", AUDIT_DATE, "Reused the 616-row mobile requirements register and appended signed-in website stories, defects, blockers, and current deterministic runs.", "No production writes, deploys, secret writes, CI changes, or raw Apple reconstruction."],
    ]
    sheets = [
        ("Summary", summary, False),
        ("Feature Matrix", matrix, True),
        ("Stories", story_table, True),
        ("Defects and Blockers", issue_table, True),
        ("Test Runs", test_table, True),
        ("Change Log", changes, True),
    ]
    content_types = [
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
        '<Default Extension="xml" ContentType="application/xml"/>',
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    ]
    for index in range(1, len(sheets) + 1):
        content_types.append(
            f'<Override PartName="/xl/worksheets/sheet{index}.xml" '
            'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        )
    content_types.append("</Types>")
    workbook = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets>' + "".join(
            f'<sheet name="{escape(name)}" sheetId="{index}" r:id="rId{index}"/>'
            for index, (name, _, _) in enumerate(sheets, 1)
        ) + '</sheets></workbook>'
    )
    workbook_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + "".join(
            f'<Relationship Id="rId{index}" '
            'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
            f'Target="worksheets/sheet{index}.xml"/>'
            for index in range(1, len(sheets) + 1)
        )
        + f'<Relationship Id="rId{len(sheets) + 1}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" '
        'Target="styles.xml"/></Relationships>'
    )
    styles = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<fonts count="2"><font><sz val="11"/><name val="Aptos"/></font>'
        '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts>'
        '<fills count="3"><fill><patternFill patternType="none"/></fill>'
        '<fill><patternFill patternType="gray125"/></fill>'
        '<fill><patternFill patternType="solid"><fgColor rgb="FF472C87"/><bgColor indexed="64"/></patternFill></fill></fills>'
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>'
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>'
        '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
    )
    root_rels = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="xl/workbook.xml"/></Relationships>'
    )
    with ZipFile(XLSX_PATH, "w", ZIP_DEFLATED) as workbook_zip:
        workbook_zip.writestr("[Content_Types].xml", "".join(content_types))
        workbook_zip.writestr("_rels/.rels", root_rels)
        workbook_zip.writestr("xl/workbook.xml", workbook)
        workbook_zip.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        workbook_zip.writestr("xl/styles.xml", styles)
        for index, (_, table, filter_row) in enumerate(sheets, 1):
            workbook_zip.writestr(f"xl/worksheets/sheet{index}.xml", worksheet_xml(table, filter_row=filter_row))


def main() -> None:
    with CSV_PATH.open(newline="", encoding="utf-8") as source:
        reader = csv.DictReader(source)
        headers = list(reader.fieldnames or [])
        rows = list(reader)
    by_id = {row["ID"]: row for row in rows}
    for row in WEBSITE_ROWS:
        by_id[row["ID"]] = {header: row.get(header, "") for header in headers}
    combined = list(by_id.values())
    validate(headers, combined)
    with CSV_PATH.open("w", newline="", encoding="utf-8") as destination:
        writer = csv.DictWriter(destination, fieldnames=headers, lineterminator="\n")
        writer.writeheader()
        writer.writerows(combined)
    write_xlsx(combined, headers)
    story_counts = Counter(row["Test status"] for row in combined if row["Row type"] == "Story")
    total = sum(story_counts.values())
    print(
        f"Wrote {len(combined)} rows and {XLSX_PATH.name}; stories {total} = "
        f"{story_counts['Passed']} passed + {story_counts['Failed']} failed + "
        f"{story_counts['Blocked']} blocked + {story_counts['Not implemented']} not implemented + "
        f"{story_counts['Awaiting device QA']} awaiting device QA"
    )


if __name__ == "__main__":
    main()
