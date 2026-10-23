# Spec Update Candidates — WORKING HARD with EXCEL

Behavior the product spec must absorb (flow back via `bmad-spec` update). Source: the UX spines [EXPERIENCE.md](EXPERIENCE.md) and [DESIGN.md](DESIGN.md).

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
21. **CAP-7** — hint targeting: El Zavier picks the question (Hint Select "Soal N"); each hint costs 5 points and uses one hint from the attempt's quota.
22. **CAP-7 / CAP-8** — Office 2021-only constraint extended to Tips and hint text.
23. **CAP-17** — login via Sign in with Google with a single allowlisted account (replaces username+password).
24. **CAP-5** — per-question score weighting, so "x of y correct" and the score agree (see EXPERIENCE.md › Open Questions).
