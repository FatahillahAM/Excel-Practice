import { describe, expect, it } from "vitest";
import { outcomeOf, type Outcomes } from "./batches";
import { logika } from ".";
import { P1_OUTCOMES } from "./practice-1";
import { P2_OUTCOMES } from "./practice-2";
import { P3_OUTCOMES } from "./practice-3";
import { P4_OUTCOMES } from "./practice-4";
import { P5_OUTCOMES } from "./practice-5";
import { scenarios } from "./scenarios";
import { TEST_OUTCOMES } from "./test";

const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
const OUTCOMES: Record<string, Outcomes> = {
  "L02-P1": P1_OUTCOMES,
  "L02-P2": P2_OUTCOMES,
  "L02-P3": P3_OUTCOMES,
  "L02-P4": P4_OUTCOMES,
  "L02-P5": P5_OUTCOMES,
  "L02-T": TEST_OUTCOMES,
};

describe("L02 branch coverage: every outcome of every question in every exam", () => {
  it.each(logika.items.map((item) => [item.id, item] as const))("%s, seeds 1–300 × every scenario", (id, item) => {
    const outcomes = OUTCOMES[id];
    for (const scenario of scenarios) {
      for (const seed of SEEDS) {
        const { questions } = item.generate(seed, scenario);
        expect(questions).toHaveLength(outcomes.length);
        questions.forEach((question, i) => {
          const seen = new Set(Object.values(question.key).map(outcomeOf));
          for (const outcome of outcomes[i]) expect(seen.has(outcome), `${id} ${scenario.id} seed ${seed} Q${question.number}: ${String(outcome)}`).toBe(true);
        });
      }
    }
  }, 120_000);

  it("names L02-P5 Q1/Q2/Q4, L02-P3 Q1/Q3, L02-T Q2/Q3/Q4 and L02-P2 Q1/Q2/Q4 with all their branches", () => {
    expect(P5_OUTCOMES[1]).toEqual(["Tinggi", "Rendah", "Tidak Ada"]);
    expect(P3_OUTCOMES[0]).toEqual(["A", "B", "C"]);
    expect(P3_OUTCOMES[2]).toEqual([1, 2, 3]);
    expect(TEST_OUTCOMES[3]).toEqual(["A", "B", "C"]);
    expect(P2_OUTCOMES[3]).toEqual(["Ambil", "Tidak"]);
  });
});
