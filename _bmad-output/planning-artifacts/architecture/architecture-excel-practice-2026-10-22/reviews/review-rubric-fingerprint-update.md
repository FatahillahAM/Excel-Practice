# Review: rubric walker, template fingerprint update (AD-4, AD-6)

- **Spine:** `ARCHITECTURE-SPINE.md` (updated 2026-10-23), memlog entries 57–60
- **Scope:** the amended Rules of AD-4 and AD-6, and every part of the spine they touch
- **Inputs read:** spine, `.memlog.md`, `SPEC.md`, `exam-bridge.md`, `level-curriculum.md`, `pivot-grading.md`, EXPERIENCE.md (message set, Upload Dropzone, Exam Workbook), `src/adapters/workbook/{templates,template-patch,read}.ts` with their tests, `scripts/spike-s{1,2}.ts`, `assets/templates/{README.md,vba/modFinish.bas}`, epic 1 notes and tickets, the S1/S2 plans, `deferred-work.md`
- **Date:** 2026-10-23

## Verdict

**Not ready to build from yet. The core change is right; one critical gap and several medium gaps need fixing first.** Moving from the bytes of `vbaProject.bin` to a hash of the normalized module source is the right call, and I reproduced the S2 evidence myself. The Rule as written, though, puts every module in the hash, including the empty document module that Excel keeps for each sheet. Adding a sheet therefore changes the fingerprint, so genuine Excel-saved work gets `IDENTITY_ALTERED`. That breaks the update's own goal and makes CAP-13/CAP-14 impossible to deliver without changing the engine. Fix it now, before S3 and epic 2 write the code.

## Independent verification

I extracted `xl/vbaProject.bin` from `assets/templates/exam.v1.xlsm` and from the Excel-saved `src/adapters/workbook/__fixtures__/s2-excel2021.xlsm`. I read both with olefile/olevba (scratchpad venv; no project files touched).

| Check | Template v1 | S2 fixture (Excel 2021 save) |
| --- | --- | --- |
| SHA-256 of `vbaProject.bin` bytes | `d8aa9aa6…a9df` (= registry) | `9618df59…8ec4` (differs) |
| `PROJECT` `ID=` / `CMG` / `DPB` / `GC` | `{C7D06F82…}` / … | `{0969DDF8…}` / all different |
| Modules (`PROJECT`, `dir`) | `Document=ThisWorkbook`, `Document=Sheet1`, `Document=Sheet2`, `Module=modFinish` | same four |
| `VBA/Sheet1` stream size | 999 | 1188 (p-code cache grew) |
| Decompressed source per module | identical | identical |
| Spine algorithm (drop `Attribute`, LF, sort by name, name header, SHA-256) | `d8a3d06c…82dc` | `d8a3d06c…82dc` (**match**) |

The S2 claim and the new algorithm both hold for the case S2 tested: one save, one machine, no sheets added or removed. The same dump shows the cause of F1. The project carries a **document module per sheet plus `ThisWorkbook`**. Their source is nothing but `Attribute` lines, so after normalization each one adds only its name header to the hash.

## Checklist walk

