// THE SHAPE OF A TURNING SHEET (Patch 10). Pure functions, no React, no frame reads, no Math.random: a state in, numbers out. The
// GLSL in `sheetShader.ts` is a line-for-line copy of `sheetAngle` and `sheetMesh`; the tests build the mesh from here and measure it,
// and `DevPageTurn` can draw this CPU mesh instead of the shader's to compare the two.
//
// THE MODEL (guide 06 section 2). A sheet is a rectangle `W x H` cm. Its gutter edge is hinged on the spine; along it every row
// (a line of constant v, running from the gutter to the outer edge) is a POLYLINE of `cols` segments whose directions follow
//
//   angle(u, v) = swing(P_u) - curl(P) * w(u) + cornerLift(u, v, P) - flutter(u, t)        clamped to [0, restAngle]
//
// and whose lengths are all exactly W / cols. Integrating directions, not positions, is what makes the paper inextensible: the
// length of a row is W whatever the angles are. The row is built from the pivot outwards, in the plane x-y of the book frame
// (x from the spine to the fore-edge, y up); z (head to tail) is straight, so the sheet is a ruled strip of rows.
//
// ANGLES are measured from +x (the sheet lying on the right-hand stack) towards +y: 0 is flat on the right, PI/2 is vertical, and
// `restAngle` = coverAngle * PI is lying on the left-hand stack, which rides on the cover.
//
// PROGRESS. `P` is the turn's eased progress, 0 to 1, from `turnProgress` (rig/turn.ts). The column u has its own progress
//   P_u = clamp((P - lag w(u)) / (1 - lag))
// so the gutter (w = 0) is done at P = 1 - lag and the outer edge (w = 1) only starts at P = lag and is done at P = 1: late in both
// directions, and the whole turn still takes exactly the frames it was given. `landSec` is the time since P reached 1.

import type { BookSpec } from "../config/books";
import { NO_VARIATION, SHEET, type SheetVariation } from "../config/sheets";
import { clamp01, lerp } from "../lib/ease";
import { prng } from "../lib/prng";
import { deg } from "../lib/units";
import { blockBackX, bowAmplitude, layoutOf, splitOf } from "./geometry";

/** Where a sheet is and how big it is, in the book's frame. Built by `sheetLayout`. */
export interface SheetLayout {
  /** the leaf's width (gutter to outer edge) and height (head to tail), cm */
  W: number;
  H: number;
  /** z of the head edge */
  zHead: number;
  /** the hinge axis the cover turns about (book frame, x and y): the gutter of a sheet travels on an arc about it, cm */
  axis: readonly [number, number];
  /** the gutter point when the sheet rests on the right-hand stack and on the left-hand one (book frame, x and y), cm */
  pivotR: readonly [number, number];
  pivotL: readonly [number, number];
  /** the direction "away from the stack" at the left-hand rest (at the right-hand rest it is +y) */
  upL: readonly [number, number];
  /** radians: the angle of the sheet when it lies on the left-hand stack */
  restAngle: number;
  /** the depth of the stacks' bow, cm (`bowAmplitude` of the split): a resting sheet follows it */
  bowAmp: number;
  /** thickness of one sheet of this book (block thickness / sheets), cm */
  sheetCm: number;
  /** the stack faces, in y: the right-hand face and the left-hand face in the closed frame, cm */
  yMid: number;
  /** x of the page block's fore-edge */
  xFore: number;
}

/**
 * The numbers a sheet of `spec` needs for a book in `state`. `turned` is the number the Book has (it sets where the two stacks meet);
 * `baseTurned` (default the same) fixes the leaf's width: a sheet is as wide as the block's face where it STARTS (the block's rounded
 * back makes the face a little wider at the middle of the thickness), and it does not change width while it turns.
 */
