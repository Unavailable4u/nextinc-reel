// FOCUS AND DEFOCUS (Patch 04). Pure functions, no three.js, so Node (tests, the benchmark) can use them.
//
// The match camera is fixed and a view is a window of its sensor (Patch 03), so the lens is modelled as a thin lens on a
// 36 mm-wide sensor that spans the plate's 1536 px. A point at distance D from the camera, with the lens focused at S, focal length f
// and f-number N, blurs to a disc of diameter  c = f^2 / (N (S - f)) * |D - S| / D  on the sensor. On screen that disc is
// multiplied by the plate magnification M (a zoom is a smaller window of the same sensor, so it enlarges the blur too).
//
// The plate is a flat card, so a real lens would blur all of it by the same small amount, far less than the magnification table
// of guide 02 asks for. The table wins: the plate's blur is max(thin lens, minBlurPx(M)). Objects (the books) use the thin lens only.
import { PLATE_W, minBlurPx } from "../config/plate";
import { focalPx, type MatchParams } from "../plate/plateCamera";

/** the sensor width the lens model assumes, mm (full frame) */
export const SENSOR_WIDTH_MM = 36;
/** plate px per mm on the sensor */
export const PLATE_PX_PER_MM = PLATE_W / SENSOR_WIDTH_MM;
/** below this radius (output px) a blur is not drawn at all, which keeps the neutral path identical to the bare photo */
export const NEUTRAL_BLUR_PX = 0.25;

export interface Lens {
  /** distance from the camera to the plane in focus, cm */
  focusCm: number;
  /** focal length on the 36 mm sensor, mm */
  focalMm: number;
  /** f-number */
  fNumber: number;
}

/** The focal length of the match camera on the 36 mm sensor: f in plate px times mm per plate px. About 44 mm. */
export const matchFocalMm = (p: MatchParams): number => (focalPx(p) * SENSOR_WIDTH_MM) / PLATE_W;
/** Distance from the camera to the plate card along the optical axis, cm (the camera looks level, so this is camDist + plateDepth). */
export const plateDistanceCm = (p: MatchParams): number => p.camDistCm + p.plateDepthCm;

/** The lens for the opening shots: the match camera's focal length, focused on the pile anchor (Zd 16), f/8, so nothing is soft. */
export function defaultLens(p: MatchParams, pileZd = 16): Lens {
  return { focusCm: p.camDistCm + pileZd, focalMm: matchFocalMm(p), fNumber: 8 };
}

/** Radius of the blur disc, in OUTPUT px at 1080p, for a point `distCm` from the camera, at plate magnification M. */
export function cocRadiusPx(distCm: number, lens: Lens, M: number): number {
  const S = lens.focusCm * 10;
  const D = distCm * 10;
  const f = lens.focalMm;
  if (!(S > f)) throw new Error(`focus: the focus distance (${lens.focusCm} cm) must be longer than the focal length (${f} mm)`);
  if (!(D > 0)) throw new Error(`focus: the distance (${distCm} cm) must be positive`);
  if (!(lens.fNumber > 0)) throw new Error("focus: the f-number must be positive");
  const diameterMm = ((f * f) / (lens.fNumber * (S - f))) * (Math.abs(D - S) / D);
  return 0.5 * diameterMm * PLATE_PX_PER_MM * M;
}

/** The blur radius the plate card gets, output px: the thin lens or the magnification table, whichever is larger. */
export function plateBlurPx(M: number, lens: Lens, p: MatchParams): number {
  return Math.max(cocRadiusPx(plateDistanceCm(p), lens, M), minBlurPx(M));
}

/** True when a radius is large enough to be drawn. */
export const isBlurDrawn = (radiusPx: number): boolean => radiusPx >= NEUTRAL_BLUR_PX;

/** True when objects between `nearCm` and `farCm` from the camera need the depth-of-field pass (any of them blurs by 0.5 px or more). */
export function objectsNeedDefocus(lens: Lens, M: number, nearCm: number, farCm: number): boolean {
  return Math.max(cocRadiusPx(nearCm, lens, M), cocRadiusPx(farCm, lens, M)) >= 0.5;
}

const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/**
 * A focus pull: from lens `a` to lens `b` between frames `from` and `to`, eased. The focus distance moves in 1/distance (what a
 * focus ring does), the focal length and the f-number move linearly. Pure function of the frame.
 */
export function lensAt(frame: number, from: number, to: number, a: Lens, b: Lens): Lens {
  const t = smooth((frame - from) / Math.max(1, to - from));
  const inv = 1 / a.focusCm + (1 / b.focusCm - 1 / a.focusCm) * t;
  return { focusCm: 1 / inv, focalMm: a.focalMm + (b.focalMm - a.focalMm) * t, fNumber: a.fNumber + (b.fNumber - a.fNumber) * t };
}
