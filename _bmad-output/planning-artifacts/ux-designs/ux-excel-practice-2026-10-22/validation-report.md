# Validation Report — WORKING HARD with EXCEL

- **DESIGN.md:** `D:\Document\Excel Practice\_bmad-output\planning-artifacts\ux-designs\ux-excel-practice-2026-10-22\DESIGN.md`
- **EXPERIENCE.md:** `D:\Document\Excel Practice\_bmad-output\planning-artifacts\ux-designs\ux-excel-practice-2026-10-22\EXPERIENCE.md`
- **Run at:** 2026-10-22T14:14:26+07:00

## Overall verdict
A downstream consumer can extract cleanly from this pair. All 56 color tokens have hex values and light pairs, every `{path}` reference resolves, all 35 component names match across both spines, and every V1 CAP is covered by a named El Zavier journey with a climax. Three high issues stand between this draft and `final`. Results breaks the CAP-5 contract by hiding correct questions. Nothing defines what happens when an attempt is running but the exam page is not open. The V1 Theme Toggle ships a light mode that DESIGN.md itself says must not ship. Finalize also has housekeeping left: nothing is promoted to `mockups/`, and both files are still `status: draft`.

The three extra reviewers make the picture worse than the rubric's mostly-adequate verdicts suggest. Accessibility & Motion recomputed every pair and found light mode broken, not just unfinished: the Primary Button label (3.27), links (3.01) and the Streak Chip (2.77, failing even 3:1) all fail, so the reviewer supplies a corrected light token set anchored on Excel green #107C41. It also finds that heavy motion carries meaning. The Orbit Loader is the only "exam running" signal, the Results score only settles as you scroll, loops never stop (WCAG 2.2.2), and the large scroll-tied 3D rotations have no in-app off switch. Spec consistency says "revise before handoff": the attempt lifecycle and end states are where the spine pair departs from the spec. There is no repeat path once items are complete (critical: records can never be beaten, and the streak dies after ~24 V1 attempts), no route back to a running attempt, no in-Excel UX, no V1 end state after the Level 4 Test, and no home for CAP-15. Reference reconciliation adds mostly low-severity detail lost from the v0 imports, such as the login error lifecycle, orbit geometry and entrance orchestration. After de-duplication: 1 critical, 15 high, 33 medium, 43 low.

## Category verdicts
- Flow coverage — strong
- Token completeness — adequate
- Component coverage — adequate
- State coverage — adequate
- Visual reference coverage — adequate
- Bloat & overspecification — adequate
- Inheritance discipline — adequate
- Shape fit — strong

Extra reviewers: Accessibility & Motion (color contrast broken in light, all other lenses thin) · Spec consistency (revise before handoff) · Reference reconciliation (detail lost from v0 imports, no structural loss).

## Findings by severity

After de-duplication across all four reviewers: **1 critical · 15 high · 33 medium · 43 low**. Tags list every reviewer that raised the finding.

### Critical (1)

**[Spec consistency]** — No repeat path once items are complete: records can't be beaten and the streak dies when V1 content runs out (EXPERIENCE.md § Component Patterns › Level Detail Panel, Practice Pips, Level Callout; SPEC CAP-9/10/11)  
The Level Detail Panel only offers "Start for the next item", Practice Pips cap at 5, and a passed Test has no retake. CAP-11 ("a faster attempt replaces the record") can never happen once an item is done. After ~24 V1 attempts (4 levels × 5 practices + 1 Test) nothing is startable, so CAP-10's daily streak cannot be kept. The spec is silent on attempts beyond 5 practices or after passing.  
Fix: Add "Practice again" on completed practice rows and "Retake Test" on a passed Test row. Repeats count for streak and records, not for Pips or the gate. Once a level is complete, the Level Callout's Primary Button becomes "Practice again". Flow the rule back to the spec (candidate 12).  
Sources: Spec consistency (critical)

### High (15)

**[Token completeness + Accessibility & Motion]** — Light mode ships in V1 with tokens that fail WCAG AA (DESIGN.md § Colors (frontmatter `*-light`); EXPERIENCE.md § Foundation, § Component Patterns › Theme Toggle)  
The Theme Toggle commits light mode to V1, while DESIGN.md § Colors says "do not ship light mode before resolving" its AA failures. Recomputed light ratios: Primary Button label 3.27, links and "YOU ARE HERE" 3.01, Streak Chip and Streak Risk Pill 2.77 (fails even 3:1), Freeze Pill 3.24, Login error 4.37, every status-on-soft pair 3.87–4.29. A developer will build the toggle on failing tokens.  
Fix: Adopt the corrected light-token table in review-accessibility-motion.md §1: `primary-light` #107C41 (Excel green), `streak-light` #B93D07, `warning-light` #8F5200, `success-light` #137535, `destructive-light` #BE233B, `chart-2-light` #0B7473, `muted-foreground-light` #636368, with soft fills kept on the 14% rule and a new `streak-vivid-light` #F2600C for decoration only. Every text pair then reaches ≥4.5:1. Otherwise, remove light mode and the Theme Toggle from V1.  
Sources: Rubric › Token completeness (high); Accessibility & Motion (high)

**[Token completeness + Accessibility & Motion]** — Contrast table measures the wrong surfaces and omits state-bearing pairs (DESIGN.md § Colors › contrast table; § Components › Streak Chip, Freeze Pill, Level Node, Week Strip)  
Streak Chip text sits on `streak-soft`, not `background` (2.77 in light). Missing rows: destructive on background (Login error, 4.37), chart-2 Freeze Pill text (3.24 on card, ~2.9 on its own teal fill), muted-foreground on muted (4.34, hover nav), the at-risk dimmed numeral (2.78), primary on accent for the passed-node check (2.91, UI), white on streak for the Week Strip today-done glyph (3.25, small), and the avatar initials (3.09–3.27).  
Fix: Replace the table with the full pair matrix from review-accessibility-motion.md §1, measured on the surface each component actually uses, and re-verify after the token fix.  
Sources: Rubric › Token completeness (medium); Accessibility & Motion (high)

**[Inheritance discipline + Spec consistency + Token completeness]** — Results lists only wrong questions, which breaks CAP-5 "every question shows its reason" (EXPERIENCE.md § Component Patterns › Wrong Answer Row; § Inspiration "Rejected"; DESIGN.md § Colors `success`; SPEC CAP-5, exam-bridge)  
CAP-5 success says "setiap soal menampilkan alasannya" and exam-bridge says "benar/salah dan alasannya". Results says "Correct questions are not listed", and Inspiration explicitly rejects listing them. The Tips Carousel covers every question but gives no verdict. The memlog resolved the CAP-8 tension but never CAP-5, so a CAP-5 acceptance test will fail. DESIGN's `success` role ("Correct marks in Results") has nothing to mark.  
Fix: Either add a collapsed "Correct (n)" group with ✓ and a one-line reason per question (this also gives `success` its use site), or amend CAP-5 through correct-course to "every wrong question shows its reason; correct questions are counted" (spec candidate 3). Don't leave both documents as they are.  
Sources: Rubric › Inheritance discipline (high); Spec consistency (high, low); Rubric › Token completeness (low)