export function sheetLayout(spec: BookSpec, state: { coverAngle: number; turned: number }, baseTurned: number = state.turned): SheetLayout {
  const L = layoutOf(spec);
  const split = splitOf(spec, state.turned);
  const yBase = splitOf(spec, baseTurned).yMid;
  const W = L.xFore - blockBackX(L, yBase);
  const H = L.zTail - L.zHead;
  const phi = state.coverAngle * Math.PI;
  const xg = blockBackX(L, split.yMid);
  // the cover turns about the hinge axis (xp, ym): the point (xg, yMid) of the closed frame goes to
  const dx = xg - L.xp;
  const dy = split.yMid - L.ym;
  const pivotL: [number, number] = [L.xp + dx * Math.cos(phi) - dy * Math.sin(phi), L.ym + dx * Math.sin(phi) + dy * Math.cos(phi)];
  return {
    W,
    H,
    zHead: L.zHead,
    axis: [L.xp, L.ym],
    pivotR: [xg, split.yMid],
    pivotL,
    // the left face points down in the closed frame, (0, -1); the cover turns it by phi
    upL: [Math.sin(phi), -Math.cos(phi)],
    restAngle: phi,
    bowAmp: bowAmplitude(split),
    sheetCm: L.tBlock / L.sheets,
    yMid: split.yMid,
    xFore: L.xFore,
  };
}

/** The differences of one sheet from its neighbours (seeded by the book and the sheet's index: the same sheet is the same every render). */
export function sheetVariation(spec: BookSpec, index: number): SheetVariation {
  const r = prng(spec.seeds.block + 4001 + index * 7919);
  r();
  const V = SHEET.variation;
  const spread = (a: number): number => 1 + a * (2 * r() - 1);
  return { curl: spread(V.curl), lag: spread(V.lag), flutter: spread(V.flutter), flutterHz: spread(V.flutterHz) };
}

/** Everything `sheetAngle` reads, in radians and cm. */
export interface SheetShape {
  W: number;
  H: number;
  restAngle: number;
  /** radians: within this angle of a stack a point follows the stack's bow (`restWeightAt`) */
  restBlend: number;
  curl: number;
  curlPow: number;
  wPow: number;
  lag: number;
  cornerLift: number;
  cornerRadiusCm: number;
  cornerWindow: number;
  cornerU: number;
  cornerV: number;
  flutter: number;
  flutterTau: number;
  flutterHz: number;
}

/** The config's numbers, turned into radians and scaled by a sheet's own variation. */
export function shapeOf(layout: SheetLayout, variation: SheetVariation = NO_VARIATION): SheetShape {
  const B = SHEET.bend;
  const C = SHEET.corner;
  const F = SHEET.flutter;
  return {
    W: layout.W,
    H: layout.H,
    restAngle: layout.restAngle,
    restBlend: deg(SHEET.restBlendDeg),
    curl: deg(B.curlDeg) * variation.curl,
    curlPow: B.curlPow,
    wPow: B.wPow,
    lag: Math.min(0.5, B.lag * variation.lag),
    cornerLift: deg(C.liftDeg),
    cornerRadiusCm: C.radiusFrac * layout.W,
    cornerWindow: C.window,
    cornerU: C.u,
    cornerV: C.v,
    flutter: deg(F.deg) * variation.flutter,
    flutterTau: F.tauSec,
    flutterHz: F.hz * variation.flutterHz,
  };
}

const smooth = (x: number): number => {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
};

/** w(u): the gutter stays flat, the outer edge moves most. */
export const edgeWeight = (u: number, s: Pick<SheetShape, "wPow">): number => Math.pow(clamp01(u), s.wPow);

/** The progress of the gutter itself: it is done at P = 1 - lag (the pivot follows it). */
export const gutterProgress = (P: number, s: Pick<SheetShape, "lag">): number => clamp01(P / (1 - s.lag));

/** The progress of column u: late by lag * w(u). */
export const columnProgress = (P: number, u: number, s: Pick<SheetShape, "lag" | "wPow">): number => clamp01((P - s.lag * edgeWeight(u, s)) / (1 - s.lag));

