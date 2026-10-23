# Review: research verification, template fingerprint update (AD-4, AD-6)

- **Lens:** was each committed decision web-researched or reality-checked, or asserted from memory? Is each named technology current and a fit?
- **Target:** the 2026-10-23 update (memlog entries 57–60). It amended AD-4 and AD-6: the fingerprint is SHA-256 over every VBA module's source, decompressed per MS-OVBA, with `Attribute` lines dropped, LF line endings, and modules ordered by name, each headed by its name. The bytes of `xl/vbaProject.bin` are never compared.
- **Evidence base:** the S2 plan's Implementation Notes, `assets/templates/exam.v1.xlsm`, and `src/adapters/workbook/__fixtures__/s2-excel2021.xlsm`. Both files were inspected read-only. Nothing in the repo, spine or memlog was changed.
- **Date:** 2026-10-23

## Verdict

**The core claim checks out, but three things the update commits to were assumed rather than checked.**

What was confirmed:

- MS-OVBA defines the compression.
- `MODULEOFFSET` in the `dir` stream locates the source.
- Excel 2021 rewrote `PROJECT` and the caches while leaving the source alone. I reproduced this byte for byte.

What was assumed:

1. "Every module" is safe to hash. Microsoft's own normalization says it isn't.
2. MS-OVBA alone is enough to read the file. Reading `vbaProject.bin` also needs a compound-file (MS-CFB) reader.
3. The source survives other machines, Excel builds and runtimes. The only evidence is one save on one 64-bit Excel 2021 install, and Office 2021 went out of support on 2026-10-13.

None of these blocks the direction. All three should be closed before S3 or epic 2 write the code.

## Sources and reachability

| Source | Reached? | Used for |
| --- | --- | --- |
| learn.microsoft.com, msopenspecs.microsoft.com (official [MS-OVBA]) | **No.** The egress proxy refused them (`connect_rejected`), and WebFetch could not resolve the host. | n/a |
| Text extraction of **[MS-OVBA] v20260519** (release 2026-05-19) on GitHub: `DnaCalc/Foundation/.../ms-ovba-ms-ovba-6ca91a09/artifacts/pdf_text_pdfpig.txt`, via raw.githubusercontent.com | Yes. It is a garbled PDF extraction; I read the passages through the noise. | Section text quoted below |
| EPPlus `src/EPPlus/Vba/ContentHash/{ContentNormalizedData,V3NormalizedData}HashInputProvider.cs` (develop) | Yes | An independent, shipping implementation of MS-OVBA 2.4.2.1 and 2.4.2.5 (it cites v20220517) |
| Apache POI `VBAMacroReader.java` (trunk) | Yes | How a production reader locates module source |
| oletools 0.60.2 / olefile 0.47 (latest on PyPI: 2024-07-02 / 2023-12-01), pcodedmp 1.2.6 | Local venv | Cross-check of my own decompressor |
| npm registry | Yes | `cfb` package status |
| Web search (summaries only): Microsoft "End of support for Office 2021", MITRE ATT&CK T1564.007, Node issues #60888 and #59515, Aspose and Chandoo forum threads on new-sheet CodeName | Yes. The pages themselves could not be fetched, and GitHub issue status was not reachable. | Lifecycle, stomping, Node decoder, new-sheet behaviour |

## Reality check against the two workbooks

I wrote my own MS-OVBA 2.4.1 decompressor. Its output matched `oletools.olevba.decompress_stream` byte for byte on the `dir` stream and on all four modules of both files.