| Checklist item | Result | Notes |
| --- | --- | --- |
| Fixes the real divergence points for the level below, misses none | **Partial** | The save-rewrite divergence is closed. Still open: which module changes count as "altered" (F1), what the fingerprint is compared against when the token is unknown (F2), and how a VBA project that cannot be parsed is mapped to a code (F3). |
| Every AD Rule is enforceable and prevents its stated divergence | **Partial** | AD-4 still lets the fingerprint change when Excel saves a workbook that has a new sheet (F1). Nothing makes a test exercise the Rule against an Excel-saved file (F4). |
| Nothing under Deferred lets two units diverge | **Fail (minor)** | "Formula-reader library … SheetJS vs own XML parsing — decided by S2" is still listed, but S2 has already decided it (F7). |
| Named tech verified-current | **Pass** | MS-OVBA is a live Microsoft Open Spec (rev. 14.0, Aug 2024; its compression algorithm has not changed since the first release). jszip 3.10.2 and fast-xml-parser 5.11.2 match `package.json`. SHA-256 comes from `node:crypto` on Node 24. MS-CFB is used but not named (F9). |
| Ratifies rather than contradicts the brownfield codebase | **Contradicts, without a transition note** | Code still byte-hashes (`templates.ts` `vbaProjectSha256`, `read.ts` `WorkbookReading.vbaProjectSha256`, `template-patch.ts` `vbaProjectSha256()`, both spike scripts), and no ticket owns the migration (F5). "Never compared" also forbids a useful brownfield invariant (F6). |
| Covers the driving spec's capabilities | **Partial** | CAP-18 is covered. CAP-14 ("multi-sheet report + Summary + Pivot") and CAP-13 (Level 7 Pivot, Level 9 Summary) add sheets, which collides with F1. `exam-bridge.md` still describes a `vbaProject.bin` fingerprint (F10). |
| Every dimension the altitude owns is decided, deferred, or open | **Partial** | Not decided, deferred or open: the module-set policy (F1), error mapping for a VBA project that cannot be read and for oversized bodies (F3), freezing a template version's VBA (F11). |

## Findings

| # | Sev | Concerns | Finding |
| --- | --- | --- | --- |
| F1 | **critical** | AD-4 Rule; AD-6; CAP-13, CAP-14 | Hashing "every VBA module" includes the empty per-sheet document modules, so adding a sheet changes the fingerprint and genuine work is rejected |
| F2 | medium | AD-6 decision order | The fingerprint is compared with "the attempt's recorded `template_version`" before the token has been looked up; for an unknown token there is no attempt to compare with |
| F3 | medium | AD-6 decision order; AD-4 reader | No code for a workbook whose VBA project cannot be parsed or decompressed, or whose body is too large; the spec, the S2 epic decision and the platform each point somewhere different |
| F4 | medium | AD-4; Consistency › Testing | No convention requires an Excel-saved fixture to match the registry; synthetic fixtures pass under the old byte hash and the new hash alike |
| F5 | medium | AD-4, AD-6 vs brownfield | The spine supersedes code that still byte-hashes, with no transition note and no ticket that owns the migration |
| F6 | low | AD-4 Rule | "The bytes of `xl/vbaProject.bin` are never compared" forbids the patcher's byte-preservation check, the most direct guard for "lost VBA" |
| F7 | medium | Deferred; Required Spikes; AD-4 port | S2 outcomes are not ratified: the reader library is still Deferred with SheetJS open, and the port-shape caveats are not recorded |
| F8 | low | AD-4 Rule | Fingerprint framing is underspecified (name source, collation, separator, text encoding, empty project); safe only while exactly one function computes it |
| F9 | low | AD-4; Stack | Reading modules needs an MS-CFB reader (with mini-stream support); the spine does not name it or record "no new dependency" |
| F10 | low | Spec drift (`exam-bridge.md`) | The spec still says "sidik jari `vbaProject.bin` template" |
| F11 | low | AD-4, AD-6 | A template version's VBA is not stated to be frozen; S3 plans to change v1's VBA in place |

### F1 (critical): document modules make the fingerprint depend on the sheet list

**Evidence.** `exam.v1.xlsm` declares `Document=ThisWorkbook`, `Document=Sheet1` and `Document=Sheet2` next to `Module=modFinish` in its `PROJECT` stream. The source of each document module is eight `Attribute` lines and nothing else. Under the Rule, each of those modules adds its name header to the hash. Excel gives every worksheet and chart sheet in a macro-enabled workbook its own document module. Adding a sheet adds `Sheet3`, and deleting one removes its module.