**[State coverage + Spec consistency + Reference reconciliation]** — Active-attempt lifecycle undefined: no route back to a running attempt (EXPERIENCE.md § State Patterns "Active attempt exists", "Signed out / session expired"; § Open Questions)  
The J0, J1 and J4 climaxes depend on the exam page being open to move to Results by itself (CAP-3). Upload (CAP-4, "must always work") lives only on that transient screen. Unspecified: tab closed or navigated away mid-attempt; a graded result arriving while on Dashboard or the other device (CAP-12); pressing Start while an attempt is open; reloading Exam in progress; session expiry mid-exam (the global redirect to Login strands the auto-move, and hints and upload need auth, CAP-17); re-downloading a lost file; abandoning. The v0 Tasko logout confirm (T39) only makes sense in this context too.  
Fix: Decide before architecture. Add a persistent "Attempt in progress — Back to exam" banner (Header Bar, Level Callout, Dashboard) and a "Result ready" Toast or route. Start becomes "Resume exam" while an attempt is open, and the exam page rehydrates from the server on load. Keep the session alive on Exam in progress and return to the attempt after re-login. Add "Download file again" and "Abandon attempt" (with a spec rule on whether it counts). Optionally confirm Log out while an attempt is active. Add the lifecycle to the spec (candidate 13).  
Sources: Rubric › State coverage (high, medium); Spec consistency (high); Reference reconciliation (T39)

**[Spec consistency]** — The in-Excel half of the bridge has no UX (EXPERIENCE.md § Component Patterns, § State Patterns (upload rejection only); SPEC CAP-3, CAP-18)  
The `.xlsm` is a user-facing surface (scenario, data, perintah soal, Selesai button). Nothing covers its layout, the button label (still an Open Question), or what the macro shows on sent, send failed (offline, server down) or rejected under CAP-18 (already graded, unknown token). CAP-18 requires a rejection with a reason on the macro path too. Today the user clicks Selesai, Excel closes, and the browser keeps orbiting.  
Fix: Add an "In-file (.xlsm)" surface: instructions-sheet layout, button label, and MsgBox copy for sent / send failed ("Upload file lewat web, ya") / rejected (with reason). Don't close the workbook on failure. The exam screen also shows a macro-path rejection when it learns of one.  
Sources: Spec consistency (high)

**[Spec consistency]** — No V1 end state after passing the Level 4 Test (EXPERIENCE.md § State Patterns › Results "Test passed"; § Component Patterns › Fire Effect, Level Callout)  
"Level N unlocked!" after the Level 4 Test announces Level 5, which CAP-1 says is Under Construction and not startable. The Dashboard Level Callout and Primary Button have no next target once all V1 levels are passed.  
Fix: Add a "Test passed — next level under construction" variant (Fire still plays; "Level 4 done! Level 5 is under construction"). Add a Dashboard "all available levels done" state whose Callout says "Keep your streak — practise any level", with the Primary Button set to "Practice again" (ties to the critical repeat-path finding).  
Sources: Spec consistency (high)

**[Flow coverage + Spec consistency]** — CAP-15 co-authoring side track has no Under Construction home (EXPERIENCE.md § Key Flows intro, § Information Architecture; DESIGN.md § Components › Level Path)  
Key Flows claims CAP-13/14/15 "appear only as Under Construction states", and level-curriculum puts the co-authoring side track on the level map with phase Next ("level berfase Next tampil di peta dengan label Under Construction"). No surface, IA row, Level Path node, card or sidebar item carries CAP-15.  
Fix: Add a side-track branch card beside the Level Path, separate from the trail and the gate as CAP-15 requires, with an Under Construction Tag. Optionally add a disabled "Co-authoring" sidebar entry. Or drop CAP-15 from the coverage claim.  
Sources: Rubric › Flow coverage (low); Spec consistency (high)

**[Spec consistency]** — Setup Guide and J0 skip where the downloaded file must live (EXPERIENCE.md § Component Patterns › Setup Steps; § Key Flows › J0 steps 5–6; SPEC Assumptions; exam-bridge "File sumber")  
Trusted Location only enables macros for files opened from that folder. Browser downloads land in Downloads, and Unblock is a per-file action, not the "one-time" setup CAP-16 promises. The spec assumes one fixed working folder that doubles as the Trusted Location, which Level 8 and Ujian Akhir also rely on. J0 jumps from the download (step 5) straight to Selesai working (step 6), and that jump is the CAP-16 success test.  
Fix: Setup Steps name the fixed folder and add a step that makes the browser save there (or "ask where to save"). The exam screen shows a one-line folder reminder, and J0 gets a "save into folder" step. Promote the folder assumption to a V1 decision (candidate 17).  
Sources: Spec consistency (high)

**[Accessibility & Motion]** — The Orbit Loader animation is the only "exam is running" signal (EXPERIENCE.md § Accessibility Floor; § Interaction Primitives › Orbit Loader)  
Outside reduced-motion mode, the orbit is the only thing that says "the exam is running; the web is waiting for your file". The text "Lagi dikerjakan di Excel…" appears only as the reduced-motion fallback.  
Fix: Always show a visible `role="status"` line under the orbit, e.g. "Lagi dikerjakan di Excel… Klik Selesai di file kalau sudah.", and treat the orbit as decorative (`aria-hidden`).  
Sources: Accessibility & Motion (high)

**[Accessibility & Motion]** — Loops run forever beside interactive content with no pause (WCAG 2.2.2, Level A) (EXPERIENCE.md § Interaction Primitives › Active pulse, Orbit Loader; DESIGN.md § Components › Streak Risk Pill)  
The active-node pulse rings, `glowBeat` on the phone's active node, the 2.4s Streak Risk Pill pulse and the Orbit Loader (up to 60 minutes next to Hint and Upload) never stop. Anyone without the OS reduce-motion flag has no way to pause them.  
Fix: Add a "Reduce motion" setting (Settings › Appearance, default follows OS) and honour it everywhere. Pulses run three cycles, then settle to a static ring or border. Add a small pause control on the exam screen, or settle the orbit after ~30s.  
Sources: Accessibility & Motion (high)

**[Accessibility & Motion]** — The Results score only settles as you scroll (EXPERIENCE.md § Interaction Primitives › Results scene vs § Component Patterns › Score Badge)  
The Score Badge "rotates in 3D (two full turns) as the score counts up" inside the scroll scene, so the core outcome only settles once you scroll through the stage. This contradicts the time-based Score Badge spec, and "aria-live once count-up finishes" may never fire.  
Fix: Run the count-up on load, time-based and ≤1.5s, with the final score also as static text in the Results `<h1>`. If the scroll scene stays, make it decorative and place it after the score, the wrong answers and Tips.  
Sources: Accessibility & Motion (high)

