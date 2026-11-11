// Patch 03: the match camera, the plate card, the placement zones and the JSON the lab prints.
import * as THREE from "three";
import plateMatchJson from "../src/config/plateMatch.json";
import { DESK_MARGIN_CM, EXCLUSIONS, FOOTPRINTS, ZONES, footprintCorners, footprintInZone, rectGapCm } from "../src/config/placement";
import { PLATE_H, PLATE_W } from "../src/config/plate";
import { HEIGHT, WIDTH } from "../src/config/timeline";
import { prng } from "../src/lib/prng";
import { PLATE_MATCH, VIEW_FIT, photoToScreen, plateCameraRig, plateTransform } from "../src/plate/PlateFollow";
import {
  HORIZON_RANGE,
  MEASURED_DESK,
  buildMatchJson,
  cardTransform,
  deskEdgesPx,
  focalPx,
  formatMatchJson,
  lampBulb,
  matchCameraRig,
  parsePlateMatch,
  principalY,
  projectDesk,
  solveFromDeskEdges,
  unprojectToDesk,
  type MatchParams,
  type PlateWindowView,
} from "../src/plate/plateCamera";
import { eq, near, test, throws, truthy } from "./harness";

const randView = (r: () => number): PlateWindowView => ({ M: 1.25 + r() * 7, cx: 200 + r() * 1136, cy: 300 + r() * 260 });

/** a three.js camera set the way <MatchCamera> sets it */
function threeCamera(p: MatchParams, view: PlateWindowView): { cam: THREE.PerspectiveCamera; group: THREE.Group } {
  const rig = matchCameraRig(p, view);
  const cam = new THREE.PerspectiveCamera(rig.fovDeg, rig.aspect, 1, 5000);
  cam.position.set(...rig.position);
  cam.rotation.set(rig.rotationX, 0, 0);
  cam.setViewOffset(rig.viewOffset.fullW, rig.viewOffset.fullH, rig.viewOffset.x, rig.viewOffset.y, rig.viewOffset.w, rig.viewOffset.h);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  const group = new THREE.Group();
  group.position.set(...rig.position);
  group.rotation.set(rig.rotationX, 0, 0);
  group.updateMatrixWorld(true);
  return { cam, group };
}
const toScreen = (v: THREE.Vector3, cam: THREE.PerspectiveCamera): { x: number; y: number } => {
  const n = v.clone().project(cam);
  return { x: ((n.x + 1) / 2) * WIDTH, y: ((1 - n.y) / 2) * HEIGHT };
};

// ---------- the committed match ----------

test("match: plateMatch.json parses and its derived numbers equal what the code computes from the source numbers", () => {
  const p = parsePlateMatch(plateMatchJson);
  const again = buildMatchJson(p, { status: plateMatchJson.status as "seed" | "chosen", horizonChoice: plateMatchJson.horizon.choice });
  // the file holds rounded numbers and the derived ones were computed before rounding, so compare to 0.05
  const close = (a: unknown, b: unknown, path: string): void => {
    if (typeof a === "number" && typeof b === "number") return near(a, b, 0.05, path);
    if (a && b && typeof a === "object" && typeof b === "object") {
      eq(Object.keys(a).join(","), Object.keys(b).join(","), `${path} keys`);
      for (const k of Object.keys(a)) close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
      return;
    }
    eq(a, b, path);
  };
  close(plateMatchJson, again, "plateMatch");
});
test("match: the desk plane lands on the desk corners measured on the plate (within 0.5 px)", () => {
  const e = deskEdgesPx(PLATE_MATCH);
  const m = MEASURED_DESK;
  near(e.front.y, m.front.y, 0.5, "front y");
  near(e.front.xLeft, m.front.xLeft, 0.5, "front left x");
  near(e.front.xRight, m.front.xRight, 0.5, "front right x");
  near(e.back.y, m.back.y, 0.5, "back y");
  near(e.back.xLeft, m.back.xLeft, 0.5, "back left x");
  near(e.back.xRight, m.back.xRight, 0.5, "back right x");
});
test("match: the horizon is where the file says, and a far desk point converges to it", () => {
  const far = projectDesk(PLATE_MATCH, 0, 0, 1e7);
  near(far.y, PLATE_MATCH.horizonY, 0.01, "horizon");
  near(far.x, PLATE_MATCH.principalX, 0.05, "vanishing point x");
  for (const pitch of [-2.5, 1.2, 3]) {
    const q = { ...PLATE_MATCH, pitchDeg: pitch };
    near(projectDesk(q, 0, 0, 1e7).y, q.horizonY, 0.01, `horizon at pitch ${pitch}`);
  }
});
test("match: the scale is recorded (px per cm at the front edge) and agrees with f / distance", () => {
  const j = plateMatchJson;
  near(j.scale.pxPerCmAtFront, focalPx(PLATE_MATCH) / PLATE_MATCH.camDistCm, 0.002, "scale");
  near(j.scale.deskWidthCm, PLATE_MATCH.deskXMaxCm - PLATE_MATCH.deskXMinCm, 0.01, "desk width");
  near(j.derived.principalY, principalY(PLATE_MATCH), 0.01, "principal y");
});
test("match: the opening view of the pile anchor and the riser anchor are where the plan put them (plate px 418,561 and 971,561)", () => {
  const a = projectDesk(PLATE_MATCH, ZONES.L.anchor.X, 0, ZONES.L.anchor.Zd);
  const b = projectDesk(PLATE_MATCH, ZONES.R.anchor.X, 0, ZONES.R.anchor.Zd);
  near(a.x, 418, 2, "pile x");
  near(a.y, 561, 2, "pile y");
  near(b.x, 971, 2.5, "riser x");
  near(b.y, 561, 2, "riser y");
});

