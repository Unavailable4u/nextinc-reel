// THE OPERATOR MODEL (Patch 05): a camera held by a person is never a mathematical path. These layers are added on top of the authored
// keyframes (src/camera/path.ts). They are the table of docs/guide/05-camera-and-motion.md section 3, as data and as pure functions of
// the frame: breathing, a walking bob and sway, a micro tremor, the lean-in, the reach dip and the settle after it.
//
// Every layer is written in what a camera body does, not in photo px: `rightCm`, `upCm`, `forwardCm` (a dolly toward the desk) and
// `tiltDownDeg`. path.ts turns them into a shift of the window, a change of M and a tilt. All noise comes from src/lib/noise.ts with a
// fixed seed per layer, so frame N is the same on every machine and every run (determinism rule 4). No React, no three.js.
//
// Nothing here lasts shorter than 6 frames (guide 05: below 0.1 s it reads as a glitch); every event frame is a multiple of 30
// (OPERATOR_EVENT_FRAMES, which the audit checks as LATE).

import { FPS, SHOTS } from "../config/timeline";
import type { Regime } from "../config/timeline";
import { clamp01, signature } from "../lib/ease";
import { makeNoise } from "../lib/noise";
import { springAt, type SpringSpec } from "../lib/spring";

/** What the operator adds to the authored camera at one frame. */
export interface OperatorOffset {
  /** sideways, cm; positive to the right */
  rightCm: number;
  /** vertical, cm; positive up */
  upCm: number;
  /** a dolly toward the desk, cm; positive is closer */
  forwardCm: number;
  /** the camera looks further down by this much, degrees */
  tiltDownDeg: number;
}

export const NO_OFFSET: OperatorOffset = { rightCm: 0, upCm: 0, forwardCm: 0, tiltDownDeg: 0 };

// ---------- the layers table (guide 05, section 3) ----------

export const OPERATOR = {
  /** breathing: vertical, everywhere */
  breathing: { cm: 0.35, deg: 0.08, hz: 0.28 },
  /** the walking bob (vertical) and sway (lateral), S01 only; the bob fades in over `fadeInFrames` and out over the last `fadeOutFrames` of S01 */
  walkBob: { cm: 0.9, deg: 0.25, hz: 1.8, fadeInFrames: 30, fadeOutFrames: 40 },
  walkSway: { cm: 0.6, hz: 0.9 },
  /** micro tremor, R3 only */
  tremor: { cm: 0.12, hz: 7 },
  /** lean-in: forward and down, eased over `frames` */
  leanIn: { forwardCm: 3, downDeg: 0.6, frames: 60, backFrames: 60 },
  /** reach dip: straight down over `frames` */
  reachDip: { downCm: 2, frames: 48 },
  /** settle after the reach: the dip is let go and the camera rings back up past its rest by `overshootCm`, damped, in about 0.6 s */
  settle: { overshootCm: 0.7, spring: { zeta: 0.32, hz: 1 } as SpringSpec },
  /** frames over which a layer that is switched off (a steady range) fades out and in */
  steadyBlendFrames: 12,
} as const;

/**
 * Where the operator's events sit. A lean-in rises over 60 frames at `from`, holds, and eases back over 60 frames starting at `until`.
 * S02 and S04 are the guide's two lean-ins (the arrival at the pile and the reach for the book). The S04 events were placed from the
 * table in Patch 05 and kept by Patch 14.
 */
export const LEAN_INS: readonly { from: number; until: number }[] = [
  { from: 480, until: 840 },
  { from: 960, until: 1080 },
];
/**
 * The reach for the book (S04): the dip starts at `dip` and takes `OPERATOR.reachDip.frames`, the camera is let go at `settle` and rings
 * back up. Patch 14 moved `settle` from 1020 to 1050 and slowed the dip (24 to 48 frames) and the ring (2 Hz to 1 Hz): in R3 the camera may
 * slide 10 cm/s at most, and the table's 0.4 s dip peaked at 13.6 cm/s and its 2 Hz ring at 16.2 cm/s (decision D-60).
 */
