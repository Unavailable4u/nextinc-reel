// THE WALNUT'S GRAIN (Patch 12): pure pixels, no DOM, so Node can test them. `Riser.tsx` puts them in a canvas texture.

import { RISER } from "../config/books";
import { makeNoise } from "../lib/noise";

/** The size of the grain picture the riser uses, px (the mean the colour was brightened for is that of this size). */
export const GRAIN_SIZE = { w: 512, h: 256 } as const;

/** The grain of the walnut: long streaks along the riser's width. A grey picture (mean 0.88, so the colour is brightened to match), repeatable from `RISER.wood.seed`. */
export function woodGrainPixels(w: number, h: number): Uint8ClampedArray {
  const W = RISER.wood;
  const n = makeNoise(W.seed);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // streaks: low frequency along x, high across it, plus a slow wave that bends the rings
      const bend = 0.9 * n.n1(x * 0.004 + 40);
      const ring = n.n2(x * 0.006, y * 0.045 + bend);
      const fine = n.n2(x * 0.03 + 77, y * 0.4);
      const v = 0.88 + W.grain * (0.7 * ring + 0.3 * fine) * 0.5;
      const g = Math.round(Math.min(1, Math.max(0, v)) * 255);
      const i = (y * w + x) * 4;
      out[i] = g;
      out[i + 1] = g;
      out[i + 2] = g;
      out[i + 3] = 255;
    }
  }
  return out;
}