| Claim in the update or S2 notes | Result |
| --- | --- |
| `PROJECT` changes because of `ID=`, `CMG`, `DPB` and `GC` | **Exact.** The line diff contains those four lines and nothing else. |
| `dir` changed | True. It is a **single byte**: decompressed offset 708, `0x3b → 0xf8`, which is Sheet1 `MODULEOFFSET` 0x33B → 0x3F8 (827 → 1016). Memlog entry 58 calls `dir` a "compile cache", which is inaccurate: it is project metadata that moved only because Sheet1's p-code cache grew. |
| `VBA/Sheet1` (cache) changed | True. The PerformanceCache grew 827 → 1016 bytes, and the compressed source after it is byte-identical. |
| `__SRP_*` changed or were added | True: `__SRP_0` and `__SRP_1` changed, `__SRP_6` and `__SRP_7` are new. |
| `VBA/modFinish` byte-identical | True. |
| Decompressed source of every module identical | True. The **compressed** source of all four modules is identical too. |
| Spine fingerprint (ordinal order, header `name\n`, lines joined with `\n`, cp1252 → UTF-8) | `2261fbc4cf605f93b403eee4a6c36583eed47676a688be1d3a3d9adc7def1b4c` for **both** files |
| `assets/templates/vba/modFinish.bas` | Byte-identical to the stored source (1,002 bytes, CRLF) |
| Environment of the save | `PROJECTSYSKIND` = 3 (64-bit Windows, per the spec), `PROJECTCODEPAGE` = 1252, LCID 0x409, `_VBA_PROJECT` Version 0x00B5, in both files. One Excel install wrote both. |
| Container layout | CFB v3, 512-byte sectors, mini-stream cutoff 4096. **Every VBA stream in v1 is under 4096 bytes and lives in the mini stream.** |

The ordering is ambiguous. Case-insensitive order puts `modFinish` first and gives `d7fe9e7a…`. The rubric review's run of "the spine algorithm" got `d8a3d06c…`. So three reviewers produced at least two values from the same wording. The adversarial review (F2) covers this grammar gap in depth, and I do not repeat it here.

## Spec text that confirms the binding ([MS-OVBA] v20260519)

- **2.4.1 Compression and Decompression** defines the algorithm. The `dir` stream is also a compressed container, so "decompressed per MS-OVBA" has to apply to `dir` too, not only to module source.
- **2.3.4.2.3.2.5 MODULEOFFSET Record:** "TextOffset (4 bytes): An unsigned integer that specifies the byte offset of the source code in the ModuleStream (section 2.3.4.3) named by MODULESTREAMNAME Record." The stream is looked up by `MODULESTREAMNAME`, not by `MODULENAME`.
- **2.3.4.3 Module Stream:** "PerformanceCache … implementation-specific and version-dependent performance cache for the module. MUST be MODULEOFFSET … bytes in size. MUST be ignored on read." CompressedSourceCode, when decompressed, "MUST contain MBCS characters encoded using the code page specified in PROJECTCODEPAGE (section 2.3.4.2.1.5)."
- **Versioning note:** "When this version number matches the version used by Office, performance caches … will be used instead of the interoperable representation within the file." So the source is the version-independent part, which supports the design. It also means the p-code, not the source, is what runs on a matching Office (see V6).
- **2.4.2.1 Content Normalized Data** is Microsoft's legacy signature hash. It splits lines on CR, LF or CRLF and keeps a line only "IF NOT Line starts with 'attribute' when ignoring case". The update's `Attribute`-drop and line-ending rules therefore have a Microsoft precedent. The spine does not cite it.
- **2.4.2.5 V3 Content Normalized Data** is the current signature hash. It skips `Attribute VB_Name` lines and a fixed **DefaultAttributes** list: `VB_Base = "0{00020820-…}"` (the worksheet base), `VB_GlobalNameSpace = False`, `VB_Creatable = False`, `VB_PredeclaredId = True`, `VB_Exposed = True`, `VB_TemplateDerived = False`, `VB_Customizable = True`. It appends a module's name only when **HashModuleNameFlag** is set, meaning the module has a code line or a non-default attribute. EPPlus implements exactly this. An empty worksheet module therefore contributes **zero bytes** to Microsoft's own hash.

## Findings