/** The angle of the sheet at (u, v), radians from +x towards +y. `landSec` is the time since the turn ended (0 or less: not landed). */
export function sheetAngle(u: number, v: number, P: number, landSec: number, s: SheetShape): number {
  const w = edgeWeight(u, s);
  let a = s.restAngle * columnProgress(P, u, s);
  a -= s.curl * Math.pow(Math.max(Math.sin(Math.PI * P), 0), s.curlPow) * w;
  // the finger's corner: a smooth bump of lift near one corner while the sheet leaves the stack
  const d = Math.hypot((s.cornerU - u) * s.W, (s.cornerV - v) * s.H);
  a += s.cornerLift * smooth(1 - d / s.cornerRadiusCm) * Math.sin(Math.PI * clamp01(P / s.cornerWindow));
  // the rebound after landing: a one-sided wiggle that only lifts the free edge
  if (P >= 0.9999) {
    const t = Math.max(landSec, 0);
    a -= s.flutter * Math.exp(-t / s.flutterTau) * 0.5 * (1 - Math.cos(2 * Math.PI * s.flutterHz * t)) * w;
  }
  return Math.min(Math.max(a, 0), s.restAngle);
}

/** Where a sheet stands in its group: `rank` 0 is the sheet that turns first, `count` is the number in the group (1 for a single turn). */
export interface SheetPlacement {
  rank: number;
  count: number;
}
export const SINGLE: SheetPlacement = { rank: 0, count: 1 };

/** How far the sheet's mid-surface stands off the stack's face at the right-hand rest and at the left-hand rest, cm (offsets of 0.004 cm between neighbours). */
export function restOffsets(place: SheetPlacement): { right: number; left: number } {
  const base = SHEET.offsetCm + SHEET.depthCm / 2;
  // the sheet that turns first lies on top of the right stack and lands at the bottom of the left one
  return { right: base + (place.count - 1 - place.rank) * SHEET.offsetCm, left: base + place.rank * SHEET.offsetCm };
}

/**
 * 1 where a point of the sheet lies on a stack (its angle is within `restBlend` of 0, the right-hand stack, or of `restAngle`, the left-hand one),
 * so it follows the stack's bow; 0 once it is clear of both. It is decided point by point, from the point's own angle.
 */
export const restWeightAt = (angle: number, s: Pick<SheetShape, "restAngle" | "restBlend">): number => Math.max(1 - smooth(angle / s.restBlend), smooth((angle - (s.restAngle - s.restBlend)) / s.restBlend));

/**
 * The gutter point of the sheet at progress P (book frame), cm. The leaf is bound at the spine, so its gutter edge turns with the cover about
 * the hinge axis: it travels on an ARC about the axis from the right-hand stack's gutter point to the left-hand one's, not on a straight line
 * (a straight line drops faster than the paper rises when the two stacks differ in height, and the sheet sinks into one of them).
 */
export function sheetPivot(P: number, layout: SheetLayout, s: SheetShape, place: SheetPlacement = SINGLE): [number, number] {
  const p0 = gutterProgress(P, s);
  const off = restOffsets(place);
  const o = lerp(off.right, off.left, p0);
  const ux = lerp(0, layout.upL[0], p0);
  const uy = lerp(1, layout.upL[1], p0);
  const a = layout.restAngle * p0;
  const dx = layout.pivotR[0] - layout.axis[0];
  const dy = layout.pivotR[1] - layout.axis[1];
  return [layout.axis[0] + dx * Math.cos(a) - dy * Math.sin(a) + ux * o, layout.axis[1] + dx * Math.sin(a) + dy * Math.cos(a) + uy * o];
}

/**
 * One row of the sheet (a line of constant v) as a polyline from the gutter: x, y of `cols + 1` points relative to the pivot, cm.
 * The direction of every segment is the angle at its middle, and every segment is W / cols long, so the length is exactly W.
 */
export function sheetRow(v: number, P: number, landSec: number, s: SheetShape, cols: number = SHEET.mesh.cols): Float64Array {
  const out = new Float64Array((cols + 1) * 2);
  const ds = s.W / cols;
  let x = 0;
  let y = 0;
  for (let j = 0; j < cols; j++) {
    const th = sheetAngle((j + 0.5) / cols, v, P, landSec, s);
    x += Math.cos(th) * ds;
    y += Math.sin(th) * ds;
    out[(j + 1) * 2] = x;
    out[(j + 1) * 2 + 1] = y;
  }
  return out;
}

