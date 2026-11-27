import { defineLevelModule } from "@/core/content/level-module";
import { practice1 } from "./practice-1";
import { practice2 } from "./practice-2";
import { practice3 } from "./practice-3";
import { practice4 } from "./practice-4";
import { practice5 } from "./practice-5";
import { logikaScenarioSchema, scenarios } from "./scenarios";
import { levelTest } from "./test";

/**
 * Level 2 "Logika" (V1): Practices 1–5 (IF, AND/OR, nested IF and IFS,
 * IFERROR, mixed) with their Materi, and the Test (`L02-T`). Hint quota 2
 * (epic decision: L1–L4 = 3/2/1/0).
 * contentVersion 1 (5.3): first release.
 */
export const logika = defineLevelModule({
  id: "02-logika",
  number: 2,
  name: "Logika",
  phase: "v1",
  contentVersion: 1,
  functions: ["IF", "IFS", "AND", "OR", "IFERROR"],
  hintQuota: 2,
  scenarios,
  scenarioSchema: logikaScenarioSchema,
  items: [practice1, practice2, practice3, practice4, practice5, levelTest],
});
