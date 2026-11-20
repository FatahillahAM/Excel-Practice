import { defineLevelModule } from "@/core/content/level-module";
import { practice1 } from "./practice-1";
import { fondasiScenarioSchema, scenarios } from "./scenarios";
import { levelTest } from "./test";

/** Level 1 "Fondasi" (V1). Practice 1 and the Test (`L01-T`) so far; Practices 2–5 arrive with 5.2. */
export const fondasi = defineLevelModule({
  id: "01-fondasi",
  number: 1,
  name: "Fondasi",
  phase: "v1",
  contentVersion: 3,
  functions: ["$ references", "Excel Table (Ctrl+T)", "Sort & Filter"],
  hintQuota: 3,
  scenarios,
  scenarioSchema: fondasiScenarioSchema,
  items: [practice1, levelTest],
});
