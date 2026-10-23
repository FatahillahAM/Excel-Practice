# Review — Spec Consistency (UX spines vs SPEC)

Lens: spec consistency. Read-only review of `DESIGN.md`, `EXPERIENCE.md` (+ `.memlog.md`) against `specs/spec-excel-practice/SPEC.md` and companions (`level-curriculum.md`, `exam-bridge.md`, `content-generation.md`, `pivot-grading.md`, `stack.md`, `.memlog.md`). Date: 2026-10-22.

## Overall verdict

**Revise before handoff.** The UX honours the hard product rules well: hint quota/−5/web-only, Test gate (5 practices any score, ≥80, pass once, no countdown), Under Construction for Level 5–9 + Ujian Akhir, manual freeze 2/week, failed attempts counted for records, file-rejected inline on upload, upload fallback always visible, single login with no sign-up, English Excel names, curriculum level names. No rule is silently inverted.

The gaps are in **attempt lifecycle and end states**. Nothing defines repeat attempts once items are complete, which breaks "beat your record" and makes the streak unsustainable once V1 content runs out. There is no route back to a running attempt. Nothing designs the in-Excel side of the bridge. The V1 end state after the Level 4 Test is missing. CAP-5 is deliberately narrowed to wrong answers only, which needs a spec amendment, and CAP-15 has no Under Construction home.

Findings: **1 critical · 6 high · 5 medium · 11 low**. Spec update candidates: **19**.

## CAP coverage

| CAP | Phase | UX location (surface · state · flow) | Verdict |
|---|---|---|---|
| CAP-1 Level map + gating | V1 | Level Path (Dashboard), Level Map + 3D scene, Level Node states passed/active/locked/UC, Level Detail Panel read-only for locked/UC · Dashboard first run, Locked level, Under Construction · J0, J4 | **Covered** (phone collapse rule hard-codes levels, M5) |
| CAP-2 Start → fresh `.xlsm` | V1 | Primary Button "Start Practice N"/"Start Test" in Level Callout, Level Detail Panel, Phone Dock → Exam in progress · J0, J1, J4 | **Partial**: no generating/download-failed/re-download state; Start on phone unresolved (M3); Start-again behaviour unresolved (H3) |
| CAP-3 In-file *Selesai* submits | V1 | Orbit Loader auto-advances to Results · J0, J1, J4 | **Partial**: in-file surface (button label, success/failure/rejection messages inside Excel) undesigned (H2); auto-advance lost if user left the exam screen (H3) |
| CAP-4 Upload fallback | V1 | Upload Dropzone always visible on Exam in progress; Setup Steps last step · J2 | **Partial**: upload exists only on the transient exam screen; no route back after navigation/session expiry/other device (H3) |
| CAP-5 Score, time, per-question reason | V1 | Results: Score Badge (+time, hint deductions), Wrong Answer Rows; History detail · J1, J5 | **Partial**: correct questions not listed, but spec success says every question shows its reason (H1) |
| CAP-6 Fresh data each attempt | V1 | Backend; J1 states fresh data | **Covered** (no UX surface required) |
| CAP-7 Hints in web, −5, quota 3/2/1/0 | V1 | Hint Button (label "Hint (−5)" + left), states Hint opened / Hint quota used, absent for Ujian Akhir; deductions on Score Badge · J1 | **Covered** (hint targeting undefined in spec and UX, M4) |
| CAP-8 Tips card per graded question | V1 | Tips Carousel (all questions) on Results; Tips & Tricks collection · J1, J5 | **Covered** (cards not linked to question number, low) |
| CAP-9 Test gate | V1 | Level Callout lock line, Practice Pips, Test row locked/open/passed, Results Test passed (Fire) / not passed (calm + "Try the Test again") · J1, J4 | **Partial**: passing Test Level 4 in V1 would announce "Level 5 unlocked!" for an Under Construction level (H4) |
| CAP-10 Streak + manual freeze | V1 | Streak Hero, Streak Chip, Freeze Pill ("Use freeze", disabled at quota), Week Strip, Streak Risk Pill; states safe/at risk/frozen/quota used; Settings time zone · J3 | **Partial**: no path to keep practising once items are done (C1); time zone editable vs spec's fixed zone (M1) |
| CAP-11 Time records | V1 | Records page, Records Card, Level Detail Panel record times, "New record" badge; failed attempts counted (J4 failure) · J1, J5 | **Partial**: no replay path, so a record can never be beaten once the item is done (C1) |
| CAP-12 Cloud sync across devices | V1 | Responsive & Platform; J2, J3 climaxes | **Covered** (cross-device view of a running attempt undefined, H3) |
| CAP-13 Level 5–9 | Next | UC nodes/tags, no Start; phone collapses them into one UC node | **Correct UC** (collapse rule must be data-driven, M5) |
| CAP-14 Ujian Akhir | Next | Ujian Akhir flag node + 0/5 Stat Card with UC Tag; Results — Ujian Akhir UC; Exam Timer [ASSUMPTION] | **Correct UC** |
| CAP-15 Co-authoring side track | Next | None. Key Flows says it "appears as Under Construction states", but no surface carries it | **Missing** (H5) |
| CAP-16 Setup Guide | V1 | Setup Guide page, Setup Steps (Trusted Location, Unblock, "Still blocked? Use Upload file"), first-run prompt [ASSUMPTION], exam-screen link · J0 | **Partial**: doesn't say where the downloaded file must live for Trusted Location to work (H6) |
| CAP-17 Single-account login | V1 | Login Card (username + password, no sign-up/OAuth), session-expired redirect, Log out, change password in Settings · J0 | **Covered** (footer link undefined, low) |
| CAP-18 Ownership check on submissions | V1 | Upload Dropzone File rejected state (verbatim message), attempt stays open · J2 failure | **Partial**: macro-path rejection unhandled (H2); one message for all rejection reasons (M2) |