// ---------- the model ----------

test("match: unproject inverts project on the desk plane, level and pitched", () => {
  const r = prng(5);
  for (const pitch of [0, 1.7, -2.2]) {
    const p = { ...PLATE_MATCH, pitchDeg: pitch };
    for (let i = 0; i < 30; i++) {
      const X = -50 + r() * 230;
      const Zd = r() * 64;
      const q = projectDesk(p, X, 0, Zd);
      const u = unprojectToDesk(p, q.x, q.y);
      truthy(u, "below the horizon");
      near(u!.X, X, 1e-6, "X");
      near(u!.Zd, Zd, 1e-6, "Zd");
    }
  }
  eq(unprojectToDesk(PLATE_MATCH, 700, PLATE_MATCH.horizonY - 5), null, "above the horizon");
});

test("match: a three.js camera set from the rig projects desk points exactly like the formulas, at any zoom, pan and pitch", () => {
  const r = prng(21);
  for (let i = 0; i < 80; i++) {
    const p: MatchParams = { ...PLATE_MATCH, camHeightCm: 30 + r() * 30, camDistCm: 350 + r() * 300, fovDeg: 18 + r() * 14, pitchDeg: (r() - 0.5) * 5, horizonY: 380 + r() * 90, principalX: 400 + r() * 500 };
    const view = randView(r);
    const { cam } = threeCamera(p, view);
    const X = -50 + r() * 230;
    const Y = r() * 25;
    const Zd = r() * 60;
    const s = toScreen(new THREE.Vector3(X, Y, -Zd), cam);
    const a = projectDesk(p, X, Y, Zd);
    const o = photoToScreen(view, a.x, a.y);
    near(s.x, o.x, 0.01, "screen x");
    near(s.y, o.y, 0.01, "screen y");
  }
});

test("match: the plate card, seen through that camera, is exactly the window: plate px (x, y) lands at the output px of PlateFollow.photoToScreen", () => {
  const r = prng(33);
  for (let i = 0; i < 60; i++) {
    const p: MatchParams = { ...PLATE_MATCH, fovDeg: 18 + r() * 14, pitchDeg: (r() - 0.5) * 5, horizonY: 380 + r() * 90, principalX: 400 + r() * 500 };
    const view = i === 0 ? VIEW_FIT : randView(r);
    const { cam, group } = threeCamera(p, view);
    const card = cardTransform(p);
    for (const [px, py] of [[0, 0], [PLATE_W, 0], [PLATE_W, PLATE_H], [0, PLATE_H], [PLATE_W / 2, PLATE_H / 2], [418, 561]]) {
      const local = new THREE.Vector3(card.position[0] + (px - PLATE_W / 2) * card.cmPerPx, card.position[1] - (py - PLATE_H / 2) * card.cmPerPx, card.position[2]);
      const s = toScreen(local.applyMatrix4(group.matrixWorld), cam);
      const o = photoToScreen(view, px, py);
      near(s.x, o.x, 0.02, `card x at ${px},${py}`);
      near(s.y, o.y, 0.02, `card y at ${px},${py}`);
    }
  }
});

