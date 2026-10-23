# Review — adversarial, fingerprint update (AD-4, AD-6)

Lens: build two units one level down that each obey every AD to the letter and still clash. Target: the 2026-10-23 update (memlog entries 57–60). That update defined the template fingerprint as SHA-256 over every VBA module's MS-OVBA-decompressed source, with `Attribute` lines dropped, LF line endings, modules ordered by name and each headed by its name. A workbook without a VBA project has no fingerprint, `xl/vbaProject.bin` bytes are never compared, and AD-6 rejects a missing or different fingerprint as `IDENTITY_ALTERED`.

**Verdict: not buildable as written. The update is right to drop the bytes and keep only the source, but it leaves 1 critical and 4 high holes.** "Every module" includes modules that ordinary Excel use creates. The byte grammar is open: the real v1 template gives 7 different fingerprints that all obey the Rule. AD-6 needs the attempt's version before it has found the attempt. The registry has no defined producer or owner. And a `.xlsb` Save As now passes the identity check, then can never be graded. All of these can be closed by tightening AD-4, AD-6 and one edge in AD-5. Proposed text is in the last section.

## Evidence (inspected, nothing in the repo changed)

`olefile` + `oletools` were installed in a scratchpad venv. The `dir` stream was parsed and each module decompressed for `assets/templates/exam.v1.xlsm` and the Excel-saved `src/adapters/workbook/__fixtures__/s2-excel2021.xlsm`:

| Module (dir `MODULENAME`) | Kind | Source after dropping `Attribute` lines | Changed by the Excel save? |
| --- | --- | --- | --- |
| `ThisWorkbook` | document | empty (8 `Attribute` lines only) | source no; stream offset no |
| `Sheet1` (tab `Instructions`) | document | empty | source no; **p-code offset 827 → 1016** |
| `Sheet2` (tab `Data`) | document | empty | no |
| `modFinish` | procedural | 944 bytes of code | no |

`PROJECTCODEPAGE` = 1252. `assets/templates/vba/modFinish.bas` is byte-identical to the stored `modFinish` source (1,002 bytes, CRLF). It is one of the four modules.

Fingerprints of the same v1 template, each a literal reading of the Rule (identical for the template and the S2 fixture):

| Reading | Fingerprint |
| --- | --- |
| A — ordinal order (`Sheet1, Sheet2, ThisWorkbook, modFinish`), header `name\n`, split/filter/join | `2261fbc4…` |
| B — case-insensitive order (`modFinish` first; `localeCompare`/`Intl.Collator`) | `d7fe9e7a…` |
| C — empty document modules skipped (this equals hashing the `.bas` files) | `45e86b4f…` |
| D — header `' name\n` | `714bb97d…` |
| E — header `name\0` | `159d83cc…` |
| F — header `[name]\n` | `24b84cf1…` |
| G — each kept line + `\n` (extra final newline) | `a268d843…` |
| H — regex-strip `^Attribute .*\n` | `2261fbc4…` (= A) |

That is 7 distinct values. Encoding trap seen in this container: Node v22.22.0 `new TextDecoder('windows-1252')` (and `'cp1252'`, `'latin1'`, `Buffer#toString('latin1')`) decodes 0x97 0x85 0x93 0x94 as U+0097 U+0085 U+0093 U+0094. Python `cp1252`, which olevba uses, gives U+2014 U+2026 U+201C U+201D, as WHATWG requires. `package.json` pins Node `24.x` for Vercel, and 24.x was not checked.

## Holes, ranked

### F1 — critical — "Every VBA module" covers modules that ordinary Excel use creates

- **Unit A (obeys AD-2/AD-4):** in Level 7 (PivotTable; *Insert PivotTable* defaults to **New Worksheet**), in Ujian Akhir ("laporan multi-sheet + Summary + Pivot", `level-curriculum.md`), or in any level where the user adds a scratch sheet or uses *Move or Copy*, Excel adds a document module to the project: `Sheet3`, or `Chart1` for a PivotChart sheet. Its code name follows the Excel UI language. Its body is empty, or `Option Explicit` when that PC's VBE has *Require Variable Declaration* on. A later generator that adds a data-sheet part triggers the same thing: AD-4 lets it write sheet XML and forbids nothing more, and Excel creates the missing document module on open and writes it on save.
- **Unit B (obeys AD-6):** hashes every module, gets a value ≠ the registry, and returns `IDENTITY_ALTERED`.
- **Clash:** a genuine file is rejected with the "don't Save As" message. The attempt stays open and the user cannot tell why. Every genuine Ujian Akhir file would fail, which forces an engine change in a Next phase. That contradicts the spine's scope line ("Next phases plug in without engine changes"). The v1 document modules hold no code at all (table above), so including them adds no tamper detection. They are exactly the part of the project that structural workbook edits change. Deleting a sheet removes a module and fails the same way.
- **Tightened Rule (AD-4):** the reading exposes **per-module** hashes, not one digest. The registry pins only the template's modules whose normalized source is non-empty (in v1: `modFinish`). A submission matches when its VBA project is present and every pinned module is present with an equal hash. **Modules the template does not pin are ignored.** This also removes the ordering and "headed by its name" questions from F2.

