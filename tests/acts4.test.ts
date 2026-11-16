// PATCH 16: the shots S10-S13 (riffle, gallery, film, links) and what Gate G2 can check by number: the riffle's clock and the stacks it moves,
// which page is on which face at every frame, the camera path 1920-2759 against the audit and the frame, the QR hold (square-on, flat, steady,
// at least 90 frames, the size of a module on screen, a simulated decode), the film page that never plays, the cues. The pictures, the
// frame-by-frame look at 60 fps and the scan with a phone are looked at by a person (see the notes of Patch 16).
import * as THREE from "three";
import fs from "node:fs";
import path from "node:path";
import jsQR from "jsqr";
import { BEAT, HEIGHT, SHOTS, WIDTH } from "../src/config/timeline";
import { HERO_STATES, VIEW_BLOCK, VIEW_LINKS, VIEW_READ, limitFor, stateOf } from "../src/config/camera";
import { HERO, heroOffsetAt, trackAt } from "../src/config/heroMotion";
import { BOOKS, sheetCount } from "../src/config/books";
import { BLANK_PAGE, BOOK_SCRIPT, FLUTTER_SEC, airSheetsAt, checkTurns, faceIndices, getBookLocation, getBookPose, getBookState, stacksAt, turnedAt, type TurnEvent } from "../src/config/ledger";
import { BOOK_PAGES, actAt, spreadAt } from "../src/config/pageSpecs";
import { MOTION } from "../src/config/bookMotion";
import { auditMotion } from "../src/camera/audit";
import { STEADY_RANGES, steadyGain as cameraSteadyGain } from "../src/camera/operator";
import { authoredAt, cameraAt } from "../src/camera/path";
import { PLATE_MATCH, photoToScreen } from "../src/plate/PlateFollow";
import { projectDesk } from "../src/plate/plateCamera";
import { poseEuler } from "../src/book/geometry";
import { steadyGain as bookSteadyGain } from "../src/book/rig/hold";
import { riffleFrames } from "../src/book/rig/riffle";
import { turnFrames, turnProgress } from "../src/book/rig/turn";
import { SINGLE, sheetLayout, shapeOf, sheetMesh } from "../src/book/sheetShape";
import { booksAliveInAct } from "../src/paint/spread";
import { qrMatrix } from "../src/paint/qr";
import { PAGE_PX_PER_CM } from "../src/config/pages";
import { planBook } from "../src/paint/pages";
import { getQrTargets } from "../src/data/select";
import { FILM_CAMERA_KEYFRAMES, FILM_CUES, shotById } from "../src/shots";
import { eq, near, test, throws, truthy } from "./harness";

const read = (rel: string): string => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const ids = ["S10", "S11", "S12", "S13"] as const;
const MINI = BOOKS["mini-me"];
const TURNS = BOOK_SCRIPT["mini-me"]!.turns;
const RIFFLE = TURNS.find((t) => t.riffle)!;

/** The open book of Mini Me through the film's camera (without the operator) at a frame: the spread's box on screen, the right page's angle to the camera, pixels per cm on the page. */
function measure(frame: number): { x0: number; x1: number; y0: number; y1: number; angleDeg: number; pxPerCm: number } {
  const W = MINI.trimW;
  const H = MINI.trimH;
  const T = MINI.spine + 2 * MINI.board;
  const st = getBookState("mini-me", frame)!;
  const view = cameraAt(frame, { operator: false }).view;
  const mat = new THREE.Matrix4().makeRotationFromEuler(poseEuler(st.pose));
  const screen = (local: THREE.Vector3): { x: number; y: number } => {
    const q = local.clone().applyMatrix4(mat);
    const pl = projectDesk(PLATE_MATCH, q.x + st.pose.position[0], q.y + st.pose.position[1], -(q.z + st.pose.position[2]));
    return photoToScreen(view, pl.x, pl.y);
  };
  const th = st.coverAngle * Math.PI;
  const xp = -W / 2;
  const ym = T / 2;
  const pts: THREE.Vector3[] = [];
  for (const x of [-W / 2, W / 2])
    for (const z of [-H / 2, H / 2]) {
      pts.push(new THREE.Vector3(x, 0, z));
      for (const y of [T - MINI.board, T]) pts.push(new THREE.Vector3(xp + (x - xp) * Math.cos(th) - (y - ym) * Math.sin(th), ym + (x - xp) * Math.sin(th) + (y - ym) * Math.cos(th), z));
    }
  const o = pts.map(screen);
  const centre = new THREE.Vector3(0, T, 0).applyMatrix4(mat).add(new THREE.Vector3(...st.pose.position));
  const normal = new THREE.Vector3(0, 1, 0).applyMatrix4(mat);
  const ray = new THREE.Vector3(PLATE_MATCH.camXCm, PLATE_MATCH.camHeightCm, PLATE_MATCH.camDistCm).sub(centre).normalize();
  const a = screen(new THREE.Vector3(-0.5, T, 0));
  const b = screen(new THREE.Vector3(0.5, T, 0));
  return {
    x0: Math.min(...o.map((p) => p.x)),
    x1: Math.max(...o.map((p) => p.x)),
    y0: Math.min(...o.map((p) => p.y)),
    y1: Math.max(...o.map((p) => p.y)),
    angleDeg: (Math.acos(Math.min(1, normal.dot(ray))) * 180) / Math.PI,
    pxPerCm: Math.hypot(a.x - b.x, a.y - b.y),
  };
}

