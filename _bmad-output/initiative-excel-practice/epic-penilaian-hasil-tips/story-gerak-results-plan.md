---
title: 'Gerak Results'
type: 'feature'
ticket: '7'
created: '2026-11-16'
status: 'draft'
route: 'full'
route_source: 'auto'
review: ''
review_source: ''
lenses_ran: []
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/mockups/key-results.html', '{project-root}/_bmad-output/initiative-excel-practice/epic-penilaian-hasil-tips/story-layar-results-isi-dan-varian-plan.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Results dari 3.6 sepenuhnya statis: Score Badge tidak berputar, skor tidak menghitung naik, Test lulus tidak punya Fire Effect, dan daftar soal salah serta Tips tidak "naik" saat digulir. Momen hasil yang dijanjikan DESIGN/EXPERIENCE (J1 langkah 5, J4 klimaks) dan aturan gerak B7/AD-12 belum ada.

**Approach:** Menambah gerak di atas komponen 3.6 tanpa mengubah isi atau datanya: putaran satu kali Score Badge dan hitung naik skor saat dimuat (berbasis waktu), Fire Effect sekali di belakang badge hanya untuk Test lulus, dan adegan scroll ringan untuk bagian soal salah dan Tips. Semua gerak CSS saja (keyframes, `@property`, `animation-timeline: view()`); React hanya memasang atribut pemicu lewat `useMotionPreference`. Tanpa atribut itu halaman adalah bingkai statis 3.6. Tanpa migrasi DB, tanpa dependensi baru.

## Boundaries & Constraints

**Always:**
- Gerak hanya di Results `mode="live"`. `mode="static"` (History) tidak punya putaran, hitung naik, api, maupun adegan, berapa pun skornya.
- Gerbang gerak (fungsi murni dari varian 3.6, jenis item, dan mode): putaran + hitung naik + adegan scroll = `live` dan varian `pass` (skor ≥ 80, latihan maupun Test); Fire Effect = `live`, varian `pass`, dan item `kind: "test"`. Varian `calm` (skor < 80): tanpa putaran, tanpa hitung naik, tanpa glow, tanpa api, tanpa adegan — skor langsung di nilai akhir.
- Reduced motion (OS `prefers-reduced-motion` atau switch Settings `data-motion="reduce"`): badge menghadap depan dengan skor akhir, tanpa hitung naik, Fire Effect tidak dirender, daftar di tempatnya. Glow statis 3.6 untuk skor ≥ 80 tetap (styling, bukan gerak). Mengubah preferensi saat halaman terbuka langsung berlaku.
- Bingkai statis juga dipakai saat render server dan hidrasi (`useMotionPreference` mengembalikan `reduce`), dan untuk adegan scroll juga saat `saveData`, `deviceMemory ≤ 4`, atau browser tanpa `animation-timeline` (`@supports`). Pada dua sinyal terakhir putaran, hitung naik, dan api tetap jalan.
- CSS saja (AD-12): keyframes/transition, `@property`, scroll-driven animation, dan SVG/elemen inline. Tidak ada `setTimeout`, `setInterval`, `requestAnimationFrame`, atau Web Animations API untuk gerak; tidak ada library animasi, video, atau aset raster.
- Skor yang terbaca tetap nilai akhir sepanjang waktu: `<h1>` 3.6 tidak disentuh; Score Badge tetap `aria-hidden` dan node teks skornya di DOM selalu nilai akhir (digit yang bergerak hanya konten CSS). Tidak ada live region baru.
- Score Badge: tepat satu putaran (rotateY 360°, ≥ 1,2 s, easing cinematic) bersamaan dengan hitung naik ~1 s dari 0 ke skor, berbasis waktu, tidak pernah digerakkan scroll; sisi belakang `streak` + ikon api; glow berada di pembungkus (`[data-slot="score-badge"]`, `data-glow="true"`) yang tidak ikut berputar dan tidak dianimasikan; yang berputar hanya cakram `[data-slot="score-badge-disc"]`.
- Fire Effect: sekali, di belakang badge di dalam Outcome panel, `aria-hidden`, `pointer-events: none`, tidak menerima fokus; nyala `warning` → `streak-vivid` dengan haze `streak-glow-strong`; ≤ 3 perubahan terang per detik; luas ≤ 25% viewport di lebar ponsel juga; hanya transform/opacity yang dianimasikan (di bawah `lg` atau pointer kasar tanpa blur). Judul dan isi tampil sama dengan atau tanpa api.
- Adegan scroll: bagian "Wrong answers" (`data-slot="wrong-answers"`) atau "Semua benar!" (`data-slot="all-correct"`) dan bagian Tips Carousel (`data-slot="tips"`) yang asli (bukan salinan) naik dengan kemiringan 3D ringan (≤ 25°, hanya rotateX + translateY + opacity) seiring scroll, di dalam `@supports (animation-timeline: view())`; skor, badge, dan Outcome panel tidak pernah ikut adegan.
- Tanpa layout shift: semua gerak hanya `transform`/`opacity`/custom property; elemen Fire Effect `position: absolute`; ukuran badge, panel, dan daftar sama dengan 3.6 sebelum, selama, dan sesudah gerak. Carousel, "See tip", fokus `<h1>`, dan judul dokumen 3.6 berperilaku sama.
- Teks chrome Inggris; tidak ada teks baru untuk pengguna.

