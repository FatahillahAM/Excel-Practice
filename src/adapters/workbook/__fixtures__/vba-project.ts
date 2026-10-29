import CFB from "cfb";

/**
 * Test builders for `xl/vbaProject.bin` (MS-OVBA): an MS-OVBA compressor, a
 * `dir` stream writer and an MS-CFB container written by `cfb`. Only tests use
 * these; the adapter only reads.
 */

const CHUNK_SIZE = 4096;

/**
 * MS-OVBA §2.4.1.3.7 compression with a greedy longest match. `rawChunks` lists
 * the indexes of 4096-byte chunks to store uncompressed (flag 0), as a writer may.
 */
export function compressVba(data: Uint8Array, rawChunks: readonly number[] = []): Uint8Array {
  const out: number[] = [0x01];
  for (let chunkIndex = 0, start = 0; start < data.length; chunkIndex++, start += CHUNK_SIZE) {
    const chunk = data.subarray(start, start + CHUNK_SIZE);
    if (rawChunks.includes(chunkIndex)) {
      if (chunk.length !== CHUNK_SIZE) throw new Error("only a full 4096-byte chunk can be stored raw");
      out.push(0xff, 0x3f, ...chunk); // size 4095, signature 0b011, flag 0
      continue;
    }
    const body = compressChunk(chunk);
    // The 12-bit size field holds at most 4098 bytes per chunk; incompressible data needs `rawChunks`.
    if (body.length > CHUNK_SIZE) {
      throw new Error(`chunk ${chunkIndex} compresses to ${body.length} bytes (> 4096): store it raw with rawChunks`);
    }
    const header = 0x8000 | 0x3000 | (body.length + 2 - 3);
    out.push(header & 0xff, header >> 8, ...body);
  }
  return Uint8Array.from(out);
}

function compressChunk(chunk: Uint8Array): number[] {
  const out: number[] = [];
  let at = 0;
  while (at < chunk.length) {
    const flagIndex = out.length;
    out.push(0);
    for (let bit = 0; bit < 8 && at < chunk.length; bit++) {
      // The offset takes bitCount bits (enough to reach the chunk start), the length the rest.
      let bitCount = 4;
      while (1 << bitCount < at) bitCount++;
      const maxLength = (0xffff >> bitCount) + 3;
      const maxOffset = at;
      let bestLength = 0;
      let bestOffset = 0;
      for (let offset = 1; offset <= maxOffset; offset++) {
        let length = 0;
        while (length < maxLength && at + length < chunk.length && chunk[at + length - offset] === chunk[at + length]) {
          length++;
        }
        if (length > bestLength) {
          bestLength = length;
          bestOffset = offset;
        }
      }
      if (bestLength >= 3) {
        const token = ((bestOffset - 1) << (16 - bitCount)) | (bestLength - 3);
        out[flagIndex] |= 1 << bit;
        out.push(token & 0xff, token >> 8);
        at += bestLength;
      } else {
        out.push(chunk[at]);
        at += 1;
      }
    }
  }
  return out;
}

export interface ModuleSpec {
  /** MODULENAMEUNICODE (and MODULENAME, as ASCII). */
  name: string;
  /** Decompressed source, `Attribute` lines included. */
  source: Uint8Array | string;
  /** Stream name in the `VBA` storage; defaults to `name`. */
  streamName?: string;
  /** Bytes of stand-in p-code before the source (MODULEOFFSET); defaults to 64. */
  pcodeLength?: number;
  /** Fill byte of the p-code, so two otherwise equal projects differ in bytes. */
  pcodeFill?: number;
  /** Indexes of 4096-byte source chunks to store uncompressed (see `compressVba`). */
  rawChunks?: readonly number[];
  /** Document module (MODULETYPE 0x0022) instead of a standard module (0x0021). */
  document?: boolean;
}

export interface ProjectSpec {
  modules: readonly ModuleSpec[];
  /** Replaces the decompressed `dir` stream before compression. */
  editDir?: (records: DirRecord[]) => DirRecord[];
  /** Streams to leave out of the container (`dir`, a module's stream name). */
  omitStreams?: readonly string[];
}

export interface DirRecord {
  id: number;
  data: Uint8Array;
}