**[Accessibility & Motion]** — Full-viewport, scroll-tied 3D rotations are vestibular triggers with only the OS flag as an off switch (EXPERIENCE.md § Interaction Primitives › Scroll-driven 3D; DESIGN.md § Components › 3D Scroll Scene)  
The Level Map board goes from `rotateX(62°) rotateZ(−28°) translateY(120px) scale(.8)` to flat, the laptop rotates and opens its lid, the Excel logo turns, and the Score Badge spins 720°. All of it runs inside a 300vh sticky stage.  
Fix: Drop `rotateZ`, cap tilt at ~25° and the badge at one turn, and cap the stage at ~150vh. Add a "Skip intro" link and respect the in-app Reduce motion setting. Consider playing the scene once per day and showing the static frame on later visits.  
Sources: Accessibility & Motion (high)

**[Accessibility & Motion]** — Keyboard users must page through ~3 screens of animation before reaching a Level Node (EXPERIENCE.md § Interaction Primitives › Scroll-driven 3D "Level Map")  
The 300vh sticky stage comes before the real map and has nothing focusable. If the scene's board copy is focusable or exposed, nodes are duplicated.  
Fix: Make the first focusable element a "Skip intro → levels" link. Mark the scene `aria-hidden="true"` and `inert` so the board copy never has focusable nodes. Optionally collapse the stage after the first view.  
Sources: Accessibility & Motion (high)

**[Accessibility & Motion]** — Count-up numbers don't expose their final value to screen readers (EXPERIENCE.md § Interaction Primitives › Count-up; renders `.cu`)  
No requirement exposes the final value. The renders build digits from a CSS `@property` counter in `::after`, with `aria-label` on a role-less `<span>`, which screen readers may read as "0" or skip. This affects the Streak Hero, Stat Cards, Score Badge and Records.  
Fix: Write it into the Count-up primitive: the real final number lives in the DOM as text (visible or `sr-only`), and the animated digits are `aria-hidden="true"`.  
Sources: Accessibility & Motion (high)

**[Accessibility & Motion]** — On phone, the Streak Hero entrance delays the streak number by ~2.5–3s (EXPERIENCE.md § Interaction Primitives › Streak Hero entrance; DESIGN.md § Components › Streak Hero)  
The phone exists for the streak check (J3), yet its first screen plays a cinematic rise-and-blur entrance (40px, 8px blur, 1s, 140ms per line), a 2.2s count-up and an animated drop-shadow glow on a 190px gradient numeral. A mid-range Android is likely to drop frames.  
Fix: On phone (`max-width: 1023px` or `pointer: coarse`), render the final numeral immediately with at most a ≤300ms opacity fade. Use no blur, and replace the animated drop-shadow with a static, pre-baked radial gradient.  
Sources: Accessibility & Motion (high)

### Medium (33)

**[Token completeness]** — Freeze fill has no token (DESIGN.md frontmatter `components.freeze-pill`; § Components › Freeze Pill, Week Strip)  
The Freeze Pill and the frozen Week Strip day use a "faint teal fill with teal hairline border", but there is no `chart-2-soft` or `freeze-soft` token, and `freeze-pill` has no `background`.  
Fix: Add `freeze-soft` with a light pair using the 14% rule and reference it. With the corrected `chart-2-light` #0B7473, the text reaches 4.59 on that fill.  
Sources: Rubric › Token completeness (medium)