**Never:**
- History (3.8), koleksi Tips & Tricks (3.9); "Level N unlocked!", "Practice again", "New record", "Back to Level Map", "Try the Test again", gerak Dashboard/Level Map (epic 4); item Test asli (epic 5) — varian Test dibuktikan dengan fixture (U9).
- Mengubah `Result`, grader, adapter, loader halaman, isi/teks/urutan Results 3.6, atau migrasi DB.
- Animasi `box-shadow` atau `filter: blur()`; gerak berulang (loop); lebih dari satu putaran; putaran Z; skor atau badge yang digerakkan scroll.
- Live region atau `aria-label` yang mengumumkan angka hitung naik.
- Tes yang di-skip atau ditunda.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Latihan ≥80, gerak penuh | `live`, latihan, skor 85 | badge berputar sekali + hitung naik 0→85, glow; bagian bawah naik saat digulir; tanpa api; teks skor DOM "85" dari awal | — |
| Test lulus | `live`, fixture `TEST_88` dengan item `{kind: "test"}`, skor 88 | seperti di atas + Fire Effect sekali di belakang badge; `<h1>` "Test passed — 88/100" tidak berubah | — |
| Skor <80 | `live`, latihan 64 atau Test 72 | varian tenang 3.6 apa adanya: tanpa putaran, hitung naik, glow, api, adegan | — |
| Tepat 80 / 79 | skor 80 / 79 | 80 bergerak; 79 tenang | — |
| Reduced motion | OS atau switch Settings, skor 85 / Test 88 | skor akhir, badge depan, glow statis, tanpa api, daftar di tempat | — |
| Preferensi berubah | switch dinyalakan saat halaman terbuka | atribut gerak dilepas, api hilang, skor akhir | — |
| Mode static | `mode="static"`, Test 88 | tanpa gerak dan tanpa api (badge datar 3.6) | — |
| Render server / sebelum hidrasi | HTML awal | bingkai statis: tanpa atribut gerak, tanpa elemen api | — |
| Save-Data / memori ≤4 | `saveData` true atau `deviceMemory` 4, skor 85 | putaran + hitung naik jalan; adegan scroll tidak dipasang | — |
| Tanpa scroll-timeline | browser tanpa `animation-timeline` | daftar di tempat (aturan di dalam `@supports`); sisanya jalan | — |
| Tanpa `@property` | browser lama | skor akhir langsung tampil, tidak pernah angka setengah jalan atau 0 yang menetap | — |
| Result tanpa Tip | v1, skor ≥80 (`V1_NO_TIPS_80`) | hanya bagian soal salah yang ikut adegan (tidak ada bagian Tips); tidak ada error | — |
| "See tip" saat adegan | klik "See tip" | carousel tergulir ke tampilan dan kartu terbaca penuh (perilaku 3.6) | — |

</frozen-after-approval>

## Code Map

Names below were re-checked against the merged 3.6 code on 2026-11-17.

