// THE BOOK AS GEOMETRY (Patch 06). Pure functions: a spec and a state in, three.js geometry and numbers out. No React, no frame
// reads, no Math.random (every wobble is seeded), so the same props always give the same vertices. The tests build real geometry
// from here and measure it.
//
// THE BOOK FRAME (cm). X from the spine (-W/2) to the fore-edge (+W/2); Y up, 0 at the underside of the back board; Z from the head
// (-H/2) to the tail (+H/2). Closed, the book is W x H x T with T = spine + 2 x board (Mini Me 15.2 x 22.9 x 3.0).
//
//   y = T      ------------------------------  front board  (it swings open about the hinge axis)
//   y = b+t    ------------------------------  inner face of the front board, pasted down with endpaper
//              ::::::::::::::::::::::::::::::  page block, t thick, split in two when sheets are turned
//   y = b      ------------------------------  inner face of the back board
//   y = 0      ------------------------------  back board
//   spine: a rounded back of radius R, apex at x = -W/2, in two halves that meet at the hinge axis (x = -W/2 + cloth/2, y = T/2)
//
// The hinge axis runs along Z through the middle of the spine cloth at the apex. The front board, its half of the spine, its hinge
// strip, its endpaper and the turned sheets form the COVER group and rotate together about it: 0 closed, PI (coverAngle 1) lying
// flat. Rotating by +angle about +Z lifts the fore-edge up and over towards -X.

import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BOOK_GEOMETRY as G, closedThickness, sheetCount, type BookPose, type BookSpec } from "../config/books";
import { makeNoise } from "../lib/noise";
import { prng, range } from "../lib/prng";
import { deg } from "../lib/units";

export type Vec3 = [number, number, number];

/** The numbers every part is built from, all derived from the spec and `BOOK_GEOMETRY`. */
export interface BookLayout {
  W: number;
  H: number;
  /** board thickness */
  b: number;
  /** square */
  sq: number;
  /** page-block thickness (the spec's `spine`) */
  t: number;
  /** closed thickness */
  T: number;
  /** spine cloth thickness */
  cloth: number;
  /** radius of the spine's outer surface; the block's rounded back has `R - cloth` */
  R: number;
  /** how far the arc's ends sit in from the apex, in x (the sagitta) */
  sagitta: number;
  /** x of the centre of curvature */
  xc: number;
  /** y of the hinge axis (the middle of the thickness) */
  ym: number;
  /** x of the hinge axis */
  xp: number;
  /** x of the boards' spine edge (the hinge groove) */
  hingeX: number;
  /** where the page block starts and ends in y when closed (inside the endpapers) */
  yBlock0: number;
  yBlock1: number;
  /** block thickness between the endpapers */
  tBlock: number;
  /** x of the block's fore-edge, z of its head and tail faces */
  xFore: number;
  zHead: number;
  zTail: number;
  sheets: number;
}

export function layoutOf(spec: BookSpec): BookLayout {
  const W = spec.trimW;
  const H = spec.trimH;
  const b = spec.board;
  const sq = spec.square;
  const t = spec.spine;
  const T = closedThickness(spec);
  const R = G.spineRadiusCm;
  const sagitta = R - Math.sqrt(R * R - (T / 2) * (T / 2));
  const xc = -W / 2 + R;
  const pd = G.pastedownCm;
  return {
    W,
    H,
    b,
    sq,
    t,
    T,
    cloth: G.clothCm,
    R,
    sagitta,
    xc,
    ym: T / 2,
    xp: -W / 2 + G.clothCm / 2,
    hingeX: -W / 2 + Math.max(G.hingeFromSpineCm, sagitta + G.grooveMinCm),
    yBlock0: b + pd,
    yBlock1: b + t - pd,
    tBlock: t - 2 * pd,
    xFore: W / 2 - sq,
    zHead: -H / 2 + sq,
    zTail: H / 2 - sq,
    sheets: sheetCount(spec),
  };
}

