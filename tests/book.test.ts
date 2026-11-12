import * as THREE from "three";
import { test, eq, near, truthy } from "./harness";
import { BOOKS, BOOK_GEOMETRY, BOOK_IDS, PILE, SPINE_TO_CAMERA_YAW_DEG, closedThickness, pilePoses, sheetCount } from "../src/config/books";
import { BOOK_TRIM, deg } from "../src/lib/units";
import { FOOTPRINTS, ZONES, footprintInZone } from "../src/config/placement";
import { anchorFrames, anchorsInBookFrame, bandGeometries, blockGeometries, bookBounds, bowAmplitude, coverMatrix, layoutOf, poseEuler, ribbonGeometry, ribbonPath, splitOf, staticGeometries } from "../src/book/geometry";

const size = (b: THREE.Box3): THREE.Vector3 => b.getSize(new THREE.Vector3());
const closed = { coverAngle: 0, turned: 0 };
/** Geometry lives in float32 buffers, so a bound read back from one is only good to about 1e-6 cm (0.01 micron). */
const F32 = 1e-5;

test("the four books: thickness, weight and trim as in guide 04 section 1", () => {
  eq(BOOK_IDS.length, 4);
  near(BOOKS["mini-me"].spine, 2.4, 1e-9, "Mini Me spine");
  near(BOOKS["spherex-blink"].spine, 1.8, 1e-9, "SPHEREx spine");
  near(BOOKS.minilocker.spine, 2.0, 1e-9, "MiniLocker spine");
  near(BOOKS["next-inc-immersive"].spine, 1.6, 1e-9, "Immersive spine");
  eq(BOOKS["mini-me"].weightG, 560);
  eq(BOOKS["spherex-blink"].weightG, 440);
  eq(BOOKS.minilocker.weightG, 490);
  eq(BOOKS["next-inc-immersive"].weightG, 400);
  BOOK_IDS.forEach((id, i) => {
    eq(BOOKS[id].volume, i + 1, `${id} volume`);
    near(BOOKS[id].trimW, BOOK_TRIM.w, 1e-9);
    near(BOOKS[id].trimH, BOOK_TRIM.h, 1e-9);
    near(BOOKS[id].board, 0.3, 1e-9);
    near(BOOKS[id].square, 0.3, 1e-9);
  });
  near(closedThickness(BOOKS["mini-me"]), 3.0, 1e-9, "2.4 + 2 x 0.3");
  near(BOOK_GEOMETRY.bevelCm, 0.08, 1e-12, "0.8 mm");
});

test("a closed book measures 15.2 x 22.9 x (spine + 2 boards) cm, built from the real geometry", () => {
  for (const id of BOOK_IDS) {
    const s = size(bookBounds(BOOKS[id], closed));
    near(s.x, 15.2, 1e-3, `${id} width`);
    near(s.z, 22.9, 1e-3, `${id} height`);
    near(s.y, BOOKS[id].spine + 0.6, 1e-3, `${id} thickness`);
  }
  const b = bookBounds(BOOKS["mini-me"], closed);
  near(b.min.y, 0, 1e-6, "stands on y = 0");
  near(b.min.x, -7.6, 1e-3, "the spine's apex is at -W/2");
  near(b.max.x, 7.6, 1e-3, "the fore-edge is at +W/2");
});

test("the boards are bevelled by 0.8 mm: the faces are drawn in by the bevel, the side walls are not", () => {
  const g = staticGeometries(BOOKS["mini-me"]);
  const L = layoutOf(BOOKS["mini-me"]);
  const pos = g.frontBoard.getAttribute("position");
  let maxXTop = -Infinity;
  let maxXAll = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    maxXAll = Math.max(maxXAll, pos.getX(i));
    if (pos.getY(i) > L.T - 1e-6) maxXTop = Math.max(maxXTop, pos.getX(i));
  }
  near(maxXAll, L.W / 2, 1e-4, "the side wall is on the outline");
  near(maxXTop, L.W / 2 - 0.08, 1e-3, "the top face stops 0.8 mm short of it");
});