// ---------- the riffle ----------

test("patch 16: the riffle is 11 sheets from frame 1920 and the last lands on 2030, inside S10 with the settle to spare", () => {
  const f = riffleFrames({ start: RIFFLE.start, count: RIFFLE.riffle });
  eq(RIFFLE.start, SHOTS[10].from, "it starts on the first frame of S10");
  eq(RIFFLE.start % BEAT, 0, "on a beat");
  truthy(RIFFLE.riffle! >= 10 && RIFFLE.riffle! <= 14, "10 to 14 sheets (guide 01)");
  eq(f.last, 2030, "the last sheet lands on frame 2030 (the patch text: frames 1920-2030)");
  truthy(f.last < SHOTS[10].to, "and it has landed before S11");
  truthy(f.startsSpan >= 70 && f.startsSpan <= 104, `the fan opens over ${f.startsSpan} frames (88 to 104 for 12 to 14 sheets; 11 sheets here)`);
});

test("patch 16: the stacks go from 2 sheets turned to the middle of the block during the riffle, never jump, and S12 and S13 turn one sheet each", () => {
  eq(turnedAt(1919, TURNS), 2);
  eq(turnedAt(1920, TURNS), 2, "nothing has crossed on the first frame");
  near(turnedAt(2030, TURNS), 2 + 62, 1e-9, "the middle of the block after the riffle");
  eq(sheetCount(MINI), 128);
  near(turnedAt(2030, TURNS), sheetCount(MINI) / 2, 1e-9, "62 + 2 of 128 sheets: exactly the middle");
  near(turnedAt(2270, TURNS), 64, 1e-9, "still the middle through the gallery spread");
  near(turnedAt(2400, TURNS), 65, 1e-9, "the film spread's turn has landed (2334)");
  near(turnedAt(2600, TURNS), 66, 1e-9, "and the links spread's turn (2574)");
  let step = 0;
  for (let f = 1921; f < 2100; f++) step = Math.max(step, turnedAt(f, TURNS) - turnedAt(f - 1, TURNS));
  truthy(step > 0 && step < 6, `the stacks change by at most ${step.toFixed(2)} sheets a frame`);
  for (let f = 1920; f < 2031; f++) truthy(turnedAt(f, TURNS) >= turnedAt(f - 1, TURNS) - 1e-12, `frame ${f}: the left stack only grows`);
});

test("patch 16: the turns of S12 and S13 are full turns (54 frames) that start on the first frame of their shots and land with the spread readable", () => {
  eq(TURNS.filter((t) => !t.riffle && (t.dir ?? 1) === 1).map((t) => t.start).join(","), "1560,1680,2280,2520");
  for (const start of [2280, 2520]) {
    const t = TURNS.find((x) => x.start === start)!;
    eq(t.quick ?? false, false, `the turn on ${start} is the full animation`);
    eq(turnFrames(false), 54);
    eq(start % BEAT, 0);
    eq(shotById(start === 2280 ? "S12" : "S13").from, start);
  }
  eq(turnProgress(2280 + 54, 2280, 54), 1);
});

