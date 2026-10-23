---
name: WORKING HARD with EXCEL
status: draft
sources:
  - ../../../specs/spec-excel-practice/SPEC.md
  - ../../../specs/spec-excel-practice/level-curriculum.md
  - ../../../specs/spec-excel-practice/exam-bridge.md
updated: 2026-10-22
---

# WORKING HARD with EXCEL — Experience Spine

Behavior and flow. Visual identity, tokens and component visuals live in `DESIGN.md`. Product rules (levels, hint quotas, Test gate, streak, exam bridge) are inherited from `SPEC.md` and its companions `level-curriculum.md` and `exam-bridge.md` — referenced by CAP-id, not restated. Renders in `.working/` and v0 templates in `imports/` illustrate; **the spines win on conflict.**

## Foundation

| Aspect | Decision |
|---|---|
| Form factor | Desktop web primary (personal laptop, sometimes office PC) + phone browser for streak checks. Exams are always worked in Excel desktop (SPEC constraint); the phone never starts an attempt. |
| UI system | shadcn/ui on Next.js + Tailwind; brand layer per `DESIGN.md`. |
| Visual reference | `DESIGN.md` (theme "Dark Excel") + key-screen mocks: [Dashboard](mockups/key-dashboard.html), [Exam in progress](mockups/key-exam.html), [Results](mockups/key-results.html), [Level Map + Level Detail Panel](mockups/key-level-map.html). Every other surface (Login, History, Records, Tips & Tricks, Setup Guide, Settings, Exam Workbook) is built from these tables alone (confirmed). |
| Theme | Dark default; light (AA-tuned tokens) via Theme Toggle in Header Bar and Settings. |
| Motion | Full motion by default; off when the OS asks (`prefers-reduced-motion`) **or** the Settings "Reduce motion" switch is on (default follows OS). |
| User | Single account, protagonist **El Zavier** (CAP-17): one allowlisted Google account via "Sign in with Google". No sign-up, no password. |
| Notifications | None (no push, no email). Streak status is visible only when the web is opened, phone included. |
| Language | `<html lang="en">` (English chrome); every Indonesian container carries `lang="id"` (see Voice and Tone). |

## Information Architecture

Sidebar groups — **Menu:** Dashboard, Level Map, History, Records, Tips & Tricks, Setup Guide. **General:** Settings, Log out. No global search.