export const REACH = { dip: 990, settle: 1050 } as const;

/**
 * Ranges where the camera must be steady (guide 05 section 4: "steady during QR hold, no roll, no tremor"): the links spread of the
 * first book (S13) and the film spread with the QR of the second (S20). The tremor and the breathing fade out inside them.
 */
export const STEADY_RANGES: readonly { from: number; to: number }[] = [
  { from: SHOTS[13].from, to: SHOTS[13].to },
  { from: SHOTS[20].from, to: SHOTS[20].to },
];

/** Every frame at which an operator event starts or ends. All are multiples of 30 (the audit reports a LATE if one is not). */
export const OPERATOR_EVENT_FRAMES: readonly number[] = [...new Set([...LEAN_INS.flatMap((l) => [l.from, l.until]), REACH.dip, REACH.settle, ...STEADY_RANGES.flatMap((r) => [r.from, r.to + 1]), SHOTS[1].from, SHOTS[1].to + 1])].sort((a, b) => a - b);

// ---------- seeded noise: one field per layer, fixed seeds ----------

export const OPERATOR_SEEDS = { breathing: 5101, walkBob: 5102, walkSway: 5103, tremorX: 5104, tremorY: 5105 } as const;
const noise = {
  breathing: makeNoise(OPERATOR_SEEDS.breathing),
  walkBob: makeNoise(OPERATOR_SEEDS.walkBob),
  walkSway: makeNoise(OPERATOR_SEEDS.walkSway),
  tremorX: makeNoise(OPERATOR_SEEDS.tremorX),
  tremorY: makeNoise(OPERATOR_SEEDS.tremorY),
};

const TAU = Math.PI * 2;
const smoothstep = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
/** 0 to 1 over `frames` frames from `from` (eased, clamped) */
const ramp = (frame: number, from: number, frames: number): number => smoothstep((frame - from) / frames);

/** True when the regime's first part is R3 (the book is in front of the camera): "R3" and "R3/2". */
const isR3 = (regime: Regime): boolean => regime.split("/")[0] === "R3";

/** 1 outside the steady ranges, 0 inside, with a short blend at each end. */
export function steadyGain(frame: number): number {
  let g = 1;
  for (const r of STEADY_RANGES) {
    const inside = Math.min(ramp(frame, r.from - OPERATOR.steadyBlendFrames, OPERATOR.steadyBlendFrames), 1 - ramp(frame, r.to + 1, OPERATOR.steadyBlendFrames));
    g = Math.min(g, 1 - inside);
  }
  return g;
}

/** Breathing: a slow vertical swell, a little uneven from breath to breath (the noise only ever reduces the peak, never exceeds the table's amplitude). */
function breathing(frame: number): OperatorOffset {
  const b = OPERATOR.breathing;
  const t = frame / FPS;
  const wobble = 0.9 + 0.1 * noise.breathing.n1(t * 0.17);
  const s = Math.sin(TAU * b.hz * t + 0.9 + 0.5 * noise.breathing.n1(t * 0.11 + 40)) * wobble;
  return { rightCm: 0, upCm: b.cm * s, forwardCm: 0, tiltDownDeg: -b.deg * s };
}

/** Nothing the operator does lasts shorter than this many frames (0.1 s at 60 fps); the tests hold every layer to it. */
export const MIN_LAYER_FRAMES = 6;

/** How strongly the walk acts at a frame: 0 outside S01, fading in over 30 frames from 240 and out over the last 40 before the arrival at 480. */
export function walkEnvelope(frame: number): number {
  const s1 = SHOTS[1];
  if (frame < s1.from || frame > s1.to + 1) return 0;
  const w = OPERATOR.walkBob;
  return ramp(frame, s1.from, w.fadeInFrames) * (1 - ramp(frame, s1.to + 1 - w.fadeOutFrames, w.fadeOutFrames));
}

