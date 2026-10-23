---
name: WORKING HARD with EXCEL
status: draft
updated: 2026-10-22
sources:
  - ../../../specs/spec-excel-practice/SPEC.md
description: Personal Excel-practice web app (level map, web-to-Excel exam bridge, results with Tips, streak and records). shadcn/ui on Next.js + Tailwind; theme "Dark Excel" (dark default, light toggle). This file specifies the brand-layer delta over shadcn defaults.
colors:
  # Theme 5 "Dark Excel" — dark values lifted verbatim from .working/color-themes-1.html.
  # Dark is the DEFAULT mode; every role has a `-light` pair for the toggle.
  # Light values re-tuned for WCAG AA (review-accessibility-motion.md §1); light primary = Excel brand green.
  background: '#0B0D0C'
  background-light: '#F5F5F7'
  foreground: '#F5F7F6'
  foreground-light: '#1D1D1F'
  card: '#151917'
  card-light: '#FFFFFF'
  muted: '#1C211E'
  muted-light: '#EDEDF0'
  muted-foreground: '#8E9993'
  muted-foreground-light: '#636368'
  border: '#262D29'
  border-light: '#D9D9DE'
  # Boundary of interactive inputs (≥3:1 on card) — Input, Upload Dropzone, Kbd, disabled controls.
  input-border: '#5F6B64'
  input-border-light: '#86868B'
  primary: '#34D17F'
  primary-light: '#107C41'
  primary-foreground: '#04140B'
  primary-foreground-light: '#FFFFFF'
  accent: '#12301F'
  accent-light: '#E3F6EB'
  success: '#4ADE80'
  success-light: '#137535'
  destructive: '#FF5C6C'
  destructive-light: '#BE233B'
  warning: '#FFC34D'
  warning-light: '#8F5200'
  streak: '#FF7A1A'
  streak-light: '#B93D07'
  # Decoration only (Fire Effect, flames) — never text.
  streak-vivid: '#FF7A1A'
  streak-vivid-light: '#F2600C'
  chart-1: '#34D17F'
  chart-1-light: '#107C41'
  chart-2: '#2DD4BF'
  chart-2-light: '#0B7473'
  chart-3: '#A3E635'
  chart-3-light: '#4D7C0F'
  # Focus ring — foreground outline, from the only focus state rendered (direction A).
  ring: '#F5F7F6'
  ring-light: '#1D1D1F'
  # Derived tokens (computed from the roles above; no new hues).
  # *-soft = role mixed 14% over card (color-themes-1.html rule).
  success-soft: '#1C3526'
  success-soft-light: '#DEECE3'
  destructive-soft: '#362223'
  destructive-soft-light: '#F6E0E4'
  warning-soft: '#36311F'
  warning-soft-light: '#EFE7DB'
  streak-soft: '#362717'
  streak-soft-light: '#F5E4DC'
  freeze-soft: '#18332F'
  freeze-soft-light: '#DDECEB'
  # Under Construction hatch = warning 18% over card (direction C rule).
  uc-hatch: '#3F3821'
  uc-hatch-light: '#EBE0D1'
  # Primary Button bottom edge = primary darkened ~35%.
  primary-edge: '#1F8A52'
  primary-edge-light: '#0A512A'
  # Glows = primary / streak at alpha (8-digit hex). Decorative; no contrast requirement.
  glow-soft: '#34D17F29'
  glow-soft-light: '#13A35A29'
  glow: '#34D17F59'
  glow-light: '#13A35A59'
  glow-strong: '#34D17FB3'
  glow-strong-light: '#13A35AB3'
  streak-glow: '#FF7A1A38'
  streak-glow-light: '#F2600C38'
  streak-glow-strong: '#FF7A1A73'
  streak-glow-strong-light: '#F2600C73'
  # Records Card stays dark ("inverted") in both modes.
  records-surface: '#12301F'
  records-surface-light: '#12301F'
  records-surface-end: '#04140B'
  records-surface-end-light: '#04140B'
  records-foreground: '#F5F7F6'
  records-foreground-light: '#F5F7F6'
  records-accent: '#34D17F'
  records-accent-light: '#34D17F'
typography:
  # System stacks only (no web font) — as rendered in directions B and C.
  display-streak:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif'
    # Fluid: ≈153px in the ±300px Dashboard rail at 1280, full 232px on wide screens.
    fontSize: clamp(120px, 12vw, 232px)
    fontWeight: '800'
    lineHeight: '0.82'
    letterSpacing: -0.07em
  display-streak-mobile:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: clamp(96px, 48vw, 190px)
    fontWeight: '800'
    lineHeight: '0.82'
    letterSpacing: -0.07em
  display-lg:
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 56px
    fontWeight: '800'
    lineHeight: '1'
    letterSpacing: -0.05em
  headline:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 32px
    fontWeight: '850'
    lineHeight: '1.1'
    letterSpacing: -0.025em
  stat-hero:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 44px
    fontWeight: '850'
    lineHeight: '1'
    letterSpacing: -0.04em
  title:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 16px
    fontWeight: '800'
    lineHeight: '1.3'
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.45'
  caption:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI Variable Text", "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
  stat-value:
    fontFamily: 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace'
    fontSize: 26px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  label:
    fontFamily: 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace'
    fontSize: 11px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.1em
  kbd:
    fontFamily: 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace'
    fontSize: 11px
    fontWeight: '500'
  kbd-tips:
    fontFamily: 'ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace'
    fontSize: 15px
    fontWeight: '600'
