// The only source of randomness in the project (determinism rule 5). Seeded, small, fast: mulberry32.
// Math.random() is forbidden everywhere.

export type Rand = () => number;

/** A generator of numbers in [0, 1). The same seed always gives the same sequence. */
export function prng(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [lo, hi). */
export const range = (r: Rand, lo: number, hi: number): number => lo + (hi - lo) * r();
/** An integer in [lo, hi] inclusive. */
export const int = (r: Rand, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
/** A roughly normal number (mean 0, sd 1) from two uniforms (Box-Muller). */
export function gauss(r: Rand): number {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