## Rule check (item 2)

| Rule | Spec | UX | Verdict |
|---|---|---|---|
| Hint opened in web, −5, quota 3/2/1/0, per attempt | CAP-7, curriculum, assumption | Hint Button on exam screen, "−5", quota shown, "No hints left for this attempt", absent in Ujian Akhir | ✓ consistent |
| Test gate: 5 practices any score, ≥80, pass once, hints allowed, no time limit | CAP-9 | Pips any score, lock line, ≥80 pass, Hint on Test, no countdown | ✓ (end-state gap H4) |
| Under Construction L5–9 + Ujian Akhir, no start | CAP-1, curriculum | UC node/tag, "no start action anywhere" | ✓; side track missing (H5) |
| Streak: ≥1 graded attempt/day, manual freeze, 2/week Mon–Sun, today only | CAP-10 + assumptions | Week Strip Mon–Sun, Freeze manual, offered in at-risk state, disabled at quota; Open Question notes rules unconfirmed | ✓; time zone editable ✗ vs assumption (M1) |
| Failed attempts count for records | CAP-11, curriculum | J4 failure "time still counts for Records" | ✓ |
| Results: wrong questions only + Tips for all | CAP-5 "every question shows its reason"; CAP-8 | Wrong rows only; Tips for all | CAP-8 ✓ · CAP-5 ✗ (H1) |
| File rejected | CAP-18 "rejected with reason, not graded", macro **and** upload | Upload path only, one message | Partial (H2, M2) |
| Upload fallback always works | CAP-4, constraint | Dropzone always visible on exam screen | Partial (H3) |
| Ujian Akhir 60-min auto-close | CAP-14, exam-bridge | Exam Timer [ASSUMPTION], rest Next | ✓ for V1 |
| Login single account, no registration | CAP-17 | Username + password, no sign-up | ✓ (footer link, low) |
| Setup Guide Trusted Location + Unblock → upload | CAP-16, exam-bridge | Setup Steps | Partial (H6) |
| Office 2021-only functions | Constraint, curriculum | Examples (SUMIFS, XLOOKUP, Ctrl+T) are compliant; Tips/hints not bound by the rule | ✓ (spec gap, low) |
| Manufacturing data domains | Constraint, content-generation | Examples fit; no generic data | ✓ |