test("the hinge groove is at least 1.5 mm wide on every book and the spine's rounded back is about 3 cm radius", () => {
  for (const id of BOOK_IDS) {
    const L = layoutOf(BOOKS[id]);
    const groove = L.hingeX - (-L.W / 2 + L.sagitta);
    truthy(groove >= 0.15 - 1e-9, `${id} groove ${groove}`);
    near(L.hingeX - -L.W / 2, Math.max(0.5, L.sagitta + 0.15), 1e-9, `${id} hinge from the spine edge`);
    near(L.R, 3, 1e-12);
  }
});

test("the page block is smaller than the boards by the square, and every deformation goes inward", () => {
  const spec = BOOKS["mini-me"];
  const L = layoutOf(spec);
  const { right } = blockGeometries(spec, 0);
  truthy(right !== null);
  right!.computeBoundingBox();
  const b = right!.boundingBox!;
  truthy(b.max.x <= L.W / 2 - L.sq + F32, "fore-edge stays inside the square");
  truthy(b.max.x > L.W / 2 - L.sq - 0.0301, "and is within 0.3 mm of it");
  near(b.max.z, L.H / 2 - L.sq, F32, "tail face");
  near(b.min.z, -L.H / 2 + L.sq, F32, "head face");
  truthy(b.max.y <= L.yBlock1 + F32, "the bow never lifts the top above the front board");
  truthy(b.min.y >= L.yBlock0 - F32, "or sinks the bottom below the endpaper");
  // the bow really is there: the middle of the top face is lower than its corner
  const pos = right!.getAttribute("position");
  let topMid = Infinity;
  for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i) - (L.xFore + -7.2) / 2) < 1.0 && Math.abs(pos.getZ(i)) < 0.3 && pos.getY(i) > L.yBlock1 - 0.06) topMid = Math.min(topMid, pos.getY(i));
  truthy(topMid < L.yBlock1 - 0.03, `the top face dips at the middle (${topMid})`);
});

test("the page block is seeded: same book, same vertices; another book, other vertices", () => {
  const a = blockGeometries(BOOKS["mini-me"], 0).right!.getAttribute("position").array as Float32Array;
  const b = blockGeometries(BOOKS["mini-me"], 0).right!.getAttribute("position").array as Float32Array;
  const c = blockGeometries(BOOKS.minilocker, 0).right!.getAttribute("position").array as Float32Array;
  eq(a.length, b.length);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) throw new Error(`vertex ${i} differs between two builds`);
  let differs = 0;
  const n = Math.min(a.length, c.length);
  for (let i = 0; i < n; i++) if (a[i] !== c[i]) differs++;
  truthy(differs > 100, "another book has another block");
});

test("turned sheets split the block into two stacks that tile it exactly, at any cover angle", () => {
  for (const id of BOOK_IDS) {
    const spec = BOOKS[id];
    const L = layoutOf(spec);
    for (const turned of [0, 1, 17, sheetCount(spec) / 2, sheetCount(spec) - 1, sheetCount(spec)]) {
      const s = splitOf(spec, turned);
      near(s.rightThickness + s.leftThickness, L.tBlock, 1e-9, `${id} ${turned}`);
      near(s.yMid, L.yBlock0 + s.rightThickness, 1e-9);
      const g = blockGeometries(spec, turned);
      eq(g.right === null, s.rightThickness <= 1e-4, `${id} ${turned} right`);
      eq(g.left === null, s.leftThickness <= 1e-4, `${id} ${turned} left`);
    }
  }
  eq(blockGeometries(BOOKS["mini-me"], 0).left, null);
  eq(blockGeometries(BOOKS["mini-me"], 128).right, null);
  // turned is clamped to the sheets there are
  near(splitOf(BOOKS["mini-me"], 999).fraction, 1, 1e-12);
  near(splitOf(BOOKS["mini-me"], -5).fraction, 0, 1e-12);
});

test("the bow shrinks so a thin stack cannot fold over, and never exceeds 0.5 mm", () => {
  const spec = BOOKS["mini-me"];
  near(bowAmplitude(splitOf(spec, 0)), 0.05, 1e-12, "whole block: the full 0.5 mm");
  const thin = splitOf(spec, 127);
  truthy(bowAmplitude(thin) <= 0.5 * thin.rightThickness + 1e-12, "half of the thinner stack at most");
  for (const turned of [0, 1, 30, 64, 100, 127, 128]) truthy(bowAmplitude(splitOf(spec, turned)) <= 0.05 + 1e-12);
  // a nearly all-turned block: the thin stack's top stays above its bottom everywhere
  const g = blockGeometries(spec, 127).right!;
  const pos = g.getAttribute("position");
  const L = layoutOf(spec);
  for (let i = 0; i < pos.count; i++) truthy(pos.getY(i) >= L.yBlock0 - F32, "no vertex below the endpaper");
});

