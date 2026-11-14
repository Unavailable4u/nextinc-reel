// THE HELD BOOK (Patch 11). The reading pose and the sway of a book held in a hand (guide 03 section 5: "a held book that is perfectly
// steady looks like a rendering"): two noise layers, 0.3 Hz at 0.4 degrees and 1.1 Hz at 0.15 degrees, with 0.8 mm of position noise,
// scaled down for a heavy book (`config/bookMotion.ts`). The ribbon tail swings with the book's motion.
//
// Everything is a pure function of the FRAME NUMBER: the noise tables are seeded by the book, so the same frame of the same book is the
// same in every render. The lift and the set-down both call `swayAt` with the same seed and the same absolute frame, which is what
// keeps the pose continuous where they hand over to the hold.

import type { BookPose } from "../../config/books";
import { BOOKS, type BookId } from "../../config/books";
import { MOTION, swayScale } from "../../config/bookMotion";
import type { HeroOffset } from "../../config/heroMotion";
import { ZONES } from "../../config/placement";
import { FPS } from "../../config/timeline";
import { clamp, clamp01 } from "../../lib/ease";
import { makeNoise, type Noise } from "../../lib/noise";
import { quatOfPose } from "./pose";
import * as THREE from "three";

const noises = new Map<number, Noise>();
function noiseOf(seed: number): Noise {
  let n = noises.get(seed);
  if (!n) {
    n = makeNoise(seed);
    noises.set(seed, n);
  }
  return n;
}

/** The book's own seed for its sway: its page block's seed, so no two books sway alike and a book always sways the same way. */
export const swaySeedOf = (id: BookId): number => BOOKS[id].seeds.block + 7000;

export interface Sway {
  /** cm, in the world's axes */
  dx: number;
  dy: number;
  dz: number;
  /** degrees, added to the pose's yaw, pitch and roll */
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

export const NO_SWAY: Sway = { dx: 0, dy: 0, dz: 0, yawDeg: 0, pitchDeg: 0, rollDeg: 0 };

/**
 * The sway of a held book at an absolute frame. `weightG` makes a heavy book sway less; `fade` (0 to 1) is how much of it is there:
 * the lift fades it in as the book rises and the set-down fades it out, so it is never switched on or off.
 */
export function swayAt(frame: number, seed: number, weightG: number, fade = 1): Sway {
  const t = frame / FPS;
  const n = noiseOf(seed);
  const k = swayScale(weightG) * clamp01(fade);
  const S = MOTION.sway;
  const layer = (ch: number, amp: readonly [number, number]): number => {
    const off = ch * 101.3 + (seed % 97) * 0.37;
    return amp[0] * n.n1(t * S.hz[0] + off) + amp[1] * n.n1(t * S.hz[1] + off + 53.1);
  };
  return {
    dx: k * layer(0, S.positionCm),
    dy: k * layer(1, S.positionCm),
    dz: k * layer(2, S.positionCm),
    yawDeg: k * layer(3, S.rotationDeg),
    pitchDeg: k * layer(4, S.rotationDeg),
    rollDeg: k * layer(5, S.rotationDeg),
  };
}

/** A pose with a sway added to it. */
export function withSway(pose: BookPose, s: Sway): BookPose {
  return {
    position: [pose.position[0] + s.dx, pose.position[1] + s.dy, pose.position[2] + s.dz],
    yawDeg: (pose.yawDeg ?? 0) + s.yawDeg,
    pitchDeg: (pose.pitchDeg ?? 0) + s.pitchDeg,
    rollDeg: (pose.rollDeg ?? 0) + s.rollDeg,
  };
}

/**
 * The reading pose of a held book (without the sway): standing up, cover to the camera, spine on the left, standing at the pile's
 * anchor moved `forwardCm` towards the camera and `heightCm` up (`MOTION.reading`). World Z is minus the desk's Zd.
 */
export function readingPose(anchor: { X: number; Zd: number } = ZONES.L.anchor): BookPose {
  const R = MOTION.reading;
  return { position: [anchor.X + R.dxCm, R.heightCm, -(anchor.Zd - R.forwardCm)], yawDeg: R.yawDeg, pitchDeg: R.pitchDeg, rollDeg: R.rollDeg };
}

/**
 * A held pose with the hero motion added (`config/heroMotion.ts`: the cover hero's orbit and the reading tilt). The book turns about the
 * middle of its closed self, not about its spine, so the orbit swings the cover in place instead of swinging the book round its hinge: the
 * position is moved by exactly the difference the turn makes to where that middle point goes. With no offset the pose is returned as it is.
 */
export function withHero(pose: BookPose, id: BookId, o: HeroOffset): BookPose {
  if (o.yawDeg === 0 && o.pitchDeg === 0) return pose;
  const spec = BOOKS[id];
  const middle = new THREE.Vector3(0, (spec.spine + 2 * spec.board) / 2, 0);
  const turned: BookPose = { position: pose.position, yawDeg: (pose.yawDeg ?? 0) + o.yawDeg, pitchDeg: (pose.pitchDeg ?? 0) + o.pitchDeg, rollDeg: pose.rollDeg ?? 0 };
  const before = middle.clone().applyQuaternion(quatOfPose(pose));
  const after = middle.clone().applyQuaternion(quatOfPose(turned));
  const d = before.sub(after);
  return { position: [pose.position[0] + d.x, pose.position[1] + d.y, pose.position[2] + d.z], yawDeg: turned.yawDeg, pitchDeg: turned.pitchDeg, rollDeg: turned.rollDeg };
}

/** The reading pose and its sway at an absolute frame: what a held book does while the cover opens and the pages turn. */
export function holdPose(id: BookId, frame: number, anchor?: { X: number; Zd: number }): BookPose {
  return withSway(readingPose(anchor), swayAt(frame, swaySeedOf(id), BOOKS[id].weightG));
}

/** The orientation of the reading pose (the end of the lift, the start of the set-down). */
export const readingQuat = (anchor?: { X: number; Zd: number }): THREE.Quaternion => quatOfPose(readingPose(anchor));

/** A trapezoid between 0 and 1: it rises over `rise` frames before `from`, stays 1 to `to`, and falls over `fall` frames after it. */
export function trapezoid(frame: number, from: number, to: number, rise: number, fall: number): number {
  if (frame < from - rise || frame > to + fall) return 0;
  if (frame < from) return (frame - (from - rise)) / rise;
  if (frame <= to) return 1;
  return 1 - (frame - to) / fall;
}

/** How much the book is moving at this frame (0 to 1): the largest trapezoid over the spans of the book's moves. It drives the ribbon. */
export function motionActivity(frame: number, spans: readonly { from: number; to: number }[]): number {
  let a = 0;
  for (const s of spans) a = Math.max(a, trapezoid(frame, s.from, s.to, MOTION.ribbon.riseFrames, MOTION.ribbon.fallFrames));
  const x = clamp01(a);
  return x * x * (3 - 2 * x);
}

/**
 * The ribbon tail's swing (-1 to 1, `Book`'s `ribbonSwing`): a slow wander that is always there (0.1) and a livelier swing in
 * proportion to how much the book is moving. Heavy books move less, so the ribbon does too.
 */
export function ribbonSwingAt(frame: number, seed: number, weightG: number, activity: number): number {
  const t = frame / FPS;
  const n = noiseOf(seed + 1);
  const R = MOTION.ribbon;
  const k = clamp(swayScale(weightG), 0.5, 1.5);
  return clamp(k * (R.idleSwing * n.n1(t * R.idleHz + 211.7) + R.swing * clamp01(activity) * n.n1(t * R.hz + 307.9)), -1, 1);
}