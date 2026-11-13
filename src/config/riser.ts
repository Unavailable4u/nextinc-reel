// THE RISER AS NUMBERS (Patch 12). Where the two tiers, the brass lips and the four standing books are, worked out from the data of
// `RISER` in `config/books.ts` and the anchor of zone R. Pure functions, no React: the ledger reads the poses from here, `scene/Riser.tsx`
// draws the boxes, and the tests check both against the desk.
//
// FRAME. Desk coordinates as everywhere (guide 02): X to the right, Zd from the desk's front edge towards the wall, Y up from the desk
// top, and the world point of a desk point is (X, Y, -Zd). The riser stands with its footprint centred on the zone's anchor, so its
// front edge is at `anchor.Zd - depth / 2`.
//
// A STANDING BOOK. A book lies face up in its own frame (X spine to fore-edge, Y up from the underside of the back board, Z head to tail).
// Standing, with the cover to the camera and the spine on the left, is a pitch of 90 degrees (the rotation about X that takes the cover's
// normal +Y to world +Z); leaning back by `leanDeg` is a pitch of `90 - leanDeg`, which is how the reading pose tilts the head back too.
// It then rests on the edge where the back board meets the tail, the lowest edge, and the edge where the cover meets the tail is
// `thickness x tan(lean)` higher, which is the clearance under the cover that the brass lip hides.

import * as THREE from "three";
import { BOOKS, RISER, closedThickness, type BookId, type BookPose } from "./books";
import { ZONES } from "./placement";
import { poseEuler } from "../book/geometry";
import { restHeightOn } from "../book/rig/pose";

export type TierName = "lower" | "upper";

/** A box on the desk: x0 to x1 across, zd0 (nearer the camera) to zd1, y0 to y1 up. */
export interface DeskBox {
  x0: number;
  x1: number;
  zd0: number;
  zd1: number;
  y0: number;
  y1: number;
}

export interface RiserBoxes {
  lower: DeskBox;
  upper: DeskBox;
  lipLower: DeskBox;
  lipUpper: DeskBox;
}

/** The two tiers and their two lips, in desk coordinates. */
export function riserBoxes(anchor: { X: number; Zd: number } = ZONES.R.anchor): RiserBoxes {
  const x0 = anchor.X - RISER.widthCm / 2;
  const x1 = anchor.X + RISER.widthCm / 2;
  const zFront = anchor.Zd - RISER.depthCm / 2;
  const zBack = anchor.Zd + RISER.depthCm / 2;
  const lowerTop = RISER.lowerTopCm;
  const upperTop = RISER.lowerTopCm + RISER.riseCm;
  const step = zFront + RISER.setBackCm;
  const lip = RISER.lip;
  return {
    lower: { x0, x1, zd0: zFront, zd1: step, y0: 0, y1: lowerTop },
    upper: { x0, x1, zd0: step, zd1: zBack, y0: 0, y1: upperTop },
    lipLower: { x0: x0 + lip.insetCm, x1: x1 - lip.insetCm, zd0: zFront, zd1: zFront + lip.depthCm, y0: lowerTop, y1: lowerTop + lip.heightCm },
    lipUpper: { x0: x0 + lip.insetCm, x1: x1 - lip.insetCm, zd0: step, zd1: step + lip.depthCm, y0: upperTop, y1: upperTop + lip.heightCm },
  };
}

/** The footprint of the whole riser on the desk, as a rectangle for the exclusion and zone checks. */
export function riserFootprint(anchor: { X: number; Zd: number } = ZONES.R.anchor): { x0: number; x1: number; zd0: number; zd1: number } {
  return { x0: anchor.X - RISER.widthCm / 2, x1: anchor.X + RISER.widthCm / 2, zd0: anchor.Zd - RISER.depthCm / 2, zd1: anchor.Zd + RISER.depthCm / 2 };
}

/** The patch of contact under a standing book: its foot, lying on the tier (what the contact decal is drawn for). */
export interface FootPatch {
  X: number;
  Zd: number;
  /** the height of the tier's top, cm */
  y: number;
  /** across the book (its width) and along the desk (its thickness seen from above), cm */
  w: number;
  d: number;
  yawDeg: number;
}

