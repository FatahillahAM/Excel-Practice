import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import CFB from "cfb";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { S2_FIXTURE } from "./__fixtures__/s2-expected";
import { buildVbaProject, bytes, compressVba, concat, dirRecords, type ModuleSpec, u32 } from "./__fixtures__/vba-project";
import { templates } from "./templates";
import {
  decompressVbaContainer,
  EMPTY_MODULE_SHA256,
  MAX_DECOMPRESSED_BYTES,
  normalizeVbaSource,
  readVbaModuleHashes,
  readVbaModuleSources,
} from "./vba";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

async function vbaProjectOf(file: string): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(await readFile(path.join(repoRoot, file)));
  return zip.file("xl/vbaProject.bin")!.async("uint8array");
}

function sha256(data: Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

function text(data: Uint8Array): string {
  return Buffer.from(data).toString("latin1");
}

function hex(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value.replace(/\s+/g, ""), "hex"));
}

/** Deterministic VBA-looking source of about `size` bytes, so chunks are neither trivial nor incompressible. */
function longSource(size: number): string {
  const lines = ["Attribute VB_Name = \"modLong\"", "Option Explicit", ""];
  for (let i = 0; lines.join("\r\n").length < size; i++) {
    lines.push(`Public Function F${i}(ByVal x As Long) As Long`, `    F${i} = x * ${(i * 7919) % 10007} + ${i}`, "End Function");
  }
  return `${lines.join("\r\n")}\r\n`;
}

const DOCUMENT_SOURCE =
  'Attribute VB_Name = "Sheet3"\r\nAttribute VB_Base = "0{00020820-0000-0000-C000-000000000046}"\r\n' +
  "Attribute VB_GlobalNameSpace = False\r\nAttribute VB_Creatable = False\r\nAttribute VB_PredeclaredId = True\r\n" +
  "Attribute VB_Exposed = True\r\nAttribute VB_TemplateDerived = False\r\nAttribute VB_Customizable = True\r\n";

describe("decompressVbaContainer (MS-OVBA §2.4.1)", () => {
  // MS-OVBA §3.2 examples.
  it.each([
    ["no compression", "01 19 B0 00 61 62 63 64 65 66 67 68 00 69 6A 6B 6C 6D 6E 6F 70 00 71 72 73 74 75 76 2E", "abcdefghijklmnopqrstuv."],
    [
      "normal compression",
      "01 2F B0 00 23 61 61 61 62 63 64 65 82 66 00 70 61 67 68 69 6A 01 38 08 61 6B 6C 00 30 6D 6E 6F 70 06 71 02 70 04 10 72 73 74 75 76 10 77 78 79 7A 00 3C",
      "#aaabcdefaaaaghijaaaaaklaaamnopqaaaaaaaaaaaarstuvwxyzaaa",
    ],
    ["maximum compression", "01 03 B0 02 61 45 00", "a".repeat(73)],
  ])("decodes the spec's %s example", (_, compressed, expected) => {
    expect(text(decompressVbaContainer(hex(compressed)))).toBe(expected);
  });

  it("decodes a source larger than one chunk: a raw chunk, then compressed chunks", () => {
    const source = bytes(longSource(11_000));
    expect(source.length).toBeGreaterThan(2 * 4096);
    const compressed = compressVba(source, [0]);
    // Chunk 0 is stored raw: header 0x3FFF, then the 4096 bytes as they are.
    expect([...compressed.subarray(1, 3)]).toEqual([0xff, 0x3f]);
    expect(compressed.subarray(3, 3 + 4096)).toEqual(source.subarray(0, 4096));
    expect(decompressVbaContainer(compressed)).toEqual(source);
  });

  it("decodes compressed chunks whose copy tokens use every offset width", () => {
    const source = bytes(longSource(13_000));
    const compressed = compressVba(source);
    expect(compressed.length).toBeLessThan(source.length / 2);
    expect(decompressVbaContainer(compressed)).toEqual(source);
  });

  it("stops at the size limit instead of expanding without bound", () => {
    // Six bytes per 4096-byte chunk: a literal, then one copy token of length 4095.
    const chunk = "03 B0 02 61 FC 0F";
    const bomb = hex(`01 ${Array.from({ length: 64 }, () => chunk).join(" ")}`);
    expect(decompressVbaContainer(bomb)).toEqual(new Uint8Array(64 * 4096).fill(0x61));
    expect(() => decompressVbaContainer(bomb, 63 * 4096)).toThrow(/more than/);
  });

  it.each([
    ["an empty container", ""],
    ["a wrong signature byte", "02 19 B0 00 61"],
    ["a wrong chunk signature", "01 19 A0 00 61 62 63"],
    ["a chunk that runs past the end", "01 19 B0 00 61 62 63"],
    ["a copy token before the chunk start", "01 02 B0 01 00 00"],
    ["a truncated copy token", "01 02 B0 02 61 00"],
    ["a raw chunk that is not 4096 bytes", "01 02 30 61 62 63"],
    ["a chunk that decompresses to more than 4096 bytes", "01 05 B0 06 61 FC 0F 00 00"],
  ])("rejects %s", (_, compressed) => {
    expect(() => decompressVbaContainer(hex(compressed))).toThrow();
  });
});

