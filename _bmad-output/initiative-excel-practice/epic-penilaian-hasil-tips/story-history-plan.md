---

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
title: 'History'

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
type: 'feature'

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
ticket: '8'

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
created: '2026-11-18'

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
status: 'in-progress'

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
route: 'full'

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
route_source: 'auto'

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
review: ''

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
review_source: ''

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
lenses_ran: []

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
review_loop_iteration: 0

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
baseline_revision: 'd477bfc3190e23e3375d430ed830b2257235362b'

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
context: ['{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/EXPERIENCE.md', '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-excel-practice-2026-10-22/DESIGN.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-penilaian-hasil-tips/story-layar-results-isi-dan-varian-plan.md', '{project-root}/_bmad-output/initiative-excel-practice/epic-penilaian-hasil-tips/story-gerak-results-plan.md']

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
---

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
## Intent

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
**Problem:** `/history` masih placeholder, jadi hasil percobaan lama (skor, alasan soal salah, Tips) tidak bisa dibuka lagi untuk belajar (CAP-21). `ResultsView mode="static"` dari 3.6 sudah ada tetapi belum dipakai di mana pun.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
**Approach:** Adapter sesi baru `listGradedResults` membaca percobaan milik user yang punya `Result` (terbaru dulu, dibatasi 50), halaman `/history` menampilkan baris (item, tanggal, skor, waktu) dengan keadaan kosong, Skeleton, dan galat muat pertama, dan setiap baris membuka rute baru `/history/<attemptId>` yang merender `ResultsView mode="static"` dari `Result` tersimpan yang sama dengan Results pertama. Tanpa migrasi DB dan tanpa dependensi baru.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
## Boundaries & Constraints

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
**Always:**

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Hanya percobaan berstatus `graded` atau `closed` yang punya `result` non-null DAN lolos `resultSchema` yang tampil (U6). Baris uji 2.12 (`graded` tanpa `result`) dan `Result` tidak valid tidak pernah tampil; yang tidak valid dicatat (`history.result_invalid`, tanpa isi) dan dilewati, tidak menggagalkan halaman.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Dibaca lewat sesi user (AD-9), RLS membatasi ke pemilik; kolom yang dibaca hanya yang sudah di-grant ke `authenticated`: `id, item_id, status, result, started_at, received_at`.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Urutan terbaru dulu: `started_at desc, id desc` (memakai indeks `attempts_user_started_idx` yang sudah ada). Batas 50 baris tanpa paginasi; bila tepat ada lebih, baris ke-51 tidak ditampilkan dan tidak ada teks tambahan.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Baris: nama item (mis. "Level 1 · Practice 1"; item tak dikenal → `itemId`), tanggal (`started_at`, format `id-ID`, zona `Asia/Jakarta`), skor `S/100`, waktu (`formatElapsed(received_at − started_at)`, `—` bila null). Seluruh baris adalah satu tautan ke `/history/<id>`.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Detail History: skor, "x of y correct", potongan, alasan soal salah, dan Tips identik dengan Results pertama karena keduanya merender `Result` tersimpan yang sama lewat loader yang sama. `mode="static"`: tanpa putaran, hitung naik, count-up marker, api, adegan scroll, dan tanpa memindahkan fokus ke `<h1>`.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Detail: tanpa sesi → login dengan `next` ke `/history/<id>`; bukan milik user / tanpa Result / id tidak valid → 404; Result tidak valid atau baca gagal → pesan muat pertama + "Try again". Ada tautan "Back to History".

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Kosong: satu baris pesan + tautan ke Dashboard. Memuat: Skeleton berbentuk daftar baris (dan Skeleton Results di detail). Gagal baca daftar: `shellMessages.firstLoadFailed` + "Try again".

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Teks chrome Inggris; pesan dari `src/messages/id.ts` tetap bahasa Indonesia.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
**Never:**

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- History List di Dashboard (epic 4), koleksi Tips & Tricks (3.9), "Practice again" / "New record" (epic 4), filter atau pencarian History, paginasi.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Migrasi DB, indeks baru, grant baru, service role, atau mengubah isi/teks `ResultsView`, grader, dan `Result`.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Menghitung ulang skor atau Tips dari konten saat ini (selalu dari `Result` tersimpan).

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Tes yang di-skip atau ditunda.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
## I/O & Edge-Case Matrix

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Scenario | Input / State | Expected Output / Behavior | Error Handling |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
|----------|--------------|---------------------------|----------------|

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Daftar normal | 3 percobaan `graded` dengan Result valid | 3 baris terbaru dulu: item, tanggal, skor, waktu; tiap baris tautan `/history/<id>` | — |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Baris legacy | `graded` tanpa `result` (uji 2.12) | tidak tampil | — |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Result tidak valid | `result` gagal `resultSchema` | baris dilewati, sisanya tampil | log `history.result_invalid` |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Status lain | `open`/`received`/`grading_failed`/`abandoned` | tidak tampil | — |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| `closed` dengan Result | status `closed`, Result valid | tampil | — |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Milik user lain | baris user B | tidak tampil (RLS) | — |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Kosong | tidak ada yang memenuhi | pesan satu baris + tautan Dashboard | — |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| >50 | 60 percobaan | 50 terbaru | — |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| `received_at` null | baris lama | waktu `—` | — |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Item tak dikenal | `item_id` dihapus dari registry | nama = `itemId`, baris tetap bisa dibuka | — |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Baca daftar gagal | error PostgREST | pesan muat pertama + "Try again" | log `attempt.list_results_failed` |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Buka detail | klik baris skor 85 | `ResultsView mode="static"`: 85/100, alasan & Tips sama dengan Results pertama; tanpa atribut gerak/marker; fokus tidak dipindah | — |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Detail tanpa sesi / bukan milik / tanpa Result | `/history/<id>` | login dengan `next` / 404 / 404 | — |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
| Detail Result tidak valid | schema gagal | pesan muat pertama + "Try again" | log `results.load_failed` |

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
</frozen-after-approval>

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
## Code Map

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `src/app/(app)/history/page.tsx` -- placeholder (`PlaceholderPage`) to replace; keeps `surfaceTitle("History")`.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `src/app/(app)/results/[attemptId]/page.tsx` -- live Results: `loadResult` (`cache()`d: session → `readResult` → `resultSchema.safeParse` → `{login|missing|failed|loaded}`), `outcomeOf`, failed card, `ResultsSkeleton`, `generateMetadata`. Extract `loadResult`, `outcomeOf`, the failed card and `ResultsSkeleton` into a shared module so live and History detail render the identical Result path; keep behaviour/log names unchanged and existing tests green.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `src/components/results/results-view.tsx` -- `ResultsView({itemId, item, level, result, durationSeconds, mode})`; `mode="static"` already skips `ResultsFocus` (line 99) and 3.7 motion gates. Do not change content.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `src/components/results/count-up-marker.ts`, `use-play-once.ts`, `fire-effect.tsx` -- live-only; static must not set the marker (assert in tests).

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `src/adapters/supabase/attempts.ts` -- `readResult` (line ~528, pattern to copy: `Read<T>`, `logError`, `errorName`, `isAttemptId`), `TABLE`. Add `listGradedResults`.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `src/core/grading` (`resultSchema`, `Result`), `src/core/services/attempts` (`attemptDurationSeconds`), `src/core/services/attempts/elapsed` (`formatElapsed`), `src/content/levels` (`findItem`).

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `src/components/shell/nav-items.ts` -- `/history` already in menu; `activeNavItem` already marks `/history/<id>` active. `page-title.tsx` -- `PageTitle`.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `src/components/ui/` -- no Skeleton component exists; skeletons are inline `bg-muted` blocks (`ResultsSkeleton`). Follow that pattern (no new ui primitive).

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `src/messages/id.ts` -- `shellMessages.firstLoadFailed`; add `historyEmpty` (Indonesian, one line).

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `supabase/migrations/20261102000001_attempts.sql:30` -- `attempts_user_started_idx (user_id, started_at desc)` already serves the list; no new index.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `src/test/dom.ts`, `src/core/grading/__fixtures__/results.ts` (`PRACTICE_85`, `PRACTICE_64`, `TEST_88`, `V1_NO_TIPS`), `src/components/results/results-view.dom.test.tsx` / `results-motion.dom.test.tsx` -- harness and fixtures to reuse; `src/app/(app)/dashboard/page.test.tsx` -- pattern for mocking session adapters in page tests.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- deferred-work: no open item is assigned to 3.8. Related, unchanged: line 165 (removed Test item loses its heading — applies equally to History detail).

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
## Tasks & Acceptance

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
**Execution:**

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- [ ] `src/adapters/supabase/attempts.ts` -- add `HISTORY_LIMIT = 50` and `listGradedResults(supabase): Promise<Read<StoredHistoryRow[]>>` (`{id, itemId, status, result: unknown, startedAt, receivedAt}`): `.select("id, item_id, status, result, started_at, received_at").in("status", ["graded","closed"]).not("result","is",null).order("started_at",{ascending:false}).order("id",{ascending:false}).limit(HISTORY_LIMIT)`; log `attempt.list_results_failed` -- session read, owner via RLS.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- [ ] `src/adapters/supabase/attempts.test.ts` -- query shape (filters, order, limit), error → `{ok:false}`, null-result guard.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- [ ] `src/app/(app)/history/history-rows.ts` (+`.test.ts`) -- pure `toHistoryRows(rows)`: parse with `resultSchema`, drop + log invalid, map item label via `findItem`, date (`Intl.DateTimeFormat("id-ID",{timeZone:"Asia/Jakarta", dateStyle:"medium", timeStyle:"short"})`), score, duration -- testable without DOM.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- [ ] `src/app/(app)/results/load-result.ts` -- move `loadResult`, `outcomeOf`, `ResultsLoadFailed` card, `ResultsSkeleton` here (shared); `results/[attemptId]/page.tsx` imports them, behaviour unchanged.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- [ ] `src/app/(app)/history/page.tsx` -- server page: `Suspense` with `HistorySkeleton` (inline `bg-muted` row blocks, `aria-hidden`), session check → login redirect `/history`, list / empty (`historyEmpty` + link `/dashboard`) / failed (`firstLoadFailed` + "Try again"); rows as `<ul>` of `<a href="/history/<id>">` with row hover (`hover:bg-muted`).

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- [ ] `src/app/(app)/history/[attemptId]/page.tsx` -- shared loader; `ResultsView mode="static"`; "Back to History" link; same login/404/failed handling with path `/history/<id>`; `generateMetadata` title = outcome heading; Suspense fallback `ResultsSkeleton`.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- [ ] `src/messages/id.ts` -- `historyEmpty: "Belum ada hasil. Mulai latihan dari Dashboard, ya."`.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- [ ] `src/app/(app)/history/history.dom.test.tsx` -- list render (order, label, date, score, `—` time, hrefs), empty state + Dashboard link, failed state, Skeleton fallback (render `HistorySkeleton`, `aria-hidden`), legacy/invalid rows absent.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- [ ] `src/app/(app)/history/[attemptId]/page.dom.test.tsx` -- detail with `PRACTICE_85` and `TEST_88`: same score/reasons/Tips text as the live page render of the same Result, `data-mode="static"`, no count-up marker / fire / motion attributes, `document.activeElement` not moved to `<h1>`; 404 and login branches.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
**Acceptance Criteria:**

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Given an attempt first seen on `/results/<id>`, when opened from History, then the score, wrong-answer reasons and Tips text are identical and nothing animates.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Given the live Results tests from 3.6/3.7, when the loader is extracted, then they pass unchanged.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
## Design Notes

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Route over query param: `/history/<id>` keeps the sidebar "History" active (existing `activeNavItem`), gives a natural "Back to History", and keeps `/results/<id>` strictly live (3.7 count-up marker logic untouched).

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Limit 50 without pagination: single user, a handful of attempts per day; 50 rows with jsonb `result` is well under 1 MB, and the existing `(user_id, started_at desc)` index serves filter+order. Pagination joins epic 4 if ever needed.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Validating in the page layer (`toHistoryRows`) rather than in SQL keeps U6 ("schema-valid Result") exact.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
## Verification

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
**Commands:**

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `npm run lint` -- expected: no errors

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `npx tsc --noEmit` -- expected: no errors

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `npm test` -- expected: all pass, none skipped

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `npm run build` -- expected: success; `/history` and `/history/[attemptId]` dynamic

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).


- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
**Manual checks (Production, after merge):**

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- `/history` lists the graded Production attempts (e.g. `91e3d0bc` 60, `e9fafb75` 100) newest first; the 2.12 SQL-graded rows do not appear.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
- Opening `e9fafb75` shows 100/100, same reasons and Tips as its first view, no turn/count-up/fire; reload identical. Skeleton visible on slow network; phone width without horizontal scroll.

- Implementation makes no remote changes (no push, no Supabase or Vercel writes).
