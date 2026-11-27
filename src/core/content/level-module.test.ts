import { describe, expect, it } from "vitest";
import { itemFromId, kindFromItemId, materiCardSchema, materiSegments } from "./level-module";

describe("kindFromItemId / itemFromId", () => {
  it("derives the kind from the id alone", () => {
    expect(kindFromItemId("L01-T")).toBe("test");
    expect(kindFromItemId("L09-T")).toBe("test");
    expect(kindFromItemId("L01-P1")).toBe("practice");
    expect(kindFromItemId("L03-P5")).toBe("practice");
  });

  it("returns null for any other id", () => {
    for (const id of ["UA", "L01-P6", "L1-T", "l01-t", "L01-T ", "", "L01-P0"]) expect(kindFromItemId(id), id).toBeNull();
  });

  it("gives the Test number 6 and a practice its own number", () => {
    expect(itemFromId("L03-T")).toEqual({ kind: "test", number: 6 });
    expect(itemFromId("L02-P4")).toEqual({ kind: "practice", number: 4 });
  });
});

describe("materiSegments", () => {
  it("splits code and keys out of the text, in order", () => {
    expect(materiSegments("Ketik `=A2*2` lalu [[Enter]].")).toEqual([
      { kind: "text", value: "Ketik " },
      { kind: "code", value: "=A2*2" },
      { kind: "text", value: " lalu " },
      { kind: "key", value: "Enter" },
      { kind: "text", value: "." },
    ]);
  });

  it("keeps unmarked text whole", () => {
    expect(materiSegments("Tanpa markup.")).toEqual([{ kind: "text", value: "Tanpa markup." }]);
  });
});

describe("materiSegments edge cases", () => {
  it("returns nothing for an empty string", () => {
    expect(materiSegments("")).toEqual([]);
  });

  it("keeps [[…]] inside code as code", () => {
    expect(materiSegments("`[[x]]`")).toEqual([{ kind: "code", value: "[[x]]" }]);
  });
});

describe("materiCardSchema text checks", () => {
  const card = {
    id: "kartu",
    title: "Judul",
    concept: "Konsep.",
    example: { formula: "=A1", note: "catatan" },
    steps: ["Tekan [[Enter]]."],
    shortcuts: [],
  };
  const withStep = (step: string) => materiCardSchema.safeParse({ ...card, steps: [step] });
  const messages = (step: string) => {
    const parsed = withStep(step);
    return parsed.success ? "" : parsed.error.issues.map((issue) => issue.message).join("\n");
  };

  it("accepts a valid card", () => {
    expect(materiCardSchema.safeParse(card).success).toBe(true);
  });

  it("rejects an unclosed [[", () => {
    expect(messages("Tekan [[Enter lalu lanjut.")).toMatch(/Unclosed \[\[/);
  });

  it("rejects [[Ctrl+]]] (no key after +)", () => {
    expect(messages("Tekan [[Ctrl+]]].")).toMatch(/Key \[\[Ctrl\+\]\]/);
  });

  it("rejects an empty string and an empty code span", () => {
    expect(withStep("").success).toBe(false);
    expect(messages("Ketik `` lalu Enter.")).toMatch(/Empty code span/);
  });

  it("does not check a key inside code", () => {
    expect(withStep("Ketik `[[bukan kunci]]` apa adanya.").success).toBe(true);
  });

  it("needs an example formula of at least 2 characters", () => {
    expect(materiCardSchema.safeParse({ ...card, example: { formula: "=", note: "x" } }).success).toBe(false);
  });
});