test("patch 16: which page is on which face, frame by frame: gallery, film, links (guide 04 section 5 and `BOOK_PAGES`)", () => {
  const want: [number, number, number][] = [
    [1919, 4, 5], // P-ABST | P-FIG, the end of S09
    [1920, 4, 5], // the first sheet is on the figure
    [1930, 4, BLANK_PAGE], // the fan has started: body pages
    [1990, BLANK_PAGE, BLANK_PAGE],
    [2001, BLANK_PAGE, 7], // the last sheet is in the air: the gallery's right page is under it
    [2029, BLANK_PAGE, 7],
    [2030, 6, 7], // landed: P-GAL | P-GAL
    [2040, 6, 7],
    [2279, 6, 7],
    [2281, 6, 9], // the film spread's turn: P-FILM is under the sheet
    [2340, 8, 9], // P-GAL | P-FILM
    [2519, 8, 9],
    [2521, 8, 11], // P-LINK under the sheet
    [2580, 10, 11], // P-COLO (read on the web) | P-LINK
    [2759, 10, 11],
  ];
  for (const [f, l, r] of want) {
    const at = faceIndices(f, TURNS);
    eq(`${at.left},${at.right}`, `${l},${r}`, `frame ${f}`);
  }
  const types = (l: number, r: number): string => `${BOOK_PAGES["mini-me"][l].type},${BOOK_PAGES["mini-me"][r].type}`;
  eq(types(6, 7), "P-GAL,P-GAL");
  eq(types(8, 9), "P-GAL,P-FILM");
  eq(types(10, 11), "P-COLO,P-LINK");
  eq(spreadAt("mini-me", 10).left?.web, true, "the left page of the links spread is the 'Read on the web' column");
  eq(actAt(2100), 4);
  eq(booksAliveInAct(4).join(","), "mini-me", "Mini Me's pages are alive through Act 4");
  eq(JSON.stringify(stacksAt(2100, TURNS)), JSON.stringify({ left: 3, airborne: false }), "the riffle counts as one leaf of the page list");
});

test("patch 16: a blank face exists only inside the riffle, every other face is a painted page, and left faces are even, right faces odd", () => {
  for (let f = 1440; f < 2880; f++) {
    const at = faceIndices(f, TURNS);
    const inside = f >= 1920 && f < 2030;
    if (!inside) truthy(at.left !== BLANK_PAGE && at.right !== BLANK_PAGE, `frame ${f}: a blank face outside the riffle`);
    truthy(at.left === BLANK_PAGE || (at.left % 2 === 0 && at.left >= 0 && at.left <= 12), `frame ${f}: left face ${at.left}`);
    truthy(at.right === BLANK_PAGE || (at.right % 2 === 1 && at.right <= 12), `frame ${f}: right face ${at.right}`);
  }
});

test("patch 16: the riffle's sheets: the first carries the figure page, the last has the gallery's left page on its back, the rest are blank, none is left in the air by frame 2100", () => {
  const air = (f: number) => airSheetsAt(f, TURNS);
  const at1930 = air(1930);
  eq(at1930[0].front, 5, "the first sheet's front is the figure page (5)");
  eq(at1930[0].place.rank, 0);
  eq(at1930[0].place.count, RIFFLE.riffle, "the placement is the riffle's");
  const all = air(2031).filter((s) => s.place.count === RIFFLE.riffle);
  const last = all.find((s) => s.place.rank === RIFFLE.riffle! - 1)!;
  eq(last.back, 6, "the last sheet's back is the gallery's left page (6): the face under it is the same page");
  for (const s of air(2031)) if (s.place.count === RIFFLE.riffle && s.place.rank > 0) eq(s.front, BLANK_PAGE, `sheet ${s.place.rank} front`);
  for (const s of air(2031)) if (s.place.count === RIFFLE.riffle && s.place.rank < RIFFLE.riffle! - 1) eq(s.back, BLANK_PAGE, `sheet ${s.place.rank} back`);
  for (const s of air(1990)) truthy(s.baseTurned === 2 && s.index >= 2, `a riffle sheet is numbered after the two turned sheets (${s.index})`);
  eq(air(2100).length, 0, "no sheet is left fluttering once S11 has run 60 frames");
  const lastLanding = riffleFrames({ start: RIFFLE.start, count: RIFFLE.riffle }).last;
  eq(air(lastLanding + Math.ceil(FLUTTER_SEC * 60) + 1).length, 0, "the flutter of the last sheet is over");
  for (let f = 1920; f < 2100; f++) {
    for (const s of air(f)) {
      truthy(s.front >= -1 && s.front <= 12 && s.back >= -1 && s.back <= 12, `frame ${f}: pages in range`);
      truthy(s.progress >= 0 && s.progress <= 1, `frame ${f}: progress`);
    }
    truthy(air(f).length <= RIFFLE.riffle! + 1, `frame ${f}: at most the riffle's sheets (and the one before it)`);
  }
});

