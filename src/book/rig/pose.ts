// SHARED MATHS OF THE BOOK RIGS (Patch 11). A pose is position + yaw, pitch, roll in degrees applied in the order Y, X, Z (guide 02,
// `BookPose`); the rigs interpolate ORIENTATION as a quaternion (one smooth turn about one axis, not three angles drifting apart) and give
// the result back as a `BookPose`. Pure functions: nothing here reads a frame.

import * as THREE from "three";
import { BOOKS, type BookId, type BookPose } from "../../config/books";
import { FPS } from "../../config/timeline";
import { EASES, clamp01, type EaseName } from "../../lib/ease";
import { toDeg } from "../../lib/units";
import { poseEuler } from "../geometry";
import type { Window } from "../../config/bookMotion";

export type V3 = readonly [number, number, number];

export const quatOfPose = (pose: BookPose): THREE.Quaternion => new THREE.Quaternion().setFromEuler(poseEuler(pose));

/** A pose from a position and an orientation (the Euler angles are the book's order Y, X, Z). */
export function poseOf(position: V3, q: THREE.Quaternion): BookPose {
  const e = new THREE.Euler().setFromQuaternion(q.clone().normalize(), "YXZ");
  return { position: [position[0], position[1], position[2]], yawDeg: toDeg(e.y), pitchDeg: toDeg(e.x), rollDeg: toDeg(e.z) };
}

/**
 * Spherical interpolation along the shortest arc. `t` outside 0 to 1 extrapolates along the same arc (a little past the end, which is
 * how a move overshoots its target); it stays well defined for `t` up to about 1.2 for the half-turns of this film.
 */
export function slerp(a: THREE.Quaternion, b: THREE.Quaternion, t: number): THREE.Quaternion {
  let cos = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;
  if (cos < 0) {
    cos = -cos;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (cos > 0.9995) {
    return new THREE.Quaternion(a.x + (bx - a.x) * t, a.y + (by - a.y) * t, a.z + (bz - a.z) * t, a.w + (bw - a.w) * t).normalize();
  }
  const theta = Math.acos(cos);
  const s = Math.sin(theta);
  const ka = Math.sin((1 - t) * theta) / s;
  const kb = Math.sin(t * theta) / s;
  return new THREE.Quaternion(ka * a.x + kb * bx, ka * a.y + kb * by, ka * a.z + kb * bz, ka * a.w + kb * bw).normalize();
}

/** The angle between two orientations, degrees (0 to 180). */
export function angleBetweenDeg(a: THREE.Quaternion, b: THREE.Quaternion): number {
  const cos = Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w));
  return toDeg(2 * Math.acos(cos));
}

export const lerpV3 = (a: V3, b: V3, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Progress inside a window of a move (0 before it, 1 after it), eased. */
export function windowed(u: number, w: Window, ease: EaseName): number {
  const span = Math.max(1e-9, w[1] - w[0]);
  return EASES[ease](clamp01((u - w[0]) / span));
}

/** A smooth 0 to 1 over a window (a smoothstep, no easing choice): how fast a layer of the motion fades in or out. */
export function smoothIn(u: number, w: Window): number {
  const x = clamp01((u - w[0]) / Math.max(1e-9, w[1] - w[0]));
  return x * x * (3 - 2 * x);
}

/** Frames to seconds. */
export const seconds = (frames: number): number => frames / FPS;

/**
 * A cubic with zero slope at the start that reaches 1 at u = 1 with the slope `m` (a multiple of the mean slope of 1). It is the
 * way a move arrives with SPEED and hands over to a spring or a contact without a jump in velocity. Monotonic for m from 0 to 3.
 */
export const hermiteIn = (u: number, m: number): number => {
  const x = clamp01(u);
  return (3 - m) * x * x + (m - 2) * x * x * x;
};

/**
 * A bounce: the first lobes of a damped sine, always on the positive side (a board or a book cannot go through what it lands on).
 * `speed` is the speed it left with, in units per second; the result is in the same units. It starts at 0 and is 0 again after
 * the spring's first half period (the settle of 4 to 6 frames, guide 03 section 5), then keeps decaying as a smaller second lobe.
 */
export function bounceAt(t: number, speed: number, zeta: number, hz: number): number {
  if (t <= 0) return 0;
  const w0 = 2 * Math.PI * hz;
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return Math.abs((speed / wd) * Math.exp(-zeta * w0 * t) * Math.sin(wd * t));
}

/** The height of the biggest lobe of `bounceAt` for a launch speed of 1: dividing by it makes a bounce of a stated height. */
export function bouncePeak(zeta: number, hz: number): number {
  const w0 = 2 * Math.PI * hz;
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  const theta = Math.atan2(wd, zeta * w0);
  return (Math.exp((-zeta * w0 * theta) / wd) * Math.sin(theta)) / wd;
}

/** A bounce whose biggest lobe is `height` high (the same units as `height`), `t` seconds after the touch. */
export const reboundAt = (t: number, height: number, zeta: number, hz: number): number => (height * bounceAt(t, 1, zeta, hz)) / bouncePeak(zeta, hz);

/** The first half period of a spring's bounce, in frames: how long its biggest lobe lasts. */
export function bounceLobeFrames(zeta: number, hz: number): number {
  const w0 = 2 * Math.PI * hz;
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return (Math.PI / wd) * FPS;
}

const CORNERS = (id: BookId): THREE.Vector3[] => {
  const s = BOOKS[id];
  const T = s.spine + 2 * s.board;
  const out: THREE.Vector3[] = [];
  for (const x of [-s.trimW / 2, s.trimW / 2]) for (const y of [0, T]) for (const z of [-s.trimH / 2, s.trimH / 2]) out.push(new THREE.Vector3(x, y, z));
  return out;
};

/** The lowest point of the CLOSED book's box in the world, cm (the desk is y = 0). */
export function lowestPointCm(id: BookId, pose: BookPose): number {
  const m = new THREE.Matrix4().makeRotationFromEuler(poseEuler(pose));
  let low = Infinity;
  for (const c of CORNERS(id)) low = Math.min(low, c.clone().applyMatrix4(m).y + pose.position[1]);
  return low;
}

/** How far the pose's origin has to stand above a surface for the closed book to rest on it, cm. */
export function restHeightOn(id: BookId, pose: BookPose, surfaceY = 0): number {
  return surfaceY - lowestPointCm(id, { ...pose, position: [pose.position[0], 0, pose.position[2]] });
}

/** The world corners of the closed book's footprint on the desk, as (X, Zd) in desk coordinates (Zd is minus world Z). */
export function footprintOf(id: BookId, pose: BookPose): { X: number; Zd: number }[] {
  const m = new THREE.Matrix4().makeRotationFromEuler(poseEuler(pose));
  const s = BOOKS[id];
  const out: { X: number; Zd: number }[] = [];
  for (const x of [-s.trimW / 2, s.trimW / 2]) for (const z of [-s.trimH / 2, s.trimH / 2]) {
    const p = new THREE.Vector3(x, 0, z).applyMatrix4(m);
    out.push({ X: p.x + pose.position[0], Zd: -(p.z + pose.position[2]) });
  }
  return out;
}