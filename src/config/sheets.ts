// THE SHEETS AS DATA (Patch 10). Every number about how a loose sheet of paper bends, turns, glows and flutters lives here;
// `src/book/sheetShape.ts` (the maths) and `src/book/Sheet.tsx` (the mesh and its shaders) only read it. The starting values are
// guide 06 sections 2 to 5; tune them by looking in `DevPageTurn`.
//
// UNITS: centimetres and degrees in this file (the code turns degrees into radians once, in `shapeOf`). Time is seconds for the
// flutter and frames for the rigs (60 fps).
//
// THE COORDINATES OF A SHEET. `u` runs 0 to 1 from the gutter (the spine edge) to the outer edge, `v` runs 0 to 1 from the head
// to the tail. A sheet is a leaf: the same piece of paper has the right page of a spread on its front and the left page of the next
// spread on its back.

import type { EaseName } from "../lib/ease";

export interface SheetVariation {
  /** multiplies the curl's depth (1 = the config's) */
  curl: number;
  /** multiplies the lag */
  lag: number;
  /** multiplies the flutter's amplitude */
  flutter: number;
  /** multiplies the flutter's frequency */
  flutterHz: number;
}

export const SHEET = {
  /** the mesh: 24 segments from the gutter to the outer edge, 36 from the head to the tail (guide 06 section 2) */
  mesh: { cols: 24, rows: 36 },

  /**
   * The bend (guide 06 section 2):
   *   angle(u, P) = swing(P_u) - curl(P) * w(u)      w(u) = u^wPow, so the gutter stays flat and the outer edge curls most
   *   curl(P)     = curlDeg * sin(pi P)^curlPow      zero at rest, largest in mid-turn
   *   P_u         = the progress of the column u, late by `lag * w(u)` (the outer edge leaves late and lands late)
   */
  bend: { curlDeg: 38, curlPow: 1.4, wPow: 1.6, lag: 0.12 },

  /**
   * How close to a stack (in degrees of angle) a point of the sheet starts to follow the stack's bow instead of flying free. Each point
   * decides for itself from its own angle, so the part of a sheet that has already settled follows the bowed face while the rest is still
   * in the air (one number for the whole sheet would let the settled part sink into the bulging left stack).
   */
  restBlendDeg: 10,

  /** The finger's corner: a little extra lift near one corner while the sheet leaves the stack (P from 0 to `window`). */
  corner: {
    liftDeg: 6,
    /** the lift fades out over this distance from the corner, as a fraction of the leaf's width */
    radiusFrac: 0.35,
    /** the lift lives in this part of the turn (it is a sine over it) */
    window: 0.25,
    /** which corner: u = 1 is the outer edge, v = 0 the head (guide 06 section 2: the top-outer corner) */
    u: 1,
    v: 0,
  },

  /**
   * After landing the free edge rebounds: a lift that decays, two or three small bumps (guide 06 section 1, point 5). It only ever
   * LIFTS the paper off the page below (the sheet never goes through its neighbour): `0.5 (1 - cos)` is a one-sided wiggle.
   */
  flutter: { deg: 2.5, tauSec: 0.12, hz: 9 },

  /** real depth of an animated sheet and the offset from its neighbours (guide 06 section 3); polygon offset as well (section 7) */
  depthCm: 0.012,
  offsetCm: 0.004,
  polygon: { factor: -1, units: -1 },

  /**
   * Light through the paper (guide 06 section 4). `strength` multiplies the light that reaches the sheet's far side and passes
   * through; `tint` is the warmth it picks up in the fibres; `inkThrough` is how much of BOTH sides' ink it carries (1 = all);
   * `ghost` is the other side's ink seen in ordinary reflected light (8 percent).
   */
  translucency: { strength: 0.5, tint: [1.0, 0.84, 0.6] as readonly [number, number, number], inkThrough: 0.5, ghost: 0.08 },

  /** the printed-in shading where a page meets the spine: 1.4 cm wide on both pages (guide 06 section 4) */
  gutter: { widthCm: 1.4, darken: 0.3 },

  /** the blob shadow that follows a sheet (guide 06 section 4): a warm black, elongated along the sheet, softer the higher it is */
  blob: {
    color: "#1B0F08",
    maxOpacity: 0.34,
    /** below this height the sheet touches and the shadow is only a contact line (cm) */
    contactCm: 0.3,
    /** how far past the sheet's footprint the shadow spreads, per cm of height */
    spreadPerCm: 0.8,
    /** lift above the stack's face (cm) and polygon offset */
    liftCm: 0.002,
  },

  /** the stack's face under a lifting sheet shows the next page, not a hole (guide 06 section 3): a plane this far above the slab, cm */
  face: { cols: 12, rows: 18, liftCm: 0.001 },

  /**
   * Every sheet of a riffle differs a little from its neighbours (seeded by the book and the sheet's index, so the same sheet is the
   * same on every render): these are the ranges, as +- fractions of the config's value.
   */
  variation: { curl: 0.12, lag: 0.15, flutter: 0.25, flutterHz: 0.08 },

  /** one turn (guide 06 section 5): 54 frames (0.9 s) eased `signature`; a quick turn is 36 frames */
  turn: { frames: 54, quickFrames: 36, ease: "signature" as EaseName },

  /**
   * The riffle (S10, guide 06 section 5): 10 to 14 sheets, each turning in 30 frames, the start offsets growing from 6 to 10 frames.
   * Counting from the first sheet's start to the last sheet's start, 12 to 14 sheets take 88 to 104 frames.
   */
  riffle: { count: 13, min: 10, max: 14, turnFrames: 30, gapFrom: 6, gapTo: 10, ease: "signature" as EaseName },

  /** the length read-out of `DevPageTurn` and `tests/sheets.test.ts` (guide 06 section 6): at these values of progress, within this fraction */
  readout: { progress: [0, 0.25, 0.5, 0.75, 1] as readonly number[], tolerance: 0.005 },
} as const;

/** A sheet that follows the config exactly. */
export const NO_VARIATION: SheetVariation = { curl: 1, lag: 1, flutter: 1, flutterHz: 1 };