test("patch 16: a sheet of the riffle is well-formed with the stacks at the middle of the block (finite shape, on the left stack when it lands)", () => {
  const turned = turnedAt(2030, TURNS);
  const layout = sheetLayout(MINI, { coverAngle: getBookState("mini-me", 2030)!.coverAngle, turned }, 2);
  truthy(layout.W > 10 && layout.H > 15, `the leaf is ${layout.W} x ${layout.H} cm`);
  const place = { rank: RIFFLE.riffle! - 1, count: RIFFLE.riffle! };
  const shape = shapeOf(layout);
  for (const [P, land] of [[0, 0], [0.4, 0], [0.8, 0], [1, 0], [1, 0.5]] as const) {
    const mesh = sheetMesh(P, land, layout, shape, place);
    truthy(Array.from(mesh.front as ArrayLike<number>).every(Number.isFinite), `P ${P}: finite mesh`);
  }
  truthy(SINGLE.count === 1, "a single turn is still alone");
});

test("patch 16: the script closes the book on a block with nothing turned, and a script that does not is refused", () => {
  checkTurns("mini-me", TURNS);
  near(turnedAt(2808, TURNS), 0, 1e-9, "after S14's two chunks the block has nothing turned when the cover closes");
  near(getBookState("mini-me", 2900)!.turned, 0, 1e-9);
  eq(JSON.stringify(stacksAt(2808, TURNS)), JSON.stringify({ left: 0, airborne: false }));
  const f2808 = faceIndices(2808, TURNS);
  eq(`${f2808.left},${f2808.right}`, "0,1", "the cover closes on the endpaper and the half-title");
  const mid = faceIndices(2770, TURNS);
  truthy(mid.left === 4 && mid.right === 11, `during the first chunk the left face is the abstract (4) and the links page (11) is under the sheet, got ${mid.left},${mid.right}`);
  const bad: TurnEvent[] = [{ start: 100 }, { start: 200, riffle: 11, through: 62 }];
  throws(() => checkTurns("x", bad), "end with 63 sheets", "a riffle left open");
  throws(() => checkTurns("x", [{ start: 100, dir: -1 }]), "turns back more than has been turned");
  throws(() => checkTurns("x", [{ start: 100, riffle: 9 }]), "10 to 14 sheets");
  throws(() => checkTurns("x", [{ start: 100, riffle: 11, dir: -1 }]), "only goes forward");
  throws(() => checkTurns("x", [{ start: 100, riffle: 11, through: 5 }]), "draws 11");
  checkTurns("minilocker", BOOK_SCRIPT.minilocker!.turns);
});

// ---------- the book's own motion: tilt and the steady hold ----------

test("patch 16: the book is raised during S10 (pitch -10 to +7, yaw 0 to 3.5), then constant, and back to zero for the set-down", () => {
  near(trackAt(HERO.pitch, 1920), -10, 1e-9);
  near(trackAt(HERO.pitch, 2040), 7, 1e-9);
  near(trackAt(HERO.yaw, 1920), 0, 1e-9);
  near(trackAt(HERO.yaw, 2040), 3.5, 1e-9);
  for (let f = 2040; f <= 2760; f += 20) {
    near(trackAt(HERO.pitch, f), 7, 1e-9, `pitch at ${f}`);
    near(trackAt(HERO.yaw, f), 3.5, 1e-9, `yaw at ${f}`);
  }
  near(heroOffsetAt(2880).pitchDeg, 0, 1e-9);
  near(heroOffsetAt(2880).yawDeg, 0, 1e-9);
  let stepP = 0;
  for (let f = 1921; f <= 2040; f++) stepP = Math.max(stepP, Math.abs(trackAt(HERO.pitch, f) - trackAt(HERO.pitch, f - 1)));
  truthy(stepP < 0.3, `the book is raised at most ${stepP.toFixed(3)} degrees a frame`);
  let worst = 0;
  for (let f = 1921; f < 2880; f++) {
    const a = getBookPose("mini-me", f - 1)!;
    const b = getBookPose("mini-me", f)!;
    worst = Math.max(worst, Math.abs((b.pitchDeg ?? 0) - (a.pitchDeg ?? 0)), Math.abs((b.yawDeg ?? 0) - (a.yawDeg ?? 0)));
    truthy(Math.hypot(b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]) < 1.2, `frame ${f}: the book moves under 1.2 cm`);
  }
  truthy(worst < 0.5, `the book never turns ${worst.toFixed(3)} degrees in one frame (0.5 limit)`);
});

