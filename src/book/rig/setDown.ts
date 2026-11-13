// THE SET-DOWN (Patch 11, shot S15 and S21). The held book is carried across, turned flat and lowered to the desk beside the pile:
//
//   carry     it leaves the reading pose; the sway fades out over the first part; it goes across, turns flat and comes down on
//             different windows, so the path is an arc and not a straight line
//   touch     it lands with a little speed (a fraction of its mean descent) and no more than that; no instant stops
//   settle    a rebound of 0.3 mm by the spring `settle`, 4 to 6 frames long (guide 03 section 5), then it is still
//
// A heavier book takes longer. A pure function of the frame number.

import { MOTION, framesFor } from "../../config/bookMotion";
import { BOOKS, type BookId, type BookPose } from "../../config/books";
import { FPS } from "../../config/timeline";
import { readingPose, swayAt, swaySeedOf, withSway } from "./hold";
import { hermiteIn, lerpV3, poseOf, quatOfPose, reboundAt, slerp, smoothIn, windowed, type V3 } from "./pose";

export interface SetDownParams {
  id: BookId;
  /** the first frame of the carry (the frame the book leaves the hold) */
  start: number;
  /** where it comes to rest on the desk: closed, lying, its underside on the desk (position y is the resting height) */
  rest: BookPose;
  /** where it is held; default `readingPose()` */
  reading?: BookPose;
  speed?: number;
}

export interface SetDownTimes {
  start: number;
  /** the frame it touches the desk */
  contact: number;
  /** the frame it is completely at rest (the rebound has died) */
  rest: number;
  carryFrames: number;
}

export function setDownTimes(id: BookId, start: number, speed = 1): SetDownTimes {
  const carryFrames = framesFor(MOTION.setDown.carryFrames, BOOKS[id].weightG, speed);
  return { start, contact: start + carryFrames, rest: start + carryFrames + MOTION.restAfterFrames, carryFrames };
}

/** The pose of the book being set down at an absolute frame: the held pose (with its sway) before `start`, the rest pose after the settle. */
export function setDownPoseAt(frame: number, p: SetDownParams): BookPose {
  const S = MOTION.setDown;
  const spec = BOOKS[p.id];
  const reading = p.reading ?? readingPose();
  const t = setDownTimes(p.id, p.start, p.speed ?? 1);
  if (frame <= t.start) return withSway(reading, swayAt(frame, swaySeedOf(p.id), spec.weightG));
  if (frame >= t.rest) return p.rest;

  const u = Math.min(1, (frame - t.start) / t.carryFrames);
  const across = windowed(u, S.across, S.acrossEase);
  const turn = windowed(u, S.turn, S.turnEase);
  // the descent: it starts from rest and lands at `landSlope` times its mean speed
  const lowerU = Math.min(1, Math.max(0, (u - S.lower[0]) / (S.lower[1] - S.lower[0])));
  const down = hermiteIn(lowerU, S.landSlope);

  const flat = lerpV3(reading.position as V3, p.rest.position as V3, across);
  const drop = reading.position[1] - p.rest.position[1];
  const touchedFor = (frame - t.contact) / FPS;
  const y = p.rest.position[1] + drop * (1 - down) + (frame > t.contact ? reboundAt(touchedFor, S.reboundCm, S.reboundSpring.zeta, S.reboundSpring.hz) : 0);
  const base = poseOf([flat[0], y, flat[2]], slerp(quatOfPose(reading), quatOfPose(p.rest), turn));

  // the sway leaves as the book is carried away
  const fade = 1 - smoothIn(u, S.swayOut);
  return fade > 0 ? withSway(base, swayAt(frame, swaySeedOf(p.id), spec.weightG, fade)) : base;
}

/** The frames of the set-down as a `{ from, to }` span for the ribbon's activity: the carry. */
export const setDownSpan = (id: BookId, start: number, speed = 1): { from: number; to: number } => {
  const t = setDownTimes(id, start, speed);
  return { from: t.start, to: t.contact };
};
