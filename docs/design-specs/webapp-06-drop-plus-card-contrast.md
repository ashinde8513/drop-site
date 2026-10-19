# Spec 06: Drop+ plan card contrast fix

Status: prepared, awaiting design. Written 2026-10-19. Docs only, nothing built.

## Claude design project header
- Project: **Drop Website** (`5b6f000f-c206-44b6-ab8a-5981e36f2af9`)
- Suggested screen names: `Drop+ / Plan cards (contrast fix)`, with before/after for selected and unselected, desktop and mobile.
- Extends: the existing DROP+ PAYWALL screen in `index.html` (the two plan cards "Annual" and "Monthly", built in `app.js` around the `plusPlans` array) and, if the token route is chosen, `app/tokens.css` (auto-generated from `prism-tokens/palette.json`; edits belong in `palette.json`).

## Purpose and user value
Automated accessibility test (axe-core, 2026-10-19 webapp audit, section 4) reports a `color-contrast` serious failure, 3 nodes, on the Drop+ plan cards: selector `button:nth-child(n) > div > div:nth-child(1)`. The audit's guess was "`--text-muted` on `--surface-hi`", but it asks to "confirm the exact pair in browser before editing". Fixing it helps low-vision users read the price and plan names, and removes the last serious contrast finding from the audit. Drop+ checkout is "coming soon" in native and web alike; this spec only fixes legibility, it does not add purchase behavior.