- `src/components/results/score-badge.tsx` -- 3.6 server component `ScoreBadge({score, variant, mode})`, three layers: wrapper `[data-slot="score-badge"]` (168px, `aria-hidden`, `data-variant` `pass` | `calm`, `data-mode` `live` | `static`, `data-glow` `"true"` only for `pass` + `live`, and the static `glow-strong` shadow) → disc `[data-slot="score-badge-disc"]` (`relative size-full rounded-full`) → face `[data-slot="score-badge-face"]` (`absolute inset-0`, colour, score `<span>` + "/100" `<span>`). 3.7 turns the disc, adds a back face beside the face, the count-up overlay and the trigger attribute; the wrapper and its glow stay as they are.
- `src/components/results/results-view.tsx` -- server component (no `"use client"`; `<h1>` focus lives in `results-focus.tsx`). `ResultsView({itemId, item: {kind, number} | null, level, result, durationSeconds, mode})`; root `[data-slot="results"]` with `data-variant` / `data-mode` / `data-kind` (`practice` | `test` | `unknown`, from `knownItem(item)`); Outcome panel is the `<section aria-labelledby="results-heading">` with the `sm:grid-cols-[200px_1fr]` badge column. Derives the motion gates and hosts the (client) Fire Effect.
- `src/components/results/results-details.tsx` -- client component `ResultsDetails({questions, levelNumber})`: either `<section data-slot="all-correct">` ("Semua benar!") or `<section data-slot="wrong-answers">` (rows `data-slot="wrong-answer-row"`), then `<section data-slot="tips">` (absent when no question has a Tip); these sections get the scene attribute. Carousel logic (incl. its `SCROLL_SETTLE_MS` scroll timer) unchanged.
- `src/components/results/tips-card.tsx`, `results-focus.tsx` -- unchanged.
- `src/components/results/outcome.ts` (+`outcome.test.ts`) -- pure `resultsOutcome({item, itemId, result})` → `{variant, heading}`, `ResultsVariant`, `OutcomeItem`, `knownItem(item)` (non-practice/Test kinds → `null`); add the pure motion gate here.
- `src/components/results/results-view.dom.test.tsx`, `src/core/grading/__fixtures__/results.ts` -- 3.6 DOM tests and `Result` fixtures `PRACTICE_85`, `PRACTICE_64`, `SCORE_80`, `SCORE_79`, `TEST_88`, `TEST_72` (a Test only through the `item` prop `{kind: "test", number}`; fixtures carry no kind), `V1_NO_TIPS`, `V1_NO_TIPS_80`, `FLOORED_0`, `PARTIAL_TIPS`; reuse them, keep the 3.6 tests green unchanged. The 3.6 badge assertions are on the wrapper's `data-variant` / `data-mode` / `data-glow` / `aria-hidden`, on `badge().textContent === "85/100"` (the whole wrapper), on the face as `[data-slot="score-badge-disc"] > [data-slot="score-badge-face"]` with text "85/100", and calm `outerHTML` without `glow-strong` / `destructive`: so the back face holds no text (icon only), the counter is a CSS pseudo-element (no DOM text), the face stays a direct child of the disc, and no `glow-strong` class or text is added to a calm badge.
- `src/hooks/use-motion-preference.ts` -- `useMotionPreference(options?: {scene?: boolean})` → `"full" | "reduce"`; `"reduce"` on server and during hydration; follows `matchMedia`, `<html data-motion>` (MutationObserver), and with `scene` also `saveData` / `deviceMemory ≤ 4`. Unchanged.
- `src/components/exam/orbit-loader.tsx` -- the existing pattern: CSS keyframes in `globals.css`, component only gates on the hook.
- `src/app/globals.css` -- `--ease-cinematic` (line 54), tokens `--streak`, `--streak-vivid`, `--warning`, `--glow-soft`, `--glow-strong`, `--streak-glow`, `--streak-glow-strong` (also as `--color-*` utilities); keyframes live here (login, page-drop, drawer, scrim, dialog, menu, `orbit-turn`, `upload-slide`); the global reduced-motion rule (lines 294–309: `animation: none !important` on `*, *::before, *::after` for the OS query and `:root[data-motion="reduce"]`) already stops every keyframe, pseudo-element counters included. No `@property` or `@supports` exists yet.
- `src/test/dom.ts` -- jsdom harness: `matchMedia` stub never matches, so the hook reports `"full"` after mount; fake-timer recipe in its header. jsdom does not run CSS animations.
- `src/app/(app)/results/[attemptId]/page.test.tsx` -- server render (`renderToStaticMarkup`, already imports `PRACTICE_85`, `TEST_88`…): the place to assert the static frame in the first HTML.
- Mockup `key-results.html` lines 134–146 (coin, `turn 1.4s var(--cine) .15s both`), 188–201 (`lift`, count-up via `@property --n` + `counter()`), 206–213 (`.fire`, 5 flames + haze, 2.8s), 226 (reduced: fire hidden).
- deferred-work.md -- no open entry belongs to 3.7 (the Orbit pause/play toggle test stays with epic 4). The unassigned 3.6 entry "≥80 panel mockup styling" (`glow-soft` panel tint, coin gradient/inset rings, panel hover `glow` border) is static styling the motion does not need: 3.7 does not take it, it stays open for a polish entry.

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/results/outcome.ts` (+`outcome.test.ts`) -- add pure `resultsMotion({variant, kind, mode})` with `kind` = `knownItem(item)?.kind ?? null` → `{turn: boolean, fire: boolean, scene: boolean}` (before the motion preference): `turn` and `scene` = `live` && `pass` (the same condition as 3.6 `data-glow="true"`); `fire` = those && `kind === "test"`; all false for `static`, `calm`, and `kind` null only blocks `fire`. Tests: practice/Test/unknown × 79/80 × live/static.
- [ ] `src/app/globals.css` -- Results motion block: `@property --score-n` (`<integer>`); `@keyframes score-turn` (rotateY 0→360°), `score-count` (`from { --score-n: 0 }` to the inline final value), `fire-flame`, `fire-haze` (mockup values), `results-lift` (perspective + rotateX ≤ 16° + translateY + opacity → none); selectors keyed on the trigger attributes only (`[data-slot="score-badge"][data-animate="turn"] [data-slot="score-badge-disc"]` for the turn, the score `<span>`'s `::after` for the count, `[data-scene="lift"]`, `[data-slot="fire-effect"]`), `results-lift` inside `@supports (animation-timeline: view())` with `animation-range: entry 0% entry 90%`; turn 1.4s and count 1s, both `var(--ease-cinematic) .15s both`; flames without blur below `lg` / coarse pointer; fire box sized so it stays ≤ 25% of the viewport on a phone. Nothing here applies without a trigger attribute.
- [ ] `src/components/results/score-badge.tsx` -- becomes a client component (`"use client"`): optional `turn` prop (default `false`, so other callers are unchanged); `useMotionPreference()`; when `turn` and `"full"` set `data-animate="turn"` and `style={{"--score-n": score}}` on the wrapper `[data-slot="score-badge"]`, which keeps `aria-hidden`, `data-variant`, `data-mode`, `data-glow` and the static glow class and gains only `perspective`; the disc `[data-slot="score-badge-disc"]` gets `transform-style: preserve-3d` and is the element that turns; the 3.6 face `[data-slot="score-badge-face"]` stays a direct child of the disc with its classes and text, plus `backface-visibility: hidden`; a new sibling back face `[data-slot="score-badge-back"]` (`streak` + `aria-hidden` lucide flame SVG, no text, `rotateY(180deg)`, `backface-visibility: hidden`); the score `<span>` text stays the final value and under `data-animate` its glyphs are hidden (`color: transparent`) behind a same-box `::after` `counter(score-n)` (pseudo-element, so `textContent` is still "85/100").
- [ ] `src/components/results/fire-effect.tsx` -- new client component: returns `null` unless `useMotionPreference() === "full"`; otherwise an `aria-hidden` absolutely positioned block (`data-slot="fire-effect"`) with haze + 5 flames (sizes and delays from the mockup), no focusable content.
- [ ] `src/components/results/results-view.tsx` -- stays a server component; compute `resultsMotion` from the 3.6 `variant`, `known?.kind ?? null` and `mode`; pass `turn` to `ScoreBadge`, `scene` to `ResultsDetails`; when `fire`, render `FireEffect` inside the Outcome panel `<section>` behind the badge column (outside `[data-slot="score-badge"]`; panel `relative overflow-hidden`, badge column and text `relative` above it) and the faint static `streak-glow` panel tint of the mockup. The `glow-soft` tint / coin gradient / hover border of deferred-work stay out (see Code Map).
- [ ] `src/components/results/results-details.tsx` -- optional `scene` prop (default `false`); `useMotionPreference({scene: true})`; when both allow, `data-scene="lift"` on whichever of `[data-slot="wrong-answers"]` / `[data-slot="all-correct"]` renders and on `[data-slot="tips"]` when present; nothing else changes.
- [ ] `src/components/results/results-motion.dom.test.tsx` -- `// @vitest-environment jsdom` + `@/test/dom`, fixtures from `results.ts`: `PRACTICE_85` live → badge wrapper `data-animate="turn"`, `--score-n` 85, `[data-slot="all-correct"]` and `[data-slot="tips"]` `data-scene="lift"`, no `[data-slot="fire-effect"]`, `[data-slot="score-badge-back"]` with empty `textContent`; `TEST_88` with item `{kind: "test", number: 1}` live → `[data-slot="wrong-answers"]` and tips lifted, plus one `[data-slot="fire-effect"]` (outside the badge) that is `aria-hidden` with no focusable descendant, `<h1>` "Test passed — 88/100"; `PRACTICE_64`, `TEST_72` and `FLOORED_0` → no `data-animate`, no `data-scene`, no fire, `data-variant="calm"`; `SCORE_80` vs `SCORE_79`; `PRACTICE_85` with an unknown item → turn, no fire; `mode="static"` Test 88 → none of the three; reduced motion via `document.documentElement.dataset.motion = "reduce"` and, separately, a matching `matchMedia` mock → none of the three for 85 and Test 88, badge text is the final score; switch flipped after mount (inside `act`) → attributes and fire removed; `navigator.deviceMemory = 4` and `connection.saveData = true` → turn kept, `data-scene` absent; `V1_NO_TIPS_80` → no error, `[data-slot="wrong-answers"]` lifted, no `[data-slot="tips"]`; `badge().textContent` stays "85/100" (or the fixture's score) under `data-animate`. Count-up with fake timers: `vi.useFakeTimers()` before render, assert the badge's score text node and the `<h1>` equal the final value right after mount, then `await vi.advanceTimersByTimeAsync(…)` in steps (0, 150, 500, 1000, 2000 ms) asserting the same text and no added `aria-live`/`aria-label` each time, and `vi.getTimerCount() === 0` after mount (no JS timer drives the motion).
- [ ] `src/app/(app)/results/[attemptId]/page.test.tsx` -- add: the server-rendered HTML of a ≥ 80 Result has no `data-animate`, no `data-scene`, no `fire-effect` (static frame before hydration).
- [ ] `src/app/globals.test.ts` -- new node test (no CSS test exists yet) reading `globals.css`: `results-lift` is used only inside `@supports (animation-timeline: view())`; no Results keyframe animates `box-shadow` or `filter`; no `infinite` in the Results block; the turn ends at 360deg.