### F2 — high — The canonical byte grammar is not defined

- **Unit A:** the adapter's own TypeScript `vbaFingerprint()` (memlog: own MS-OVBA decompressor, no new dependency). It uses default `Array#sort` (ordinal), header `name + "\n"`, decodes with `TextDecoder('windows-1252')` and hashes UTF-8.
- **Unit B:** the registry value. It is recorded with an olevba/Python script, which is how S2 cross-checked, or with `localeCompare` ordering. It may skip empty document modules, use a comment-style header, or emit one `"\n"` per line.
- **Clash:** the 7 values above, from one file. Encoding makes it worse. AD-6 puts the Indonesian message boxes in the VBA, and any em dash, ellipsis or curly quote in them (bytes 0x80–0x9F) makes a Node-decoded reading differ from a Python-decoded registry value on *every* file. If Node 24 fixes the decoder while dev/CI run Node 22, the same function gives different results in CI and in production. Other open points: `MODULENAME` (MBCS) vs `MODULENAMEUNICODE` vs `MODULESTREAMNAME`; lone CR; trailing spaces; trailing blank lines; case and position of `Attribute`.
- **Tightened Rule (AD-4):** hash **bytes, never decoded text**. CR, LF and the ASCII word `Attribute ` at line start are code-page-safe, including in DBCS code pages. The per-module hash is SHA-256, as lowercase hex, of the decompressed source from `MODULEOFFSET`, normalized like this: CRLF and lone CR → LF; drop lines that begin with the bytes `Attribute `; strip trailing SP/TAB from each line; drop trailing empty lines; join with LF and no final LF. Modules are keyed by `MODULENAMEUNICODE`, and template module names must be ASCII (CI check). Commit test vectors: v1 `modFinish` → `914687b34fc5eb2e3c3982861b567ccc25f040fb80543c3986e4935b80f4235c`; empty source → `e3b0c442…b855`.

### F3 — high — AD-6 compares against "the attempt's recorded `template_version`" before it knows whether the token names an attempt

- **Unit A (literal decision order):** with a well-formed but unknown token there is no attempt and so no version. It treats that as a mismatch and returns `IDENTITY_ALTERED`, which makes `NOT_THIS_ATTEMPT` unreachable for any well-formed token.
- **Unit B:** looks the token up first and returns `NOT_THIS_ATTEMPT`.
- **Unit C:** the upload handler compares against the session's **open** attempt (EXPERIENCE: Upload Dropzone "uploads to the open attempt"), while the macro handler uses the token's attempt.
- **Unit D:** takes the version from the file's `WHE_TemplateVersion`, or inverts the registry. v1 and v2 can share a fingerprint when only the layout changed, per `assets/templates/README.md`.
- **Clash:** a Preview-generated file uploaded to Production (AD-13) gets "identity altered, don't Save As" from A and "not from the current attempt" from B. An old file from a graded v1 attempt uploaded while a v2 attempt is open gets `IDENTITY_ALTERED` from C-upload and `ALREADY_GRADED` from C-macro. EXPERIENCE (failure path at line 286) expects the `NOT_THIS_ATTEMPT` message for "an old file from Downloads". Separately, a mismatched `X-Attempt-Token` header has no code.
- **Tightened Rule (AD-6):** a numbered order in which the attempt is always found from the file's token, on both channels (full text below). `WHE_TemplateVersion` and fingerprints are never used to pick a version. Also decide which message an old file from a terminal attempt gets, and update EXPERIENCE or AD-6 to match.

### F4 — high — Who produces the registry, when, and who owns the template version is unspecified