## What the markup really uses (read from `index.html` lines ~2321-2328 and `app.js` ~2710-2715)
- Card is a `<button>` with background `var(--surface)` (unselected) or `rgba(77,226,255,0.08)` (selected: 8% cyan, TRANSLUCENT), border 2px.
- Plan name (the failing selector's first child: `div > div:nth-child(1)`) is a plain `div` with the display font, bold, and **no explicit color**. A `<button>` does not inherit text color by default; the browser's default button text color applies. `site.css` only sets `button { font: inherit }`, no color. If the browser default is dark (black) on a near-black card, that alone would fail at about 1.2:1; if the page declares a dark `color-scheme` the default is white and passes. Which of these happens must be confirmed in the browser; I did not run it.
- Caption (second child): `--text-muted` `#7C8597` at 12px.
- Badge: `--ink` text on `--attended` lime.
- The paywall page sits over two blurred glow circles: magenta `rgba(226,77,255,0.24)` (top-left) and lime `rgba(182,255,106,0.18)` (bottom-right). The selected card's translucent fill lets glow through, so the real background behind the caption varies.

Status of that: **unverified in a browser**. Everything below is computed from the token hex values with the WCAG 2.x relative luminance formula (script run in this session). Ratios are rounded to two decimals.

## Measured ratios (WCAG 2.x, computed)
Token values: `--ink #0B0D12`, `--surface #14161D`, `--surface-alt #1C1F28`, `--surface-hi #262A35`, `--text #FFFFFF`, `--text-secondary/--text-dim #C4CCD8`, `--text-muted/--text-mute #7C8597`, `--accent/--brand-cyan #4DE2FF`.

Backgrounds for the card:
- Unselected: `--surface` `#14161D`.
- Selected over plain `--ink`: 8% cyan over `#0B0D12` = `#101E25`.
- Selected over `--surface`: `#19262F`.
- Selected over peak magenta glow (0.24 over ink = `#3F1C4B`, then 8% cyan) = `#402C59` (worst case, near the glow centre; the card is probably not at the centre, so reality lies between `#101E25` and this).

| Text | on `--surface` | on selected over ink `#101E25` | on selected over `--surface` `#19262F` | on selected over peak glow `#402C59` | on `--surface-alt` | on `--surface-hi` |
|---|---|---|---|---|---|---|
| `--text` white | 18.07 | 17.01 | 15.45 | 12.19 | 16.46 | 14.33 |
| `--text-secondary` `#C4CCD8` | 11.16 | 10.51 | 9.54 | 7.53 | 10.17 | 8.86 |
| `--text-muted` `#7C8597` | **4.87** | **4.58** | 4.16 (fail) | 3.29 (fail) | 4.43 (fail) | 3.86 (fail) |
| `--accent` cyan | 11.73 | 11.05 | 10.03 | n/a | 10.69 | 9.31 |
| `--danger` | 6.05 | 5.69 | 5.17 | n/a | 5.51 | 4.80 |
| UA default button black `#000` | 1.16 | 1.23 | n/a | n/a | n/a | n/a |

Other measured pairs: `--ink` on lime badge 16.2; `--text-muted` on `--ink` 5.24; `--text-muted` on glass-over-ink `rgba(255,255,255,0.08)` 4.38 (fail, also an issue for `.chip` captions on glass); white on `--danger` 2.99 (fail; existing `.btn--danger` correctly uses ink at 6.5).
Targets: normal text 4.5:1, large text (18.66px bold or 24px) and UI component borders 3:1. The caption is 12px so it needs 4.5.

Reading of the table: the 12px muted caption passes on the unselected card and the plain selected card, narrowly (4.87 and 4.58), but fails on `--surface-alt`, `--surface-hi`, and wherever the selected card's translucent fill sits over glow (3.29 at worst). That is a plausible match for "3 nodes" (captions or titles on the selected card in some state), consistent with the audit's suspicion of `--surface-hi`. The plan name could also be failing for the default-button-color reason. Treat both as candidates until confirmed.

## Fix options (designer chooses one; recommendation below)
**Option A, local, no token change (recommended).**
1. Give the plan name an explicit color: `color: var(--text)` on the card (not left to the button default). Result 12.19 to 18.07.
2. Switch the caption from `--text-muted` to `--text-secondary`. Result at least 7.53 in the worst case. Keep size 12px (`--fs-xs`).
3. Make the selected fill opaque: instead of `rgba(77,226,255,0.08)`, use the solid `#101E25` (new local value, or a token `--accent-glass-solid`) so glow cannot lower contrast. Check: caption 4.58 would pass even unchanged, but with step 2 it is 10.51.
Visual change: caption gets lighter; hierarchy still holds because name is white and bold at `--fs-md`.

**Option B, token change: raise `--text-mute` globally.**
Change `--text-mute` in `palette.json` (then run its sync to regenerate `tokens.css`). Computed candidates:
| Candidate | on `--ink` | on `--surface` | on `--surface-alt` | on `--surface-hi` | on selected `#101E25` | on selected `#19262F` | on peak glow `#402C59` |
|---|---|---|---|---|---|---|---|
| `#7C8597` (today) | 5.24 | 4.87 | 4.43 | 3.86 | 4.58 | 4.16 | 3.29 |
| `#8C95A6` | 6.45 | 5.99 | 5.46 | 4.75 | 5.64 | 5.12 | 4.04 |
| `#939CAD` | 7.03 | 6.54 | 5.96 | 5.19 | 6.16 | 5.59 | 4.41 |
| `#9AA3B3` | 7.65 | 7.11 | 6.48 | 5.64 | 6.69 | 6.08 | 4.80 |
| `#A0A8B8` | 8.13 | 7.56 | 6.89 | 6.00 | 7.12 | 6.46 | n/a |
`#9AA3B3` is the smallest tested value that passes everywhere including the glow worst case (4.80) and `--surface-hi` (5.64). Cost: touches every use of muted text in web and, because the file is synced to the app's `primitives.ts` and `drop-website/site.css`, the native app too. Muted vs secondary then gets close (`#9AA3B3` vs `#C4CCD8`), so check hierarchy sitewide. This is a brand decision; do not do it for one card.

**Option C, background change.** Keep `--text-muted` but move the cards to `--surface` always (selected state uses the 2px `--accent` border plus a check mark, no tinted fill). Muted passes at 4.87. Cheap, but weakens the selected state; keep the border at least 3:1 against the page (cyan on ink is 12.62) and keep the check as a non-color cue.

**Recommendation:** Option A, plus confirm in a browser whether the plan name was rendering black. A global token change (Option B) is worth a separate, deliberate design pass.

## Backend contract that already exists
None. Drop+ has no checkout; the pricing text is static, and the primary button's label currently reads "Start annual: $59.99/yr" while the footnote says "Payments coming soon". Per the parity doc "Do not chase" list, native also says "Drop+ coming soon", so the web button copy should stop implying a purchase.

## States
1. **Loading**: not applicable (static content). If plans are ever loaded dynamically, skeleton cards of the same 2-row shape (`skel--title`, `skel--text`).
2. **Unselected card**, 3. **Selected card**, 4. **Focused card** (keyboard focus ring in `--accent`, 2px offset, at least 3:1), 5. **Hover** (border `--border-strong`), 6. **Pressed**. Disabled/error/success do not apply.
Each state must be shown with measured text contrast annotated.

## Layout, desktop (1024 and up)
Unchanged geometry: column max 520px centered; cards stacked with 8px gap; card padding `--sp-lg`; radius `--r-lg` (20px); radio dot 22px at left; plan name (display font, bold, `--fs-md`) with caption below; "Save 33%" badge right (ink on lime, 10px bold; consider 11px for legibility, still 16.2:1).
Fix elements: name `color: var(--text)`; caption `color: var(--text-secondary)`; selected fill solid `#101E25`; border selected `--accent` 2px.
The price in the caption is the key data: consider making the price the largest element in the card (price bold `--fs-lg`, "per year" small and quiet), per the data hierarchy rule. Only if copy changes are approved (see below).

## Layout, mobile (430 and below)
Same card, full width with 16px gutters. Primary button "Continue" stays full width at the bottom of the viewport region (thumb zone); it is the only primary on the page. Cards remain at least 64px tall for touch.

## Copy
Keep existing plan names ("Annual", "Monthly"), badge ("Save 33%"). Recommended honest changes (need copy-owner sign-off):
- Primary button: "Continue with Annual" / "Continue with Monthly" (instead of "Start annual: $59.99/yr", which implies a purchase that does not exist), because payments are not live.
- Footnote: "Cancel anytime. Earn free time back with referrals. Payments aren't available yet." (replaces "Payments coming soon" which implies a date).
- Do not invent savings math: "$5.00 per month" for annual is $59.99/12 = $5.00 (rounded; correct) and "Save 33%" vs $7.49 x 12 = $89.88 is 33.3% (correct).

## Accessibility
- Cards are a radio group: `role="radiogroup"` with name "Choose a plan"; each card `role="radio"` `aria-checked`. Today they are plain buttons with the selection shown only visually plus a check; announce selected state.
- Visible focus ring on cards, at least 3:1 against both card and page.
- Selected state must not rely on color alone: border thickness, the check mark in the dot, and `aria-checked` all convey it (already mostly true; keep the check).
- Contrast targets: name and caption at least 4.5:1 in every state, measured against the real (rendered) background including glow; badge text at least 4.5:1 (16.2 today).
- Re-run axe on the Drop+ screen at 1280x800 and 390x844 after the change; target zero `color-contrast` nodes.

## Out of scope
- Real checkout, StoreKit, Stripe, pricing changes, trial logic.
- Wallet screen, cashback.
- Sitewide token redesign (Option B only if explicitly chosen as its own task).
- Changing the glow circles (decorative; can be left).

## Acceptance checklist
- [ ] The failing pair is confirmed in a browser and written next to the design (selector, computed color, computed background).
- [ ] Chosen option recorded (A, B, or C) with the measured ratios from this spec.
- [ ] Plan name has an explicit text color in every state.
- [ ] Every text/background pair on the cards is at least 4.5:1 in unselected, selected, focused, and hover states (annotated in the design).
- [ ] Selected state is clear without color (border weight, check, aria-checked).
- [ ] One primary button on the screen; label does not promise a purchase that cannot happen.
- [ ] Mobile frame shows the primary button in the thumb zone.
- [ ] If Option B is chosen: a list of every screen using `--text-muted` was reviewed, and native/web sync is planned.
- [ ] axe re-run noted as a build-lane acceptance step: zero `color-contrast` findings on Drop+.