**Acceptance Criteria:**
- Given reduced motion (OS or Settings), when a ≥ 80 or Test-passed Result renders live, then the score shows at its final value with no animation trigger and no fire element.
- Given a score below 80, when Results renders in any mode, then there is no glow, no turn, no count-up, no fire and no scene.
- Given a passed Test fixture in live mode with full motion, then exactly one decorative Fire Effect is rendered and the heading is unchanged; a passed practice never renders it.
- Given `mode="static"`, then no motion attribute or fire exists for any score.
- Given any state, then the accessible score (`<h1>`) and the badge's DOM text are the final value from the first render onward.
- Given `npm test`, then all 3.6 tests still pass unchanged, nothing is skipped, `package.json` has no new dependency, and no migration file is added.

## Implementation Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).

## Plan Change Log

- 2026-11-17 — re-checked against merged 3.6: Score Badge three layers (wrapper/disc/face) named with their real `data-slot`s; turn on the disc, trigger and `--score-n` on the wrapper, new back face `score-badge-back` with no text, counter as `::after` so 3.6 `textContent` assertions hold; `ScoreBadge` noted as becoming a client component, `ResultsView` stays server; scene sections named `wrong-answers` / `all-correct` / `tips` (frozen Adegan scroll line now names them, meaning unchanged; "Semua benar!" section lifts too, as the frozen text already said); motion gate kind via `knownItem` and tied to `data-glow`; fixtures named (`PRACTICE_85`, `TEST_88` + Test item prop, `V1_NO_TIPS_80`, `FLOORED_0`, …) incl. frozen matrix rows (meaning unchanged); fire element `data-fire` → `data-slot="fire-effect"`, placed outside the badge; `globals.css` keyframe list and `--glow-soft` corrected; `globals.test.ts` marked new; deferred ≥80 panel mockup styling explicitly not taken by 3.7 (static, not needed by the motion).