test("patch 16: the hand's sway fades out for the links spread and back in after it; the camera's steady range is the same shot", () => {
  eq(MOTION.steady.ranges.length, 2, "S13 and, since Patch 18, S20");
  eq(MOTION.steady.ranges[0].from, SHOTS[13].from);
  eq(MOTION.steady.ranges[0].to, SHOTS[13].to);
  eq(bookSteadyGain(2000), 1);
  eq(bookSteadyGain(2520 - 12 - 1), 1, "before the blend");
  eq(bookSteadyGain(2520), 0, "the first frame of S13");
  eq(bookSteadyGain(2759), 0, "the last frame of S13");
  eq(bookSteadyGain(2760 + 12), 1, "back after the blend");
  let prev = bookSteadyGain(2500);
  for (let f = 2501; f < 2800; f++) {
    const g = bookSteadyGain(f);
    truthy(g >= 0 && g <= 1 && Math.abs(g - prev) < 0.2, `frame ${f}: the sway is never switched on or off (${prev} to ${g})`);
    prev = g;
  }
  eq(STEADY_RANGES.some((r) => r.from === 2520 && r.to === 2759), true, "the camera has the same range");
  eq(cameraSteadyGain(2640), 0, "the camera's breathing and tremor are off in the hold");
  eq(cameraSteadyGain(2000), 1);
});

test("patch 16: during the links spread the book does not move at all: no roll, no tremor, no change of pose from frame 2532 to the end of S13", () => {
  const ref = getBookPose("mini-me", 2532)!;
  for (let f = 2532; f <= 2759; f++) {
    const p = getBookPose("mini-me", f)!;
    near(p.position[0], ref.position[0], 1e-9, `x at ${f}`);
    near(p.position[1], ref.position[1], 1e-9, `y at ${f}`);
    near(p.position[2], ref.position[2], 1e-9, `z at ${f}`);
    near(p.pitchDeg ?? 0, ref.pitchDeg ?? 0, 1e-9, `pitch at ${f}`);
    near(p.yawDeg ?? 0, ref.yawDeg ?? 0, 1e-9, `yaw at ${f}`);
    near(p.rollDeg ?? 0, 0, 1e-9, `roll at ${f}`);
    const st = getBookState("mini-me", f)!;
    near(st.coverAngle, getBookState("mini-me", 2532)!.coverAngle, 1e-12, `the cover is still at ${f}`);
  }
  near(ref.pitchDeg ?? 0, 87, 1e-9, "upright: 80 (the reading pose) + 7");
  eq(getBookLocation("mini-me", 2640), "hand");
});

// ---------- the camera ----------

test("patch 16: the camera keys of S10-S13 are on beats, in R3, owned one shot each, and S13's key is the state S14 starts from", () => {
  const frames = Object.fromEntries(ids.map((id) => [id, shotById(id).camera.map((k) => k.frame)]));
  eq(JSON.stringify(frames), JSON.stringify({ S10: [2040], S11: [2100], S12: [], S13: [2760] }));
  for (const id of ids) for (const k of shotById(id).camera) {
    eq(k.frame % BEAT, 0, `${id} key ${k.frame}`);
    eq(k.regime, "R3", `${id} key ${k.frame}`);
    eq(k.rollDeg, 0, `${id} key ${k.frame}: no roll`);
    eq(k.tiltDeg, 0, `${id} key ${k.frame}: no tilt`);
  }
  truthy(FILM_CAMERA_KEYFRAMES.some((k) => k.frame === 2760), "S13's key on the first frame of S14 is in the film's camera (Patch 17 adds S14-S15 after it)");
  eq(JSON.stringify(stateOf(shotById("S10").camera[0])), JSON.stringify(HERO_STATES.block));
  eq(JSON.stringify(stateOf(shotById("S13").camera[0])), JSON.stringify(HERO_STATES.links));
  eq(shotById("S09").camera[0].frame, 1920, "S09's key on the first frame of S10 is where S10 starts from");
});

