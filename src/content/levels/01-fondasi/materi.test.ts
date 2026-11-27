import { describe, expect, it } from "vitest";
import { materiSegments, SHORTCUT_RE } from "@/core/content/level-module";
import { fondasi } from "./index";
import { MATERI } from "./practice-1";
import { P2_MATERI } from "./practice-2";
import { P3_MATERI } from "./practice-3";
import { P4_MATERI } from "./practice-4";
import { P5_MATERI } from "./practice-5";

/** Every text of a card, joined (title, concept, example, steps). */
const cardText = (card: (typeof P2_MATERI)[number]) =>
  [card.title, card.concept, card.example.formula, card.example.note, ...card.steps].join("\n");

describe("L01 Materi (5.7)", () => {
  it("gives every Practice 2–4 cards and the Test none", () => {
    for (const item of fondasi.items) {
      if (item.kind === "test") expect(item.materi, item.id).toBeUndefined();
      else {
        expect(item.materi?.length, item.id).toBeGreaterThanOrEqual(2);
        expect(item.materi?.length, item.id).toBeLessThanOrEqual(4);
      }
    }
  });

  it("writes every inline key in Excel key names", () => {
    for (const item of fondasi.items) {
      for (const card of item.materi ?? []) {
        for (const segment of materiSegments(cardText(card))) {
          if (segment.kind === "key") expect(segment.value, card.id).toMatch(SHORTCUT_RE);
        }
      }
    }
  });

  // The questions' expected formulas (see each practice's header); the Materi teaches the form on other cells.
  it.each<[string, readonly (typeof P2_MATERI)[number][], string[]]>([
    ["L01-P1", MATERI, ["E2*G2", "E2*$L$2", "$N2*(1+O$1)", "/SUM($E$2"]],
    ["L01-P2", P2_MATERI, ["Table1[Unit Diproduksi]", "Table1[Unit Cacat]", "Table1[Kode Batch]"]],
    ["L01-P3", P3_MATERI, ["=SORT(E2:E", "=SORTBY(A2:A", "=SORT(A2:G"]],
    ["L01-P4", P4_MATERI, ["B2:B", "E2:E", "N2", "N3"]],
    ["L01-P5", P5_MATERI, ["$B2*C$1", "$B2", "C$1", "/MAX(C$", "MAX(C$2", "$N$2:N2", "SUM($N$2"]],
  ])("does not give away the formulas of %s", (_id, materi, answers) => {
    for (const card of materi) {
      for (const answer of answers) expect(cardText(card), card.id).not.toContain(answer);
    }
  });
});
