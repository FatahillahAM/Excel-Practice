import { defineLevelModule } from "@/core/content/level-module";
import { practice1 } from "./practice-1";
import { fondasiScenarioSchema, scenarios } from "./scenarios";

/** Level 1 "Fondasi" (V1). Practice 1 so far; Practices 2–5 and the Test arrive with epic 5. */
export const fondasi = defineLevelModule({
  id: "01-fondasi",
  number: 1,
  name: "Fondasi",
  phase: "v1",
  contentVersion: 2,
  functions: ["$ references", "Excel Table (Ctrl+T)", "Sort & Filter"],
  hintQuota: 3,
  scenarios,
  scenarioSchema: fondasiScenarioSchema,
  items: [practice1],
});