Pairs that obey the Rule:
- **Source of the value.** Candidates are: the adapter function on the committed `.xlsm`; the `.bas` review copies (README step 4 records the hash by hand, and `.bas` holds only `modFinish`, so it equals reading C and never A); a tool such as PowerShell `Get-FileHash`, which prints UPPERCASE hex and so fails a string compare; or a runtime computation from `exam.v<N>.xlsm`. The last only works if the `/api/submissions/macro` function bundle traces the template file. If it does not, every macro submission falls through to a mismatch.
- **When it is recorded.** The generator could store `attempts.template_fingerprint` from the generated file at Start, while submit looks up the registry. After any algorithm change (this update is one), the stored values go stale.
- **Two owners of "current version".** The core attempts service could record `template_version` from its own constant while the adapter generates from `CURRENT_TEMPLATE_VERSION`. Bumping one and not the other makes every new attempt mismatch.
- **AD-1.** Core `submit` cannot import `src/adapters/workbook/templates.ts`, so someone copies the literals into core and there are two registries.
- **Null entries.** `templates.ts` types the hash as `string | null` ("until the template is in the repo"). One unit treats null as "skip the check" and accepts everything; another treats it as a mismatch and rejects everything.
- **Tightened Rule (AD-4):** registry values are produced only by the adapter's own function from the committed `exam.v<N>.xlsm`. They are committed as literals, checked at load as lowercase 64-hex, non-null, and recomputed and compared in CI. Nothing computes them at runtime or stores them per attempt. `WorkbookIO.generate()` returns `{ bytes, templateVersion }`, and the attempts service records exactly that value. Core reaches the registry only through the WorkbookIO port (for example `matchesTemplate(reading, version)`), never by importing it.

### F5 — high — A `.xlsb` Save As now passes identity and leaves the attempt stuck

- **Unit A (submit, obeys AD-6):** reads only the identity parts (`docProps/custom.xml` and `xl/vbaProject.bin`). That is cheap, because grading runs later in `after()`. It treats `.xlsb` as an OOXML (OPC) package, so `NOT_EXCEL` does not fire. Save As `.xlsb` keeps both the token and the VBA source, so the file is accepted and the attempt moves to `received`. The macro channel reaches this too, since Finish posts whatever format the workbook is now in.
- **Unit B (grader, obeys AD-3):** needs `xl/workbook.xml` and the sheet XML, throws, and sets `grading_failed`. *Try again* re-grades the same bytes and fails forever. AD-5 has no way out of `grading_failed`, and the partial unique index blocks *Start*, so the user is locked out. The old byte hash happened to block this, because it rejected every save.
- **Tightened Rule (AD-6 + AD-5):** classify the file by the content type of the workbook's main part. `…spreadsheetml.sheet.main+xml` or `…ms-excel.sheet.macroEnabled.main+xml` continue. Any other Excel main part (`.xlsb`, `.xltm`, `.xlam`) gets `IDENTITY_ALTERED`, whose message already says "don't Save As". Anything else gets `NOT_EXCEL`. Identity and grading use the same `WorkbookIO.read` classification. Add `grading_failed → abandoned: Abandon` to AD-5.

### F6 — medium — Template-version immutability and deploy order are no longer enforced