export interface RiserSlot {
  id: BookId;
  /** 1 to 4 */
  volume: 1 | 2 | 3 | 4;
  tier: TierName;
  pose: BookPose;
  /** the height of the tier the book stands on */
  tierTopY: number;
  foot: FootPatch;
}

/** The pitch of a book standing and leaning back, degrees. */
export const standingPitchDeg = (): number => 90 - RISER.leanDeg;

/** The four books of the riser: Vol. I to Vol. IV, each on its tier, leaning back, its foot behind the lip. */
export function getRiserSlots(anchor: { X: number; Zd: number } = ZONES.R.anchor): RiserSlot[] {
  const zFront = anchor.Zd - RISER.depthCm / 2;
  return RISER.slots.map((s): RiserSlot => {
    const spec = BOOKS[s.id];
    const T = closedThickness(spec);
    const tierTopY = s.tier === "lower" ? RISER.lowerTopCm : RISER.lowerTopCm + RISER.riseCm;
    const tierFrontZd = s.tier === "lower" ? zFront : zFront + RISER.setBackCm;
    // where the edge between the cover and the tail stands: just behind the lip
    const frontEdgeZd = tierFrontZd + RISER.lip.depthCm + RISER.lip.clearanceCm;
    const turn: BookPose = { position: [0, 0, 0], yawDeg: s.yawDeg, pitchDeg: standingPitchDeg() };
    const m = new THREE.Matrix4().makeRotationFromEuler(poseEuler(turn));
    // the book's frame to the world: the cover-and-tail edge's middle, and the middle of the foot
    const front = new THREE.Vector3(0, T, spec.trimH / 2).applyMatrix4(m);
    const mid = new THREE.Vector3(0, T / 2, spec.trimH / 2).applyMatrix4(m);
    const X = anchor.X + s.dxCm;
    const z = -frontEdgeZd - front.z;
    const y = restHeightOn(s.id, { ...turn, position: [X, 0, z] }, tierTopY);
    const pose: BookPose = { position: [X, y, z], yawDeg: s.yawDeg, pitchDeg: standingPitchDeg() };
    return {
      id: s.id,
      volume: spec.volume,
      tier: s.tier,
      pose,
      tierTopY,
      foot: { X: X + mid.x, Zd: -(z + mid.z), y: tierTopY, w: spec.trimW, d: T * Math.cos((RISER.leanDeg * Math.PI) / 180), yawDeg: s.yawDeg },
    };
  });
}

const cache = new Map<string, RiserSlot[]>();

/** The slots at the zone's own anchor, made once (they are a pure function of the data). */
export function riserSlots(): RiserSlot[] {
  const k = `${ZONES.R.anchor.X},${ZONES.R.anchor.Zd}`;
  let hit = cache.get(k);
  if (!hit) {
    hit = getRiserSlots();
    cache.set(k, hit);
  }
  return hit;
}

/** The pose of one book on the riser. */
export function riserPose(id: BookId): BookPose {
  const s = riserSlots().find((x) => x.id === id);
  if (!s) throw new Error(`riser: ${id} is not one of the riser's books (${RISER.slots.map((x) => x.id).join(", ")})`);
  return s.pose;
}

/** The world corners of a standing book's closed box, for the checks (desk coordinates: X, Y, Zd). */
export function standingCorners(id: BookId, pose: BookPose): { X: number; Y: number; Zd: number }[] {
  const spec = BOOKS[id];
  const T = closedThickness(spec);
  const m = new THREE.Matrix4().makeRotationFromEuler(poseEuler(pose));
  const out: { X: number; Y: number; Zd: number }[] = [];
  for (const x of [-spec.trimW / 2, spec.trimW / 2]) for (const y of [0, T]) for (const z of [-spec.trimH / 2, spec.trimH / 2]) {
    const p = new THREE.Vector3(x, y, z).applyMatrix4(m);
    out.push({ X: p.x + pose.position[0], Y: p.y + pose.position[1], Zd: -(p.z + pose.position[2]) });
  }
  return out;
}
