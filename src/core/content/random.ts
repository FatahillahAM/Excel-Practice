/**
 * The seeded PRNG of content generation (AD-2, CAP-6): mulberry32 over a
 * uint32 seed. `generate(seed, scenario)` draws every random choice from one
 * `Random`, never from `Math.random`, the clock or IO, so the same seed and
 * scenario give the same exam byte for byte.
 */

export interface Random {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** One element of a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** A shuffled copy (Fisher–Yates); the input is left as it is. */
  shuffle<T>(items: readonly T[]): T[];
}

export const MAX_SEED = 0xffffffff;

export function isSeed(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_SEED;
}

export function createRandom(seed: number): Random {
  if (!isSeed(seed)) throw new Error("Seed must be an integer in [0, 2^32 - 1]");
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || max < min) {
      throw new Error(`int(${min}, ${max}) needs integers with min <= max`);
    }
    return min + Math.floor(next() * (max - min + 1));
  };

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error("pick() needs a non-empty list");
      return items[int(0, items.length - 1)];
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = int(0, i);
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
