// The sheets (Patch 10): the clock of a turn, the riffle's starts, the paper's length at five values of progress (guide 06 section 6), the
// ends of a turn, the sheet's variation, the offsets between neighbours, the uniforms, the grid and the test textures. Everything runs in
// Node: the shape is a pure function and the grid is plain typed arrays, so no GPU is needed.
import { BOOKS, BOOK_IDS } from "../src/config/books";
import { NO_VARIATION, SHEET } from "../src/config/sheets";
import { FPS } from "../src/config/timeline";
import { riffleFrames, riffleSheets, riffleStarts, riffleTurned } from "../src/book/rig/riffle";
import { landSeconds, turnFrames, turnProgress, turnedDuring } from "../src/book/rig/turn";
import { checkerPixels } from "../src/book/pageTextures";
import { sheetGridGeometry } from "../src/book/sheetGeometry";
import { columnProgress, gutterProgress, lengthReadout, meshRowLength, restOffsets, restWeightAt, sheetAngle, sheetBlob, sheetLayout, sheetMesh, sheetPivot, sheetRow, sheetVariation, shapeOf, polylineLength } from "../src/book/sheetShape";
import { sheetUniformValues } from "../src/book/sheetUniforms";
import { eq, near, test, throws, truthy } from "./harness";

const OPEN = { coverAngle: 1, turned: 10 };

// ---------------------------------------------------------------------------------------------------------------------------
// the clock
// ---------------------------------------------------------------------------------------------------------------------------

test("sheets: a turn is 54 frames (36 quick), eased from 0 to 1, and lands in seconds", () => {
  eq(turnFrames(), 54, "turn");
  eq(turnFrames(true), 36, "quick turn");
  near(turnProgress(0, 0, 54), 0, 1e-9, "start");
  near(turnProgress(54, 0, 54), 1, 1e-9, "end");
  near(turnProgress(200, 0, 54), 1, 1e-9, "after");
  near(turnProgress(27, 0, 54), 0.5, 1e-6, "the signature ease is symmetric");
  eq(landSeconds(40, 0, 54), 0, "not landed yet");
  near(landSeconds(54 + FPS / 2, 0, 54), 0.5, 1e-9, "half a second after");
  throws(() => turnProgress(0, 0, 0), "positive length");
  near(turnedDuring(10, 0.25), 10.25, 1e-12, "stacks follow the sheet");
});

// ---------------------------------------------------------------------------------------------------------------------------
// the riffle
// ---------------------------------------------------------------------------------------------------------------------------

test("sheets: the riffle's starts grow from 6 to 10 frames and span 88 to 104 frames for 12 to 14 sheets", () => {
  for (const count of [12, 13, 14]) {
    const starts = riffleStarts({ start: 0, count });
    eq(starts.length, count, "one start per sheet");
    near(starts[1] - starts[0], SHEET.riffle.gapFrom, 1e-9, "first gap");
    near(starts[count - 1] - starts[count - 2], SHEET.riffle.gapTo, 1e-9, "last gap");
    for (let k = 2; k < count; k++) truthy(starts[k] - starts[k - 1] >= starts[k - 1] - starts[k - 2] - 1e-9, "gaps never shrink");
    const span = riffleFrames({ start: 0, count }).startsSpan;
    truthy(span >= 88 && span <= 104, `${count} sheets span ${span} frames`);
  }
  throws(() => riffleStarts({ start: 0, count: 9 }), "10 to 14");
  throws(() => riffleStarts({ start: 0, count: 15 }), "10 to 14");
});

test("sheets: in a riffle rank 0 turns first, the others wait their turn, and the stacks count the crossing", () => {
  const params = { start: 20, count: 12, first: 5, baseTurned: 5 };
  const before = riffleSheets(10, params);
  truthy(before.every((s) => s.P === 0 && s.landSec === 0), "nothing has started");
  eq(riffleTurned(10, params), 5, "no sheet has crossed");
  const mid = riffleSheets(35, params);
  truthy(mid[0].P > mid[1].P && mid[1].P >= mid[2].P, "earlier sheets are further along");
  eq(mid[3].index, 8, "the sheet's number in the book");
  const after = riffleSheets(20 + riffleFrames(params).total + 60, params);
  truthy(after.every((s) => s.P === 1 && s.landSec > 0), "all have landed");
  near(riffleTurned(20 + riffleFrames(params).total + 60, params), 5 + 12, 1e-9, "twelve sheets crossed");
});