## Findings

- **[critical]** No repeat path for completed items. The Level Detail Panel offers "Start for the next item" only, Practice Pips cap at 5, and a passed Test has no retake. CAP-11 ("a faster attempt replaces the record") can never happen once an item is done. In V1, after ~24 attempts (4 levels × 5 practices + 1 Test), nothing is startable, so CAP-10's daily streak cannot be kept. The spec is also silent on attempts beyond 5 practices or after passing. (EXPERIENCE → Component Patterns: Level Detail Panel, Practice Pips, Level Callout; SPEC CAP-9/10/11.) *Fix:* add "Practice again" on completed practice rows and "Retake Test" on a passed Test row. Repeats count for streak and records, not for Pips or the gate. After a level is complete, the Level Callout's Primary Button becomes "Practice again". Add the rule to the spec (candidate 12).
- **[high]** CAP-5 contradiction. Results list only wrong questions ("Correct questions are not listed"). SPEC CAP-5 success says "setiap soal menampilkan alasannya", and exam-bridge says "Keterangan per soal: benar/salah dan alasannya". The Tips Carousel covers every question but gives no correct/incorrect verdict. DESIGN's `success` role ("Correct marks in Results") has nothing to mark. (EXPERIENCE → Wrong Answer Row, Inspiration "Rejected"; DESIGN → Colors.) *Fix:* either add a collapsed "Correct (n)" group with a ✓ and one-line reason per question, or amend CAP-5 success to "every wrong question shows its reason; correct questions are counted" (candidate 3). Don't leave both documents as they are.
- **[high]** The in-Excel half of the bridge has no UX. The `.xlsm` is a user-facing surface (scenario, data, perintah soal, *Selesai* button), but nothing covers its layout, the button label (still an Open Question), or what the macro shows when sending succeeds, fails (offline, server down), or is rejected under CAP-18 (already graded, unknown token). CAP-18 requires a rejection with a reason on the macro path too. Today the user would click *Selesai*, Excel closes, and the browser keeps orbiting. (EXPERIENCE → Component Patterns, State Patterns: only upload rejection; SPEC CAP-3, CAP-18.) *Fix:* add an "In-file (.xlsm)" surface with the instructions sheet layout, button label, and MsgBox copy for sent / send failed ("Upload file lewat web, ya") / rejected (reason). Do not close the workbook on failure. The exam screen also shows a macro-path rejection when it learns of one.
- **[high]** Active attempt lifecycle undefined (listed as an Open Question, but it blocks two V1 caps). Upload (CAP-4, "must always work") and auto-Results (CAP-3) live only on the transient Exam in progress screen. Nothing routes back to a running attempt after sidebar navigation, a closed tab, session expiry (→ Login → Dashboard), or opening the web on the other device (CAP-12). Pressing Start again, re-downloading a lost file, and abandoning an attempt are all unspecified, and the spec is silent too. (EXPERIENCE → State Patterns "Active attempt exists", "Signed out / session expired", Open Questions.) *Fix:* add a persistent "Attempt in progress — Back to exam" banner in the Header Bar, Level Callout and Dashboard; after login, redirect to the running attempt; the exam screen gets "Download file again" and "Abandon attempt" (with the spec rule on whether that counts). Define Start-while-active (resume, not replace). Add the lifecycle to the spec (candidate 13).
- **[high]** V1 end state after passing Test Level 4. The Test passed variant says "Level N unlocked!", and J4's pattern lights the next node. For Level 4 that would announce Level 5, which CAP-1 says is Under Construction and not startable. The Dashboard Level Callout and Primary Button have no next target once all V1 levels are passed. (EXPERIENCE → Results Test passed, Fire Effect, Level Callout.) *Fix:* add a "Test passed — next level under construction" variant (Fire still plays; copy: "Level 4 done! Level 5 is under construction"). Dashboard "all available levels done" state: Callout says "Keep your streak — practise any level", with the Primary Button set to "Practice again" (ties to the critical finding).
- **[high]** CAP-15 has no Under Construction home. level-curriculum lists the co-authoring side track on the level map with phase Next, and "level berfase Next tampil di peta dengan label Under Construction". The Key Flows line says CAP-13/14/15 appear as Under Construction states, but no surface, node, card or sidebar item carries CAP-15. (EXPERIENCE → Key Flows header, IA; DESIGN → Level Path.) *Fix:* add a side-track branch card next to the Level Path (separate from the trail and the gate, as CAP-15 requires) with an Under Construction Tag. Optionally add a disabled "Co-authoring" entry in the sidebar.
- **[high]** The Setup Guide and J0 skip where the file must live. Trusted Location only enables macros for files opened from that folder. Browser downloads land in Downloads, and Unblock is a per-file action, not the "one-time" setup that CAP-16 promises. The spec assumption names one fixed working folder that doubles as the Trusted Location, which Level 8 and Ujian Akhir also rely on. J0 goes straight from download (step 5) to *Selesai* working (step 6), which is the CAP-16 success test. (EXPERIENCE → Setup Steps, J0; SPEC Assumptions; exam-bridge "File sumber".) *Fix:* Setup Steps name the fixed folder and include a step to make the browser save there (or "ask where to save"). The exam screen shows a one-line reminder with the folder name, and J0 adds a "save into folder" step.
- **[medium]** Settings lets the user edit the streak time zone. The spec assumption says one fixed zone stored in the profile, taken from the device at first login, the same on both devices. An editable zone moves the day boundary, which can double-count or erase a day. (EXPERIENCE → IA Settings; SPEC Assumptions CAP-10.) *Fix:* show the zone read-only, or allow a change that takes effect at the next day boundary. Record either choice in the spec (candidate 5).
- **[medium]** The phone can start an attempt. Phone Dock carries "Start Practice N". CAP-2 records the start time on Start, and Excel desktop is mandatory, so a phone Start creates an unworkable attempt whose time still counts for records (CAP-11 counts failed attempts). (EXPERIENCE → Phone Dock, Open Questions "Start on phone".) *Fix:* resolve the open question against the spec. On the phone the Dock button never starts an attempt: it reads "Start on your laptop" (informational), or "Use freeze" when the streak is at risk.
- **[medium]** One rejection message covers every CAP-18 reason. The spec lists missing identity, altered, already graded, and unknown, each "dengan pesan alasan". The verbatim message ("bukan dari percobaan yang sedang berjalan") misleads for an altered or stripped token, for example a Save As `.xlsx`, and for a re-upload after a successful macro submit. Wrong file type is also unhandled. (EXPERIENCE → Voice and Tone, State Patterns "File rejected".) *Fix:* write a small message set per reason in the same tone: keep the decided message for "other attempt"; add "sudah dinilai — lihat hasilnya di History", "identitas file rusak/hilang — jangan Save As ke .xlsx", and "bukan file Excel".
- **[medium]** Hint targeting undefined. "Each tap reveals the next hint" means hints arrive in a fixed sequence per attempt, so a user stuck on question 4 may spend −5 on question 1's hint. The spec only defines quota and cost. (EXPERIENCE → Hint Button; SPEC CAP-7.) *Fix:* add a hint picker by question number (or "hint for the question you're on"). Record the hint ordering rule in the spec (candidate 11).
- **[medium]** The phone collapse rule hard-codes "Level 5–9 + Ujian Akhir collapsed into one Under Construction node". When CAP-13 ships levels one at a time, this layout rule has to change, which conflicts with the constraint "menambah level tidak boleh mengubah … UI peta level". (EXPERIENCE → Responsive & Platform; DESIGN → Level Path.) *Fix:* make it data-driven: "consecutive Under Construction nodes collapse into one node".
- **[low]** DESIGN `success` role is "Correct marks in Results", but Results list no correct questions. (DESIGN → Colors.) *Fix:* resolve with H1.
- **[low]** Tips Cards carry level tag, title and body but no question number or ✓/✗ link, so CAP-8's "relevant to its task" is hard to see in a carousel detached from the Wrong Answer Rows. (DESIGN → Tips Card.) *Fix:* add "Soal N" + a status mark; a Wrong Answer Row links to its card.
- **[low]** The Office 2021 restriction covers curriculum, perintah soal and answer keys, but not Tips or hint text; a Tip could suggest TEXTSPLIT. (SPEC Constraints; EXPERIENCE → Tips Card.) *Fix:* add the rule to the Tips/hint content rules (candidate 16).
- **[low]** "Still blocked? Use Upload file" in Setup Steps has no target when no attempt is running. Component Patterns lists Upload Dropzone under "Setup Guide link", which is ambiguous. (EXPERIENCE → Setup Steps, Upload Dropzone.) *Fix:* link to the running attempt, or explain "Upload appears on the exam screen after Start".
- **[low]** Login Card keeps an undefined "small footer link" from the v0 import. It must not be sign-up (CAP-17), and there's no forgot-password path for the single account. (DESIGN → Login Card.) *Fix:* specify the link (e.g. Setup Guide), or drop it. Add password recovery to the spec questions (candidate 19).
- **[low]** Freeze copy "Freeze 1/2 this week" → "Freeze 0/2 this week" reads as "used", but the Pill shows remaining. (EXPERIENCE → J3, Voice examples; DESIGN → Freeze Pill.) *Fix:* "1 of 2 freezes left".
- **[low]** J0 step 6 says "Excel closes". CAP-3 closes the workbook, and closes Excel only if no other workbook is open. (EXPERIENCE → J0.) *Fix:* "the workbook closes (Excel too, if nothing else is open)".
- **[low]** After a failed Test, "Try the Test again" is immediate. The spec doesn't say whether a retake needs more practices. (EXPERIENCE → Results Test not passed.) *Fix:* confirm immediate retake in the spec (candidate 18).
- **[low]** No "streak reset" moment. CAP-10 resets on a missed day, but the UX only has a "zero" state, with no calm "streak restarted" line the next day. (EXPERIENCE → Streak Hero states.) *Fix:* add a one-time non-scolding message in Streak Hero.
- **[low]** Header search (Ctrl K) is an open question with no spec capability behind it. (EXPERIENCE → Open Questions.) *Fix:* drop it for V1.
- **[low]** The first-run Setup Guide prompt is "[ASSUMPTION — placement not decided]" in State Patterns but asserted as a rail card in J0, and dismissal is undefined. (EXPERIENCE → Dashboard first run, J0.) *Fix:* decide the placement and hide it after the first graded macro submit, or on manual dismiss.