rounded:
  sm: 6px
  md: 12px
  lg: 16px
  xl: 28px
  full: 9999px
spacing:
  # Tailwind 4-based scale inherited. Named layout tokens only.
  sidebar-width: 256px
  drawer-width: 286px
  header-height: 68px
  page-padding: 32px
  page-padding-mobile: 16px
  card-padding: 16px
  # Streak Hero panel padding in the Dashboard rail.
  hero-padding: 24px
  grid-gap: 20px
  rail-gap: 14px
  map-column: 640px
  results-column: 880px
  panel-width: 430px
  orbit-size: 320px
  orbit-logo: 40px
  button-height: 44px
  button-edge: 4px
  dock-button-height: 52px
  touch-target: 44px
  exam-control-height: 40px
  target-min: 24px
components:
  app-sidebar:
    background: '{colors.card}'
    width: '{spacing.sidebar-width}'
    item-radius: '{rounded.md}'
    item-active-background: '{colors.primary}'
    item-active-foreground: '{colors.primary-foreground}'
    item-active-glow: '{colors.glow-strong}'
  header-bar:
    height: '{spacing.header-height}'
    border: '{colors.border}'
  streak-chip:
    background: '{colors.streak-soft}'
    foreground: '{colors.streak}'
    radius: '{rounded.md}'
    typography: '{typography.stat-value}'
  theme-toggle:
    background: '{colors.card}'
    selected-ring: '{colors.primary}'
  primary-button:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    edge: '{colors.primary-edge}'
    edge-width: '{spacing.button-edge}'
    radius: '{rounded.md}'
    height: '{spacing.button-height}'
    hover-glow: '{colors.glow-soft}'
    disabled-background: '{colors.muted}'
    disabled-foreground: '{colors.muted-foreground}'
  stat-card:
    background: '{colors.card}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    padding: '{spacing.card-padding}'
    label: '{typography.label}'
    value: '{typography.stat-value}'
    hover-border: '{colors.glow}'
  streak-hero:
    background: '{colors.card}'
    radius: '{rounded.xl}'
    radial-glow: '{colors.streak-glow}'
    numeral: '{typography.display-streak}'
    numeral-gradient-from: '{colors.warning}'
    numeral-gradient-to: '{colors.streak}'
    numeral-glow: '{colors.streak-glow-strong}'
  freeze-pill:
    background: '{colors.freeze-soft}'
    border: '{colors.chart-2}'
    foreground: '{colors.chart-2}'
    radius: '{rounded.full}'
    disabled-border: '{colors.input-border}'
    disabled-foreground: '{colors.muted-foreground}'
  practice-pips:
    done: '{colors.primary}'
    next: '{colors.glow}'
    pending-outline: '{colors.muted-foreground}'
  level-node-passed:
    fill: '{colors.accent}'
    stroke: '{colors.primary}'
  level-node-active:
    fill: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    glow: '{colors.glow-strong}'
  level-node-locked:
    fill: '{colors.card}'
    stroke: '{colors.muted-foreground}'
  level-node-under-construction:
    fill: '{colors.uc-hatch}'
    stroke: '{colors.warning}'
  level-node-focus:
    stroke: '{colors.ring}'
  level-callout:
    background: '{colors.card}'
    border: '{colors.glow}'
    radius: '{rounded.lg}'
  under-construction-tag:
    foreground: '{colors.warning}'
    border: '{colors.warning}'
    radius: '{rounded.sm}'
    typography: '{typography.label}'
  records-card:
    background-from: '{colors.records-surface}'
    background-to: '{colors.records-surface-end}'
    foreground: '{colors.records-foreground}'
    accent: '{colors.records-accent}'
    digits: '{typography.stat-value}'
    radius: '{rounded.lg}'
  streak-risk-pill:
    background: '{colors.streak-soft}'
    foreground: '{colors.streak}'
    border: '{colors.streak-glow-strong}'
    radius: '{rounded.full}'
  attempt-card:
    background: '{colors.card}'
    border: '{colors.glow}'
    radius: '{rounded.lg}'
  orbit-loader:
    size: '{spacing.orbit-size}'
    ring: '{colors.foreground}'
    dot: '{colors.foreground}'
    dot-outline: '{colors.border}'
    center: '{colors.primary}'
    center-size: '{spacing.orbit-logo}'
  exam-status-line:
    foreground: '{colors.foreground}'
    secondary: '{colors.muted-foreground}'
    typography: '{typography.body}'
  hint-button:
    foreground: '{colors.warning}'
    background: '{colors.warning-soft}'
    radius: '{rounded.md}'
    height: '{spacing.exam-control-height}'
  hint-select:
    background: '{colors.card}'
    border: '{colors.input-border}'
    radius: '{rounded.md}'
    height: '{spacing.exam-control-height}'
  upload-dropzone:
    border: '{colors.input-border}'
    drag-over-border: '{colors.primary}'
    progress: '{colors.primary}'
    rejected-background: '{colors.destructive-soft}'
    rejected-border: '{colors.destructive}'
    min-height: '{spacing.exam-control-height}'
    radius: '{rounded.md}'
  exam-workbook:
    finish-fill: '{colors.primary-light}'
    finish-foreground: '{colors.primary-foreground-light}'
  score-badge:
    face: '{colors.primary}'
    back: '{colors.streak}'
    numeral: '{typography.display-lg}'
  wrong-answer-row:
    background: '{colors.destructive-soft}'
    foreground: '{colors.destructive}'
    radius: '{rounded.md}'
  tips-card:
    background: '{colors.card}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
    kbd: '{typography.kbd-tips}'
  fire-effect:
    flame-from: '{colors.warning}'
    flame-to: '{colors.streak-vivid}'
    haze: '{colors.streak-glow-strong}'
  kbd:
    background: '{colors.muted}'
    border: '{colors.input-border}'
    typography: '{typography.kbd}'