test("match: a box standing on the desk stays on the desk: its footprint on the plate is the same at every zoom (the plate and the box share one camera)", () => {
  const corners = footprintCorners(0, 16, FOOTPRINTS.book.w, FOOTPRINTS.book.d, 7);
  for (const view of [VIEW_FIT, { M: 2.46, cx: 480, cy: 520 }, { M: 4.49, cx: 418, cy: 545 }]) {
    const { cam } = threeCamera(PLATE_MATCH, view);
    for (const c of corners) {
      const s = toScreen(new THREE.Vector3(c.X, 0, -c.Zd), cam);
      const a = projectDesk(PLATE_MATCH, c.X, 0, c.Zd);
      const o = photoToScreen(view, a.x, a.y);
      near(s.x, o.x, 0.01, "x");
      near(s.y, o.y, 0.01, "y");
    }
  }
});

test("match: at the opening view the window is the whole plate, the card fills the frame and the camera's pose is the match's", () => {
  const rig = plateCameraRig(VIEW_FIT);
  const card = plateTransform(VIEW_FIT);
  near(rig.position[0], PLATE_MATCH.camXCm, 1e-9, "x");
  near(rig.position[1], PLATE_MATCH.camHeightCm, 1e-9, "y");
  near(rig.position[2], PLATE_MATCH.camDistCm, 1e-9, "z");
  near(card.position[2], -(PLATE_MATCH.camDistCm + PLATE_MATCH.plateDepthCm), 1e-9, "card depth");
  const { cam, group } = threeCamera(PLATE_MATCH, VIEW_FIT);
  const tl = toScreen(new THREE.Vector3(card.position[0] - card.width / 2, card.position[1] + card.height / 2, card.position[2]).applyMatrix4(group.matrixWorld), cam);
  const br = toScreen(new THREE.Vector3(card.position[0] + card.width / 2, card.position[1] - card.height / 2, card.position[2]).applyMatrix4(group.matrixWorld), cam);
  near(tl.x, 0, 0.02, "left");
  near(tl.y, 0, 0.02, "top");
  near(br.x, WIDTH, 0.02, "right");
  near(br.y, HEIGHT, 0.02, "bottom");
});

// ---------- the horizon (D-25) ----------

test("match: the solver keeps the desk's FRONT edge, back edge height and front corners exact at any horizon from y 380 to y 470", () => {
  for (const h of [HORIZON_RANGE.min, 396, 420, 464, HORIZON_RANGE.max]) {
    const p = solveFromDeskEdges({ horizonY: h, principalX: PLATE_MATCH.principalX, deskWidthCm: 233, deskDepthCm: 65, camXCm: PLATE_MATCH.camXCm });
    const e = deskEdgesPx(p);
    const m = MEASURED_DESK;
    near(e.front.y, m.front.y, 0.05, `front y at ${h}`);
    near(e.back.y, m.back.y, 0.05, `back y at ${h}`);
    near(e.front.xLeft, m.front.xLeft, 0.05, `front left at ${h}`);
    near(e.front.xRight, m.front.xRight, 0.05, `front right at ${h}`);
    truthy(p.camHeightCm > 0 && p.camDistCm > 0 && p.fovDeg > 5 && p.fovDeg < 80, `sane camera at ${h}`);
  }
});
test("match: the desk's BACK corners fit only when the horizon is where the desk's own side edges converge (D-25: the plate's two sets of lines disagree)", () => {
  const err = (h: number): number => {
    const p = solveFromDeskEdges({ horizonY: h, principalX: PLATE_MATCH.principalX, deskWidthCm: 233, deskDepthCm: 65, camXCm: PLATE_MATCH.camXCm });
    const e = deskEdgesPx(p);
    return Math.max(Math.abs(e.back.xLeft - MEASURED_DESK.back.xLeft), Math.abs(e.back.xRight - MEASURED_DESK.back.xRight));
  };
  near(err(MEASURED_DESK.horizonFromDeskEdges), 0, 0.1, "at the desk edges' horizon");
  truthy(err(420) > 5 && err(464) > 25 && err(464) > err(420), "the error grows as the horizon moves away");
});
test("match: moving the horizon moves the desk plane's interior only a little near the front edge (the anchors stay within 15 px), so zones stay usable", () => {
  const at = (h: number) => solveFromDeskEdges({ horizonY: h, principalX: PLATE_MATCH.principalX, deskWidthCm: 233, deskDepthCm: 65, camXCm: PLATE_MATCH.camXCm });
  const ref = at(MEASURED_DESK.horizonFromDeskEdges);
  for (const h of [HORIZON_RANGE.min, 464, HORIZON_RANGE.max]) {
    for (const [X, Zd] of [[0, 16], [153, 16]]) {
      const a = projectDesk(ref, X, 0, Zd);
      const b = projectDesk(at(h), X, 0, Zd);
      truthy(Math.hypot(a.x - b.x, a.y - b.y) < 15, `anchor ${X},${Zd} moved ${Math.hypot(a.x - b.x, a.y - b.y).toFixed(1)} px at horizon ${h}`);
    }
  }
});
test("match: the horizon changes how much of a box's top you see (a 10 cm box top is flatter for a lower camera)", () => {
  const top = (h: number): number => {
    const p = solveFromDeskEdges({ horizonY: h, principalX: 544.7, deskWidthCm: 233, deskDepthCm: 65, camXCm: 35 });
    return Math.abs(projectDesk(p, 0, 10, 27.4).y - projectDesk(p, 0, 10, 4.5).y);
  };
  truthy(top(380) > top(396) && top(396) > top(464) && top(464) > top(470), "monotonic");
});
test("match: the solver refuses a horizon at or below the desk's back edge", () => {
  throws(() => solveFromDeskEdges({ horizonY: 546, principalX: 544.7, deskWidthCm: 233, deskDepthCm: 65, camXCm: 35 }), "must be above");
});