| # | Severity | Concerns | Finding | Disposition |
| --- | --- | --- | --- | --- |
| V1 | **high** | AD-4 "every VBA module … each headed by its name"; memlog 59 | **Including attribute-only document modules was assumed, not researched, and Microsoft's spec does the opposite.** In v1, ThisWorkbook, Sheet1 and Sheet2 hold only `Attribute` lines, so they add nothing but name headers. MS-OVBA 2.4.2.5 deliberately keeps empty worksheet modules out of the hash, which is what lets a signed project survive structural edits. Whether Excel writes a document module for a newly added sheet is unverified. Forum reports (Aspose, Chandoo) say a new sheet's code module is created lazily, depending on whether the VBE or VBProject has been touched. That makes the spine fingerprint depend on undocumented, state-dependent Excel behaviour. I simulated an added `Sheet3` (a copy of Sheet2's attribute-only source): the spine value changes, while a rule that skips modules with no code and only default attributes stays at `78df140c…`. This is the same root issue as adversarial F1 and rubric F1; it adds the authoritative precedent. | Before S3: exclude modules with no code lines and only `VB_Name` or DefaultAttributes, following 2.4.2.5's HashModuleNameFlag, or pin named modules per the adversarial F1 text. Cite 2.4.2.5. One-step reality check in S3: add a sheet in Excel 2021, save, re-fingerprint. |
| V2 | **medium** | memlog 60 ("MS-OVBA decompression in `src/adapters/workbook` without a new dependency"); AD-4 | **The update names only MS-OVBA, but `vbaProject.bin` is a Compound File Binary ([MS-CFB]) container.** `jszip` and `fast-xml-parser` cannot open it. "No new dependency" therefore commits the adapter to a hand-written CFB reader: header, FAT, DIFAT, directory entries, **and the mini stream with its mini-FAT**. Every v1 VBA stream is in the mini stream, so v1 fixtures never exercise the regular-sector path. The S3 Finish (HTTP and multipart) will likely push `modFinish` past the 4096-byte cutoff; it is 3,807 bytes today, of which 3,131 are p-code. The record does not show that existing libraries were checked. npm `cfb` 1.2.2 (SheetJS, Apache-2.0, last published 2022-04-06, deps `adler-32` and `crc-32`) is reachable from the container, unlike SheetJS `xlsx`. No maintained npm MS-OVBA package was found (`ovba` and `vba-extract` do not exist), so writing the decompressor in-house is justified. | Record the choice: own CFB reader (spec [MS-CFB], with a test on a stream of 4096 bytes or more) or `cfb` 1.2.2 pinned in Stack. Either way, name [MS-CFB] next to [MS-OVBA]. |
| V3 | **medium** | AD-4 canonical form; Stack "Node.js 24.x" | **Runtime decoding was not reality-checked.** In this container, Node v22.22.0 `new TextDecoder('windows-1252')` (and the `cp1252`, `latin1` and `iso-8859-1` labels) returns U+0080–U+009F for bytes 0x80–0x9F, where WHATWG requires € — “ ” and so on. Node issue #60888 reports this as a regression since 22.13.0 and 20.18.3, and #59515 shows it on 24.6.0; their fix status could not be fetched. EXPERIENCE.md's macro message "File belum terkirim. Filenya sudah tersimpan — upload lewat web, ya." contains an em dash (0x97 in cp1252), and AD-6 puts those messages in the VBA. A fingerprint that decodes text would then differ between Node and a Python or olevba registry script, or between Node patch versions. Adversarial F2 found the same. | Hash decompressed **bytes**, never decoded text, and add a CI check that template VBA source is ASCII-only (write non-ASCII as `ChrW(&H2014)`). |
| V4 | **medium** | The AD-4 claim "a fingerprint that changes when Excel saves the file" is prevented; Stack "Excel client: Excel 2021 desktop" | **The evidence is one save on one machine.** Both files carry `PROJECTSYSKIND` = 3 (64-bit) and VBA Version 0x00B5. Nothing tested a second machine, 32-bit Excel, a different build, the office PC with macros blocked, an added sheet, or an opened VBE. The spec's versioning note (source is the interoperable representation, caches are rebuilt) supports the design but was not observed. This matters more now: **Office 2021 and Office LTSC 2021 reached end of support on 2026-10-13** (Microsoft support page via search; no extension or ESU). The IT-managed office PC is therefore likely to move to Microsoft 365 or Office LTSC 2024, which triggers the recompile path. The Stack row was not re-checked for lifecycle, by this update or by the first research review. | Add to S3: save the same generated file on the office PC (record its SysKind and VBA version) and after adding a sheet, then compare fingerprints. Separately, ask the user whether "Excel 2021" stays the client or becomes "Excel 2021 or later (LTSC 2024 / Microsoft 365, Office 2021 functions only)". |
| V5 | **low** | AD-4 wording "decompressed per MS-OVBA", "Attribute lines dropped", "line endings as LF" | **No section references, and the line rules are not spelled out.** Cite 2.4.1 (applies to `dir` too), 2.3.4.2.3.2.5, 2.3.4.3, and 2.3.4.2.1.5 (code page). The spec's rule "starts with 'attribute' ignoring case", which a naive `startsWith` copies, also drops real code lines such as `AttributeCount = 1`. Define the match as the bytes `Attribute ` at column 0. Also state how a lone CR and a trailing blank line are handled; 2.4.2.1 splits on CR, LF or CRLF. Section numbers moved between revisions: oletools quotes PROJECTCODEPAGE as 2.3.4.2.1.4, v20260519 has 2.3.4.2.1.5. Pin the revision you cite. | Autofix the wording when V1 is fixed. |
| V6 | **low** | AD-6 `IDENTITY_ALTERED` semantics | **The fingerprint proves the source, not the code that runs.** Per the versioning note and MITRE ATT&CK T1564.007 (VBA stomping), Office runs the p-code when versions match, so a project with stomped source and malicious p-code fingerprints as genuine. Under the single, allowlisted user and the token check this is acceptable, but the spine should not imply macro integrity. | One clause in AD-4 or AD-6: "identifies the template's VBA source; p-code is not checked". |
| V7 | **low** | Evidence reproducibility; AD-4 "never compared" | **The S2 evidence lives only in prose and a scratch venv.** `scripts/spike-s2.ts` prints only the byte hash. Both files are in the repo, so `fingerprint(exam.v1.xlsm) === fingerprint(s2-excel2021.xlsm)`, plus a committed vector, is a cheap regression test. Separately, "the bytes of `xl/vbaProject.bin` are never compared" is absolute, but the generation tests rightly compare them (`template-patch.test.ts:149`, `templates.test.ts:44`: a patched file keeps the template's bytes). | Scope the sentence to identity ("never used to identify a submission"). Add the test in the first fingerprint story. |

## What passed

| Item | Status |
| --- | --- |
| [MS-OVBA] is the right spec, current revision v20260519 | Confirmed (mirror, EPPlus, POI, oletools) |
| MS-OVBA 2.4.1 compression for module source and `dir` | Confirmed, and reproduced with an independent decompressor |
| Source located through `dir` → `MODULESTREAMNAME` + `MODULEOFFSET`; PerformanceCache ignored | Confirmed (spec text plus both files). Sheet1's offset moving 827 → 1016 shows why the offset must be read per file, never assumed. POI keeps a brute-force fallback for non-Excel writers with wrong offsets, which is irrelevant here because a parse failure fails closed to `IDENTITY_ALTERED`. |
| Dropping `Attribute` lines and normalizing line endings | Has a Microsoft precedent (2.4.2.1). It also tolerates legitimate Macro Options edits (`VB_Description`, `VB_ProcData.VB_Invoke_Func`). Nothing else in the source varied in the evidence. |
| Code page | 1252 in both files, and both of the user's machines are likely 1252 (Indonesian or English Windows). Safe once V3 (bytes, ASCII-only) is done. |
| Rejecting the bytes of `vbaProject.bin` | Correct: Sheet1's whole module stream changed even on the same Excel. The memlog's reason ("another Excel could rewrite p-code") understates it, but the conclusion holds. |
| Workbook without a VBA project → no fingerprint → `IDENTITY_ALTERED` | Consistent with Save As `.xlsx` removing `vbaProject.bin`. `.xlsb` is covered by adversarial F5. |

## Not verified from here

- Official Microsoft pages (learn.microsoft.com, msopenspecs) were blocked, so spec text comes from a third-party mirror of the same revision.
- Whether Excel writes a document module for a sheet added without opening the VBE (V1) has only forum reports. It needs an Excel run.
- Status of Node issues #60888 and #59515 (GitHub not reachable). Behaviour on Node 24.x is known only from the issue report.
- 32-bit Excel, Microsoft 365 or LTSC 2024 saves of the same file (V4).