## Review Triage Log

## Design Notes

- Written while 3.6 was being implemented; re-checked against the merged 3.6 code on 2026-11-17 (see Plan Change Log).
- 3.6 tests stay unchanged because every 3.7 change is additive and keyed on attributes 3.6 never asserts: the wrapper keeps its four attributes and glow class, the face keeps its place and text, the back face and counter add no DOM text, the fire sits outside the badge, and `turn` / `scene` default to off. In jsdom the hook reports `"full"` after mount, so 3.6 renders of ≥ 80 live Results will now carry `data-animate` / `data-scene`; no 3.6 assertion reads them.
- No JS animation library and no JS timer: the UX docs do not require one. EXPERIENCE asks for a time-based count-up and turn and a scroll scene "CSS `animation-timeline: view()`"; the mockup does all three in CSS; AD-12 forbids framer-motion/GSAP/Lottie. React only decides whether the trigger attributes exist.
- Count-up: one generic keyframe animates a registered integer `--score-n` from 0 to the element's own inline value, shown through `counter()` on an overlay. The real text node never changes, so jsdom tests, copy/find and any assistive tech that ignores `aria-hidden` read the final score. Without `@property` an unregistered property would flip from 0 at half time; guard it so such browsers skip the count (for example a registered flag with initial value 1 used as `calc(var(--flag, 0) * 1s)` for duration and delay).
- [ASSUMPTION] On a direct page load the server HTML is the static frame, so the badge shows the final score for a moment and then counts from 0 once hydrated. The main path (auto-navigation from the exam screen) mounts on the client and starts immediately.
- [ASSUMPTION] The count-up also runs on phones (EXPERIENCE limits only the Streak Hero count-up there).
- [ASSUMPTION] The Results scene animates the real sections, as the mockup does; nothing is duplicated, so no `inert` copies and no sticky stage. A section already in the first viewport appears at its scroll progress (partly lifted) until scrolled; the build may shorten `animation-range` if that reads badly.
- [ASSUMPTION] Save-Data and `deviceMemory ≤ 4` stop only the scroll scene (AD-12: "for scenes"), not the turn, count-up or fire.
- [ASSUMPTION] The Test-passed panel tint (`streak-glow`) is added in live mode only and stays under reduced motion; "Level N unlocked!" stays with epic 4, so the fire accompanies the 3.6 heading "Test passed — N/100".
- The fire cannot be seen in Production before epic 5 ships a real Test item; U9 accepts fixture proof. Its look is checked locally against the mockup (see Verification).