// ---------------------------------------------------------------------------------------------------------------------------
// the paper's length (guide 06 section 6): the sheet never stretches, within 0.5 percent
// ---------------------------------------------------------------------------------------------------------------------------

test("sheets: rows keep the paper's length exactly at every readout progress, for every book", () => {
  for (const id of BOOK_IDS) {
    const spec = BOOKS[id];
    for (const turned of [0, 10, 40]) {
      const layout = sheetLayout(spec, { coverAngle: 1, turned: turned + 0.5 }, turned);
      for (const index of [turned, turned + 1]) {
        const shape = shapeOf(layout, sheetVariation(spec, index));
        for (const P of SHEET.readout.progress) {
          const r = lengthReadout(P, layout, shape, 0.05);
          near(r.rowMin, 1, SHEET.readout.tolerance, `${id} P ${P} rowMin`);
          near(r.rowMax, 1, SHEET.readout.tolerance, `${id} P ${P} rowMax`);
        }
      }
    }
  }
});

test("sheets: columns (head to tail) stay within the tolerance too", () => {
  const spec = BOOKS["mini-me"];
  const layout = sheetLayout(spec, OPEN, OPEN.turned);
  const shape = shapeOf(layout, NO_VARIATION);
  for (const P of SHEET.readout.progress) {
    const r = lengthReadout(P, layout, shape, 0.05);
    near(r.columnMin, 1, SHEET.readout.tolerance, `P ${P} columnMin`);
    near(r.columnMax, 1, SHEET.readout.tolerance, `P ${P} columnMax`);
  }
});

test("sheets: the mesh's own rows keep the paper's length on both layers", () => {
  const spec = BOOKS["mini-me"];
  const layout = sheetLayout(spec, OPEN, OPEN.turned);
  const shape = shapeOf(layout, NO_VARIATION);
  for (const P of [0.2, 0.5, 0.8]) {
    const mesh = sheetMesh(P, 0, layout, shape);
    for (const r of [0, 9, 18, 27, mesh.rows]) {
      // the layers sit half the depth either side of the mid-surface, so the length of a layer differs from W only by the bend of the row
      near(meshRowLength(mesh, r, "front") / layout.W, 1, 0.02, `P ${P} row ${r} front`);
      near(meshRowLength(mesh, r, "back") / layout.W, 1, 0.02, `P ${P} row ${r} back`);
    }
  }
});

// ---------------------------------------------------------------------------------------------------------------------------
// the shape
// ---------------------------------------------------------------------------------------------------------------------------

test("sheets: the ends of a turn are the two stacks, the outer edge is late and the angle never leaves [0, rest]", () => {
  const spec = BOOKS["mini-me"];
  const layout = sheetLayout(spec, OPEN, OPEN.turned);
  const shape = shapeOf(layout, NO_VARIATION);
  for (const v of [0, 0.5, 1]) {
    for (const u of [0, 0.3, 0.7, 1]) {
      near(sheetAngle(u, v, 0, 0, shape), 0, 1e-9, "flat on the right stack");
      near(sheetAngle(u, v, 1, 5, shape), layout.restAngle, 1e-3, "flat on the left stack once the rebound is gone");
    }
  }
  // lag: at the same mid-turn progress the outer edge is behind the gutter's column
  truthy(columnProgress(0.5, 1, shape) < columnProgress(0.5, 0, shape), "the outer edge arrives late");
  near(gutterProgress(1 - shape.lag, shape), 1, 1e-9, "the gutter is done at 1 - lag");
  for (let k = 0; k <= 100; k++) {
    for (const t of [0, 0.02, 0.05, 0.1, 0.3]) {
      const a = sheetAngle(1, 0.2, k / 100, t, shape);
      truthy(a >= 0 && a <= layout.restAngle + 1e-12, `angle ${a} outside [0, rest]`);
    }
  }
});