// ---------- the lamp ----------

test("match: the lamp bulb is at the desk's left, at its back, about 12 cm up, and agrees with the file", () => {
  const l = lampBulb(PLATE_MATCH);
  near(l.X, -35.3, 1, "X");
  near(l.Zd, 59, 1.5, "Zd");
  near(l.Y, 12.3, 1.5, "Y");
  near(plateMatchJson.landmarks.lampBulb.X, l.X, 0.02, "json X");
  near(plateMatchJson.landmarks.lampBulb.Y, l.Y, 0.02, "json Y");
  const l2 = lampBulb(solveFromDeskEdges({ horizonY: 464, principalX: 544.7, deskWidthCm: 233, deskDepthCm: 65, camXCm: 35 }));
  truthy(Math.abs(l2.X - l.X) < 8 && Math.abs(l2.Zd - l.Zd) < 3, "the lamp's place on the desk moves only a little with the horizon");
});

// ---------- the JSON ----------

test("match: the lab's printed JSON is valid JSON, ends with a newline, and reads back to the same match", () => {
  const p = solveFromDeskEdges({ horizonY: 420, principalX: 560, deskWidthCm: 240, deskDepthCm: 66, camXCm: 35 });
  const text = formatMatchJson(buildMatchJson(p, { status: "chosen", horizonChoice: "custom (y 420.0)" }));
  truthy(text.endsWith("}\n"), "newline");
  const back = parsePlateMatch(JSON.parse(text));
  for (const k of Object.keys(p) as (keyof MatchParams)[]) near(back[k], p[k], 0.006, k);
});
test("match: a missing number in plateMatch.json is reported by its path", () => {
  throws(() => parsePlateMatch({ camera: { xCm: 35 } }), "missing data: plateMatch.camera.heightCm");
});

// ---------- placement zones ----------

