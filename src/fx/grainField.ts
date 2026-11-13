// THE GRAIN, AS PIXELS (Patch 13B). A pure function of the frame number and a seed: the same inputs always give the same tile, on any
// machine, so a frame renders the same whenever and wherever it is drawn (determinism rule 1 and 5). No React, no browser: a plain Node
// can call it (the tests do).

import { GRAIN } from "../config/fx";
import { prng } from "../lib/prng";

/** The generator for one frame: the seed and the frame number mixed into one 32-bit number, so neighbouring frames share nothing. */
export function grainRand(frame: number, seed: number = GRAIN.seed): () => number {
  // 0x9e3779b1 is the golden-ratio multiplier: it spreads consecutive frame numbers over the whole 32-bit range before the generator starts
  return prng((seed ^ Math.imul(Math.round(frame) + 1, 0x9e3779b1)) >>> 0);
}

/** The offset (px) at which the tile is laid over the frame on this frame, 0 to `tilePx - 1` in each direction. Pure. */
export function grainOffset(frame: number, seed: number = GRAIN.seed, tilePx: number = GRAIN.tilePx): { x: number; y: number } {
  const r = grainRand(frame, seed ^ 0x5bd1e995);
  return { x: Math.floor(r() * tilePx), y: Math.floor(r() * tilePx) };
}

/**
 * One frame's grain tile as RGBA bytes (`tilePx` x `tilePx`). Every pixel is either white or black with an alpha, so laid over the
 * picture with ordinary alpha blending it lightens or darkens it by up to `amount` and never changes its colour. The alpha is the
 * magnitude of a roughly normal number, so most pixels are faint and a few are stronger, as film grain is.
 */
export function grainTile(frame: number, o: { seed?: number; tilePx?: number; amount?: number } = {}): Uint8ClampedArray<ArrayBuffer> {
  const seed = o.seed ?? GRAIN.seed;
  const n = o.tilePx ?? GRAIN.tilePx;
  const amount = o.amount ?? GRAIN.amount;
  const r = grainRand(frame, seed);
  const out = new Uint8ClampedArray(n * n * 4);
  const peak = Math.round(amount * 255);
  for (let i = 0; i < n * n; i++) {
    // the sum of three uniforms is close enough to a bell curve for a faint placeholder, and costs far less than Box-Muller
    const g = (r() + r() + r() - 1.5) / 0.75; // about -2 to 2, mean 0
    const v = g >= 0 ? 255 : 0;
    const a = Math.min(1, Math.abs(g) / 2) * peak;
    const k = i * 4;
    out[k] = v;
    out[k + 1] = v;
    out[k + 2] = v;
    out[k + 3] = Math.round(a);
  }
  return out;
}
