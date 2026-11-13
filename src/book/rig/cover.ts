// THE COVER (Patch 11). The angle of the front board over time, in the Book's own unit: 0 is closed, 1 is lying open flat (180 degrees).
//
// OPENING (guide 01 S06, guide 03 section 5). A hand swings the board open, and the last part of the swing is the board's own: the spring
// `cover` (damping ratio 0.6, 3.2 Hz) takes over, overshoots the open angle by about 3 degrees and settles back in about 30 frames.
// A spring that took the WHOLE step of 165 degrees would overshoot by 9.5 percent of it, about 16 degrees, so the swing does the first
// part and hands the spring only the step that overshoots by exactly `overshootDeg` (solved here, once per book). The hand-over is smooth
// in position and in speed: the swing arrives with speed `handoffSlope` times its mean, and the spring starts with that same speed. (A quick
// swing has a high mean speed; where that speed alone would overshoot by more than `overshootDeg`, the slope is brought down, `OpenShape.slope`.)
//
// CLOSING. The board swings down, lands with speed, and gives a little of it back: a rebound of a fraction of a degree by the spring
// `settle`, 4 to 6 frames long, always on the open side (a board cannot go through the book). The soft clap is the audio's.
//
// Pure functions of the frame, like the turn: no state.

import { MOTION, framesFor } from "../../config/bookMotion";
import { springAt, type SpringSpec } from "../../lib/spring";
import { FPS } from "../../config/timeline";
import { bounceAt, hermiteIn } from "./pose";

/** Degrees to the Book's cover angle (1 is 180 degrees). */
export const coverUnits = (deg: number): number => deg / 180;
/** The Book's cover angle to degrees. */
export const coverDegrees = (angle: number): number => angle * 180;

export interface OpenOptions {
  /** the angle the cover opens to, degrees; default `MOTION.cover.openDeg` */
  targetDeg?: number;
  /** the book's weight, grams: a heavier cover swings more slowly; default the reference weight */
  weightG?: number;
  /** 1 is normal, 1.3 is about 30 percent faster */
  speed?: number;
}

export interface OpenShape {
  /** the target angle (cover units) */
  target: number;
  /** frames of the swing, then of the whole opening up to the point the spring has settled to 1 percent of its step */
  swingFrames: number;
  /** where the swing hands over to the spring, and the speed it has there (units per second) */
  handoff: number;
  speed: number;
  /**
   * the hand-over slope in use (a multiple of the swing's mean speed): `MOTION.cover.handoffSlope`, or less. A quick swing has a high mean speed,
   * and a spring started with that much speed overshoots by more than `overshootDeg` all by itself (a 42-frame swing at 0.6 does: about 3.5
   * degrees), so the slope is brought down to the largest one that does not.
   */
  slope: number;
  /** the spring's step (target - handoff) and the overshoot it was solved for (cover units) */
  step: number;
  overshoot: number;
  spring: SpringSpec;
}

const shapes = new Map<string, OpenShape>();

/** The largest value of the spring's displacement from its target, sampled finely (the first lobe is about 11 frames long). */
function peakOvershoot(spring: SpringSpec, step: number, v0: number): number {
  let best = -Infinity;
  const dt = 1 / 2400;
  for (let t = 0; t < 1.2; t += dt) best = Math.max(best, springAt(t, spring, -step, 0, v0));
  return best;
}

/** The shape of an opening: solved for a step whose spring overshoots by exactly the configured amount. Cached. */
export function openShape(opts: OpenOptions = {}): OpenShape {
  const C = MOTION.cover;
  const target = coverUnits(opts.targetDeg ?? C.openDeg);
  const weightG = opts.weightG ?? MOTION.refWeightG;
  const speed = opts.speed ?? 1;
  const key = `${target}|${weightG}|${speed}`;
  const hit = shapes.get(key);
  if (hit) return hit;

  const swingFrames = framesFor(C.openFrames, weightG, speed);
  const swingSec = swingFrames / FPS;
  const overshoot = coverUnits(C.overshootDeg);
  // the overshoot grows with the spring's step; the speed it starts with is tied to where the swing ended (m x mean speed)
  const peakAt = (step: number, m: number): number => peakOvershoot(C.spring, step, (m * (target - step)) / swingSec);
  let slope: number = C.handoffSlope;
  if (peakAt(0, slope) > overshoot) {
    // a quick swing arrives with so much speed that the spring overshoots too far even with no step of its own: slow the hand-over down
    let a = 0;
    let b = slope;
    for (let i = 0; i < 50; i++) {
      const mid = (a + b) / 2;
      if (peakAt(0, mid) <= overshoot) a = mid;
      else b = mid;
    }
    slope = a;
  }
  const peak = (step: number): number => peakAt(step, slope);
  let lo = 0;
  let hi = target * 0.6;
  if (peak(hi) < overshoot) throw new Error(`cover: no step up to 60 percent of the opening overshoots by ${C.overshootDeg} degrees; check MOTION.cover.spring`);
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (peak(mid) < overshoot) lo = mid;
    else hi = mid;
  }
  const step = (lo + hi) / 2;
  const handoff = target - step;
  const shape: OpenShape = { target, swingFrames, handoff, speed: (slope * handoff) / swingSec, slope, step, overshoot, spring: C.spring };
  shapes.set(key, shape);
  return shape;
}