/** The length of a polyline given as x, y pairs, cm. */
export function polylineLength(row: ArrayLike<number>, stride = 2): number {
  let len = 0;
  for (let i = stride; i < row.length; i += stride) len += Math.hypot(row[i] - row[i - stride], row[i + 1] - row[i - stride + 1]);
  return len;
}

/** The sheet's texture coordinates: the front is the right page as it is painted (canvas top = head), the back is the left page, mirrored. */
export const sheetUV = (u: number, v: number, layer: "front" | "back"): [number, number] => (layer === "front" ? [u, 1 - v] : [1 - u, 1 - v]);

export interface SheetMesh {
  cols: number;
  rows: number;
  /** x, y, z of the front layer's points (the mid-surface moved by +depth/2 along the normal), (cols + 1) x (rows + 1), row by row from the head */
  front: Float32Array;
  /** the back layer's points (moved by -depth/2) */
  back: Float32Array;
  /** the unit normal of the front layer at each point: x, y, z (z is 0) */
  normal: Float32Array;
}

/**
 * The whole sheet as numbers: both layers of the mesh the shader draws, evaluated on the CPU. This is the reference for the GLSL
 * (`sheetShader.ts`), for the tests, for the length read-out and for the shadow blob.
 */
export function sheetMesh(P: number, landSec: number, layout: SheetLayout, s: SheetShape, place: SheetPlacement = SINGLE, cols: number = SHEET.mesh.cols, rows: number = SHEET.mesh.rows): SheetMesh {
  const n = (cols + 1) * (rows + 1);
  const front = new Float32Array(n * 3);
  const back = new Float32Array(n * 3);
  const normal = new Float32Array(n * 3);
  const pivot = sheetPivot(P, layout, s, place);
  const half = SHEET.depthCm / 2;
  for (let r = 0; r <= rows; r++) {
    const v = r / rows;
    const row = sheetRow(v, P, landSec, s, cols);
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const th = sheetAngle(u, v, P, landSec, s);
      const nx = -Math.sin(th);
      const ny = Math.cos(th);
      // a point lying on a stack follows its bowed face: it dips (right) or bulges (left) by the same amount as the slab
      const bow = layout.bowAmp * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) * restWeightAt(th, s);
      const x = pivot[0] + row[c * 2] - nx * bow;
      const y = pivot[1] + row[c * 2 + 1] - ny * bow;
      const z = layout.zHead + v * layout.H;
      const i = (r * (cols + 1) + c) * 3;
      front.set([x + nx * half, y + ny * half, z], i);
      back.set([x - nx * half, y - ny * half, z], i);
      normal.set([nx, ny, 0], i);
    }
  }
  return { cols, rows, front, back, normal };
}

/** The length of row `r` of one layer of a mesh, cm (the x-y path along the row). */
export function meshRowLength(mesh: SheetMesh, r: number, layer: "front" | "back" = "front"): number {
  const a = layer === "front" ? mesh.front : mesh.back;
  let len = 0;
  for (let c = 1; c <= mesh.cols; c++) {
    const i = (r * (mesh.cols + 1) + c) * 3;
    const j = i - 3;
    len += Math.hypot(a[i] - a[j], a[i + 1] - a[j + 1]);
  }
  return len;
}

/** The length of column `c` (head to tail) of the front layer, cm, with its x and y movement: the stretch of the sheet across the rows. */
export function meshColumnLength(mesh: SheetMesh, c: number): number {
  let len = 0;
  for (let r = 1; r <= mesh.rows; r++) {
    const i = (r * (mesh.cols + 1) + c) * 3;
    const j = ((r - 1) * (mesh.cols + 1) + c) * 3;
    len += Math.hypot(mesh.front[i] - mesh.front[j], mesh.front[i + 1] - mesh.front[j + 1], mesh.front[i + 2] - mesh.front[j + 2]);
  }
  return len;
}