/** x of the rounded back's outer surface at height y (the spine cloth's outside). */
const spineOuterX = (L: BookLayout, y: number): number => L.xc - Math.sqrt(L.R * L.R - (y - L.ym) * (y - L.ym));
/** x of the page block's rounded back at height y (the inside of the spine cloth). */
const blockBackX = (L: BookLayout, y: number): number => {
  const r = L.R - L.cloth;
  return L.xc - Math.sqrt(r * r - (y - L.ym) * (y - L.ym));
};

// ---------------------------------------------------------------------------------------------------------------------------
// state
// ---------------------------------------------------------------------------------------------------------------------------

export interface BookState {
  /** 0 closed to 1 fully open (flat). A spring may overshoot a little past 1; the geometry follows. */
  coverAngle: number;
  /** how many sheets have been turned to the left (0 to `pages / 2`); with the cover closed it is 0 */
  turned: number;
}

/** The split of the page block: the right stack stays on the back board, the left stack rides on the cover. Heights in y (closed frame). */
export interface BlockSplit {
  /** fraction of the sheets turned, 0 to 1 */
  fraction: number;
  /** the plane where the two stacks meet, y */
  yMid: number;
  rightThickness: number;
  leftThickness: number;
}
export function splitOf(spec: BookSpec, turned: number): BlockSplit {
  const L = layoutOf(spec);
  const fraction = Math.min(1, Math.max(0, turned / L.sheets));
  const yMid = L.yBlock0 + L.tBlock * (1 - fraction);
  return { fraction, yMid, rightThickness: yMid - L.yBlock0, leftThickness: L.yBlock1 - yMid };
}

/** The matrix that swings the cover group about the hinge axis (book frame). */
export function coverMatrix(spec: BookSpec, coverAngle: number): THREE.Matrix4 {
  const L = layoutOf(spec);
  const m = new THREE.Matrix4().makeTranslation(L.xp, L.ym, 0);
  m.multiply(new THREE.Matrix4().makeRotationZ(coverAngle * Math.PI));
  m.multiply(new THREE.Matrix4().makeTranslation(-L.xp, -L.ym, 0));
  return m;
}

// ---------------------------------------------------------------------------------------------------------------------------
// boards, spine, hinge, endpapers, bands
// ---------------------------------------------------------------------------------------------------------------------------

function roundedRect(shape: THREE.Shape, x: number, y: number, w: number, h: number, r: number): void {
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
}

/** A cover board, bevelled 0.8 mm all round, at y = 0 .. b (the back board). The front board is the same plate moved up. */
function boardPlate(L: BookLayout): THREE.BufferGeometry {
  const bt = G.bevelCm;
  const shape = new THREE.Shape();
  roundedRect(shape, L.hingeX, -L.H / 2, L.W / 2 - L.hingeX, L.H, G.cornerRadiusCm);
  // bevelOffset = -bevelSize keeps the side walls on the outline; only the two faces are drawn in by the bevel
  const geo = new THREE.ExtrudeGeometry(shape, { depth: L.b - 2 * bt, bevelEnabled: true, bevelThickness: bt, bevelSize: bt, bevelOffset: -bt, bevelSegments: 3, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2); // (x, y, z) -> (x, z, -y): the extrusion axis becomes up, the plan's y becomes -Z
  geo.translate(0, bt, 0);
  return toCreasedNormals(geo, deg(40));
}

/** One half of the rounded back as a thin shell, extruded along Z over the full height. `y0..y1` selects the back (0..ym) or front (ym..T) half. */
function spineHalf(L: BookLayout, y0: number, y1: number): THREE.BufferGeometry {
  const steps = 16;
  const outer: THREE.Vector2[] = [];
  const inner: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    outer.push(new THREE.Vector2(spineOuterX(L, y), y));
    inner.push(new THREE.Vector2(blockBackX(L, y), y));
  }
  const shape = new THREE.Shape([...outer, ...inner.reverse()]);
  const sb = Math.min(G.bevelCm, L.cloth * 0.3);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: L.H - 2 * sb, bevelEnabled: true, bevelThickness: sb, bevelSize: sb, bevelOffset: -sb, bevelSegments: 2, curveSegments: 1 });
  geo.translate(0, 0, -L.H / 2 + sb);
  return toCreasedNormals(geo, deg(50));
}

