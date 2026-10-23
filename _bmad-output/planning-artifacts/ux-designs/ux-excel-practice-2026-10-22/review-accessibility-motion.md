# Review — Accessibility & Motion lens

Scope: `DESIGN.md`, `EXPERIENCE.md` (spines), intent from `.memlog.md`, chosen renders `.working/direction-c-level-journey.html` and `.working/direction-b-hero-streak.html`. Read-only review; spines not edited. Contrast values were recomputed with the WCAG 2.x relative-luminance formula from the frontmatter hex values; alpha tokens were composited over their actual surface.

## Overall verdict

The spines get the intent right: dark mode passes for text, the focus ring has strong contrast, status is mostly not colour-only, they use Sheet focus trapping, and a reduced-motion fallback is promised. The weak spots are where heavy motion carries meaning. The Orbit Loader is the only "in progress" signal. The Results score only settles as you scroll. Loops never stop, and the large scroll-tied 3D rotations have no in-app off switch. Light mode is **broken** for text, with more failures than the DESIGN.md table lists. The corrected token set below fixes all of them and anchors the light primary on Excel's own brand green `#107C41`.

| Section | Verdict |
|---|---|
| 1. Color contrast | **broken** (light) · adequate (dark: text strong, UI components thin) |
| 2. Motion safety | **thin** |
| 3. Keyboard & focus | **thin** |
| 4. Screen-reader semantics | **thin** |
| 5. Phone performance | **thin** |
| 6. Language | **thin** |

Findings: **0 critical · 9 high · 18 medium · 11 low** (38 total).

---

## 1. Color contrast — broken (light) / adequate (dark)

Recomputed matrix (T = text pair, needs 4.5:1, or 3:1 at ≥24px / ≥18.66px bold; U = UI component or graphic, needs 3:1):

