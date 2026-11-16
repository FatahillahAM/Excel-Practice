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
- Score Badge: tepat satu putaran (rotateY 360°, ≥ 1,2 s, easing cinematic) bersamaan dengan hitung naik ~1 s dari 0 ke skor, berbasis waktu, tidak pernah digerakkan scroll; sisi belakang `streak` + ikon api; glow berada di pembungkus yang tidak ikut berputar dan tidak dianimasikan.
- Fire Effect: sekali, di belakang badge di dalam Outcome panel, `aria-hidden`, `pointer-events: none`, tidak menerima fokus; nyala `warning` → `streak-vivid` dengan haze `streak-glow-strong`; ≤ 3 perubahan terang per detik; luas ≤ 25% viewport di lebar ponsel juga; hanya transform/opacity yang dianimasikan (di bawah `lg` atau pointer kasar tanpa blur). Judul dan isi tampil sama dengan atau tanpa api.
- Adegan scroll: bagian "Wrong answers"/"Semua benar!" dan Tips Carousel yang asli (bukan salinan) naik dengan kemiringan 3D ringan (≤ 25°, hanya rotateX + translateY + opacity) seiring scroll, di dalam `@supports (animation-timeline: view())`; skor, badge, dan Outcome panel tidak pernah ikut adegan.
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
| Test lulus | `live`, fixture `kind: "test"`, skor 88 | seperti di atas + Fire Effect sekali di belakang badge; `<h1>` "Test passed — 88/100" tidak berubah | — |
| Skor <80 | `live`, latihan 64 atau Test 72 | varian tenang 3.6 apa adanya: tanpa putaran, hitung naik, glow, api, adegan | — |
| Tepat 80 / 79 | skor 80 / 79 | 80 bergerak; 79 tenang | — |
| Reduced motion | OS atau switch Settings, skor 85 / Test 88 | skor akhir, badge depan, glow statis, tanpa api, daftar di tempat | — |
| Preferensi berubah | switch dinyalakan saat halaman terbuka | atribut gerak dilepas, api hilang, skor akhir | — |
| Mode static | `mode="static"`, Test 88 | tanpa gerak dan tanpa api (badge datar 3.6) | — |
| Render server / sebelum hidrasi | HTML awal | bingkai statis: tanpa atribut gerak, tanpa elemen api | — |
| Save-Data / memori ≤4 | `saveData` true atau `deviceMemory` 4, skor 85 | putaran + hitung naik jalan; adegan scroll tidak dipasang | — |
| Tanpa scroll-timeline | browser tanpa `animation-timeline` | daftar di tempat (aturan di dalam `@supports`); sisanya jalan | — |
| Tanpa `@property` | browser lama | skor akhir langsung tampil, tidak pernah angka setengah jalan atau 0 yang menetap | — |
| Result tanpa Tip | v1, skor ≥80 | hanya bagian soal salah yang ikut adegan; tidak ada error | — |
| "See tip" saat adegan | klik "See tip" | carousel tergulir ke tampilan dan kartu terbaca penuh (perilaku 3.6) | — |

</frozen-after-approval>

## Code Map

Names below come from the 3.6 plan (see Design Notes — re-check against the 3.6 code before the build).

- `src/components/results/score-badge.tsx` -- 3.6 static 168px disc, `aria-hidden`, `data-variant` (`pass` | `calm`), `data-mode` (`live` | `static`), static `glow-strong` shadow on `pass`. 3.7 adds the 3D structure (front/back faces), the count-up hook and the trigger attribute.
- `src/components/results/results-view.tsx` -- `ResultsView {itemId, item: {kind, number} | null, level, result, durationSeconds, mode}`; Outcome panel (200px badge column). Hosts the Fire Effect and derives the motion gates.
- `src/components/results/results-details.tsx` -- client component: Wrong Answer Rows / "Semua benar!" section and Tips Carousel section; these two sections get the scene attribute. Carousel logic unchanged.
- `src/components/results/outcome.ts` (+`outcome.test.ts`) -- pure `resultsOutcome` → `{variant, heading}`; add the pure motion gate here.
- `src/components/results/results-view.dom.test.tsx`, `src/core/grading/__fixtures__/results.ts` -- 3.6 DOM tests and `Result` fixtures (practice 85/64/80/79, Test 88/72, v1 without Tips); reuse the fixtures, keep the 3.6 tests green unchanged.
- `src/hooks/use-motion-preference.ts` -- `useMotionPreference(options?: {scene?: boolean})` → `"full" | "reduce"`; `"reduce"` on server and during hydration; follows `matchMedia`, `<html data-motion>` (MutationObserver), and with `scene` also `saveData` / `deviceMemory ≤ 4`. Unchanged.
- `src/components/exam/orbit-loader.tsx` -- the existing pattern: CSS keyframes in `globals.css`, component only gates on the hook.
- `src/app/globals.css` -- `--ease-cinematic` (line 54), tokens `--streak`, `--streak-vivid`, `--warning`, `--glow-strong`, `--streak-glow`, `--streak-glow-strong`; keyframes live here (login, drawer, orbit); the global reduced-motion rule (lines 294–309: `animation: none !important` for the OS query and `:root[data-motion="reduce"]`) already stops every keyframe. No `@property` or `@supports` exists yet.
- `src/test/dom.ts` -- jsdom harness: `matchMedia` stub never matches, so the hook reports `"full"` after mount; fake-timer recipe in its header. jsdom does not run CSS animations.
- `src/app/(app)/results/[attemptId]/page.test.tsx` -- server render (`renderToStaticMarkup`): the place to assert the static frame in the first HTML.
- Mockup `key-results.html` lines 134–146 (coin, `turn 1.4s var(--cine) .15s both`), 188–201 (`lift`, count-up via `@property --n` + `counter()`), 206–213 (`.fire`, 5 flames + haze, 2.8s), 226 (reduced: fire hidden).
- deferred-work.md -- no open entry belongs to 3.7 (the Orbit pause/play toggle test stays with epic 4).