/** The walk (S01): two steps a second make a vertical bob, one sway a second a lateral one. The bob fades in over 30 frames and out over the last 40 (frames 440-480). */
function walking(frame: number): OperatorOffset {
  const w = OPERATOR.walkBob;
  const env = walkEnvelope(frame);
  if (env <= 0) return NO_OFFSET;
  const t = frame / FPS;
  const bob = Math.sin(TAU * w.hz * t + 2 * noise.walkBob.n1(t * 0.5)) * (0.85 + 0.15 * noise.walkBob.n1(t * 1.3 + 9));
  const sway = Math.sin(TAU * OPERATOR.walkSway.hz * t + 1.3 + noise.walkSway.n1(t * 0.4)) * (0.85 + 0.15 * noise.walkSway.n1(t * 1.1 + 5));
  return { rightCm: OPERATOR.walkSway.cm * sway * env, upCm: w.cm * bob * env, forwardCm: 0, tiltDownDeg: -w.deg * bob * env };
}

/** Micro tremor: smooth noise at about 7 Hz, a tenth of a millimetre or so, R3 only. */
function tremor(frame: number, regime: Regime): OperatorOffset {
  if (!isR3(regime)) return NO_OFFSET;
  const t = frame / FPS;
  const k = OPERATOR.tremor;
  return { rightCm: k.cm * noise.tremorX.n1(t * k.hz), upCm: k.cm * noise.tremorY.n1(t * k.hz), forwardCm: 0, tiltDownDeg: 0 };
}

/** The lean-ins: forward and down, rising over 60 frames, holding, easing back over 60. */
function leaning(frame: number): OperatorOffset {
  const k = OPERATOR.leanIn;
  let e = 0;
  for (const l of LEAN_INS) e += signature(clamp01((frame - l.from) / k.frames)) * (1 - signature(clamp01((frame - l.until) / k.backFrames)));
  return { rightCm: 0, upCm: 0, forwardCm: k.forwardCm * e, tiltDownDeg: k.downDeg * e };
}

/** The reach: the camera drops 2 cm over 24 frames, is let go at `settle` and rings back up through its rest (0.7 cm over), damped. */
function reaching(frame: number): OperatorOffset {
  const d = OPERATOR.reachDip;
  const dip = -d.downCm * signature(clamp01((frame - REACH.dip) / d.frames));
  if (frame < REACH.dip) return NO_OFFSET;
  if (frame < REACH.settle) return { rightCm: 0, upCm: dip, forwardCm: 0, tiltDownDeg: 0 };
  // from the dip's bottom to rest, with an overshoot of 0.7 cm: the spring's overshoot fraction is exp(-pi z / sqrt(1 - z^2))
  const t = (frame - REACH.settle) / FPS;
  return { rightCm: 0, upCm: springAt(t, OPERATOR.settle.spring, -d.downCm, 0), forwardCm: 0, tiltDownDeg: 0 };
}

/**
 * The operator's whole offset at a frame: breathing everywhere, the walk in S01, tremor in R3, and the lean-in, the reach and the
 * settle at their frames. Inside a steady range (a QR hold) the breathing and the tremor fade out. `regime` is the authored regime of
 * the frame (path.ts passes it).
 */
export function operatorAt(frame: number, regime: Regime): OperatorOffset {
  const steady = steadyGain(frame);
  const layers = [breathing(frame), tremor(frame, regime)].map((o) => scale(o, steady));
  layers.push(walking(frame), leaning(frame), reaching(frame));
  return layers.reduce(add, NO_OFFSET);
}

const add = (a: OperatorOffset, b: OperatorOffset): OperatorOffset => ({ rightCm: a.rightCm + b.rightCm, upCm: a.upCm + b.upCm, forwardCm: a.forwardCm + b.forwardCm, tiltDownDeg: a.tiltDownDeg + b.tiltDownDeg });
const scale = (a: OperatorOffset, k: number): OperatorOffset => ({ rightCm: a.rightCm * k, upCm: a.upCm * k, forwardCm: a.forwardCm * k, tiltDownDeg: a.tiltDownDeg * k });