---

# WORKING HARD with EXCEL — Design Spine

Visual identity. Behavior lives in `EXPERIENCE.md`. Product contract: `../../../specs/spec-excel-practice/SPEC.md`. Explorations in `.working/` and v0 templates in `imports/` illustrate this file; **the spines (DESIGN.md + EXPERIENCE.md) win on any conflict with `.working/` renders or `imports/`.**

## Brand & Style

A one-person Excel gym with the swagger of an apple.com product page. Dark "backstage" surfaces, one electric green that means *go / progress*, one fire orange that means *streak*. The product premise is *come back every day and climb* — so two things are always loud: the **Level Path** (where El Zavier is) and the **Streak Hero** (why to come back today). Everything else sits quiet in cards.

- **UI system:** shadcn/ui on Next.js + Tailwind. All unlisted shadcn components keep their defaults; this file lists the deltas.
- **Composition:** structure from direction C "Level Journey" (Level Path as dashboard hero + right stats rail) — [.working/direction-c-level-journey.html](.working/direction-c-level-journey.html); giant fire-gradient streak numeral, phone first screen and streak-at-risk look from direction B "Hero Streak" — [.working/direction-b-hero-streak.html](.working/direction-b-hero-streak.html). Direction A ([.working/direction-a-tasko-dark.html](.working/direction-a-tasko-dark.html)) is the not-chosen dense Tasko-style alternative; use it only for its rendered focus ring.
- **Key-screen mocks** (1:1, dark default with light and reduced-motion toggles): [mockups/key-dashboard.html](mockups/key-dashboard.html) · [mockups/key-exam.html](mockups/key-exam.html) · [mockups/key-results.html](mockups/key-results.html) · [mockups/key-level-map.html](mockups/key-level-map.html). They supersede the direction renders where they differ; the spines still win over the mocks.
- **Spreadsheet DNA:** the Level Path sits on a faint Excel grid (column letters A–J header, cell lines in `{colors.border}` at 45%). Logo = sheet/grid glyph on a `{colors.primary}` tile with green glow.
- **Motion register (visual level only; timing, triggers and reduced-motion states in `EXPERIENCE.md`):** two easings, never mixed on one element.
  - *Bouncy* `cubic-bezier(.34,1.56,.64,1)` — game-like objects: Level Nodes popping, buttons, small-card hover, drawer opening.
  - *Cinematic* `cubic-bezier(.16,1,.3,1)` — big moments: Login entrance, Streak Hero entrance, count-up numerals, Score Badge turn, 3D Scroll Scenes.
  - Signature looks: glowing green trail drawn along the path, pulsing ring on the active node, 3D laptop + Excel logo turning with scroll on Level Map (board tilt ≤25°), one-turn Score Badge on Results, slow minimal orbit while an exam runs.
- **Mood split on Results:** celebration (glow, fire, spin) is earned — only Test passed gets the Fire Effect; a low score is visually calm (no glow, no spin, no fire).

## Colors

Theme 5 "Dark Excel" from [.working/color-themes-1.html](.working/color-themes-1.html). Dark is the default; light is a toggle. Light values are re-tuned for AA (light primary = Excel brand green `#107C41`). All values in frontmatter; roles:

| Role | Dark / Light | Used for | Never for |
|---|---|---|---|
| `primary` | `#34D17F` / `#107C41` | Primary Button, active nav item, active Level Node, drawn trail, progress fills, links, selected Theme Toggle ring | Streak, errors, decoration |
| `primary-foreground` | `#04140B` / `#FFFFFF` | Text/icons on primary and streak fills, avatar initials | Body text |
| `accent` | `#12301F` / `#E3F6EB` | Passed Level Node fill, chart bars (non-peak) | Buttons |
| `streak` | `#FF7A1A` / `#B93D07` | Streak Hero gradient end, Streak Chip, Streak Risk Pill, Week Strip done, Score Badge back face | Anything not streak/celebration |
| `streak-vivid` | `#FF7A1A` / `#F2600C` | Fire Effect flames and streak decoration | Any text |
| `warning` | `#FFC34D` / `#8F5200` | Hints and point deductions (Hint Button, "−5"), Under Construction Tag + hatch, Streak Hero gradient start | Errors |
| `success` | `#4ADE80` / `#137535` | "x of y correct" count, "All correct" line, ✓ on Tips Card, "File received" | Primary actions |
| `destructive` | `#FF5C6C` / `#BE233B` | Wrong Answer Row, file-rejected, grading-failed and login errors | Low-score mood (calm ≠ red) |
| `chart-1/2/3` | green / teal / lime | Activity Chart (`chart-1` peak day), progress gradient `primary → chart-3`. `chart-2` (teal) doubles as the **freeze** colour: Freeze Pill, frozen day in Week Strip and Activity Chart | Streak fire |
| `input-border` | `#5F6B64` / `#86868B` | Boundaries of Input, Upload Dropzone, Kbd, disabled Freeze Pill, missed Week Strip day | Card separation (use `border`) |
| `border` | `#262D29` / `#D9D9DE` | Decorative card separation, grid lines, Level Path base trail | Anything that carries state |
| `*-soft`, `freeze-soft` | 14% role over card | Status row, pill and chip backgrounds | Text |
| `records-*` | same in both modes | Records Card: dark gradient, light text, green colon | Other cards |
| `glow*`, `streak-glow*` | primary / streak at alpha | Hover rings, active nav and node halos, Streak Hero radial glow (`streak-glow`) | Static borders |

**Contrast (WCAG 2.2 AA: T = text 4.5:1, T-large = ≥24px or ≥18.66px bold 3:1, U = UI/graphic 3:1).** Measured on the surface each component actually uses:

| Pair | Where | Kind | Dark | Light |
|---|---|---|---|---|
| foreground / background | Page text | T | 18.1 | 15.5 |
| foreground / card | Card text | T | 16.5 | 16.8 |
| foreground / muted | Kbd, hovered nav and rows | T | 15.2 | 14.4 |
| foreground / destructive-soft | Wrong Answer reason | T | 13.8 | 13.4 |
| muted-foreground / background | Captions, Exam Status Line second line | T | 6.6 | 5.5 |
| muted-foreground / card | Labels, meta, inactive nav | T | 6.0 | 6.0 |
| muted-foreground / muted | Hover nav, disabled Primary Button label, today "?" | T | 5.5 | 5.1 |
| primary-foreground / primary | Button label, active nav, active node numeral, avatar | T | 9.5 | 5.3 |
| primary / background | Links, "YOU ARE HERE", "Download again" | T | 9.8 | 4.8 |
| primary / card | Callout key, "passed" caption | T | 8.9 | 5.3 |
| primary / accent | Check on passed Level Node | U | 7.2 | 4.7 |
| primary / card | Active node, done pips, progress bar, completed trail | U | 8.9 | 5.3 |
| streak / background | Streak text on page | T | 7.5 | 5.2 |
| streak / card | Streak Hero gradient end | T | 6.8 | 5.6 |
| streak / streak-soft | Streak Chip, Streak Risk Pill, Week Strip done | T | 5.5 | 4.6 |
| primary-foreground / streak | Week Strip today-done glyph, Score Badge back face | T | 7.3 | 5.6 |
| warning / card | Under Construction Tag, "−5" | T | 11.1 | 6.2 |
| warning / background | Warning text on page | T | 12.2 | 5.7 |
| warning / warning-soft | Hint Button, revealed-hint label | T | 8.2 | 5.1 |
| warning / uc-hatch | Under Construction node stroke | U | 7.4 | 4.8 |
| success / card | "x of y correct", ✓ on Tips Card | T | 10.2 | 5.8 |
| success / success-soft | "All correct" line, "File received" | T | 7.6 | 4.7 |
| destructive / background | Login error | T | 6.5 | 5.5 |
| destructive / card | Rejection and grading-failed text | T | 5.9 | 6.0 |
| destructive / destructive-soft | Wrong Answer "✗", rejected Dropzone | T | 5.0 | 4.8 |
| chart-2 / card | Freeze text on card | T | 9.5 | 5.6 |
| chart-2 / freeze-soft | Freeze Pill on its own fill | T | 7.3 | 4.6 |
| primary-foreground / chart-3 | Avatar initials at gradient end | T | 12.6 | 5.0 |
| ring / background · card · muted | Focus ring | U | 15.2–18.1 | 14.4–16.8 |
| input-border / card | Input, Upload Dropzone, Kbd, disabled Freeze Pill, missed day | U | 3.2 | 3.6 |
| input-border / background | Same, on page | U | 3.5 | 3.3 |
| muted-foreground / card | Locked node stroke, pending pip outline | U | 6.0 | 6.0 |
| Streak Hero numeral (warning → streak on card) | Display numeral | T-large | 11.1 → 6.8 | 6.2 → 5.6 |
| At-risk numeral (desaturate .55, opacity ≥.85) | Streak at risk | T-large | 4.6 | 4.9 |
| records-foreground / records-surface → end | Records Card text, both modes | T | 13.3–17.6 | 13.3–17.6 |
| records-accent / records-surface | Records colon, hairlines | T | 7.2 | 7.2 |
| primary-foreground-light / primary-light | Exam Workbook Finish label (Excel is light) | T | 5.3 | 5.3 |

Every text pair passes 4.5:1 and every UI pair 3:1 in both modes. `border` (1.3 / 1.4 on card), `muted` fills (1.1 / 1.2) and `accent` bars (1.2 / 1.1) are decorative and never the only carrier of state.