## Verification

**Commands:**
- `npm run lint` -- expected: clean.
- `npx tsc --noEmit` -- expected: no errors.
- `npm test` -- expected: green, DOM files under jsdom, no skipped tests.
- `npm run build` -- expected: succeeds.

**Manual checks (local, `npm run dev`):**
- A ≥ 80 Result: one turn with the count-up, no layout movement around the badge, lists lift while scrolling; with DevTools "prefers-reduced-motion: reduce" everything is at rest with the final score.
- Fire Effect: temporarily render the Test 88 fixture in a scratch page that is not committed, compare with `key-results.html` (once, behind the badge, no flicker faster than 3 per second, within a quarter of a phone viewport).

**Production check (orchestrator/user, after merge; no migration, not hitl):**
- Open `/results/5fa43d9b…` (85/100): the badge turns once while the score counts up to 85, glow stays, wrong-answer/Tips sections lift in while scrolling, no fire; tab title and `<h1>` unchanged from 3.6.
- Open `/results/b55b185f…` (20/100): calm — final score at once, no turn, no glow, no fire, no lift.
- Settings › Reduce motion on, reload the 85/100 Result: final score, face-up badge, nothing moves; switch off again.
- Phone width: no horizontal scroll, nothing shifts while the badge turns.
- A new L01-P1 attempt finished on the laptop with ≥ 80: Results appears by itself and the turn plays once; focus is on the `<h1>`; runtime logs show no `results.load_failed`.