test("patch 16: the pull back is 11 percent from the reading view, then 4 percent a spread (about) to M 6.52, never above the R3 budget", () => {
  near(authoredAt(1920).state.M, VIEW_READ.M, 1e-9);
  near(authoredAt(2040).state.M, VIEW_BLOCK.M, 1e-9);
  near(authoredAt(2760).state.M, VIEW_LINKS.M, 1e-9);
  truthy(VIEW_BLOCK.M / VIEW_READ.M < 0.92 && VIEW_BLOCK.M / VIEW_READ.M > 0.86, "S10 pulls back by about a tenth (guide 05: 'pull back 6 cm')");
  for (const [a, b] of [[2040, 2280], [2280, 2520], [2520, 2760]]) {
    const r = authoredAt(b).state.M / authoredAt(a).state.M - 1;
    truthy(r > 0.035 && r < 0.045, `the push from ${a} to ${b} is ${(r * 100).toFixed(2)} percent (guide 05: 4 percent a spread)`);
  }
  let max = 0;
  for (let f = 1920; f < 2760; f++) max = Math.max(max, authoredAt(f).state.M);
  truthy(max <= limitFor("R3").maxM, `largest M ${max} (budget ${limitFor("R3").maxM})`);
  for (let f = 1920; f < 2760; f += 10) {
    eq(authoredAt(f).state.rollDeg, 0, `roll at ${f}`);
    eq(authoredAt(f).state.tiltDeg, 0, `tilt at ${f}`);
  }
});

test("patch 16: the lens is the table's: focus 36 at the end of S10, 28 from frame 2100 on, f/2.8 throughout", () => {
  near(authoredAt(2040).state.focusCm, 36, 1e-9);
  near(authoredAt(2100).state.focusCm, 28, 1e-6);
  near(authoredAt(2500).state.focusCm, 28, 1e-6);
  near(authoredAt(2759).state.focusCm, 28, 1e-6);
  for (const f of [1920, 2000, 2040, 2100, 2400, 2759]) near(authoredAt(f).state.aperture, 2.8, 1e-9, `aperture at ${f}`);
});

test("patch 16: the audit is clean for frames 1920-2759 with no exception, the whole film so far has only the documented opening hold, and the limits of R3 hold", () => {
  const r = auditMotion({ from: 1920, to: 2759, exceptions: [] });
  eq(r.findings.length, 0, JSON.stringify(r.findings));
  const all = auditMotion();
  eq(all.range.join("-"), "0-5399", "the film's camera now runs to the end of S25, the whole film (Patch 20; it ended at S23 in Patch 19)");
  eq(all.unexplained, 0, JSON.stringify(all.findings.filter((f) => !f.known)));
  eq(all.counts.STILL, 1, "only the documented opening hold");
  const lim = limitFor("R3");
  truthy(r.stats.peakLateralCmPerSec <= lim.lateralCmPerSec, `sideways ${r.stats.peakLateralCmPerSec} cm/s`);
  truthy(r.stats.peakMRatePerSec <= 1.5, `M rate ${r.stats.peakMRatePerSec}`);
  truthy(r.stats.peakPopFraction < 0.02, "no pop");
});

test("patch 16: the spread stays inside the frame through the riffle and the three spreads, within 70 px of the middle from the end of S10, and keeps its 200 px margins", () => {
  for (let f = 1920; f <= 2759; f += 30) {
    const b = measure(f);
    truthy(b.x0 > 200 && b.x1 < WIDTH - 200 && b.y0 > 150 && b.y1 < HEIGHT - 150, `frame ${f}: the spread (${Math.round(b.x0)}-${Math.round(b.x1)} x ${Math.round(b.y0)}-${Math.round(b.y1)}) keeps its margins`);
    if (f >= 2040) truthy(Math.abs((b.y0 + b.y1) / 2 - HEIGHT / 2) < 70, `frame ${f}: the spread is in the middle of the frame's height`);
  }
});

// ---------- the QR hold ----------