describe("normalizeVbaSource (AD-4)", () => {
  const normalized = (source: string) => text(normalizeVbaSource(bytes(source)));

  it("turns CRLF and lone CR into LF, strips trailing spaces and tabs, drops trailing empty lines", () => {
    expect(normalized("\r\nOption Explicit \t\r\nSub A()\rEnd Sub\t\n  \r\n\r\n")).toBe("\nOption Explicit\nSub A()\nEnd Sub");
  });

  it("drops only lines that start with `Attribute VB_`", () => {
    expect(
      normalized(
        'Attribute VB_Name = "m"\r\nSub A()\r\nAttribute A.VB_UserMemId = 0\r\n  Attribute VB_X = 1\r\nattribute VB_Y = 1\r\nEnd Sub',
      ),
    ).toBe("Sub A()\nAttribute A.VB_UserMemId = 0\n  Attribute VB_X = 1\nattribute VB_Y = 1\nEnd Sub");
  });

  it("keeps the bytes as they are: code page characters are never decoded", () => {
    const source = Uint8Array.of(0x27, 0x20, 0xe9, 0x82, 0xa0, 0xff, 0x20, 0x0d, 0x0a, 0x41);
    expect(normalizeVbaSource(source)).toEqual(Uint8Array.of(0x27, 0x20, 0xe9, 0x82, 0xa0, 0xff, 0x0a, 0x41));
  });

  it("gives an empty source for a module with only Attribute lines", () => {
    expect(normalizeVbaSource(bytes(DOCUMENT_SOURCE))).toEqual(new Uint8Array(0));
    expect(sha256(normalizeVbaSource(bytes(DOCUMENT_SOURCE)))).toBe(EMPTY_MODULE_SHA256);
  });
});

describe("readVbaModuleHashes on committed files", () => {
  it("golden: the template's modFinish decompresses to assets/templates/vba/modFinish.bas", async () => {
    const sources = readVbaModuleSources(await vbaProjectOf(templates[1].file));
    const bas = await readFile(path.join(repoRoot, "assets/templates/vba/modFinish.bas"));
    expect(sources?.get("modFinish")).toBeDefined();
    expect(text(normalizeVbaSource(sources!.get("modFinish")!))).toBe(text(normalizeVbaSource(bas)));
  });

  it("hashes every module of the v1 template; document modules are empty", async () => {
    const hashes = readVbaModuleHashes(await vbaProjectOf(templates[1].file));
    expect(hashes).not.toBeNull();
    expect(Object.keys(hashes!).sort()).toEqual(["Sheet1", "Sheet2", "ThisWorkbook", "modFinish"]);
    for (const name of ["Sheet1", "Sheet2", "ThisWorkbook"]) expect(hashes![name], name).toBe(EMPTY_MODULE_SHA256);
    for (const hash of Object.values(hashes!)) expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives the Excel-saved S2 file the template's hashes although vbaProject.bin bytes differ", async () => {
    const template = await vbaProjectOf(templates[1].file);
    const saved = await vbaProjectOf(S2_FIXTURE);
    expect(sha256(saved)).not.toBe(sha256(template));
    expect(readVbaModuleHashes(saved)).toEqual(readVbaModuleHashes(template));
  });
});