/** The floor of the hinge groove: a thin strip of cloth at the board's inner level, from the spine shell to under the board's edge. */
function hingeStrip(L: BookLayout, yCentre: number): THREE.BufferGeometry {
  const x0 = -L.W / 2 + L.sagitta - 0.12;
  const x1 = L.hingeX + 0.1;
  const geo = new THREE.BoxGeometry(x1 - x0, L.cloth, L.H);
  geo.translate((x0 + x1) / 2, yCentre, 0);
  return geo;
}

/** The pasted-down endpaper on a board's inner face, inset by the cloth turn-in. */
function pastedown(L: BookLayout, y0: number): THREE.BufferGeometry {
  const x0 = L.hingeX + 0.4;
  const x1 = L.W / 2 - G.pastedownInsetCm;
  const z = L.H - 2 * G.pastedownInsetCm;
  const geo = new THREE.BoxGeometry(x1 - x0, G.pastedownCm, z);
  geo.translate((x0 + x1) / 2, y0 + G.pastedownCm / 2, 0);
  return geo;
}

/** One stripe of the head and tail band over the heights y0..y1: it follows the rounded back, `off0..off1` cm from it, 0.25 cm deep. z runs 0 .. bandDepth. */
function bandStripe(L: BookLayout, y0: number, y1: number, off0: number, off1: number): THREE.BufferGeometry {
  const steps = 10;
  const left: THREE.Vector2[] = [];
  const right: THREE.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    left.push(new THREE.Vector2(blockBackX(L, y) + off0, y));
    right.push(new THREE.Vector2(blockBackX(L, y) + off1, y));
  }
  const shape = new THREE.Shape([...left, ...right.reverse()]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: G.bandDepthCm, bevelEnabled: false, curveSegments: 1 });
  return geo;
}

export interface StaticGeometries {
  /** the base group (the back board and everything glued to it) */
  backBoard: THREE.BufferGeometry;
  spineBack: THREE.BufferGeometry;
  hingeBack: THREE.BufferGeometry;
  pastedownBack: THREE.BufferGeometry;
  /** the cover group, in the CLOSED frame (the group rotates them about the hinge axis) */
  frontBoard: THREE.BufferGeometry;
  spineFront: THREE.BufferGeometry;
  hingeFront: THREE.BufferGeometry;
  pastedownFront: THREE.BufferGeometry;
}