test("patch 16: the QR hold: the page is square-on within 4 degrees, flat and steady, for at least 90 consecutive frames (here 186, from the landing of the turn)", () => {
  const landed = 2520 + turnFrames(false);
  let run = 0;
  let best = 0;
  for (let f = 2520; f < 2760; f++) {
    const fa = faceIndices(f, TURNS);
    const m = measure(f);
    const steady = bookSteadyGain(f) === 0 && cameraSteadyGain(f) < 1e-9;
    const pose = getBookPose("mini-me", f)!;
    const ok = f >= landed && fa.right === 11 && m.angleDeg <= 4 && Math.abs(pose.rollDeg ?? 0) < 1e-9 && steady;
    run = ok ? run + 1 : 0;
    best = Math.max(best, run);
  }
  truthy(best >= 90, `the hold lasts ${best} frames`);
  eq(best, 2760 - landed, "from the landing of the turn to the end of S13");
  for (let f = 2640; f < 2760; f++) truthy(measure(f).angleDeg < 2, `frame ${f}: ${measure(f).angleDeg.toFixed(2)} degrees off square`);
});

test("patch 16: the sheet that lands on 2574 has stopped fluttering before frame 2640, and it is on the left page: nothing moves on the QR page", () => {
  const stops = 2574 + Math.ceil(FLUTTER_SEC * 60);
  truthy(stops < 2640, `the flutter is drawn until ${stops}`);
  eq(airSheetsAt(2640, TURNS).length, 0);
  truthy(airSheetsAt(2600, TURNS).length <= 1, "at most the landed sheet, on the left stack");
  eq(faceIndices(2600, TURNS).right, 11, "the QR page is the right face, a face and not a sheet");
});

test("patch 16: a code on the page is at least 3 pixels a module on screen through the hold, and a simulated frame decodes at that size", () => {
  const targets = getQrTargets("mini-me");
  eq(targets.length, 2);
  // the printed size of the code on the links page, from the page plan (the way `npm run qr:check` gets it; the widths of letters do not matter for where a code stands)
  const plan = planBook("mini-me", { spec: MINI, measure: (text, f) => Array.from(text).length * f.size * (f.weight === 700 ? 0.55 : 0.5), imageSize: () => ({ w: 1600, h: 1000 }) }).find((p) => p.type === "P-LINK")!;
  const codeCm = plan.qr[0].code.w / PAGE_PX_PER_CM;
  truthy(codeCm >= 3.4 && codeCm < 6, `the code is ${codeCm.toFixed(2)} cm on paper`);
  let minPx = Infinity;
  for (let f = 2574; f < 2760; f++) minPx = Math.min(minPx, (measure(f).pxPerCm * codeCm) / qrMatrix(targets[0].url).size);
  truthy(minPx >= 3.0, `the 33-module code is ${minPx.toFixed(2)} px a module at its smallest in the hold`);
  for (const t of targets) {
    const m = qrMatrix(t.url);
    const got = decodeSimulated(m.text, 3.0);
    eq(got, t.url, `${t.label}: decoded at 3.0 px a module with blur and grain`);
  }
});

/** A code drawn the way the film shows it: area-averaged to `pxPerModule`, lightly blurred, with grain; read by jsQR. Deterministic. */
function decodeSimulated(text: string, pxPerModule: number): string | null {
  const m = qrMatrix(text);
  const quiet = 4;
  const n = m.size + 2 * quiet;
  const margin = 12;
  const side = Math.ceil(n * pxPerModule) + 2 * margin;
  const S = 6;
  const gray = new Float64Array(side * side);
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      let sum = 0;
      for (let j = 0; j < S; j++)
        for (let i = 0; i < S; i++) {
          const mx = Math.floor((x + (i + 0.5) / S - margin - 0.37) / pxPerModule) - quiet;
          const my = Math.floor((y + (j + 0.5) / S - margin - 0.21) / pxPerModule) - quiet;
          const inside = mx >= 0 && my >= 0 && mx < m.size && my < m.size;
          const dark = inside && m.cells[my * m.size + mx] === 1;
          const inQuiet = mx >= -quiet && my >= -quiet && mx < m.size + quiet && my < m.size + quiet;
          sum += dark ? 22 : inQuiet ? 246 : 120;
        }
      gray[y * side + x] = sum / (S * S);
    }
  const out = new Uint8ClampedArray(side * side * 4);
  let seed = 12345;
  const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296 - 0.5) * 2;
  for (let y = 0; y < side; y++)
    for (let x = 0; x < side; x++) {
      const at = (xx: number, yy: number): number => gray[Math.min(side - 1, Math.max(0, yy)) * side + Math.min(side - 1, Math.max(0, xx))];
      const blur = 0.6 * at(x, y) + 0.1 * (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1));
      const v = Math.max(0, Math.min(255, blur + 6 * rnd()));
      out.set([v, v, v, 255], (y * side + x) * 4);
    }
  return jsQR(out, side, side)?.data ?? null;
}