describe("readVbaModuleHashes on projects written by the cfb package", () => {
  const MODULES: ModuleSpec[] = [
    { name: "ThisWorkbook", source: DOCUMENT_SOURCE.replace("Sheet3", "ThisWorkbook"), document: true },
    { name: "modLong", source: longSource(9_000), pcodeLength: 300, rawChunks: [0] },
  ];

  it("reads a multi-chunk module stream stored in regular sectors (over 4096 bytes), skipping the p-code before MODULEOFFSET", () => {
    const bin = buildVbaProject({ modules: MODULES });
    const container = CFB.parse(Buffer.from(bin));
    const stream = container.FileIndex[container.FullPaths.findIndex((p) => p.endsWith("/VBA/modLong"))];
    expect(stream.size).toBeGreaterThan(4096);
    expect(stream.storage).toBe("fat");

    expect(readVbaModuleHashes(bin)).toEqual({
      ThisWorkbook: EMPTY_MODULE_SHA256,
      modLong: sha256(normalizeVbaSource(bytes(longSource(9_000)))),
    });
    expect(text(readVbaModuleSources(bin)!.get("modLong")!)).toBe(longSource(9_000));
  });

  it("gives the same hashes when only the p-code and stream layout differ", () => {
    const other = buildVbaProject({
      modules: MODULES.map((spec) => ({ ...spec, pcodeLength: 1000, pcodeFill: 0x11 })).reverse(),
    });
    expect(readVbaModuleHashes(other)).toEqual(readVbaModuleHashes(buildVbaProject({ modules: MODULES })));
  });

  it("finds the VBA storage and module stream whatever their case", () => {
    const spec: ModuleSpec[] = [{ name: "m", streamName: "MODSTREAM", source: "Sub A()\r\nEnd Sub" }];
    const bin = buildVbaProject({ modules: spec });
    const container = CFB.parse(Buffer.from(bin));
    const recased = CFB.utils.cfb_new();
    for (const [index, fullPath] of container.FullPaths.entries()) {
      const entry = container.FileIndex[index];
      if (entry.type !== 2 || entry.name === "\u0001Sh33tJ5") continue;
      const inner = fullPath.split("/").slice(1).join("/");
      const renamed = inner.replace(/^VBA\//, "vba/").replace(/MODSTREAM$/, "modstream");
      CFB.utils.cfb_add(recased, `/${renamed}`, entry.content);
    }
    const recasedBin = new Uint8Array(CFB.write(recased, { type: "buffer" }) as Buffer);
    expect(CFB.parse(Buffer.from(recasedBin)).FullPaths.some((p) => p.endsWith("/vba/modstream"))).toBe(true);
    expect(readVbaModuleHashes(recasedBin)).toEqual(readVbaModuleHashes(bin));
    expect(readVbaModuleHashes(recasedBin)).toEqual({ m: sha256(bytes("Sub A()\nEnd Sub")) });
  });

  it("caps the bytes decompressed for the whole project, not per stream", () => {
    // One stream of 1 MiB of spaces (about 1.5 KB compressed), aliased by enough modules to exceed the cap together.
    const count = Math.floor(MAX_DECOMPRESSED_BYTES / (1024 * 1024)) + 1;
    const modules: ModuleSpec[] = Array.from({ length: count }, (_, i) => ({
      name: `m${i}`,
      streamName: "shared",
      source: new Uint8Array(1024 * 1024).fill(0x20),
      pcodeLength: 0,
    }));
    const bin = buildVbaProject({
      modules: [modules[0]],
      editDir: () => dirRecords(modules),
    });
    expect(bin.length).toBeLessThan(64 * 1024);
    expect(readVbaModuleHashes(bin)).toBeNull();
    // Within the cap the same aliasing is read.
    const fewer = buildVbaProject({ modules: [modules[0]], editDir: () => dirRecords(modules.slice(0, 2)) });
    expect(Object.keys(readVbaModuleHashes(fewer) ?? {})).toEqual(["m0", "m1"]);
  });

  it("keys modules by MODULENAMEUNICODE and finds a stream whose name differs", () => {
    const bin = buildVbaProject({ modules: [{ name: "modÄnderung", streamName: "MODSTREAM", source: "Sub A()\r\nEnd Sub" }] });
    expect(readVbaModuleHashes(bin)).toEqual({ modÄnderung: sha256(bytes("Sub A()\nEnd Sub")) });
  });

  it.each<[string, () => Uint8Array]>([
    ["empty bytes", () => new Uint8Array(0)],
    ["bytes that are not MS-CFB", () => Uint8Array.from({ length: 4096 }, (_, i) => (i * 37 + 11) % 256)],
    ["a zip archive (which cfb would also parse)", () => Uint8Array.from(Buffer.from("PK\x03\x04 not a vba project"))],
    ["a container without VBA/dir", () => buildVbaProject({ modules: MODULES, omitStreams: ["dir"] })],
    ["a module stream that is missing", () => buildVbaProject({ modules: MODULES, omitStreams: ["modLong"] })],
    [
      "a dir stream that is not compressed",
      () => {
        const bin = buildVbaProject({ modules: MODULES });
        const container = CFB.parse(Buffer.from(bin));
        CFB.utils.cfb_add(container, "/VBA/dir", Buffer.from("garbage"));
        return new Uint8Array(CFB.write(container, { type: "buffer" }) as Buffer);
      },
    ],
    [
      "a dir stream cut short",
      () => buildVbaProject({ modules: MODULES, editDir: (records) => records.slice(0, -4) }),
    ],
    [
      "a PROJECTMODULES count that does not match",
      () =>
        buildVbaProject({
          modules: MODULES,
          editDir: (records) => records.map((r) => (r.id === 0x000f ? { ...r, data: Uint8Array.of(3, 0) } : r)),
        }),
    ],
    [
      "a module without MODULENAMEUNICODE",
      () => buildVbaProject({ modules: MODULES, editDir: (records) => records.filter((r) => r.id !== 0x0047) }),
    ],
    [
      "a MODULEOFFSET past the end of its stream",
      () =>
        buildVbaProject({
          modules: MODULES,
          editDir: (records) => records.map((r) => (r.id === 0x0031 ? { ...r, data: u32(1_000_000) } : r)),
        }),
    ],
    [
      "a module source that is not a compressed container",
      () =>
        buildVbaProject({
          modules: MODULES,
          editDir: (records) => records.map((r) => (r.id === 0x0031 ? { ...r, data: u32(10) } : r)),
        }),
    ],
    [
      "a module listed twice",
      () =>
        buildVbaProject({
          modules: [MODULES[1], { ...MODULES[1], streamName: "modLong2" }],
        }),
    ],
  ])("returns null for %s, without throwing", (_, make) => {
    expect(readVbaModuleHashes(make())).toBeNull();
  });

  it("still reads a module whose stream holds only the compressed source (MODULEOFFSET 0)", () => {
    const bin = buildVbaProject({ modules: [{ name: "m", source: "Sub A()\r\nEnd Sub\r\n", pcodeLength: 0 }] });
    expect(readVbaModuleHashes(bin)).toEqual({ m: sha256(bytes("Sub A()\nEnd Sub")) });
  });

  it("hashes exactly the normalized source bytes", () => {
    const source = concat([bytes("Sub A()\r\n  x = \""), Uint8Array.of(0xe9), bytes("\" \r\nEnd Sub\r\n")]);
    const bin = buildVbaProject({ modules: [{ name: "m", source }] });
    expect(readVbaModuleHashes(bin)).toEqual({ m: sha256(concat([bytes('Sub A()\n  x = "'), Uint8Array.of(0xe9), bytes('"\nEnd Sub')])) });
  });
});