/** An `xl/vbaProject.bin` holding `modules`, written by the `cfb` package. */
export function buildVbaProject(spec: ProjectSpec): Uint8Array {
  let records = dirRecords(spec.modules);
  if (spec.editDir !== undefined) records = spec.editDir(records);

  const container = CFB.utils.cfb_new();
  const omit = new Set(spec.omitStreams ?? []);
  const add = (name: string, content: Uint8Array) => {
    if (!omit.has(name)) CFB.utils.cfb_add(container, `/VBA/${name}`, Buffer.from(content));
  };
  add("dir", compressVba(encodeDir(records)));
  for (const entry of spec.modules) {
    const pcode = new Uint8Array(entry.pcodeLength ?? 64).fill(entry.pcodeFill ?? 0xcc);
    add(entry.streamName ?? entry.name, concat([pcode, compressVba(bytes(entry.source), entry.rawChunks)]));
  }
  CFB.utils.cfb_add(container, "/PROJECT", Buffer.from('ID="{00000000-0000-0000-0000-000000000000}"\r\n'));
  return new Uint8Array(CFB.write(container, { type: "buffer" }) as Buffer);
}

/** The `dir` records (MS-OVBA §2.3.4.2) Excel writes for a project with `modules`, no references. */
export function dirRecords(modules: readonly ModuleSpec[]): DirRecord[] {
  const records: DirRecord[] = [
    rec(0x0001, u32(1)), // PROJECTSYSKIND: Win32
    rec(0x004a, u32(0x61)), // PROJECTCOMPATVERSION
    rec(0x0002, u32(0x409)), // PROJECTLCID
    rec(0x0014, u32(0x409)), // PROJECTLCIDINVOKE
    rec(0x0003, u16(1252)), // PROJECTCODEPAGE
    rec(0x0004, ascii("VBAProject")), // PROJECTNAME
    rec(0x0005, new Uint8Array(0)), // PROJECTDOCSTRING
    rec(0x0040, new Uint8Array(0)),
    rec(0x0006, new Uint8Array(0)), // PROJECTHELPFILEPATH
    rec(0x003d, new Uint8Array(0)),
    rec(0x0007, u32(0)), // PROJECTHELPCONTEXT
    rec(0x0008, u32(0)), // PROJECTLIBFLAGS
    rec(0x0009, concat([u32(0x5b1c7c2a), u16(0x0014)])), // PROJECTVERSION (written with Reserved = 4)
    rec(0x000c, new Uint8Array(0)), // PROJECTCONSTANTS
    rec(0x003c, new Uint8Array(0)),
    rec(0x000f, u16(modules.length)), // PROJECTMODULES
    rec(0x0013, u16(0xffff)), // PROJECTCOOKIE
  ];
  for (const entry of modules) {
    const streamName = entry.streamName ?? entry.name;
    records.push(
      rec(0x0019, ascii(entry.name)), // MODULENAME
      rec(0x0047, utf16le(entry.name)), // MODULENAMEUNICODE
      rec(0x001a, ascii(streamName)), // MODULESTREAMNAME
      rec(0x0032, utf16le(streamName)),
      rec(0x001c, new Uint8Array(0)), // MODULEDOCSTRING
      rec(0x0048, new Uint8Array(0)),
      rec(0x0031, u32(entry.pcodeLength ?? 64)), // MODULEOFFSET
      rec(0x001e, u32(0)), // MODULEHELPCONTEXT
      rec(0x002c, u16(0xffff)), // MODULECOOKIE
      rec(entry.document === true ? 0x0022 : 0x0021, new Uint8Array(0)), // MODULETYPE
      rec(0x002b, new Uint8Array(0)), // MODULE terminator
    );
  }
  records.push(rec(0x0010, new Uint8Array(0))); // dir terminator
  return records;
}

export function encodeDir(records: readonly DirRecord[]): Uint8Array {
  return concat(
    records.map(({ id, data }) =>
      // PROJECTVERSION stores Reserved = 4 where other records store their size; 6 bytes follow.
      concat([u16(id), id === 0x0009 ? u32(4) : u32(data.length), data]),
    ),
  );
}

function rec(id: number, data: Uint8Array): DirRecord {
  return { id, data };
}

export function bytes(value: Uint8Array | string): Uint8Array {
  return typeof value === "string" ? Uint8Array.from(Buffer.from(value, "latin1")) : value;
}

function ascii(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "latin1"));
}

function utf16le(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "utf16le"));
}

function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >> 8) & 0xff);
}

export function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

export function concat(parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