**[Token completeness + Reference reconciliation]** — Records Card foreground undefined; the light-mode gradient undoes the "inverted" card (DESIGN.md frontmatter `components.records-card`; § Components › Records Card)  
Only the colon is specified (`{colors.primary}`). The text and digit colour is undefined. In light mode the gradient `accent-light → primary-foreground-light` (#E3F6EB → #FFFFFF) gives a near-white card, so the inversion inherited from the v0 Tasko timer card is gone and the spec contradicts itself.  
Fix: Add `records-card.foreground`. Keep the dark gradient in both modes (Reference reconciliation's preference), or state the light gradient explicitly and stop calling the card inverted.  
Sources: Rubric › Token completeness (medium); Reference reconciliation (T34)

**[Accessibility & Motion + Token completeness]** — UI component boundaries and selected/pending states fail 3:1 (WCAG 1.4.11) in both modes (DESIGN.md § Components › Theme Toggle, Practice Pips, Upload Dropzone, Level Path; shadcn Input)  
"Dark mode passes everywhere" holds for text only. `border` on card is 1.26 dark / 1.41 light (Input, Upload Dropzone, Kbd). `muted` on card is ~1.09–1.17 (Theme Toggle selected segment, pending Practice Pips), so those states are effectively invisible. The Level Path base trail (`border` on card) is ~1.3.  
Fix: Add an `input-border` token (dark #5F6B64, light #86868B) for Input, Dropzone and Kbd, and keep `border` for decorative card separation. Mark the selected Theme Toggle segment with a 2px `primary` ring or a filled icon plus `aria-pressed`. Draw pending pips with a 1.5px `muted-foreground` outline, or add a label.  
Sources: Accessibility & Motion (medium); Rubric › Token completeness (medium)

**[Accessibility & Motion]** — At-risk dimming drops the streak numeral below 3:1 (EXPERIENCE.md § State Patterns "Streak at risk"; DESIGN.md § Components › Streak Risk Pill)  
Opacity .85 plus saturate .55 pushes the light streak end to 2.78 on card. That is under the 3:1 large-text floor, in the very state the phone exists to show.  
Fix: Dim by desaturation only and keep opacity ≥.85 against the corrected tokens (4.35 with #B93D07). Write "dims to ≥3:1" as an explicit rule.  
Sources: Accessibility & Motion (medium)

**[Component coverage]** — Behavioural states with no visual spec in DESIGN (EXPERIENCE.md § Component Patterns vs DESIGN.md § Components › Freeze Pill, Primary Button, Upload Dropzone, Hint Button)  
EXPERIENCE commits states that DESIGN never draws: the Freeze Pill "Use freeze" action and disabled-with-reason state; the Primary Button disabled with a reason line below it; the Upload Dropzone uploading-progress and rejected states; and the Hint Button revealed-hint text block.  
Fix: Add each state's appearance to its DESIGN row, using existing tokens.  
Sources: Rubric › Component coverage (medium)

**[State coverage + Spec consistency]** — No state for download failure or slow/failed grading (EXPERIENCE.md § State Patterns › Exam in progress)  
Nothing covers Start or the download failing (the `.xlsm` never downloads or the browser blocks it), a generating state, or grading that takes long or fails after the file is received.  
Fix: Add "Download didn't start — Download again", plus grading-delayed and grading-failed states with retry.  
Sources: Rubric › State coverage (medium); Spec consistency (partial)

**[State coverage]** — No first-load failure state on any surface (EXPERIENCE.md § State Patterns › Any surface / Network error)  
"Network error → last loaded data stays visible" assumes data already exists. Only refresh failures are covered.  
Fix: Add a cold-load error treatment, such as an inline retry in the Skeleton area.  
Sources: Rubric › State coverage (medium)

**[Visual reference coverage]** — Chosen renders not promoted out of `.working/` (DESIGN.md § Brand & Style, § Colors; EXPERIENCE.md § IA)  
Theme 5 (color-themes-1.html) and directions B and C are linked from the `.working/` scratch folder, which is not a stable reference location. The Finalize "artifacts promoted" step was not done.  
Fix: Promote color-themes-1.html, direction-b and direction-c to `mockups/` and update the links. Leave direction-a in `.working/`.  
Sources: Rubric › Visual reference coverage (medium)

**[Visual reference coverage]** — The heaviest surfaces have no visual reference (EXPERIENCE.md § IA › Exam in progress, Results, Level Map, Level Detail Panel; .memlog.md)  
Exam in progress (Orbit Loader + Hint + Dropzone + Timer), Results (four variants, 3D scene, Fire Effect), the Level Map 3D scene and the Level Detail Panel have no visual reference. The memlog has no logged spine-only decision for them.  
Fix: Render key screens for Exam in progress and Results, or log in the memlog that they will be built from the spine alone.  
Sources: Rubric › Visual reference coverage (medium)

**[Inheritance discipline + Spec consistency]** — Editable streak time zone contradicts the spec's fixed-zone assumption (EXPERIENCE.md § IA › Settings; SPEC Assumptions (CAP-10))  
SPEC assumes one fixed zone, captured from the device at first login and shared by both devices. An editable zone moves the day boundary, which can double-count or erase a day. EXPERIENCE doesn't say what happens to today's streak, the freeze window or the at-risk countdown when the zone changes.  
Fix: Confirm with the spec owner. Show the zone read-only, or let a change take effect at the next day boundary. Record the choice in the spec (candidate 5).  
Sources: Rubric › Inheritance discipline (medium); Spec consistency (medium)

**[Spec consistency + State coverage]** — The phone can start an attempt it can never finish (EXPERIENCE.md § Component Patterns › Phone Dock; § Open Questions "Start on phone")  
The Phone Dock carries "Start Practice N". CAP-2 records the start time on Start and Excel desktop is mandatory, so a phone Start creates an unworkable attempt whose time still counts for records (CAP-11 counts failed attempts).  
Fix: Resolve the open question against the spec. On phone the Dock never starts an attempt. It reads "Start on your laptop" (informational), or "Use freeze" when the streak is at risk.  
Sources: Spec consistency (medium); Rubric › State coverage (low)

**[Spec consistency]** — One rejection message covers every CAP-18 reason (EXPERIENCE.md § Voice and Tone; § State Patterns "File rejected"; SPEC CAP-18)  
The spec lists missing identity, altered, already graded and unknown, each "dengan pesan alasan". The single verbatim message ("bukan dari percobaan yang sedang berjalan") misleads for an altered or stripped token (for example a Save As `.xlsx`) and for a re-upload after a successful macro submit. Wrong file type is unhandled.  
Fix: Write a small message set per reason, in the same tone. Keep the decided message for "other attempt", and add "sudah dinilai — lihat hasilnya di History", "identitas file rusak/hilang — jangan Save As ke .xlsx" and "bukan file Excel".  
Sources: Spec consistency (medium)

**[Spec consistency]** — Hint targeting undefined (EXPERIENCE.md § Component Patterns › Hint Button; SPEC CAP-7)  
"Each tap reveals the next hint" means a fixed sequence per attempt, so a user stuck on question 4 may spend −5 on question 1's hint. The spec only defines quota and cost.  
Fix: Add a hint picker by question number (or "hint for the question you're on"). Record the ordering rule in the spec (candidate 11).  
Sources: Spec consistency (medium)

**[Spec consistency]** — Phone collapse rule hard-codes which levels are Under Construction (EXPERIENCE.md § Responsive & Platform; DESIGN.md § Components › Level Path)  
"Level 5–9 + Ujian Akhir collapsed into one Under Construction node" has to change when CAP-13 ships levels one at a time. That conflicts with the constraint "menambah level tidak boleh mengubah … UI peta level".  
Fix: Make it data-driven: consecutive Under Construction nodes collapse into one node.  
Sources: Spec consistency (medium)

**[Accessibility & Motion]** — Reduced-motion states undefined for most animated elements (EXPERIENCE.md § Accessibility Floor)  
Reduced motion is defined only for the 3D scenes, count-ups, orbit and fire. Staggered entrances, the Streak Hero rise and blur, the trail draw, pulses, chart grow, hover scale, the Drawer overshoot, the Level Callout float, Tips snap, the stage height and Exam → Results navigation have no reduced state.  
Fix: Add the per-element reduced-motion table from review-accessibility-motion.md §2. Examples: content at its final position with an optional ≤150ms fade; the trail fully drawn; one static ring for pulses; the stage collapses and stops being sticky; focus moves to the Results `<h1>` with no page transition.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — Nothing guards against flashing (WCAG 2.3.1) (DESIGN.md § Components › Fire Effect, Score Badge)  
The Fire Effect flame flicker has no frequency limit. The two-turn Score Badge alternates a large green front face and a saturated red-orange back face, and a fast scroll can scrub four face flips in under a second.  
Fix: Limit flame flicker to ≤3 luminance changes per second, with low amplitude and the flame area under ~25% of the viewport. Run the badge spin on time (≥1.2s per turn, at most one turn), never scroll-scrubbed.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — Level Path tab order and semantics unspecified; phone rail reverses level order (EXPERIENCE.md § Component Patterns › Level Path, Level Node; render C phone `.vpath`)  
Nothing specifies tab order or semantics for a winding SVG with 10 nodes that sits before the rail. The phone render lists the rail top-down from Under Construction to Level 1, the reverse of level order.  
Fix: Use DOM order Level 1 → Ujian Akhir as an `<ol>` of buttons inside `nav aria-label="Level path"`. Put the Level Callout's Primary Button straight after the active node, and consider a roving tabindex. On phone, keep visual and DOM order the same.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — Focus rings on SVG Level Nodes aren't solved (DESIGN.md § Components › Level Node; EXPERIENCE.md § Accessibility Floor (focus ring))  
`outline` on SVG `<g>` is inconsistent across browsers. The map card's `overflow:hidden` can clip a 3px offset, and the white ring sits on green glow halos.  
Fix: Draw the focus indicator as an SVG circle (r + 5, 2px `ring`) shown on `:focus-visible`, apply the hover scale on focus too, and leave room for it inside the card padding.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — Sticky chrome can hide focused elements (WCAG 2.4.11) (DESIGN.md § Components › Phone Dock, Header Bar, Level Callout)  
The pinned Phone Dock (~150px with its stats row), the sticky 68px Header Bar and the floating Level Callout can cover focused elements.  
Fix: Set `scroll-padding-top: 68px` and `scroll-padding-bottom` to the dock height. Keep the Callout clear of other nodes, or close it while a different node has focus.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — Hint Button focus behaviour costs points and loses focus (EXPERIENCE.md § Component Patterns › Hint Button; § State Patterns "Hint quota used")  
Each activation costs 5 points, so a double Enter silently takes −10. When the quota hits 0 the button is hidden and focus drops to `<body>`.  
Fix: After a reveal, move focus to the new hint text (`tabindex="-1"`) or debounce for ~800ms. At quota 0, keep an `aria-disabled` button with the reason ("No hints left for this attempt.").  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — The exam screen's only actions are "small", with no size and no keyboard file path (DESIGN.md § Components › Hint Button, Upload Dropzone)  
The Hint Button and Upload Dropzone have no stated size (WCAG 2.5.8). The Dropzone isn't specified as keyboard-operable.  
Fix: Make the hit area at least 24×24 CSS px (40px tall recommended on desktop), with ≥8px between them. The Dropzone is a real `<button>` or a labelled `<input type="file" accept=".xlsm,.xlsx">` reachable by Tab and opened with Enter or Space. Dragging stays optional (2.5.7).  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — Tips Carousel keyboard pattern underspecified (EXPERIENCE.md § Component Patterns › Tips Carousel; § Accessibility Floor)  
"Arrows move" is all the spec says. The Accessibility Floor gives Tips Cards a focus ring, which implies non-interactive cards are tab stops.  
Fix: Make the scroller `role="region" aria-roledescription="carousel" aria-label="Tips" tabindex="0"`. Add visible Prev/Next buttons (≥24px; ≥44px on phone) and a polite "Tip 3 of 8" status. Cards aren't tab stops, and there's no auto-advance. Use `scroll-margin` so the edge fade never hides the current card.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — Auto-navigation to Results is announced unreliably (EXPERIENCE.md § Accessibility Floor; § Interaction Primitives › Orbit Loader (auto-move))  
Results is reached by auto-navigation, and a live region injected along with new page content is announced unreliably.  
Fix: On route change, set the document `<title>` and move focus to the Results `<h1>` carrying the outcome ("Skor 88/100 — Test lulus. Level 4 unlocked!"). Keep live regions for changes within a page.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — No aria-live inventory (EXPERIENCE.md § Accessibility Floor)  
Without an inventory, announcements will be either missing or spammy.  
Fix: Polite: hint revealed plus hints left, upload started and done, freeze used ("Streak aman — Freeze 0/2 minggu ini"), Settings saved. `role="alert"`: file rejected, Login errors. Never announce count-up ticks, the per-second Exam Timer (only at 10, 5 and 1 minutes left), Streak Risk countdown ticks or the orbit.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — Decorative duplicates aren't hidden from assistive tech (EXPERIENCE.md § Interaction Primitives › 3D Scroll Scene)  
"The real map/score is always in the DOM" implies duplicate scene copies exist, but nothing says to hide them.  
Fix: Mark these `aria-hidden="true"` (plus `inert` where they contain copies of controls): the 3D laptop, Excel logo, scene board and badge copies, Orbit rings, dots and centre logo, Fire Effect, glows and pulse rings, grid background, and the A–J column strip.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — Some states are still colour- or shape-only (DESIGN.md § Components › Week Strip, Practice Pips, Theme Toggle, Activity Chart)  
The Week Strip uses single-letter days, has no missed-day state, and tells done from today-done by fill alone. Practice Pips separate done, next and pending by colour and hatch. Theme Toggle selection is a fill only. The Activity Chart marks its peak and freeze day by colour.  
Fix: Give each Week Strip day an accessible name ("Senin: selesai", "Rabu: freeze", "Hari ini: belum") and add a visible missed-day state. Make the "4/5 practices done" text mandatory wherever pips appear. Add `aria-pressed` to the toggle, and give the chart a text summary or table.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — "If the device struggles, show the static frame" can't be tested (EXPERIENCE.md § Accessibility Floor (phone performance); .memlog.md assumption)  
The fallback trigger is subjective, so neither a developer nor QA can verify it.  
Fix: Use a deterministic rule: show the static frame when `prefers-reduced-motion`, the in-app setting, `max-width: 1023px`, `pointer: coarse`, `saveData` or `deviceMemory ≤ 4` applies. Lazy-load scene assets with IntersectionObserver after the map data, and never block LCP or the first interaction.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — 3D scene rendering technique and budget undecided (DESIGN.md § Components › 3D Scroll Scene)  
CSS preserve-3d boxes, WebGL and a pre-rendered image sequence (the apple.com approach) cost very different amounts, and the spec doesn't choose.  
Fix: Decide now and record a budget: a scrubbed image sequence or `<video>`, or CSS 3D with ≤6 layers; ≤300 KB of scene assets; 60fps on a mid-range phone; `will-change` only while the stage is in view.  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — Several animations repaint every frame (DESIGN.md § Components › Level Callout; renders (`glowBeat`, `riskPulse`))  
`glowBeat` and `riskPulse` animate `box-shadow` forever, entrances animate `filter: blur()`, and the Level Callout uses `backdrop-filter` over the map.  
Fix: Animate the opacity or transform of a pseudo-element glow instead of `box-shadow`. Remove blur from entrances on phone, and drop `backdrop-filter` below lg (use a solid `card` fill).  
Sources: Accessibility & Motion (medium)

**[Accessibility & Motion]** — No `lang` strategy for the English-chrome / Indonesian-content split (EXPERIENCE.md § Voice and Tone (language split); renders line 2)  
Both renders ship `<html lang="id">` even though the UI chrome is now English, so screen readers pronounce one language with the other's rules.  
Fix: Use `<html lang="en">` for the chrome and `lang="id"` on every Indonesian container: question instructions, hint text, Wrong Answer reasons, Tips Card bodies, full-sentence system messages, the Orbit status line, toasts and curriculum level names.  
Sources: Accessibility & Motion (medium)

**[Reference reconciliation]** — Login error lifecycle lost from the v0 reference (DESIGN.md § Components › Login Card; EXPERIENCE.md § State Patterns › Login, Toast rule)  
The v0 login clears its inline error on retry (`setError(null)`) and shows every cause in the same slot under the button. The spines dropped the clear. The Toast rule sends network and server errors to a toast on a page with no app shell, where it gets missed. They also don't say the button is disabled while pending, so a second Enter can fire twice.  
Fix: Clear the error on resubmit or field edit (keep the username, clear the password). Show network and server failures inline in the same slot, with their own Indonesian message. State that the button is disabled while "Signing in…".  
Sources: Reference reconciliation (L7, L9, L10)

**[Reference reconciliation]** — Three entrance systems with no shared timeline, plus a stagger flash defect (EXPERIENCE.md § Interaction Primitives › Motion (staggered entrance, Streak Hero, trail draw))  
The card stagger, the Streak Hero cinematic and the trail draw + node pop have no defined relative start. The v0 Tasko stagger also used `forwards` with `animationDelay`, so delayed cards flash visible and then jump. That defect should not be copied.  
Fix: Use one page timeline in reading order (header → Level Path → rail), capped at ~1s total. Use `animation-fill-mode: both` (or start hidden) for every staggered item.  
Sources: Reference reconciliation (T20, T21)

**[Reference reconciliation]** — Orbit implementation traps from the v0 SVG (EXPERIENCE.md § Interaction Primitives › Orbit Loader; DESIGN.md § Components › Orbit Loader)  
The v0 orbit is pure CSS inside an SVG loaded as `<img>`, with hard-coded black and white. It can't read app tokens or the class-based theme toggle. Its rotation depends on the viewBox transform box: under `fill-box`, the dots spin in place and look frozen. It also sets the dot radius with CSS `r`, which older Safari ignores, so the dots vanish.  
Fix: Inline the SVG as a component so it can use tokens and reduced motion. Keep the viewBox centred at 50,50 with `transform-box: view-box`, and set `r` as an attribute.  
Sources: Reference reconciliation (O13, O14, O15)

### Low (43)

**[Flow coverage]** — J0 climax cites the Streak Hero on a screen that shows the Streak Chip (EXPERIENCE.md § Key Flows › J0 step 7)  
The climax says "the Streak Hero now reads 1" during the move to Results, but the Streak Hero only renders on Dashboard. On Results the user sees the Streak Chip.  
Fix: Say "Streak Chip in the Header Bar reads 1", or move the beat to the return to Dashboard.  
Sources: Rubric › Flow coverage (low)

**[Flow coverage]** — J0–J3 drafts never confirmed by the user (EXPERIENCE.md § Open Questions (last bullet); .memlog.md lines 36, 38)  
Both spines are still `status: draft`.  
Fix: Confirm the drafts before setting `status: final`.  
Sources: Rubric › Flow coverage (low)

**[Token completeness]** — `streak-glow` token has no use site (DESIGN.md § Colors)  
The non-strong `streak-glow` is never used. The `success` half of this rubric finding is folded into the CAP-5 entry.  
Fix: Name a use site, or drop the token.  
Sources: Rubric › Token completeness (low)

**[Component coverage]** — Composite elements used in flows with no component row (EXPERIENCE.md § Key Flows › J0 step 3; § State Patterns › Dashboard first run; § Responsive & Platform)  
The Setup Guide prompt card, the Results deduction line next to the Score Badge, the Tips & Tricks level filter and the phone Level Path "active level expanded as a card" have no component row and aren't declared as compositions.  
Fix: Name each as a composition of existing components (e.g. Stat Card + Primary Button, shadcn Tabs), or add rows.  
Sources: Rubric › Component coverage (low)

**[State coverage]** — Smaller state gaps: Results from History, Level Detail Panel loading (EXPERIENCE.md § State Patterns)  
Results opened from History (loading and route) and Level Detail Panel loading are unspecified.  
Fix: Fold these in when the Open Questions are resolved.  
Sources: Rubric › State coverage (low)

**[Visual reference coverage]** — DESIGN.md links no import; direction-a link has no stated role (DESIGN.md § Components › Login Card, App Sidebar, Records Card, Activity Chart; § Brand & Style)  
These rows derive from login-page.zip and dashboard-page.zip but don't cite them. The direction-a link doesn't say what it illustrates.  
Fix: Add inline links at those rows. Name direction-a's role, or drop the link.  
Sources: Rubric › Visual reference coverage (low)

**[Bloat & overspecification]** — Pixel literals where tokens exist or should exist (DESIGN.md § Components; EXPERIENCE.md § Interaction Primitives › Orbit Loader)  
The Orbit Loader is "320px" in both spines, although `{spacing.orbit-size}` exists. Other literals: the Phone Dock 52px, `primary-button.height` 44px, the 4px button edge and the 6px chart stub.  
Fix: Reference `{spacing.orbit-size}` and add tokens for the repeated sizes.  
Sources: Rubric › Bloat & overspecification (low)

**[Bloat & overspecification]** — EXPERIENCE restates visual anatomy (EXPERIENCE.md § Interaction Primitives › Orbit Loader; § Component Patterns › Streak Hero)  
The Orbit Loader paragraph repeats the rings, opacity and logo already in DESIGN, and the Streak Hero row cites a typography token.  
Fix: Keep only the behaviour in EXPERIENCE (orbit periods, linear, no pulse).  
Sources: Rubric › Bloat & overspecification (low)

**[Bloat & overspecification]** — Exam Timer fully specified for a V1-unreachable surface (DESIGN.md § Components › Exam Timer; EXPERIENCE.md § Component Patterns › Exam Timer)  
It is reachable only through Ujian Akhir, which is Under Construction in V1.  
Fix: Mark it Next in both rows.  
Sources: Rubric › Bloat & overspecification (low)

**[Inheritance discipline + Spec consistency]** — In-file finish button has inconsistent names (EXPERIENCE.md § State Patterns; § Key Flows; § Open Questions)  
State Patterns says "Selesai did nothing", the flows say "in-file finish button", and the label is still an Open Question. Spec consistency notes the `.xlsm` content is Indonesian, so Selesai fits, while the web copy mixes both.  
Fix: Pick one term (Selesai is the natural fit) and use it everywhere. Resolve it together with the in-Excel surface finding.  
Sources: Rubric › Inheritance discipline (low); Spec consistency (terminology)

**[Inheritance discipline]** — Cited companion specs missing from `sources` (EXPERIENCE.md frontmatter `sources`; intro)  
The intro cites `level-curriculum.md` and `exam-bridge.md`, but neither is in `sources`. They only resolve indirectly as companions of SPEC.  
Fix: List them in `sources`.  
Sources: Rubric › Inheritance discipline (low)

**[Spec consistency]** — Tips Cards aren't tied to their question (DESIGN.md § Components › Tips Card)  
Cards carry a level tag, title and body, but no question number or ✓/✗. CAP-8's "relevant to its task" is hard to see in a carousel that sits apart from the Wrong Answer Rows.  
Fix: Add "Soal N" and a status mark. Link each Wrong Answer Row to its card.  
Sources: Spec consistency (low)

**[Spec consistency]** — Office 2021-only rule doesn't cover Tips and hints (SPEC Constraints; EXPERIENCE.md § Component Patterns › Tips Card, Hint Button)  
The rule covers curriculum, perintah soal and answer keys, but not Tips or hint text, so a Tip could suggest TEXTSPLIT.  
Fix: Extend the rule to Tips and hint content (candidate 16).  
Sources: Spec consistency (low)

**[Spec consistency]** — "Still blocked? Use Upload file" has no target without a running attempt (EXPERIENCE.md § Component Patterns › Setup Steps, Upload Dropzone)  
Listing the Upload Dropzone under "Setup Guide link" is ambiguous.  
Fix: Link to the running attempt, or explain "Upload appears on the exam screen after Start".  
Sources: Spec consistency (low)

**[Spec consistency + Reference reconciliation]** — Login footer link has no target; no password recovery (DESIGN.md § Components › Login Card)  
The "small footer link" kept from the v0 import has no named target. It must not be sign-up (CAP-17), and the single account has no forgot-password path.  
Fix: Specify the link (e.g. Setup Guide or app version), or drop it. Add password recovery and lockout to the spec questions (candidate 19).  
Sources: Spec consistency (low); Reference reconciliation (L13)

**[Spec consistency]** — Freeze copy reads as "used" while the Pill shows "remaining" (EXPERIENCE.md § Key Flows › J3; § Voice and Tone; DESIGN.md § Components › Freeze Pill)  
"Freeze 1/2 this week" → "Freeze 0/2 this week" is ambiguous.  
Fix: Use "1 of 2 freezes left".  
Sources: Spec consistency (low)

**[Spec consistency]** — J0 says "Excel closes" (EXPERIENCE.md § Key Flows › J0 step 6)  
CAP-3 closes the workbook, and closes Excel only if no other workbook is open.  
Fix: Write "the workbook closes (Excel too, if nothing else is open)".  
Sources: Spec consistency (low)

**[Spec consistency]** — Test retake after failure is unconfirmed in the spec (EXPERIENCE.md § State Patterns › Results "Test not passed")  
"Try the Test again" is immediate, but the spec doesn't say whether a retake needs more practices.  
Fix: Confirm immediate retake in the spec (candidate 18).  
Sources: Spec consistency (low)

**[Spec consistency]** — No "streak restarted" moment (EXPERIENCE.md § Component Patterns › Streak Hero states)  
CAP-10 resets on a missed day, but the UX only has a zero state, with no calm message the next day.  
Fix: Add a one-time, non-scolding message in the Streak Hero.  
Sources: Spec consistency (low)

**[Spec consistency + Reference reconciliation]** — Header search (Ctrl K) has no spec capability behind it (EXPERIENCE.md § Open Questions)  
It is still an open question, and the v0 Tasko search was carried over only partially.  
Fix: Drop it for V1. If kept, reuse the primary focus-glow token.  
Sources: Spec consistency (low); Reference reconciliation (T10)

**[Spec consistency]** — First-run Setup Guide prompt: placement and dismissal undecided (EXPERIENCE.md § State Patterns › Dashboard first run; § Key Flows › J0)  
State Patterns marks it "[ASSUMPTION — placement not decided]", but J0 asserts a rail card. Dismissal is undefined.  
Fix: Decide the placement. Hide the prompt after the first graded macro submit or on manual dismiss.  
Sources: Spec consistency (low)

**[Accessibility & Motion]** — `label` token is very small for meaning-carrying eyebrows (DESIGN.md frontmatter `typography.label`)  
10.5px uppercase mono passes on ratio, but it carries meaning in "YOU ARE HERE" and the Under Construction Tag.  
Fix: Set an 11–12px floor, or limit 10.5px to purely decorative eyebrows.  
Sources: Accessibility & Motion (low)

**[Accessibility & Motion]** — Pass/fail must never depend on fire or glow (EXPERIENCE.md § State Patterns › Results)  
On Results, celebration versus calm is a mood, not a statement of the outcome.  
Fix: The Results heading always states the outcome ("Test lulus — 88/100", "Belum lulus — butuh 80"). "Level N unlocked!" renders even when the Fire Effect is skipped.  
Sources: Accessibility & Motion (low)

**[Accessibility & Motion + Reference reconciliation]** — Mobile Drawer and Level Detail Panel: focus, size, name and timing (EXPERIENCE.md § Component Patterns › Mobile Drawer, Level Detail Panel)  
Focus on open and close isn't specified. The render's drawer close button is 34px, under the 44px phone floor. The menu button lacks the v0 "Open menu" name, and close isn't faster than open as it is in v0 (500ms / 300ms).  
Fix: On open, focus the Sheet heading or first item; on close, return focus to the trigger. Close buttons ≥44px on phone. Name the menu button "Open menu". Close in ~0.25s with no bounce.  
Sources: Accessibility & Motion (low); Reference reconciliation (T8, T9)

**[Accessibility & Motion]** — "Use freeze" tap target is too small on phone (EXPERIENCE.md § Component Patterns › Freeze Pill; § Accessibility Floor)  
On phone the Pill becomes an action that spends quota, but the render pill is ~31px tall.  
Fix: Make it a real `<button>` ≥44px tall. At quota, keep it focusable with `aria-disabled` and the reason in `aria-describedby`.  
Sources: Accessibility & Motion (low)

**[Accessibility & Motion]** — Theme Toggle semantics and Activity Chart tooltip (WCAG 1.4.13) (DESIGN.md § Components › Theme Toggle; EXPERIENCE.md § Component Patterns › Activity Chart)  
The toggle has no keyboard or semantics spec. The chart tooltip isn't dismissible, hoverable or persistent.  
Fix: Make the toggle a `radiogroup` or a pair of `aria-pressed` buttons. Make tooltips dismissible with Esc, hoverable and persistent; better still, add an sr-only table of the 7 days rather than making each bar a tab stop.  
Sources: Accessibility & Motion (low)

**[Accessibility & Motion]** — Glyphs and emoji read inconsistently (DESIGN.md § Components › Streak Hero, Wrong Answer Row)  
"🔥", "✗", "✓", "❄" and menu-path arrows come out as "multiplication x", "fire" and so on.  
Fix: Mark glyphs `aria-hidden` and pair each with text ("Salah", "Freeze"). Give the Hint Button a name such as "Hint, minus 5 points, 2 left".  
Sources: Accessibility & Motion (low)

**[Accessibility & Motion]** — Small semantic gaps (EXPERIENCE.md § Accessibility Floor)  
There is no `aria-current`, no locked-reason description, no Streak Chip name and no per-surface title.  
Fix: Add `aria-current="page"` on the active nav item and `aria-current="step"` on the active Level Node, the locked or Test-locked reason in `aria-describedby`, the Streak Chip name "Streak 12 hari", and a `<title>` for every surface.  
Sources: Accessibility & Motion (low)

**[Accessibility & Motion]** — 190px phone streak numeral overflows with 3 digits (DESIGN.md frontmatter `typography.display-streak-mobile`)  
A 3-digit streak (e.g. 365) nearly fills the 358px content width and overflows at 200% text size (WCAG 1.4.10 / 1.4.4).  
Fix: Use `font-size: clamp(96px, 48vw, 190px)` and test with 3-digit values.  
Sources: Accessibility & Motion (low)

**[Accessibility & Motion]** — Accessible names mix languages (EXPERIENCE.md § Accessibility Floor)  
"Level 3, Hitung bersyarat, active, 4 of 5 practices done" mixes English and Indonesian, and an `aria-label` can't carry a partial `lang`.  
Fix: Build the name with `aria-labelledby` pointing at visible spans that each carry their own `lang`.  
Sources: Accessibility & Motion (low)

**[Accessibility & Motion]** — English Excel terms inside Indonesian sentences (EXPERIENCE.md § Voice and Tone)  
`SUMIFS`, `Data > Remove Duplicates` and `Ctrl + T` will be pronounced with Indonesian rules.  
Fix: Wrap functions in `<code lang="en">`, keys in `<kbd>`, and menu paths in `<kbd lang="en">`.  
Sources: Accessibility & Motion (low)

**[Accessibility & Motion]** — Day and date locale inconsistent (DESIGN.md § Components › Week Strip)  
The spec says Mon–Sun, while the render shows "S S R K J S M". Live regions that carry Indonesian sentences need `lang="id"`.  
Fix: Pick one locale for days and times (and the risk-countdown format). Use full day names in accessible names, and set `lang` on each live region to match its message.  
Sources: Accessibility & Motion (low)

**[Reference reconciliation]** — Signed-in visitor on `/login` isn't redirected (EXPERIENCE.md § State Patterns (global))  
Only "signed out → Login" exists. The v0 shows a signed-in visitor the welcome state instead of the form.  
Fix: `/login` with a live session redirects to Dashboard.  
Sources: Reference reconciliation (L17)

**[Reference reconciliation]** — Login entrance timings dropped (EXPERIENCE.md § Key Flows › J0 step 1; DESIGN.md § Brand & Style (easing))  
"Fades and slides up" survives without the v0's two-layer timings, and Login has no easing assigned.  
Fix: Column 0.5s fade with 10px rise, form block 0.4s with 20px rise, cinematic easing.  
Sources: Reference reconciliation (L15)

**[Reference reconciliation]** — Sidebar hover nudge dropped (EXPERIENCE.md § Interaction Primitives › Motion; DESIGN.md § Components › App Sidebar)  
The memlog noted "hover geser kanan" from v0, but the spines don't have it.  
Fix: Inactive nav items shift 4px right on hover over 300ms. The active item doesn't move.  
Sources: Reference reconciliation (T5)

**[Reference reconciliation]** — ↗ arrow chip for navigating cards dropped (DESIGN.md § Components › Records Card; History "View all")  
The memlog lists "ikon panah berputar 45°", but the spines don't have it.  
Fix: Add the chip, rotating 45° on hover, to clickable cards only (Records Card, History "View all"). Read-only Stat Cards stay without it.  
Sources: Reference reconciliation (T18)

**[Reference reconciliation]** — Hover scale applied to large containers (EXPERIENCE.md § Interaction Primitives › Motion (card hover))  
"Lift 2px + scale 1.02" applies to all Cards, and a 640px card at 1.02 jumps. The v0 scales only small cards.  
Fix: No scale on large containers (Level Path card, Streak Hero, Results panels); use the glow border only. Scale small clickable cards and nodes.  
Sources: Reference reconciliation (T19)

**[Reference reconciliation]** — Clickable rows have no hover state (EXPERIENCE.md § Component Patterns › History List, Records, Level Detail Panel rows)  
The v0 list rows change background and nudge their icon on hover. The spines dropped this.  
Fix: Use a `muted` background on hover plus a small icon scale. Skip the v0's 12° rotation.  
Sources: Reference reconciliation (T36)

**[Reference reconciliation]** — Activity Chart polish dropped (EXPERIENCE.md § Component Patterns › Activity Chart)  
Dropped from v0: the Average + Peak footer, the full day name in the tooltip, the hovered-bar brighten, and turning off Recharts' grey hover band, which shows on dark.  
Fix: Add a footer such as "Avg 1.4/day · Peak Wed 4", a full-day tooltip, a brighten-plus-glow on hover and focus, and turn the cursor band off.  
Sources: Reference reconciliation (T28, T29, T30)

**[Reference reconciliation]** — Count-up duration only defined for the streak (EXPERIENCE.md § Interaction Primitives › Count-up)  
Only the Streak count-up (~2.2s) has a duration. The v0's +1 per 30ms means a score of 100 would take 3s.  
Fix: Use a fixed duration (~1s, cinematic) for every count-up whatever the value.  
Sources: Reference reconciliation (T33)

**[Reference reconciliation]** — Secondary pages have no entrance spec (EXPERIENCE.md § Interaction Primitives › Motion)  
Motion covers Dashboard only.  
Fix: History, Records, Tips & Tricks, Setup Guide and Settings use a single 0.2s fade with an 8px drop. The stagger stays on Dashboard only.  
Sources: Reference reconciliation (T38)

**[Reference reconciliation]** — No tablet tier (EXPERIENCE.md § Responsive & Platform)  
"Below lg → one column" leaves md–lg as one long rail.  
Fix: At md–lg, show the rail cards 2-up.  
Sources: Reference reconciliation (T23)

**[Reference reconciliation]** — Orbit geometry survives only as ranges (DESIGN.md § Components › Orbit Loader; EXPERIENCE.md § Interaction Primitives › Orbit Loader)  
Only ranges landed ("2–10% opacity", "14s–44s", "6 small dots"). The exact radii, per-ring opacity, one dot per ring, per-ring periods, start angles, direction, dot styling and centre-logo size were dropped. Without start angles the dots begin in a line on first paint.  
Fix: Radii 49/40/30/20/15/10; opacity 2/3/4/4/8/10% (inner brightest); one dot per ring at 44/40/36/14/16/15s; start angles 0/90/180/0/270/90°; clockwise. Use ~5px solid `foreground` dots with a `border`-colour hairline, and a centre tile ≤40px inside the r10 ring.  
Sources: Reference reconciliation (O5, O6, O7, O8, O9, O11, O12)

## Mechanical notes
- `sources` resolves for both spines. Both are `status: draft`, `updated: 2026-10-22`. DESIGN frontmatter adds `status`, `updated` and `sources`, which are outside the Google spec but harmless.
- Token refs: 0 unresolved across both files. 56 color tokens, every one with a `-light` pair. The memlog "104 tokens" figure counts differently from the 233 frontmatter leaves and is not an error.
- The contrast table was re-measured by both the rubric walker and Accessibility & Motion. Stated values match to within 0.1; the missing and mis-surfaced pairs are in the contrast-table finding.
- Component names: 35/35 identical in DESIGN § Components and EXPERIENCE § Component Patterns; the frontmatter uses kebab-case equivalents for 20 of them.
- The finish-button term is inconsistent ("Selesai" vs "in-file finish button").
- The spines-win-on-conflict statement appears once per spine. That is acceptable, though the rubric expects it once overall.
- `fontWeight: '850'` falls back to 700/800 on the Arial and Roboto fallbacks. This only matters off Windows and Apple devices.
- There are no Mermaid diagrams. The imports are zipped (`animation-page.zip`, `dashboard-page.zip`, `login-page.zip`).

## Reviewer files
- `review-rubric.md`
- `review-accessibility-motion.md`
- `review-spec-consistency.md`
- `reconcile-v0-references.md` (Reference reconciliation)