/**
 * The length read-out of guide 06 section 6: the longest and shortest row of the mid-surface at progress `P`, as a fraction of W
 * (1 = exactly the paper's length), and the worst stretch of the columns head to tail. A row is built from unit segments, so rows
 * stay at 1; the columns can only change where the corner lift differs from row to row.
 */
export function lengthReadout(P: number, layout: SheetLayout, s: SheetShape, landSec = 0): { rowMin: number; rowMax: number; columnMax: number; columnMin: number } {
  let rowMin = Infinity;
  let rowMax = -Infinity;
  const rows = SHEET.mesh.rows;
  for (let r = 0; r <= rows; r++) {
    const len = polylineLength(sheetRow(r / rows, P, landSec, s)) / layout.W;
    rowMin = Math.min(rowMin, len);
    rowMax = Math.max(rowMax, len);
  }
  const mesh = sheetMesh(P, landSec, layout, s);
  let columnMax = -Infinity;
  let columnMin = Infinity;
  for (let c = 0; c <= mesh.cols; c++) {
    const f = meshColumnLength(mesh, c) / layout.H;
    columnMax = Math.max(columnMax, f);
    columnMin = Math.min(columnMin, f);
  }
  return { rowMin, rowMax, columnMax, columnMin };
}

/** The blob shadow that follows a sheet: where it lies on the stack under the sheet, how strong it is and how far it spreads. */
export interface SheetBlob {
  /** which stack's face it lies on */
  side: "right" | "left";
  /** the footprint along the face, measured from the gutter outwards (cm), including the spread; the shadow is a gradient over it */
  x0: number;
  x1: number;
  /** the sheet's greatest height above the face, cm */
  height: number;
  /** 0 to `SHEET.blob.maxOpacity` */
  opacity: number;
}

/**
 * A soft shadow for the face under a turning sheet: its footprint is the sheet's own (its middle row seen from above), grown by
 * `spreadPerCm` of height on each side, and it is strongest when the sheet is a little off the page and fades as it leaves
 * (guide 06 section 4). Zero when the sheet rests.
 */
export function sheetBlob(P: number, landSec: number, layout: SheetLayout, s: SheetShape, place: SheetPlacement = SINGLE): SheetBlob {
  const B = SHEET.blob;
  const row = sheetRow(0.5, P, landSec, s);
  const cols = row.length / 2 - 1;
  // which stack is it over? the one on the side the sheet's mean direction points to
  const tip = Math.atan2(row[cols * 2 + 1], row[cols * 2]);
  const side: "right" | "left" = tip < Math.PI / 2 ? "right" : "left";
  const pivot = sheetPivot(P, layout, s, place);
  // height above the face the sheet lies over, and its footprint on that face (along the face's direction)
  const dir: [number, number] = side === "right" ? [1, 0] : [Math.cos(layout.restAngle), Math.sin(layout.restAngle)];
  const up: [number, number] = side === "right" ? [0, 1] : [layout.upL[0], layout.upL[1]];
  const facePivot = side === "right" ? layout.pivotR : layout.pivotL;
  let hMax = 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (let c = 0; c <= cols; c++) {
    const px = pivot[0] + row[c * 2] - facePivot[0];
    const py = pivot[1] + row[c * 2 + 1] - facePivot[1];
    const along = px * dir[0] + py * dir[1];
    const h = px * up[0] + py * up[1];
    hMax = Math.max(hMax, h);
    lo = Math.min(lo, along);
    hi = Math.max(hi, along);
  }
  const spread = B.spreadPerCm * hMax;
  // it only exists while the sheet is clear of the page, and fades again when it is far above it
  const rise = smooth((hMax - 0.05) / B.contactCm);
  const fall = 1 - smooth((hMax - 0.35 * layout.W) / (0.55 * layout.W));
  return { side, x0: Math.max(0, lo - spread), x1: Math.min(layout.W, hi + spread), height: hMax, opacity: B.maxOpacity * rise * fall };
}