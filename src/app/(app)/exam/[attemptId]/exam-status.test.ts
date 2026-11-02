import { describe, expect, it } from "vitest";
import { FINISH_HINT, POLL_MS, statusLine } from "./exam-status";

describe("Exam Status Line", () => {
  it("says Excel is open while the attempt is open", () => {
    expect(statusLine("open", "Practice 1")).toBe("Excel is open — Practice 1");
    expect(FINISH_HINT).toBe("Klik Finish di file kalau sudah selesai, ya.");
  });

  it("says the file arrived once it is received", () => {
    expect(statusLine("received", "Practice 1")).toBe("File received — grading…");
  });

  it("polls every 2 s (AD-11)", () => {
    expect(POLL_MS).toBe(2000);
  });
});