**Failure scenario.**
- Ujian Akhir (CAP-14) asks for a "multi-sheet report + Summary + Pivot from another file". Level 7 creates a PivotTable on a **New Worksheet** (Excel's default), Level 8 loads Power Query results to a new sheet, and Level 9 builds a Summary sheet. In V1 the user may add a scratch sheet or copy `Data` to experiment.
- When the workbook is saved, its VBA project contains `Sheet3`. The fingerprint differs from the registry value, the submission gets `IDENTITY_ALTERED` ("Identitas file ini rusak atau berubah…"), and the only recovery is to redo the work in a fresh download.
- Every legitimate Ujian Akhir submission would fail this way. The spine scope ("Next phases plug in without engine changes") and the spec constraint ("menambah level tidak boleh mengubah mesin Exam") could then only be met by amending AD-4 later and moving every template to a new version.
- If "Require Variable Declaration" is on in the VBE of either device, the new module may also get `Option Explicit`. I could not confirm that for sheet modules, which is a second reason to define "empty" generously.

**Fix.** Amend the AD-4 Rule so the fingerprint ignores modules that hold no code. For example: "modules whose source, after dropping `Attribute` lines, blank lines and `Option` statements, is empty are skipped". Alternatively, fingerprint only standard and class modules plus any document module that holds code.

Also decide explicitly whether a **new standard module** counts as altered. The macro recorder creates `Module1`. Today it would trigger `IDENTITY_ALTERED`, which is defensible but should be a decision, not an accident.

Prove the amendment with a second Excel-saved fixture: add a sheet, save, and assert the fingerprint still equals the registry value.

### F2 (medium): the decision order compares against an attempt it has not yet looked up

AD-6 puts the fingerprint check ("≠ the fingerprint of the attempt's recorded `template_version`") before "unknown token → `NOT_THIS_ATTEMPT`". When the token is well-formed but unknown, there is no attempt and therefore no recorded version. Two readings are both valid:

- (a) look up the token first, so unknown → `NOT_THIS_ATTEMPT`;
- (b) treat "cannot compare" as "≠", so unknown → `IDENTITY_ALTERED`, or compare against `WHE_TemplateVersion` or any registry entry.

**Failure scenario.** A file generated in Preview (`dev`) is uploaded to Production. Its token is unknown and its fingerprint matches v1. Reading (a) gives "not from this attempt"; reading (b) gives "identity altered". The VBA message boxes, the web message set and the CAP-18 per-reason messages then depend on who wrote `submit()`.

**Fix.** Split the step:
1. Token missing or malformed → `IDENTITY_ALTERED`.
2. Token unknown → `NOT_THIS_ATTEMPT`.
3. Fingerprint missing or ≠ the fingerprint of that attempt's `template_version` → `IDENTITY_ALTERED`.
4. Then the status checks.

While editing this step, also fix two smaller gaps in the same Rule:
- Name the code for an `X-Attempt-Token` header that differs from the file's token.
- Reconcile EXPERIENCE.md ("old file from Downloads → not from this attempt") with AD-6, which gives `ALREADY_GRADED` or `ATTEMPT_CLOSED` for a known token from an earlier attempt. Either define `NOT_THIS_ATTEMPT` as "token unknown, or its attempt is not the user's open attempt", or change the narrative.

### F3 (medium): no mapping for a VBA project that cannot be read, or for an oversized body

The update adds an MS-CFB + MS-OVBA parser to the submission request path, so a damaged `vbaProject.bin` is now a new way for a submission to fail. AD-4 covers only "a workbook without a VBA project has none". Three sources disagree on what a damaged project should produce:

- The spec gives a reason "identitas diubah **atau rusak**", which points to `IDENTITY_ALTERED`.
- The S2 decision in the epic 1 notes says "submit maps reader errors to `NOT_EXCEL` and limits upload size".
- Neither is in AD-6, and the enum has no code for an oversized file.

Separately, Vercel Functions reject request bodies above **4.5 MB** with `413 FUNCTION_PAYLOAD_TOO_LARGE`, before `submit()` runs. The macro and the web then see a platform error rather than an enum code. V1 files are around 25 KB, but Ujian Akhir and Pivot workbooks with pivot caches can approach that size.

**Fix.**
- In AD-6, state that a VBA project which is present but cannot be parsed → `IDENTITY_ALTERED`, and that any other reader failure → `NOT_EXCEL`.
- Cap the decompressed size per module and per project.
- Give the size limit a home: a code (which bumps `WHE_TemplateVersion`, per AD-6), or a stated mapping of oversized bodies to `NOT_EXCEL`. Note the 4.5 MB platform ceiling in Deferred, with a revisit condition for Next.

### F4 (medium): no test exercises the Rule against an Excel-saved file

The only thing that justifies the new algorithm is an empirical property of Excel. The Testing convention requires golden fixtures per `LevelModule` and a parity test, but those fixtures can be produced by the patcher. A patched file keeps `vbaProject.bin` byte-identical, so it passes under the old byte hash, the new source hash, or any other function. A regression back to byte hashing, or keeping `Attribute` lines, would therefore pass CI and reject every real submission.

**Fix.** Add to Consistency › Testing: "at least one Excel-saved fixture per template version (S2's `s2-excel2021.xlsm` for v1; plus the add-a-sheet fixture from F1) must produce the registry fingerprint". I computed the spine's algorithm on the S2 fixture: it matches the template (`d8a3d06c…82dc` under my framing), so this test is available today.

### F5 (medium): brownfield delta with no owner

The spine now says the fingerprint is decided. The code says the opposite:

- `templates.ts` stores a byte hash in `vbaProjectSha256`, and its comment says "the AD-6 fingerprint change is deferred".
- `read.ts` returns `WorkbookReading.vbaProjectSha256`.
- `template-patch.ts` exports `vbaProjectSha256()`, which its docstring calls "the template fingerprint, AD-4/AD-6".
- `spike-s1.ts` and `spike-s2.ts` compare the byte hash with the registry.

Memlog entry 60 says the migration happens "during S3/epic 2", but S3 (entry 4) and the end-to-end proof (entry 9) do not mention it, and no epic 2 story exists yet.

**Failure scenario.** The epic 2 `IDENTITY_ALTERED` story finds `reading.vbaProjectSha256` and `templates[v].vbaProjectSha256`, wires them together, and every genuine Finish or upload is rejected.

**Fix.**
- Add a one-line brownfield note to AD-4: the current byte hash is to be replaced by the source fingerprint; rename the field (for example `vbaSourceFingerprint`); recompute the v1 registry entry.
- Have ticketing give the migration to an owning entry before S3. Today the deferred-work entry asks only for the spine change, which is now done.

### F6 (low): "never compared" overreaches

The patcher's guarantee that `xl/vbaProject.bin` keeps its bytes is the most direct check of AD-4's "lost Finish button or VBA". `templates.test.ts` and `spike-s1.ts` (line 99, `fail("vbaProject.bin changed during patching")`) both enforce it. Read literally, the new sentence forbids that check.

**Fix.** Reword to: "The bytes of `xl/vbaProject.bin` never identify a submitted file; generation keeps them byte-identical to the template."

### F7 (medium): S2 outcomes are not ratified

S2 passed and chose jszip + fast-xml-parser 5.11.2 (epic 1 notes; `read.ts`). Even so:

- Deferred still says "Formula-reader library behind WorkbookIO (SheetJS from its CDN vs own XML parsing) — decided by spike S2". A later unit, such as the Level 6 spill grader or the pivot grader, could read that as licence to add SheetJS, which is exactly the divergence AD-4 is meant to prevent.
- Required Spikes still lists S1 and S2 as pending, with the Python fallback.
- The S2 caveats are recorded only in the epic notes. One of them changes the port that AD-4 calls fixed: `WorkbookReading` has no spill/array flag, which is needed before Level 6. Another affects grading: normalization strips all whitespace, including the intersection operator.

**Fix.**
- Move the reader choice into AD-4 ("reading uses jszip + fast-xml-parser; no spreadsheet library") and drop it from Deferred.
- Mark S1 and S2 as passed.
- Add the spill/array flag as a Deferred item or open question, with "before Level 6".

### F8 (low): framing underspecified

The Rule leaves several choices open:
- **Module name source:** dir-stream `MODULENAME` (MBCS), `MODULENAMEUNICODE`, or the stream name.
- **Sort order:** ordinal or locale collation (`Sheet10` vs `Sheet2`).
- **Separator:** the bytes between the name header and the source, and between modules.
- **Trailing newline:** how it is handled.
- **Text encoding:** whether the hash is taken over the raw MBCS bytes (`PROJECTCODEPAGE`) or over UTF-8.
- **Empty project:** what an `.xlsm` with a VBA project but no modules yields.

All of this is harmless while exactly one function computes both the registry value and the reading. It becomes a divergence as soon as a second implementation appears, for example the Python fallback that the spine still lists, or a registry value pasted in from a script.

**Fix.** State that one exported function in `src/adapters/workbook` computes the fingerprint, both for the registry (asserted by test against the template file) and for reading. Also keep the template's VBA source ASCII-only.

### F9 (low): MS-CFB is used but not named

Module streams sit inside a compound file, and they are small (`modFinish` is 3,807 bytes, sheet modules 999), so they live in the CFB **mini stream**. Memlog entry 60 decides "no new dependency", which means a hand-written CFB reader (FAT, mini FAT, directory) plus the MS-OVBA decompressor.

**Fix.** Record this in Stack or AD-4 ("CFB + MS-OVBA parsed in `src/adapters/workbook`; no CFB/OVBA library"), so that no story pulls in a library such as `cfb` alongside the hand-written reader.

### F10 (low): spec drift

`exam-bridge.md` › Verifikasi kepemilikan still says "sidik jari `vbaProject.bin` template untuk mendeteksi file yang diubah" under "Diputuskan (spine AD-4, AD-6)". Route a wording update through `bmad-spec`.

### F11 (low): template versions are not frozen

S3 (entry 4) plans to "write VBA Finish … in the S1 template", that is, to change v1's VBA in place. Before Production this is harmless. Once any attempt references a version, though, changing that version's VBA invalidates its fingerprint for every open file.

**Fix.** Add to AD-4: "a version's file and fingerprint are immutable once an attempt references it; any VBA change is a new `exam.v<N+1>.xlsm`". This generalizes "Adding a code bumps `WHE_TemplateVersion`".

## What is right

- The S2 evidence is real, and the chosen normalization (decompress, drop `Attribute`, LF) is exactly what makes the save-time rewrite invisible. I confirmed it on the fixture.
- The rejected alternatives are sound. Raw module-stream bytes would break on any p-code cache rewrite (`VBA/Sheet1` grew from 999 to 1188 bytes in S2). Dropping the fingerprint would miss Save As `.xlsx` and macro edits.
- "A workbook without a VBA project has none → `IDENTITY_ALTERED`" keeps the EXPERIENCE.md Save-As-`.xlsx` behaviour.
- AD-6 cross-references AD-4 rather than restating the algorithm, so there is one definition.

## Sources

- [MS-OVBA, Microsoft Open Specifications](https://docs.microsoft.com/en-us/openspecs/office_file_formats/ms-ovba); [MS-OVBA revision docx](https://msopenspecs.microsoft.com/files/MS-OVBA/%5bMS-OVBA%5d-220215.docx)
- [Vercel Functions limitations (4.5 MB request/response body)](https://examples.vercel.com/docs/functions/limitations); [Vercel KB: bypassing the body size limit](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions)
- [Require Variable Declaration adds Option Explicit to new modules (wiseowl)](https://wiseowl.co.uk/vba-macros/tips/variables/force-variable-declaration); [Excel Easy: Option Explicit](https://www.Excel-Easy.com/vba/examples/option-explicit.html). Neither confirms the behaviour for sheet modules, hence the "may" in F1.
- Local verification: olefile/olevba on the `vbaProject.bin` of `assets/templates/exam.v1.xlsm` and `src/adapters/workbook/__fixtures__/s2-excel2021.xlsm`
