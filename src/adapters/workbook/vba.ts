import { createHash } from "node:crypto";
import CFB from "cfb";

/**
 * VBA source fingerprint (AD-4). `xl/vbaProject.bin` is an MS-CFB container;
 * its `VBA/dir` stream (MS-OVBA §2.3.4.2) lists the modules, and each module
 * stream holds a p-code cache followed, from MODULEOFFSET, by the module's
 * source compressed per MS-OVBA §2.4.1. Excel rewrites the container and the
 * p-code on every save (S2), so identity is the SHA-256 of each module's
 * normalized source, never the bytes of the part.
 *
 * Source is kept as bytes in the project's code page and never decoded as text.
 *
 * Accepted limit: the p-code cache before MODULEOFFSET is not covered. Excel may
 * run that cached p-code instead of the source, so tampered p-code with the
 * original source still matches; p-code changes on every save, so it cannot be pinned.
 */

/** Per module (keyed by MODULENAMEUNICODE), lowercase hex SHA-256 of its normalized source. */
export type VbaModuleHashes = Readonly<Record<string, string>>;

/** SHA-256 of an empty normalized source: a module with nothing but `Attribute VB_*` lines. */
export const EMPTY_MODULE_SHA256 = sha256Hex(new Uint8Array(0));

/**
 * Hash of each module's normalized source, or `null` when the bytes are not a
 * readable VBA project (not MS-CFB, no `VBA/dir`, a malformed record, a module
 * stream missing or not decompressible). Never throws.
 */
export function readVbaModuleHashes(vbaProjectBin: Uint8Array): VbaModuleHashes | null {
  const sources = readVbaModuleSources(vbaProjectBin);
  if (sources === null) return null;
  // `fromEntries` defines own properties, so a module named `__proto__` is just a key.
  return Object.freeze(
    Object.fromEntries([...sources].map(([name, source]) => [name, sha256Hex(normalizeVbaSource(source))])),
  );
}

/**
 * Decompressed source of each module (from its MODULEOFFSET, `Attribute` lines
 * included, not normalized), keyed by MODULENAMEUNICODE; `null` when unreadable.
 */
export function readVbaModuleSources(vbaProjectBin: Uint8Array): Map<string, Uint8Array> | null {
  try {
    // `cfb` would also accept a zip or MIME container; only MS-CFB is a VBA project.
    if (!startsWith(vbaProjectBin, CFB_SIGNATURE)) return null;
    const container = CFB.parse(Buffer.from(vbaProjectBin));
    const dir = findStream(container, "dir");
    if (dir === null) return null;
    // One budget for the whole project: modules may alias one small stream that expands a lot.
    let budget = MAX_DECOMPRESSED_BYTES;
    const dirBytes = decompressVbaContainer(dir, budget);
    budget -= dirBytes.length;
    const modules = parseDirStream(dirBytes);
    const sources = new Map<string, Uint8Array>();
    for (const entry of modules) {
      const stream = findStream(container, entry.streamName);
      if (stream === null || entry.textOffset > stream.length) return null;
      const source = decompressVbaContainer(stream.subarray(entry.textOffset), budget);
      budget -= source.length;
      sources.set(entry.name, source);
    }
    return sources;
  } catch {
    return null;
  }
}

/**
 * Normalized source per AD-4, on bytes: CRLF and lone CR become LF; lines that
 * start with `Attribute VB_` are dropped; trailing spaces and tabs are
 * stripped; trailing empty lines are dropped; lines are joined with LF and no
 * final LF.
 */