test("zones: both zones lie on the desk, at least the margin from its edges", () => {
  const m = PLATE_MATCH;
  for (const id of ["L", "R"] as const) {
    const z = ZONES[id];
    truthy(z.x0 < z.x1 && z.zd0 < z.zd1, `${id} is a rectangle`);
    truthy(z.x0 >= m.deskXMinCm + DESK_MARGIN_CM - 1e-9 && z.x1 <= m.deskXMaxCm - DESK_MARGIN_CM + 1e-9, `${id} x inside the desk`);
    truthy(z.zd0 >= DESK_MARGIN_CM - 1e-9 && z.zd1 <= m.deskDepthCm - DESK_MARGIN_CM, `${id} depth inside the desk`);
    truthy(z.anchor.X >= z.x0 && z.anchor.X <= z.x1 && z.anchor.Zd >= z.zd0 && z.anchor.Zd <= z.zd1, `${id} anchor inside`);
  }
});
test("zones: the pile (a trade book, turned up to 12 degrees) fits zone L, and the riser (36 x 24 cm) fits zone R", () => {
  for (const yaw of [-12, -6, 0, 6, 12]) truthy(footprintInZone(ZONES.L, ZONES.L.anchor.X, ZONES.L.anchor.Zd, FOOTPRINTS.book.w, FOOTPRINTS.book.d, yaw), `pile at ${yaw} degrees`);
  eq(FOOTPRINTS.riser.w, 36, "riser width");
  eq(FOOTPRINTS.riser.d, 24, "riser depth");
  truthy(footprintInZone(ZONES.R, ZONES.R.anchor.X, ZONES.R.anchor.Zd, FOOTPRINTS.riser.w, FOOTPRINTS.riser.d), "riser at its anchor");
  truthy(!footprintInZone(ZONES.R, ZONES.R.x1, ZONES.R.anchor.Zd, FOOTPRINTS.riser.w, FOOTPRINTS.riser.d), "a riser at the zone's edge does not fit (the check can fail)");
});
test("zones: no zone comes within the desk margin of anything that stands on the desk", () => {
  for (const ex of EXCLUSIONS) {
    if (!ex.desk) continue;
    for (const id of ["L", "R"] as const) truthy(rectGapCm(ZONES[id], ex.desk) >= DESK_MARGIN_CM - 1e-9, `zone ${id} is ${rectGapCm(ZONES[id], ex.desk).toFixed(1)} cm from ${ex.id}`);
  }
});
test("zones: in the picture, the riser footprint and both zones keep clear of the chair (8 px), the lamp and the other objects", () => {
  const chair = EXCLUSIONS.find((e) => e.id === "chair");
  truthy(chair, "chair is listed");
  const polys: Record<string, { x: number; y: number }[]> = {
    riser: footprintCorners(ZONES.R.anchor.X, ZONES.R.anchor.Zd, FOOTPRINTS.riser.w, FOOTPRINTS.riser.d).map((c) => projectDesk(PLATE_MATCH, c.X, 0, c.Zd)),
    zoneR: footprintCorners((ZONES.R.x0 + ZONES.R.x1) / 2, (ZONES.R.zd0 + ZONES.R.zd1) / 2, ZONES.R.x1 - ZONES.R.x0, ZONES.R.zd1 - ZONES.R.zd0).map((c) => projectDesk(PLATE_MATCH, c.X, 0, c.Zd)),
    zoneL: footprintCorners((ZONES.L.x0 + ZONES.L.x1) / 2, (ZONES.L.zd0 + ZONES.L.zd1) / 2, ZONES.L.x1 - ZONES.L.x0, ZONES.L.zd1 - ZONES.L.zd0).map((c) => projectDesk(PLATE_MATCH, c.X, 0, c.Zd)),
  };
  for (const [name, poly] of Object.entries(polys)) {
    const minX = Math.min(...poly.map((q) => q.x));
    const maxX = Math.max(...poly.map((q) => q.x));
    const minY = Math.min(...poly.map((q) => q.y));
    const maxY = Math.max(...poly.map((q) => q.y));
    for (const ex of EXCLUSIONS) {
      const c = ex.clearancePx ?? 0;
      const b = ex.photoBox;
      // overlap of the bounding boxes, each exclusion's inflated by its clearance; objects that stand on the desk are checked in cm above, here only where they could cover the zone
      const overlap = minX < b.x1 + c && maxX > b.x0 - c && minY < b.y1 + c && maxY > b.y0 - c;
      if (ex.id === "chair") truthy(!overlap, `${name} touches the chair: ${minX.toFixed(1)} px vs the chair's edge ${b.x1}`);
    }
  }
  truthy(Math.min(...polys.riser.map((q) => q.x)) - chair!.photoBox.x1 >= 8, "the riser is at least 8 px from the chair");
});
test("zones: each exclusion's desk rectangle agrees with where its photo box stands on the desk (within 4 cm; a lamp globe is wider than its base)", () => {
  for (const ex of EXCLUSIONS) {
    if (!ex.desk) continue;
    const b = ex.photoBox;
    const left = unprojectToDesk(PLATE_MATCH, b.x0, b.y1);
    const right = unprojectToDesk(PLATE_MATCH, b.x1, b.y1);
    truthy(left && right, `${ex.id} below the horizon`);
    truthy(left!.X >= ex.desk.x0 - 4 && left!.X <= ex.desk.x1 + 4, `${ex.id} left edge ${left!.X.toFixed(1)} vs ${ex.desk.x0}..${ex.desk.x1}`);
    truthy(right!.X >= ex.desk.x0 - 4 && right!.X <= ex.desk.x1 + 4, `${ex.id} right edge ${right!.X.toFixed(1)} vs ${ex.desk.x0}..${ex.desk.x1}`);
    truthy(left!.Zd >= ex.desk.zd0 - 1 && left!.Zd <= ex.desk.zd1 + 1, `${ex.id} base depth ${left!.Zd.toFixed(1)} vs ${ex.desk.zd0}..${ex.desk.zd1}`);
  }
});
test("zones: the list holds the lamp, the keyboard and mat, the chair, the speaker and the headset stand", () => {
  eq(EXCLUSIONS.map((e) => e.id).sort().join(","), "chair,headset_stand,keyboard_and_mat,lamp,speaker", "ids");
});
