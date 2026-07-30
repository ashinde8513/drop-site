#!/usr/bin/env python3
"""Validate the canonical signed-in website QA CSV and build its XLSX mirror."""

from __future__ import annotations

import csv
import hashlib
import re
from collections import Counter
from html import escape
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = ROOT / "docs/qa/feature-matrix.csv"
XLSX_PATH = ROOT / "docs/qa/drop-website-feature-matrix.xlsx"
BASELINE_WEBSITE_COMMIT = "25512a5c966dbc0ad93302291b768c19cea554ca"
PRIOR_WEBSITE_COMMIT = "236b665fd73f97eaef39c9884addf49240b34aef"
WEBSITE_COMMIT = "34630b592d6923760019dc0f0c227c10a58ce064"
MOBILE_COMMIT = "94d6b68f2a3541ba956e39d1b51368a6c38b540b"
HOSTED_EVIDENCE_COMMIT = "105b2d2e83e3373103da71c6b87bfc1ed7ae0608"
PRODUCTION_EVIDENCE_COMMIT = "712bd97cbed680bf0ec38da48a5c538a82e5f190"
QA_TOOLING_COMMIT = "2cb72e3e8b4964a193178429aeae952ae67ae8e0"
AUDIT_DATE = "2026-07-29"


TEST_RUNS = [
    ["RUN-001", AUDIT_DATE, BASELINE_WEBSITE_COMMIT, "npm ci", "Passed", "Exact package-lock install completed; 43 packages."],
    ["RUN-002", AUDIT_DATE, BASELINE_WEBSITE_COMMIT, "npm run typecheck:webapp", "Passed", "TypeScript completed with no diagnostics."],
    ["RUN-003", AUDIT_DATE, BASELINE_WEBSITE_COMMIT, "npm run build:webapp", "Passed with warning", "Vite 8.1.5 built 169 modules; JS 761.75 kB / 215.38 kB gzip; >500 kB warning linked to WEB-DEF-PERF-001."],
    ["RUN-004", AUDIT_DATE, BASELINE_WEBSITE_COMMIT, "npm run test:sites-preview", "Passed", "Sites preview worker contract passed."],
    ["RUN-005", AUDIT_DATE, BASELINE_WEBSITE_COMMIT, "npm test", "Passed", "271 passed, 1 intentional mobile-project skip; desktop Chromium and mobile WebKit emulation; 55.7 s."],
    ["RUN-006", AUDIT_DATE, BASELINE_WEBSITE_COMMIT, "npm audit --json", "Failed / classified", "Two High audit findings map to one RSC-only React Router advisory; current client-only architecture proven non-applicable in WEB-DEF-DEP-001."],
    ["RUN-007", AUDIT_DATE, BASELINE_WEBSITE_COMMIT, "Connected browser selection", "Blocked", "No browser connections available; linked WEB-BLK-BROWSER-001."],
    ["RUN-008", AUDIT_DATE, "03c08a5785ea9423b1c3778e1381cd8a9c4f4a9b", "npx playwright test tests/smoke.spec.ts", "Passed", "104 public-site checks passed after merging current origin/main; password recovery and join-waitlist confirmation fixes retained."],
    ["RUN-009", AUDIT_DATE, PRIOR_WEBSITE_COMMIT, "Focused review regression selection", "Passed", "Friend exact-row acceptance, server-time check-in payload, atomic crew success/error, rejected writes, routing, combobox, and modal regressions passed in desktop Chromium and mobile WebKit; final coverage is superseded by RUN-012."],
    ["RUN-010", AUDIT_DATE, PRIOR_WEBSITE_COMMIT, "npm run typecheck:webapp", "Passed", "TypeScript completed with no diagnostics after the review fixes."],
    ["RUN-011", AUDIT_DATE, PRIOR_WEBSITE_COMMIT, "npm run build:webapp", "Passed with warning", "Vite 8.1.5 built 169 modules; JS 764.85 kB / 216.08 kB gzip; >500 kB warning remains WEB-DEF-PERF-001."],
    ["RUN-012", AUDIT_DATE, PRIOR_WEBSITE_COMMIT, "npm test", "Passed", "Sites preview worker passed; Playwright 295 passed and 1 intentional mobile-project skip across desktop Chromium and mobile WebKit in 53.8 s."],
    ["RUN-013", AUDIT_DATE, PRIOR_WEBSITE_COMMIT, "git diff --check", "Passed", "No whitespace errors after the verified behavior changes."],
    ["RUN-014", AUDIT_DATE, WEBSITE_COMMIT, "! rg -n 'unstable_RSC|RSCPayload|react-server-dom|routeRSCServerRequest|createFromReadableStream' webapp package.json package-lock.json", "Passed", "No React Router RSC runtime path exists in the client-only Vite/BrowserRouter app; supports WEB-DEF-DEP-001 applicability classification."],
    ["RUN-015", AUDIT_DATE, MOBILE_COMMIT, "mobile typecheck + quiet lint + 524 units + 10 PGlite contracts", "Passed", "Recipient/pending friendship, server-time authored/fallback check-ins, friend/nonfriend/reverse-block visibility, and atomic crew rollback passed with exact migration 20260729182349_social_mutation_contracts.sql; no hosted apply."],
    ["RUN-016", AUDIT_DATE, "58a6ff4744baab813cbc77b153235303785f4952", "Connected Browser owner-preview smoke", "Passed / partial boundary", "Owner-authenticated v10 rendered Discover at the private preview with zero console warnings/errors; Supabase dashboard showed production main only and no preview/persistent branches. Non-owner/blocked hosted access remains untested."],
    ["RUN-017", AUDIT_DATE, HOSTED_EVIDENCE_COMMIT, "Supabase QA project apply + hosted SQL authorization/rollback matrix + catalog/residue/advisor readback", "Passed / production approval boundary", "Exact migration SHA-256 3c3857ed…431e89f applied only to QA project jrlqozbbrbivmzazuaic. Fourteen anonymous/requester/recipient/owner/non-owner/friend/nonfriend/both-block-direction/time-window/dedupe/rollback checks passed twice; fixture counts are zero; advisor ERROR count is zero. Production ebccwnkmsnhbljxxxdej is unchanged."],
    ["RUN-018", AUDIT_DATE, PRODUCTION_EVIDENCE_COMMIT, "Exact production apply + migration/catalog/grant/function/project/advisor readback", "Passed / client-release boundary", "Founder-approved exact SHA-256 3c3857ed…431e89f applied once to production ebccwnkmsnhbljxxxdej as version 20260729200633, name v20260729182349_social_mutation_contracts. Recipient/pending policies, old-policy removal, RLS, status-only grant, server-time/window trigger, either-direction block policy, authenticated-only fixed-search-path crew RPC, project health, and zero advisor ERRORs read back. Migration apply executed no application-row DML; verification queried catalogs only; clients remain unreleased."],
    ["RUN-019", AUDIT_DATE, PRIOR_WEBSITE_COMMIT, "final npm run typecheck:webapp + npm run build:webapp + npm test", "Passed", "TypeScript and Vite production build passed; Playwright rerun passed 295 with 1 intentional mobile-project skip in 55.2 s. The first unprivileged attempt stopped before tests because the sandbox blocked its localhost server; the approved localhost rerun passed."],
    ["RUN-020", AUDIT_DATE, MOBILE_COMMIT, "mobile typecheck + quiet lint + 529 units + focused accessibility contracts + PGlite social contracts + iOS Simulator build/run", "Passed", "Exact mobile candidate passed typecheck, quiet lint, 529 unit tests including three accessibility contracts, the 10-case social contract test, and an iOS 26.5 Simulator build/run. Crew, report/block, unblock, and member-checkbox controls expose explicit assistive roles/names/states."],
    ["RUN-021", AUDIT_DATE, MOBILE_COMMIT, "approved production-account client journey + catalog/residue readback", "Passed / scoped authorization", "Using approved e2ewebqa, ashinde8513, and ravewithmaya accounts, mobile block hid the blocked profile, reverse website profile access was denied, unblock restored it, and a temporary crew was created/deleted. Final readback restored both accepted friendships, zero blocks, the original Bass Squad membership, and zero temporary crews. No production test residue remains."],
    ["RUN-022", AUDIT_DATE, PRIOR_WEBSITE_COMMIT, "Connected Browser desktop/mobile candidate navigation and accessibility journey", "Passed", "Desktop/mobile Discover alignment and uniform cards, carousel controls/touch-scroll surface/keyboard snapping, searchable location/search combobox empty/Arrow/Enter/Escape states, website-native event detail, Stats show/artist/venue/city drill-downs, map empty state, and zero browser warnings/errors passed."],
    ["RUN-023", AUDIT_DATE, WEBSITE_COMMIT, "npm run typecheck:webapp + npm run build:webapp + npm test + focused mobile WebKit repetition", "Passed", "After CI exposed a WebKit focus-order race, the shared delete dialog moves focus before disabling its controls. TypeScript and Vite production build passed; Playwright passed 295 with 1 intentional mobile-project skip. The deletion regression passed 20/20 and the previously flaky event-action regression passed 20/20 under six-worker CI-style WebKit load."],
    ["RUN-024", AUDIT_DATE, "website 7162be246177b646ff7c28dc4b0fec004d7e1e0f; mobile 21ce9b618979f298374d21c232bb3e04f92d7e6b", "Authorized Drop-App merge + owner-only Sites v12 deploy + live browser/access/log and runtime verification", "Passed / native-build boundary", "PR #290 exact head 16f9463 merged with a merge commit; main and release-train-31-21ce9b6 resolve to 21ce9b6; release-train, closeout, and tagged web-deploy passed. Sites v12 exact source 7162be2 deployed with custom access only for ashinde8513@gmail.com. Desktop/mobile event, combobox, Profile/Stats/history, console/page-error, and Worker-error checks passed. Release-ref preflight passed, but exact-tag runtime a904ccc60ecf3ff7ab907769b1cdfc7281592806 differs from latest production iOS build b913963d-23ef-4575-ac5c-aa8e2726d58e runtime d42ed9dc7445172d9d0ca08124fd0443d0eaa433, so OTA is blocked and a separately authorized native build is required."],
    ["RUN-025", AUDIT_DATE, "a91098abfdb7d24c96dac9cfcedd2c9a857c7bcf", "Local npm test + GitHub Actions run 30517391362 attempts 1 and 2", "Passed locally and on CI retry / flake classified", "Exact head passed locally 295 with 1 intentional skip in 54.7 seconds. CI attempt 1 ended 281 passed, 4 flaky, 10 failed, and 1 skip after mobile WebKit timeouts under five workers. The single non-deploying failed-job retry succeeded 292 passed, 3 flaky, and 1 skip. WEB-DEF-CI-FLAKE-001 retains the approval-required worker-cap action; no workflow or trust-boundary change was made."],
    ["RUN-026", AUDIT_DATE, QA_TOOLING_COMMIT, "Two generator runs + SHA-256 equality + XML/CSV comparison + unzip -t", "Passed", "Unchanged canonical CSV produced identical XLSX SHA-256 6d0826d7264da70235b9095b46f004045372a38d93cb90b294cf51a7b04af04b across consecutive runs. All archive XML parsed, the Feature Matrix sheet equaled every CSV row, and unzip integrity passed."],
]