test("sheets: after landing the rebound only lifts the free edge, and decays", () => {
  const spec = BOOKS["mini-me"];
  const layout = sheetLayout(spec, OPEN, OPEN.turned);
  const shape = shapeOf(layout, NO_VARIATION);
  let peak = 0;
  for (let t = 0; t < 0.6; t += 0.005) {
    const a = sheetAngle(1, 0.5, 1, t, shape);
    truthy(a <= layout.restAngle + 1e-12, "never through the page below");
    peak = Math.max(peak, layout.restAngle - a);
  }
  truthy(peak > 0.2 * shape.flutter, "there is a visible bump");
  near(sheetAngle(0, 0.5, 1, 0.05, shape), layout.restAngle, 1e-9, "the gutter does not move");
  near(layout.restAngle - sheetAngle(1, 0.5, 1, 3, shape), 0, 1e-6, "it has settled after three seconds");
});

test("sheets: the CPU mesh is deterministic and carries the unit normal", () => {
  const spec = BOOKS["minilocker"];
  const layout = sheetLayout(spec, { coverAngle: 1, turned: 3.4 }, 3);
  const shape = shapeOf(layout, sheetVariation(spec, 3));
  const a = sheetMesh(0.37, 0, layout, shape);
  const b = sheetMesh(0.37, 0, layout, shape);
  truthy(a.front.every((v, i) => v === b.front[i]), "same input, same mesh");
  for (let i = 0; i < a.normal.length; i += 3) near(Math.hypot(a.normal[i], a.normal[i + 1], a.normal[i + 2]), 1, 1e-5, "unit normal");
  const row = sheetRow(0.5, 0.37, 0, shape);
  near(polylineLength(row), layout.W, 1e-9, "row length");
});

test("sheets: a point on a stack follows its bow and a point in the air does not", () => {
  const rest = { restAngle: Math.PI, restBlend: (SHEET.restBlendDeg * Math.PI) / 180 };
  near(restWeightAt(0, rest), 1, 1e-12, "on the right stack");
  near(restWeightAt(Math.PI, rest), 1, 1e-12, "on the left stack");
  near(restWeightAt(Math.PI / 2, rest), 0, 1e-12, "vertical");
});

// ---------------------------------------------------------------------------------------------------------------------------
// where a sheet stands
// ---------------------------------------------------------------------------------------------------------------------------

test("sheets: the pivot goes from the right stack's gutter to the left one's on an arc, and the offsets order the riffle", () => {
  const spec = BOOKS["mini-me"];
  const layout = sheetLayout(spec, OPEN, OPEN.turned);
  const shape = shapeOf(layout, NO_VARIATION);
  const o = restOffsets({ rank: 0, count: 1 });
  const p0 = sheetPivot(0, layout, shape);
  near(p0[0], layout.pivotR[0], 1e-9, "starts at the right gutter x");
  near(p0[1], layout.pivotR[1] + o.right, 1e-9, "stands off the face");
  const p1 = sheetPivot(1, layout, shape);
  near(p1[0], layout.pivotL[0] + layout.upL[0] * o.left, 1e-6, "ends at the left gutter x");
  near(p1[1], layout.pivotL[1] + layout.upL[1] * o.left, 1e-6, "ends at the left gutter y");
  const first = restOffsets({ rank: 0, count: 12 });
  const last = restOffsets({ rank: 11, count: 12 });
  truthy(first.right > last.right, "the first sheet to leave lies on top of the right stack");
  truthy(first.left < last.left, "and lands at the bottom of the left pile");
  near(last.right - SHEET.offsetCm - SHEET.depthCm / 2, 0, 1e-12, "the last one is nearest the face");
});

test("sheets: the blob exists only while a sheet is clear of the page", () => {
  const spec = BOOKS["mini-me"];
  const layout = sheetLayout(spec, OPEN, OPEN.turned);
  const shape = shapeOf(layout, NO_VARIATION);
  eq(sheetBlob(0, 0, layout, shape).opacity, 0, "rests on the right");
  truthy(sheetBlob(0.3, 0, layout, shape).opacity > 0.01, "in the air");
  const mid = sheetBlob(0.3, 0, layout, shape);
  truthy(mid.opacity <= SHEET.blob.maxOpacity + 1e-12, "never above the maximum");
  truthy(mid.x1 > mid.x0, "has a footprint");
  eq(sheetBlob(1, 5, layout, shape).opacity, 0, "rests on the left");
});