## Typography

System font stacks only (Segoe UI Variable on the Windows laptop/office PC, SF on the phone). Heavy weights (800–850) for headings and numerals, 400–500 for running text. All numbers that change (scores, times, counts) use the mono stack with tabular figures so count-ups don't jitter.

| Token | Where |
|---|---|
| `display-streak` / `display-streak-mobile` | Streak Hero numeral only (desktop fluid `clamp(120px, 12vw, 232px)`, ≈153px in the rail at 1280; phone fluid `clamp(96px, 48vw, 190px)`; 3-digit streaks fit both) |
| `display-lg` | Score Badge / Results score, large stat callouts |
| `headline` | Page title ("Dashboard", "Level Map", …), Results `<h1>` |
| `stat-hero` | Big value inside rail cards |
| `title` | Card and Level Callout headings |
| `body` | Running text, soal/keterangan text, Tips body, Exam Status Line |
| `caption` | Meta lines ("4/5 practices done", dates), disabled reasons |
| `stat-value` | Mono values: scores, record times (`08:41`), counts |
| `label` | Uppercase mono eyebrows and card keys, Under Construction Tag, sidebar group labels (11px floor) |
| `kbd` / `kbd-tips` | Keyboard shortcuts — inline / enlarged inside Tips Card |

## Layout & Spacing

Tailwind 4-based scale inherited. Named tokens in frontmatter.

- **Desktop shell (≥ lg):** fixed App Sidebar `{spacing.sidebar-width}` + sticky Header Bar `{spacing.header-height}` + content padded `{spacing.page-padding}`.
- **Dashboard grid:** two columns — Level Path card at `{spacing.map-column}` + stats rail (`1fr`, cards stacked with `{spacing.rail-gap}`). Rail order: Attempt Card (only while an attempt is open) → Streak Hero → Setup Guide prompt (first run only) → 2-up Stat Cards (last score, Ujian Akhir 0/5) → Records Card → Activity Chart → History List. Above the grid: page title + one-line status ("Level 3 — Hitung bersyarat · 1 practice until the Test"), no action buttons — Start lives in the Level Callout. — [mockups/key-dashboard.html](mockups/key-dashboard.html)
- **Tablet (md–lg):** one column; rail cards 2-up.
- **Phone (390):** gutter `{spacing.page-padding-mobile}`; Streak Hero numeral fills screen one; Attempt Card directly below it when present; Level Path becomes a vertical rail; Phone Dock pinned to the bottom. Every Primary Button below `sm` is full width.
- **Level Path card:** column-letter header strip, grid background, winding trail Level 1 → Ujian Akhir, Level Callout anchored to the active node; card padding leaves room for the node focus ring.
- **Level Map:** title row → 3D Scroll Scene stage (≤150vh) → Level Path card at full content width (column strip A–O). The CAP-15 side-track node sits right of the main path, off the trail, joined to Level 8 (Lintas file) by a dashed spur. Final scene frame: laptop left, map board center, Excel logo right. Level Detail Panel: `{spacing.panel-width}` Sheet on desktop. — [mockups/key-level-map.html](mockups/key-level-map.html)
- **Exam in progress:** single centered column — Orbit Loader, Exam Status Line, then the hint group (Hint Select + Hint Button) and Upload Dropzone side by side (≥8px apart; stacked on phone); revealed hint below them; Setup Guide link last. No visible page heading. — [mockups/key-exam.html](mockups/key-exam.html)
- **Results:** single centered column `{spacing.results-column}`: Outcome panel (Score Badge in a 200px column on the left with the deduction line under it; label, `<h1>`, correct count, time + "New record", action on the right) → Wrong Answer Rows → Tips Carousel. — [mockups/key-results.html](mockups/key-results.html)
- **App Sidebar on Exam in progress and Results:** no item is active (neither is a menu item).

## Elevation & Depth

No shadow hierarchy on flat surfaces — cards are separated by `{colors.border}` and tone. Depth is reserved for four uses:

1. **Glow** (`{colors.glow-soft}` / `{colors.glow}` / `{colors.glow-strong}`) on hover, active nav, active node, primary CTA. Animated glows are a pseudo-element's opacity/transform, never an animated `box-shadow`.
2. **Game-button edge:** Primary Button has a solid `{spacing.button-edge}` bottom edge in `{colors.primary-edge}`; it compresses on press.
3. **3D scenes:** objects in 3D Scroll Scenes and the Score Badge get a deep, soft drop shadow (black, large blur) and real perspective. The Level Callout floats with backdrop blur at ≥ lg only; below lg it uses a solid `{colors.card}` fill.
4. **Inversion:** the Records Card is the one dark-on-light island — it keeps its dark `records-*` gradient in light mode.

## Shapes

| Token | Use |
|---|---|
| `{rounded.sm}` 6px | Pills inside cards, Under Construction Tag, kbd, count badges |
| `{rounded.md}` 12px | Buttons, nav items, inputs, Header Bar controls, Wrong Answer Row, Hint Button, Upload Dropzone |
| `{rounded.lg}` 16px | Cards, Level Callout, Tips Card, Attempt Card |
| `{rounded.xl}` 28px | Streak Hero panel |
| `{rounded.full}` | Level Nodes, Week Strip days, Freeze Pill, Streak Risk Pill, avatar dots |

