import { describe, expect, it } from "vitest";
import { createRandom, isSeed, MAX_SEED } from "./random";

describe("createRandom (mulberry32)", () => {
  it("gives the reference sequence for seed 1", () => {
    const random = createRandom(1);
    // mulberry32(1): the published reference values; a change here changes every generated exam.
    expect([random.next(), random.next(), random.next(), random.next()]).toEqual([
      0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741,
    ]);
  });

  it("pins int, shuffle and pick", () => {
    const dice = createRandom(42);
    expect(Array.from({ length: 8 }, () => dice.int(1, 6))).toEqual([4, 3, 6, 5, 2, 4, 2, 4]);
    const other = createRandom(7);
    expect(other.shuffle([1, 2, 3, 4, 5, 6])).toEqual([5, 2, 3, 4, 6, 1]);
    expect(other.pick(["a", "b", "c"])).toBe("b");
    expect(createRandom(MAX_SEED).next()).toBe(0.8964226141106337);
  });

  it("repeats for the same seed and stays in range", () => {
    const a = createRandom(123456789);
    const b = createRandom(123456789);
    for (let i = 0; i < 1000; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    const r = createRandom(5);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const n = r.int(-2, 2);
      expect(Number.isInteger(n) && n >= -2 && n <= 2).toBe(true);
      seen.add(n);
    }
    expect([...seen].sort()).toEqual([-1, -2, 0, 1, 2]);
  });

  it("leaves the shuffled input as it is", () => {
    const input = [1, 2, 3];
    const out = createRandom(9).shuffle(input);
    expect(input).toEqual([1, 2, 3]);
    expect([...out].sort()).toEqual([1, 2, 3]);
  });

  it("refuses a seed that is not a uint32 and bad arguments", () => {
    for (const seed of [-1, 1.5, MAX_SEED + 1, Number.NaN]) {
      expect(isSeed(seed)).toBe(false);
      expect(() => createRandom(seed)).toThrow();
    }
    expect(isSeed(0) && isSeed(MAX_SEED)).toBe(true);
    expect(() => createRandom(1).int(3, 2)).toThrow();
    expect(() => createRandom(1).pick([])).toThrow();
  });
});