test("sheets: the variation is seeded by the book and the sheet and stays within the config's ranges", () => {
  const spec = BOOKS["mini-me"];
  const a = sheetVariation(spec, 7);
  const b = sheetVariation(spec, 7);
  eq(JSON.stringify(a), JSON.stringify(b), "same sheet, same variation");
  truthy(JSON.stringify(a) !== JSON.stringify(sheetVariation(spec, 8)), "neighbours differ");
  const V = SHEET.variation;
  for (let i = 0; i < 200; i++) {
    const s = sheetVariation(spec, i);
    truthy(Math.abs(s.curl - 1) <= V.curl + 1e-12 && Math.abs(s.lag - 1) <= V.lag + 1e-12, "curl and lag in range");
    truthy(Math.abs(s.flutter - 1) <= V.flutter + 1e-12 && Math.abs(s.flutterHz - 1) <= V.flutterHz + 1e-12, "flutter in range");
  }
});

// ---------------------------------------------------------------------------------------------------------------------------
// uniforms, grid, textures
// ---------------------------------------------------------------------------------------------------------------------------

test("sheets: the uniform values carry the shape in the order the shader reads", () => {
  const spec = BOOKS["mini-me"];
  const layout = sheetLayout(spec, OPEN, OPEN.turned);
  const shape = shapeOf(layout, NO_VARIATION);
  const v = sheetUniformValues(0.4, 0.1, layout, shape);
  eq(v.state[0], 0.4, "P");
  eq(v.state[1], 0.1, "landSec");
  eq(v.state[2], layout.restAngle, "restAngle");
  eq(v.shape1[0], shape.curl, "curl");
  eq(v.shape1[3], shape.lag, "lag");
  eq(v.shape2[3], shape.cornerU, "cornerU");
  eq(v.shape3[0], shape.cornerV, "cornerV");
  eq(v.size[0], layout.W, "W");
  eq(v.size[3], layout.bowAmp, "bowAmp");
  const pv = sheetPivot(0.4, layout, shape);
  eq(v.pivot[0], pv[0], "pivot x");
  eq(v.pivot[1], pv[1], "pivot y");
});

test("sheets: the grid has two layers of (cols + 1) x (rows + 1) points, and every index is in range", () => {
  const geo = sheetGridGeometry();
  const per = (SHEET.mesh.cols + 1) * (SHEET.mesh.rows + 1);
  eq(geo.getAttribute("aGrid").count, per * 2, "points");
  const index = geo.getIndex();
  truthy(index !== null, "indexed");
  eq(index!.count, SHEET.mesh.cols * SHEET.mesh.rows * 6 * 2, "triangles of both layers");
  let max = 0;
  for (let i = 0; i < index!.count; i++) max = Math.max(max, index!.getX(i));
  eq(max, per * 2 - 1, "highest index");
  const g = geo.getAttribute("aGrid");
  eq(g.getZ(0), 0, "front layer first");
  eq(g.getZ(per), 1, "back layer after it");
  near(g.getX(SHEET.mesh.cols), 1, 1e-9, "u runs to the outer edge");
  near(g.getY(per - 1), 1, 1e-9, "v runs to the tail");
  geo.dispose();
});

test("sheets: the checker marks the gutter of each side and the head", () => {
  const w = 160;
  const h = 240;
  const px = (data: Uint8Array, x: number, y: number): number[] => Array.from(data.subarray((y * w + x) * 4, (y * w + x) * 4 + 3));
  const front = checkerPixels(w, h, "front");
  const back = checkerPixels(w, h, "back");
  // a square is dark when (row + col) is even, so on row 1 the light squares are the even columns
  const cx = (c: number): number => Math.floor(((c + 0.5) / 16) * w);
  const cy = (r: number): number => Math.floor(((r + 0.5) / 24) * h);
  eq(px(front, cx(0), cy(1)).join(), "214,98,60", "front gutter, left, orange");
  eq(px(back, cx(14), cy(1)).join(), "60,118,214", "back gutter, right, blue");
  eq(px(front, cx(4), cy(1)).join(), "238,232,220", "plain light square");
  eq(px(front, cx(1), cy(0)).join(), "220,40,60", "head row, red");
});
