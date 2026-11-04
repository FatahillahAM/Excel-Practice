import { defineLevelModule } from "../../../core/content/level-module";
import { practice1 } from "./practice-1";

/** Level 1 "Fondasi" (V1). Tracer: Practice 1 only; entry 8 adds the rest of the items. */
export const fondasi = defineLevelModule({
  id: "01-fondasi",
  number: 1,
  name: "Fondasi",
  phase: "v1",
  functions: ["$ references", "Excel Table (Ctrl+T)", "Sort & Filter"],
  hintQuota: 3,
  items: [practice1],
});