## Components

shadcn as-is: `Card`, `Sheet`, `Dialog`, `Tabs`, `Table`, `Badge` (incl. "New record", "passed"), `Input` (boundary `{colors.input-border}`), `Switch`, `Skeleton`, `Toast` (Sonner), `Tooltip`, `Separator`, `Avatar`.

Compositions (no row of their own): **Setup Guide prompt** = Stat Card shell + Primary Button "Open Setup Guide" + ghost dismiss; **deduction line** = `caption` under the Score Badge, hint deductions in `{colors.warning}`; **correct count** = "x of y correct" in `stat-value` `{colors.success}` beside the score; **Tips & Tricks filter** = shadcn `Tabs` (levels) + `Input` (search); **phone active-level card** = Level Callout rendered inline in the rail; **Skip intro** = link hidden until focused, `{colors.primary}`; **Settings** = Theme Toggle + `Switch` (Reduce motion) + read-only text (streak time zone) + account row ("Signed in as <Google account>" in `body`, outline "Log out" button).

Brand layer:

| Component | Visual spec |
|---|---|
| App Sidebar | `{colors.card}`, `{spacing.sidebar-width}` (from [imports/dashboard-page.zip](imports/dashboard-page.zip)). Brand block (logo tile + "WORKING HARD / with EXCEL"). Groups "Menu" and "General" in `label`. Active item filled `{colors.primary}` + `{colors.glow-strong}` halo; others `{colors.muted-foreground}`, hover `{colors.muted}` + foreground text. Footer: curriculum progress bar ("2 of 9 levels passed", gradient `primary → chart-3`). |
| Mobile Drawer | shadcn `Sheet` from left, `{spacing.drawer-width}`, same contents as App Sidebar, scrim black 55%. Close button ≥ `{spacing.touch-target}`. |
| Header Bar | Sticky; bottom border `{colors.border}`. Right cluster: Streak Chip, Theme Toggle, avatar (initials "EZ" in `{colors.primary-foreground}`, gradient `primary → chart-3`, `{rounded.md}`). No search. |
| Streak Chip | `{colors.streak-soft}` fill, `{colors.streak}` mono numeral + flame icon. |
| Theme Toggle | Segmented sun/moon pair in a `{colors.card}` well; selected segment = filled icon + 2px `{colors.primary}` ring. |
| Primary Button | See frontmatter `primary-button`. Label `body` weight 700. Disabled: `{colors.muted}` fill, `{colors.muted-foreground}` label, no edge, no glow; reason line in `caption` `{colors.muted-foreground}` below. Outline/ghost/secondary inherit shadcn. |
| Stat Card | `{colors.card}`, `label` key with icon, `stat-value` value, `caption` meta. Hover: `{colors.glow}` border (+ lift/scale only when clickable). |
| Streak Hero | `{rounded.xl}` panel, padding `{spacing.hero-padding}`, `{colors.streak-glow}` radial glow (static, pre-baked on phone). Numeral `display-streak` with vertical gradient `{colors.warning}` → `{colors.streak}` + drop glow `{colors.streak-glow-strong}` (desktop only); unit "day streak" + decorative flame icon; Freeze Pill; Week Strip. At risk: numeral desaturated (opacity ≥.85, stays ≥3:1). Restarted: one-line message in `body` `{colors.muted-foreground}`. |
| Freeze Pill | `{colors.chart-2}` text + snowflake icon on `{colors.freeze-soft}` fill with `{colors.chart-2}` hairline, `{rounded.full}`: "1 of 2 freezes left". **Use freeze** (at risk): same fill, 1.5px solid `{colors.chart-2}` border, label "Use freeze", real button ≥ `{spacing.touch-target}` tall on phone. **Disabled**: `{colors.input-border}` border, `{colors.muted-foreground}` text, reason `caption` below. |
| Week Strip | 7 circular day dots, English initials M–S, always Mon–Sun. Done = `{colors.streak-soft}` fill + streak text; today done = solid `{colors.streak}` with `{colors.primary-foreground}` check; frozen = dashed `{colors.chart-2}` border + snowflake; missed = `{colors.input-border}` outline + "–"; today pending = "?" in `{colors.muted-foreground}`; future day = empty circle, 1px `{colors.border}` line, no glyph, initial in `{colors.muted-foreground}`. |
| Level Path | Grid-backed SVG; base trail dotted `{colors.border}` (decorative); completed trail solid `{colors.primary}` with green drop-glow; ends in Ujian Akhir flag. Phone: vertical rail, Level 1 at top; consecutive Under Construction nodes collapse into one node. |
| Level Node | Circle with level number. Variants (frontmatter): passed (accent fill, primary stroke, check), active (primary fill, larger numeral, two pulse rings, "YOU ARE HERE" in `label`/primary), locked (card fill, lock icon), under construction (hatched `{colors.uc-hatch}`, dashed warning stroke). Side track (CAP-15, Level Map only): under-construction variant labelled "Co-authoring", joined to the path by a dashed `{colors.border}` spur, never on the trail. Focus: SVG circle r + 5, 2px `{colors.ring}`, plus the hover scale. Label beside node: level name in `title` + status in `caption`. |
| Level Callout | Floating card at the active node; `{colors.glow}` border; "Active level" key, level name, Practice Pips + "x/5 practices done", Primary Button, lock line for Test. All levels done: "Level 4 complete — Level 5 is coming soon" + "Practice again". |
| Practice Pips | 5 segments: done `{colors.primary}`; next = diagonal hatch of `{colors.glow}`; pending = `{colors.card}` with 1.5px `{colors.muted-foreground}` outline. Always paired with "x/5 practices done" text. |
| Under Construction Tag | Uppercase mono, `{colors.warning}` text + border, cone icon. Cards in this state: dashed warning border + 7% warning stripes. |
| Level Detail Panel | shadcn `Sheet` (right on desktop at `{spacing.panel-width}`, bottom on phone with a grab handle): level header (label "Level N · Active", level name in `headline`, curriculum functions in mono `caption`), Practice Pips + "x/5 practices done", 5 practice rows (status, best score, record time, "Start Practice N" or "Practice again"), Test row (locked / open / passed + "Practice again"), Primary Button. Rows hover `{colors.muted}`. |
| Activity Chart | 7 rounded bars (from [imports/dashboard-page.zip](imports/dashboard-page.zip)); non-peak `{colors.accent}` with primary inner line, peak `{colors.primary}` + glow; hovered/focused bar brightens + glow; empty/freeze day = 6px `{colors.chart-2}` outline stub; no grey hover band; tooltip inverted (`{colors.foreground}` fill, `{colors.background}` text) with full day name + count; footer `caption` "Avg 1.4/day · Peak Wed 4" with peak in `{colors.primary}`. |
| Records Card | Inverted card, dark in both modes (from [imports/dashboard-page.zip](imports/dashboard-page.zip) timer card): gradient `{colors.records-surface}` → `{colors.records-surface-end}`, text and mono digits `{colors.records-foreground}`, colon and dashed row hairlines `{colors.records-accent}`; ↗ arrow chip top-right. |
| History List | Rows: attempt name + level (`body`), score right (`stat-value`); Test rows carry a "passed" Badge; row hover `{colors.muted}` + icon scale. "View all" carries the ↗ arrow chip. |
| Phone Dock | Pinned bottom, fades from transparent to `{colors.background}`; 3 mini stats (score, record, activity) + full-width Primary Button `{spacing.dock-button-height}` tall; inline message slot above the button (`body`, `lang="id"`). |
| Streak Risk Pill | `{colors.streak-soft}` + `{colors.streak-glow-strong}` border, streak text + time left ("4h 30m left"), pulse on a pseudo-element. |
| Login Card | From [imports/login-page.zip](imports/login-page.zip): single centered column `max-w-md`: 32px logo tile, title in `headline`, subtitle `{colors.muted-foreground}`, one Primary Button "Sign in with Google" with the Google "G" mark at the left (w-64 → full on phone; loading = spinner + "Connecting…"), centered inline error slot `{colors.destructive}` under the button, separator. No username/password fields, no "Forgot password", no footer link. Background `{colors.background}`. |
| Attempt Card | `{colors.card}`, `{colors.glow}` border, `{rounded.lg}`: "Attempt in progress" key in `label`, attempt name + elapsed time (`stat-value`), Primary Button "Resume" + outline "Abandon". |
| Orbit Loader | From [imports/animation-page.zip](imports/animation-page.zip), built as an inline SVG component (not `<img>`), `{spacing.orbit-size}`, viewBox 0 0 100 100 centered 50,50. 6 rings r 49/40/30/20/15/10, stroke 0.3 units `{colors.foreground}` at 2/3/4/4/8/10% opacity (inner brightest). One dot per ring: ~5px (r 0.75, set as attribute) solid `{colors.foreground}` at full opacity with a hairline outline in `{colors.border}`. Center: app logo tile `{colors.primary}` ≤ `{spacing.orbit-logo}`, inside the r10 ring. Pause/play ghost icon button (≥ `{spacing.target-min}`) at the bottom-right of the stage. Decorative (`aria-hidden`). |
| Exam Status Line | Under the Orbit Loader, centered: line 1 `body` `{colors.foreground}` "Excel is open — Practice 5 · 12:34" (time in mono tabular); line 2 `body` `{colors.muted-foreground}` Indonesian instruction; then "Download didn't start? Download again" link in `{colors.primary}`. Grading: line 1 reads "File received — grading…". |
| Hint Select | Left of the Hint Button: shadcn `Select` showing "Soal N", `{colors.card}` fill, `{colors.input-border}` boundary, `{rounded.md}`, height `{spacing.exam-control-height}`. |
| Hint Button | Under the status line, right of the Hint Select: `{colors.warning-soft}` fill, warning text "Hint (−5)" + "2 left" (mono, after a hairline divider), height `{spacing.exam-control-height}`. Pending: spinner replaces the bulb icon, 70% opacity. Revealed hint: block below in `{colors.card}` with 3px `{colors.warning}` left border, "Hint 1" in `label` warning, text `body` `{colors.foreground}`. Quota used: `{colors.muted}` fill, `{colors.muted-foreground}` "No hints left". |
| Upload Dropzone | Beside the Hint Button: dashed `{colors.input-border}`, upload icon, `caption` "Upload file (.xlsm)", min height `{spacing.exam-control-height}`. Drag-over: `{colors.primary}` border + `{colors.glow-soft}`. Uploading: `{colors.primary}` progress bar on `{colors.muted}` + percentage. Received: `{colors.success}` check + "File received". Rejected: `{colors.destructive-soft}` fill, `{colors.destructive}` border, "✗" + message in `{colors.foreground}`. |
| Exam Timer | **Next (CAP-14)** — Ujian Akhir only: mono `stat-value` "mm:ss left" in `{colors.muted-foreground}`, replacing the elapsed time in the Exam Status Line. |
| Exam Workbook | The `.xlsm` (Excel's own light theme). First sheet "Instructions": attempt name as title, scenario paragraph, numbered perintah soal; **Finish** button = Excel shape at the top right, fill `{colors.primary-light}`, label `{colors.primary-foreground-light}`, two rows tall. Data on following sheets. Macro messages are native Excel message boxes (no styling). |
| Score Badge | Coin-like disc (168px): front face `{colors.primary}` with score in `display-lg` + "/100" in `label`, back face `{colors.streak}` with flame; real 3D rotation (one turn), glow `{colors.glow-strong}`. Low-score and History variants: flat `{colors.muted}` face, `{colors.foreground}` score, 2px `{colors.input-border}` ring, no glow. |
| Wrong Answer Row | `{colors.destructive-soft}` fill, destructive "✗" + "Soal N", reason text in `body` `{colors.foreground}`, "See tip" link to its Tips Card. |
| Tips Card | `{colors.card}`, `{rounded.lg}`; level tag, "Soal N" + status mark (✓ `{colors.success}` / ✗ `{colors.destructive}`, each with text), title, Indonesian body, shortcut keys in `kbd-tips`. |
| Tips Carousel | Horizontal row of Tips Cards with snap; edge fade into `{colors.background}`; Prev/Next icon buttons (≥ `{spacing.target-min}`, ≥ `{spacing.touch-target}` on phone); "Tip 3 of 8" in `caption`. |
| Fire Effect | Flames `{colors.warning}` → `{colors.streak-vivid}` rising behind the Score Badge with `{colors.streak-glow-strong}` haze; flame area ≤25% of the viewport; Test passed only. |
| 3D Scroll Scene | Sticky stage (≤150vh) on `{colors.card}` with green radial haze. Level Map objects: 3D laptop (black lid, dark deck with keyboard and trackpad, screen shows the app), 3D Excel logo (stand-in tile until the asset question is settled), map board (tilt ≤25°, no Z spin); final frame places laptop left, board center, logo right. Results objects: the Wrong Answer Rows and Tips Carousel lifting in with a light 3D tilt. Phone: transform/opacity only, no blur, no `backdrop-filter`. |
| Setup Steps | Numbered shadcn `Card` list; step number in a `{colors.primary}` circle; the fixed working folder path and Excel menu paths in `kbd` style (e.g. `File > Options > Trust Center`). |
| Toast | shadcn Sonner; destructive variant for failures. |
| Kbd | `{colors.muted}` fill, `{colors.input-border}` border with 2px bottom, `kbd` type. |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep `{colors.primary}` for go/progress and `{colors.streak}` for streak/celebration only | Use streak orange for warnings or primary green for streak |
| Use `{colors.warning}` for hints, point deductions and Under Construction | Paint Under Construction red or grey-disabled — it is "coming", not "broken" |
| Make the Level Path and Streak Hero the loudest objects on Dashboard | Add a third hero (charts, banners) competing with them |
| Mono + tabular numerals for every changing number | Proportional digits in count-ups |
| Reserve the Fire Effect for Test passed | Celebrate a low score — low score is calm, no glow, no red |
| Use `{colors.input-border}` for any boundary that marks a control | Rely on `{colors.border}` or `{colors.muted}` alone to show a control or a state |
| Keep `{colors.streak-vivid}` for flames and decoration | Put text on `{colors.streak-vivid}` |
| Cap 3D tilt at ~25° and the Score Badge at one turn | Spin or Z-rotate large objects, or scroll-scrub an outcome (score, badge, pass/fail) |
| Animate glows via a pseudo-element's opacity/transform | Animate `box-shadow` or `filter: blur()` in loops |
| Write Excel menus and functions exactly as English Excel shows them (`Data > Remove Duplicates`, `SUMIFS`) | Translate Excel names into Indonesian |
| Show "El Zavier" / "EZ" for the user | Ship renderer placeholder names ("Fatahillah", "FA") |
| Use level names from the curriculum: 1 Fondasi, 2 Logika, 3 Hitung bersyarat, 4 Cari data, 5 Rapikan data, 6 Rumus modern, 7 Pivot, 8 Lintas file, 9 Summary, Ujian Akhir | Use renderer names ("Dasar sel & rumus", "Fungsi dasar", "Lookup data") |
| Treat the Excel logo as a private-use asset (Microsoft trademark) | Ship the Excel logo if the app is ever shared — swap for an own spreadsheet glyph |
