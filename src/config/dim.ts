// THE DIM (Patch 20), as data and pure functions. Guide 01, Act 8: "over 2 s the room dims (exposure -1.5 stops, the lamp warms and falls), the books stay softly lit by the LED
// strips". It starts on frame 4800, the first frame of S24, and is done 120 frames (2 s) later; from there to the end of the film the room stays dim.
//
// THREE THINGS CHANGE, all from one curve (`dimAt`), so they can never disagree:
//   the picture   one warm-black layer over the whole canvas (`src/fx/Dim.tsx`). The photograph is unlit and cannot be relit, so its exposure is a gain on the finished picture:
//                 -1.5 stops is 0.354 of the light, and because the layer is blended in encoded (sRGB) values the alpha is 1 - gain^(1 / 2.2), about 0.377 at the end.
//   the lamp      the desk lamp, the motivated key, falls to `key.endGain` of its light and warms towards `key.warmColour` (a lamp on a dimmer goes amber as it falls). The lamp is
//                 not in the picture at S24 (it is at plate px 309, the window is at 717-1199), so the books are where its fall is seen.
//   the strips    the amber LED strip and the under-desk kicker are what the books stay lit by, so they do NOT fall: they rise a little (`strips.endGain`), which is what keeps
//                 the books softly lit while the room goes dark.
//
// Gains are in STOPS, not in light: a gain of 0.2 reached along `0.2 ^ progress` falls evenly to the eye. Before frame 4800 every gain is exactly 1 and the alpha is exactly 0,
// so nothing earlier in the film changes by a pixel. No React and no three.js; the one import is the warm black the vignette already uses.

import { VIGNETTE } from "./fx";

export const DIM = {
  /** the first frame of the dim (beat 160, the first frame of S24) and how long it takes (2 s) */
  from: 4800,
  frames: 120,
  /** the exposure at the end, in stops: -1.5 is 0.354 of the light */
  stops: -1.5,
  /** the gamma the layer's alpha is worked out in (it is blended in encoded values) */
  gamma: 2.2,
  /** the colour of the layer: a warm black, never pure black (guide 03) */
  colour: VIGNETTE.color,
  /** the desk lamp at the end: the share of its light left, and the colour it warms to (the base colour is `LIGHTS.key.color`) */
  key: { endGain: 0.2, warmColour: "#E8A05A" },
  /** the LED strip and the kicker at the end: the share of their light (above 1 is more) */
  strips: { endGain: 2 },
  /**
   * An ASSUMPTION for the number `bookStops` reports, not a measurement: the share of a book's light that comes from the lamp (the rest from the strips). It is only used to say
   * how dark a book ends up compared with the room, and it is tuned by looking at frames 4920 and 5280.
   */
  bookKeyShare: 0.5,
} as const;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const smooth = (t: number): number => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** How far the dim has gone, 0 to 1: a smoothstep over `DIM.frames` from `DIM.from`, so it has no corner in time at either end. */
export function dimProgress(frame: number): number {
  return smooth((frame - DIM.from) / DIM.frames);
}

export interface DimState {
  /** 0 to 1 */
  progress: number;
  /** the exposure in stops now (0 before the dim, `DIM.stops` after) */
  stops: number;
  /** the same as a share of the light: 2 ^ stops */
  exposure: number;
  /** the alpha of the warm-black layer over the picture: 0 before the dim */
  overlayAlpha: number;
  /** the desk lamp's intensity multiplier (1 before the dim) */
  keyGain: number;
  /** how far the lamp's colour has gone from its own to `DIM.key.warmColour`, 0 to 1 */
  keyWarmth: number;
  /** the strip's and the kicker's intensity multiplier (1 before the dim) */
  stripGain: number;
}

/** Everything the dim changes, at a frame. A pure function of the frame. */
export function dimAt(frame: number): DimState {
  const p = dimProgress(frame);
  const stops = DIM.stops * p;
  const exposure = Math.pow(2, stops);
  return {
    progress: p,
    stops,
    exposure,
    overlayAlpha: 1 - Math.pow(exposure, 1 / DIM.gamma),
    keyGain: Math.pow(DIM.key.endGain, p),
    keyWarmth: p,
    stripGain: Math.pow(DIM.strips.endGain, p),
  };
}

const hex = (c: string): [number, number, number] => {
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) throw new Error(`dim: "${c}" is not a #rrggbb colour`);
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
};

/** The warm-black layer's colour as `r, g, b` (for `rgba(...)`). */
export function dimRgb(): string {
  return hex(DIM.colour).join(",");
}

/**
 * The lamp's colour at a frame, as #rrggbb. Before the dim it is `base` exactly (the same string, so the lighting before frame 4800 is untouched);
 * after it, `base` mixed towards the warm colour by `keyWarmth`.
 */
export function keyColourAt(frame: number, base: string): string {
  const t = dimAt(frame).keyWarmth;
  if (t <= 0) return base;
  const a = hex(base);
  const b = hex(DIM.key.warmColour);
  const out = [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * How many stops darker than before a BOOK looks at a frame, under the assumption of `DIM.bookKeyShare` (see there): the picture's exposure times the light the lamp and the strips
 * still give it. The room (the photograph) is `dimAt(frame).stops`; the books are meant to end a little brighter than that, which is "softly lit by the strips".
 */
export function bookStops(frame: number): number {
  const d = dimAt(frame);
  const share = DIM.bookKeyShare;
  return Math.log2(d.exposure * (share * d.keyGain + (1 - share) * d.stripGain));
}
