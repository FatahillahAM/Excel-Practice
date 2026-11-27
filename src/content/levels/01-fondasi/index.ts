import { defineLevelModule } from "@/core/content/level-module";
import { practice1 } from "./practice-1";
import { practice2 } from "./practice-2";
import { practice3 } from "./practice-3";
import { practice4 } from "./practice-4";
import { practice5 } from "./practice-5";
import { fondasiScenarioSchema, scenarios } from "./scenarios";
import { levelTest } from "./test";

/**
 * Level 1 "Fondasi" (V1): Practices 1–5 (`$` references, Excel Table, Sort and
 * Filter through formulas, mixed references) and the Test (`L01-T`).
 * contentVersion 4 (5.2): P2–P5 added, the Test re-laid out with its Table question.
 * contentVersion 5 (5.7): Materi cards on P1–P5.
 */
export const fondasi = defineLevelModule({
  id: "01-fondasi",
  number: 1,
  name: "Fondasi",
  phase: "v1",
  contentVersion: 5,
  functions: ["$ references", "Excel Table (Ctrl+T)", "Sort & Filter"],
  hintQuota: 3,
  scenarios,
  scenarioSchema: fondasiScenarioSchema,
  items: [practice1, practice2, practice3, practice4, practice5, levelTest],
});
