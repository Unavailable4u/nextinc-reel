// THE BOOK MOTION AS DATA (Patch 11). Every number of the rigs that open, close, lift and set down a book lives here; `src/book/rig/`
// (cover.ts, lift.ts, hold.ts, setDown.ts) only reads it. The starting values are guide 03 section 5 and guide 05 section 5; tune them
// by looking in `DevBookMotion`.
//
// UNITS: centimetres and degrees in this file. Durations are FRAMES at 60 fps (the rigs turn them into seconds for the springs).
//
// WHAT "WEIGHT" MEANS (guide 03 section 5, "People read weight from motion before they read it from shading"). Each book has a weight
// in grams (`BookSpec.weightG`: 400 to 560). Against the reference weight below:
//   a heavier book takes LONGER:    every duration x (weight / refWeightG) ^ durationPow
//   a heavier book SWAYS LESS:      every sway and overshoot x (refWeightG / weight) ^ swayPow
// Nothing is ever shorter than `minFrames` after the scaling, so a light book at a fast `speed` cannot start or stop in a blink.

import { SPRINGS, type SpringSpec } from "../lib/spring";
import type { EaseName } from "../lib/ease";

/** A window of a move's progress (0 to 1): the channel starts to change at `from` and has finished at `to`. */
export type Window = readonly [from: number, to: number];

export const MOTION = {
  /** the weight the durations and the sway are measured against, grams */
  refWeightG: 500,
  durationPow: 0.5,
  swayPow: 1,
  /** the shortest any authored move may be, frames (guide 03: nothing shorter than 6 frames) */
  minFrames: 6,
  /** a landing's settle is 4 to 6 frames (guide 03 section 5); its first lobe is the spring's half period */
  settleFrames: { min: 4, max: 6 },

  /**
   * The hand-held sway of a held book (guide 03 section 5): two noise layers, 0.3 Hz at 0.4 degrees and 1.1 Hz at 0.15 degrees, with
   * 0.8 mm of position noise. A held book that is perfectly steady looks like a rendering. Amplitudes are peaks, before the weight.
   */
  sway: {
    hz: [0.3, 1.1] as const,
    rotationDeg: [0.4, 0.15] as const,
    /** 0.06 + 0.02 cm = 0.8 mm */
    positionCm: [0.06, 0.02] as const,
  },

  /** the ribbon tail's swing while the book moves (a fraction of its full swing, `Book`'s `ribbonSwing`) */
  ribbon: { swing: 0.55, hz: 0.8, idleSwing: 0.1, idleHz: 0.35, riseFrames: 12, fallFrames: 40 },

  lift: {
    /** the press: the top book is gripped and the stack gives 1 mm (guide 03 section 5: 6 frames, 1 mm) */
    pressFrames: 6,
    pressCm: 0.1,
    /** the rise (slide towards the camera, lift, turn to face us), frames at the reference weight; S04 is 120 frames in all */
    riseFrames: 78,
    /** the windows of the rise: it slides out first, then lifts, then turns up to face us */
    slide: [0, 0.55] as Window,
    rise: [0.1, 1] as Window,
    turn: [0.3, 1] as Window,
    slideEase: "signature" as EaseName,
    riseEase: "lift" as EaseName,
    turnEase: "signature" as EaseName,
    /** it arrives a little past the reading pose and settles back (a slight overshoot, guide 03 section 5): degrees of turn, cm of height */
    overshootDeg: 3,
    overshootCm: 0.35,
    /** the spring it settles back with (guide 05 section 5: the follow-through of a held book) */
    spring: SPRINGS.bookSway as SpringSpec,
    /** the sway comes in over this part of the rise (it is not there on the desk) */
    swayIn: [0.45, 1] as Window,
  },

  /**
   * The reading pose: how the book is held to be read, relative to the pile's anchor. The book stands up with its cover facing the
   * camera and its spine on the left; `pitchDeg` below 90 tilts the head back a little, so the lamp rakes the foil (guide 04). The
   * camera shots (Patches 14 and 15) may move it; they change these numbers, not the rig.
   */
  reading: {
    /** sideways of the pile's anchor, cm (right is positive) */
    dxCm: 0,
    /** towards the camera of the pile's anchor, cm */
    forwardCm: 10,
    /** the height of the point the pose stands on (the middle of the back board's underside), cm above the desk */
    heightCm: 18,
    pitchDeg: 80,
    yawDeg: 0,
    rollDeg: 0,
  },

  cover: {
    /** how far the cover opens when a book is held (guide 01, S06: about 165 degrees) */
    openDeg: 165,
    /** the swing of the opening, frames at the reference weight; it hands over to the spring `cover` for the last part */
    openFrames: 54,
    /** the speed at which the swing hands over to the spring, as a multiple of the swing's mean speed */
    handoffSlope: 0.6,
    /** the overshoot the spring is solved for, degrees (guide 03 section 5) */
    overshootDeg: 3,
    spring: SPRINGS.cover as SpringSpec,
    /** closing: the swing, its speed when the board lands (a multiple of the swing's mean speed) and how much of that speed the board gives back */
    closeFrames: 66,
    closeLandSlope: 0.9,
    restitution: 0.3,
    reboundSpring: SPRINGS.settle as SpringSpec,
  },

  setDown: {
    /** the carry: from the reading pose down to the desk, frames at the reference weight (S15 is 120 frames in all) */
    carryFrames: 84,
    /** the windows of the carry: across, turn flat, then lower */
    across: [0, 0.7] as Window,
    turn: [0, 0.75] as Window,
    lower: [0.1, 1] as Window,
    acrossEase: "signature" as EaseName,
    turnEase: "signature" as EaseName,
    lowerEase: "arrive" as EaseName,
    /** the book touches down at this fraction of the speed of its mean descent; the rest of it is the rebound */
    landSlope: 0.5,
    /** the rebound after touching down (guide 03 section 5: 0.3 mm), by the spring `settle` (4 to 6 frames) */
    reboundCm: 0.03,
    reboundSpring: SPRINGS.settle as SpringSpec,
    /** the sway leaves over this part of the carry */
    swayOut: [0, 0.6] as Window,
  },

  /** how many frames of a set-down the rig needs to be completely at rest: the carry plus a settle of 12 frames */
  restAfterFrames: 12,
} as const;

/** Duration scale of a book of this weight (1 at the reference weight). */
export const durationScale = (weightG: number): number => (weightG / MOTION.refWeightG) ** MOTION.durationPow;
/** Sway and overshoot scale of a book of this weight (1 at the reference weight). */
export const swayScale = (weightG: number): number => (MOTION.refWeightG / weightG) ** MOTION.swayPow;

/** A duration in frames for a book of this weight at this speed (1 is normal, 1.3 is "about 30 percent faster"), never under `minFrames`. */
export function framesFor(baseFrames: number, weightG: number, speed = 1): number {
  if (!(speed > 0)) throw new Error(`motion: speed must be positive, got ${speed}`);
  return Math.max(MOTION.minFrames, Math.round((baseFrames * durationScale(weightG)) / speed));
}