import { describe, expect, it } from "vitest";
import { REJECTION_CODES, RejectionCode } from "./rejection-codes";

describe("RejectionCode (AD-6)", () => {
  it("has exactly the five AD-6 codes", () => {
    expect([...REJECTION_CODES].sort()).toEqual(
      ["ALREADY_GRADED", "ATTEMPT_CLOSED", "IDENTITY_ALTERED", "NOT_EXCEL", "NOT_THIS_ATTEMPT"],
    );
  });

  it("uses each code's name as its value", () => {
    for (const [name, value] of Object.entries(RejectionCode)) {
      expect(value).toBe(name);
    }
  });
});