- **Re-saved templates.** The fingerprint survives a re-save. A `exam.v1.xlsm` re-saved with moved cells keeps version 1 and passes the registry test, because nothing pins the file. Read literally, "the bytes of `xl/vbaProject.bin` are never compared" also deletes the generation invariant in `templates.test.ts` (the patched `vbaProject.bin` equals the template's byte for byte). That check is about generation, not submission.
- **In-place VBA edits.** S3 extends Finish (see the `modFinish.bas` header). The Rule does not say a VBA change means a new version. If v1 is edited in place, the dev DB shared by every Preview (AD-13) holds files from branch A's v1 that branch B's v1 rejects.
- **Rollback.** A deploy makes v2 current and attempts record v2. A Vercel instant rollback leaves a registry without v2, and the lookup returns `undefined`. Unit A then 500s while Unit B returns `IDENTITY_ALTERED`.
- **Regeneration.** If the stored generated file is missing (the storage write failed after the row insert), a re-download unit may "helpfully" regenerate from the current template. That gives a new version, new data and possibly a new token.
- **Tightened Rule:** the registry also pins each template file's whole-file SHA-256 (CI). A template version is immutable once any environment has generated from it, and any change to the file is a new version. Generation keeps `xl/vbaProject.bin` byte-identical to the template (tested). A new version ships in the registry one Production deploy before it becomes current. An unknown `template_version` is a logged server fault that leaves the attempt untouched, never a rejection code. An attempt becomes `open` only after its generated file is stored, and re-download never regenerates.

### F7 — medium — Channel-specific gaps

- **What the macro posts.** The S3 VBA might post a converted copy, such as `SaveAs` with `FileFormat:=51` (`.xlsx`) to dodge file locking or shrink the upload. Every macro submission would then be `IDENTITY_ALTERED`. Rule: Finish posts the workbook saved in its own `.xlsm` format (`Save`, or `SaveCopyAs` to a `.xlsm` path), never a converted copy.
- **Office PC.** Corporate download or mail gateways with content disarm can strip VBA from `.xlsm`. A genuine upload is then `IDENTITY_ALTERED`, against SPEC's "upload path must always work", and the "don't Save As" message misleads. Rule: logs distinguish `vba: absent` from `mismatch: [module names]` (no source, no bytes). The office-PC check is added to S3. The memlog records acceptance or a fallback.
- **Old VBA, new codes.** "Adding a code bumps `WHE_TemplateVersion`", but open attempts keep their old VBA. Rule: the VBA maps any unknown code or HTTP status to the generic failure message and keeps the workbook open.

### F8 — medium — Reader failure semantics and decompressor coverage

- **Parse failures.** A corrupt `dir` stream or a decompression error could throw like `NotAWorkbookError` (→ `NOT_EXCEL`), return null (→ `IDENTITY_ALTERED`), or surface as a 500, depending on the implementer. Rule: VBA problems never throw. They give `vba: null` → `IDENTITY_ALTERED`.
- **Multi-chunk decompression.** v1 `modFinish` (1,002 bytes) fits in one 4,096-byte chunk. The S3 Finish (HTTP, `ADODB.Stream`, 5+ messages) will span several chunks, and CopyToken bit-width bugs only show past the first chunk. Rule: a golden test compares the adapter's decompression with olevba text for a module of at least 3 chunks that includes a raw (uncompressed) chunk. olevba is a test oracle only, never a registry producer.
- **UserForms.** If S3 adds a UserForm, its designer storages (`f`, `o`, `\x03VBFrame`) are explicitly outside the fingerprint, because Excel rewrites them like `PROJECT`.

## Proposed Rule text

**AD-4, replacing the two fingerprint sentences.** Reading returns `WorkbookReading.vba`. It is `null` when `xl/vbaProject.bin` is absent or cannot be parsed or decompressed. Otherwise it is `{ modules: Record<MODULENAMEUNICODE, sha256> }` over every module in the `dir` stream. A module's hash is SHA-256, as lowercase hex, of its source bytes decompressed per MS-OVBA from `MODULEOFFSET` and not decoded from the code page, normalized as: CRLF and CR → LF; lines beginning with `Attribute ` removed; trailing SP/TAB removed per line; trailing empty lines removed; joined by LF with no final LF. Templates are kept per version as `assets/templates/exam.v<N>.xlsm`, each with a registry entry `{ fileSha256, vbaModules }`. `vbaModules` holds the template's modules whose normalized source is non-empty. Registry values are produced only by this adapter's function, committed as literals, and recomputed in CI; nothing computes them at runtime or stores them per attempt. Core reaches the registry only through WorkbookIO. `generate()` returns `{ bytes, templateVersion }`, and the attempt records that version. A version is immutable once any environment generated from it; a changed file is a new version, which ships in the registry one deploy before it becomes current. Generation leaves `xl/vbaProject.bin` byte-identical; a submitted file's `xl/vbaProject.bin` bytes are never compared. An attempt is `open` only once its generated file is stored, and re-download serves those bytes and never regenerates.

**AD-6, replacing the decision order.**
1. The file is not a zip whose workbook main part is an Excel type → `NOT_EXCEL`.
2. The main part is not `…sheet.main+xml` or `…sheet.macroEnabled.main+xml` (`.xlsb`, `.xltm`, `.xlam`), or `WHE_AttemptToken` is missing or malformed, or (macro) `X-Attempt-Token` is missing or ≠ the file's token → `IDENTITY_ALTERED`.
3. The token names no attempt in this environment → `NOT_THIS_ATTEMPT`. The attempt is always found from the file's token on both channels; `WHE_TemplateVersion` and fingerprints never choose a version.
4. `vba` is null, or a module pinned for that attempt's `template_version` is absent or differs → `IDENTITY_ALTERED`. Unpinned modules are ignored.
5. Status checks follow, as now.

An unknown `template_version` is a logged server fault and the attempt is left untouched. The VBA shows the generic failure message for any code or status it does not know. Finish posts the workbook in its own `.xlsm` format.

**AD-5.** Add `grading_failed → abandoned: Abandon`.

## Verify in S3

1. Insert a worksheet, a PivotTable on a new sheet, and a chart sheet; save; list the modules (confirms F1).
2. Save on the office PC, and download the generated file through the office network; confirm `vba` is present and the pinned hashes match (F7).
3. Use a Finish module larger than 8 KB, with an em dash and an ellipsis in a message, and run the golden decompression test (F2, F8).
4. Save As `.xlsb`, then click Finish and also upload (F5).

## What holds

- Dropping `Attribute` lines also absorbs `VB_ProcData.VB_Invoke_Func` (a shortcut key assigned to Finish) and `VB_Description`. Neither breaks identity.
- Excluding `PROJECT`, `_VBA_PROJECT`, `__SRP_*` and the p-code is what S2 needed. In the evidence above, p-code offsets move while the source does not.
- Generation never touches `xl/vbaProject.bin`, so a generated file always matches its template. Save As `.xlsm` under another name passes, and Save As `.xlsx` is rejected, as the spec intends.
