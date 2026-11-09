// Seeded, smooth value noise in 1-D and 2-D, range [-1, 1]. Used for the handheld camera, dust drift and paper flutter.
// The same seed always gives the same field, so frame N is a pure function of N.

import { prng } from "./prng";

const SIZE = 256;
const MASK = SIZE - 1;

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface Noise {
  /** smooth noise along one axis, in [-1, 1] */
  n1(x: number): number;
  /** smooth noise on a plane, in [-1, 1] */
  n2(x: number, y: number): number;
  /** sum of `octaves` of n1 (each at twice the frequency and 0.5 of the amplitude), normalised to [-1, 1] */
  fbm1(x: number, octaves?: number): number;
}

export function makeNoise(seed: number): Noise {
  const r = prng(seed);
  const table = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) table[i] = r() * 2 - 1;
  const perm = new Uint8Array(SIZE);
  for (let i = 0; i < SIZE; i++) perm[i] = i;
  for (let i = SIZE - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = perm[i];
    perm[i] = perm[j];
    perm[j] = t;
  }
  const v1 = (i: number): number => table[i & MASK];
  const v2 = (i: number, j: number): number => table[perm[(perm[i & MASK] + j) & MASK]];
  const n1 = (x: number): number => {
    const i = Math.floor(x);
    return lerp(v1(i), v1(i + 1), fade(x - i));
  };
  const n2 = (x: number, y: number): number => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const u = fade(x - i);
    const w = fade(y - j);
    return lerp(lerp(v2(i, j), v2(i + 1, j), u), lerp(v2(i, j + 1), v2(i + 1, j + 1), u), w);
  };
  const fbm1 = (x: number, octaves = 3): number => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
      sum += amp * n1(x * f + o * 17.31);
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
  return { n1, n2, fbm1 };
}