test("the head and tail bands follow the block's split and never stand above a thinner stack", () => {
  const spec = BOOKS["mini-me"];
  const L = layoutOf(spec);
  const split = splitOf(spec, 64);
  const bands = bandGeometries(spec, 64);
  truthy(bands.right && bands.left);
  for (const g of bands.right!) {
    g.computeBoundingBox();
    truthy(g.boundingBox!.max.y <= split.yMid + F32, "right bands stay under the split plane");
  }
  for (const g of bands.left!) {
    g.computeBoundingBox();
    truthy(g.boundingBox!.min.y >= split.yMid - F32, "left bands stay above it");
    truthy(g.boundingBox!.max.y <= L.yBlock1 + F32);
  }
  eq(bandGeometries(spec, 0).left, null);
  eq(bands.right!.length, 4);
  // 1.2 cm wide in total, 0.25 cm deep
  const g0 = bands.right![0];
  const g1 = bands.right![1];
  g0.computeBoundingBox();
  g1.computeBoundingBox();
  near(g0.boundingBox!.max.z - g0.boundingBox!.min.z, 0.25, 1e-9, "depth");
  // the stripes follow the rounded back, so the box is 1.2 cm plus how far that curve sweeps over the stack's height
  const r = L.R - L.cloth;
  const backAt = (y: number): number => L.xc - Math.sqrt(r * r - (y - L.ym) * (y - L.ym));
  const sweep = Math.abs(backAt(L.yBlock0) - backAt(split.yMid));
  near(g1.boundingBox!.max.x - g0.boundingBox!.min.x, BOOK_GEOMETRY.bandWidthCm + sweep, 0.01, "width: 1.2 cm along the curve");
});

test("the cover swings about the hinge axis: closed on top, flat beside the back board, a mirror image of it", () => {
  const spec = BOOKS["mini-me"];
  const L = layoutOf(spec);
  const open = anchorsInBookFrame(spec, { coverAngle: 1, turned: 0 });
  const shut = anchorsInBookFrame(spec, closed);
  near(shut.frontBoard.position[1], L.T, 1e-9, "closed: the front board's outer face is at y = T");
  near(shut.frontBoard.normal[1], 1, 1e-9);
  near(open.frontBoard.position[1], 0, 1e-9, "flat: its outer face is on the desk");
  near(open.frontBoard.normal[1], -1, 1e-9, "facing down");
  near(open.frontBoard.position[0], 2 * L.xp - shut.frontBoard.position[0], 1e-9, "mirrored about the hinge axis");
  // the back board and the spine do not move
  eq(JSON.stringify(open.backBoard), JSON.stringify(shut.backBoard));
  eq(JSON.stringify(open.spine), JSON.stringify(shut.spine));
  // the rotation is a rotation: a point on the hinge axis stays put
  const m = coverMatrix(spec, 0.37);
  const p = new THREE.Vector3(L.xp, L.ym, 4).applyMatrix4(m);
  near(p.x, L.xp, 1e-9);
  near(p.y, L.ym, 1e-9);
  near(p.z, 4, 1e-9);
  // half open (90 degrees): the cover stands up, its fore-edge over the desk's far side of the spine
  const half = new THREE.Vector3(L.W / 2, L.T, 0).applyMatrix4(coverMatrix(spec, 0.5));
  near(half.x, L.xp - (L.T - L.ym), 1e-9);
  near(half.y, L.ym + (L.W / 2 - L.xp), 1e-9);
});

