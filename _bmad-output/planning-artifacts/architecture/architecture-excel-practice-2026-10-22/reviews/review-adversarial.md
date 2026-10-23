# Review — adversarial (two compliant units that still clash)

Verdict: 4 holes found, all closable by tightening existing ADs.

| # | Unit A (obeys all ADs) | Unit B (obeys all ADs) | Clash | Fix |
|---|---|---|---|---|
| A1 | Grader stores `Result` with `reasonId` | History renders reasons by looking up content (AD-3 forbids re-reading content, so it shows nothing) | History/Tips collection empty or wrong after content changes | Tighten AD-3: `Result` stores resolved `reasonText` and the full Tip per question |
| A2 | Template v2 deployed with changed VBA; hash registry holds only the current hash | Attempt started on v1 still open | v1 file rejected as `IDENTITY_ALTERED` | Tighten AD-6/AD-4: attempt records `template_version`; hash compared to that version; templates kept per version |
| A3 | Duplicate submission accepted idempotently → `after()` grading runs | User clicks Try again at the same time → second grading run | Two graders both write results / transitions | Tighten AD-5: grading commits with compare-and-set on `status = 'received'` |
| A4 | Hint service counts quota per level across attempts | Grader counts hints per attempt | Different deduction and "x left" | Tighten AD-5: quota is per attempt = `LevelModule.hintQuota`; `hint_reveals` unique per (attempt, question, hint index) |