/** Everything that does not depend on the turned sheets, the bands, the ribbon or the cover angle. Build once per book. */
export function staticGeometries(spec: BookSpec): StaticGeometries {
  const L = layoutOf(spec);
  const plate = boardPlate(L);
  const backBoard = plate;
  const frontBoard = plate.clone().translate(0, L.T - L.b, 0);
  return {
    backBoard,
    spineBack: spineHalf(L, 0, L.ym),
    hingeBack: hingeStrip(L, L.b - L.cloth / 2),
    pastedownBack: pastedown(L, L.b),
    frontBoard,
    spineFront: spineHalf(L, L.ym, L.T),
    hingeFront: hingeStrip(L, L.T - L.b + L.cloth / 2),
    pastedownFront: pastedown(L, L.T - L.b - G.pastedownCm),
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// the page block
// ---------------------------------------------------------------------------------------------------------------------------

const MIN_SLAB_CM = 1e-4;

export interface SlabOptions {
  yLo: number;
  yHi: number;
  /** how much of the bow is applied at the bottom and at the top face (0 to 1). The face that meets the other stack, or the free face, takes 1. */
  bowLo: number;
  bowHi: number;
  /** the bow's depth in cm; `bowAmplitude` gives the value that keeps a thin stack from folding over. Default: the full 0.5 mm. */
  bowAmp?: number;
}

/**
 * The depth of the bow for a given split. It is 0.5 mm, but never more than half the thickness of the thinner stack, so a stack
 * with only a few sheets left cannot be pushed through itself. Both stacks use the same value, so they still meet exactly.
 */
export function bowAmplitude(split: BlockSplit): number {
  const thin = split.rightThickness > MIN_SLAB_CM && split.leftThickness > MIN_SLAB_CM ? Math.min(split.rightThickness, split.leftThickness) : Math.max(split.rightThickness, split.leftThickness);
  return Math.min(G.blockBowCm, 0.5 * thin);
}

/**
 * A slab of the page block between two heights: a rounded back (it follows the spine), a flat fore-edge, head and tail. It is a
 * subdivided box moved vertex by vertex, so every deformation is a function of the vertex's place and seams stay closed.
 * The bow (up to 0.5 mm) lowers the middle of a face; the fore-edge is uneven by up to 0.3 mm. Both only go inward, so the slab
 * never leaves the nominal block (and so never pokes through a board).
 */
export function blockSlabGeometry(spec: BookSpec, opts: SlabOptions): THREE.BufferGeometry {
  const L = layoutOf(spec);
  const { yLo, yHi, bowLo, bowHi } = opts;
  const bowAmp = opts.bowAmp ?? G.blockBowCm;
  const rows = Math.max(2, Math.ceil((24 * (yHi - yLo)) / L.tBlock));
  const geo = new THREE.BoxGeometry(1, 1, 1, 8, rows, 48);
  const noise = makeNoise(spec.seeds.block);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;
    const v = pos.getY(i) + 0.5;
    const w = pos.getZ(i) + 0.5;
    const y = yLo + (yHi - yLo) * v;
    const z = L.zHead + (L.zTail - L.zHead) * w;
    const back = blockBackX(L, y);
    // the uneven fore-edge: pages differ by up to 0.3 mm, a little different on every sheet, stronger towards the fore-edge
    const dent = G.foreEdgeDentCm * (0.5 + 0.5 * noise.n2(y * 6.1, z * 0.41)) * u * u * u;
    const x = back + (L.xFore - back) * u - dent;
    const bowShape = Math.sin(Math.PI * u) * Math.sin(Math.PI * w);
    const bow = bowAmp * bowShape * (bowLo + (bowHi - bowLo) * v);
    pos.setXYZ(i, x, y - bow, z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

export interface BlockGeometries {
  /** the stack that stays on the back board (null when every sheet has been turned) */
  right: THREE.BufferGeometry | null;
  /** the stack that rides on the cover, in the closed frame (null when no sheet has been turned) */
  left: THREE.BufferGeometry | null;
  split: BlockSplit;
}

/** The page block for `turned` sheets turned. The two stacks tile the block exactly (right + left thickness = the block's), whatever the cover angle. */
export function blockGeometries(spec: BookSpec, turned: number): BlockGeometries {
  const L = layoutOf(spec);
  const split = splitOf(spec, turned);
  const bowAmp = bowAmplitude(split);
  const right = split.rightThickness > MIN_SLAB_CM ? blockSlabGeometry(spec, { yLo: L.yBlock0, yHi: split.yMid, bowLo: 0, bowHi: 1, bowAmp }) : null;
  const left = split.leftThickness > MIN_SLAB_CM ? blockSlabGeometry(spec, { yLo: split.yMid, yHi: L.yBlock1, bowLo: 1, bowHi: 0, bowAmp }) : null;
  return { right, left, split };
}

/**
 * The head and tail bands, split like the block: each half of the block carries its own bands, so they never stand above a thinner
 * stack. Each half is four stripes in the order head 0, head 1, tail 0, tail 1 (the two colours alternate). Null for an empty half.
 */
export interface BandGeometries {
  right: THREE.BufferGeometry[] | null;
  left: THREE.BufferGeometry[] | null;
}
export function bandGeometries(spec: BookSpec, turned: number): BandGeometries {
  const L = layoutOf(spec);
  const split = splitOf(spec, turned);
  const half = G.bandWidthCm / 2;
  const four = (y0: number, y1: number): THREE.BufferGeometry[] => [
    bandStripe(L, y0, y1, 0, half).translate(0, 0, L.zHead - G.bandDepthCm),
    bandStripe(L, y0, y1, half, G.bandWidthCm).translate(0, 0, L.zHead - G.bandDepthCm),
    bandStripe(L, y0, y1, 0, half).translate(0, 0, L.zTail),
    bandStripe(L, y0, y1, half, G.bandWidthCm).translate(0, 0, L.zTail),
  ];
  return {
    right: split.rightThickness > MIN_SLAB_CM ? four(L.yBlock0, split.yMid) : null,
    left: split.leftThickness > MIN_SLAB_CM ? four(split.yMid, L.yBlock1) : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// the ribbon
// ---------------------------------------------------------------------------------------------------------------------------

export interface RibbonOptions {
  /** the surface it lies on: the top of the right stack, y */
  yTop: number;
  /** the tail's sideways swing, -1 to 1 (about 26 degrees at 1). The ribbon's secondary motion drives this. */
  swing?: number;
  /** how far the tail droops, 0 (straight out) to 1 (63 degrees down). */
  sag?: number;
}

export interface RibbonPath {
  /** the centre line from the head to the tip of the tail */
  points: Vec3[];
  /** the unit direction across the ribbon at each point */
  across: Vec3[];
  /** index of the first point beyond the boards' tail edge */
  tailStart: number;
  tip: Vec3;
}

const smooth = (x: number): number => x * x * (3 - 2 * x);
const X_AXIS = new THREE.Vector3(1, 0, 0);

/** The ribbon's centre line: along the gutter of the right stack, into the block near the tail, out past the tail edge, then a drooping, kinked 3 cm tail. */
export function ribbonPath(spec: BookSpec, opts: RibbonOptions): RibbonPath {
  const L = layoutOf(spec);
  const swing = opts.swing ?? 0;
  const sag = opts.sag ?? 0.25;
  const noise = makeNoise(spec.seeds.ribbon);
  const rnd = prng(spec.seeds.ribbon);
  // the kink: where it is on the tail, which way it turns, and how hard (seeded, so it is the same every render)
  const kinkAt = range(rnd, 0.35, 0.65);
  const kinkSide = rnd() < 0.5 ? -1 : 1;
  const kinkAngle = kinkSide * range(rnd, 0.3, 0.5);
  const kinkTwist = -kinkSide * range(rnd, 0.5, 0.9);

  const xr = blockBackX(L, opts.yTop) + G.ribbonGutterCm;
  const zStart = L.zHead + 0.15;
  const zBoardEdge = L.H / 2;
  const pts: Vec3[] = [];
  const twist: number[] = [];

  const nMid = 48;
  for (let i = 0; i <= nMid; i++) {
    const z = zStart + ((zBoardEdge - zStart) * i) / nMid;
    // it lies on the top sheet, then dives 0.3 mm into the block just before the tail face so it comes out between the sheets
    const dive = 0.032 * smooth(Math.min(1, Math.max(0, (z - (L.zTail - 1.2)) / 1.2)));
    const x = xr + 0.05 * noise.n1(z * 0.23);
    pts.push([x, opts.yTop + 0.012 - dive, z]);
    twist.push(0);
  }

  const nTail = 28;
  const ds = G.ribbonTailCm / nTail;
  let p = new THREE.Vector3(...pts[pts.length - 1]);
  const tailStart = pts.length;
  for (let i = 1; i <= nTail; i++) {
    const s = i / nTail;
    const bump = Math.exp(-(((s - kinkAt) / 0.08) ** 2));
    const theta = sag * 1.1 * smooth(s);
    const psi = swing * 0.45 * s + kinkAngle * bump;
    const d = new THREE.Vector3(Math.sin(psi) * Math.cos(theta), -Math.sin(theta), Math.cos(psi) * Math.cos(theta)).normalize();
    p = p.clone().addScaledVector(d, ds);
    pts.push([p.x, p.y, p.z]);
    twist.push(kinkTwist * bump + 0.12 * noise.n1(s * 3 + 11));
  }

  const across: Vec3[] = pts.map((_q, i) => {
    const a = new THREE.Vector3(...pts[Math.max(0, i - 1)]);
    const c = new THREE.Vector3(...pts[Math.min(pts.length - 1, i + 1)]);
    const tangent = c.sub(a).normalize();
    const w = X_AXIS.clone().addScaledVector(tangent, -X_AXIS.dot(tangent)).normalize();
    w.applyAxisAngle(tangent, twist[i]);
    return [w.x, w.y, w.z];
  });
  return { points: pts, across, tailStart, tip: pts[pts.length - 1] };
}

/** The ribbon as a flat strip 0.6 cm wide (draw it double sided). */
export function ribbonGeometry(spec: BookSpec, opts: RibbonOptions): THREE.BufferGeometry {
  const path = ribbonPath(spec, opts);
  const n = path.points.length;
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  const index: number[] = [];
  let len = 0;
  const total = path.points.reduce((acc, q, i) => (i === 0 ? 0 : acc + Math.hypot(q[0] - path.points[i - 1][0], q[1] - path.points[i - 1][1], q[2] - path.points[i - 1][2])), 0);
  const half = G.ribbonWidthCm / 2;
  for (let i = 0; i < n; i++) {
    const q = path.points[i];
    const w = path.across[i];
    if (i > 0) len += Math.hypot(q[0] - path.points[i - 1][0], q[1] - path.points[i - 1][1], q[2] - path.points[i - 1][2]);
    pos.set([q[0] - w[0] * half, q[1] - w[1] * half, q[2] - w[2] * half], i * 6);
    pos.set([q[0] + w[0] * half, q[1] + w[1] * half, q[2] + w[2] * half], i * 6 + 3);
    uv.set([0, len / total, 1, len / total], i * 4);
    if (i < n - 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------------------------------------------------------
// bounds, anchors, pose
// ---------------------------------------------------------------------------------------------------------------------------

/** The book's bounding box in its own frame, built from the real geometry. `ribbon` adds the ribbon's tail (3 cm past the tail edge). */
export function bookBounds(spec: BookSpec, state: BookState, opts: { ribbon?: boolean } = {}): THREE.Box3 {
  const s = staticGeometries(spec);
  const blocks = blockGeometries(spec, state.turned);
  const cover = coverMatrix(spec, state.coverAngle);
  const box = new THREE.Box3();
  const add = (g: THREE.BufferGeometry | null, m?: THREE.Matrix4): void => {
    if (!g) return;
    g.computeBoundingBox();
    const b = g.boundingBox!.clone();
    if (m) b.applyMatrix4(m);
    box.union(b);
  };
  const bands = bandGeometries(spec, state.turned);
  for (const g of [s.backBoard, s.spineBack, s.hingeBack, s.pastedownBack, ...(bands.right ?? [])]) add(g);
  for (const g of [s.frontBoard, s.spineFront, s.hingeFront, s.pastedownFront]) add(g, cover);
  add(blocks.right);
  add(blocks.left, cover);
  for (const g of bands.left ?? []) add(g, cover);
  if (opts.ribbon) add(ribbonGeometry(spec, { yTop: blocks.split.yMid }));
  [...Object.values(s), blocks.right, blocks.left, ...(bands.right ?? []), ...(bands.left ?? [])].forEach((g) => g?.dispose());
  return box;
}

export type AnchorName = "spine" | "frontBoard" | "backBoard" | "blockTop" | "ribbon";
export const ANCHOR_NAMES: readonly AnchorName[] = ["spine", "frontBoard", "backBoard", "blockTop", "ribbon"];

/**
 * A named frame on the book for rigs and for texture slots. Local +Z is the outward normal, so a plane mesh placed inside it faces
 * outward with no rotation; +X reads left to right and +Y is "up" on the face as a reader holds it (head up). Positions are in the
 * book frame (the frame of the group that holds the parent), `quaternion` is x, y, z, w.
 */
export interface Anchor {
  position: Vec3;
  quaternion: [number, number, number, number];
  normal: Vec3;
  /** true for frames that live on the cover group (they move with the cover) */
  onCover: boolean;
}

function frame(x: Vec3, y: Vec3, z: Vec3): { q: [number, number, number, number]; n: Vec3 } {
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z));
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  return { q: [q.x, q.y, q.z, q.w], n: z };
}

/**
 * The anchors in the frame of their parent: the base group for spine, backBoard, blockTop and ribbon; the cover group, in the CLOSED
 * pose, for frontBoard (so that it follows the cover). `anchorsInBookFrame` gives every one with the cover rotation applied.
 */
export function anchorFrames(spec: BookSpec, state: BookState, opts: Pick<RibbonOptions, "swing" | "sag"> = {}): Record<AnchorName, Anchor> {
  const L = layoutOf(spec);
  const split = splitOf(spec, state.turned);
  const xBoardMid = (L.hingeX + L.W / 2) / 2;
  const top = frame([1, 0, 0], [0, 0, -1], [0, 1, 0]);
  const bottom = frame([-1, 0, 0], [0, 0, -1], [0, -1, 0]);
  const spine = frame([0, 1, 0], [0, 0, -1], [-1, 0, 0]);
  const xBlockMid = (blockBackX(L, split.yMid) + L.xFore) / 2;
  const tip = ribbonPath(spec, { yTop: split.yMid, swing: opts.swing, sag: opts.sag }).tip;
  return {
    spine: { position: [-L.W / 2, L.ym, 0], quaternion: spine.q, normal: spine.n, onCover: false },
    backBoard: { position: [xBoardMid, 0, 0], quaternion: bottom.q, normal: bottom.n, onCover: false },
    frontBoard: { position: [xBoardMid, L.T, 0], quaternion: top.q, normal: top.n, onCover: true },
    blockTop: { position: [xBlockMid, split.yMid, 0], quaternion: top.q, normal: top.n, onCover: false },
    ribbon: { position: tip, quaternion: top.q, normal: top.n, onCover: false },
  };
}

/** Every anchor in the book frame, with the cover's rotation applied to the ones on the cover. */
export function anchorsInBookFrame(spec: BookSpec, state: BookState, opts: Pick<RibbonOptions, "swing" | "sag"> = {}): Record<AnchorName, Anchor> {
  const frames = anchorFrames(spec, state, opts);
  const cover = coverMatrix(spec, state.coverAngle);
  const out = { ...frames };
  for (const name of ANCHOR_NAMES) {
    const a = frames[name];
    if (!a.onCover) continue;
    const p = new THREE.Vector3(...a.position).applyMatrix4(cover);
    const q = new THREE.Quaternion(...a.quaternion).premultiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(cover)));
    const n = new THREE.Vector3(...a.normal).applyQuaternion(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(cover)));
    out[name] = { position: [p.x, p.y, p.z], quaternion: [q.x, q.y, q.z, q.w], normal: [n.x, n.y, n.z], onCover: true };
  }
  return out;
}

/** The pose's rotation: Y (yaw), then X (pitch), then Z (roll), in degrees (guide 02). */
export function poseEuler(pose: BookPose): THREE.Euler {
  return new THREE.Euler(deg(pose.pitchDeg ?? 0), deg(pose.yawDeg ?? 0), deg(pose.rollDeg ?? 0), "YXZ");
}