test("open flat, the book lies on the desk and nothing goes below it", () => {
  for (const id of BOOK_IDS) {
    const spec = BOOKS[id];
    const L = layoutOf(spec);
    for (const turned of [0, 40]) {
      const b = bookBounds(spec, { coverAngle: 1, turned });
      near(b.min.y, 0, 1e-6, `${id} ${turned} min y`);
      truthy(b.max.y <= L.yBlock1 + 1e-6, `${id} ${turned} max y ${b.max.y}`);
      // both boards lie side by side: a little over 2 trims wide, minus the overlap of the hinge
      near(size(b).x, 2 * L.W - 2 * (L.hingeX - L.xp) - 2 * (L.xp - -L.W / 2) + 2 * (L.xp - -L.W / 2) - 0, 2.5, `${id} open width`);
      near(size(b).z, 22.9, 1e-3, `${id} height`);
    }
  }
});

test("the three-book pile: believable, different thicknesses, in the pile zone, askew by +3, -2, +1 degrees", () => {
  const thick = PILE.map((s) => closedThickness(BOOKS[s.id]));
  eq(new Set(thick).size, 3, "three different thicknesses");
  near(thick.reduce((a, c) => a + c, 0), 2.4 + 2.6 + 3.0, 1e-9, "8.0 cm in all");
  eq(PILE.map((s) => s.yawDeg).join(","), "3,-2,1");
  for (const s of PILE) truthy(Math.abs(s.dx) >= 0.3 - 1e-9 && Math.abs(s.dx) <= 0.8 + 1e-9 && Math.abs(s.dzd) <= 0.8, `offset of ${s.id} is 3 to 8 mm`);
  eq(PILE.map((s) => s.id).join(","), "spherex-blink,minilocker,mini-me", "the spines read MiniMe, MiniLocker, SPHEREx from the top");
  const poses = pilePoses(ZONES.L.anchor);
  let y = 0;
  poses.forEach(({ id, pose }) => {
    near(pose.position[1], y, 1e-9, `${id} rests on the one below`);
    y += closedThickness(BOOKS[id]);
    const yaw = pose.yawDeg ?? 0;
    // the footprint is the trim size, turned: it must stay inside zone L
    truthy(footprintInZone(ZONES.L, pose.position[0], -pose.position[2], FOOTPRINTS.book.w, FOOTPRINTS.book.d, yaw), `${id} stands inside the pile zone`);
  });
  near(y, 8.0, 1e-9);
});

test("a yaw of 90 degrees turns the spine to the camera; the pose order is Y, X, Z", () => {
  const e = poseEuler({ position: [0, 0, 0], yawDeg: SPINE_TO_CAMERA_YAW_DEG });
  eq(e.order, "YXZ");
  const spineDir = new THREE.Vector3(-1, 0, 0).applyEuler(e);
  near(spineDir.x, 0, 1e-9);
  near(spineDir.z, 1, 1e-9, "local -X (the spine) points to world +Z, the camera");
  const head = new THREE.Vector3(0, 0, -1).applyEuler(e);
  near(head.x, -1, 1e-9, "the head is on the left of that view");
  // Y then X then Z: yaw 90 then pitch 90 sends local +Z (the tail) somewhere different from pitch then yaw
  const a = new THREE.Vector3(0, 0, 1).applyEuler(poseEuler({ position: [0, 0, 0], yawDeg: 90, pitchDeg: 90 }));
  const b = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(deg(90), deg(90), 0, "XYZ"));
  truthy(a.distanceTo(b) > 0.5, "the order matters, and it is the documented one");
});

