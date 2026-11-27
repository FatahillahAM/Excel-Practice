import { describe, expect, it } from "vitest";
import { materiSegments, SHORTCUT_RE, type MateriCard } from "@/core/content/level-module";
import { logika } from "./index";
import { P1_MATERI } from "./practice-1";
import { P2_MATERI } from "./practice-2";
import { P3_MATERI } from "./practice-3";
import { P4_MATERI } from "./practice-4";
import { P5_MATERI } from "./practice-5";

/** Every text of a card, joined (title, concept, example, steps). */
const cardText = (card: MateriCard) => [card.title, card.concept, card.example.formula, card.example.note, ...card.steps].join("\n");
/** Uppercase, no spaces: how formulas are compared. */
const normalize = (text: string) => text.replace(/\s+/g, "").toUpperCase();

describe("L02 Materi (5.7)", () => {
  it("gives every Practice 2–4 cards and the Test none", () => {
    for (const item of logika.items) {
      if (item.kind === "test") expect(item.materi, item.id).toBeUndefined();
      else {
        expect(item.materi?.length, item.id).toBeGreaterThanOrEqual(2);
        expect(item.materi?.length, item.id).toBeLessThanOrEqual(4);
      }
    }
  });

  it("writes every inline key in Excel key names", () => {
    for (const item of logika.items) {
      for (const card of item.materi ?? []) {
        for (const segment of materiSegments(cardText(card))) {
          if (segment.kind === "key") expect(segment.value, card.id).toMatch(SHORTCUT_RE);
        }
      }
    }
  });

  // The questions' expected formulas and answer cells (see each practice's header); the Materi teaches the form on other cells.
  const ANSWER_CELLS = ["E2", "F2", "G2", "B2", "C2", "H2", "$O$"];
  it.each<[string, readonly MateriCard[], string[]]>([
    ["L02-P1", P1_MATERI, ['"Capai"', '"Kurang"', '"NG"', '"Cek mesin"', "E2-$O$2"]],
    ["L02-P2", P2_MATERI, ["AND(E2", "OR(F2", "AND(C2", "OR(B2", '"Lolos"', '"Prioritas"', '"Ambil"']],
    ["L02-P3", P3_MATERI, ['"A",IF(', '"Tinggi"', '"Sedang"', '"Rendah"', "),3,IF("]],
    ["L02-P4", P4_MATERI, ["E2/F2", "F2/G2", '"Tanpa Cacat"', '"Tanpa Downtime"']],
    ["L02-P5", P5_MATERI, ['"Lancar"', '"Terganggu"', "(E2-F2)", '"Tidak Ada"', 'H2="']],
  ])("does not give away the formulas or answer cells of %s", (_id, materi, answers) => {
    for (const card of materi) {
      for (const answer of [...answers, ...ANSWER_CELLS]) expect(normalize(cardText(card)), `${card.id}: ${answer}`).not.toContain(normalize(answer));
    }
  });
});