// ---------- the film page, the cues, the files ----------

test("patch 16: the film page never plays: nothing on the page or in the scene is a video or reads the frame", () => {
  for (const file of ["src/paint/pages/planners.ts", "src/paint/pages/render.ts", "src/paint/pages/index.ts", "src/scene/OpenPages.tsx", "src/scene/useActPages.ts", "src/shots/S12.tsx"]) {
    const src = read(file);
    truthy(!/<video|OffthreadVideo|Html5Video|useCurrentFrame/.test(src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")), `${file} plays or reads the frame`);
  }
  const film = spreadAt("mini-me", 8).right;
  eq(film?.type, "P-FILM");
  eq(JSON.stringify(faceIndices(2400, TURNS)), JSON.stringify(faceIndices(2500, TURNS)), "the same page on the same face from 2340 to 2519");
});

test("patch 16: the must-read spreads stay on screen at least 120 frames each with no roll: gallery, film, links", () => {
  const vertical = (start: number): number => {
    for (let f = start; f < start + 80; f++) if (turnProgress(f, start, turnFrames(false)) >= 0.5) return f;
    throw new Error("no vertical frame");
  };
  const gallery = vertical(2280) - 2030;
  const film = vertical(2520) - vertical(2280);
  const links = 2760 - vertical(2520);
  truthy(gallery >= 120 && film >= 120 && links >= 120, `gallery ${gallery}, film ${film}, links ${links} frames`);
  for (let f = 2030; f < 2760; f++) eq(authoredAt(f).state.rollDeg, 0, `roll at ${f}`);
});

test("patch 16: the cues are on the shots' own frames, in order, and the turns' cues sit on the turns' start frames", () => {
  const by = (id: string) => shotById(id).cues.map((c) => `${c.frame}:${c.name}`).join(",");
  eq(by("S10"), "1920:riffle", "guide 08: riffle on 1920");
  eq(by("S11"), "2040:paper-settle", "guide 08: paper-settle on 2040");
  eq(by("S12"), "2280:page-turn");
  eq(by("S13"), "2520:page-turn");
  // `book-set` of S15 is off the beat on purpose: its sound starts two frames before the touch on 2940 (Patch 17); Patch 18 adds three more, all of the second
  // book's close (3816, 3846, 3898, see tests/acts6.test.ts)
  const OFF_BEAT = [2938, 3816, 3846, 3898];
  for (const c of FILM_CUES.filter((c) => !OFF_BEAT.includes(c.frame))) eq(c.frame % BEAT, 0, `cue ${c.name} on ${c.frame} is on a beat`);
  truthy(FILM_CUES.filter((c) => c.name === "page-turn" && c.frame < 3000).every((c) => TURNS.some((t) => t.start === c.frame && !t.riffle) || c.frame === 1560 || c.frame === 1680), "every page-turn cue of Mini Me is a turn of the script");
  eq(RIFFLE.start, 1920, "the flutter starts with the riffle");
});

test("patch 16: the tools and the lab know the riffle: qr:check reads film frames, the lab and the film draw the riffle's sheets from the ledger", () => {
  const qr = read("scripts/check-qr.mjs");
  truthy(qr.includes("--frames=2600-2700") && qr.includes('id: "ReelFilm"') && qr.includes("jsQR(px"), "qr:check has the film-frame mode");
  const open = read("src/scene/OpenPages.tsx");
  truthy(open.includes("place={s.place}") && open.includes("pages.texture(s.front)") && open.includes("pages.texture(s.back)"), "the film's open book draws each sheet with its own place and pages");
  const lab = read("src/dev/DevBookMotion.tsx");
  truthy(lab.includes("place={s.place}") && lab.includes("faceIndices"), "the lab draws the same sheets and faces");
  const hook = read("src/scene/useActPages.ts");
  truthy(hook.includes("b.pages[i] ?") && hook.includes(": null"), "a missing page (the riffle's blank pages) is no texture");
});
