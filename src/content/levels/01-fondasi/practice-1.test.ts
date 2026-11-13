import { describe, expect, it } from "vitest";
import { practice1, TIPS } from "./practice-1";
import { scenarios } from "./scenarios";

const SEEDS = [1, 2, 3, 4, 5];
const TIP_IDS = ["l01-isi-rumus-sekaligus", "l01-kunci-sel-f4", "l01-format-persen", "l01-referensi-campuran"];

/** Uppercase, no spaces, no leading `=`: how a formula is compared inside hint text. */
const normalize = (text: string) => text.replace(/\s+/g, "").toUpperCase();

/** The whole answer formulas (top cell) of an exam whose data ends at row `last`. */
const answerFormulas = (last: number) =>
  ["E2*G2", "G2*E2", "E2*$L$2", "$L$2*E2", `E2/SUM($E$2:$E$${last})`, `SUM($E$2:$E$${last})`, "$N2*(1+O$1)", "(1+O$1)*$N2"].map(normalize);

describe("L01-P1 hints and Tips", () => {
  it("gives every question 3 hints and its own Tip, the four expected ids in order", () => {
    for (const scenario of scenarios) {
      for (const seed of SEEDS) {
        const { questions } = practice1.generate(seed, scenario);
        expect(questions.map((q) => q.hints.length), `${scenario.id} seed ${seed}`).toEqual([3, 3, 3, 3]);
        expect(questions.map((q) => q.tip.id)).toEqual(TIP_IDS);
        for (const question of questions) {
          for (const hint of question.hints) expect(hint.trim()).not.toBe("");
          expect(question.tip.shortcuts.length, question.tip.id).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it("names the exam's own ranges in the hints", () => {
    const { questions } = practice1.generate(7, scenarios[0]);
    const last = Number(/H2:H(\d+)/.exec(questions[0].range)![1]);
    const gridLast = Number(/O2:R(\d+)/.exec(questions[3].range)![1]);
    expect(questions[0].hints[2]).toContain(`H2:H${last}`);
    expect(questions[2].hints[2]).toContain(`E2:E${last}`);
    expect(questions[3].hints[0]).toContain(`O2:R${gridLast}`);
  });

  it("never gives away the answer formula or a key value", () => {
    for (const scenario of scenarios) {
      for (const seed of SEEDS) {
        const { questions } = practice1.generate(seed, scenario);
        const last = Number(/H2:H(\d+)/.exec(questions[0].range)![1]);
        const formulas = answerFormulas(last);
        for (const question of questions) {
          for (const hint of question.hints) {
            const text = normalize(hint);
            for (const formula of formulas) expect(text, `${scenario.id} seed ${seed} Q${question.number}: ${formula}`).not.toContain(formula);
            for (const value of Object.values(question.key)) {
              const forms = typeof value === "number" ? [String(value), value.toFixed(2)] : [value];
              for (const form of forms) expect(hint, `${scenario.id} seed ${seed} Q${question.number}: key ${form}`).not.toContain(form);
            }
          }
        }
      }
    }
  });

  it("keeps each Tip identical across seeds and scenarios (one id, one card)", () => {
    const tips = Object.values(TIPS);
    for (const scenario of scenarios) {
      for (const seed of SEEDS) {
        practice1.generate(seed, scenario).questions.forEach((question, i) => expect(question.tip).toEqual(tips[i]));
      }
    }
  });
});