| Surface | Reached from | Purpose | CAP |
|---|---|---|---|
| Login | Any URL when signed out | One-click "Sign in with Google"; only the allowlisted Google account enters; session remembered ~30 days per device; `/login` with a live session → Dashboard | CAP-17 |
| Dashboard | After login, sidebar | Level Path summary (hero) + rail: Attempt Card (while open), Streak Hero, Setup Guide prompt (first run), last score, Ujian Akhir 0/5 (Under Construction), Records Card, Activity Chart, History List | CAP-1, 10, 11, 12 |
| Level Map | Sidebar, Dashboard path | Full map behind a 3D Scroll Scene ("Skip intro" first); CAP-15 side-track node beside the path; node → Level Detail Panel | CAP-1, 9, 15 |
| Level Detail Panel | Level Node on Level Map / Dashboard | 5 practices (status, best score, record time), Test (locked/open/passed), Start / Practice again | CAP-2, 9, 11 |
| Exam in progress | After Start / Practice again, Attempt Card "Resume" | Orbit Loader + Exam Status Line + Hint Button + Upload Dropzone (+ Exam Timer, Next) | CAP-2, 3, 4, 7, 18 |
| Exam Workbook | The downloaded `.xlsm`, opened from the fixed working folder | Instructions sheet (Indonesian), Finish button, macro messages | CAP-2, 3, 18 |
| Results — practice | Auto after the file is graded; History row | Outcome heading → Score Badge + "x of y correct" + deductions → wrong answers + reasons → Tips Carousel (all questions) | CAP-5, 8, 11 |
| Results — Test passed | Auto after Test graded ≥80 | Practice layout + Fire Effect + "Level N unlocked!" (Level 4: "Level 4 complete! Level 5 is coming soon") | CAP-1, 9 |
| Results — low score | Any result <80 | Calm variant: same content, minimal motion, no celebration | CAP-5 |
| Results — Ujian Akhir | Next phase | Under Construction in V1 | CAP-14 |
| History | Sidebar, Dashboard "View all" | Past attempts; open one → its Results (static) | CAP-5, 12 |
| Records | Sidebar, Records Card | Best time per practice / Test / Ujian Akhir; "New record" marks; Practice again per row | CAP-11 |
| Tips & Tricks | Sidebar, Results | Every Tips Card earned; search + level filter (the app's only search) | CAP-8 |
| Setup Guide | Sidebar, first-run prompt, exam-screen link | Fixed working folder (= save location + Trusted Location), Unblock; points to upload | CAP-16 |
| Settings | Sidebar General, avatar menu | Theme, Reduce motion, streak time zone (read-only), "Signed in as <Google account>" + Log out | CAP-10, 17 |
| Log out | Sidebar General, avatar menu | Ends session → Login | CAP-17 |

Key-screen mocks (supersede the direction renders where they differ): [mockups/key-dashboard.html](mockups/key-dashboard.html) (J1 step 1 desktop; J3 on phone), [mockups/key-exam.html](mockups/key-exam.html) (J1 step 3; J2 rejection), [mockups/key-results.html](mockups/key-results.html) (J1 step 5; J4 climax; low score), [mockups/key-level-map.html](mockups/key-level-map.html) (J4 steps 1–2; phone bottom sheet). Composition references: Dashboard structure — [.working/direction-c-level-journey.html](.working/direction-c-level-journey.html); streak hero, phone first screen, streak-at-risk — [.working/direction-b-hero-streak.html](.working/direction-b-hero-streak.html). Correct on build: menu labels to English, level names to curriculum names, avatar "FA/Fatahillah" → "EZ/El Zavier", history scores and record placements are samples, "freeze used automatically" copy is wrong (freeze is manual, CAP-10), phone rail order runs Level 1 first, header search is gone, `<html lang="id">` → `en`.

## Voice and Tone

Santai and encouraging (Duolingo-like), addresses the user as *kamu*. Language split:

| Text type | Language | Example |
|---|---|---|
| UI chrome: page titles, nav, buttons, labels, tags, short reason lines, Results heading | English | "Start Practice 5", "Practice again", "Resume", "Abandon", "Use freeze", "1 of 2 freezes left", "Hint (−5)", "Test opens after 5 practices — 1 to go.", "Level 4 unlocked!" |
| Proper names | Kept verbatim inside English chrome | "Ujian Akhir" (the one label for the final exam, never "Final Exam"); level names from `level-curriculum.md` ("Level 3 — Hitung bersyarat") |
| Perintah soal, wrong-answer reasons (keterangan), hint text, Tips card body | Casual Indonesian + English Excel terms | "Hasilnya sudah benar, tapi sel D5 diketik manual. Pakai SUMIFS biar ikut berubah kalau datanya ganti." *(illustrative)* |
| Full-sentence system messages (empty states, streak messages, errors, rejections, macro messages) | Casual Indonesian | See message set below |
| Excel menus, tabs, functions, keys | Exactly as English Excel shows them | `Data > Remove Duplicates`, `XLOOKUP`, `Ctrl + T` — marked up as `<code lang="en">` / `<kbd lang="en">` |
| In-file submit button | English | **Finish** (the `.xlsm` counterpart of web **Start**) |

**System message set** (casual Indonesian, `lang="id"`; *decided* = verbatim from decisions, others illustrative):

| Situation | Path | Message |
|---|---|---|
| Rejected — not from this attempt *(decided)* | Upload + macro | "File ini bukan dari percobaan yang sedang berjalan. Upload file yang kamu unduh waktu klik Start, ya." |
| Rejected — already graded | Upload + macro | "File ini sudah dinilai. Hasilnya ada di History, ya." |
| Rejected — identity altered or damaged | Upload + macro | "Identitas file ini rusak atau berubah. Pakai file .xlsm asli dari Start dan jangan Save As ke format lain, ya." |
| Rejected — attempt already closed | Upload + macro | "Percobaan ini sudah ditutup, jadi file-nya nggak bisa dinilai. Mulai percobaan baru, ya." |
| Not an Excel file | Upload | "Ini bukan file Excel. Pilih file .xlsm dari percobaan ini, ya." |
| Macro sent | Exam Workbook | "File terkirim! Hasilnya muncul di web, ya." |
| Macro send failed | Exam Workbook | "File belum terkirim. Filenya sudah tersimpan — upload lewat web, ya." |
| Start on phone *(decided)* | Phone | "Latihan dikerjakan di Excel laptop, ya. Buka web ini di laptop untuk mulai." |
| Freeze used | Dashboard | "Streak aman! Sisa freeze 0 dari 2 minggu ini." |
| Streak restarted | Dashboard (once) | "Streak mulai lagi dari 0 — yuk, latihan hari ini." |
| Grading slow / failed | Exam in progress | "Penilaian agak lama, tunggu sebentar ya." / "Penilaian gagal. Coba lagi, ya — file kamu aman." |
| Login — Google account not allowlisted | Login | "Akun ini nggak terdaftar. Masuk pakai akun Google kamu sendiri, ya." |
| Login — popup blocked | Login | "Pop-up login diblokir browser. Izinkan pop-up untuk situs ini, lalu coba lagi, ya." |
| Login — network / server | Login | "Koneksi lagi bermasalah. Coba lagi sebentar, ya." |
| First-load failure | Any surface | "Datanya belum kemuat. Coba lagi, ya." |

| Do | Don't |
|---|---|
| Short, warm, one idea per line | Lecture or scold ("Kamu gagal…") |
| Celebrate Test passed loudly | Celebrate a low score |
| Name the exact cell, function and reason in keterangan | Generic "Jawaban salah" |
| Say what to do next ("Upload file yang kamu unduh…") | Error codes alone |

## Component Patterns

Behavioral. Visual specs: `DESIGN.md` → Components (same names).

| Component | Use | Behavioral rules |
|---|---|---|
| App Sidebar | Desktop ≥ lg | Always visible; active item = current surface (`aria-current="page"`); Exam in progress and Results are not menu items, so no item is active there. Level Map item shows current level count ("L3", static). Footer progress = levels passed of 9. |
| Mobile Drawer | < lg | Menu button named "Open menu". Closes on scrim tap, `Esc`, or navigation. Focus: first item on open, back to the menu button on close; trapped while open (shadcn `Sheet`). |
| Header Bar | All signed-in surfaces | Sticky; hosts Streak Chip, Theme Toggle, avatar menu (Settings, Log out). Content keeps `scroll-padding-top` = header height so focus is never hidden. |
| Streak Chip | Header Bar | Read-only current streak, accessible name "12-day streak"; flame icon `aria-hidden`. |
| Theme Toggle | Header Bar, Settings | Two `aria-pressed` buttons (Dark / Light); switches instantly and persists; same value as Settings. |
| Primary Button | Everywhere one main action exists | One per surface region. Label states the exact next action ("Start Practice 5", "Start Test", "Practice again", "Resume"). Disabled carries a reason line (`aria-describedby`). Disabled while its request is pending. |
| Stat Card | Dashboard rail | Read-only summary (last score, Ujian Akhir counter). |
| Streak Hero | Dashboard rail (desktop), first screen (phone) | Streak numeral, Freeze Pill, Week Strip. States: safe today / at risk / frozen today / zero / restarted (one-time message the day after a reset). On phone the final numeral is visible ≤0.5s after load. |
| Freeze Pill | Streak Hero | Shows freezes left ("1 of 2 freezes left"). At risk it becomes the "Use freeze" button for today; disabled (`aria-disabled`, still focusable, reason in `aria-describedby`) when the weekly quota is used. Freeze never applies automatically (CAP-10). |
| Week Strip | Streak Hero | Always Mon–Sun: done / frozen / missed / today pending ("?") / future (empty). Read-only; each day named in full ("Wednesday: frozen", "Today: not yet", "Friday: upcoming"). |
| Level Path | Dashboard hero | `nav aria-label="Level path"` with an `<ol>` of node buttons in level order (Level 1 → Ujian Akhir); the Level Callout's Primary Button follows the active node in DOM order. Active node in view on load. Consecutive Under Construction levels show as Under Construction and cannot start (CAP-1). |
| Level Node | Level Path, Level Map | States: passed / active (`aria-current="step"`) / locked / under construction; side-track variant on Level Map only (CAP-15), right of the main path and joined to Level 8 by a dashed spur, last in the node order. Button; `Enter` opens Level Detail Panel; locked/UC open it read-only with the reason in `aria-describedby`. Name built with `aria-labelledby` from visible spans ("Level 3", `<span lang="id">Hitung bersyarat</span>`, "active, 4 of 5 practices done"). |
| Level Callout | Level Path at active node | Practice Pips + next Primary Button; Test lock line until 5 practices are done (CAP-9). After Test Level 4 passes: "Level 4 complete — Level 5 is coming soon" + "Practice again" (opens Level Detail Panel). Closes while another node has focus so it never covers it. |
| Practice Pips | Level Callout, Level Detail Panel | 5 segments = practices 1–5 completed (any score); always paired with "x/5 practices done". Repeats never add pips. |
| Under Construction Tag | Nodes, Ujian Akhir card, side-track node, Results — Ujian Akhir | Static label; no start action anywhere it appears. |
| Level Detail Panel | Level Map, Dashboard | Next item: "Start Practice N" / "Start Test". Every completed practice and the passed Test: "Practice again" (new data; counts for streak and records; never changes Pips, gate or level status). Failed Test: "Try the Test again" (immediate). Opening starts nothing. Focus: heading on open, the opening node on close. |
| Activity Chart | Dashboard rail | 7 days of attempt counts; peak and frozen day marked; footer "Avg x/day · Peak <day> n". Tooltip on hover/focus: full day name + count, dismissible with `Esc`, hoverable. A screen-reader-only 7-day table replaces per-bar tab stops. |
| Records Card | Dashboard rail | Top record times; whole card → Records. |
| History List | Dashboard rail | Last 3 attempts; row → that attempt's Results; "View all" → History. |
| Phone Dock | Phone Dashboard | Pinned; mini stats + Primary Button "Start Practice N" kept visible. Tap shows the phone message inline above the button (polite); no attempt is created. Content keeps `scroll-padding-bottom` = dock height. |
| Streak Risk Pill | Streak Hero (phone + desktop) | Appears when today has no graded attempt; time left until the day boundary ("4h 30m left") in the fixed CAP-10 zone. Countdown is never announced per tick. |
| Login Card | Login | One "Sign in with Google" button (`Enter`/`Space` activate) opens the Google account popup. Pending: button disabled, spinner + "Connecting…". Only the single allowlisted Google account gets a session (CAP-17); any other account is rejected with no session. Popup closed or cancelled → back to idle, no error. Every failure (account not allowlisted, popup blocked, network, server) shows inline in the one slot under the button (`role="alert"`), never a Toast; it clears on the next attempt. Success → Dashboard (or the surface requested before sign-in); session remembered ~30 days per device. No username/password fields, no "Forgot password". |
| Attempt Card | Dashboard (rail top; phone: under Streak Hero) | Shown while an attempt is open (not yet graded), on every device (CAP-12). "Resume" → Exam in progress for that attempt. "Abandon" → confirm `Dialog` → attempt cancelled (not graded). While the card exists, every other Start / Practice again is disabled with "Resume or abandon the attempt in progress first." |
| Orbit Loader | Exam in progress | Decorative focal point while Excel is in use (`aria-hidden`). Runs until the server grades the file, then the page moves to Results by itself (CAP-3). Pause/play control stops and resumes it. |
| Exam Status Line | Exam in progress | `role="status"`, always visible: "Excel is open — Practice 5 · 12:34" (time since Start; never announced per tick) + "Klik Finish di file kalau sudah selesai, ya." (`lang="id"`) + "Download didn't start? Download again" (re-downloads the same attempt's file; start time unchanged). After the file arrives: "File received — grading…". |
| Hint Select | Exam in progress (practice, Test) | El Zavier picks the question the hint is for: shadcn `Select` labelled "Hint for", options "Soal 1 … Soal N" of this attempt. Changing it spends nothing. |
| Hint Button | Exam in progress (practice, Test) | Accessible name "Hint for Soal 3, minus 5 points, 2 left". Each activation reveals the next hint for the selected soal inline ("Hint 1 · Soal 3"), deducts 5 and decrements the attempt's quota (CAP-7). Guard: disabled while the request is pending, then focus moves to the new hint text (`tabindex="-1"`), so a double `Enter` cannot spend two. Quota 0: button stays in place, `aria-disabled`, label "No hints left", focus kept. Absent for Ujian Akhir. |
| Upload Dropzone | Exam in progress | A real file `<input accept=".xlsm,.xlsx">` button reachable by `Tab`, opened with `Enter`/`Space`; dragging optional. Uploads to the open attempt (CAP-4). Rejections show the reason message inline (`role="alert"`); attempt stays open unless the reason is "attempt closed" (CAP-18). |
| Exam Timer | Ujian Akhir only — **Next (CAP-14)** | Remaining time replaces elapsed time in the Exam Status Line; announced only at 10, 5 and 1 minutes left. |
| Exam Workbook | Excel desktop | Opens on the Instructions sheet. Finish saves and sends (CAP-3): sent → message, workbook closes (Excel too if no other workbook is open); send failed → message pointing to upload, workbook stays open; rejected → reason message (same set as upload), workbook stays open. |
| Score Badge | Results | On load: score counts up (~1s) while the badge makes one turn — time-based, never scroll-driven. Final score is also static text in the Results `<h1>`. Deductions (time, hints) and "x of y correct" beside it (CAP-5, CAP-7, CAP-11). |
| Wrong Answer Row | Results, History detail | Listed under a "Wrong answers" heading with the count. One row per wrong question: "Soal N", what was wrong and why (CAP-5), "See tip" jumps to its Tips Card. Correct questions are counted ("8 of 10 correct"), not listed. |
| Tips Card | Results, Tips & Tricks | One per graded question (correct and wrong), "Soal N" + ✓/✗ with text, ≥1 shortcut when relevant (CAP-8). Every card shown joins the Tips & Tricks collection. Not a tab stop. |
| Tips Carousel | Results | `role="region" aria-roledescription="carousel" aria-label="Tips" tabindex="0"`; arrow keys and Prev/Next move one card; snap per card; polite "Tip 3 of 8"; no auto-advance; `scroll-margin` keeps the current card clear of the edge fade. |
| Fire Effect | Results — Test passed only | Plays once with the badge; "Level N unlocked!" (or the Level 4 copy) renders whether or not the effect plays; link back to Level Map where the new node lights up. |
| 3D Scroll Scene | Level Map, Results | See Interaction Primitives. Decorative copy only (`aria-hidden`, `inert`); the real map, score and lists are always in the DOM. |
| Setup Steps | Setup Guide | Numbered, one-time steps for Excel 2021 (CAP-16): the fixed working folder, saving every downloaded `.xlsm` there, Trusted Location on that folder, Unblock if needed. Ends with "Still blocked? Upload appears on the exam screen after Start" (+ "Resume" link when an attempt is open). |
| Toast | Global (signed-in) | Network/server failures during refreshes only; validation and Login errors stay inline. |
| Kbd | Tips Card, Setup Steps, keyboard hints | Static rendering of keys and Excel menu paths (`lang="en"`). |

## State Patterns

| Surface | State | Treatment |
|---|---|---|
| Login | Error | Inline under button (message set: account not allowlisted, popup blocked, network / server); clears on the next "Sign in with Google". |
| Login | Loading | Button disabled, spinner + "Connecting…" while the Google popup is open and the session is created. |
| Login | Popup closed / cancelled | Back to idle; no error. |
| Login | Already signed in | `/login` redirects to Dashboard. |
| Dashboard | First run (empty progress) | Level 1 active, rest locked/Under Construction (CAP-1); Streak Hero 0; History/Records/Activity show a one-line empty message + link; Setup Guide prompt on the rail — dismissible, hidden after the first attempt graded via macro. |
| Dashboard | Loading | `Skeleton` shaped like Level Path + rail cards. |
| Dashboard | Attempt in progress | Attempt Card at the rail top; other Starts disabled with reason. |
| Dashboard | Streak safe today | Streak Hero normal, Week Strip today = solid. |
| Dashboard / phone | Streak at risk | Numeral desaturates (stays ≥3:1), Streak Risk Pill with time left, today = "?", Freeze Pill becomes "Use freeze" (if quota left), Primary Button stays the main action. |
| Dashboard | Frozen today | Today = snowflake; "0 of 2 freezes left"; freeze-used message (polite). |
| Dashboard | Freeze quota used | "Use freeze" disabled with reason (CAP-10). |
| Dashboard | Streak restarted | One-time message in Streak Hero the first visit after a reset. |
| Dashboard | All V1 levels passed | Level Callout on Level 4: "Level 4 complete — Level 5 is coming soon" + "Practice again". |
| Phone | Start / Practice again tapped | Phone message inline; nothing downloads, no attempt starts. |
| Level Map | Default | "Skip intro" link first; 3D Scroll Scene; Level Path with side-track node. |
| Level Map / Detail | Locked level | Read-only panel: "Pass Test Level N-1 to unlock." |
| Level Map / Detail | Test locked | Test row: lock + "Test opens after 5 practices — 1 to go." |
| Level Map / Detail | Under Construction (level or side track) | Hatched node, Under Construction Tag, no Start (CAP-1, CAP-15). |
| Level Detail Panel | Loading | `Skeleton` rows inside the open Sheet. |
| Exam in progress | Waiting | Orbit Loader + Exam Status Line + Hint Button (quota shown) + Upload Dropzone + Setup Guide link. |
| Exam in progress | Download didn't start | "Download again" in the Exam Status Line re-downloads the same file. |
| Exam in progress | Page reloaded / returned via Resume | Rehydrated from the server: attempt, elapsed time, revealed hints. |
| Exam in progress | Hint opened | Hint text inline (`lang="id"`), focus on it, quota −1, "−5" in warning. |
| Exam in progress | Hint quota used | Hint Button stays, `aria-disabled`, "No hints left"; focus unchanged. |
| Exam in progress | Macro blocked / Finish did nothing | Not detectable; Upload Dropzone always visible (CAP-4). |
| Exam in progress | Macro send failed | Workbook stays open with the upload message; exam screen unchanged, Dropzone ready. |
| Exam in progress | Uploading | Dropzone progress; Orbit keeps running; "Uploading" / "File received" announced (polite). |
| Exam in progress | File rejected (upload or macro) | Inline reason message in the Dropzone (`role="alert"`); attempt stays open (except "attempt closed"); Dropzone ready again (CAP-18). |
| Exam in progress | Grading | Status line "File received — grading…"; Orbit keeps running. |
| Exam in progress | Grading slow | Slow-grading message under the status line (threshold set in architecture). |
| Exam in progress | Grading failed | Destructive message + "Try again" Primary Button (re-requests grading of the received file); attempt stays open; Dropzone stays. |
| Exam in progress | Session expired | Next action redirects to Login; after "Sign in with Google" El Zavier returns to this exam screen (or to Results if graded meanwhile). |
| Exam in progress | Network error | Toast; state reloaded from server on reconnect. |
| Exam Workbook | Sent / send failed / rejected | See Exam Workbook component and message set. |
| Results | Normal (≥80) | `<h1>` "Practice 5 — 85/100", Score Badge turn + count-up, glow, "x of y correct", Wrong Answer Rows, Tips Carousel, outline "Practice again". |
| Results | Low score (<80) | Calm: no turn, no glow, no fire; score shown at final value; same content. |
| Results | All correct | "Semua benar!" line in place of the wrong-answer list; Tips Carousel shows all cards. |
| Results | Test passed | `<h1>` "Test passed — 88/100. Level 4 unlocked!"; Fire Effect; "Back to Level Map". |
| Results | Test passed, Level 4 | Fire Effect; `<h1>` "Level 4 complete! Level 5 is coming soon"; "Back to Level Map". |
| Results | Test not passed (<80) | `<h1>` "Test not passed — 72/100, needs 80"; calm; "Try the Test again" (CAP-9). |
| Results | New record | "New record" Badge next to time (CAP-11). |
| Results | Opened from History | `Skeleton` while loading; static (no count-up, turn, fire or scene); "Practice again". |
| History / Records / Tips & Tricks | Empty | One-line message + link to Dashboard's next action. |
| Tips & Tricks | Filter or search with no match | One-line message (e.g. "Belum ada Tips untuk Level 3 — selesaikan latihan dulu, ya.") + clear filter. |
| Setup Guide | Default | Steps list; no completion tracking implied. |
| Settings | Default | Theme Toggle, Reduce motion switch, streak time zone as read-only text ("Set at first login"), account row "Signed in as <Google account>" + Log out. |
| Settings | Saved / error | Inline confirmation (polite); save errors inline. |
| Level Map, History, Records, Tips & Tricks | Loading | `Skeleton` in the surface's layout; 3D Scroll Scene waits for data, never blocks it. |
| Any surface | First-load failure | First-load message + "Try again" in place of the Skeleton. |
| Any surface | Network error after load | Toast (destructive); last loaded data stays visible. |
| Log out | Default | Session ends immediately → Login; no confirmation. |
| Any signed-in surface | Signed out / session expired | Redirect to Login; after "Sign in with Google", back to the requested surface (CAP-17). |
| Ujian Akhir (all surfaces) | V1 | Under Construction; counter 0/5 visible (CAP-14 is Next). |

## Interaction Primitives

**Motion vocabulary** (easings in `DESIGN.md` → Brand & Style). "Reduced" applies when the OS flag or Settings "Reduce motion" is on.

| Primitive | Where | Spec | Reduced |
|---|---|---|---|
| Page entrance | Dashboard | One timeline in reading order: header → Level Path (trail draw ~0.8s + node pop, 90ms stagger) → rail cards in rail order; rise 24px + scale .97 → 1, bouncy; whole timeline ≤1s; `animation-fill-mode: both` so nothing flashes before its delay. | Final position; optional ≤150ms opacity fade |
| Secondary page entrance | History, Records, Tips & Tricks, Setup Guide, Settings | Single 0.2s fade + 8px drop; no stagger. | Instant |
| Login entrance | Login | Column 0.5s fade + 10px rise; sign-in block 0.4s + 20px rise; cinematic. | Static |
| Streak Hero entrance | Dashboard | Desktop: cinematic rise 40px + blur → sharp inside the page timeline, numeral count-up. Phone: final numeral within ≤0.5s (≤300ms opacity fade), no count-up, no blur. | Final numeral immediately |
| Count-up | Streak numeral, scores, stat values | Fixed ~1s cinematic, whatever the value; tabular mono. The final number is real DOM text (visible or `sr-only`); animated digits are `aria-hidden`. | Final value |
| Active pulse | Active Level Node, Streak Risk Pill | Two expanding rings, 2.4s, on a pseudo-element (transform/opacity); stops after 2 cycles (≤5s) and settles to a static ring. | Static ring / border |
| Hover | Small clickable cards, Level Nodes, Primary Button | Small card: lift 2px + scale 1.02 + `{colors.glow}` border. Node: scale 1.14 (also on focus). Button: lift 2px + scale 1.03 + `{colors.glow-soft}` ring; press sinks onto `{colors.primary-edge}`. Large containers (Level Path card, Streak Hero, Results panels): glow border only. | Glow/border only |
| Nav nudge | App Sidebar inactive items | Shift 4px right, 300ms; active item never moves. | None |
| Arrow chip | Records Card, History "View all" | ↗ rotates 45° on card hover/focus. | None |
| Row hover | History, Records, Level Detail Panel rows | `{colors.muted}` background + icon scale 1.1. | Background only |
| Chart grow | Activity Chart | Bars grow from 0, 60ms stagger, inside the page timeline; hovered/focused bar brightens + glow. | Full height |
| Drawer | Mobile Drawer, Level Detail Panel | Open: slide 0.4s bouncy + scrim fade. Close: 0.25s, no bounce. | Instant or ≤150ms fade |
| Tips snap | Tips Carousel | Smooth scroll-snap per card. | `scroll-behavior: auto` |
| Score Badge turn | Results | One turn over ≥1.2s, cinematic, on load with the ~1s count-up. | Face-up, final score |
| Fire Effect | Results — Test passed | Once, behind the badge; flicker ≤3 luminance changes per second, low amplitude. | Skipped; headline stays |
| Orbit | Exam in progress | One dot per ring, periods (outer → inner) 44/40/36/14/16/15s, start angles 0/90/180/0/270/90°, clockwise, linear, infinite; no easing, no pulse. Pause/play control. | Stationary |
| Auto-navigation | Exam → Results | Short fade; document `<title>` set; focus moves to the Results `<h1>` carrying the outcome. | No transition; same focus move |

**Scroll-driven 3D (apple.com-style) — only on Level Map and Results.** Sticky stage ≤150vh; scroll scrubs it (CSS `animation-timeline: view()`).

| Scene | Beats (in scroll order) |
|---|---|
| Level Map | "Skip intro" link is the first focusable element and jumps to the Level Path. 3D laptop rotates into view and opens its lid, screen showing the app; 3D Excel logo turns alongside; the map board tilts from ≤25° to flat (no Z spin); trail draws; nodes light up ending on the active level. Then the real Level Path. Scroll ranges: laptop turn 0–35% (lid 5–38%), logo turn 0–60%, board 35–72%, trail 60–88%, nodes 80–100%. |
| Results | The score, badge and outcome are settled on load (not in the scene). Below them, the Wrong Answer Rows and Tips Carousel lift in with a light 3D tilt as El Zavier scrolls. Low score and History view: scene skipped, static. |

**Static frame** (laptop open, board flat, trail drawn, lists in place; stage collapses and stops being sticky) when any of: reduced motion, no scroll-timeline support, `navigator.connection.saveData`, `deviceMemory ≤ 4`. **Light version** on phone or coarse pointer below lg: transform/opacity only, no blur, no `backdrop-filter`, no animated shadows. Scene assets lazy-load after the page data and never block the first interaction.

**Input.** Mouse/touch first; all actions keyboard-reachable (`Tab` order = reading order, `Enter`/`Space` activate, `Esc` closes Sheet/Dialog/tooltip, arrows move the Tips Carousel). No custom shortcuts in V1.

## Accessibility Floor

- WCAG 2.2 AA target; contrast passes in both modes (`DESIGN.md` → Colors).
- Reduced motion: per-element states in Interaction Primitives; every loop either stops within 5s or has a pause control (Orbit).
- Focus ring: 2px `{colors.ring}` outline, 3px offset, on every interactive element; Level Nodes draw it as an SVG circle on `:focus-visible`. Sticky Header Bar, Phone Dock and Level Callout never cover the focused element (`scroll-padding`, Callout closes when another node has focus).
- Targets: ≥24×24px everywhere; Hint Button and Upload Dropzone 40px tall, ≥8px apart; ≥44px on phone (Phone Dock button 52px, Use freeze, Drawer close, Carousel Prev/Next).
- Every surface has its own `<title>`; Results sets it on auto-navigation and focuses the `<h1>`, which always states the outcome in text (pass/fail never depends on fire or glow).
- Decorative and duplicate content is `aria-hidden` (+ `inert` where it copies controls): 3D laptop, Excel logo, scene board and list copies, Orbit rings/dots/logo, Fire Effect, glows and pulse rings, grid background, A–J column strip, glyphs (🔥 ✗ ✓ ❄ ↗) — each glyph is paired with text.
- Status is never colour- or shape-only: Wrong Answer "✗ Soal N", Tips "✓/✗" with text, "x/5 practices done" with every Practice Pips, Week Strip day names, Under Construction tag text, freeze snowflake + text, Theme Toggle `aria-pressed`, Activity Chart sr-only table.
- Language: `<html lang="en">`; `lang="id"` on perintah soal, hint text, keterangan, Tips bodies, system messages, the Exam Status Line instruction, toasts, level names and every live region carrying Indonesian. English Excel terms inside Indonesian text use `<code lang="en">` / `<kbd lang="en">`. Days and times use English (Mon–Sun, "4h 30m left").

**Live regions** (nothing else announces):

| Polite | Alert (`role="alert"`) | Never announced |
|---|---|---|
| Hint revealed + hints left; upload started / file received / grading; freeze used; Settings saved; "Tip 3 of 8"; phone Start message; Exam Timer at 10/5/1 min left (Next) | File rejected (any reason); Login errors; grading failed | Count-up ticks; Exam Status Line elapsed time; Streak Risk countdown; Orbit; pulses |

## Key Flows

CAP coverage: J0 → CAP-1, 2, 3, 16, 17 · J1 → CAP-2, 3, 5, 6, 7, 8, 9, 10, 11 · J2 → CAP-4, 12, 18 · J3 → CAP-10, 12 · J4 → CAP-1, 9, 11 · J5 → CAP-5, 8, 11. CAP-13/14/15 (Next) appear only as Under Construction states (CAP-15: side-track node on Level Map).

### J0 — First login and Setup Guide (El Zavier, personal laptop, first evening)

1. El Zavier opens the app URL; the Login Card fades and slides up.
2. Clicks "Sign in with Google" (button shows "Connecting…") and picks the allowlisted Google account in the popup (CAP-17); the session is remembered on this laptop for ~30 days.
3. Dashboard first run: Level Path with Level 1 active, everything else locked or Under Construction (CAP-1); Streak Hero at 0; Setup Guide prompt on the rail.
4. El Zavier opens Setup Guide: creates the fixed working folder, sets it as Trusted Location in Excel 2021 and sets the browser to save downloads there (CAP-16).
5. Back on Dashboard, clicks "Start Practice 1"; the Exam in progress screen shows the Orbit Loader and "Excel is open — Practice 1 · 00:05" (CAP-2).
6. El Zavier saves the `.xlsm` into the working folder and opens it on the Instructions sheet.
7. Finishes the questions and clicks **Finish**; Excel says "File terkirim!" and the workbook closes (Excel too, since nothing else is open) (CAP-3).
8. **Climax:** without touching the browser, the page moves to Results — score counts up, the first Tips Cards slide in, and the Streak Chip in the Header Bar reads 1.

Failure: another Google account picked → inline rejection under the button; El Zavier signs in again with the allowlisted account. Popup closed → back to idle, no error. Popup blocked → inline message to allow popups. Download didn't start → "Download again". Macro still blocked → the workbook stays open with "upload lewat web" and El Zavier uploads it (J2).

### J1 — Evening practice with a hint (El Zavier, personal laptop, night)

1. El Zavier opens Dashboard; Level Callout at Level 3 — Hitung bersyarat shows 4/5 Practice Pips.
2. Clicks "Start Practice 5"; the `.xlsm` downloads with fresh data (CAP-2, CAP-6); Orbit Loader appears.
3. Stuck on the SUMIFS question, El Zavier picks "Soal 3" in the Hint Select, presses "Hint (−5)" and reads "Hint 1 · Soal 3" inline; quota shows 2 left (CAP-7).
4. Finishes in Excel and clicks **Finish** (CAP-3).
5. Results: "8 of 10 correct", the Score Badge turns while the score counts up; the deduction line shows the hint; two Wrong Answer Rows explain the wrong cells (CAP-5).
6. El Zavier swipes the Tips Carousel — one card per question, with shortcuts (CAP-8); the time shows "New record" (CAP-11).
7. **Climax:** back on Dashboard, Practice Pips are 5/5 and the Level Callout's lock line flips to "Start Test" — Test Level 3 is open (CAP-9); Week Strip marks today done (CAP-10).

Failure: score <80 → calm Results variant, no celebration; the practice still counts toward 5/5 and the streak. Tab closed mid-attempt → Dashboard shows the Attempt Card; "Resume" returns to the exam screen.

### J2 — Office PC, macro blocked → upload (El Zavier, office PC, lunch break)

1. El Zavier logs in on the office PC; Dashboard shows the same progress and streak as the laptop (CAP-12).
2. Starts a practice; the `.xlsm` opens but IT policy blocks macros, so **Finish** does nothing.
3. El Zavier saves the file in Excel and returns to the browser's Exam in progress screen (or uses "Resume" on the Attempt Card).
4. Drops the file on the Upload Dropzone (or picks it with `Enter`); progress shows under the Orbit Loader (CAP-4).
5. **Climax:** Results appear exactly as via macro — same score and keterangan for the same file (CAP-4) — and the laptop will show it too.

Failure: El Zavier picks an old file from Downloads → "File ini bukan dari percobaan yang sedang berjalan. Upload file yang kamu unduh waktu klik Start, ya." A Save-As `.xlsx` copy → the altered-identity message. The attempt stays open; uploading the right file grades normally (CAP-18).

### J3 — Phone streak check and rescue (El Zavier, phone, 19:30, no laptop nearby)

1. El Zavier opens the web on the phone; within half a second the first screen shows the Streak Hero numeral, dimmed.
2. The Streak Risk Pill shows no practice yet today and the time left until the day boundary; today in Week Strip shows "?".
3. El Zavier taps "Start Practice 4" out of habit; the phone message says practice happens in Excel on the laptop.
4. With no Excel desktop nearby, El Zavier taps "Use freeze" on the Freeze Pill (CAP-10).
5. **Climax:** the numeral re-lights, today becomes a snowflake, "0 of 2 freezes left" — "Streak aman!" — and the laptop will show the same (CAP-12).

Failure: freeze quota already used this week → "Use freeze" disabled with the reason; the only way to keep the streak is a practice on a desktop before the day ends.

### J4 — Test Level 3 from Level Map (El Zavier, personal laptop, weekend)

1. El Zavier opens Level Map; the 3D Scroll Scene plays (laptop opens, Excel logo turns, board flattens, nodes light up to Level 3).
2. Clicks the Level 3 node → Level Detail Panel: 5/5 practices, Test open, best score, record time.
3. Clicks "Start Test"; Exam in progress shows the Orbit Loader with no countdown (CAP-9).
4. Finishes in Excel and clicks **Finish**.
5. **Climax:** Results — "Test passed — 88/100. Level 4 unlocked!": the Score Badge turns while the score counts up, the Fire Effect rises; back on Level Map, Level 4 lights up as the new active node (CAP-1, CAP-9).

Failure: score <80 → calm variant, no fire, "Try the Test again"; Level 4 stays locked; the time still counts for Records (CAP-11).

### J5 — Preparing for the Test (El Zavier, personal laptop, evening before J4)

1. El Zavier opens Tips & Tricks, filters to Level 3 and searches "SUMIFS" to review collected cards and shortcuts (CAP-8).
2. Opens Records to see the record times for Level 3 practices — a target pace for the Test (CAP-11).
3. Opens History, picks earlier Level 3 attempts and rereads the Wrong Answer Rows of each (CAP-5).
4. **Climax:** El Zavier spots the same mistake twice (typed numbers instead of SUMIFS) and clicks "Start Test" from Level Map knowing exactly what to watch for.

Failure: not applicable (read-only); empty collections show the empty state, and a weak spot can be drilled first with "Practice again" from Records.

## Inspiration & Anti-patterns

| Source | Taken | Not taken |
|---|---|---|
| v0 "Sign In with X" — [imports/login-page.zip](imports/login-page.zip) | Single centered column `max-w-md`, small logo, big title + grey subtitle, one button with spinner (disabled while pending), every error in one slot under the button and cleared on retry, separator, two-layer fade + slide-up entrance, signed-in visitor skips the sign-in | X as the sign-in provider (Google instead, CAP-17), monochrome palette, footer links, welcome card |
| v0 "Tasko" dashboard — [imports/dashboard-page.zip](imports/dashboard-page.zip) | Fixed 256px sidebar with Menu/General groups, filled glowing active item and 4px hover nudge; inverted dark card with mono digits; rounded bar chart with Average/Peak footer and full-day tooltip; count-up, one page-wide stagger, hover by size, ↗ chip, row hover, quick fade on secondary pages; drawer "Open menu" with faster close; tablet 2-up tier | Tasks/Calendar/Team content, light-default theme, header search, notification icons, the stagger flash defect (`forwards` + delay) |
| v0 "orbit animation" — [imports/animation-page.zip](imports/animation-page.zip) | Whole Orbit Loader: exact ring radii, opacities, periods and start angles; calm waiting room for the exam | `<img>`-loaded SVG with hard-coded colours, CSS `r` |
| apple.com product pages | Scroll-driven 3D objects (Level Map, Results lower section), giant hero numerals | Scroll scenes on Dashboard or Login; scroll-scrubbed outcomes |
| Duolingo | Encouraging santai tone, streak + freeze framing | Push/email nags (no notifications at all) |
| Rejected | Automatic freeze shown in renders (CAP-10 is manual); the "only an animation" exam screen (hint, upload and status line must stay, CAP-4/CAP-7); listing correct questions in Results (counted only; Tips cover all); a phone Start that creates an attempt | |

## Responsive & Platform

| Context | Behavior |
|---|---|
| Personal laptop (primary, ≥ lg) | Full shell: App Sidebar + Header Bar; Dashboard two columns (Level Path + rail); full 3D scenes. |
| Office PC (desktop browser) | Same as laptop. Macro may be blocked — Upload Dropzone path is first-class (CAP-4). |
| Tablet (md–lg) | Mobile Drawer; one column with rail cards 2-up; light 3D. |
| Phone (~390px) | First screen = Streak Hero numeral (visible ≤0.5s) with Streak Risk Pill when at risk; Attempt Card under it when open; Level Path as a vertical rail, Level 1 first, active level as an inline Level Callout, consecutive Under Construction nodes collapsed into one; Phone Dock pinned. Start / Practice again show the phone message. Primary job: check and rescue the streak (J3). |

Progress, streak, freeze, records and the open attempt are identical across devices (CAP-12).

## Open Questions

- **Deferred to `bmad-architecture`:** 3D scene technique and budget (scrubbed image sequence / `<video>` vs CSS 3D layers, asset budget, frame-rate target for the light phone version); the slow-grading threshold.
- **Score weighting per question (CAP-5, spec):** the mocks show "8 of 10 correct" with one hint (−5) scoring 85, which only works if questions are not weighted equally. The spec does not define weights yet.
- [ASSUMPTION] Rendered compositions not yet confirmed one by one (review the mocks): Results layout (badge column left, 880px column), Level Map scene placement and scroll ranges, side-track spur from Level 8, Level Detail Panel width 430px, "Wrong answers" heading, Test row caption "Open · needs 80".

## Spec update candidates

Behaviour the product spec must absorb (flow back via `bmad-spec` update):

1. **CAP-5** — success becomes "every wrong question shows its reason; correct questions are counted ('x of y correct')" (decision 8).
2. **CAP-2 / CAP-3** — web button *Mulai* → **Start**; in-file *Selesai* → **Finish**.
3. **CAP-9 / CAP-10 / CAP-11** — repeat attempts: "Practice again" on every completed practice and Test; new data; counts for streak and records; never changes Pips, gate or level status.
4. **CAP-2 / CAP-3 / CAP-4** — attempt lifecycle: one open attempt; Attempt Card Resume / Abandon (abandoned = cancelled, not graded); other Starts locked while open; re-download returns the same file; return after re-login; grading slow / failed states.
5. **CAP-18** — four rejection reasons (not this attempt, already graded, identity altered/damaged, attempt closed), each with its own message, on both macro and upload paths.
6. **CAP-3** — Exam Workbook: Instructions sheet, macro messages for sent / send failed; workbook stays open on failure.
7. **CAP-8** — Tips & Tricks collection page with level filter and search.
8. **CAP-5 / CAP-12** — History page: past attempts reopen their Results.
9. **CAP-10** — streak rules confirmed by the user (drop "menunggu konfirmasi"); time zone fixed at first login and read-only in Settings.
10. **CAP-10** — streak presentation: at-risk state with countdown, Week Strip, Activity Chart, one-time "streak restarted" message.
11. **CAP-12** — phone as a third device: streak check + freeze only; Start / Practice again show a "use the laptop" message and create no attempt.
12. **Non-goals** — no notifications (push or email).
13. **All CAPs (language)** — English UI chrome; casual Indonesian for perintah soal, keterangan, hints, Tips and full-sentence system messages; Excel names exactly as English Excel; "Ujian Akhir" kept as a proper name.
14. **CAP-10 / CAP-17** — Settings: theme, Reduce motion switch, read-only streak time zone, "Signed in as <Google account>" + Log out.
15. **CAP-5 / CAP-9** — Results mood: calm variant below 80 (practice and Test); Fire Effect only for Test passed.
16. **CAP-1 / CAP-9** — V1 end state: passing Test Level 4 shows "Level 4 complete! Level 5 is coming soon".
17. **CAP-15** — side track shown in V1 as one Under Construction node beside the main path on Level Map.
18. **CAP-16** — fixed working folder = Trusted Location promoted from assumption to V1 decision; Setup Guide names it as the save location for every `.xlsm`.
19. **CAP-14** — Ujian Akhir remaining time shown on the exam screen (Next).
20. **CAP-9** — retake after a failed Test is immediate; no extra practices required.
21. **CAP-7** — hint targeting: El Zavier picks the question (Hint Select "Soal N"); each hint −5 and uses one of the attempt's quota.
22. **CAP-7 / CAP-8** — Office 2021-only constraint extended to Tips and hint text.
23. **CAP-17** — login via Sign in with Google with a single allowlisted account (replaces username+password).
24. **CAP-5** — per-question score weighting, so "x of y correct" and the score agree (open question above).