def validate(headers: list[str], rows: list[dict[str, str]]) -> None:
    required = [
        "ID", "Product surface", "Feature or user journey", "Module", "Dependencies",
        "User story", "Acceptance criteria", "Edge cases", "Implementation status",
        "Test type", "Test command or evidence", "Evidence Run ID", "Last-tested commit", "Known defects",
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
    run_ids = [run[0] for run in TEST_RUNS]
    duplicate_runs = sorted(id_ for id_, count in Counter(run_ids).items() if count > 1)
    if duplicate_runs:
        raise SystemExit(f"Duplicate test run IDs: {duplicate_runs}")
    runs = {run[0]: run for run in TEST_RUNS}
    story_statuses = {"Passed", "Failed", "Blocked", "Not implemented", "Awaiting device QA"}
    requirement_statuses = {"Implemented", "Partial", "Missing", "Deprecated", "Duplicate", "Conflicting", "Needs clarification"}
    defects = {row["ID"] for row in rows if row["Row type"] == "Defect"}
    website_ids = {
        row["ID"]
        for row in rows
        if row["ID"].startswith(("WEBAPP-", "WEB-DEF-", "WEB-BLK-"))
    }
    production_backend_rows = {"WEB-DEF-FRIEND-AUTH-001", "WEB-DEF-CHECKIN-AUTH-001"}
    mobile_candidate_rows = {"WEB-DEF-MOBILE-A11Y-001"}
    qa_tooling_rows = {"WEB-DEF-QA-XLSX-001"}
    requirement_ids: set[str] = set()
    requirements_with_wording: set[str] = set()
    for row in rows:
        linked_requirements = {
            item.strip()
            for item in row["Requirement ID"].split(";")
            if item.strip().startswith(("REQ-FOUNDER-", "REQ-ASC-"))
        }
        requirement_ids.update(linked_requirements)
        if row["Original requirement wording"].strip():
            requirements_with_wording.update(linked_requirements)
            digest = row["Original wording SHA-256"].replace(" ", "")
            wording = row["Original requirement wording"]
            # Spreadsheet-safe founder bullets are stored as "'- …"; the hash covers the source "- …".
            normalized_wording = wording[1:] if re.match(r"^'\s*- ", wording) else wording
            if not re.fullmatch(r"[0-9a-f]{64}", digest) or digest != hashlib.sha256(normalized_wording.encode()).hexdigest():
                raise SystemExit(f"{row['ID']}: preserved wording SHA-256 mismatch")
            if row["Implementation status"] not in requirement_statuses:
                raise SystemExit(f"{row['ID']}: invalid requirement classification {row['Implementation status']!r}")
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
        expected_commit = (
            QA_TOOLING_COMMIT if row["ID"] in qa_tooling_rows
            else PRODUCTION_EVIDENCE_COMMIT if row["ID"] in production_backend_rows
            else MOBILE_COMMIT if row["ID"] in mobile_candidate_rows
            else WEBSITE_COMMIT
        )
        if row["ID"] in website_ids and row["Test status"] == "Passed" and row["Last-tested commit"] != expected_commit:
            raise SystemExit(f"{row['ID']}: passed website row is not tied to the audited evidence commit")
        if row["ID"] in website_ids and row["Test status"] == "Passed":
            run_id = row["Evidence Run ID"].strip()
            run = runs.get(run_id)
            if not run or not run[4].startswith("Passed") or run[2] != row["Last-tested commit"]:
                raise SystemExit(f"{row['ID']}: invalid same-commit passing Evidence Run ID {run_id!r}")
            expected_run = (
                "RUN-026" if row["ID"] in qa_tooling_rows
                else "RUN-018" if row["ID"] in production_backend_rows
                else "RUN-020" if row["ID"] in mobile_candidate_rows
                else "RUN-014" if row["ID"] == "WEB-DEF-DEP-001"
                else "RUN-023"
            )
            if run_id != expected_run:
                raise SystemExit(f"{row['ID']}: Evidence Run ID {run_id!r} is not suitable; expected {expected_run}")
        if row["ID"] in website_ids and row["Row type"] == "Defect" and row["Resolution status"].startswith("Fixed"):
            if row["Test status"] != "Passed" or row["Last-tested commit"] != expected_commit:
                raise SystemExit(f"{row['ID']}: fixed defect lacks same-commit passing evidence")
    missing_wording = sorted(requirement_ids - requirements_with_wording)
    if missing_wording:
        raise SystemExit(f"Requirements lack preserved original wording: {missing_wording}")


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


def write_zip_member(archive: ZipFile, name: str, content: str) -> None:
    info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = ZIP_DEFLATED
    info.create_system = 3
    info.external_attr = 0o600 << 16
    archive.writestr(info, content)


def write_xlsx(rows: list[dict[str, str]], headers: list[str]) -> None:
    stories = [row for row in rows if row["Row type"] == "Story"]
    issues = [row for row in rows if row["Row type"] in {"Defect", "Blocker"}]
    status = Counter(row["Test status"] for row in stories)
    severity = Counter(row["Severity"] for row in issues)
    summary = [
        ["Drop Website QA feature matrix", ""],
        ["Audited website commit", WEBSITE_COMMIT],
        ["Audited mobile commit", MOBILE_COMMIT],
        ["Hosted Supabase evidence commit", HOSTED_EVIDENCE_COMMIT],
        ["Production Supabase evidence commit", PRODUCTION_EVIDENCE_COMMIT],
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
        ["Inventory v2", AUDIT_DATE, "Merged current origin/main, fixed and regression-tested safe client defects, added server authorization findings, preserved baseline runs, and tied fixed/pass rows to exact commit evidence.", "No production writes, deploys, backend/auth/privacy changes, secret writes, CI changes, or raw Apple reconstruction."],
        ["Inventory v3", AUDIT_DATE, "Recorded isolated hosted Supabase social authorization evidence, zero-residue rollback proof, and the separate exact production approval boundary.", "QA project only; production, Auth settings, secrets, clients, preview deployment, and raw Apple evidence unchanged."],
        ["Inventory v4", AUDIT_DATE, "Recorded the exact production social-contract migration version and catalog/grant/function/advisor readback; reclassified the two server-enforced High defects as fixed while retaining client/browser release blockers.", "Exact approved schema/policy change only; no production application-row DML executed, Auth/secret change, client merge, OTA, Sites deployment, App Store action, or raw Apple reconstruction."],
        ["Inventory v5", AUDIT_DATE, "Recorded exact Drop-App PR #290 merge/tag automation and owner-only Sites v12 delivery/live verification; replaced completed authorization gates with current native-build and connected-journey actions.", "No OTA, production website merge/deploy, Auth/secret change, production data mutation, CI trust-boundary change, or raw Apple reconstruction."],
        ["Inventory v6", AUDIT_DATE, "Recorded the exact local pass, initial GitHub-hosted WebKit timeout failure, successful single retry, and approval-required CI stabilization defect.", "No workflow, runner, trust-boundary, deployment, production, Auth, secret, or application-data change."],
        ["Inventory v7", AUDIT_DATE, "Recorded and verified deterministic dependency-free XLSX generation from the canonical CSV.", "QA tooling only; no runtime, workflow, runner, deployment, production, Auth, secret, or application-data change."],
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
    with ZipFile(XLSX_PATH, "w") as workbook_zip:
        write_zip_member(workbook_zip, "[Content_Types].xml", "".join(content_types))
        write_zip_member(workbook_zip, "_rels/.rels", root_rels)
        write_zip_member(workbook_zip, "xl/workbook.xml", workbook)
        write_zip_member(workbook_zip, "xl/_rels/workbook.xml.rels", workbook_rels)
        write_zip_member(workbook_zip, "xl/styles.xml", styles)
        for index, (_, table, filter_row) in enumerate(sheets, 1):
            write_zip_member(
                workbook_zip,
                f"xl/worksheets/sheet{index}.xml",
                worksheet_xml(table, filter_row=filter_row),
            )


def main() -> None:
    with CSV_PATH.open(newline="", encoding="utf-8") as source:
        reader = csv.DictReader(source)
        headers = list(reader.fieldnames or [])
        rows = list(reader)
    validate(headers, rows)
    write_xlsx(rows, headers)
    story_counts = Counter(row["Test status"] for row in rows if row["Row type"] == "Story")
    total = sum(story_counts.values())
    print(
        f"Wrote {len(rows)} rows and {XLSX_PATH.name}; stories {total} = "
        f"{story_counts['Passed']} passed + {story_counts['Failed']} failed + "
        f"{story_counts['Blocked']} blocked + {story_counts['Not implemented']} not implemented + "
        f"{story_counts['Awaiting device QA']} awaiting device QA"
    )


if __name__ == "__main__":
    main()