## Tasks & Acceptance

**Execution:**
- [ ] `src/components/results/outcome.ts` (+`outcome.test.ts`) -- add pure `resultsMotion({variant, kind, mode})` → `{turn: boolean, fire: boolean, scene: boolean}` (before the motion preference): `turn` and `scene` = `live` && `pass`; `fire` = those && `kind === "test"`; all false for `static`, `calm`, and `kind` null only blocks `fire`. Tests: practice/Test/unknown × 79/80 × live/static.
- [ ] `src/app/globals.css` -- Results motion block: `@property --score-n` (`<integer>`); `@keyframes score-turn` (rotateY 0→360°), `score-count` (`from { --score-n: 0 }` to the inline final value), `fire-flame`, `fire-haze` (mockup values), `results-lift` (perspective + rotateX ≤ 16° + translateY + opacity → none); selectors keyed on the trigger attributes only (`[data-animate="turn"]`, `[data-scene="lift"]`, the fire element), `results-lift` inside `@supports (animation-timeline: view())` with `animation-range: entry 0% entry 90%`; turn 1.4s and count 1s, both `var(--ease-cinematic) .15s both`; flames without blur below `lg` / coarse pointer; fire box sized so it stays ≤ 25% of the viewport on a phone. Nothing here applies without a trigger attribute.
- [ ] `src/components/results/score-badge.tsx` -- client component: `turn` prop; `useMotionPreference()`; when `turn` and `"full"` set `data-animate="turn"` and `style={{"--score-n": score}}`; wrapper with `perspective` carrying the static glow, inner disc `preserve-3d` with front face (3.6 look) and back face (`streak` + flame icon, `backface-visibility: hidden`); the score text node stays the final value, and under `data-animate` it is visually replaced by a same-box CSS counter overlay; `data-variant` / `data-mode` / `aria-hidden` unchanged.
- [ ] `src/components/results/fire-effect.tsx` -- new client component: returns `null` unless `useMotionPreference() === "full"`; otherwise an `aria-hidden` absolutely positioned block (`data-fire`) with haze + 5 flames (sizes and delays from the mockup), no focusable content.
- [ ] `src/components/results/results-view.tsx` -- compute `resultsMotion` from the 3.6 outcome, `item?.kind` and `mode`; pass `turn` to `ScoreBadge`, `scene` to `ResultsDetails`; when `fire`, render `FireEffect` behind the badge column (Outcome panel `relative overflow-hidden`, content above it) and the faint static `streak-glow` panel tint of the mockup.
- [ ] `src/components/results/results-details.tsx` -- `scene` prop; `useMotionPreference({scene: true})`; when both allow, `data-scene="lift"` on the wrong-answers section and on the Tips section; nothing else changes.
- [ ] `src/components/results/results-motion.dom.test.tsx` -- `// @vitest-environment jsdom` + `@/test/dom`, fixtures from `results.ts`: practice 85 live → `data-animate="turn"`, `--score-n` 85, both sections `data-scene="lift"`, no `[data-fire]`; Test 88 live → the same plus one `[data-fire]` that is `aria-hidden` with no focusable descendant, `<h1>` "Test passed — 88/100"; 64 and Test 72 → no `data-animate`, no `data-scene`, no `[data-fire]`, `data-variant="calm"`; 80 vs 79; `mode="static"` Test 88 → none of the three; reduced motion via `document.documentElement.dataset.motion = "reduce"` and, separately, a matching `matchMedia` mock → none of the three for 85 and Test 88, badge text is the final score; switch flipped after mount (inside `act`) → attributes and fire removed; `navigator.deviceMemory = 4` and `connection.saveData = true` → turn kept, `data-scene` absent; v1 Result without Tips at ≥ 80 → no error. Count-up with fake timers: `vi.useFakeTimers()` before render, assert the badge's score text node and the `<h1>` equal the final value right after mount, then `await vi.advanceTimersByTimeAsync(…)` in steps (0, 150, 500, 1000, 2000 ms) asserting the same text and no added `aria-live`/`aria-label` each time, and `vi.getTimerCount() === 0` after mount (no JS timer drives the motion).
- [ ] `src/app/(app)/results/[attemptId]/page.test.tsx` -- add: the server-rendered HTML of a ≥ 80 Result has no `data-animate`, no `data-scene`, no `data-fire` (static frame before hydration).
- [ ] `src/app/globals.test.ts` -- node test reading `globals.css`: `results-lift` is used only inside `@supports (animation-timeline: view())`; no Results keyframe animates `box-shadow` or `filter`; no `infinite` in the Results block; the turn ends at 360deg.

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

## Review Triage Log

## Design Notes

- Written while 3.6 was being implemented; before the build starts the orchestrator re-checks component names against the 3.6 code.
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