## Spec update candidates

UX behaviour the spec does not yet know about, to flow back via `bmad-spec` update:

1. **Tips & Tricks collection page:** every Tips card shown is collected; filterable by level (extends CAP-8).
2. **History page:** past attempts, each reopening its wrong answers + reasons (new read capability; CAP-5/12).
3. **Results show wrong questions only, Tips for all:** amend CAP-5 success, or keep the spec and change the UX (H1).
4. **Streak presentation:** at-risk state with countdown to the day boundary, Week Strip (Mon–Sun), 7-day Activity Chart; freeze offered while today is unfinished (CAP-10).
5. **Settings:** theme, change password, streak time zone (editable or read-only — reconcile with the fixed-zone assumption, M1).
6. **Language rules:** English UI chrome; casual Indonesian for perintah soal, keterangan, Tips and full-sentence system messages; Excel menus and functions exactly as English Excel shows them. The user's Excel is English (affects content-generation prompts).
7. **Phone as a third device:** streak check + freeze only, no Start (spec names only laptop + office PC; CAP-12 says "semua perangkat").
8. **No notifications (push/email):** add as a non-goal.
9. **Ujian Akhir remaining-time readout** on the exam screen (CAP-14).
10. **Results mood:** a calm variant for scores <80 (practice and Test), with celebration (Fire) reserved for Test passed. Presentational, but it defines "low score" for practices.
11. **Hint mechanics:** sequential reveal vs per-question targeting, inline display, persisted with the attempt, deductions shown on Results.
12. **Repeat attempts:** practice beyond the 5 Pips and retakes after passing count for streak and records, not the gate (critical finding).
13. **Attempt lifecycle:** resume, re-download, abandon, Start-while-active, cross-device visibility, post-login return (H3).
14. **V1-complete state** after Test Level 4 (H4).
15. **Submission rejection reasons and copy**, including in-Excel macro messages for sent, failed and rejected (H2, M2).
16. **Office 2021-only rule** extended to Tips and hint text.
17. **Fixed working folder = Trusted Location** promoted from assumption to V1 decision, plus the download-location step (H6).
18. **Test retake after failure:** immediate, no extra practices required.
19. **Single-account password recovery / lockout** (CAP-17 silent).