/** The cover angle `frames` after the opening began (0 before it): the swing, then the spring. */
export function coverOpenAt(frames: number, opts: OpenOptions = {}): number {
  if (frames <= 0) return 0;
  const s = openShape(opts);
  if (frames < s.swingFrames) return s.handoff * hermiteIn(frames / s.swingFrames, s.slope);
  return springAt((frames - s.swingFrames) / FPS, s.spring, s.handoff, s.target, s.speed);
}

/** Frames from the start of an opening until the cover is within `tolDeg` of its target for good (default half a degree). */
export function coverOpenSettleFrames(opts: OpenOptions = {}, tolDeg = 0.5): number {
  const s = openShape(opts);
  const tol = coverUnits(tolDeg);
  let last = s.swingFrames;
  for (let f = s.swingFrames; f < s.swingFrames + 120; f++) if (Math.abs(coverOpenAt(f, opts) - s.target) > tol) last = f + 1;
  return last;
}

export interface CloseOptions {
  /** the angle the cover closes from (cover units); default the open target */
  from?: number;
  weightG?: number;
  speed?: number;
}

/** Frames of the closing swing (up to the moment the board lands). */
export const closeFrames = (opts: CloseOptions = {}): number => framesFor(MOTION.cover.closeFrames, opts.weightG ?? MOTION.refWeightG, opts.speed ?? 1);

/** The cover angle `frames` after the closing began: the swing down to 0, then the small rebound on the open side. */
export function coverCloseAt(frames: number, opts: CloseOptions = {}): number {
  const C = MOTION.cover;
  const from = opts.from ?? coverUnits(C.openDeg);
  if (frames <= 0) return from;
  const n = closeFrames(opts);
  const sec = n / FPS;
  if (frames < n) return from * (1 - hermiteIn(frames / n, C.closeLandSlope));
  // it lands with speed m x (from / seconds); it gives back `restitution` of it
  const landSpeed = (C.closeLandSlope * from) / sec;
  return bounceAt((frames - n) / FPS, C.restitution * landSpeed, C.reboundSpring.zeta, C.reboundSpring.hz);
}

export type CoverEvent = { kind: "open"; start: number; opts?: OpenOptions } | { kind: "close"; start: number; opts?: CloseOptions };

/**
 * The cover angle at an absolute frame, from a list of events (each starts at a frame): 0 before the first, an opening or a closing
 * after it. A closing starts from where the last opening ended up (its target). Events must be in order and may not overlap.
 */
export function coverAngleAt(frame: number, events: readonly CoverEvent[]): number {
  let open: CoverEvent | null = null;
  let current: CoverEvent | null = null;
  for (const e of events) {
    if (e.start > frame) break;
    current = e;
    if (e.kind === "open") open = e;
  }
  if (!current) return 0;
  if (current.kind === "open") return coverOpenAt(frame - current.start, current.opts);
  const from = open ? openShape(open.opts).target : coverUnits(MOTION.cover.openDeg);
  return coverCloseAt(frame - current.start, { ...current.opts, from: current.opts?.from ?? from });
}

/** The frames at which the events begin and end (for the ribbon's activity); an event ends when its swing does. */
export function coverSpans(events: readonly CoverEvent[]): { from: number; to: number }[] {
  return events.map((e) => ({ from: e.start, to: e.start + (e.kind === "open" ? openShape(e.opts).swingFrames : closeFrames(e.opts)) }));
}