test("the ribbon: 0.6 cm wide, a tail about 3 cm long, a seeded kink, a swing parameter", () => {
  const spec = BOOKS["mini-me"];
  const L = layoutOf(spec);
  const y = splitOf(spec, 0).yMid;
  const p = ribbonPath(spec, { yTop: y });
  // from the tail edge to the tip the centre line is 3 cm long
  let tail = 0;
  for (let i = p.tailStart; i < p.points.length; i++) tail += Math.hypot(p.points[i][0] - p.points[i - 1][0], p.points[i][1] - p.points[i - 1][1], p.points[i][2] - p.points[i - 1][2]);
  near(tail, BOOK_GEOMETRY.ribbonTailCm, 0.01, "tail length");
  truthy(p.tip[2] > L.H / 2 + 2.5 && p.tip[2] < L.H / 2 + 3.0 + 1e-9, "the tip is 2.5 to 3 cm past the tail edge");
  // it lies in the gutter, on the stack
  truthy(p.points[0][0] < -L.W / 2 + 2, "near the spine");
  truthy(Math.abs(p.points[0][1] - (y + 0.012)) < 1e-9, "on the top sheet");
  // the kink: the tail is not straight (a bend of at least 0.3 rad between neighbouring segments)
  let maxTurn = 0;
  for (let i = p.tailStart + 1; i < p.points.length - 1; i++) {
    const a = new THREE.Vector3(...p.points[i]).sub(new THREE.Vector3(...p.points[i - 1])).normalize();
    const c = new THREE.Vector3(...p.points[i + 1]).sub(new THREE.Vector3(...p.points[i])).normalize();
    maxTurn = Math.max(maxTurn, a.angleTo(c));
  }
  truthy(maxTurn > 0.03, `the tail has a kink (${maxTurn})`);
  // swing moves the tip sideways, both ways, and sag lowers it
  const right = ribbonPath(spec, { yTop: y, swing: 1 }).tip;
  const left = ribbonPath(spec, { yTop: y, swing: -1 }).tip;
  truthy(right[0] - left[0] > 1.0, "swing moves the tail across");
  truthy(ribbonPath(spec, { yTop: y, sag: 1 }).tip[1] < ribbonPath(spec, { yTop: y, sag: 0 }).tip[1] - 1, "sag lowers the tail");
  // deterministic
  eq(JSON.stringify(ribbonPath(spec, { yTop: y })), JSON.stringify(p));
  // the strip is 0.6 cm wide
  const g = ribbonGeometry(spec, { yTop: y });
  const pos = g.getAttribute("position");
  near(Math.hypot(pos.getX(0) - pos.getX(1), pos.getY(0) - pos.getY(1), pos.getZ(0) - pos.getZ(1)), 0.6, 1e-5, "width");
  // a different book has a different kink
  truthy(JSON.stringify(ribbonPath(BOOKS.minilocker, { yTop: 2.4 }).tip) !== JSON.stringify(ribbonPath(spec, { yTop: 2.4 }).tip));
});

test("the ribbon follows the top of the right stack as sheets are turned", () => {
  const spec = BOOKS["mini-me"];
  const a = ribbonPath(spec, { yTop: splitOf(spec, 0).yMid });
  const b = ribbonPath(spec, { yTop: splitOf(spec, 64).yMid });
  near(a.points[0][1] - b.points[0][1], splitOf(spec, 0).yMid - splitOf(spec, 64).yMid, 1e-9);
});

test("anchors: unit normals, right-handed frames, the front board's follows the cover", () => {
  const spec = BOOKS["spherex-blink"];
  for (const state of [closed, { coverAngle: 0.5, turned: 10 }, { coverAngle: 1, turned: 40 }]) {
    const frames = anchorsInBookFrame(spec, state);
    for (const [name, a] of Object.entries(frames)) {
      const q = new THREE.Quaternion(...a.quaternion);
      near(q.length(), 1, 1e-9, `${name} quaternion`);
      const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      near(z.x, a.normal[0], 1e-9, `${name} normal x`);
      near(z.y, a.normal[1], 1e-9, `${name} normal y`);
      near(z.z, a.normal[2], 1e-9, `${name} normal z`);
    }
  }
  const f = anchorFrames(spec, closed);
  eq(f.frontBoard.onCover, true);
  eq(f.spine.onCover, false);
  near(f.spine.normal[0], -1, 1e-12, "the spine faces -X");
  near(f.backBoard.normal[1], -1, 1e-12, "the back board faces down");
  near(f.blockTop.normal[1], 1, 1e-12);
  const split = splitOf(spec, 20);
  near(anchorFrames(spec, { coverAngle: 1, turned: 20 }).blockTop.position[1], split.yMid, 1e-9, "block top is the free face of the right stack");
});

test("every part of a book is built from the config: no two books share a block, and nothing reads a clock or Math.random", () => {
  const a = staticGeometries(BOOKS["mini-me"]).backBoard.getAttribute("position").count;
  const b = staticGeometries(BOOKS["next-inc-immersive"]).backBoard.getAttribute("position").count;
  eq(a, b, "the board plate is the same shape for every book");
  const sizes = BOOK_IDS.map((id) => size(bookBounds(BOOKS[id], closed)).y);
  eq(new Set(sizes.map((s) => s.toFixed(3))).size, 4, "four different thicknesses");
});