## Terminology

| Concept | Spec | UX | Note / recommendation |
|---|---|---|---|
| Start an attempt | *Mulai* | "Start", "Start Practice N", "Start Test" | Drift by design (English chrome). Add a glossary line to the spec, or keep the spec Indonesian and map it. |
| In-file submit button | *Selesai* | "in-file finish button" (Selesai vs Finish is an Open Question) | Decide. Since the `.xlsm` content is Indonesian (perintah soal), *Selesai* fits; the web copy "Upload file yang kamu unduh waktu klik Start" mixes both. |
| Final exam | Ujian Akhir | Ujian Akhir (kept in English chrome) | Consistent; "Final Exam" not used. Intentional proper noun. Note it in the Voice rules. |
| Level test | Test / Test level | Test, "Test Level 3", "Start Test", "Test locked" | Consistent. |
| Practice | latihan | Practice, Practice Pips | Drift by language only. |
| Attempt | percobaan | attempt | Drift by language only. |
| Level map | peta level | Level Map (page) + Level Path (Dashboard summary) | Two UX names for one spec concept; acceptable, but define in the glossary. |
| Tips | kartu Tips & Trick | Tips Card, Tips Carousel, "Tips & Tricks" page | Spec singular "Trick" vs UX "Tricks". Align (UX "Tips & Tricks" is better English). |
| Per-question explanation | keterangan per soal | Wrong Answer Row / reasons | UX narrows to wrong-only (H1). |
| Time record | rekor waktu, "rekor baru" | Records, "New record" | Consistent. |
| Setup guide | panduan penyiapan (CAP-16) | Setup Guide, Setup Steps | Consistent. |
| Upload fallback | jalur upload / Jalur C | Upload file, Upload Dropzone | Consistent. |
| Streak freeze | freeze | Freeze, "Use freeze", Freeze Pill | Consistent. |
| Under Construction | *Under Construction* | Under Construction Tag | Consistent. |
| Side track | jalur sampingan (co-authoring) | — | Missing in UX (H5). |
| Exam bridge | Exam / mesin Exam / alur Exam | "Exam in progress" (also for practice and Test) | OK; spec "Exam" = the bridge for every attempt type. |
| Results | hasil | Results | Language only. |
| Pass status (Ujian Akhir) | *Lulus* (5th consecutive) | "Ujian Akhir 0/5" counter | Name the 5/5 state "Lulus" when CAP-14 ships. |
| User | user | El Zavier / "EZ" | Persona display name; not in spec, harmless. |