export function normalizeVbaSource(source: Uint8Array): Uint8Array {
  const lines: Uint8Array[] = [];
  let start = 0;
  for (let i = 0; i <= source.length; i++) {
    const byte = i < source.length ? source[i] : LF;
    if (byte !== LF && byte !== CR) continue;
    const line = source.subarray(start, i);
    if (!startsWith(line, ATTRIBUTE_VB)) lines.push(trimEnd(line));
    // CRLF is one line break; a lone CR or LF is one too.
    if (byte === CR && source[i + 1] === LF) i += 1;
    start = i + 1;
  }
  // A source ending in a line break has no line after it: the loop's last
  // (empty) line is the one the break ended, dropped below with other trailing empties.
  while (lines.length > 0 && lines[lines.length - 1].length === 0) lines.pop();

  const out = new Uint8Array(lines.reduce((size, line) => size + line.length, 0) + Math.max(lines.length - 1, 0));
  let at = 0;
  for (const [index, line] of lines.entries()) {
    if (index > 0) out[at++] = LF;
    out.set(line, at);
    at += line.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// MS-OVBA §2.4.1 decompression

const CHUNK_SIZE = 4096;

/**
 * Upper bound on the bytes decompressed for one project (`dir` and every module
 * stream together). Six compressed bytes can expand to a 4096-byte chunk, so an
 * uploaded file could otherwise exhaust memory; VBA source anywhere near this
 * size is not a workbook from this app.
 */
export const MAX_DECOMPRESSED_BYTES = 16 * 1024 * 1024;

/** Decompresses a CompressedContainer (MS-OVBA §2.4.1.1.1); throws when it is malformed or too large. */
export function decompressVbaContainer(data: Uint8Array, maxBytes = MAX_DECOMPRESSED_BYTES): Uint8Array {
  if (data.length === 0 || data[0] !== 0x01) throw new Error("VBA compressed container: signature byte is not 0x01");
  let out = new Uint8Array(Math.min(Math.max(data.length * 2, CHUNK_SIZE), maxBytes));
  let size = 0;
  const reserve = (bytes: number) => {
    if (size + bytes > maxBytes) throw new Error(`VBA compressed container: more than ${maxBytes} bytes decompressed`);
    if (size + bytes <= out.length) return;
    const grown = new Uint8Array(Math.min(Math.max(out.length * 2, size + bytes), maxBytes));
    grown.set(out.subarray(0, size));
    out = grown;
  };

  let at = 1;
  while (at < data.length) {
    if (at + 2 > data.length) throw new Error("VBA compressed container: truncated chunk header");
    const header = data[at] | (data[at + 1] << 8);
    if (((header >> 12) & 0b111) !== 0b011) throw new Error("VBA compressed container: bad chunk signature");
    const chunkEnd = at + (header & 0x0fff) + 3;
    if (chunkEnd > data.length) throw new Error("VBA compressed container: truncated chunk");
    const compressed = (header & 0x8000) !== 0;
    at += 2;
    const chunkStart = size;
    // A chunk never decompresses to more than 4096 bytes.
    reserve(CHUNK_SIZE);
    if (!compressed) {
      // A raw chunk always holds exactly 4096 bytes (CompressedChunkSize 4095).
      if (chunkEnd - at !== CHUNK_SIZE) throw new Error("VBA compressed container: raw chunk is not 4096 bytes");
      out.set(data.subarray(at, chunkEnd), size);
      size += CHUNK_SIZE;
      at = chunkEnd;
      continue;
    }
    while (at < chunkEnd) {
      const flags = data[at++];
      for (let bit = 0; bit < 8 && at < chunkEnd; bit++) {
        const difference = size - chunkStart;
        if ((flags & (1 << bit)) === 0) {
          if (difference + 1 > CHUNK_SIZE) throw new Error("VBA compressed container: chunk holds more than 4096 bytes");
          out[size++] = data[at++];
          continue;
        }
        if (at + 2 > chunkEnd) throw new Error("VBA compressed container: truncated copy token");
        const token = data[at] | (data[at + 1] << 8);
        at += 2;
        // CopyToken help (§2.4.1.3.19.1): the offset takes bitCount bits, enough to reach the chunk start.
        let bitCount = 4;
        while (1 << bitCount < difference) bitCount++;
        const length = (token & (0xffff >> bitCount)) + 3;
        const offset = (token >> (16 - bitCount)) + 1;
        if (offset > difference) throw new Error("VBA compressed container: copy token reaches before its chunk");
        if (difference + length > CHUNK_SIZE) throw new Error("VBA compressed container: chunk holds more than 4096 bytes");
        // Byte by byte: source and destination may overlap.
        for (let i = 0; i < length; i++, size++) out[size] = out[size - offset];
      }
    }
  }
  return out.slice(0, size);
}

// ---------------------------------------------------------------------------
// MS-OVBA §2.3.4.2 dir stream

interface ModuleEntry {
  name: string;
  streamName: string;
  textOffset: number;
}

const DIR = {
  PROJECTVERSION: 0x0009,
  PROJECTMODULES: 0x000f,
  TERMINATOR: 0x0010,
  MODULENAME: 0x0019,
  MODULENAMEUNICODE: 0x0047,
  MODULESTREAMNAME: 0x001a,
  MODULESTREAMNAMEUNICODE: 0x0032,
  MODULEOFFSET: 0x0031,
  MODULETERMINATOR: 0x002b,
} as const;

/** The modules listed in a decompressed `dir` stream; throws when a record is malformed or missing. */
function parseDirStream(dir: Uint8Array): ModuleEntry[] {
  const view = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
  const modules: ModuleEntry[] = [];
  const names = new Set<string>();
  let declaredCount: number | null = null;
  let current: Partial<ModuleEntry> | null = null;
  let at = 0;
  for (;;) {
    if (at + 6 > dir.length) throw new Error("VBA dir stream: truncated record");
    const id = view.getUint16(at, true);
    // PROJECTVERSION's "Size" is a reserved 4 followed by 6 bytes of version (MS-OVBA §2.3.4.2.1.11).
    const size = id === DIR.PROJECTVERSION ? 6 : view.getUint32(at + 2, true);
    const dataStart = at + 6;
    const dataEnd = dataStart + size;
    if (dataEnd > dir.length) throw new Error(`VBA dir stream: record 0x${id.toString(16)} runs past the end`);
    const data = dir.subarray(dataStart, dataEnd);
    at = dataEnd;

    if (id === DIR.TERMINATOR) break;
    switch (id) {
      case DIR.PROJECTMODULES:
        if (size !== 2) throw new Error("VBA dir stream: PROJECTMODULES size is not 2");
        declaredCount = view.getUint16(dataStart, true);
        break;
      case DIR.MODULENAME:
        if (current !== null) throw new Error("VBA dir stream: module without terminator");
        current = {};
        break;
      case DIR.MODULENAMEUNICODE:
        if (current === null) throw new Error("VBA dir stream: MODULENAMEUNICODE outside a module");
        current.name = utf16le(data);
        break;
      case DIR.MODULESTREAMNAMEUNICODE:
        if (current === null) throw new Error("VBA dir stream: MODULESTREAMNAME outside a module");
        current.streamName = utf16le(data);
        break;
      case DIR.MODULEOFFSET:
        if (current === null || size !== 4) throw new Error("VBA dir stream: bad MODULEOFFSET");
        current.textOffset = view.getUint32(dataStart, true);
        break;
      case DIR.MODULETERMINATOR: {
        if (current === null) throw new Error("VBA dir stream: module terminator outside a module");
        const { name, streamName, textOffset } = current;
        if (name === undefined || streamName === undefined || textOffset === undefined) {
          throw new Error("VBA dir stream: module lacks MODULENAMEUNICODE, MODULESTREAMNAME or MODULEOFFSET");
        }
        if (names.has(name)) throw new Error(`VBA dir stream: module "${name}" listed twice`);
        names.add(name);
        modules.push({ name, streamName, textOffset });
        current = null;
        break;
      }
      default:
        break;
    }
  }
  if (current !== null) throw new Error("VBA dir stream: module without terminator");
  if (declaredCount === null || declaredCount !== modules.length) {
    throw new Error("VBA dir stream: PROJECTMODULES count does not match the modules listed");
  }
  return modules;
}

// ---------------------------------------------------------------------------
// MS-CFB

/** Bytes of the stream `name` in the top-level `VBA` storage (names compare case-insensitively, MS-CFB §2.6.4). */
function findStream(container: CFB.CFB$Container, name: string): Uint8Array | null {
  const wanted = ["VBA", name].map((part) => part.toUpperCase());
  for (const [index, fullPath] of container.FullPaths.entries()) {
    const entry = container.FileIndex[index];
    if (entry.type !== 2) continue; // 2 = stream
    // FullPaths are "<root>/<storage>/<stream>" with no trailing slash for a stream.
    const parts = fullPath.split("/").slice(1);
    if (parts.length === wanted.length && parts.every((part, i) => part.toUpperCase() === wanted[i])) {
      const content = entry.content;
      return content instanceof Uint8Array ? content : Uint8Array.from(content);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------

const CFB_SIGNATURE = Uint8Array.of(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const LF = 0x0a;
const CR = 0x0d;
const SPACE = 0x20;
const TAB = 0x09;
const ATTRIBUTE_VB = new TextEncoder().encode("Attribute VB_");

function startsWith(line: Uint8Array, prefix: Uint8Array): boolean {
  if (line.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (line[i] !== prefix[i]) return false;
  return true;
}

function trimEnd(line: Uint8Array): Uint8Array {
  let end = line.length;
  while (end > 0 && (line[end - 1] === SPACE || line[end - 1] === TAB)) end--;
  return line.subarray(0, end);
}

function utf16le(bytes: Uint8Array): string {
  if (bytes.length % 2 !== 0) throw new Error("VBA dir stream: odd-length UTF-16 name");
  return new TextDecoder("utf-16le", { fatal: true }).decode(bytes);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
