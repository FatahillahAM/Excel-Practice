import { KEY_TOLERANCE } from "../checks";
import { defineLevelModule, scenarioSchema, type GeneratedExam, type LevelItem, type LevelModule, type LevelPhase, type Scenario } from "../level-module";

/**
 * Fixture `LevelModule`s for gate tests (4.3): Levels 1–4 (V1) with five
 * practices and a Test each, valid against `defineLevelModule`, so the gate
 * rules are proved before the real Test content lands (epic 5). Each item
 * generates one 100-point question: Data!B2 × 2 into Data!C2.
 */

const SCENARIOS: Scenario[] = Array.from({ length: 10 }, (_, i) => ({
  id: `fixture-${i + 1}`,
  title: `Skenario ${i + 1}`,
  story: `Cerita skenario ${i + 1}.`,
}));

function fixtureItem(level: number, kind: "practice" | "test", number: number): LevelItem {
  const pad = String(level).padStart(2, "0");
  const id = kind === "practice" ? `L${pad}-P${number}` : `L${pad}-T`;
  return {
    id,
    kind,
    number,
    generate(seed: number, scenario: Scenario): GeneratedExam {
      const value = (seed % 97) + 1;
      const prompt = 'Isi "Hasil" dengan "Nilai" dikali 2.';
      return {
        cells: {
          Instructions: { B2: `Level ${level} · ${id} — ${scenario.title}`, B4: scenario.story, B6: `1. ${prompt}` },
          Data: { A1: "Nilai", B1: "Hasil", B2: value },
        },
        questions: [
          {
            number: 1,
            prompt,
            points: 100,
            sheet: "Data",
            range: "C2:C2",
            checks: [{ name: "formula_present" }, { name: "value_equals_key", tolerance: KEY_TOLERANCE }],
            key: { C2: value * 2 },
            hints: ["Kalikan dengan 2."],
            tip: { id: "fixture-tip", title: "Tip fixture", body: "Isi Tip fixture.", shortcuts: ["Ctrl+D"] },
          },
        ],
      };
    },
  };
}

/** One fixture level: practices 1…`practices`, plus the Test when `test`. */
export function fixtureLevel(number: number, { phase = "v1", practices = 5, test = true }: { phase?: LevelPhase; practices?: number; test?: boolean } = {}): LevelModule {
  const items = Array.from({ length: practices }, (_, i) => fixtureItem(number, "practice", i + 1));
  if (test) items.push(fixtureItem(number, "test", 6));
  return defineLevelModule({
    id: `${String(number).padStart(2, "0")}-fixture`,
    number,
    name: `Fixture ${number}`,
    phase,
    contentVersion: 1,
    functions: ["SUM"],
    hintQuota: 3,
    scenarios: SCENARIOS,
    scenarioSchema,
    items,
  });
}

/** Levels 1–4, complete: every gate of V1. */
export const FIXTURE_LEVELS: readonly LevelModule[] = [1, 2, 3, 4].map((number) => fixtureLevel(number));
