// THE LIFT (Patch 11, shot S04). A book is gripped, slides out towards the camera, rises and turns up to face us (guide 01 Act 2):
//
//   press     6 frames, 1 mm down (guide 03 section 5): the stack gives under the grip. Nothing starts instantly.
//   rise      the slide, the lift and the turn each have a window of the rise; they overlap, so the book travels on an arc
//   arrive    a little PAST the reading pose (3 degrees of turn, 3.5 mm of height), then back by the spring `bookSway`
//   sway      the hand-held noise of `hold.ts` fades in as the book leaves the desk
//
// A heavier book takes longer and overshoots and sways less (`config/bookMotion.ts`). The whole path is a pure function of the frame number.
//
// The rig knows only where the book starts (its pose on the pile) and where it is held; WHERE those are is the ledger's (Patch 12).

import { MOTION, framesFor, swayScale } from "../../config/bookMotion";
import { BOOKS, type BookId, type BookPose } from "../../config/books";
import { FPS } from "../../config/timeline";
import { EASES } from "../../lib/ease";
import { springAt } from "../../lib/spring";
import { readingPose, swayAt, swaySeedOf, withSway } from "./hold";
import { angleBetweenDeg, lerpV3, poseOf, quatOfPose, slerp, smoothIn, type V3 } from "./pose";
import type { Window } from "../../config/bookMotion";

export interface LiftParams {
  id: BookId;
  /** the first frame of the press */
  start: number;
  /** the pose on the pile, closed and lying (the top book of the pile) */
  rest: BookPose;
  /** where it is held; default `readingPose()` */
  reading?: BookPose;
  /** 1 is normal; 1.3 is about 30 percent faster (the second book, guide 01 Act 6) */
  speed?: number;
}

export interface LiftTimes {
  /** the first frame of the press */
  start: number;
  /** the first frame of the rise (the press ends) */
  riseStart: number;
  /** the frame the rise reaches the reading pose (the overshoot's peak) */
  riseEnd: number;
  /** the frame the book is back within a tenth of a degree and a tenth of a millimetre of the reading pose, apart from the sway */
  settled: number;
  riseFrames: number;
  pressFrames: number;
}

/** The frames of a lift. */
export function liftTimes(id: BookId, start: number, speed = 1): LiftTimes {
  const w = BOOKS[id].weightG;
  const pressFrames = Math.max(MOTION.minFrames, Math.round(MOTION.lift.pressFrames / speed));
  const riseFrames = framesFor(MOTION.lift.riseFrames, w, speed);
  const riseStart = start + pressFrames;
  const riseEnd = riseStart + riseFrames;
  return { start, riseStart, riseEnd, settled: riseEnd + settleFramesOf(id), riseFrames, pressFrames };
}

/** Frames the spring needs to bring the overshoot back under a tenth of a degree (see the test: it is within the S04 shot). */
function settleFramesOf(id: BookId): number {
  const A = MOTION.lift.overshootDeg * swayScale(BOOKS[id].weightG);
  const spring = MOTION.lift.spring;
  for (let f = 0; f < 600; f++) if (Math.abs(springAt(f / FPS, spring, 1, 0, 0)) * A < 0.1) return f;
  return 600;
}

/**
 * How far the stack under the book is pressed down, cm: 0 before the press, `pressCm` after `pressFrames`, and back to 0 over the first
 * `2 x pressFrames` of the rise as the book comes off it. The pile's other books can use it too (the top of the stack gives 1 mm).
 */
export function stackPressCm(frame: number, id: BookId, start: number, speed = 1): number {
  const t = liftTimes(id, start, speed);
  const L = MOTION.lift;
  if (frame <= t.start) return 0;
  if (frame < t.riseStart) return L.pressCm * smoothIn(frame, [t.start, t.riseStart]);
  const release = 2 * t.pressFrames;
  return L.pressCm * (1 - smoothIn(frame, [t.riseStart, t.riseStart + release]));
}

/**
 * One channel of the rise: eased to (1 + over) over its window, then back to 1 by the spring. `u` is the rise's progress in frames
 * (0 at its start, `riseFrames` at its end). With `over` 0 it is a plain eased channel.
 */
function channel(frames: number, riseFrames: number, w: Window, ease: keyof typeof EASES, over: number): number {
  const from = riseFrames * w[0];
  const dur = Math.max(1, riseFrames * (w[1] - w[0]));
  const t = frames - from;
  if (t <= 0) return 0;
  if (t < dur) return (1 + over) * EASES[ease](t / dur);
  return springAt((t - dur) / FPS, MOTION.lift.spring, 1 + over, 1, 0);
}

/** The pose of the lifted book at an absolute frame: the rest pose before the press, the reading pose (with its sway) after the rise. */
export function liftPoseAt(frame: number, p: LiftParams): BookPose {
  const L = MOTION.lift;
  const spec = BOOKS[p.id];
  const speed = p.speed ?? 1;
  const reading = p.reading ?? readingPose();
  const t = liftTimes(p.id, p.start, speed);
  const press = stackPressCm(frame, p.id, p.start, speed);
  if (frame <= t.start) return p.rest;
  const k = swayScale(spec.weightG);

  const q0 = quatOfPose(p.rest);
  const q1 = quatOfPose(reading);
  const turnDeg = angleBetweenDeg(q0, q1);
  const rise = Math.max(1e-6, reading.position[1] - p.rest.position[1]);
  const frames = frame - t.riseStart;
  const overTurn = turnDeg > 1e-6 ? (L.overshootDeg * k) / turnDeg : 0;
  const overY = (L.overshootCm * k) / rise;

  // across (the slide towards the camera) and up are separate channels with their own windows
  const across = channel(frames, t.riseFrames, L.slide, L.slideEase, 0);
  const up = channel(frames, t.riseFrames, L.rise, L.riseEase, overY);
  const turn = channel(frames, t.riseFrames, L.turn, L.turnEase, overTurn);

  const flat = lerpV3(p.rest.position as V3, reading.position as V3, across);
  const position: V3 = [flat[0], p.rest.position[1] - press + (reading.position[1] - p.rest.position[1]) * up, flat[2]];
  const base = poseOf(position, slerp(q0, q1, turn));

  // the hand's sway comes in as the book leaves the desk and is whole by the end of the rise
  const fade = frames <= 0 ? 0 : smoothIn(frames, [t.riseFrames * L.swayIn[0], t.riseFrames * L.swayIn[1]]);
  return withSway(base, swayAt(frame, swaySeedOf(p.id), spec.weightG, fade));
}

/** The frames of the lift as `{ from, to }` spans for the ribbon's activity: the press and the rise. */
export const liftSpan = (id: BookId, start: number, speed = 1): { from: number; to: number } => {
  const t = liftTimes(id, start, speed);
  return { from: t.start, to: t.riseEnd };
};