| Pair (where it is used) | Kind | Dark | Light (current) |
|---|---|---|---|
| foreground / background | T | 18.12 | 15.46 |
| foreground / card | T | 16.49 | 16.83 |
| foreground / muted (kbd, hover nav) | T | 15.18 | 14.40 |
| foreground / destructive-soft (Wrong Answer reason) | T | 13.84 | 13.68 |
| muted-foreground / background (captions, Exam Timer) | T | 6.62 | 4.66 |
| muted-foreground / card (labels, meta, inactive nav) | T | 6.02 | 5.07 |
| muted-foreground / muted (hover nav item, pending "?") | T | 5.54 | **4.34 ✗** |
| primary-foreground / primary (button label, active nav, active node numeral) | T | 9.52 | **3.27 ✗** |
| primary / background (links, "YOU ARE HERE") | T | 9.82 | **3.01 ✗** |
| primary / card (callout key, "passed" status caption, Records colon) | T | 8.93 | **3.27 ✗** |
| primary / accent (check icon on passed Level Node) | U | 7.20 | **2.91 ✗** |
| streak / background | T | 7.47 | **2.99 ✗** |
| streak / card (Streak Hero gradient end) | T-large | 6.80 | 3.25 (passes as large text only) |
| **streak / streak-soft (Streak Chip, Streak Risk Pill, Week Strip done)** | T | 5.52 | **2.77 ✗ (fails even 3:1)** |
| primary-foreground / streak (Score Badge back face; today-done dot glyph) | T | 7.25 | 3.25 (passes as large text; small glyph ✗) |
| warning / card (Under Construction Tag, "−5") | T | 11.13 | 5.19 |
| warning / background | T | 12.22 | 4.77 |
| warning / warning-soft (Hint Button) | T | 8.15 | **4.29 ✗** |
| warning / uc-hatch (Under Construction node stroke) | U | 7.32 | 4.06 |
| success / card | T | 10.18 | 5.02 |
| success / success-soft | T | 7.60 | **4.14 ✗** |
| destructive / background (Login error text) | T | 6.50 | **4.37 ✗** |
| destructive / card | T | 5.92 | 4.76 |
| destructive / destructive-soft (Wrong Answer "✗") | T | 4.96 | **3.87 ✗** |
| chart-2 / card (Freeze Pill text) | T | 9.53 | **3.24 ✗** |
| chart-2 / chart-2 at 10–14% over card (Freeze Pill's own fill) | T | 7.3–7.9 | **2.8–2.9 ✗** |
| ring / background, card, muted (focus) | U | 15.2–18.1 | 14.4–16.8 |
| primary / card (active node, done pips, progress bar) | U | 8.93 | 3.27 |
| muted-foreground / card (locked node stroke) | U | 6.02 | 5.07 |
| **border / card (Input, Upload Dropzone, Kbd boundary)** | U | **1.26 ✗** | **1.41 ✗** |
| **muted / card (Theme Toggle selected segment, pending Practice Pip)** | U | **1.09 ✗** | **1.17 ✗** |
| accent / card (non-peak Activity Chart bar) | U | 1.24 (mitigated by primary inner line) | 1.13 (same) |
| Streak Hero numeral, at-risk dim (opacity .85 + saturate .55), streak end on card | T-large | 5.23 | **2.78 ✗** |
| white "EZ" initials on avatar gradient primary → chart-3 (if white) | T | — | **3.27 → 3.09 ✗** |

The `*-soft` and `uc-hatch` derivations in the frontmatter are correct: I reproduced each one exactly as role 14% or 18% over card.

- **[high]** Light mode fails AA for normal text across core components: the Primary Button label (3.27), links and "YOU ARE HERE" (3.01), the Streak Chip and Streak Risk Pill (2.77), the Freeze Pill (3.24), the Login error (4.37), and every status-on-soft pair (3.87–4.29) (DESIGN.md → Colors; frontmatter `*-light`). *Fix:* adopt the corrected light-token table below. Every text pair then reaches ≥4.5:1 and every UI pair ≥3:1, and the soft-fill rule stays at 14%.
- **[high]** The DESIGN.md contrast table measures the wrong surface for some pairs and leaves out others. The Streak Chip text sits on `streak-soft`, not `background`: 2.77 in light, which is below even the 3:1 large-text floor. Also missing from the table: destructive on background (Login error, 4.37), chart-2 Freeze Pill text (3.24 on card, 2.9 on its own teal fill), muted-foreground on muted (4.34, hover nav), the at-risk dimmed numeral (2.78), primary on accent for the passed-node check (2.91 UI), white on streak for the Week Strip today-done glyph (3.25 small), and the avatar initials (DESIGN.md → Colors, contrast table). *Fix:* replace the table with the full pair matrix above, measured on the surface each component actually uses.
- **[medium]** "Dark mode passes everywhere" holds for text only; UI components fail 1.4.11. Input and Upload Dropzone boundaries in `border` reach 1.26 on card. The Theme Toggle's selected segment and pending Practice Pips (`muted` on card) reach 1.09, so the selected or pending state is effectively invisible (DESIGN.md → Components: Theme Toggle, Practice Pips, Upload Dropzone; shadcn `Input`). *Fix:* add an `input-border` token, dark `#5F6B64` (3.19 on card / 3.50 on background) and light `#86868B` (3.62 / 3.33), for Input, Dropzone and Kbd. Keep `border` for card separation, which is decorative. Mark the selected Theme Toggle segment with a 2px `primary` ring or a filled icon plus `aria-pressed`. Draw pending pips with a 1.5px `muted-foreground` outline.
- **[medium]** The at-risk numeral dimming (opacity .85 plus saturate .55 in the render) pushes the light streak end to 2.78 on card, under the 3:1 large-text floor, in the very state the phone exists to show (EXPERIENCE.md → State Patterns "Streak at risk"; DESIGN.md → Streak Risk Pill). *Fix:* dim by desaturation only, keep opacity at or above .85 against the corrected tokens (4.35 with `#B93D07`), and add "dims to ≥3:1" as an explicit rule.
- **[low]** The `label` token (10.5px uppercase mono, 700) passes on ratio but is very small for eyebrows that carry meaning, such as "YOU ARE HERE" and the Under Construction Tag (DESIGN.md → typography.label). *Fix:* set an 11–12px floor, or limit 10.5px to purely decorative eyebrows.

### Corrected light-mode tokens (contrast fails → proposed)

The soft fills keep the 14% rule and `uc-hatch` keeps 18%. Glows stay vivid because they are decorative and carry no contrast requirement. Dark tokens are unchanged.

| Token | Current | Proposed | Verified ratios |
|---|---|---|---|
| `primary-light` | `#13A35A` | **`#107C41`** (Excel brand green) | white label 5.27 · on background 4.84 · on card 5.27 · on accent 4.68 · on muted 4.51 |
| `primary-foreground-light` | `#FFFFFF` | `#FFFFFF` (keep) | 5.27 on new primary |
| `primary-edge-light` | `#0C6A3A` | **`#0A512A`** (new primary darkened 35%) | — |
| `chart-1-light` | `#13A35A` | **`#107C41`** | follows primary |
| `glow*-light` | `#13A35A` + alpha | keep (decorative halo) | n/a |
| `streak-light` | `#F2600C` | **`#B93D07`** | background 5.17 · card 5.62 · new streak-soft 4.56 · white on it 5.62 · at-risk dim 4.35 |
| `streak-soft-light` | `#FDE9DD` | **`#F5E4DC`** | — |
| `streak-glow*-light` | `#F2600C` + alpha | keep; add `streak-vivid-light: #F2600C` for the Fire Effect and decoration only, never for text | n/a |
| `warning-light` | `#A15C00` | **`#8F5200`** | background 5.71 · card 6.22 · soft 5.07 · uc-hatch 4.78 |
| `warning-soft-light` | `#F2E8DB` | **`#EFE7DB`** | — |
| `uc-hatch-light` | `#EEE2D1` | **`#EBE0D1`** | — |
| `success-light` | `#15803D` | **`#137535`** | card 5.80 · soft 4.75 |
| `success-soft-light` | `#DEEDE4` | **`#DEECE3`** | — |
| `destructive-light` | `#D92D45` | **`#BE233B`** | background 5.52 (Login error) · card 6.01 · soft 4.78 |
| `destructive-soft-light` | `#FAE2E5` | **`#F6E0E4`** | foreground on it 13.38 |
| `chart-2-light` (freeze) | `#0E9F9E` | **`#0B7473`** | card 5.59 · background 5.13 · teal 14% fill 4.59 |
| `muted-foreground-light` | `#6E6E73` | **`#636368`** | muted 5.11 · background 5.49 · card 5.97 |
| `chart-3-light` | `#65A30D` | **`#4D7C0F`** (only needed if text sits on it, e.g. white "EZ" on the avatar gradient → 4.99) | — |
| *new* `input-border` | — | dark **`#5F6B64`** / light **`#86868B`** | 3.19 / 3.62 on card |

With these values the light-mode Streak Hero gradient runs `#8F5200` → `#B93D07`, at 6.22 → 5.62 on card.

---

## 2. Motion safety — thin

What is good: the blanket `prefers-reduced-motion: reduce` rule, static final frames for the 3D scenes, a static fallback when scroll-timeline is unsupported, a calm low-score variant, and scroll-timeline in place of JS scroll-jacking. The renders already collapse the 300vh scene under reduced motion.

- **[high]** Outside reduced-motion mode, the Orbit Loader animation is the only thing that says "the exam is running; the web is waiting for your file". The text "Lagi dikerjakan di Excel…" only appears as the reduced-motion fallback (EXPERIENCE.md → Accessibility Floor; Interaction Primitives → Orbit Loader). *Fix:* always show a visible status line under the orbit as `role="status"`, e.g. "Lagi dikerjakan di Excel… Klik Selesai di file kalau sudah." Treat the orbit as decorative (`aria-hidden`).
- **[high]** Several loops run forever beside interactive content with no way to pause them: the active-node pulse rings, `glowBeat` on the phone's active node, the Streak Risk Pill pulse (2.4s), and the Orbit Loader, which can run up to 60 minutes next to the Hint and Upload controls. That fails WCAG 2.2.2 Pause, Stop, Hide (Level A) for anyone without the OS reduce-motion flag (EXPERIENCE.md → Interaction Primitives "Active pulse", Orbit Loader). *Fix:* add a "Reduce motion" setting (Settings → Appearance, default = follow OS) and honour it everywhere. Let pulses run three cycles, then settle into a static ring or border. Add a small pause control on the exam screen, or settle the orbit after about 30 s.
- **[high]** The Results score is scroll-scrubbed. The Score Badge "rotates in 3D (two full turns) as the score counts up" inside the scroll scene, so the final score, the core outcome, only settles once you scroll through the stage. This also contradicts the time-based Score Badge spec, and the "aria-live once count-up finishes" rule may never fire (EXPERIENCE.md → Interaction Primitives "Results" scene vs Component Patterns "Score Badge"). *Fix:* run the score count-up on load, time-based and ≤1.5s, with the final score also as static text in the Results `<h1>`. If the Results scroll scene stays, make it decorative and place it after the score, wrong answers and Tips.
- **[high]** Several scroll-tied, full-viewport effects are textbook vestibular triggers: the Level Map board goes from `rotateX(62°) rotateZ(−28°) translateY(120px) scale(.8)` to flat; the laptop rotates and opens its lid; the Excel logo turns; the Score Badge spins 720°. All run inside a 300vh sticky stage, and the OS flag is the only off switch (EXPERIENCE.md → Scroll-driven 3D; render C `@keyframes boardFlat`, `spin`). *Fix:* drop `rotateZ`, cap tilt at about 25° and the badge at one turn, and cap the stage at about 150vh. Add a "Skip intro" link. Respect the in-app Reduce motion setting. Consider playing the scene once per day and showing the static frame on later visits.
- **[medium]** The reduced-motion spec covers only the 3D scenes, count-ups, orbit and fire. It doesn't define the reduced-motion state for the other animated elements (EXPERIENCE.md → Accessibility Floor). *Fix:* add this table:

  | Element | Reduced-motion state |
  |---|---|
  | Staggered entrance / Node pop / Login fade-slide | Content visible at final position; optional ≤150ms opacity fade; no blur, no scale |
  | Streak Hero entrance (rise + blur) + count-up | Final numeral immediately; no blur |
  | Trail draw | Trail fully drawn |
  | Active pulse / glowBeat / Streak Risk Pill pulse | One static ring / static `streak-glow-strong` border |
  | Chart grow | Bars at full height |
  | Hover scale + glow (cards, nodes, button) | No scale or lift; glow and border change only |
  | Drawer / Sheet slide (bouncy overshoot) | Instant, or ≤150ms fade, no overshoot |
  | Level Callout float | Static |
  | Tips Carousel snap / arrow scroll | `scroll-behavior: auto` |
  | 3D Scroll Scene | Final frame, stage height collapses (no 300vh dead scroll), not sticky |
  | Score Badge spin / Fire Effect | Face-up badge, final score / static "Level N unlocked!" headline |
  | Orbit Loader | Rings and dots stationary + always-on status text |
  | Exam → Results auto-navigation | No page transition; focus moves to Results `<h1>` |

- **[medium]** Nothing guards against flashing. The Fire Effect's flame flicker has no frequency limit. The two-turn Score Badge alternates a large green front face and a saturated red-orange back face, and a fast scroll can scrub four face flips in under a second, which risks breaching the general-flash and red-flash thresholds (WCAG 2.3.1) (DESIGN.md → Fire Effect, Score Badge). *Fix:* spec flame flicker at ≤3 luminance changes per second with low amplitude and the flame area under about 25% of the viewport. Run the badge spin on time (≥1.2s per turn, at most one turn), never scroll-scrubbed.
- **[low]** On Results, celebration versus calm is a mood. Make sure the pass or fail outcome is always stated in text and never depends on fire or glow being visible (EXPERIENCE.md → State Patterns Results). *Fix:* the Results heading always states the outcome, e.g. "Test lulus — 88/100" or "Belum lulus — butuh 80". "Level N unlocked!" renders even when the Fire Effect is skipped. (The streak-at-risk pulse is already backed by text and time, so that is fine.)

---

## 3. Keyboard & focus — thin

What is good: the focus ring token has 14–18:1 contrast in both modes with a 3px offset, Level Nodes are buttons opened with `Enter`, `Tab` follows reading order, `Esc` closes Sheets, the shadcn Sheet traps focus, there are no custom shortcuts, and native scrolling is used (no scroll-jacking).

- **[high]** On Level Map, the 300vh sticky 3D stage comes before the real map and has nothing focusable, so keyboard users have to Space or PageDown through about three screens of animation before reaching a node. If the scene's board copy is focusable or exposed, nodes get duplicated (EXPERIENCE.md → Scroll-driven 3D "Level Map"). *Fix:* make the first focusable element a "Skip intro → levels" link. Mark the scene `aria-hidden="true"` and `inert`, so the board copy never has focusable nodes. Optionally collapse the stage after the first view.
- **[medium]** Level Path tab order and semantics aren't specified for a winding SVG with 10 nodes before the rail. The phone render lists the rail top-down from Under Construction to Level 1, the reverse of the level order (EXPERIENCE.md → Level Path, Level Node; render C phone `.vpath`). *Fix:* use DOM order Level 1 → Ujian Akhir as an `<ol>` of buttons inside `nav aria-label="Level path"`, put the Level Callout's Primary Button straight after the active node in the DOM, and consider a roving tabindex (one tab stop, arrow keys) so the rail is reachable. On phone, keep visual order and DOM order the same; don't reverse the order only with CSS.
- **[medium]** Focus rings on SVG nodes aren't solved. `outline` on SVG `<g>` is inconsistent, the map card's `overflow:hidden` can clip a 3px offset, and the white ring sits on green glow halos (DESIGN.md → Level Node; EXPERIENCE.md → Accessibility Floor focus ring). *Fix:* draw the focus indicator as an SVG circle (r + 5, 2px `ring`) shown on `:focus-visible`. Apply the hover scale on focus too. Leave room for it inside the card padding.
- **[medium]** Focus Not Obscured (WCAG 2.4.11, AA, new in 2.2): the pinned Phone Dock (about 150px with its stats row), the sticky 68px Header Bar and the floating Level Callout can cover focused elements (DESIGN.md → Phone Dock, Header Bar, Level Callout). *Fix:* set `scroll-padding-top: 68px` and `scroll-padding-bottom` to the dock height, and keep the Callout out of the way of other nodes, or close it while a different node has focus.
- **[medium]** Hint Button focus behaviour is undefined. Each activation costs 5 points, so a double `Enter` silently takes −10. When the quota reaches 0 the button is hidden and focus drops to `<body>` (EXPERIENCE.md → Hint Button; State "Hint quota used"). *Fix:* after a reveal, move focus to the new hint text (`tabindex="-1"`) or debounce for about 800ms. When the quota is used up, keep a disabled-looking `aria-disabled` button with the reason ("No hints left for this attempt.") so focus stays put.
- **[medium]** The Hint Button and Upload Dropzone are only described as "small", with no size, and they are the only actions on the exam screen (DESIGN.md → Hint Button, Upload Dropzone; WCAG 2.5.8). *Fix:* make the hit area at least 24×24 CSS px (recommend 40px tall on desktop) with ≥8px between them. The Dropzone needs a real `<button>` or labelled `<input type="file" accept=".xlsm,.xlsx">` reachable by `Tab` and opened with `Enter`/`Space`; dragging stays optional (2.5.7). Announce progress and rejection (see §4).
- **[medium]** The Tips Carousel pattern is underspecified ("arrows move"), and the Accessibility Floor gives Tips Cards a focus ring, which suggests they are tab stops even though they are not interactive (EXPERIENCE.md → Tips Carousel; Accessibility Floor). *Fix:* make the scroller `role="region" aria-roledescription="carousel" aria-label="Tips"` with `tabindex="0"`, so arrow keys work once it has focus. Add visible Prev/Next buttons (≥24px; ≥44px on phone) and a polite "Tip 3 of 8" status. Cards are not tab stops unless they contain links. No auto-advance. Use `scroll-margin` so the edge fade never hides the current card.
- **[low]** The Drawer and the Level Detail Panel don't specify where focus goes on open or close. In the render the drawer close button is 34px, under the 44px phone floor (EXPERIENCE.md → Mobile Drawer, Level Detail Panel). *Fix:* on open, focus the Sheet heading or the first item; on close, return focus to the menu button or the node that opened it. Close buttons ≥44px on phone.
- **[low]** On phone, "Use freeze" turns the Freeze Pill into an action that spends quota. The render pill is about 31px tall (EXPERIENCE.md → Freeze Pill; Accessibility Floor tap targets ≥44px). *Fix:* make it a real `<button>` at least 44px tall. Keep it focusable with `aria-disabled` and the reason in `aria-describedby` when the quota is used.
- **[low]** The Theme Toggle has no keyboard or semantics spec, and the Activity Chart tooltip (hover and focus) doesn't follow WCAG 1.4.13 (DESIGN.md → Theme Toggle; EXPERIENCE.md → Activity Chart). *Fix:* make the toggle a `radiogroup` (Dark/Light) or a pair of `aria-pressed` buttons. Make tooltips dismissible with `Esc`, hoverable and persistent; better still, provide a screen-reader-only table of the 7 days rather than making each bar a tab stop.

---

## 4. Screen-reader semantics — thin

What is good: the Level Node accessible names are specified, the Results outcome is announced, and Wrong Answer Rows, Under Construction and freeze carry text and icons, not colour alone.

- **[high]** Count-up numbers have no requirement to expose their final value. The renders build them from a CSS `@property` counter in `::after` with `aria-label` on a role-less `<span>`, which screen readers expose unreliably and may read as "0" or nothing. This affects the Streak Hero, Stat Cards, Score Badge and Records (EXPERIENCE.md → Count-up; renders `.cu`). *Fix:* keep the real final number in the DOM as text, visible or `sr-only`, with the animated digits `aria-hidden="true"`. Write this as a rule in the Count-up primitive.
- **[medium]** Results is reached by auto-navigation from the exam screen, and a live region injected along with new page content is announced unreliably (EXPERIENCE.md → Accessibility Floor "aria-live once count-up finishes"; Orbit Loader auto-move). *Fix:* on route change, set the document `<title>` and move focus to the Results `<h1>` carrying the outcome ("Skor 88/100 — Test lulus. Level 4 unlocked!"). Keep live regions for changes within a page.
- **[medium]** There is no aria-live inventory, so announcements are either missing or likely to spam. *Fix:* use polite announcements for hint revealed plus hints left, upload started and done, freeze used ("Streak aman — Freeze 0/2 minggu ini", the J3 climax), and Settings saved. Use `role="alert"` for the file-rejected message and Login errors. Sonner toasts already announce. **Never** announce count-up ticks, the per-second Exam Timer (announce only at 10, 5 and 1 minutes left), the Streak Risk countdown ticks, or the orbit.
- **[medium]** Hiding decoration isn't specified. The rule "the real map/score is always in the DOM" implies that duplicate scene copies exist (EXPERIENCE.md → 3D Scroll Scene). *Fix:* mark these `aria-hidden="true"` (plus `inert` where they contain copies of controls): the 3D laptop, the Excel logo, the scene board and badge copies, the Orbit rings and dots and centre logo, the Fire Effect, the glows and pulse rings, the grid background, and the A–J column-letter strip.
- **[medium]** Some states are still conveyed by colour or shape alone. The Week Strip uses single-letter days, has no defined "missed day" state, and distinguishes done from today-done by fill. Practice Pips separate done, next and pending by colour and hatch. Theme Toggle selection is a fill only. The Activity Chart marks its peak and freeze day by colour (DESIGN.md → Week Strip, Practice Pips, Activity Chart). *Fix:* give each Week Strip day an accessible name ("Senin: selesai", "Rabu: freeze", "Hari ini: belum") and define a visible missed-day state. Make the "4/5 practices done" text mandatory wherever pips appear. Add `aria-pressed` to the toggle. Give the chart a text summary or table.
- **[low]** Glyphs and emoji such as "🔥" in "day streak 🔥", "✗", "✓", "❄" and the arrow in menu paths are read inconsistently ("multiplication x", "fire") (DESIGN.md → Streak Hero, Wrong Answer Row). *Fix:* mark them `aria-hidden` and pair each with text ("Salah", "Freeze"). Give the Hint Button an accessible name such as "Hint, minus 5 points, 2 left".
- **[low]** Small semantic gaps remain. *Fix:* use `aria-current="page"` on the active nav item and `aria-current="step"` on the active Level Node, put the locked or Test-locked reason in `aria-describedby`, name the Streak Chip ("Streak 12 hari"), and give every surface its own `<title>`.

---

## 5. Phone performance — thin

What is good: there are no 3D scenes on Dashboard or Login, motion is limited to transform and opacity, no WebGL is required, and a static fallback is promised.

- **[high]** The phone's job is the streak check (J3), yet the first phone screen plays the cinematic Streak Hero entrance (rise 40px plus blur 8px, 1s, 140ms per line), a 2.2s count-up, and a large drop-shadow glow filter on a 190px gradient numeral. The true streak number appears about 2.5–3s late, and a mid-range Android is likely to drop frames (EXPERIENCE.md → Streak Hero entrance; DESIGN.md → Streak Hero). *Fix:* on phone (`max-width: 1023px` or `pointer: coarse`), render the final numeral immediately with at most a ≤300ms opacity fade. No blur filter; replace the animated drop-shadow with a static, pre-baked radial gradient.
- **[medium]** "If the device struggles, show the static frame" can't be tested (EXPERIENCE.md → Accessibility Floor phone performance; memlog assumption). *Fix:* use a deterministic rule. Show the static frame when `prefers-reduced-motion`, the in-app Reduce motion setting, `max-width: 1023px`, `pointer: coarse`, `navigator.connection.saveData` or `deviceMemory ≤ 4` applies. Lazy-load scene assets with IntersectionObserver after the map data, and never block LCP or the first interaction.
- **[medium]** The rendering technique for the "3D laptop with opening lid + 3D Excel logo" is undecided. CSS preserve-3d boxes, WebGL and a pre-rendered image sequence (the apple.com approach) cost very different amounts (DESIGN.md → 3D Scroll Scene). *Fix:* decide it now and record a budget: either a scrubbed image sequence or `<video>`, or CSS 3D with ≤6 layers; ≤300 KB of scene assets; 60fps on a mid-range phone; `will-change` only while the stage is in view.
- **[medium]** Some animations repaint on every frame: `glowBeat` and `riskPulse` animate `box-shadow` forever; the entrances animate `filter: blur()`; the Level Callout uses `backdrop-filter` over the map (renders; DESIGN.md → Level Callout). *Fix:* animate the opacity or transform of a pseudo-element glow instead of `box-shadow`, remove blur from entrances on phone, and drop `backdrop-filter` below lg (use a solid `card` fill).
- **[low]** At 190px, `display-streak-mobile` with a 3-digit streak (e.g. 365) nearly fills the 358px content width and overflows at 200% text size (WCAG 1.4.10/1.4.4) (DESIGN.md → typography.display-streak-mobile). *Fix:* use `font-size: clamp(96px, 48vw, 190px)` and test with 3-digit values.

---

## 6. Language — thin

- **[medium]** The spines set no `lang` strategy, and both renders ship `<html lang="id">` even though the UI chrome is now English (EXPERIENCE.md → Voice and Tone language split; renders line 2). Screen readers will pronounce English chrome with Indonesian rules, or the other way round. *Fix:* use `<html lang="en">` for the chrome and `lang="id"` on every Indonesian container: question instructions, hint text, Wrong Answer reasons, Tips Card bodies, full-sentence system messages (errors, empty states, streak messages, the file-rejected text), the Orbit status line, toasts, and the curriculum level names (e.g. `<span lang="id">Hitung bersyarat</span>`).
- **[low]** Accessible names mix languages, e.g. "Level 3, Hitung bersyarat, active, 4 of 5 practices done", and an `aria-label` can't carry a partial `lang` (EXPERIENCE.md → Accessibility Floor). *Fix:* build the name with `aria-labelledby` pointing at visible spans that each carry their own `lang`.
- **[low]** English Excel terms sit inside Indonesian sentences (`SUMIFS`, `Data > Remove Duplicates`, `Ctrl + T`) (EXPERIENCE.md → Voice and Tone). *Fix:* wrap functions in `<code lang="en">`, keys in `<kbd>` and menu paths in `<kbd lang="en">` so they are pronounced as English terms.
- **[low]** Day and date locale is inconsistent: the spec says Week Strip Mon–Sun, while the render shows Indonesian letters "S S R K J S M". Live regions that carry Indonesian sentences need `lang="id"` (DESIGN.md → Week Strip). *Fix:* pick one locale for days and times (and the format for the risk countdown), use full day names in accessible names, and set `lang` on each live region to match its message.
